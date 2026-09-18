import { CircleCheck, Link2Off, Mail } from "lucide-react";

import { cn } from "@/lib/utils";

export type BeaconTone = "waiting" | "success" | "invalid";

const TONE: Record<BeaconTone, { disc: string; icon: string; ring: string }> = {
  waiting: { disc: "bg-primary/10 text-primary", icon: "text-primary", ring: "border-primary/30" },
  success: { disc: "bg-success-soft text-success", icon: "text-success", ring: "border-success/30" },
  invalid: { disc: "bg-warning-soft text-warning", icon: "text-warning", ring: "border-warning/30" },
};

const ICON = {
  waiting: Mail,
  success: CircleCheck,
  invalid: Link2Off,
} as const;

/**
 * Sinal de estado do fluxo de confirmação.
 *
 * Três camadas de movimento, todas sob `motion-safe` e todas em `transform` /
 * `opacity` (compositor, zero reflow):
 *
 *   1. halo — um anel que expande e some, a cada 2,8 s: "algo está a caminho";
 *   2. órbita — um arco de 1px girando devagar, o gesto da marca;
 *   3. flutuação — o ícone sobe 3px e volta, quase subliminar.
 *
 * No estado final (`success`) o movimento contínuo para: a espera acabou, e
 * animação que não comunica mais nada vira ruído.
 */
export function EnvelopeBeacon({ tone = "waiting", className }: { tone?: BeaconTone; className?: string }) {
  const palette = TONE[tone];
  const Icon = ICON[tone];
  const isWaiting = tone === "waiting";

  return (
    <div className={cn("relative grid h-20 w-20 place-items-center", className)} aria-hidden>
      {isWaiting && (
        <span className={cn("absolute inset-0 rounded-full border", palette.ring, "motion-safe:animate-halo")} />
      )}

      {isWaiting && (
        <span
          className={cn(
            "absolute inset-1 rounded-full border border-dashed border-transparent",
            "border-t-primary/45 border-r-primary/25",
            "motion-safe:animate-orbit-ring",
          )}
        />
      )}

      <span className={cn("grid h-14 w-14 place-items-center rounded-full", palette.disc)}>
        <Icon
          className={cn("h-6 w-6", palette.icon, isWaiting && "motion-safe:animate-hint-float")}
          strokeWidth={1.75}
        />
      </span>
    </div>
  );
}
