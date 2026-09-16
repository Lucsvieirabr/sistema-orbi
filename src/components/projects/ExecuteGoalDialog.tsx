import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";

import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { formatMoney } from "@/components/planning/planning-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconRenderer } from "@/components/ui/icon-renderer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Spinner } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFeature } from "@/hooks/use-feature";
import type { GoalProgress } from "@/hooks/use-goals";
import { PROJECT_KINDS, useProjects, type ProjectKind } from "@/hooks/use-projects";
import { getCurrentDateString } from "@/lib/utils";
import "@/lib/features/orbi-features";

import { addDaysKey } from "./project-meta";

export function ExecuteGoalDialog({ goal, onClose }: { goal: GoalProgress | null; onClose: () => void }) {
  const navigate = useNavigate();
  const today = getCurrentDateString();
  const { executeGoal } = useProjects({ enabled: false });
  const { hasFeature: canSplit } = useFeature("contratos_rateio");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectKind>("event");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysKey(today, 90));
  const [extra, setExtra] = useState<number | null>(null);
  const [withLedger, setWithLedger] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!goal) return;
    setName(goal.name);
    setKind(goal.icon === "plane" ? "trip" : goal.icon === "home" ? "home" : goal.icon === "baby" ? "family" : "event");
    setStartDate(today);
    setEndDate(goal.deadline && goal.deadline >= today ? goal.deadline : addDaysKey(today, 90));
    setExtra(null);
    setWithLedger(goal.icon === "plane");
    setError(null);
  }, [goal, today]);

  const total = (goal?.saved_value ?? 0) + (extra ?? 0);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!goal) return;
    if (!name.trim()) return setError("Dê um nome ao projeto.");
    if (!startDate || !endDate || endDate < startDate) return setError("A data final precisa ser igual ou depois do início.");
    setError(null);
    setSaving(true);
    try {
      const projectId = await executeGoal({
        goalId: goal.id,
        name: name.trim(),
        startDate,
        endDate,
        kind,
        extraBudget: extra ?? 0,
        withLedger: canSplit && withLedger,
      });
      notifyPlanningSuccess("Meta executada", `${formatMoney(total)} viraram o orçamento de “${name.trim()}”.`);
      onClose();
      navigate(`/sistema/projects?projeto=${projectId}`);
    } catch (err) {
      notifyPlanningError("Não foi possível executar a meta", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={goal !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Executar meta</DialogTitle>
            <DialogDescription>
              O evento começou. O valor guardado vira o orçamento de um projeto e os aportes da meta ficam congelados.
            </DialogDescription>
          </DialogHeader>

          {goal && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-sunken px-4 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-card">
                <IconRenderer iconName={goal.icon} className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{goal.name}</p>
                <p className="text-xs tabular text-muted-foreground">
                  {formatMoney(goal.saved_value)} guardados de {formatMoney(goal.target_value)}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="execute-name">Nome do projeto</Label>
              <Input
                id="execute-name"
                value={name}
                maxLength={80}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none text-foreground">Tipo</legend>
              <ToggleGroup
                type="single"
                value={kind}
                onValueChange={(value) => {
                  if (!value) return;
                  setKind(value as ProjectKind);
                  if (value === "trip") setWithLedger(true);
                }}
                className="grid grid-cols-3 gap-1.5 rounded-xl border border-border-subtle bg-surface-sunken p-1.5"
              >
                {PROJECT_KINDS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className="h-11 w-full justify-start gap-2 rounded-lg border border-transparent px-2.5 text-xs data-[state=on]:border-border data-[state=on]:bg-card md:h-9"
                  >
                    <IconRenderer iconName={option.icon} className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{option.label}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </fieldset>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="execute-start">Início</Label>
                <Input id="execute-start" type="date" min="2000-01-01" max="2100-12-31" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="execute-end">Fim</Label>
                <Input id="execute-end" type="date" min={startDate} max="2100-12-31" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="execute-extra">
                Somar ao orçamento <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <NumericInput
                id="execute-extra"
                currency
                inputMode="decimal"
                autoComplete="off"
                value={extra}
                onChange={setExtra}
                placeholder="R$ 0,00"
                aria-describedby="execute-extra-hint"
              />
              <p id="execute-extra-hint" className="text-xs text-muted-foreground">
                Para quando o evento vai custar mais do que a meta juntou.
              </p>
            </div>

            {canSplit && (
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border-subtle px-4 py-3">
                <div className="min-w-0">
                  <Label htmlFor="execute-ledger" className="text-sm">
                    Acerto entre pessoas
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Cria o evento de acertos junto. Cada gasto do projeto entra no rateio e, no fim, sai o PIX de cobrança.
                  </p>
                </div>
                <Switch id="execute-ledger" checked={withLedger} onCheckedChange={setWithLedger} />
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-6 items-center gap-3 sm:justify-between">
            <p className="text-sm tabular text-muted-foreground" aria-live="polite">
              Orçamento <span className="font-semibold text-foreground">{formatMoney(total)}</span>
            </p>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner className="h-4 w-4 text-primary-foreground" /> : <Rocket aria-hidden />}
                Executar meta
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
