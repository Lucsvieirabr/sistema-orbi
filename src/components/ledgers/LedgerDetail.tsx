import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCheck,
  Minus,
  Pencil,
  Plus,
  QrCode,
  Receipt,
  RotateCcw,
  RotateCw,
  Trash2,
  Unlink,
  UserPlus,
} from "lucide-react";

import { LedgerStrip } from "@/components/planning/LedgerStrip";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import {
  describePlanningError,
  formatDateMedium,
  formatDayMonth,
  formatMoney,
  formatSignedMoney,
  plural,
} from "@/components/planning/planning-utils";
import { PartnerBadge } from "@/components/family/PartnerBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/ui/numeric-input";
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { useLedger, type LedgerInput, type LedgerTransfer } from "@/hooks/use-ledgers";
import { usePeople } from "@/hooks/use-people";
import { cn, getCurrentDateString } from "@/lib/utils";

import { PixDialog } from "./PixDialog";

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "warning" | "outline" }> = {
  PAID: { label: "Pago", variant: "success" },
  PENDING: { label: "Pendente", variant: "warning" },
};

function transferSentence(transfer: LedgerTransfer) {
  if (transfer.to_key === "owner") return { who: transfer.from_name, verb: "deve", to: "você" };
  if (transfer.from_key === "owner") return { who: "Você", verb: "deve", to: transfer.to_name };
  return { who: transfer.from_name, verb: "deve", to: transfer.to_name };
}

/**
 * Fechamento de um evento (viagem, festa). O extrato de fechamento vem da RPC
 * `orbi_ledger_summary`; "Liquidar lote" passa todas as transações pendentes
 * do evento para Pago de uma vez (`orbi_ledger_settle`).
 */
