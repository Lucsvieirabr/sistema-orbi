import { FormEvent, useEffect, useRef, useState } from "react";

import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { formatMoney } from "@/components/planning/planning-utils";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PROJECT_KINDS, type ProjectInput, type ProjectKind } from "@/hooks/use-projects";
import { getCurrentDateString } from "@/lib/utils";

import { addDaysKey, kindIcon } from "./project-meta";

export type ProjectEditorState =
  | { mode: "create" }
  | { mode: "edit"; projectId: string; input: ProjectInput; fundedFromGoal: number };

const DEFAULT_COLOR = "#3b82f6";

export function ProjectEditor({
  state,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: ProjectEditorState | null;
  onClose: () => void;
  onCreate: (input: ProjectInput) => Promise<string>;
  onUpdate: (input: ProjectInput) => Promise<void>;
}) {
  const today = getCurrentDateString();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<ProjectKind>("event");
  const [budget, setBudget] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysKey(today, 90));
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [errors, setErrors] = useState<{ name?: string; budget?: string; dates?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);

  const editing = state?.mode === "edit" ? state : null;
  const floor = editing?.fundedFromGoal ?? 0;

  useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.mode === "edit") {
      setName(state.input.name);
      setDescription(state.input.description ?? "");
      setKind(state.input.kind);
      setBudget(state.input.budget);
      setStartDate(state.input.startDate);
      setEndDate(state.input.endDate);
      setColor(state.input.color);
    } else {
      setName("");
      setDescription("");
      setKind("event");
      setBudget(null);
      setStartDate(today);
      setEndDate(addDaysKey(today, 90));
      setColor(DEFAULT_COLOR);
    }
  }, [state, today]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Dê um nome ao projeto.";
    if (budget === null || budget < 0) next.budget = "Informe o orçamento total, mesmo que seja uma estimativa.";
    else if (budget < floor) next.budget = `O orçamento não pode ficar abaixo dos ${formatMoney(floor)} que vieram da meta.`;
    if (!startDate || !endDate || endDate < startDate) next.dates = "A data final precisa ser igual ou depois do início.";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.budget) return budgetRef.current?.focus();
    if (next.dates) return document.getElementById("project-end")?.focus();

    const input: ProjectInput = {
      name: name.trim(),
      description: description.trim() || null,
      kind,
      icon: editing && editing.input.kind === kind ? editing.input.icon : kindIcon(kind),
      color,
      budget: budget ?? 0,
      startDate,
      endDate,
    };

    setSaving(true);
    try {
      if (editing) {
        await onUpdate(input);
        notifyPlanningSuccess("Projeto atualizado");
      } else {
        await onCreate(input);
        notifyPlanningSuccess("Projeto criado", "Vincule os lançamentos no extrato ou direto na tela do projeto.");
      }
      onClose();
    } catch (err) {
      notifyPlanningError(editing ? "Não foi possível salvar o projeto" : "Não foi possível criar o projeto", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar projeto" : "Novo projeto"}</DialogTitle>
            <DialogDescription>
              Um casamento, uma reforma, o enxoval do filhote. Tudo que tem começo, fim e um orçamento só dele.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="project-name">Nome</Label>
              <Input
                id="project-name"
                ref={nameRef}
                value={name}
                maxLength={80}
                autoComplete="off"
                placeholder="Casamento 2027…"
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "project-name-error" : undefined}
              />
              {errors.name && (
                <p id="project-name-error" className="text-xs text-destructive" role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none text-foreground">Tipo</legend>
              <ToggleGroup
                type="single"
                value={kind}
                onValueChange={(value) => value && setKind(value as ProjectKind)}
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

            <div className="space-y-2">
              <Label htmlFor="project-budget">Orçamento total</Label>
              <NumericInput
                id="project-budget"
                ref={budgetRef}
                currency
                inputMode="decimal"
                autoComplete="off"
                value={budget}
                onChange={(value) => {
                  setBudget(value);
                  setErrors((prev) => ({ ...prev, budget: undefined }));
                }}
                placeholder="R$ 0,00"
                aria-invalid={Boolean(errors.budget)}
                aria-describedby={errors.budget ? "project-budget-error" : floor > 0 ? "project-budget-hint" : undefined}
              />
              {errors.budget ? (
                <p id="project-budget-error" className="text-xs text-destructive" role="alert">
                  {errors.budget}
                </p>
              ) : (
                floor > 0 && (
                  <p id="project-budget-hint" className="text-xs text-muted-foreground">
                    {formatMoney(floor)} vieram da meta executada.
                  </p>
                )
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="project-start">Início</Label>
                <Input
                  id="project-start"
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={startDate}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setErrors((prev) => ({ ...prev, dates: undefined }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-end">Fim</Label>
                <Input
                  id="project-end"
                  type="date"
                  min={startDate || "2000-01-01"}
                  max="2100-12-31"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setErrors((prev) => ({ ...prev, dates: undefined }));
                  }}
                  aria-invalid={Boolean(errors.dates)}
                  aria-describedby="project-dates-hint"
                />
              </div>
            </div>
            {errors.dates ? (
              <p id="project-dates-hint" className="-mt-3 text-xs text-destructive" role="alert">
                {errors.dates}
              </p>
            ) : (
              <p id="project-dates-hint" className="-mt-3 text-xs text-muted-foreground">
                No dia seguinte ao fim, o projeto é arquivado e o relatório final fica pronto.
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="project-description">
                Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="project-description"
                value={description}
                maxLength={280}
                autoComplete="off"
                placeholder="Cerimônia e festa para 120 pessoas"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="h-4 w-4 text-primary-foreground" />}
              {editing ? "Salvar projeto" : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
