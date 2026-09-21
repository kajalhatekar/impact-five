"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavigationLinksProps = {
  isSignedIn: boolean;
  isAdmin: boolean;
};

type NavigationItem = {
  href: string;
  label: string;
};

const authenticatedItems: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/dashboard/scores",
    label: "Scores",
  },
  {
    href: "/draws",
    label: "Draws",
  },
  {
    href: "/charities",
    label: "Charities",
  },
  {
    href: "/subscribe",
    label: "Membership",
  },
];

const adminItems: NavigationItem[] = [
  ...authenticatedItems,
  {
    href: "/admin",
    label: "Admin",
  },
];

const publicItems: NavigationItem[] = [
  {
    href: "/charities",
    label: "Charities",
  },
  {
    href: "/login",
    label: "Sign in",
  },
  {
    href: "/signup",
    label: "Get started",
  },
];

export default function NavigationLinks({
  isSignedIn,
  isAdmin,
}: NavigationLinksProps) {
  const pathname = usePathname();

  const navigationItems = isSignedIn
    ? isAdmin
      ? adminItems
      : authenticatedItems
    : publicItems;

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    if (href === "/admin") {
      return pathname.startsWith("/admin");
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {navigationItems.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-slate-700 hover:bg-white hover:text-emerald-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
