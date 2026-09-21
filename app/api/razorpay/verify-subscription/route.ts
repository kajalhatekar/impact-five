import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";


import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createRazorpayClient, getRazorpayKeySecret } from "@/lib/supabase/razorpay";

type VerificationBody = {
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
  razorpaySignature?: string;
};

function isValidSignature(receivedSignature: string, expectedSignature: string) {
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function addBillingPeriod(date: Date, billingInterval: string) {
  const result = new Date(date);

  if (billingInterval === "year") {
    result.setFullYear(result.getFullYear() + 1);
  } else {
    result.setMonth(result.getMonth() + 1);
  }

  return result;
}

function getProviderStatus(status: string | undefined) {
  switch (status) {
    case "active":
    case "authenticated":
      return "active";

    case "pending":
    case "halted":
      return "past_due";

    case "cancelled":
    case "completed":
    case "expired":
      return "canceled";

    default:
      return "incomplete";
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as VerificationBody;

    const paymentId = body.razorpayPaymentId?.trim();
    const subscriptionId = body.razorpaySubscriptionId?.trim();
    const signature = body.razorpaySignature?.trim();

    if (!paymentId || !subscriptionId || !signature) {
      return NextResponse.json(
        { error: "Incomplete payment verification details." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: storedSubscription, error: storedSubscriptionError } =
      await admin
        .from("subscriptions")
        .select("id, plan_id, razorpay_subscription_id")
        .eq("user_id", user.id)
        .eq("razorpay_subscription_id", subscriptionId)
        .single();

    if (storedSubscriptionError || !storedSubscription) {
      return NextResponse.json(
        { error: "Subscription record was not found." },
        { status: 404 },
      );
    }

    const signaturePayload = `${paymentId}|${storedSubscription.razorpay_subscription_id}`;

    const expectedSignature = createHmac(
      "sha256",
      getRazorpayKeySecret(),
    )
      .update(signaturePayload)
      .digest("hex");

    if (!isValidSignature(signature, expectedSignature)) {
      return NextResponse.json(
        { error: "Payment verification failed." },
        { status: 400 },
      );
    }

    const { data: plan, error: planError } = await admin
      .from("subscription_plans")
      .select("billing_interval")
      .eq("id", storedSubscription.plan_id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Subscription plan was not found." },
        { status: 404 },
      );
    }

    const razorpay = createRazorpayClient();
    const providerSubscription =
      await razorpay.subscriptions.fetch(subscriptionId);

    const now = new Date();
    const fallbackPeriodEnd = addBillingPeriod(
      now,
      plan.billing_interval,
    );

    const currentPeriodStart =
      typeof providerSubscription.current_start === "number" &&
      providerSubscription.current_start > 0
        ? new Date(
            providerSubscription.current_start * 1000,
          ).toISOString()
        : now.toISOString();

    const currentPeriodEnd =
      typeof providerSubscription.current_end === "number" &&
      providerSubscription.current_end > 0
        ? new Date(providerSubscription.current_end * 1000).toISOString()
        : fallbackPeriodEnd.toISOString();

    const customerId =
      typeof providerSubscription.customer_id === "string"
        ? providerSubscription.customer_id
        : null;

    const providerStatus =
      typeof providerSubscription.status === "string"
        ? providerSubscription.status
        : undefined;

    const subscriptionStatus = getProviderStatus(providerStatus);

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        razorpay_customer_id: customerId,
        payment_provider: "razorpay",
        status: subscriptionStatus,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: false,
        canceled_at: null,
      })
      .eq("id", storedSubscription.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Subscription update failed:", updateError);

      return NextResponse.json(
        { error: "Payment succeeded, but subscription update failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      status: subscriptionStatus,
      message: "Subscription payment verified successfully.",
    });
  } catch (error) {
    console.error("Subscription verification error:", error);

    return NextResponse.json(
      { error: "Unable to verify the subscription payment." },
      { status: 500 },
    );
  }
}
