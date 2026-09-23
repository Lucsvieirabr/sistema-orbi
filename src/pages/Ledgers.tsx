import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarRange, Plus, Receipt, RotateCw, Split, Users } from "lucide-react";

import { LedgerDetail } from "@/components/ledgers/LedgerDetail";
import { SplitContractsPanel, type ContractEditorState } from "@/components/ledgers/SplitContractsPanel";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { describePlanningError, formatDateMedium, plural } from "@/components/planning/planning-utils";
import { PartnerBadge } from "@/components/family/PartnerBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
import { EmptyState, PageBody, PageHeader, SectionHeader } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { useLedger, useLedgers, type Ledger, type LedgerInput } from "@/hooks/use-ledgers";
import { cn, isUuid } from "@/lib/utils";

/**
 * Rateios e acertos (Pro/Casal). Gate de plano na rota (PremiumRoute).
 *
 *   ?aba=eventos     acertos de viagem (mini-ledgers)
 *   ?aba=contratos   contratos de rateio (pessoa × categoria → %)
 *   ?evento=<uuid>   fechamento de um evento
 */

type Tab = "eventos" | "contratos";
type LedgerEditorState = { mode: "create" } | { mode: "edit"; ledger: { id: string } & LedgerInput };

export default function Ledgers() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const tab: Tab = params.get("aba") === "contratos" ? "contratos" : "eventos";
  const eventParam = params.get("evento");
  const ledgerId = isUuid(eventParam) ? eventParam : null;

  const [ledgerEditor, setLedgerEditor] = useState<LedgerEditorState | null>(null);
  const [contractEditor, setContractEditor] = useState<ContractEditorState | null>(null);

  const setTab = (next: string) => {
    const nextParams = new URLSearchParams(params);
    nextParams.delete("evento");
    if (next === "contratos") nextParams.set("aba", "contratos");
    else nextParams.delete("aba");
    setParams(nextParams, { replace: true });
  };

  if (ledgerId) {
    return (
      <>
        <LedgerDetail
          ledgerId={ledgerId}
          backHref="/sistema/ledgers"
          onEdit={(ledger) => setLedgerEditor({ mode: "edit", ledger })}
          onDeleted={() => navigate("/sistema/ledgers", { replace: true })}
        />
        <LedgerEditor
          state={ledgerEditor}
          onClose={() => setLedgerEditor(null)}
          onCreated={(id) => navigate(`/sistema/ledgers?evento=${id}`)}
          editingLedgerId={ledgerId}
        />
      </>
    );
  }

  return (
    <PageBody>
      <PageHeader
        eyebrow="Planejamento"
        icon={Split}
        title="Rateios e acertos"
        description="Combine como dividir cada tipo de gasto e feche viagens com um único valor por pessoa."
        actions={
          tab === "contratos" ? (
            <Button onClick={() => setContractEditor({ mode: "create" })} className="w-full sm:w-auto">
              <Plus aria-hidden />
              Novo contrato
            </Button>
          ) : (
            <Button onClick={() => setLedgerEditor({ mode: "create" })} className="w-full sm:w-auto">
              <Plus aria-hidden />
              Novo evento
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto" aria-label="Seções de rateio">
          <TabsTrigger value="eventos" className="sm:min-w-[10rem]">
            Acertos de viagem
          </TabsTrigger>
          <TabsTrigger value="contratos" className="sm:min-w-[10rem]">
            Contratos de rateio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eventos" className="mt-5 md:mt-7">
          <LedgerList onCreate={() => setLedgerEditor({ mode: "create" })} />
        </TabsContent>
        <TabsContent value="contratos" className="mt-5 md:mt-7">
          <SplitContractsPanel editor={contractEditor} onEditorChange={setContractEditor} />
        </TabsContent>
      </Tabs>

      <LedgerEditor
        state={ledgerEditor}
        onClose={() => setLedgerEditor(null)}
        onCreated={(id) => navigate(`/sistema/ledgers?evento=${id}`)}
      />
    </PageBody>
  );
}

function LedgerList({ onCreate }: { onCreate: () => void }) {
  const { ledgers, isLoading, error, refetch } = useLedgers();
  const { isMine } = useFamilyGroup();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon={Receipt}
        title="Não deu para carregar os eventos"
        description={describePlanningError(error).message}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCw aria-hidden />
            Tentar de novo
          </Button>
        }
      />
    );
  }

  if (ledgers.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Nenhum evento ainda"
        description="Crie “Viagem Argentina”, vincule os gastos no extrato e registre o que os outros pagaram. No fim, o Orbi diz quem deve quanto para quem."
        action={
          <Button onClick={onCreate}>
            <Plus aria-hidden />
            Criar primeiro evento
          </Button>
        }
      />
    );
  }

  const open = ledgers.filter((ledger) => ledger.status === "open");
  const settled = ledgers.filter((ledger) => ledger.status === "settled");

  return (
    <div className="space-y-7">
      {open.length > 0 && (
        <section aria-labelledby="ledgers-open" className="space-y-3">
          <SectionHeader title={<span id="ledgers-open">Em aberto</span>} description={plural(open.length, "evento", "eventos")} />
          <LedgerGrid ledgers={open} isMine={isMine} />
        </section>
      )}
      {settled.length > 0 && (
        <section aria-labelledby="ledgers-settled" className="space-y-3">
          <SectionHeader title={<span id="ledgers-settled">Liquidados</span>} description={plural(settled.length, "evento", "eventos")} />
          <LedgerGrid ledgers={settled} isMine={isMine} />
        </section>
      )}
    </div>
  );
}

