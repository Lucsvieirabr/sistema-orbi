import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, CircleCheck, FolderKanban, Pencil, Plus, Rocket, RotateCw, Target, Trash2 } from "lucide-react";

import { ExecuteGoalDialog } from "@/components/projects/ExecuteGoalDialog";
import { UsageBar } from "@/components/planning/LedgerStrip";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import {
  describePlanningError,
  formatDateMedium,
  formatDayMonth,
  formatMoney,
  formatMonthShort,
  formatPct,
  formatSignedMoney,
  plural,
} from "@/components/planning/planning-utils";
import { PartnerBadge } from "@/components/family/PartnerBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ColorPicker } from "@/components/ui/color-picker";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
import { EmptyState, PageBody, PageHeader, PageToolbar, SectionHeader } from "@/components/ui/page";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { OwnerMark } from "@/components/family/OwnerMark";
import { useFeature } from "@/hooks/use-feature";
import { useGoalAllocations, useGoals, type GoalInput, type GoalProgress } from "@/hooks/use-goals";
import { cn, getCurrentDateString } from "@/lib/utils";

/**
 * Metas financeiras (Pro/Casal). O gate de plano fica na rota (PremiumRoute).
 */

const GOAL_ICONS: Array<{ key: string; label: string }> = [
  { key: "target", label: "Alvo" },
  { key: "shield", label: "Reserva de emergência" },
  { key: "piggy-bank", label: "Poupança" },
  { key: "plane", label: "Viagem" },
  { key: "home", label: "Casa" },
  { key: "car", label: "Carro" },
  { key: "graduation-cap", label: "Estudos" },
  { key: "heart", label: "Saúde" },
  { key: "baby", label: "Filhos" },
  { key: "laptop", label: "Equipamento" },
  { key: "gift", label: "Presente" },
  { key: "trophy", label: "Conquista" },
];

const DEFAULT_COLOR = "#3b82f6";

type GoalEditorState = { mode: "create" } | { mode: "edit"; goal: GoalProgress };

export default function Goals() {
  const { goals, isLoading, error, refetch, createGoal, updateGoal, deleteGoal, addAllocation, deleteAllocation } =
    useGoals();
  const { isMine } = useFamilyGroup();
  const [editor, setEditor] = useState<GoalEditorState | null>(null);
  const [movingGoalId, setMovingGoalId] = useState<string | null>(null);
  const [executingGoalId, setExecutingGoalId] = useState<string | null>(null);
  const { hasFeature: canExecute } = useFeature("projetos_vida");
  const executingGoal = goals.find((goal) => goal.id === executingGoalId) ?? null;

  const movingGoal = goals.find((goal) => goal.id === movingGoalId) ?? null;

  // Concluídas vão para o fim: a lista começa pelo que ainda pede ação.
  const ordered = useMemo(
    () =>
      [...goals].sort((a, b) => {
        const executedA = a.executed_at ? 1 : 0;
        const executedB = b.executed_at ? 1 : 0;
        if (executedA !== executedB) return executedA - executedB;
        const doneA = a.saved_value >= a.target_value ? 1 : 0;
        const doneB = b.saved_value >= b.target_value ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline);
        if (a.deadline) return -1;
        if (b.deadline) return 1;
        return a.created_at.localeCompare(b.created_at);
      }),
    [goals],
  );

  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved_value, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target_value, 0);
  const monthlyNeeded = goals.reduce((sum, goal) => sum + (goal.monthly_needed ?? 0), 0);

  const handleDelete = async (goal: GoalProgress) => {
    try {
      await deleteGoal(goal.id);
      notifyPlanningSuccess("Meta excluída", `“${goal.name}” e os aportes dela saíram da lista.`);
    } catch (err) {
      notifyPlanningError("Não foi possível excluir", err);
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={Target}
        title="Metas"
        description="Objetivos com valor e prazo. Cada aporte recalcula quanto falta e quanto guardar por mês."
        actions={
          <Button onClick={() => setEditor({ mode: "create" })} className="w-full sm:w-auto">
            <Plus aria-hidden />
            Nova meta
          </Button>
        }
      />

      {goals.length > 0 && (
        <PageToolbar>
          <p className="text-sm tabular text-muted-foreground">
              <span className="font-medium text-foreground">{formatMoney(totalSaved)}</span> guardados de{" "}
              {formatMoney(totalTarget)} em {plural(goals.length, "meta", "metas")}
              {monthlyNeeded > 0 && (
                <>
                  {" "}· ritmo para cumprir os prazos{" "}
                  <span className="font-medium text-foreground">{formatMoney(monthlyNeeded)}/mês</span>
                </>
              )}
            </p>
        </PageToolbar>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[15.5rem] w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={Target}
          title="Não deu para carregar as metas"
          description={describePlanningError(error).message}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta ainda"
          description="Comece por uma: a reserva de emergência, uma viagem, a entrada de um imóvel. Valor e prazo bastam."
          action={
            <Button onClick={() => setEditor({ mode: "create" })}>
              <Plus aria-hidden />
              Criar primeira meta
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ordered.map((goal, index) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              index={index}
              readOnly={!isMine(goal.user_id)}
              onEdit={() => setEditor({ mode: "edit", goal })}
              onDelete={() => handleDelete(goal)}
              onMove={() => setMovingGoalId(goal.id)}
              canExecute={canExecute}
              onExecute={() => setExecutingGoalId(goal.id)}
            />
          ))}
        </ul>
      )}

      <GoalEditor
        state={editor}
        onClose={() => setEditor(null)}
        onCreate={createGoal}
        onUpdate={updateGoal}
      />

      <AllocationDialog
        goal={movingGoal}
        readOnly={movingGoal ? !isMine(movingGoal.user_id) || Boolean(movingGoal.executed_at) : true}
        onClose={() => setMovingGoalId(null)}
        onAdd={addAllocation}
        onDelete={deleteAllocation}
      />

      <ExecuteGoalDialog goal={executingGoal} onClose={() => setExecutingGoalId(null)} />
    </PageBody>
  );
}

