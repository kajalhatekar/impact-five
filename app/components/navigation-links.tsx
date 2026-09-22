"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

type NavigationLinksProps = {
  isSignedIn: boolean;
  isAdmin: boolean;
  variant: "desktop" | "mobile";
};

type IndicatorPosition = {
  height: number;
  width: number;
  x: number;
  y: number;
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
    href: "/donate",
    label: "Donate",
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
    href: "/donate",
    label: "Donate",
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
  variant,
}: NavigationLinksProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorPosition, setIndicatorPosition] =
    useState<IndicatorPosition | null>(null);

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

  useLayoutEffect(() => {
    const container = containerRef.current;
    const activeLink = container?.querySelector<HTMLElement>(
      '[aria-current="page"]',
    );

    if (!container || !activeLink) {
      setIndicatorPosition(null);
      return;
    }

    const measuredLink = activeLink;

    function updateIndicator() {
      setIndicatorPosition({
        height: measuredLink.offsetHeight,
        width: measuredLink.offsetWidth,
        x: measuredLink.offsetLeft,
        y: measuredLink.offsetTop,
      });
    }

    updateIndicator();

    const resizeObserver = new ResizeObserver(updateIndicator);
    resizeObserver.observe(container);
    resizeObserver.observe(measuredLink);

    return () => resizeObserver.disconnect();
  }, [isAdmin, isSignedIn, pathname, variant]);

  return (
    <div
      ref={containerRef}
      className={
        variant === "desktop"
          ? "relative flex items-center gap-2"
          : "relative flex w-full flex-col gap-1"
      }
    >
      {indicatorPosition && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-full bg-emerald-700 shadow-sm transition-[transform,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{
            height: indicatorPosition.height,
            width: indicatorPosition.width,
            transform: `translate3d(${indicatorPosition.x}px, ${indicatorPosition.y}px, 0)`,
          }}
        />
      )}

      {navigationItems.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
            }}
            className={`relative z-10 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
              active
                ? "text-white"
                : "text-slate-700 hover:bg-white hover:text-emerald-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
