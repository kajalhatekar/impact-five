import type { ReactNode } from "react";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <main
      className={`min-h-screen bg-[#f4f1e9] py-10 text-slate-950 lg:py-16 ${className}`}
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        {children}
      </div>
    </main>
  );
}