function GoalCard({
  goal,
  index,
  readOnly,
  onEdit,
  onDelete,
  onMove,
  canExecute,
  onExecute,
}: {
  goal: GoalProgress;
  index: number;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: () => void;
  canExecute: boolean;
  onExecute: () => void;
}) {
  const executed = Boolean(goal.executed_at);
  const done = goal.saved_value >= goal.target_value;
  const today = getCurrentDateString();
  const overdue = !done && goal.deadline !== null && goal.deadline < today;

  let pace: ReactNode;
  if (executed) {
    pace = (
      <Badge variant="outline">
        <FolderKanban className="h-3 w-3" aria-hidden />
        Virou projeto · {formatMoney(goal.saved_value)} de orçamento
      </Badge>
    );
  } else if (done) {
    pace = (
      <Badge variant="success">
        <CircleCheck className="h-3 w-3" aria-hidden />
        Meta atingida
      </Badge>
    );
  } else if (overdue) {
    pace = (
      <Badge variant="warning">Prazo vencido · faltam {formatMoney(goal.remaining_value)}</Badge>
    );
  } else if (goal.monthly_needed !== null && goal.months_left !== null) {
    pace = (
      <p className="text-xs tabular text-muted-foreground">
        Guarde <span className="font-medium text-foreground">{formatMoney(goal.monthly_needed)}/mês</span> por{" "}
        {plural(goal.months_left, "mês", "meses")}
      </p>
    );
  } else {
    pace = <p className="text-xs tabular text-muted-foreground">Faltam {formatMoney(goal.remaining_value)} · sem prazo</p>;
  }

  return (
    <li className="flex animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
      <Card interactive className="relative isolate flex w-full flex-col overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: goal.color }} />

        <CardHeader className="gap-0 space-y-0">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
              <IconRenderer iconName={goal.icon} className="h-4 w-4 text-muted-foreground" fallbackIcon={Target} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <OwnerMark userId={goal.user_id} />
                <h2
                  className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground"
                  title={goal.name}
                >
                  {goal.name}
                </h2>
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {goal.deadline ? <span>Até {formatDateMedium(goal.deadline)}</span> : <span>Sem prazo</span>}
                {readOnly && <PartnerBadge userId={goal.user_id} />}
              </p>
            </div>
            <div className="-mr-2 -mt-1 flex shrink-0 items-center gap-0.5 md:mr-0">
              <Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={readOnly} aria-label={`Editar meta ${goal.name}`}>
                <Pencil aria-hidden />
              </Button>
              <ConfirmationDialog
                title="Excluir meta"
                description={`“${goal.name}” e todo o histórico de aportes serão apagados. Seus lançamentos no extrato não mudam.`}
                confirmText="Excluir meta"
                variant="destructive"
                onConfirm={onDelete}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={readOnly}
                  aria-label={`Excluir meta ${goal.name}`}
                  className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              </ConfirmationDialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="mt-auto">
          <div className="flex items-baseline justify-between gap-3">
            <p className="figure-lg tabular text-foreground">{formatMoney(goal.saved_value)}</p>
            <p className="text-sm font-medium tabular text-muted-foreground">{formatPct(Math.min(goal.progress_pct, 999), { digits: 0 })}</p>
          </div>
          <p className="text-xs tabular text-muted-foreground">de {formatMoney(goal.target_value)}</p>
          <UsageBar
            className="mt-3"
            value={goal.saved_value}
            max={goal.target_value}
            color={goal.color}
            label={`Progresso da meta ${goal.name}`}
            valueText={`${formatMoney(goal.saved_value)} de ${formatMoney(goal.target_value)}`}
          />
          <div className="mt-3 min-h-6">{pace}</div>
        </CardContent>

        <CardFooter className="flex-wrap gap-2">
          {executed ? (
            goal.project_id ? (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                <Link to={`/sistema/projects?projeto=${goal.project_id}`}>
                  <FolderKanban aria-hidden />
                  Abrir projeto
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onMove}>
                Ver histórico
              </Button>
            )
          ) : (
            <>
              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={onMove}>
                {readOnly ? "Ver histórico" : "Aporte ou resgate"}
              </Button>
              {canExecute && !readOnly && goal.saved_value > 0 && (
                <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={onExecute}>
                  <Rocket aria-hidden />
                  Executar meta
                </Button>
              )}
            </>
          )}
          {goal.last_allocation_on && (
            <p className="text-xs tabular text-muted-foreground sm:ml-auto">
              Último movimento em {formatDayMonth(goal.last_allocation_on)}
            </p>
          )}
        </CardFooter>
      </Card>
    </li>
  );
}

