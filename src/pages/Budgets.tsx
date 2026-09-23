import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Gauge, Pencil, Plus, RotateCw, Sparkles, Trash2 } from "lucide-react";

import { BudgetInflationAlerts } from "@/components/inflation/BudgetInflationAlerts";
import { LedgerStrip, UsageBar, usageTone, type LedgerTone } from "@/components/planning/LedgerStrip";
import { MonthSwitcher, useMonthParam } from "@/components/planning/MonthSwitcher";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import {
  describePlanningError,
  formatMoney,
  formatMonthLong,
  formatMonthName,
  formatPct,
  plural,
} from "@/components/planning/planning-utils";
import { PartnerBadge } from "@/components/family/PartnerBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { EmptyState, PageBody, PageHeader, PageToolbar, SectionHeader, ToolbarSpacer } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { useBudgets, type BudgetOverview, type BudgetRow, type BudgetSuggestion } from "@/hooks/use-budgets";
import { useCategories } from "@/hooks/use-categories";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { OwnerMark } from "@/components/family/OwnerMark";
import { useNotifications } from "@/hooks/use-notifications";
import { toAlert } from "@/hooks/use-personal-inflation";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/**
 * Orçamentos — teto de gasto por categoria, por mês (Pro/Casal).
 * O gate de plano fica na rota (PremiumRoute); aqui só existe quem pode usar.
 */

type EditorState =
  | { mode: "create"; categoryId?: string; amount?: number }
  | { mode: "edit"; budget: BudgetRow };

const statusTone: Record<LedgerTone, string> = {
  neutral: "text-muted-foreground",
  positive: "text-muted-foreground",
  warning: "text-warning",
  negative: "text-destructive",
};

/** Nome de categoria comparável: sem acento, caixa e espaços extras. */
const categoryKey = (name: string) =>
  name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

/** Sugestão arredondada para cima na dezena: R$ 333,33 → R$ 340. */
const suggestedLimit = (avg: number) => Math.max(10, Math.ceil(avg / 10) * 10);

