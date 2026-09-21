"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type CurrentSubscription = {
  subscription_id: string;
  plan_id: string;
  plan_code: string | null;
  plan_name: string | null;
  price_paise: number | null;
  currency: string | null;
  billing_interval: string | null;
  subscription_status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  razorpay_subscription_id: string | null;
};

type MembershipManagerProps = {
  subscription: CurrentSubscription;
};

type ManageSubscriptionResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

function formatPrice(
  pricePaise: number | null,
  currency: string | null,
) {
  if (pricePaise === null) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency ?? "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

export default function MembershipManager({
  subscription,
}: MembershipManagerProps) {
  const router = useRouter();

  const [loadingAction, setLoadingAction] = useState<
    "cancel" | "reactivate" | null
  >(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const isDemoSubscription =
    subscription.razorpay_subscription_id?.startsWith(
      "demo_",
    ) ?? false;

  const billingLabel =
    subscription.billing_interval === "year"
      ? "year"
      : "month";

  async function manageSubscription(
    action: "cancel" | "reactivate",
  ) {
    if (action === "cancel") {
      const shouldCancel = window.confirm(
        `Your membership will remain active until ${formatDate(
          subscription.current_period_end,
        )}. Do you want to schedule cancellation?`,
      );

      if (!shouldCancel) {
        return;
      }
    }

    setLoadingAction(action);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        "/api/subscriptions/manage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        },
      );

      const result =
        (await response.json()) as ManageSubscriptionResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ??
            "Unable to update your membership.",
        );
      }

      setMessage(
        result.message ??
          "Your membership was updated successfully.",
      );

      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your membership.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[1.2fr_0.8fr]">
        <div className="p-7 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
              {subscription.subscription_status}
            </span>

            {isDemoSubscription && (
              <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-800">
                Demo mode
              </span>
            )}

            {subscription.cancel_at_period_end && (
              <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                Cancellation scheduled
              </span>
            )}
          </div>

          <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
            Current plan
          </p>

          <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
            {subscription.plan_name ?? "Impact Five Membership"}
          </h2>

          <div className="mt-6 flex items-end gap-2">
            <span className="text-4xl font-bold text-slate-950">
              {formatPrice(
                subscription.price_paise,
                subscription.currency,
              )}
            </span>

            <span className="pb-1 text-slate-500">
              /{billingLabel}
            </span>
          </div>

          <p className="mt-5 max-w-xl leading-7 text-slate-600">
            Your membership includes score management, monthly
            draw participation and charity-directed giving.
          </p>

          {subscription.cancel_at_period_end ? (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-900">
                Your cancellation is scheduled.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Your membership remains active until{" "}
                {formatDate(subscription.current_period_end)}.
                You will not be charged again after that date.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-900">
                Your membership is active.
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Your next renewal is scheduled for{" "}
                {formatDate(subscription.current_period_end)}.
              </p>
            </div>
          )}
        </div>

        <aside className="bg-emerald-950 p-7 text-white sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
            Membership details
          </p>

          <dl className="mt-7 space-y-6">
            <div>
              <dt className="text-sm text-emerald-200">
                Plan
              </dt>

              <dd className="mt-1 font-semibold">
                {subscription.plan_name ??
                  "Impact Five Membership"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-emerald-200">
                Billing
              </dt>

              <dd className="mt-1 font-semibold capitalize">
                {billingLabel}ly
              </dd>
            </div>

            <div>
              <dt className="text-sm text-emerald-200">
                Current period started
              </dt>

              <dd className="mt-1 font-semibold">
                {formatDate(
                  subscription.current_period_start,
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-emerald-200">
                {subscription.cancel_at_period_end
                  ? "Access ends"
                  : "Next renewal"}
              </dt>

              <dd className="mt-1 font-semibold">
                {formatDate(subscription.current_period_end)}
              </dd>
            </div>
          </dl>

          <div className="mt-10">
            {subscription.cancel_at_period_end ? (
              isDemoSubscription ? (
                <button
                  type="button"
                  disabled={loadingAction !== null}
                  onClick={() =>
                    void manageSubscription("reactivate")
                  }
                  className="w-full rounded-full bg-white px-6 py-4 font-bold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === "reactivate"
                    ? "Reactivating..."
                    : "Keep my membership"}
                </button>
              ) : (
                <p className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-emerald-100">
                  Your Razorpay cancellation has been
                  scheduled. Your access remains available until
                  the period-end date.
                </p>
              )
            ) : (
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  void manageSubscription("cancel")
                }
                className="w-full rounded-full border border-red-300 px-6 py-4 font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAction === "cancel"
                  ? "Scheduling cancellation..."
                  : "Cancel at period end"}
              </button>
            )}
          </div>
        </aside>
      </div>

      {message && (
        <div
          role={isError ? "alert" : "status"}
          className={`border-t px-7 py-5 text-sm sm:px-10 ${
            isError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>
      )}
    </section>
  );
}