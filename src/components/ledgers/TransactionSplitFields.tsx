import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FileSignature, RotateCcw } from "lucide-react";

import { formatMoney, formatPct } from "@/components/planning/planning-utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFeature } from "@/hooks/use-feature";
import { useOpenLedgers } from "@/hooks/use-ledgers";
import {
  distributeCompensation,
  suggestCompensation,
  useSplitContracts,
} from "@/hooks/use-split-contracts";
import { roundCurrency } from "@/lib/utils";
import "@/lib/features/orbi-features";

export interface SplitCompensation {
  /** Total que as pessoas compensam (vai para `compensation_value`). */
  total: number;
  /** Parte de cada pessoa (vira a linha "a receber" de cada uma). */
  perPerson: Record<string, number>;
}

/**
 * Compensação proporcional no lançamento de um gasto rateado (Pro/Casal).
 *
 * Lê os contratos de rateio da categoria e pré-preenche o valor a compensar.
 * É sugestão: a pessoa pode apagar e deixar R$ 0,00. Enquanto o campo não for
 * editado à mão, ele acompanha valor, categoria e pessoas. Sem a feature, não
 * renderiza nada e o extrato segue com a divisão igual de sempre.
 */
export function SplitCompensationField({
  value,
  categoryId,
  personIds,
  peopleNames,
  onChange,
}: {
  value: number;
  categoryId: string | null | undefined;
  personIds: string[];
  peopleNames: Record<string, string>;
  onChange: (next: SplitCompensation | null) => void;
}) {
  const { hasFeature, isLoading: featureLoading } = useFeature("contratos_rateio");
  const { contracts } = useSplitContracts({ enabled: hasFeature });
  const [manual, setManual] = useState<number | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const suggestion = useMemo(
    () => suggestCompensation(value, categoryId, personIds, contracts),
    [value, categoryId, personIds, contracts],
  );

  // Mudou o gasto (valor, categoria ou pessoas): volta a valer a sugestão.
  const signature = `${roundCurrency(value || 0)}|${categoryId ?? ""}|${personIds.join(",")}`;
  const lastSignature = useRef(signature);
  useEffect(() => {
    if (lastSignature.current !== signature) {
      lastSignature.current = signature;
      setManual(null);
    }
  }, [signature]);

  const active = hasFeature && personIds.length > 0;
  const gross = Math.max(0, roundCurrency(value || 0));
  const total = manual === null ? suggestion.total : Math.min(Math.max(roundCurrency(manual), 0), gross);

  useEffect(() => {
    if (!active) {
      onChangeRef.current(null);
      return;
    }
    const perPerson =
      manual === null ? suggestion.perPerson : distributeCompensation(total, personIds, suggestion.perPerson);
    onChangeRef.current({ total, perPerson });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, total, manual, suggestion, personIds.join(",")]);

  if (featureLoading || !hasFeature || personIds.length === 0) return null;

  const perPerson = manual === null ? suggestion.perPerson : distributeCompensation(total, personIds, suggestion.perPerson);
  const edited = manual !== null && roundCurrency(manual) !== suggestion.total;
  const mine = roundCurrency(gross - total);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3.5 md:p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[10rem] flex-1 space-y-1.5">
          <Label htmlFor="split-compensation">Valor a ser compensado</Label>
          <NumericInput
            id="split-compensation"
            currency
            inputMode="decimal"
            autoComplete="off"
            value={total}
            onChange={(next) => setManual(next ?? 0)}
            aria-describedby="split-compensation-hint"
          />
        </div>
        {edited && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setManual(null)}>
            <RotateCcw aria-hidden />
            Usar sugestão ({formatMoney(suggestion.total)})
          </Button>
        )}
      </div>

      <p id="split-compensation-hint" className="text-xs leading-relaxed text-muted-foreground">
        {suggestion.matched.length > 0 ? (
          <span className="inline-flex flex-wrap items-center gap-x-1.5">
            <FileSignature className="h-3 w-3 shrink-0" aria-hidden />
            {suggestion.matched
              .map((contract) => `${contract.category_name}: ${formatPct(contract.proportion_percentage, { digits: 0 })} com ${contract.person_name}`)
              .join(" · ")}
            {edited && " · valor ajustado por você"}
          </span>
        ) : (
          <>
            Sem contrato para esta categoria: divisão igual.{" "}
            <Link to="/sistema/ledgers?aba=contratos" className="font-medium text-foreground underline-offset-4 hover:underline">
              Criar contrato
            </Link>
          </>
        )}
      </p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border-subtle pt-3 text-xs tabular sm:grid-cols-3">
        <div className="flex justify-between gap-2 sm:block">
          <dt className="text-muted-foreground">Fica com você</dt>
          <dd className="font-medium text-foreground">{formatMoney(mine)}</dd>
        </div>
        {personIds.map((personId) => (
          <div key={personId} className="flex justify-between gap-2 sm:block">
            <dt className="truncate text-muted-foreground">{peopleNames[personId] ?? "Pessoa"} compensa</dt>
            <dd className="font-medium text-foreground">{formatMoney(perPerson[personId] ?? 0)}</dd>
          </div>
        ))}
      </dl>
      {total === 0 && (
        <p className="text-xs text-muted-foreground">Com R$ 0,00 o gasto é salvo inteiro para você, sem conta a receber.</p>
      )}
    </div>
  );
}

/**
 * Vincula o gasto a um evento (Acertos de viagem). Só aparece para Pro/Casal
 * com pelo menos um evento; eventos liquidados só aparecem se já forem o valor.
 */
export function LedgerPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}) {
  const { hasFeature } = useFeature("contratos_rateio");
  const { data: ledgers = [] } = useOpenLedgers({ enabled: hasFeature });

  if (!hasFeature) return null;
  const options = ledgers.filter((ledger) => ledger.status === "open" || ledger.id === value);
  if (options.length === 0) return null;

  return (
    <div className="space-y-1">
      <Label htmlFor="transaction-ledger" className="text-sm">
        Evento / viagem
      </Label>
      <Select value={value ?? "none"} onValueChange={(next) => onChange(next === "none" ? null : next)} disabled={disabled}>
        <SelectTrigger id="transaction-ledger">
          <SelectValue placeholder="Nenhum" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhum</SelectItem>
          {options.map((ledger) => (
            <SelectItem key={ledger.id} value={ledger.id}>
              {ledger.name}
              {ledger.status === "settled" ? " (liquidado)" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