export default function Budgets() {
  const [month, setMonth] = useMonthParam();
  const { overview, isLoading, error, refetch, isFetching, createBudget, updateBudget, deleteBudget, copyPreviousMonth } =
    useBudgets(month);
  const { notifications } = useNotifications();
  const { isMine } = useFamilyGroup();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [copying, setCopying] = useState(false);

  const monthName = formatMonthName(month);
  const budgets = overview?.budgets ?? [];
  const totals = overview?.totals;

  const handleCopy = async () => {
    setCopying(true);
    try {
      const created = await copyPreviousMonth();
      notifyPlanningSuccess(
        created > 0 ? `${plural(created, "orçamento copiado", "orçamentos copiados")}` : "Nada novo para copiar",
        created > 0 ? `Os tetos do mês anterior agora valem para ${monthName}.` : "Todas as categorias já têm teto neste mês.",
      );
    } catch (err) {
      notifyPlanningError("Não foi possível copiar", err);
    } finally {
      setCopying(false);
    }
  };

  const handleDelete = async (budget: BudgetRow) => {
    try {
      await deleteBudget(budget.id);
      // Categoria pode ter mais de um teto (duplicado ou do parceiro no plano
      // Casal): só diz "ficou sem teto" se de fato não sobrou nenhum.
      const stillCapped = budgets.some((b) => b.id !== budget.id && b.category_id === budget.category_id);
      notifyPlanningSuccess(
        "Orçamento removido",
        stillCapped
          ? `${budget.category_name} continua com outro teto ativo em ${monthName}.`
          : `${budget.category_name} ficou sem teto em ${monthName}.`,
      );
    } catch (err) {
      notifyPlanningError("Não foi possível remover", err);
    }
  };

  const copyButton =
    (overview?.previousMonthBudgets ?? 0) > 0 ? (
      <Button variant="outline" onClick={handleCopy} disabled={copying}>
        {copying ? <Spinner className="h-4 w-4" /> : <Copy aria-hidden />}
        Copiar do mês anterior
      </Button>
    ) : null;

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={Gauge}
        title="Orçamentos"
        description="Um teto de gasto por categoria. O consumo soma o que já saiu e o que está agendado no mês."
        actions={
          <Button onClick={() => setEditor({ mode: "create" })} className="w-full sm:w-auto">
            <Plus aria-hidden />
            Novo orçamento
          </Button>
        }
      />

      <PageToolbar>
        <MonthSwitcher month={month} onChange={setMonth} />
        <ToolbarSpacer />
        <div className="flex items-center gap-3">
          {isFetching && !isLoading && <Spinner className="h-4 w-4" />}
          {budgets.length > 0 && copyButton}
        </div>
      </PageToolbar>

      <BudgetInflationAlerts
        alerts={notifications
          .filter((item) => item.kind === "budget_inflation" && !item.readAt && item.payload?.period_month === month)
          .map((item) => toAlert({ id: item.id, title: item.title, body: item.body, payload: item.payload, created_at: item.createdAt }))}
      />

      {isLoading ? (
        <BudgetsSkeleton />
      ) : error ? (
        <EmptyState
          icon={Gauge}
          title="Não deu para carregar os orçamentos"
          description={describePlanningError(error).message}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : budgets.length === 0 ? (
        <div className="space-y-5 md:space-y-7">
          <EmptyState
            icon={Gauge}
            title={`Nenhum orçamento em ${monthName}`}
            description="Escolha uma categoria de gasto e defina até quanto pode sair neste mês. O Orbi acompanha o resto."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                {copyButton}
                <Button onClick={() => setEditor({ mode: "create" })}>
                  <Plus aria-hidden />
                  Criar orçamento
                </Button>
              </div>
            }
          />
          <Suggestions
            suggestions={overview?.suggestions ?? []}
            onUse={(s) => setEditor({ mode: "create", categoryId: s.category_id, amount: suggestedLimit(s.avg_3m) })}
          />
        </div>
      ) : (
        <>
          <Summary totals={totals!} monthName={monthName} />

          <Card className="overflow-hidden">
            <CardHeader className="pb-2 md:pb-3">
              <SectionHeader
                title="Por categoria"
                description="Ordenado pelo quanto do teto já foi usado."
                actions={<span className="text-xs tabular text-muted-foreground">{plural(budgets.length, "categoria", "categorias")}</span>}
              />
            </CardHeader>
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {budgets.map((budget, index) => (
                <BudgetItem
                  key={budget.id}
                  budget={budget}
                  index={index}
                  readOnly={!isMine(budget.user_id)}
                  onEdit={() => setEditor({ mode: "edit", budget })}
                  onDelete={() => handleDelete(budget)}
                />
              ))}
            </ul>
          </Card>

          <Suggestions
            suggestions={overview?.suggestions ?? []}
            onUse={(s) => setEditor({ mode: "create", categoryId: s.category_id, amount: suggestedLimit(s.avg_3m) })}
          />
        </>
      )}

      <BudgetEditor
        month={month}
        state={editor}
        onClose={() => setEditor(null)}
        budgets={budgets}
        suggestions={overview?.suggestions ?? []}
        isMine={isMine}
        onCreate={createBudget}
        onUpdate={updateBudget}
      />
    </PageBody>
  );
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-5 md:space-y-7" aria-busy="true">
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      <div className="space-y-3 rounded-xl border border-border p-4 md:p-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2 py-2">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Summary({ totals, monthName }: { totals: BudgetOverview["totals"]; monthName: string }) {
  const tone = usageTone(totals.spent, totals.limit);
  const usedPct = totals.limit > 0 ? (totals.spent / totals.limit) * 100 : 0;
  const over = totals.remaining < 0;

  const alertLine =
    totals.overCount > 0
      ? `${plural(totals.overCount, "categoria passou", "categorias passaram")} do teto`
      : totals.warningCount > 0
        ? `${plural(totals.warningCount, "categoria acima", "categorias acima")} de 80%`
        : "Todas as categorias dentro do teto";

  return (
    <LedgerStrip
      aria-label={`Resumo dos orçamentos de ${monthName}`}
      cells={[
        { label: "Orçado", value: formatMoney(totals.limit), hint: `Soma dos tetos de ${monthName}` },
        {
          label: "Consumido",
          value: formatMoney(totals.spent),
          tone: tone === "positive" ? "neutral" : tone,
          hint:
            totals.scheduled > 0
              ? `${formatPct(usedPct, { digits: 0 })} do orçado · ${formatMoney(totals.scheduled)} ainda agendado`
              : `${formatPct(usedPct, { digits: 0 })} do orçado`,
        },
        {
          label: over ? "Acima do orçado" : "Ainda cabe",
          value: formatMoney(Math.abs(totals.remaining)),
          tone: over ? "negative" : "positive",
          hint: alertLine,
        },
      ]}
      footer={
        <UsageBar
          className="rounded-none"
          value={totals.spent}
          max={totals.limit}
          scheduled={totals.scheduled}
          tone={tone === "positive" ? "neutral" : tone}
          label="Consumo total do orçamento do mês"
          valueText={`${formatMoney(totals.spent)} de ${formatMoney(totals.limit)}`}
        />
      }
    />
  );
}

