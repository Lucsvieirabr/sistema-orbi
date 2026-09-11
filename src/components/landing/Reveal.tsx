import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type RevealVariant = "up" | "fade" | "lines" | "track";

interface RevealProps {
  as?: keyof JSX.IntrinsicElements;
  children?: ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
  immediate?: boolean;
  style?: CSSProperties;
  id?: string;
  onReveal?: () => void;
  [key: `aria-${string}`]: string | boolean | undefined;
}

type RevealState = "idle" | "armed" | "in";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Reveal({
  as = "div",
  children,
  className,
  delay = 0,
  variant = "up",
  immediate = false,
  style,
  onReveal,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<RevealState>("idle");
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;

  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const finish = () => {
      setState("in");
      revealRef.current?.();
    };

    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      revealRef.current?.();
      return;
    }

    const rect = node.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;

    if (alreadyVisible && !immediate) {
      revealRef.current?.();
      return;
    }

    setState("armed");

    if (immediate) {
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(finish);
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          finish();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  return createElement(
    as,
    {
      ref,
      className,
      "data-reveal": state === "idle" ? undefined : state,
      "data-reveal-variant": variant,
      style: delay && state !== "idle" ? { ...style, transitionDelay: `${delay}ms` } : style,
      ...rest,
    },
    children,
  );
}