function LedgerGrid({ ledgers, isMine }: { ledgers: Ledger[]; isMine: (id?: string | null) => boolean }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {ledgers.map((ledger, index) => {
        const settled = ledger.status === "settled";
        return (
          <li key={ledger.id} className="flex animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
            <Card interactive className="relative isolate flex w-full flex-col overflow-hidden">
              <span
                aria-hidden
                className={cn("pointer-events-none absolute inset-x-0 top-0 h-0.5", settled ? "bg-success" : "bg-primary")}
              />
              <CardHeader className="gap-0 space-y-0">
                <div className="flex items-start justify-between gap-3">
                  <h3
                    className="min-w-0 truncate font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground"
                    title={ledger.name}
                  >
                    {ledger.name}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!isMine(ledger.user_id) && <PartnerBadge userId={ledger.user_id} />}
                    <Badge variant={settled ? "success" : "outline"}>{settled ? "Liquidado" : "Em aberto"}</Badge>
                  </div>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarRange className="h-3 w-3" aria-hidden />
                  {ledger.start_date
                    ? ledger.end_date
                      ? `${formatDateMedium(ledger.start_date)} a ${formatDateMedium(ledger.end_date)}`
                      : `Desde ${formatDateMedium(ledger.start_date)}`
                    : "Sem datas"}
                </p>
              </CardHeader>
              <CardContent className="mt-auto">
                {ledger.description && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{ledger.description}</p>}
                <dl className="grid grid-cols-3 divide-x divide-border-subtle rounded-lg border border-border-subtle">
                  <div className="px-3 py-2">
                    <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">Seus</dt>
                    <dd className="figure-sm mt-0.5 tabular text-foreground">{ledger.transactions_count}</dd>
                  </div>
                  <div className="px-3 py-2">
                    <dt className="text-2xs uppercase tracking-eyebrow text-muted-foreground">Terceiros</dt>
                    <dd className="figure-sm mt-0.5 tabular text-foreground">{ledger.entries_count}</dd>
                  </div>
                  <div className="px-3 py-2">
                    <dt className="flex items-center gap-1 text-2xs uppercase tracking-eyebrow text-muted-foreground">
                      <Users className="h-2.5 w-2.5" aria-hidden />
                      Pessoas
                    </dt>
                    <dd className="figure-sm mt-0.5 tabular text-foreground">{ledger.participants_count + 1}</dd>
                  </div>
                </dl>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link
                    to={`/sistema/ledgers?evento=${ledger.id}`}
                    aria-label={`${settled ? "Ver fechamento" : "Abrir fechamento"} ${ledger.name}`}
                  >
                    {settled ? "Ver fechamento" : "Abrir fechamento"}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function LedgerEditor({
  state,
  onClose,
  onCreated,
  editingLedgerId = null,
}: {
  state: LedgerEditorState | null;
  onClose: () => void;
  onCreated: (id: string) => void;
  editingLedgerId?: string | null;
}) {
  const { createLedger } = useLedgers({ enabled: false });
  const { updateLedger } = useLedger(state?.mode === "edit" ? editingLedgerId : null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [errors, setErrors] = useState<{ name?: string; dates?: string }>({});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const editing = state?.mode === "edit" ? state.ledger : null;

  useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.mode === "edit") {
      setName(state.ledger.name);
      setDescription(state.ledger.description ?? "");
      setStartDate(state.ledger.startDate ?? "");
      setEndDate(state.ledger.endDate ?? "");
      setPixKey(state.ledger.pixKey ?? "");
    } else {
      setName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setPixKey("");
    }
  }, [state]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Dê um nome ao evento.";
    if (startDate && endDate && endDate < startDate) next.dates = "O fim precisa ser igual ou depois do início.";
    setErrors(next);
    if (next.name) return nameRef.current?.focus();
    if (next.dates) return;

    const input: LedgerInput = {
      name: name.trim(),
      description: description.trim() || null,
      startDate: startDate || null,
      endDate: endDate || null,
      ownerWeight: editing?.ownerWeight ?? 1,
      pixKey: pixKey.trim() || null,
      pixName: editing?.pixName ?? null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateLedger(input);
        notifyPlanningSuccess("Evento atualizado");
        onClose();
      } else {
        const id = await createLedger(input);
        notifyPlanningSuccess("Evento criado", "Adicione os participantes e vincule os gastos no extrato.");
        onClose();
        onCreated(id);
      }
    } catch (err) {
      notifyPlanningError(editing ? "Não foi possível salvar o evento" : "Não foi possível criar o evento", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={state !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar evento" : "Novo evento"}</DialogTitle>
            <DialogDescription>Uma viagem, uma festa, uma obra: tudo que várias pessoas pagam e depois acertam.</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ledger-name">Nome</Label>
              <Input
                id="ledger-name"
                ref={nameRef}
                value={name}
                maxLength={80}
                autoComplete="off"
                placeholder="Viagem Argentina…"
                onChange={(event) => {
                  setName(event.target.value);
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "ledger-name-error" : undefined}
              />
              {errors.name && (
                <p id="ledger-name-error" className="text-xs text-destructive">
                  {errors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ledger-start">
                  Início <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input id="ledger-start" type="date" min="2000-01-01" max="2100-12-31" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ledger-end">
                  Fim <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="ledger-end"
                  type="date"
                  min={startDate || "2000-01-01"}
                  max="2100-12-31"
                  value={endDate}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setErrors((prev) => ({ ...prev, dates: undefined }));
                  }}
                  aria-invalid={Boolean(errors.dates)}
                />
              </div>
            </div>
            {errors.dates && <p className="-mt-3 text-xs text-destructive">{errors.dates}</p>}

            <div className="space-y-2">
              <Label htmlFor="ledger-description">
                Descrição <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="ledger-description"
                value={description}
                maxLength={280}
                autoComplete="off"
                placeholder="Roadtrip de van até a Tríplice Fronteira"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ledger-pix">
                Sua chave PIX <span className="font-normal text-muted-foreground">(para receber o acerto)</span>
              </Label>
              <Input
                id="ledger-pix"
                value={pixKey}
                maxLength={77}
                autoComplete="off"
                spellCheck={false}
                placeholder="+5511999998888, e-mail ou CPF"
                onChange={(event) => setPixKey(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar evento" : "Criar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