function BudgetItem({
  budget,
  index,
  readOnly,
  onEdit,
  onDelete,
}: {
  budget: BudgetRow;
  index: number;
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = usageTone(budget.spent, budget.amount_limit);
  const status =
    tone === "negative"
      ? `Passou ${formatMoney(Math.abs(budget.remaining))}`
      : tone === "warning"
        ? `Restam ${formatMoney(budget.remaining)}`
        : `Cabe mais ${formatMoney(budget.remaining)}`;

  const trend =
    budget.avg_3m > 0
      ? `Média de 3 meses ${formatMoney(budget.avg_3m)}`
      : budget.previous_spent > 0
        ? `Mês anterior ${formatMoney(budget.previous_spent)}`
        : null;

  return (
    <li
      className="animate-rise px-4 py-3.5 transition-colors duration-200 ease-swift hover:bg-accent/40 md:px-5 lg:px-6"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
          <IconRenderer iconName={budget.category_icon} className="h-4 w-4 text-muted-foreground" fallbackIcon={Gauge} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex min-w-0 items-center gap-2">
              <OwnerMark userId={budget.user_id} />
              <span className="truncate text-sm font-medium text-foreground" title={budget.category_name}>
                {budget.category_name}
              </span>
              {readOnly && <PartnerBadge userId={budget.user_id} />}
            </p>
            <p className="shrink-0 text-sm tabular text-foreground">
              {formatMoney(budget.spent)}
              <span className="text-muted-foreground"> de {formatMoney(budget.amount_limit)}</span>
            </p>
          </div>

          <UsageBar
            className="mt-2.5"
            value={budget.spent}
            max={budget.amount_limit}
            scheduled={budget.scheduled}
            tone={tone === "positive" ? "neutral" : tone}
            label={`Consumo de ${budget.category_name}`}
            valueText={`${formatPct(budget.used_pct, { digits: 0 })} do teto, ${status.toLowerCase()}`}
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-xs tabular">
              <span className={cn("font-medium", statusTone[tone])}>
                {formatPct(budget.used_pct, { digits: 0 })} · {status}
              </span>
              {budget.scheduled > 0 && (
                <span className="text-muted-foreground"> · inclui {formatMoney(budget.scheduled)} agendado</span>
              )}
            </p>
            {trend && <p className="text-xs tabular text-muted-foreground">{trend}</p>}
          </div>
        </div>

        <div className="-mr-2 flex shrink-0 items-center gap-0.5 md:mr-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            disabled={readOnly}
            aria-label={`Editar orçamento de ${budget.category_name}, teto ${formatMoney(budget.amount_limit)}${readOnly ? " (do parceiro)" : ""}`}
          >
            <Pencil aria-hidden />
          </Button>
          <ConfirmationDialog
            title="Remover orçamento"
            description={`${budget.category_name} fica sem teto neste mês. Os lançamentos continuam intactos.`}
            confirmText="Remover"
            variant="destructive"
            onConfirm={onDelete}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={readOnly}
              aria-label={`Remover orçamento de ${budget.category_name}, teto ${formatMoney(budget.amount_limit)}${readOnly ? " (do parceiro)" : ""}`}
              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
            >
              <Trash2 aria-hidden />
            </Button>
          </ConfirmationDialog>
        </div>
      </div>
    </li>
  );
}

/** Abaixo disso a "sugestão" é ruído (uma tarifa de centavos não pede teto). */
const SUGGESTION_MIN_AVG = 20;

function Suggestions({ suggestions: all, onUse }: { suggestions: BudgetSuggestion[]; onUse: (s: BudgetSuggestion) => void }) {
  const suggestions = all.filter((suggestion) => suggestion.avg_3m >= SUGGESTION_MIN_AVG);
  if (suggestions.length === 0) return null;

  return (
    <section aria-labelledby="budget-suggestions">
      <SectionHeader
        id="budget-suggestions"
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" aria-hidden />
            Sugestões
          </span>
        }
        title="Categorias que pedem um teto"
        description="Gasto recorrente nos últimos 3 meses e nenhum orçamento neste mês."
      />
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.category_id}
            className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
              <IconRenderer iconName={suggestion.category_icon} className="h-4 w-4 text-muted-foreground" fallbackIcon={Gauge} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={suggestion.category_name}>
                {suggestion.category_name}
              </p>
              <p className="text-xs tabular text-muted-foreground">Média {formatMoney(suggestion.avg_3m)}/mês</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onUse(suggestion)}>
              Usar {formatMoney(suggestedLimit(suggestion.avg_3m))}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BudgetEditor({
  month,
  state,
  onClose,
  budgets,
  suggestions,
  isMine,
  onCreate,
  onUpdate,
}: {
  month: string;
  state: EditorState | null;
  onClose: () => void;
  budgets: BudgetRow[];
  suggestions: BudgetSuggestion[];
  isMine: (userId?: string | null) => boolean;
  onCreate: (values: { categoryId: string; amountLimit: number }) => Promise<void>;
  onUpdate: (id: string, amountLimit: number) => Promise<void>;
}) {
  const { categories, isLoading: categoriesLoading } = useCategories();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ category?: string; amount?: string }>({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);

  const open = state !== null;
  const editing = state?.mode === "edit" ? state.budget : null;

  useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.mode === "edit") {
      setCategoryId(state.budget.category_id);
      setAmount(state.budget.amount_limit);
    } else {
      setCategoryId(state.categoryId ?? "");
      setAmount(state.amount ?? null);
    }
  }, [state]);

  // Meus orçamentos do mês. Chave por id E por nome: o usuário pode ter uma
  // categoria própria com o mesmo nome de uma do sistema ("Alimentação") —
  // o teto duplicado nunca somaria consumo e inflaria o "Orçado".
  const myBudgets = useMemo(() => budgets.filter((b) => isMine(b.user_id)), [budgets, isMine]);
  const findTaken = (id: string, name?: string) =>
    myBudgets.find((b) => b.category_id === id || (name !== undefined && categoryKey(b.category_name) === categoryKey(name)));

  // Só categorias de gasto, próprias ou do sistema, que ainda não têm teto no mês.
  const available = useMemo(() => {
    const takenIds = new Set(myBudgets.map((b) => b.category_id));
    const takenNames = new Set(myBudgets.map((b) => categoryKey(b.category_name)));
    return categories
      .filter((c) => c.category_type === "expense")
      .filter((c) => (editing ? c.id === editing.category_id : !takenIds.has(c.id) && !takenNames.has(categoryKey(c.name))))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [categories, myBudgets, editing]);

  const stats = useMemo(() => {
    if (!categoryId) return null;
    const fromBudget = budgets.find((b) => b.category_id === categoryId && isMine(b.user_id));
    if (fromBudget) return { avg: fromBudget.avg_3m, spent: fromBudget.spent };
    const fromSuggestion = suggestions.find((s) => s.category_id === categoryId);
    if (fromSuggestion) return { avg: fromSuggestion.avg_3m, spent: fromSuggestion.spent };
    return { avg: 0, spent: 0 };
  }, [categoryId, budgets, suggestions, isMine]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!categoryId) nextErrors.category = "Escolha a categoria do orçamento.";
    if (!amount || amount <= 0) nextErrors.amount = "Informe um teto maior que zero.";
    if (!editing && categoryId) {
      const name = categories.find((c) => c.id === categoryId)?.name;
      const existing = findTaken(categoryId, name);
      if (existing) nextErrors.category = `${existing.category_name} já tem teto neste mês. Edite o orçamento existente.`;
    }
    setErrors(nextErrors);
    const firstError = nextErrors.category ?? nextErrors.amount;
    if (firstError) {
      // Inline + toast: o erro inline sozinho passava despercebido.
      toast({ title: editing ? "Não foi possível salvar" : "Não foi possível criar", description: firstError, variant: "destructive" });
      (nextErrors.category ? categoryRef : amountRef).current?.focus();
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, amount!);
        notifyPlanningSuccess("Orçamento atualizado");
      } else {
        await onCreate({ categoryId, amountLimit: amount! });
        notifyPlanningSuccess("Orçamento criado");
      }
      onClose();
    } catch (err) {
      notifyPlanningError(editing ? "Não foi possível atualizar" : "Não foi possível criar", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar orçamento" : "Novo orçamento"}</DialogTitle>
            <DialogDescription>
              Vale para {formatMonthLong(month)}. O consumo conta pela data de cada lançamento.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="budget-category">Categoria</Label>
              <Select
                value={categoryId}
                onValueChange={(value) => {
                  // Radix Select às vezes emite "" (select nativo oculto) — não limpa o erro por isso.
                  if (!value) return;
                  setCategoryId(value);
                  setErrors((prev) => ({ ...prev, category: undefined }));
                }}
                disabled={Boolean(editing) || categoriesLoading}
              >
                <SelectTrigger
                  id="budget-category"
                  ref={categoryRef}
                  aria-invalid={Boolean(errors.category)}
                  aria-describedby={errors.category ? "budget-category-error" : undefined}
                >
                  <SelectValue placeholder={categoriesLoading ? "Carregando categorias…" : "Escolha uma categoria de gasto…"} />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Todas as categorias de gasto já têm teto neste mês.
                    </div>
                  ) : (
                    available.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <span className="flex items-center gap-2">
                          <IconRenderer iconName={category.icon} className="h-3.5 w-3.5 text-muted-foreground" fallbackIcon={Gauge} />
                          {category.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {errors.category && (
                <p id="budget-category-error" className="text-xs text-destructive" role="alert">
                  {errors.category}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-amount">Teto do mês</Label>
              <NumericInput
                id="budget-amount"
                ref={amountRef}
                currency
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                onChange={(value) => {
                  setAmount(value);
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                placeholder="R$ 0,00"
                aria-invalid={Boolean(errors.amount)}
                aria-describedby={errors.amount ? "budget-amount-error" : "budget-amount-help"}
              />
              {errors.amount ? (
                <p id="budget-amount-error" className="text-xs text-destructive" role="alert">
                  {errors.amount}
                </p>
              ) : stats ? (
                <div
                  id="budget-amount-help"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2"
                >
                  <p className="text-xs tabular text-muted-foreground">
                    {stats.avg > 0 ? (
                      <>
                        Média dos últimos 3 meses <span className="font-medium text-foreground">{formatMoney(stats.avg)}</span>
                        {stats.spent > 0 && <> · neste mês {formatMoney(stats.spent)}</>}
                      </>
                    ) : stats.spent > 0 ? (
                      <>Neste mês até agora {formatMoney(stats.spent)}</>
                    ) : (
                      "Sem gastos nessa categoria nos últimos 3 meses."
                    )}
                  </p>
                  {stats.avg > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => setAmount(suggestedLimit(stats.avg))}
                    >
                      Usar {formatMoney(suggestedLimit(stats.avg))}
                    </Button>
                  )}
                </div>
              ) : (
                <p id="budget-amount-help" className="text-xs text-muted-foreground">
                  Escolha a categoria para ver quanto você costuma gastar nela.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner className="h-4 w-4 text-primary-foreground" />}
              {editing ? "Salvar teto" : "Criar orçamento"}
            </Button>
          </DialogFooter>

          {!editing && available.length === 0 && !categoriesLoading && (
            <p className="mt-4 text-xs text-muted-foreground">
              Precisa de outra categoria?{" "}
              <Link to="/sistema/categories" className="font-medium text-foreground underline underline-offset-4">
                Crie em Categorias
              </Link>
              .
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
