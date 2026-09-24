import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { formatDayMonth, formatMoney, plural } from "@/components/planning/planning-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, Spinner } from "@/components/ui/skeleton";
import { useAttachableTransactions } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";

import { addDaysKey } from "./project-meta";

export function AttachTransactionsDialog({
  open,
  projectId,
  projectName,
  startDate,
  endDate,
  onClose,
  onAttach,
}: {
  open: boolean;
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
  onAttach: (ids: string[]) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [from, setFrom] = useState(addDaysKey(startDate, -30));
  const [to, setTo] = useState(endDate);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDebounced("");
    setFrom(addDaysKey(startDate, -30));
    setTo(endDate);
    setSelected(new Set());
  }, [open, startDate, endDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const { data: rows = [], isLoading, isFetching } = useAttachableTransactions(open ? projectId : null, debounced, {
    from: from || "2000-01-01",
    to: to || "2100-12-31",
  });

  const total = useMemo(
    () => rows.filter((row) => selected.has(row.id)).reduce((sum, row) => sum + (row.type === "expense" ? row.value : -row.value), 0),
    [rows, selected],
  );

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const submit = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onAttach([...selected]);
      notifyPlanningSuccess(
        selected.size === 1 ? "Lançamento vinculado" : "Lançamentos vinculados",
        selected.size === 1
          ? `1 lançamento entrou em “${projectName}” e saiu do DRE do mês.`
          : `${plural(selected.size, "lançamento entrou", "lançamentos entraram")} em “${projectName}” e saíram do DRE do mês.`,
      );
      onClose();
    } catch (err) {
      notifyPlanningError("Não foi possível vincular", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Vincular lançamentos</DialogTitle>
          <DialogDescription>
            Escolha no extrato o que pertence a “{projectName}”. Nada muda no saldo das contas.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por descrição…"
              aria-label="Buscar lançamentos"
              autoComplete="off"
              spellCheck={false}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="attach-from" className="text-xs text-muted-foreground">
                De
              </Label>
              <Input id="attach-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="attach-to" className="text-xs text-muted-foreground">
                Até
              </Label>
              <Input id="attach-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="-mx-6 mt-4 min-h-[12rem] flex-1 overflow-y-auto overscroll-contain border-y border-border-subtle px-6" aria-busy={isFetching}>
          {isLoading ? (
            <div className="space-y-2 py-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum lançamento sem projeto neste período{debounced ? " com essa busca" : ""}.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const checked = selected.has(row.id);
                return (
                  <li key={row.id}>
                    <label
                      className={cn(
                        "flex min-h-12 cursor-pointer items-center gap-3 py-2.5 transition-colors duration-200 ease-swift",
                        checked && "text-foreground",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={(value) => toggle(row.id, value === true)} aria-label={`Selecionar ${row.description}`} />
                      <span className="w-11 shrink-0 text-xs font-medium tabular text-muted-foreground">{formatDayMonth(row.date)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">{row.description}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.categoryName ?? "Sem categoria"}
                          {row.status === "PENDING" ? " · pendente" : ""}
                        </span>
                      </span>
                      <span className={cn("shrink-0 text-sm tabular", row.type === "income" ? "text-success" : "text-foreground")}>
                        {row.type === "income" ? "+" : ""}
                        {formatMoney(row.value)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="mt-4 items-center gap-3 sm:justify-between">
          <p className="text-sm tabular text-muted-foreground" aria-live="polite">
            {selected.size > 0 ? (
              <>
                {plural(selected.size, "selecionado", "selecionados")} · <span className="font-medium text-foreground">{formatMoney(Math.abs(total))}</span>
              </>
            ) : (
              "Nada selecionado"
            )}
          </p>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={submit} disabled={saving || selected.size === 0}>
              {saving && <Spinner className="h-4 w-4 text-primary-foreground" />}
              {selected.size > 1 ? `Vincular ${selected.size} lançamentos` : "Vincular lançamento"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
