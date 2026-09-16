import { useMemo, type CSSProperties } from "react";

import { cn } from "@/lib/utils";

interface OrbitFieldProps {
  className?: string;
  stars?: number;
  seed?: number;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function StarField({ count = 48, seed = 7, className }: { count?: number; seed?: number; className?: string }) {
  const stars = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, (_, index) => ({
      x: random() * 100,
      y: random() * 100,
      r: 0.35 + random() * 0.9,
      o: 0.18 + random() * 0.55,
      twinkle: index % 6 === 0,
      duration: 3 + random() * 4,
      delay: random() * -6,
    }));
  }, [count, seed]);

  return (
    <svg className={cn("lp-stars", className)} aria-hidden focusable="false" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
      {stars.map((star, index) => (
        <circle
          key={index}
          className={cn("lp-star", star.twinkle && "lp-star--twinkle")}
          cx={star.x}
          cy={star.y}
          r={star.r * 0.18}
          opacity={star.o}
          style={
            star.twinkle
              ? ({ ["--lp-twinkle" as string]: `${star.duration}s`, animationDelay: `${star.delay}s` } as CSSProperties)
              : undefined
          }
        />
      ))}
    </svg>
  );
}

export function OrbitField({ className }: OrbitFieldProps) {
  return (
    <div className={cn("lp-orbits", className)} aria-hidden>
      <div className="lp-orbits__light" />
      <div className="lp-orbits__plane">
        <svg viewBox="0 0 800 800" focusable="false">
          <g className="lp-orbit" style={{ ["--lp-spin" as string]: "70s" } as CSSProperties}>
            <circle className="lp-orbit__ring" cx="400" cy="400" r="128" />
            <circle className="lp-sat__halo" cx="528" cy="400" r="11" />
            <circle className="lp-sat lp-sat--accent" cx="528" cy="400" r="4.5" />
          </g>
          <g className="lp-orbit lp-orbit--reverse" style={{ ["--lp-spin" as string]: "110s" } as CSSProperties}>
            <circle className="lp-orbit__ring lp-orbit__ring--dashed" cx="400" cy="400" r="212" />
            <circle className="lp-sat" cx="250" cy="250" r="3" />
            <circle className="lp-sat" cx="612" cy="400" r="2" />
          </g>
          <g className="lp-orbit" style={{ ["--lp-spin" as string]: "160s" } as CSSProperties}>
            <circle className="lp-orbit__ring" cx="400" cy="400" r="300" />
            <circle className="lp-sat__halo" cx="400" cy="100" r="9" />
            <circle className="lp-sat lp-sat--accent" cx="400" cy="100" r="3.5" />
            <circle className="lp-sat" cx="188" cy="612" r="2.5" />
          </g>
          <g className="lp-orbit lp-orbit--reverse" style={{ ["--lp-spin" as string]: "240s" } as CSSProperties}>
            <circle className="lp-orbit__ring lp-orbit__ring--faint" cx="400" cy="400" r="388" />
            <circle className="lp-sat" cx="788" cy="400" r="2" />
          </g>
          <circle className="lp-sat__halo" cx="400" cy="400" r="22" />
          <circle className="lp-sat lp-sat--accent" cx="400" cy="400" r="7" />
        </svg>
      </div>
    </div>
  );
}

export function OrbiMark({ src, className }: { src: string; className?: string }) {
  return (
    <span className={cn("lp-mark", className)} aria-hidden>
      <img src={src} alt="Logotipo do Orbi" width={500} height={500} decoding="async" />
    </span>
  );
}
