import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import CloseMenuLink from "./close-menu-link";
import DismissibleDetails from "./dismissible-details";
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

  let isAdmin = false;
  let profileName = "";

  if (user) {
    const [adminResult, profileResult] = await Promise.all([
      supabase.rpc("is_admin"),

      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    isAdmin = adminResult.data === true;

    profileName =
      typeof profileResult.data?.full_name === "string"
        ? profileResult.data.full_name.trim()
        : "";
  }

  const metadataName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  const emailName = user?.email?.split("@")[0] ?? "User";
  const displayName = profileName || metadataName || emailName;
  const initials = getInitials(displayName) || "U";

  async function signOut() {
    "use server";

    const supabase = await createClient();

    await supabase.auth.signOut();

    redirect("/login");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-[#f4f1e9]/95 backdrop-blur">
      <div className="mx-auto flex h-[98px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href={user ? "/dashboard" : "/"}
          aria-label="Impact Five home"
          className="group flex shrink-0 items-center gap-3"
        >
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-emerald-800 text-2xl font-black text-white shadow-sm ring-1 ring-emerald-950/10 transition group-hover:bg-emerald-700 group-hover:shadow-md">
            5
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-[#f4f1e9] bg-amber-400"
            />
          </span>

          <span className="flex flex-col">
            <span className="text-base font-black uppercase tracking-[0.16em] text-emerald-950 sm:text-lg sm:tracking-[0.18em]">
              Impact <span className="text-emerald-700">Five</span>
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:block">
              Play. Give. Change.
            </span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-3 lg:flex">
          <nav aria-label="Main navigation" className="flex items-center gap-2">
            <NavigationLinks
              isSignedIn={Boolean(user)}
              isAdmin={isAdmin}
              variant="desktop"
            />
          </nav>

          {user && (
            <DismissibleDetails className="group relative">
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
                  <CloseMenuLink
                    href="/account"
                    className="block rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    My account
                  </CloseMenuLink>

                  <form
                    action={signOut}
                    className="mt-1 border-t border-slate-100 pt-1"
                  >
                    <button
                      type="submit"
                      className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </div>
            </DismissibleDetails>
          )}
        </div>

        {/* Mobile hamburger menu */}
        <DismissibleDetails className="group relative lg:hidden">
          <summary
            aria-label="Open navigation menu"
            className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-slate-300 bg-white text-emerald-800 shadow-sm transition hover:border-emerald-600 [&::-webkit-details-marker]:hidden"
          >
            <span className="flex flex-col gap-1.5">
              <span className="h-0.5 w-5 rounded-full bg-current transition group-open:translate-y-2 group-open:rotate-45" />
              <span className="h-0.5 w-5 rounded-full bg-current transition group-open:opacity-0" />
              <span className="h-0.5 w-5 rounded-full bg-current transition group-open:-translate-y-2 group-open:-rotate-45" />
            </span>
          </summary>

          <div className="absolute right-0 mt-3 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {user && (
              <div className="border-t border-slate-100 p-3">
                <CloseMenuLink
                  href="/account"
                  className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                    {initials}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 group-hover:text-emerald-900">
                      My account
                    </span>
                    <span className="block text-xs text-slate-500">
                      Profile and settings
                    </span>
                  </span>

                  <span
                    aria-hidden="true"
                    className="text-xl text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-700"
                  >
                    &rarr;
                  </span>
                </CloseMenuLink>
              </div>
            )}

            <nav
              aria-label="Mobile navigation"
              className="flex flex-col gap-1 p-3"
            >
              <NavigationLinks
                isSignedIn={Boolean(user)}
                isAdmin={isAdmin}
                variant="mobile"
              />
            </nav>

            {user && (
              <div className="border-t border-slate-100 p-3">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </DismissibleDetails>
      </div>
    </header>
  );
}
