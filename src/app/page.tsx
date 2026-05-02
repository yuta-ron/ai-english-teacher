"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { ConversationLog } from "@/components/ConversationLog";
import { StatusIndicator } from "@/components/StatusIndicator";
import { AccentSelector, type Accent } from "@/components/AccentSelector";
import { useRealtimeSession, parseJwtExp } from "@/hooks/useRealtimeSession";

type PaymentState = "loading" | "no-token" | "ready" | "in-session" | "expired";

const PAYMENT_TOKEN_KEY = "ai_payment_token";
const SESSION_TOKEN_KEY = "ai_session_token";
const SESSION_EXP_KEY = "ai_session_exp";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Home() {
  const {
    status,
    isPaused,
    messages,
    amplitude,
    remainingSeconds,
    connect,
    disconnect,
    pause,
    resume,
  } = useRealtimeSession();

  const [accent, setAccent] = useState<Accent>("american");
  const [paymentState, setPaymentState] = useState<PaymentState>("loading");
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Initialize: check URL token and localStorage
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlToken = url.searchParams.get("token");
    if (urlToken) {
      localStorage.setItem(PAYMENT_TOKEN_KEY, urlToken);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }

    const sessionExp = Number(localStorage.getItem(SESSION_EXP_KEY) || 0);
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);

    if (sessionToken && sessionExp > Math.floor(Date.now() / 1000)) {
      setPaymentState("ready");
      return;
    }

    const paymentToken = localStorage.getItem(PAYMENT_TOKEN_KEY);
    if (paymentToken && parseJwtExp(paymentToken) > Math.floor(Date.now() / 1000)) {
      setPaymentState("ready");
      return;
    }

    setPaymentState("no-token");
  }, []);

  // Sync paymentState with session status
  useEffect(() => {
    if (status === "listening" || status === "speaking") {
      setPaymentState("in-session");
    }
  }, [status]);

  // Detect session expiry (remainingSeconds hits 0 while in session)
  useEffect(() => {
    if (remainingSeconds === 0 && paymentState === "in-session") {
      setPaymentState("expired");
    }
  }, [remainingSeconds, paymentState]);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setIsPurchasing(false);
    }
  };

  const handleStartSession = async () => {
    const paymentToken = localStorage.getItem(PAYMENT_TOKEN_KEY) ?? undefined;
    await connect(accent, paymentToken);
  };

  const handleAccentChange = (newAccent: Accent) => {
    setAccent(newAccent);
    if (status !== "idle" && status !== "connecting") {
      disconnect();
      connect(newAccent);
    }
  };

  const canPause = status === "listening" || status === "speaking";
  const isActive = status !== "idle" && status !== "connecting";
  const isSessionActive = paymentState === "in-session";

  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-start py-6 px-4">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            AI English Teacher
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            いつでも気軽に英会話の練習を
          </p>
          {isSessionActive && remainingSeconds > 0 && (
            <div className={`mt-2 text-sm font-mono font-semibold tabular-nums ${remainingSeconds <= 60 ? "text-red-400" : "text-amber-400"}`}>
              残り {formatTime(remainingSeconds)}
            </div>
          )}
        </div>

        {/* Main content: side-by-side on PC, stacked on mobile */}
        <div className="flex flex-col md:flex-row gap-4 md:items-stretch">
          {/* Avatar card */}
          <div className="bg-slate-800 rounded-3xl p-6 flex flex-col items-center gap-3 shadow-xl border border-slate-700 md:w-72 md:shrink-0">
            <Avatar status={isPaused ? "idle" : status} amplitude={amplitude} />
            <div className="flex flex-col items-center gap-1">
              <p className="text-white font-semibold text-lg">Alex</p>
              {isPaused ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-2.5 h-2.5 rounded-full bg-slate-500" />
                  <span className="text-xs text-slate-400 font-medium">一時停止中</span>
                </div>
              ) : (
                <StatusIndicator status={status} />
              )}
            </div>

            {!isPaused && status === "listening" && (
              <p className="text-slate-400 text-xs text-center max-w-[220px]">
                話しかけてみましょう！
              </p>
            )}
            {isPaused && (
              <p className="text-slate-500 text-xs text-center max-w-[220px]">
                会話を一時停止しています
              </p>
            )}

            {/* Accent selector */}
            <div className="w-full border-t border-slate-700 pt-3">
              <AccentSelector
                value={accent}
                onChange={handleAccentChange}
                disabled={status === "connecting" || paymentState === "no-token" || paymentState === "loading"}
              />
            </div>

            {/* Payment / session controls */}
            {(paymentState === "no-token" || paymentState === "expired") && (
              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-600 disabled:text-slate-400 text-white transition-colors"
              >
                {isPurchasing ? (
                  "処理中..."
                ) : (
                  <>
                    <span>¥100</span>
                    <span className="text-indigo-200">で15分のセッションを購入</span>
                  </>
                )}
              </button>
            )}

            {paymentState === "ready" && (
              <button
                onClick={handleStartSession}
                disabled={status === "connecting"}
                className="w-full flex flex-col items-center gap-1 px-4 py-3 rounded-2xl text-sm font-semibold bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:text-slate-400 text-white transition-colors"
              >
                <span>{status === "connecting" ? "接続中..." : "セッションを開始"}</span>
                {remainingSeconds > 0 && (
                  <span className="text-xs text-green-200 font-mono">
                    残り {formatTime(remainingSeconds)}
                  </span>
                )}
              </button>
            )}

            {/* Pause / Resume button */}
            {canPause && (
              <button
                onClick={isPaused ? resume : pause}
                disabled={status === "speaking" && !isPaused}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-colors
                  ${isPaused
                    ? "bg-green-600 hover:bg-green-500 text-white"
                    : status === "speaking"
                      ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                      : "bg-slate-600 hover:bg-slate-500 text-white"
                  }`}
              >
                {isPaused ? (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    再開
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                    一時停止
                  </>
                )}
              </button>
            )}
          </div>

          {/* Conversation log — fixed height with internal scroll */}
          <div className="bg-slate-800 rounded-3xl shadow-xl border border-slate-700 overflow-hidden flex flex-col flex-1">
            <div className="px-4 py-3 border-b border-slate-700 shrink-0 flex items-center justify-between">
              <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider">
                会話ログ
              </p>
              {isActive && (
                <span className="text-slate-500 text-xs">
                  {messages.length} 件
                </span>
              )}
            </div>
            <div className="h-[340px] md:h-[520px] overflow-hidden">
              <ConversationLog messages={messages} />
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="text-center text-slate-500 text-xs leading-relaxed">
          {paymentState === "no-token" || paymentState === "expired"
            ? "¥100で15分間、AIと英会話の練習ができます。"
            : "英語で自由に話しかけてください。文法ミスは Alex が優しく訂正します。"}
        </div>
      </div>
    </main>
  );
}
