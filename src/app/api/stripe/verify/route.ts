import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { signToken } from "@/lib/jwt";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const { paymentIntentId } = await req.json().catch(() => ({}));
  if (!paymentIntentId) {
    return NextResponse.json({ error: "Missing paymentIntentId" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (
    paymentIntent.status !== "succeeded" ||
    paymentIntent.amount !== 100 ||
    paymentIntent.currency !== "jpy"
  ) {
    return NextResponse.json({ error: "Invalid payment" }, { status: 400 });
  }

  const token = await signToken({ type: "payment" }, "24h");
  return NextResponse.json({ token });
}
