import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  createRazorpayClient,
  getRazorpayKeyId,
} from "@/lib/supabase/razorpay";

type CreateSubscriptionBody = {
  planCode?: string;
};

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

    const body = (await request.json()) as CreateSubscriptionBody;
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
        "id, code, name, price_paise, currency, billing_interval, razorpay_plan_id",
      )
      .eq("code", planCode)
      .eq("is_active", true)
      .single();

    if (planError) {
      console.error("Subscription plan query failed:", planError);

      return NextResponse.json(
        {
          error: `Unable to load subscription plan: ${planError.message}`,
        },
        { status: 500 },
      );
    }

    if (!plan) {
      return NextResponse.json(
        { error: "The selected subscription plan was not found." },
        { status: 404 },
      );
    }

    if (!plan.razorpay_plan_id) {
      return NextResponse.json(
        { error: "The selected plan is not connected to Razorpay." },
        { status: 500 },
      );
    }

    const { data: currentSubscription } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      currentSubscription?.status === "active" ||
      currentSubscription?.status === "trialing"
    ) {
      return NextResponse.json(
        { error: "You already have an active subscription." },
        { status: 409 },
      );
    }

    const razorpay = createRazorpayClient();

    const totalCount = plan.billing_interval === "month" ? 12 : 5;

    const razorpaySubscription = await razorpay.subscriptions.create({
      plan_id: plan.razorpay_plan_id,
      total_count: totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: {
        user_id: user.id,
        plan_id: plan.id,
        plan_code: plan.code,
      },
    });

    const { error: subscriptionError } = await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: user.id,
          plan_id: plan.id,
          razorpay_customer_id: null,
          razorpay_subscription_id: razorpaySubscription.id,
          payment_provider: "razorpay",
          status: "incomplete",
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          canceled_at: null,
        },
        {
          onConflict: "user_id",
        },
      );

    if (subscriptionError) {
      console.error("Unable to save Razorpay subscription:", subscriptionError);

      return NextResponse.json(
        { error: "The subscription could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      keyId: getRazorpayKeyId(),
      subscriptionId: razorpaySubscription.id,
      plan: {
        code: plan.code,
        name: plan.name,
        amount: plan.price_paise,
        currency: plan.currency,
      },
    });
  } catch (error) {
    console.error("Create subscription error:", error);

    return NextResponse.json(
      { error: "Unable to start the subscription checkout." },
      { status: 500 },
    );
  }
}
