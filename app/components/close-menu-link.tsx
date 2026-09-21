"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type CloseMenuLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export default function CloseMenuLink({
  href,
  className,
  children,
}: CloseMenuLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => {
        event.currentTarget.closest("details")?.removeAttribute("open");
      }}
    >
      {children}
    </Link>
  );
}
