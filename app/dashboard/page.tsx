import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#f4f1e9] p-8">
      <section className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          Impact Five
        </p>

        <h1 className="mt-3 text-4xl font-bold text-slate-950">
          Welcome to your dashboard
        </h1>

        <p className="mt-3 text-slate-600">Signed in as {user.email}</p>
      </section>
    </main>
  );
}
