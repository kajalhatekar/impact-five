import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");

  if (error || !isAdmin) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[#f4f1e9] px-5 py-10 text-slate-950 sm:px-8 lg:py-16">
      <section className="mx-auto max-w-6xl">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-emerald-700">
          Administrator
        </p>

        <h1 className="mt-4 text-4xl font-bold sm:text-6xl">Admin overview</h1>

        <p className="mt-5 text-lg text-slate-600">
          Manage monthly draws and review prize winners.
        </p>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <Link
            href="/admin/draws"
            className="rounded-3xl bg-emerald-800 p-10 text-white transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">
              Draws
            </p>

            <h2 className="mt-3 text-3xl font-bold">Manage draws</h2>

            <p className="mt-3 text-emerald-50">
              Simulate, review and publish monthly draws.
            </p>
          </Link>

          <Link
            href="/admin/winners"
            className="rounded-3xl bg-slate-950 p-10 text-white transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-300">
              Winners
            </p>

            <h2 className="mt-3 text-3xl font-bold">Review winners</h2>

            <p className="mt-3 text-slate-200">
              Review submitted proof and manage payouts.
            </p>
          </Link>

          <Link
            href="/admin/charities"
            className="rounded-3xl bg-white p-10 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">
              Charities
            </p>

            <h2 className="mt-3 text-3xl font-bold">Contribution report</h2>

            <p className="mt-3 text-slate-600">
              Review selected charities and estimated recurring allocations.
            </p>
          </Link>

          <Link
            href="/admin/members"
            className="rounded-3xl bg-white p-10 text-slate-950 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-700">
              Members
            </p>

            <h2 className="mt-3 text-3xl font-bold">Member report</h2>

            <p className="mt-3 text-slate-600">
              Review registered users, subscription plans, payment providers and
              renewal dates.
            </p>
          </Link>
        </div>
      </section>
    </main>
  );
}
