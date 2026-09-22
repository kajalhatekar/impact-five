import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getRazorpayKeyId,
  getRazorpayKeySecret,
} from "@/lib/supabase/razorpay";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SubscriptionActionBody = {
  userId?: string;
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

    const { data: isAdmin, error: adminCheckError } =
      await supabase.rpc("is_admin");

    if (adminCheckError) {
      console.error("Unable to verify administrator:", adminCheckError);

      return NextResponse.json(
        {
          error: "Unable to verify administrator access.",
        },
        {
          status: 500,
        },
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        {
          error: "Administrator access is required.",
        },
        {
          status: 403,
        },
      );
    }

    const body = (await request.json()) as SubscriptionActionBody;

    const userId = body.userId?.trim();
    const action = body.action;

    if (!userId) {
      return NextResponse.json(
        {
          error: "Member ID is required.",
        },
        {
          status: 400,
        },
      );
    }

    if (action !== "cancel" && action !== "reactivate") {
      return NextResponse.json(
        {
          error: "Please select a valid subscription action.",
        },
        {
          status: 400,
        },
      );
    }

    const admin = createAdminClient();

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select(
        `
          id,
          user_id,
          status,
          cancel_at_period_end,
          payment_provider,
          razorpay_subscription_id,
          current_period_end
        `,
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (subscriptionError) {
      console.error("Unable to load member subscription:", subscriptionError);

      return NextResponse.json(
        {
          error: "Unable to load the member’s subscription.",
        },
        {
          status: 500,
        },
      );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          error: "This member does not have a subscription.",
        },
        {
          status: 404,
        },
      );
    }

    const providerSubscriptionId = subscription.razorpay_subscription_id;

    const isDemoSubscription =
      subscription.payment_provider === "demo" ||
      providerSubscriptionId?.startsWith("demo_") === true;

    if (action === "reactivate") {
      if (!isDemoSubscription) {
        return NextResponse.json(
          {
            error:
              "A real Razorpay subscription cannot be manually reactivated. The member must complete a new checkout.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        subscription.status === "active" &&
        !subscription.cancel_at_period_end
      ) {
        return NextResponse.json({
          success: true,
          message: "This demo subscription is already active.",
        });
      }

      const now = new Date();
      const existingEndDate = subscription.current_period_end
        ? new Date(subscription.current_period_end)
        : null;

      const periodEnd =
        existingEndDate &&
        !Number.isNaN(existingEndDate.getTime()) &&
        existingEndDate > now
          ? existingEndDate
          : new Date(
              Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth() + 1,
                now.getUTCDate(),
              ),
            );

      const { error: reactivateError } = await admin
        .from("subscriptions")
        .update({
          status: "active",
          cancel_at_period_end: false,
          canceled_at: null,
          current_period_end: periodEnd.toISOString(),
          payment_provider: "demo",
        })
        .eq("id", subscription.id)
        .eq("user_id", userId);

      if (reactivateError) {
        console.error(
          "Unable to reactivate member subscription:",
          reactivateError,
        );

        return NextResponse.json(
          {
            error: `Unable to reactivate the subscription: ${reactivateError.message}`,
          },
          {
            status: 500,
          },
        );
      }

      return NextResponse.json({
        success: true,
        message: "The member’s demo subscription is active again.",
      });
    }

    if (!["active", "trialing"].includes(subscription.status)) {
      return NextResponse.json(
        {
          error: "Only an active subscription can be cancelled.",
        },
        {
          status: 409,
        },
      );
    }

    if (subscription.cancel_at_period_end) {
      return NextResponse.json({
        success: true,
        message: "Cancellation is already scheduled for this subscription.",
      });
    }

    if (!isDemoSubscription) {
      if (!providerSubscriptionId) {
        return NextResponse.json(
          {
            error: "The Razorpay subscription ID is missing.",
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
        const razorpayError = (await razorpayResponse
          .json()
          .catch(() => null)) as RazorpayErrorResponse | null;

        console.error(
          "Razorpay administrator cancellation failed:",
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

    const { error: cancellationError } = await admin
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        payment_provider: isDemoSubscription ? "demo" : "razorpay",
      })
      .eq("id", subscription.id)
      .eq("user_id", userId);

    if (cancellationError) {
      console.error("Unable to save member cancellation:", cancellationError);

      return NextResponse.json(
        {
          error: `Cancellation was requested, but its status could not be saved: ${cancellationError.message}`,
        },
        {
          status: 500,
        },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "The subscription will remain active until the end of its current billing period.",
    });
  } catch (error) {
    console.error("Administrator subscription action error:", error);

    return NextResponse.json(
      {
        error: "Unable to update the subscription.",
      },
      {
        status: 500,
      },
    );
  }
}