export function LedgerDetail({
  ledgerId,
  backHref,
  onEdit,
  onDeleted,
}: {
  ledgerId: string;
  backHref: string;
  onEdit: (ledger: { id: string } & LedgerInput) => void;
  onDeleted: () => void;
}) {
  const {
    data,
    isLoading,
    error,
    refetch,
    savePix,
    deleteLedger,
    reopenLedger,
    addParticipant,
    removeParticipant,
    updateParticipantWeight,
    updateOwnerWeight,
    addEntry,
    deleteEntry,
    detachTransaction,
    settleLedger,
  } = useLedger(ledgerId);
  const { isMine } = useFamilyGroup();
  const [pixTransfer, setPixTransfer] = useState<LedgerTransfer | null>(null);
  const [settling, setSettling] = useState(false);

  if (isLoading) {
    return (
      <PageBody aria-busy="true">
        <div className="space-y-3 border-b border-border-subtle pb-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </PageBody>
    );
  }

  if (!error && data === null) {
    return (
      <PageBody>
        <EmptyState
          icon={Receipt}
          title="Evento não encontrado"
          description="Este evento foi excluído ou o link está incorreto."
          action={
            <Button variant="outline" asChild>
              <Link to={backHref}>
                <ArrowLeft aria-hidden />
                Voltar aos eventos
              </Link>
            </Button>
          }
        />
      </PageBody>
    );
  }

  if (error || !data) {
    return (
      <PageBody>
        <EmptyState
          icon={Receipt}
          title="Não deu para abrir o evento"
          description={describePlanningError(error).message}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" asChild>
                <Link to={backHref}>
                  <ArrowLeft aria-hidden />
                  Voltar aos eventos
                </Link>
              </Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RotateCw aria-hidden />
                Tentar de novo
              </Button>
            </div>
          }
        />
      </PageBody>
    );
  }

  const { ledger, participants, entries, transactions, summary } = data;
  const readOnly = !isMine(ledger.user_id);
  const settled = summary.status === "settled";
  const isEmptyLedger = (transactions?.length ?? 0) === 0 && (entries?.length ?? 0) === 0;
  const owner = summary.participants.find((row) => row.key === "owner");
  const period =
    ledger.start_date && ledger.end_date
      ? `${formatDateMedium(ledger.start_date)} a ${formatDateMedium(ledger.end_date)}`
      : ledger.start_date
        ? `Desde ${formatDateMedium(ledger.start_date)}`
        : "Sem datas definidas";

  const handleSettle = async () => {
    setSettling(true);
    try {
      const updated = await settleLedger();
      notifyPlanningSuccess(
        "Lote liquidado",
        updated > 0
          ? `${plural(updated, "transação passou", "transações passaram")} de Pendente para Pago.`
          : "Nenhuma transação estava pendente. O evento foi marcado como liquidado.",
      );
    } catch (err) {
      notifyPlanningError("Não foi possível liquidar o lote", err);
    } finally {
      setSettling(false);
    }
  };

  const handleReopen = async () => {
    try {
      await reopenLedger();
      notifyPlanningSuccess("Evento reaberto", "O status das transações não foi alterado.");
    } catch (err) {
      notifyPlanningError("Não foi possível reabrir", err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLedger();
      notifyPlanningSuccess("Evento excluído", "As transações continuam no extrato, sem vínculo.");
      onDeleted();
    } catch (err) {
      notifyPlanningError("Não foi possível excluir", err);
    }
  };

  return (
    <PageBody>
      <PageHeader
        eyebrow={
          <Link
            to={backHref}
            className="-my-3.5 inline-flex min-h-11 items-center gap-1 rounded-sm pr-2 transition-colors duration-200 ease-swift hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3 w-3" aria-hidden />
            Acertos de viagem
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {ledger.name}
            <Badge variant={settled ? "success" : "outline"} className="align-middle">
              {settled ? "Liquidado" : "Em aberto"}
            </Badge>
            {readOnly && <PartnerBadge userId={ledger.user_id} />}
          </span>
        }
        description={ledger.description ? `${period} · ${ledger.description}` : period}
        actions={
          readOnly ? null : (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Editar evento"
                onClick={() =>
                  onEdit({
                    id: ledger.id,
                    name: ledger.name,
                    description: ledger.description,
                    startDate: ledger.start_date,
                    endDate: ledger.end_date,
                    ownerWeight: ledger.owner_weight,
                    pixKey: ledger.pix_key,
                    pixName: ledger.pix_name,
                  })
                }
              >
                <Pencil aria-hidden />
              </Button>
              <ConfirmationDialog
                title="Excluir evento"
                description={`“${ledger.name}”, os participantes e os gastos pagos por terceiros serão apagados. Suas transações continuam no extrato.`}
                confirmText="Excluir evento"
                variant="destructive"
                onConfirm={handleDelete}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir evento"
                  className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              </ConfirmationDialog>
              {settled ? (
                <Button variant="outline" onClick={handleReopen} className="flex-1 sm:flex-none">
                  <RotateCcw aria-hidden />
                  Reabrir evento
                </Button>
              ) : (
                <ConfirmationDialog
                  title="Liquidar lote"
                  description={
                    summary.pending_count > 0
                      ? `${plural(summary.pending_count, "transação pendente", "transações pendentes")} de “${ledger.name}” vão passar para Pago de uma vez. Use depois de confirmar que o dinheiro caiu.`
                      : `Nenhuma transação está pendente. “${ledger.name}” será marcado como liquidado.`
                  }
                  confirmText="Liquidar lote"
                  onConfirm={handleSettle}
                >
                  <Button
                    disabled={settling || isEmptyLedger}
                    title={isEmptyLedger ? "Vincule ao menos um lançamento para liquidar." : undefined}
                    className="flex-1 sm:flex-none"
                  >
                    <CheckCheck aria-hidden />
                    {settling ? "Liquidando…" : "Liquidar lote"}
                  </Button>
                </ConfirmationDialog>
              )}
            </>
          )
        }
      />

      <LedgerStrip
        cells={[
          {
            label: "Total do evento",
            value: formatMoney(summary.total),
            hint: `${plural(summary.transactions_count, "lançamento seu", "lançamentos seus")} e ${plural(summary.entries_count, "gasto de terceiros", "gastos de terceiros")}.`,
          },
          {
            label: readOnly ? "Titular pagou" : "Você pagou",
            value: formatMoney(owner?.paid ?? 0),
            hint: `Sua parte: ${formatMoney(owner?.share ?? 0)} (peso ${owner?.weight ?? 1}).`,
          },
          {
            label: "Seu saldo no acerto",
            value: formatSignedMoney(owner?.balance ?? 0),
            tone: (owner?.balance ?? 0) > 0 ? "positive" : (owner?.balance ?? 0) < 0 ? "negative" : "neutral",
            hint:
              (owner?.balance ?? 0) > 0
                ? "A receber dos participantes."
                : (owner?.balance ?? 0) < 0
                  ? "A pagar para quem adiantou."
                  : "Ninguém deve nada a você.",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <SettlementCard
            transfers={summary.transfers}
            settled={settled}
            pendingCount={summary.pending_count}
            onPix={setPixTransfer}
          />
          <ParticipantsCard
            balances={summary.participants}
            participants={participants}
            ownerWeight={ledger.owner_weight}
            readOnly={readOnly}
            onAdd={addParticipant}
            onRemove={removeParticipant}
            onWeight={updateParticipantWeight}
            onOwnerWeight={updateOwnerWeight}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <EntriesCard
            entries={entries}
            readOnly={readOnly || settled}
            defaultDate={ledger.start_date ?? getCurrentDateString()}
            onAdd={addEntry}
            onDelete={deleteEntry}
          />
          <TransactionsCard transactions={transactions} readOnly={readOnly} onDetach={detachTransaction} />
        </div>
      </div>

      <PixDialog
        transfer={pixTransfer}
        ledgerName={ledger.name}
        ownerPixKey={ledger.pix_key}
        ownerPixName={ledger.pix_name}
        canSaveOwnerPix={!readOnly}
        onClose={() => setPixTransfer(null)}
        onSaveOwnerPix={savePix}
      />
    </PageBody>
  );
}

function SettlementCard({
  transfers,
  settled,
  pendingCount,
  onPix,
}: {
  transfers: LedgerTransfer[];
  settled: boolean;
  pendingCount: number;
  onPix: (transfer: LedgerTransfer) => void;
}) {
  return (
    <Card className="relative isolate overflow-hidden">
      <span aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-0.5", settled ? "bg-success" : "bg-primary")} />
      <CardHeader>
        <SectionHeader
          eyebrow="Extrato de fechamento"
          title={transfers.length === 0 ? "Tudo certo entre vocês" : plural(transfers.length, "acerto", "acertos")}
          description={
            transfers.length === 0
              ? "Cada participante já pagou exatamente a parte que lhe cabe."
              : "O menor número de transferências para zerar o evento."
          }
          actions={
            pendingCount > 0 && !settled ? (
              <Badge variant="warning">{plural(pendingCount, "pendente", "pendentes")}</Badge>
            ) : undefined
          }
        />
      </CardHeader>
      {transfers.length > 0 && (
        <CardContent>
          <ul className="divide-y divide-border-subtle">
            {transfers.map((transfer, index) => {
              const sentence = transferSentence(transfer);
              return (
                <li
                  key={`${transfer.from_key}-${transfer.to_key}`}
                  className="flex animate-rise flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                  style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
                >
                  <p className="min-w-0 flex-1 text-[0.9375rem] leading-snug text-foreground text-pretty">
                    <span className="font-medium">{sentence.who}</span> {sentence.verb}{" "}
                    <span className="figure-sm font-semibold tabular">{formatMoney(transfer.amount)}</span> para{" "}
                    <span className="font-medium">{sentence.to}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden>
                      {transfer.from_key === "owner" ? "Você" : transfer.from_name}
                      <ArrowRight className="h-3 w-3" />
                      {transfer.to_key === "owner" ? "Você" : transfer.to_name}
                    </span>
                  </p>
                  <Button variant="outline" size="sm" onClick={() => onPix(transfer)} className="w-full sm:w-auto">
                    <QrCode aria-hidden />
                    Gerar PIX Copia e Cola
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

function ParticipantsCard({
  balances,
  participants,
  ownerWeight,
  readOnly,
  onAdd,
  onRemove,
  onWeight,
  onOwnerWeight,
}: {
  balances: Array<{ key: string; person_id: string | null; name: string; weight: number; paid: number; share: number; balance: number }>;
  participants: Array<{ id: string; person_id: string; name: string; weight: number }>;
  ownerWeight: number;
  readOnly: boolean;
  onAdd: (personId: string, weight: number) => Promise<void>;
  onRemove: (participantId: string) => Promise<void>;
  onWeight: (participantId: string, weight: number) => Promise<void>;
  onOwnerWeight: (weight: number) => Promise<void>;
}) {
  const { people } = usePeople();
  const [personId, setPersonId] = useState("");
  const [adding, setAdding] = useState(false);

  const available = useMemo(
    () => (people ?? []).filter((person) => !participants.some((row) => row.person_id === person.id)),
    [people, participants],
  );

  const add = async () => {
    if (!personId) return;
    setAdding(true);
    try {
      await onAdd(personId, 1);
      const name = available.find((person) => person.id === personId)?.name;
      notifyPlanningSuccess("Participante adicionado", name ? `${name} entrou no evento.` : undefined);
      setPersonId("");
    } catch (err) {
      notifyPlanningError("Não foi possível adicionar", err);
    } finally {
      setAdding(false);
    }
  };

  const changeWeight = async (key: string, next: number) => {
    const safe = Math.min(Math.max(Math.round(next), 0), 20);
    try {
      if (key === "owner") {
        if (safe !== ownerWeight) await onOwnerWeight(safe);
        return;
      }
      const row = participants.find((participant) => participant.person_id === key);
      if (row && safe !== row.weight) await onWeight(row.id, safe);
    } catch (err) {
      notifyPlanningError("Não foi possível alterar o peso", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Quem pagou o quê"
          description="Parte de cada um = total × peso ÷ soma dos pesos. Peso 2 conta por duas pessoas."
        />
      </CardHeader>
      <CardContent>
        <div className="scroll-x -mx-1 px-1">
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="sr-only">Pagamentos, partes e saldos por participante</caption>
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs text-muted-foreground">
                <th scope="col" className="pb-2 font-medium">Participante</th>
                <th scope="col" className="pb-2 text-center font-medium">Peso</th>
                <th scope="col" className="pb-2 text-right font-medium">Pagou</th>
                <th scope="col" className="pb-2 text-right font-medium">Parte</th>
                <th scope="col" className="pb-2 text-right font-medium">Saldo</th>
                {!readOnly && <th scope="col" className="w-10 pb-2"><span className="sr-only">Ações</span></th>}
              </tr>
            </thead>
            <tbody>
              {balances.map((row) => {
                const participant = participants.find((item) => item.person_id === row.person_id);
                return (
                  <tr key={row.key} className="border-b border-border-subtle last:border-b-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium text-foreground">
                      {row.name}
                    </th>
                    <td className="py-2.5">
                      {readOnly ? (
                        <span className="block text-center tabular text-muted-foreground">{row.weight}</span>
                      ) : (
                        <div className="flex items-center justify-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Diminuir peso de ${row.name}`}
                            disabled={row.weight <= 0}
                            onClick={() => changeWeight(row.person_id ?? "owner", row.weight - 1)}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-5 text-center tabular text-foreground" aria-live="polite">
                            {row.weight}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Aumentar peso de ${row.name}`}
                            disabled={row.weight >= 20}
                            onClick={() => changeWeight(row.person_id ?? "owner", row.weight + 1)}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular text-foreground">{formatMoney(row.paid)}</td>
                    <td className="py-2.5 text-right tabular text-muted-foreground">{formatMoney(row.share)}</td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-medium tabular",
                        row.balance > 0 ? "text-success" : row.balance < 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {formatSignedMoney(row.balance)}
                    </td>
                    {!readOnly && (
                      <td className="py-2.5 pl-1 text-right">
                        {participant && (
                          <ConfirmationDialog
                            title="Remover participante"
                            description={`${row.name} sai do evento junto com os gastos que pagou nele.`}
                            confirmText="Remover"
                            variant="destructive"
                            onConfirm={async () => {
                              try {
                                await onRemove(participant.id);
                              } catch (err) {
                                notifyPlanningError("Não foi possível remover", err);
                              }
                            }}
                          >
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Remover ${row.name}`}
                              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                            >
                              <Trash2 aria-hidden />
                            </Button>
                          </ConfirmationDialog>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="mt-4 flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row">
            <Select value={personId} onValueChange={setPersonId} disabled={available.length === 0}>
              <SelectTrigger aria-label="Pessoa para adicionar" className="sm:flex-1">
                <SelectValue placeholder={available.length === 0 ? "Todas as pessoas já participam" : "Adicionar participante"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={add} disabled={!personId || adding}>
              <UserPlus aria-hidden />
              {adding ? "Adicionando…" : "Adicionar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EntriesCard({
  entries,
  readOnly,
  defaultDate,
  onAdd,
  onDelete,
}: {
  entries: Array<{ id: string; paid_by_person_id: string; payer_name: string; description: string; value: number; entry_date: string }>;
  readOnly: boolean;
  defaultDate: string;
  onAdd: (values: { personId: string; description: string; value: number; date: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { people } = usePeople();
  const [personId, setPersonId] = useState("");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState<number | null>(null);
  const [date, setDate] = useState(defaultDate);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!personId) return setError("Escolha quem pagou.");
    if (!description.trim()) return setError("Descreva o gasto.");
    if (!value || value <= 0) return setError("Informe o valor.");
    if (!date) return setError("Informe a data.");
    setError(null);
    setSaving(true);
    try {
      await onAdd({ personId, description: description.trim(), value, date });
      notifyPlanningSuccess("Gasto registrado", description.trim());
      setDescription("");
      setValue(null);
    } catch (err) {
      notifyPlanningError("Não foi possível registrar o gasto", err);
    } finally {
      setSaving(false);
    }
  };

  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Pagos por outros"
          description={entries.length > 0 ? `${formatMoney(total)} adiantados por participantes.` : "O Airbnb que o João pagou, o mercado da Ana."}
        />
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length > 0 && (
          <ul className="divide-y divide-border-subtle">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                <span className="w-11 shrink-0 text-xs font-medium tabular text-muted-foreground">{formatDayMonth(entry.entry_date)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground" title={entry.description}>
                    {entry.description}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">Pago por {entry.payer_name}</span>
                </span>
                <span className="shrink-0 text-sm tabular text-foreground">{formatMoney(entry.value)}</span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Excluir ${entry.description}`}
                    className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                    onClick={async () => {
                      try {
                        await onDelete(entry.id);
                      } catch (err) {
                        notifyPlanningError("Não foi possível excluir", err);
                      }
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <form onSubmit={submit} noValidate className={cn("space-y-3", entries.length > 0 && "border-t border-border-subtle pt-4")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="entry-payer">Quem pagou</Label>
                <Select value={personId} onValueChange={setPersonId}>
                  <SelectTrigger id="entry-payer">
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people ?? []).map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-date">Data</Label>
                <Input id="entry-date" type="date" value={date} min="2000-01-01" max="2100-12-31" onChange={(event) => setDate(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="entry-description">Gasto</Label>
                <Input
                  id="entry-description"
                  value={description}
                  maxLength={140}
                  autoComplete="off"
                  placeholder="Airbnb…"
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="entry-value">Valor</Label>
                <NumericInput id="entry-value" currency inputMode="decimal" value={value} onChange={setValue} placeholder="R$ 0,00" />
              </div>
            </div>
            {error && (
              <p className="text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="outline" className="w-full" disabled={saving}>
              <Plus aria-hidden />
              {saving ? "Registrando…" : "Registrar gasto pago por outro"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionsCard({
  transactions,
  readOnly,
  onDetach,
}: {
  transactions: Array<{ id: string; description: string; value: number; date: string; type: string; status: string; category_name: string | null }>;
  readOnly: boolean;
  onDetach: (id: string) => Promise<void>;
}) {
  const expenses = transactions.filter((transaction) => transaction.type === "expense");
  const pending = expenses.filter((transaction) => transaction.status === "PENDING").length;

  return (
    <Card>
      <CardHeader>
        <SectionHeader
          title="Seus lançamentos no evento"
          description={
            expenses.length > 0
              ? `${plural(expenses.length, "gasto", "gastos")}${pending > 0 ? ` · ${plural(pending, "pendente", "pendentes")}` : ""}.`
              : "No Extrato, escolha este evento ao lançar o gasto."
          }
        />
      </CardHeader>
      <CardContent>
        {expenses.length === 0 ? (
          <Button variant="outline" asChild className="w-full">
            <Link to="/sistema/statement?new=1">
              <Plus aria-hidden />
              Lançar gasto no extrato
            </Link>
          </Button>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {expenses.map((transaction) => {
              const badge = STATUS_BADGE[transaction.status];
              return (
                <li key={transaction.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="w-11 shrink-0 text-xs font-medium tabular text-muted-foreground">{formatDayMonth(transaction.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground" title={transaction.description}>
                      {transaction.description}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {badge && <Badge variant={badge.variant} className="px-1.5 py-0 text-2xs">{badge.label}</Badge>}
                      <span className="truncate">{transaction.category_name ?? "Sem categoria"}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm tabular text-foreground">{formatMoney(transaction.value)}</span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Tirar ${transaction.description} do evento`}
                      title="Tirar do evento (continua no extrato)"
                      onClick={async () => {
                        try {
                          await onDetach(transaction.id);
                        } catch (err) {
                          notifyPlanningError("Não foi possível desvincular", err);
                        }
                      }}
                    >
                      <Unlink aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
