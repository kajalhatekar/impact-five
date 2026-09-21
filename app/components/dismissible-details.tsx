"use client";

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";

type DismissibleDetailsProps = ComponentPropsWithoutRef<"details">;

export default function DismissibleDetails({
  children,
  ...props
}: DismissibleDetailsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const details = detailsRef.current;

      if (
        !details?.open ||
        !(event.target instanceof Node) ||
        details.contains(event.target)
      ) {
        return;
      }

      details.removeAttribute("open");
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <details ref={detailsRef} {...props}>
      {children}
    </details>
  );
}
