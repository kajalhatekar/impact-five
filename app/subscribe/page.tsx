import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import SubscriptionCheckout, {
  type SubscriptionPlan,
} from "./subscription-checkout";

export default async function SubscribePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc(
    "get_subscription_plans",
  );

  const plans = (data ?? []) as SubscriptionPlan[];

  const orderedPlans = [...plans].sort((firstPlan, secondPlan) => {
    if (firstPlan.code === "monthly") {
      return -1;
    }

    if (secondPlan.code === "monthly") {
      return 1;
    }

    return 0;
  });

  const userName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  return (
    <main className="min-h-screen bg-[#f4f1e9] px-5 py-10 sm:px-8 lg:py-16">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-12 max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-700">
            Impact Five membership
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Play with purpose.
            <span className="block font-serif italic text-emerald-700">
              Give with every plan.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Choose monthly flexibility or save with an annual
            membership. Every membership supports score tracking,
            monthly draw participation and your selected charitable
            cause.
          </p>
        </div>

        {error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">
            Unable to load subscription plans: {error.message}
          </div>
        ) : orderedPlans.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            No active subscription plans are currently available.
          </div>
        ) : (
          <div className="mt-12">
            <SubscriptionCheckout
              plans={orderedPlans}
              userEmail={user.email ?? ""}
              userName={userName}
            />
          </div>
        )}
      </section>
    </main>
  );
}