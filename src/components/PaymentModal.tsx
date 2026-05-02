"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const appearance = {
  theme: "night" as const,
  variables: {
    colorBackground: "#0f172a",
    colorText: "#f1f5f9",
    colorTextSecondary: "#94a3b8",
    colorDanger: "#ef4444",
    colorPrimary: "#6366f1",
    borderRadius: "12px",
    fontFamily: "inherit",
  },
};

function CheckoutForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (paymentIntentId: string) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "決済に失敗しました");
      setIsProcessing(false);
    } else if (paymentIntent?.status === "succeeded") {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:text-slate-400 text-white font-semibold transition-colors mt-2"
      >
        {isProcessing ? "処理中..." : "¥100 を支払う"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full py-2 text-slate-500 hover:text-slate-300 text-sm transition-colors"
      >
        キャンセル
      </button>
    </form>
  );
}

export function PaymentModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (paymentToken: string) => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/payment-intent", { method: "POST" })
      .then((r) => r.json())
      .then(({ clientSecret: cs }) => setClientSecret(cs));
  }, []);

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setVerifying(true);
    const res = await fetch("/api/stripe/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIntentId }),
    });
    const { token } = await res.json();
    if (token) onSuccess(token);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl border border-slate-700">
        <div className="text-center mb-6">
          <h2 className="text-white text-xl font-bold">15分セッションを購入</h2>
          <p className="text-slate-400 text-sm mt-1">AIと英会話を練習しましょう</p>
          <div className="mt-3 inline-flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">¥100</span>
            <span className="text-slate-400 text-sm"> / 15分</span>
          </div>
        </div>

        {verifying ? (
          <p className="text-center text-slate-400 py-6">確認中...</p>
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <CheckoutForm onSuccess={handlePaymentSuccess} onCancel={onClose} />
          </Elements>
        ) : (
          <p className="text-center text-slate-400 py-6">読み込み中...</p>
        )}
      </div>
    </div>
  );
}
