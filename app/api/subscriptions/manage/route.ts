import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRazorpayKeyId,
  getRazorpayKeySecret,
} from "@/lib/supabase/razorpay";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ManageSubscriptionBody = {
  action?: "cancel" | "reactivate";
};

type RazorpayErrorResponse = {
  error?: {
    description?: string;
  };
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
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      (await request.json()) as ManageSubscriptionBody;

    if (
      body.action !== "cancel" &&
      body.action !== "reactivate"
    ) {
      return NextResponse.json(
        {
          error: "Please select a valid membership action.",
        },
        {
          status: 400,
        },
      );
    }

    const admin = createAdminClient();

    const {
      data: subscription,
      error: subscriptionError,
    } = await admin
      .from("subscriptions")
      .select(
        `
          id,
          status,
          cancel_at_period_end,
          razorpay_subscription_id,
          payment_provider
        `,
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Unable to load subscription:",
        subscriptionError,
      );

      return NextResponse.json(
        {
          error: "Unable to load your membership.",
        },
        {
          status: 500,
        },
      );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          error: "No membership was found.",
        },
        {
          status: 404,
        },
      );
    }

    const providerSubscriptionId =
      subscription.razorpay_subscription_id;

    const isDemoSubscription =
      subscription.payment_provider === "demo" ||
      providerSubscriptionId?.startsWith("demo_") === true;

    if (body.action === "reactivate") {
      if (!isDemoSubscription) {
        return NextResponse.json(
          {
            error:
              "Only a simulated membership can be reactivated from this demonstration flow.",
          },
          {
            status: 400,
          },
        );
      }

      const { error: updateError } = await admin
        .from("subscriptions")
        .update({
          status: "active",
          cancel_at_period_end: false,
          canceled_at: null,
          payment_provider: "demo",
        })
        .eq("id", subscription.id)
        .eq("user_id", user.id);

      if (updateError) {
        console.error(
          "Unable to reactivate subscription:",
          updateError,
        );

        return NextResponse.json(
          {
            error: "Unable to reactivate your membership.",
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        success: true,
        message:
          "Your demo membership will remain active.",
      });
    }

    if (
      !["active", "trialing"].includes(subscription.status)
    ) {
      return NextResponse.json(
        {
          error:
            "Only an active membership can be cancelled.",
        },
        {
          status: 409,
        },
      );
    }

    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        message:
          "Your membership cancellation is already scheduled.",
      });
    }

    if (!isDemoSubscription) {
      if (!providerSubscriptionId) {
        return NextResponse.json(
          {
            error:
              "The Razorpay subscription ID is missing.",
          },
          {
            status: 500,
          },
        );
      }

      const credentials = Buffer.from(
        `${getRazorpayKeyId()}:${getRazorpayKeySecret()}`,
      ).toString("base64");

      const razorpayResponse = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(
          providerSubscriptionId,
        )}/cancel`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            cancel_at_cycle_end: 1,
          }),
          cache: "no-store",
        },
      );

      if (!razorpayResponse.ok) {
        const razorpayError =
          (await razorpayResponse
            .json()
            .catch(() => null)) as RazorpayErrorResponse | null;

        console.error(
          "Razorpay cancellation failed:",
          razorpayError,
        );

        return NextResponse.json(
          {
            error:
              razorpayError?.error?.description ??
              "Razorpay could not schedule the cancellation.",
          },
          {
            status: 502,
          },
        );
      }
    }

    const { error: updateError } = await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        payment_provider: isDemoSubscription
          ? "demo"
          : "razorpay",
      })
      .eq("id", subscription.id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error(
        "Unable to save cancellation:",
        updateError,
      );

      return NextResponse.json(
        {
          error:
            "Cancellation was requested, but its status could not be saved.",
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Your membership will remain active until ${subscription.cancel_at_period_end ? "the scheduled date" : "the end of the current billing period"}.`,
    });
  } catch (error) {
    console.error("Manage subscription error:", error);

    return NextResponse.json(
      {
        error: "Unable to update your membership.",
      },
      {
        status: 500,
      },
    );
  }
}