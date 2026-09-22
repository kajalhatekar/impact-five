"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_paise: number;
  currency: string;
  billing_interval: "month" | "year";
  razorpay_plan_id: string;
};

type SubscriptionCheckoutProps = {
  plans: SubscriptionPlan[];
  userEmail: string;
  userName: string;
};

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
  };
  notes?: {
    plan_code?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
};

type RazorpayInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    callback: (response: RazorpayFailureResponse) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function formatPrice(pricePaise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}

/**
 * Client checkout for starting a new membership.
 *
 * Uses Razorpay test subscriptions as the primary payment path and keeps the
 * clearly labelled demo subscription path separate for assessment environments
 * where recurring sandbox payment methods are unavailable.
 */
export default function SubscriptionCheckout({
  plans,
  userEmail,
  userName,
}: SubscriptionCheckoutProps) {
  const router = useRouter();

  const defaultPlanCode =
    plans.find((plan) => plan.code === "yearly")?.code ??
    plans[0]?.code ??
    "";

  const [scriptReady, setScriptReady] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [demoLoadingPlan, setDemoLoadingPlan] = useState<
    string | null
  >(null);
  const [selectedPlanCode, setSelectedPlanCode] =
    useState(defaultPlanCode);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const monthlyPlan = plans.find((plan) => plan.code === "monthly");
  const yearlyPlan = plans.find((plan) => plan.code === "yearly");

  const yearlySaving =
    monthlyPlan && yearlyPlan
      ? monthlyPlan.price_paise * 12 - yearlyPlan.price_paise
      : 0;

  const isBusy =
    loadingPlan !== null || demoLoadingPlan !== null;

  async function verifyPayment(response: RazorpaySuccessResponse) {
    const verificationResponse = await fetch(
      "/api/razorpay/verify-subscription",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySubscriptionId:
            response.razorpay_subscription_id,
          razorpaySignature: response.razorpay_signature,
        }),
      },
    );

    const verificationResult = (await verificationResponse.json()) as {
      success?: boolean;
      message?: string;
      error?: string;
    };

    if (!verificationResponse.ok || !verificationResult.success) {
      throw new Error(
        verificationResult.error ?? "Payment verification failed.",
      );
    }

    setIsError(false);
    setMessage("Subscription activated successfully.");

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubscribe(plan: SubscriptionPlan) {
    setSelectedPlanCode(plan.code);

    if (!scriptReady || !window.Razorpay) {
      setIsError(true);
      setMessage(
        "The payment checkout is still loading. Please try again.",
      );
      return;
    }

    setLoadingPlan(plan.code);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch(
        "/api/razorpay/create-subscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planCode: plan.code,
          }),
        },
      );

      const result = (await response.json()) as {
        keyId?: string;
        subscriptionId?: string;
        error?: string;
        plan?: {
          name: string;
        };
      };

      if (!response.ok || !result.keyId || !result.subscriptionId) {
        throw new Error(
          result.error ?? "Unable to start subscription checkout.",
        );
      }

      const checkout = new window.Razorpay({
        key: result.keyId,
        subscription_id: result.subscriptionId,
        name: "Impact Five",
        description: `${result.plan?.name ?? plan.name} membership`,
        prefill: {
          name: userName,
          email: userEmail,
        },
        notes: {
          plan_code: plan.code,
        },
        theme: {
          color: "#047857",
        },
        modal: {
          ondismiss: () => {
            setLoadingPlan(null);
            setIsError(false);
            setMessage("Checkout closed. No payment was taken.");
          },
        },
        handler: (paymentResponse) => {
          void (async () => {
            try {
              setMessage("Verifying your subscription...");
              await verifyPayment(paymentResponse);
            } catch (error) {
              setIsError(true);
              setMessage(
                error instanceof Error
                  ? error.message
                  : "Payment verification failed.",
              );
              setLoadingPlan(null);
            }
          })();
        },
      });

      checkout.on("payment.failed", (failureResponse) => {
        setIsError(true);
        setMessage(
          failureResponse.error.description ??
            "The Razorpay test payment was unsuccessful.",
        );
        setLoadingPlan(null);
      });

      checkout.open();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open subscription checkout.",
      );
      setLoadingPlan(null);
    }
  }

  async function handleSimulatedSubscription(
    plan: SubscriptionPlan,
  ) {
    setSelectedPlanCode(plan.code);
    setDemoLoadingPlan(plan.code);
    setLoadingPlan(null);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/subscriptions/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planCode: plan.code,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ??
            "Unable to activate the simulated subscription.",
        );
      }

      setMessage(
        result.message ??
          "Demo subscription activated. No real payment was processed.",
      );

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to activate the simulated subscription.",
      );
      setDemoLoadingPlan(null);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setIsError(true);
          setMessage(
            "Razorpay Checkout could not load. You may use the clearly labelled demo subscription below.",
          );
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {plans.map((plan) => {
          const isYearly = plan.code === "yearly";
          const isSelected = selectedPlanCode === plan.code;
          const isRazorpayLoading = loadingPlan === plan.code;
          const isDemoLoading = demoLoadingPlan === plan.code;

          return (
            <article
              key={plan.id}
              onClick={() => setSelectedPlanCode(plan.code)}
              className={`relative flex cursor-pointer flex-col rounded-[2rem] border bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-9 ${
                isSelected
                  ? "border-emerald-700 ring-2 ring-emerald-700"
                  : "border-slate-200"
              }`}
            >
              {isYearly && (
                <span className="absolute right-6 top-0 -translate-y-1/2 rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white">
                  Best value
                </span>
              )}

              {isSelected && (
                <span className="absolute left-6 top-0 -translate-y-1/2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Selected
                </span>
              )}

              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">
                {plan.billing_interval === "year"
                  ? "Annual membership"
                  : "Monthly membership"}
              </p>

              <h2 className="mt-4 text-3xl font-bold text-slate-950">
                {plan.name}
              </h2>

              <p className="mt-3 min-h-14 leading-7 text-slate-600">
                {plan.description ??
                  "Score tracking, monthly prize draws and charity-directed giving."}
              </p>

              <div className="mt-7 flex items-end gap-2">
                <span className="text-5xl font-bold tracking-tight text-slate-950">
                  {formatPrice(plan.price_paise, plan.currency)}
                </span>

                <span className="pb-1 text-slate-500">
                  /{plan.billing_interval}
                </span>
              </div>

              {isYearly && yearlySaving > 0 ? (
                <p className="mt-3 font-semibold text-emerald-700">
                  Save {formatPrice(yearlySaving, plan.currency)}{" "}
                  compared with monthly billing.
                </p>
              ) : (
                <p className="mt-3 text-slate-500">
                  Flexible monthly access.
                </p>
              )}

              <ul className="mt-8 space-y-4 text-slate-700">
                <li className="flex gap-3">
                  <span className="font-bold text-emerald-700">
                    ✓
                  </span>
                  Record and manage your latest five scores
                </li>

                <li className="flex gap-3">
                  <span className="font-bold text-emerald-700">
                    ✓
                  </span>
                  Participate in eligible monthly draws
                </li>

                <li className="flex gap-3">
                  <span className="font-bold text-emerald-700">
                    ✓
                  </span>
                  Direct at least 10% towards your chosen charity
                </li>

                <li className="flex gap-3">
                  <span className="font-bold text-emerald-700">
                    ✓
                  </span>
                  Track participation, impact and winnings
                </li>
              </ul>

              <div className="mt-auto space-y-3 pt-9">
                <button
                  type="button"
                  disabled={!scriptReady || isBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleSubscribe(plan);
                  }}
                  className={`w-full rounded-full px-6 py-4 text-base font-bold transition focus:outline-none focus:ring-4 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? "bg-emerald-700 text-white hover:bg-emerald-800"
                      : "border border-emerald-700 bg-white text-emerald-800 hover:bg-emerald-50"
                  }`}
                >
                  {isRazorpayLoading
                    ? "Opening Razorpay..."
                    : scriptReady
                      ? "Pay with Razorpay — Test Mode"
                      : "Preparing Razorpay..."}
                </button>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleSimulatedSubscription(plan);
                  }}
                  className="w-full rounded-full border border-dashed border-slate-400 bg-slate-50 px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDemoLoading
                    ? "Activating demo subscription..."
                    : "Simulate subscription — Demo only"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {message && (
        <div
          role={isError ? "alert" : "status"}
          className={`mt-7 rounded-2xl border px-5 py-4 ${
            isError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
        <p>
          <strong>Test environment:</strong> Razorpay uses test
          credentials and processes no real money.
        </p>

        <p className="mt-2">
          The simulated option is provided only for assessment and
          demonstration when Razorpay&apos;s recurring sandbox payment
          methods are unavailable. It does not process a payment.
        </p>
      </div>
    </>
  );
}