function GoalEditor({
  state,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: GoalEditorState | null;
  onClose: () => void;
  onCreate: (input: GoalInput) => Promise<void>;
  onUpdate: (id: string, input: GoalInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState("target");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [errors, setErrors] = useState<{ name?: string; target?: string; deadline?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const deadlineRef = useRef<HTMLInputElement>(null);

  const editing = state?.mode === "edit" ? state.goal : null;
  const today = getCurrentDateString();

  useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.mode === "edit") {
      setName(state.goal.name);
      setTarget(state.goal.target_value);
      setDeadline(state.goal.deadline ?? "");
      setIcon(state.goal.icon);
      setColor(state.goal.color);
    } else {
      setName("");
      setTarget(null);
      setDeadline("");
      setIcon("target");
      setColor(DEFAULT_COLOR);
    }
  }, [state]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    const nextErrors: typeof errors = {};
    if (!trimmed) nextErrors.name = "Dê um nome para a meta.";
    if (!target || target <= 0) nextErrors.target = "Informe quanto você quer juntar.";
    const deadlineChanged = !editing || deadline !== (editing.deadline ?? "");
    if (deadline && deadlineChanged && deadline < today) nextErrors.deadline = "Escolha hoje ou uma data futura.";
    setErrors(nextErrors);
    if (nextErrors.name) return nameRef.current?.focus();
    if (nextErrors.target) return targetRef.current?.focus();
    if (nextErrors.deadline) return deadlineRef.current?.focus();

    const input: GoalInput = { name: trimmed, targetValue: target!, deadline: deadline || null, icon, color };
    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, input);
        notifyPlanningSuccess("Meta atualizada");
      } else {
        await onCreate(input);
        notifyPlanningSuccess("Meta criada", "Registre o primeiro aporte quando quiser.");
      }
      onClose();
    } catch (err) {
      notifyPlanningError(editing ? "Não foi possível salvar a meta" : "Não foi possível criar a meta", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={state !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar meta" : "Nova meta"}</DialogTitle>
            <DialogDescription>Valor e prazo bastam. O Orbi calcula o ritmo de aportes.</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="goal-name">Nome</Label>
              <Input
                id="goal-name"
                ref={nameRef}
                value={name}
                maxLength={80}
                autoComplete="off"
                placeholder="Reserva de emergência…"
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "goal-name-error" : undefined}
              />
              {errors.name && (
                <p id="goal-name-error" className="text-xs text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="goal-target">Valor da meta</Label>
                <NumericInput
                  id="goal-target"
                  ref={targetRef}
                  currency
                  inputMode="decimal"
                  autoComplete="off"
                  value={target}
                  onChange={(value) => {
                    setTarget(value);
                    setErrors((prev) => ({ ...prev, target: undefined }));
                  }}
                  placeholder="R$ 0,00"
                  aria-invalid={Boolean(errors.target)}
                  aria-describedby={errors.target ? "goal-target-error" : undefined}
                />
                {errors.target && (
                  <p id="goal-target-error" className="text-xs text-destructive">
                    {errors.target}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-deadline">
                  Prazo <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="goal-deadline"
                  ref={deadlineRef}
                  type="date"
                  value={deadline}
                  min={today}
                  max="2100-12-31"
                  onChange={(event) => {
                    setDeadline(event.target.value);
                    setErrors((prev) => ({ ...prev, deadline: undefined }));
                  }}
                  aria-invalid={Boolean(errors.deadline)}
                  aria-describedby={errors.deadline ? "goal-deadline-error" : undefined}
                />
                {errors.deadline && (
                  <p id="goal-deadline-error" className="text-xs text-destructive">
                    {errors.deadline}
                  </p>
                )}
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none text-foreground">Ícone</legend>
              <ToggleGroup
                type="single"
                value={icon}
                onValueChange={(value) => value && setIcon(value)}
                className="grid grid-cols-6 gap-1.5 rounded-xl border border-border-subtle bg-surface-sunken p-1.5"
              >
                {GOAL_ICONS.map((option) => (
                  <ToggleGroupItem
                    key={option.key}
                    value={option.key}
                    aria-label={option.label}
                    title={option.label}
                    className="h-11 w-full rounded-lg border border-transparent data-[state=on]:border-border data-[state=on]:bg-card md:h-9"
                  >
                    <IconRenderer iconName={option.key} className="h-4 w-4" />
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </fieldset>

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
              {editing ? "Salvar meta" : "Criar meta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AllocationDialog({
  goal,
  readOnly,
  onClose,
  onAdd,
  onDelete,
}: {
  goal: GoalProgress | null;
  readOnly: boolean;
  onClose: () => void;
  onAdd: (values: { goalId: string; amount: number; allocatedOn: string; note?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(getCurrentDateString());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const { data: history, isLoading: historyLoading } = useGoalAllocations(goal?.id ?? null);

  useEffect(() => {
    if (!goal) return;
    setKind("deposit");
    setAmount(null);
    setDate(getCurrentDateString());
    setNote("");
    setError(null);
  }, [goal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!goal) return;
    if (!amount || amount <= 0) {
      setError("Informe um valor maior que zero.");
      amountRef.current?.focus();
      return;
    }
    if (kind === "withdraw" && amount > goal.saved_value) {
      setError(`Você pode resgatar até ${formatMoney(goal.saved_value)}.`);
      amountRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        goalId: goal.id,
        amount: kind === "deposit" ? amount : -amount,
        allocatedOn: date || getCurrentDateString(),
        note,
      });
      notifyPlanningSuccess(kind === "deposit" ? "Aporte registrado" : "Resgate registrado", goal.name);
      setAmount(null);
      setNote("");
      setError(null);
    } catch (err) {
      notifyPlanningError("Não foi possível registrar", err);
    } finally {
      setSaving(false);
    }
  };

  const removeMovement = async (id: string) => {
    try {
      await onDelete(id);
      notifyPlanningSuccess("Movimento excluído");
    } catch (err) {
      notifyPlanningError("Não foi possível excluir", err);
    }
  };

  return (
    <Dialog open={goal !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {goal && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8">{goal.name}</DialogTitle>
              <DialogDescription className="tabular">
                {formatMoney(goal.saved_value)} guardados de {formatMoney(goal.target_value)}
                {goal.monthly_needed !== null && ` · ${formatMoney(goal.monthly_needed)}/mês até ${formatMonthShort(goal.deadline!)}`}
              </DialogDescription>
            </DialogHeader>

            <UsageBar
              value={goal.saved_value}
              max={goal.target_value}
              color={goal.color}
              label={`Progresso da meta ${goal.name}`}
              valueText={`${formatPct(goal.progress_pct, { digits: 0 })} da meta`}
            />

            {!readOnly && (
              <form onSubmit={submit} noValidate className="space-y-4">
                <ToggleGroup
                  type="single"
                  value={kind}
                  onValueChange={(value) => {
                    if (!value) return;
                    setKind(value as "deposit" | "withdraw");
                    setError(null);
                  }}
                  aria-label="Tipo de movimento"
                  className="grid grid-cols-2 gap-1 rounded-xl border border-border-subtle bg-surface-sunken p-1"
                >
                  <ToggleGroupItem
                    value="deposit"
                    className="h-10 gap-1.5 rounded-lg border border-transparent data-[state=on]:border-border data-[state=on]:bg-card md:h-8"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    Aporte
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="withdraw"
                    disabled={goal.saved_value <= 0}
                    className="h-10 gap-1.5 rounded-lg border border-transparent data-[state=on]:border-border data-[state=on]:bg-card md:h-8"
                  >
                    <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden />
                    Resgate
                  </ToggleGroupItem>
                </ToggleGroup>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="allocation-amount">Valor</Label>
                    <NumericInput
                      id="allocation-amount"
                      ref={amountRef}
                      currency
                      inputMode="decimal"
                      autoComplete="off"
                      value={amount}
                      onChange={(value) => {
                        setAmount(value);
                        setError(null);
                      }}
                      placeholder="R$ 0,00"
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? "allocation-error" : undefined}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="allocation-date">Data</Label>
                    <Input
                      id="allocation-date"
                      type="date"
                      value={date}
                      max="2100-12-31"
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allocation-note">
                    Observação <span className="font-normal text-muted-foreground">(opcional)</span>
                  </Label>
                  <Input
                    id="allocation-note"
                    value={note}
                    maxLength={140}
                    autoComplete="off"
                    placeholder="Parte do 13º…"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>

                {error && (
                  <p id="allocation-error" role="alert" className="text-xs text-destructive">
                    {error}
                  </p>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={saving} className="w-full sm:w-auto">
                    {saving && <Spinner className="h-4 w-4 text-primary-foreground" />}
                    {kind === "deposit" ? "Registrar aporte" : "Registrar resgate"}
                  </Button>
                </DialogFooter>
              </form>
            )}

            <section aria-labelledby="goal-history" className="border-t border-border-subtle pt-4">
              <SectionHeader
                id="goal-history"
                title="Histórico"
                actions={
                  goal.allocations_count > 0 ? (
                    <span className="text-xs tabular text-muted-foreground">
                      {plural(goal.allocations_count, "movimento", "movimentos")}
                    </span>
                  ) : undefined
                }
              />
              {historyLoading ? (
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !history || history.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Nenhum movimento ainda.</p>
              ) : (
                <ul className="mt-2 max-h-64 divide-y divide-border-subtle overflow-y-auto overscroll-contain">
                  {history.map((movement) => (
                    <li key={movement.id} className="flex items-center gap-3 py-2.5">
                      <span
                        aria-hidden
                        className={cn("h-7 w-0.5 shrink-0 rounded-full", movement.amount > 0 ? "bg-success" : "bg-warning")}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {movement.amount > 0 ? "Aporte" : "Resgate"}
                          <span className="text-muted-foreground"> · {formatDateMedium(movement.allocated_on)}</span>
                        </p>
                        {movement.note && (
                          <p className="truncate text-xs text-muted-foreground" title={movement.note}>
                            {movement.note}
                          </p>
                        )}
                      </div>
                      <p className={cn("shrink-0 text-sm font-medium tabular", movement.amount > 0 ? "text-success" : "text-foreground")}>
                        {formatSignedMoney(movement.amount)}
                      </p>
                      {!readOnly && (
                        <ConfirmationDialog
                          title="Excluir movimento"
                          description="O saldo da meta é recalculado. Não dá para desfazer."
                          confirmText="Excluir"
                          variant="destructive"
                          onConfirm={() => removeMovement(movement.id)}
                        >
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${movement.amount > 0 ? "aporte" : "resgate"} de ${formatMoney(Math.abs(movement.amount))}`}
                            className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </ConfirmationDialog>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
