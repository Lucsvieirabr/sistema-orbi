import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { FeatureLimit } from "@/lib/features/feature-registry";
import { cn } from "@/lib/utils";

/**
 * Um limite de plano: rótulo + contexto à esquerda, controle à direita.
 * `-1` é ilimitado (contrato dos triggers de cota) — vira um switch explícito
 * em vez de um número mágico digitado à mão.
 */
export function LimitField({
  limit,
  value,
  onChange,
}: {
  limit: FeatureLimit;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const canBeUnlimited = limit.maxValue === undefined || limit.maxValue === -1;
  const hardMax = canBeUnlimited ? Number.MAX_SAFE_INTEGER : limit.maxValue!;
  const current = value ?? limit.defaultValue;
  const unlimited = current === -1;
  const clamp = (n: number) => Math.min(Math.max(0, Math.round(n)), hardMax);
  const step = current >= 100 ? 10 : 1;
  const id = `limit-${limit.key}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors duration-200 ease-swift hover:border-ring/45 sm:flex-row sm:items-center sm:justify-between",
        unlimited && "bg-success-soft/40",
      )}
    >
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-foreground">{limit.label}</label>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{limit.description}</p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className={cn("flex items-center gap-1", unlimited && "opacity-50")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Diminuir ${limit.label}`}
            disabled={unlimited || current <= 0}
            onClick={() => onChange(clamp(current - step))}
            className="press text-muted-foreground"
          >
            <Minus aria-hidden />
          </Button>
          <Input
            id={id}
            inputMode="numeric"
            aria-describedby={`${id}-unit`}
            disabled={unlimited}
            value={unlimited ? "∞" : String(current)}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              onChange(digits === "" ? 0 : clamp(Number(digits)));
            }}
            className="h-11 w-20 px-1 text-center tabular md:h-9"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Aumentar ${limit.label}`}
            disabled={unlimited || current >= hardMax}
            onClick={() => onChange(clamp(current + step))}
            className="press text-muted-foreground"
          >
            <Plus aria-hidden />
          </Button>
        </div>
        <span id={`${id}-unit`} className="w-24 text-xs text-muted-foreground">{limit.unit}</span>

        {canBeUnlimited && (
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Switch
              checked={unlimited}
              onCheckedChange={(on) => onChange(on ? -1 : Math.max(limit.defaultValue, 0))}
              aria-label={`${limit.label} ilimitado`}
            />
            Ilimitado
          </label>
        )}
      </div>
    </div>
  );
}
