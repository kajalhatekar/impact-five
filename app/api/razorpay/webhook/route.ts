import {
  createHmac,
  timingSafeEqual,
} from "crypto";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type RazorpaySubscriptionEntity = {
  id?: string;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  cancel_at_cycle_end?: number | boolean | null;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    subscription?: {
      entity?: RazorpaySubscriptionEntity;
    };
  };
};

type SubscriptionUpdate = {
  status: string;
  payment_provider: "razorpay";
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string | null;
};

function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  webhookSecret: string,
) {
  if (!/^[a-f0-9]{64}$/i.test(receivedSignature)) {
    return false;
  }

  const expectedSignature = createHmac(
    "sha256",
    webhookSecret,
  )
    .update(rawBody)
    .digest();

  const receivedBuffer = Buffer.from(
    receivedSignature,
    "hex",
  );

  if (
    receivedBuffer.length !== expectedSignature.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedSignature,
  );
}

function mapSubscriptionStatus(
  providerStatus: string | undefined,
) {
  switch (providerStatus) {
    case "active":
    case "authenticated":
      return "active";

    case "pending":
    case "halted":
    case "paused":
      return "past_due";

    case "cancelled":
    case "completed":
    case "expired":
      return "canceled";

    case "created":
    default:
      return "incomplete";
  }
}

function timestampToISOString(
  timestamp: number | null | undefined,
) {
  if (
    typeof timestamp !== "number" ||
    timestamp <= 0
  ) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

export async function POST(request: Request) {
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(
      "RAZORPAY_WEBHOOK_SECRET is not configured.",
    );

    return NextResponse.json(
      {
        error: "Webhook configuration is missing.",
      },
      {
        status: 500,
      },
    );
  }

  const receivedSignature = request.headers.get(
    "x-razorpay-signature",
  );

  if (!receivedSignature) {
    return NextResponse.json(
      {
        error: "Webhook signature is missing.",
      },
      {
        status: 401,
      },
    );
  }

  /*
   * The raw request body must be used for signature
   * verification. Do not call request.json() first.
   */
  const rawBody = await request.text();

  const signatureIsValid = verifyWebhookSignature(
    rawBody,
    receivedSignature,
    webhookSecret,
  );

  if (!signatureIsValid) {
    console.error(
      "Razorpay webhook signature verification failed.",
    );

    return NextResponse.json(
      {
        error: "Invalid webhook signature.",
      },
      {
        status: 401,
      },
    );
  }

  let webhook: RazorpayWebhookPayload;

  try {
    webhook = JSON.parse(
      rawBody,
    ) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json(
      {
        error: "Invalid webhook payload.",
      },
      {
        status: 400,
      },
    );
  }

  const providerSubscription =
    webhook.payload?.subscription?.entity;

  /*
   * Some Razorpay webhook events may not contain a
   * subscription. They can safely be ignored.
   */
  if (!providerSubscription?.id) {
    return NextResponse.json({
      success: true,
      ignored: true,
    });
  }

  const subscriptionStatus =
    mapSubscriptionStatus(
      providerSubscription.status,
    );

  const update: SubscriptionUpdate = {
    status: subscriptionStatus,
    payment_provider: "razorpay",
  };

  const currentPeriodStart =
    timestampToISOString(
      providerSubscription.current_start,
    );

  const currentPeriodEnd =
    timestampToISOString(
      providerSubscription.current_end,
    );

  if (currentPeriodStart) {
    update.current_period_start =
      currentPeriodStart;
  }

  if (currentPeriodEnd) {
    update.current_period_end = currentPeriodEnd;
  }

  if (
    providerSubscription.cancel_at_cycle_end !==
      undefined &&
    providerSubscription.cancel_at_cycle_end !== null
  ) {
    update.cancel_at_period_end =
      providerSubscription.cancel_at_cycle_end ===
        1 ||
      providerSubscription.cancel_at_cycle_end ===
        true;
  }

  if (subscriptionStatus === "canceled") {
    update.cancel_at_period_end = false;

    update.canceled_at =
      timestampToISOString(
        providerSubscription.ended_at,
      ) ?? new Date().toISOString();
  } else if (subscriptionStatus === "active") {
    update.canceled_at = null;
  }

  const admin = createAdminClient();

  const {
    data: updatedSubscription,
    error: updateError,
  } = await admin
    .from("subscriptions")
    .update(update)
    .eq(
      "razorpay_subscription_id",
      providerSubscription.id,
    )
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error(
      "Unable to process Razorpay webhook:",
      updateError,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update the subscription.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * Return success for unknown subscriptions so Razorpay
   * does not repeatedly retry an event belonging to another
   * environment.
   */
  if (!updatedSubscription) {
    console.warn(
      "Webhook received for an unknown subscription:",
      providerSubscription.id,
    );

    return NextResponse.json({
      success: true,
      ignored: true,
    });
  }

  return NextResponse.json({
    success: true,
    event: webhook.event ?? "unknown",
    status: subscriptionStatus,
  });
}