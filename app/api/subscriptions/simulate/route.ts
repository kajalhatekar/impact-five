import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SimulateSubscriptionBody = {
  planCode?: string;
};

function addBillingPeriod(date: Date, billingInterval: string) {
  const result = new Date(date);

  if (billingInterval === "year") {
    result.setUTCFullYear(result.getUTCFullYear() + 1);
  } else {
    result.setUTCMonth(result.getUTCMonth() + 1);
  }

  return result;
}

export async function POST(request: Request) {
  try {
    if (process.env.ENABLE_DEMO_PAYMENTS !== "true") {
      return NextResponse.json(
        { error: "Demo subscriptions are not enabled." },
        { status: 403 },
      );
    }

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

    const body = (await request.json()) as SimulateSubscriptionBody;
    const planCode = body.planCode?.trim().toLowerCase();

    if (planCode !== "monthly" && planCode !== "yearly") {
      return NextResponse.json(
        { error: "Please select a valid subscription plan." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: plan, error: planError } = await admin
      .from("subscription_plans")
      .select(
        "id, code, name, price_paise, currency, billing_interval",
      )
      .eq("code", planCode)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("Demo subscription plan query failed:", planError);

      return NextResponse.json(
        { error: "The selected subscription plan was not found." },
        { status: 404 },
      );
    }

    const { data: currentSubscription, error: currentError } =
      await admin
        .from("subscriptions")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();

    if (currentError) {
      console.error("Current subscription query failed:", currentError);

      return NextResponse.json(
        { error: "Unable to check the current subscription." },
        { status: 500 },
      );
    }

    if (
      currentSubscription?.status === "active" ||
      currentSubscription?.status === "trialing"
    ) {
      return NextResponse.json(
        { error: "You already have an active subscription." },
        { status: 409 },
      );
    }

    const periodStart = new Date();
    const periodEnd = addBillingPeriod(
      periodStart,
      plan.billing_interval,
    );

    const demoSubscriptionId = `demo_${randomUUID()}`;

    const { error: subscriptionError } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_id: plan.id,
          razorpay_customer_id: null,
          razorpay_subscription_id: demoSubscriptionId,
          status: "active",
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          cancel_at_period_end: false,
          canceled_at: null,
        },
        {
          onConflict: "user_id",
        },
      );

    if (subscriptionError) {
      console.error(
        "Unable to save simulated subscription:",
        subscriptionError,
      );

      return NextResponse.json(
        { error: "The simulated subscription could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      demo: true,
      status: "active",
      subscriptionId: demoSubscriptionId,
      plan: {
        code: plan.code,
        name: plan.name,
        amount: plan.price_paise,
        currency: plan.currency,
        billingInterval: plan.billing_interval,
      },
      currentPeriodStart: periodStart.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
      message:
        "Demo subscription activated. No real payment was processed.",
    });
  } catch (error) {
    console.error("Simulated subscription error:", error);

    return NextResponse.json(
      { error: "Unable to activate the simulated subscription." },
      { status: 500 },
    );
  }
}