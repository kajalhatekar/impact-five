import Link from "next/link";
import { redirect } from "next/navigation";

import { PageContainer } from "@/app/components/page-container";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import DrawManager, {
  type DrawRecord,
} from "./draw-manager";

export default async function AdminDrawsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  /*
   * Check the currently signed-in user's role.
   * The public.is_admin() function uses auth.uid()
   * and securely checks the profiles table.
   */
  const {
    data: isAdmin,
    error: adminCheckError,
  } = await supabase.rpc("is_admin");

  if (adminCheckError) {
    console.error(
      "Unable to verify administrator:",
      adminCheckError,
    );

    redirect("/dashboard");
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  /*
   * The administrator has been verified.
   * Use the secure server client to load draw records.
   */
  const admin = createAdminClient();

  const { data: drawData, error: drawError } =
    await admin
      .from("draws")
      .select(
        `
          id,
          draw_month,
          status,
          draw_mode,
          winning_numbers,
          active_subscriber_count,
          pool_total_paise,
          five_match_pool_paise,
          four_match_pool_paise,
          three_match_pool_paise,
          jackpot_brought_forward_paise,
          jackpot_carried_forward_paise,
          simulated_at,
          published_at,
          created_at
        `,
      )
      .order("draw_month", {
        ascending: false,
      });

  const draws =
    (drawData as DrawRecord[] | null) ?? [];

  return (
    <PageContainer>
        <Link
          href="/dashboard"
          className="font-semibold text-emerald-700 transition hover:text-emerald-900"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-10 rounded-[2rem] bg-slate-950 px-7 py-10 text-white sm:px-10 lg:px-14">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-300">
            Administrator
          </p>

          <h1 className="mt-4 text-4xl font-bold sm:text-6xl">
            Draw management
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Simulate monthly results, review prize allocations
            and publish the draw when everything is ready.
          </p>
        </div>

        {drawError && (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800"
          >
            Unable to load draw history: {drawError.message}
          </div>
        )}

        <div className="mt-8">
          <DrawManager initialDraws={draws} />
        </div>
    </PageContainer>
  );
}
