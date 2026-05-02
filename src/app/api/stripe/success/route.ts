import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { signToken } from "@/lib/jwt";

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.redirect(new URL("/", appUrl));
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.redirect(new URL("/", appUrl));
    }

    const token = await signToken({ type: "payment" }, "24h");
    const redirectUrl = new URL("/", appUrl);
    redirectUrl.searchParams.set("token", token);
    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(new URL("/", appUrl));
  }
}
