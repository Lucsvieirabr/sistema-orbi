import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  max?: number;
}

const EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

export function Magnetic({ children, className, strength = 0.28, max = 10 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reduced.matches) return;

    const icon = node.querySelector<HTMLElement>("[data-magnet-icon]");
    let frame = 0;

    const clamp = (value: number) => Math.max(-max, Math.min(max, value));

    const move = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = clamp(dx * strength);
        const y = clamp(dy * strength * 1.4);
        node.style.transition = `transform 240ms ${EASE}`;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        if (icon) {
          icon.style.transition = `transform 240ms ${EASE}`;
          icon.style.transform = `translate3d(${x * 0.45}px, ${y * 0.45}px, 0)`;
        }
      });
    };

    const leave = () => {
      cancelAnimationFrame(frame);
      node.style.transition = `transform 700ms ${EASE}`;
      node.style.transform = "translate3d(0, 0, 0)";
      if (icon) {
        icon.style.transition = `transform 700ms ${EASE}`;
        icon.style.transform = "translate3d(0, 0, 0)";
      }
    };

    node.addEventListener("pointermove", move);
    node.addEventListener("pointerleave", leave);

    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerleave", leave);
    };
  }, [strength, max]);

  return (
    <span ref={ref} className={cn("lp-magnet", className)}>
      {children}
    </span>
  );
}
