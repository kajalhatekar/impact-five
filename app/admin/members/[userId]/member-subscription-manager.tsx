"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminSubscriptionRecord = {
  id: string;
  plan_id: string | null;
  status: string;
  payment_provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  razorpay_subscription_id: string | null;
};

type MemberSubscriptionManagerProps = {
  userId: string;
  initialSubscription: AdminSubscriptionRecord | null;
  planName: string | null;
};

type SubscriptionResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

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

function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export default function MemberSubscriptionManager({
  userId,
  initialSubscription,
  planName,
}: MemberSubscriptionManagerProps) {
  const router = useRouter();

  const [subscription, setSubscription] =
    useState(initialSubscription);

  const [loadingAction, setLoadingAction] = useState<
    "cancel" | "reactivate" | null
  >(null);

  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  if (!subscription) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
          Membership
        </p>

        <h2 className="mt-3 text-2xl font-bold text-slate-950">
          No subscription
        </h2>

        <p className="mt-3 leading-7 text-slate-600">
          This member has not activated a monthly or yearly
          membership.
        </p>
      </section>
    );
  }

  const isDemoSubscription =
    subscription.payment_provider === "demo" ||
    subscription.razorpay_subscription_id?.startsWith(
      "demo_",
    ) === true;

  const isActive = [
    "active",
    "trialing",
  ].includes(subscription.status);

  const canReactivate =
    isDemoSubscription &&
    (subscription.cancel_at_period_end || !isActive);

  async function manageSubscription(
    action: "cancel" | "reactivate",
  ) {
    if (action === "cancel") {
      const shouldCancel = window.confirm(
        `Schedule this member's subscription to end on ${formatDate(
          subscription?.current_period_end ?? null,
        )}?`,
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
        "/api/admin/members/subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            action,
          }),
        },
      );

      const result =
        (await response.json()) as SubscriptionResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ??
            "Unable to update the subscription.",
        );
      }

      setSubscription((currentSubscription) => {
        if (!currentSubscription) {
          return currentSubscription;
        }

        if (action === "reactivate") {
          return {
            ...currentSubscription,
            status: "active",
            cancel_at_period_end: false,
            payment_provider: "demo",
          };
        }

        return {
          ...currentSubscription,
          cancel_at_period_end: true,
        };
      });

      setMessage(
        result.message ??
          "Subscription updated successfully.",
      );

      router.refresh();
    } catch (error) {
      setIsError(true);

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the subscription.",
      );
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="grid lg:grid-cols-[1fr_0.8fr]">
        <div className="p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Membership
          </p>

          <h2 className="mt-3 text-3xl font-bold text-slate-950">
            {planName ?? "Impact Five membership"}
          </h2>

          <div className="mt-5 flex flex-wrap gap-3">
            <span
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase ${
                isActive
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {formatStatus(subscription.status)}
            </span>

            <span className="rounded-full bg-blue-100 px-4 py-2 text-xs font-bold uppercase text-blue-800">
              {subscription.payment_provider ??
                "Unknown provider"}
            </span>

            {subscription.cancel_at_period_end && (
              <span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-bold uppercase text-amber-800">
                Cancellation scheduled
              </span>
            )}
          </div>

          {subscription.cancel_at_period_end ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-900">
                This membership is scheduled to end.
              </p>

              <p className="mt-2 text-sm leading-6 text-amber-800">
                Access remains available until{" "}
                {formatDate(
                  subscription.current_period_end,
                )}
                .
              </p>
            </div>
          ) : isActive ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-900">
                This membership is active.
              </p>

              <p className="mt-2 text-sm leading-6 text-emerald-800">
                The next renewal/end date is{" "}
                {formatDate(
                  subscription.current_period_end,
                )}
                .
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">
                This membership is not active.
              </p>
            </div>
          )}

          {message && (
            <p
              role={isError ? "alert" : "status"}
              className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
                isError
                  ? "bg-red-50 text-red-700"
                  : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {message}
            </p>
          )}
        </div>

        <aside className="bg-emerald-950 p-6 text-white sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
            Subscription details
          </p>

          <dl className="mt-6 space-y-5">
            <div>
              <dt className="text-sm text-emerald-200">
                Period started
              </dt>

              <dd className="mt-1 font-semibold">
                {formatDate(
                  subscription.current_period_start,
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-emerald-200">
                Renewal/end date
              </dt>

              <dd className="mt-1 font-semibold">
                {formatDate(
                  subscription.current_period_end,
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-emerald-200">
                Provider
              </dt>

              <dd className="mt-1 font-semibold capitalize">
                {subscription.payment_provider ??
                  "Not available"}
              </dd>
            </div>
          </dl>

          <div className="mt-8">
            {canReactivate ? (
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  void manageSubscription("reactivate")
                }
                className="w-full rounded-full bg-white px-5 py-3 font-bold text-emerald-950 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAction === "reactivate"
                  ? "Reactivating..."
                  : "Reactivate membership"}
              </button>
            ) : isActive ? (
              <button
                type="button"
                disabled={loadingAction !== null}
                onClick={() =>
                  void manageSubscription("cancel")
                }
                className="w-full rounded-full border border-red-300 px-5 py-3 font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingAction === "cancel"
                  ? "Scheduling cancellation..."
                  : "Cancel at period end"}
              </button>
            ) : (
              <p className="rounded-2xl bg-white/10 p-4 text-sm leading-6 text-emerald-100">
                A real inactive subscription must be replaced
                through a new member checkout.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}