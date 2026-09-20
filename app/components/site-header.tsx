import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import NavigationLinks from "./navigation-links";

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export default async function SiteHeader() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  const emailName = user?.email?.split("@")[0] ?? "User";
  const displayName = metadataName || emailName;
  const initials = getInitials(displayName) || "U";

  async function signOut() {
    "use server";

    const supabase = await createClient();

    await supabase.auth.signOut();

    redirect("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-[#f4f1e9]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link
          href={user ? "/dashboard" : "/"}
          className="shrink-0 text-lg font-black uppercase tracking-[0.18em] text-emerald-800"
        >
          Impact Five
        </Link>

        <div className="flex items-center gap-3">
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-2 overflow-x-auto"
          >
            <NavigationLinks isSignedIn={Boolean(user)} />
          </nav>

          {user && (
            <details className="group relative">
              <summary
                aria-label="Open account menu"
                className="flex cursor-pointer list-none items-center gap-3 rounded-full border border-slate-300 bg-white py-1.5 pl-1.5 pr-3 transition hover:border-emerald-600 hover:shadow-sm [&::-webkit-details-marker]:hidden"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                  {initials}
                </span>

                <span className="hidden max-w-40 truncate text-sm font-semibold text-slate-700 xl:block">
                  {displayName}
                </span>

                <span
                  aria-hidden="true"
                  className="text-xs text-slate-500 transition group-open:rotate-180"
                >
                  ▼
                </span>
              </summary>

              <div className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-700 font-bold text-white">
                      {initials}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-950">
                        {displayName}
                      </p>

                      <p className="truncate text-sm text-slate-500">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  {/* <Link
                    href="/dashboard"
                    className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-800"
                  >
                    View dashboard
                  </Link>

                  <Link
                    href="/subscribe"
                    className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-emerald-800"
                  >
                    Manage membership
                  </Link> */}

                  <form action={signOut}>
                    <button
                      type="submit"
                      className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </details>
          )}
        </div>
      </div>
    </header>
  );
}
