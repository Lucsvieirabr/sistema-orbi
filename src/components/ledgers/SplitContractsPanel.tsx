import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, RotateCw, Split, Trash2 } from "lucide-react";

import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { describePlanningError, formatPct } from "@/components/planning/planning-utils";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCategories } from "@/hooks/use-categories";
import { usePeople } from "@/hooks/use-people";
import { useSplitContracts, type SplitContract, type SplitContractInput } from "@/hooks/use-split-contracts";
import { cn } from "@/lib/utils";

/** Presets na leitura "você / pessoa" — o banco guarda a parte da pessoa. */
const PRESETS = [
  { label: "50/50", person: 50 },
  { label: "60/40", person: 40 },
  { label: "70/30", person: 30 },
  { label: "40/60", person: 60 },
];

export type ContractEditorState = { mode: "create" } | { mode: "edit"; contract: SplitContract };

export function SplitContractsPanel({
  editor,
  onEditorChange,
}: {
  editor: ContractEditorState | null;
  onEditorChange: (state: ContractEditorState | null) => void;
}) {
  const { contracts, isLoading, error, refetch, createContract, updateContract, toggleContract, deleteContract } =
    useSplitContracts();

  const grouped = useMemo(() => {
    const map = new Map<string, { personName: string; rows: SplitContract[] }>();
    contracts.forEach((contract) => {
      const entry = map.get(contract.person_id) ?? { personName: contract.person_name, rows: [] };
      entry.rows.push(contract);
      map.set(contract.person_id, entry);
    });
    return [...map.entries()]
      .map(([personId, value]) => ({ personId, ...value }))
      .sort((a, b) => a.personName.localeCompare(b.personName, "pt-BR"));
  }, [contracts]);

  const handleToggle = async (contract: SplitContract, active: boolean) => {
    try {
      await toggleContract(contract.id, active);
    } catch (err) {
      notifyPlanningError("Não foi possível alterar o contrato", err);
    }
  };

  const handleDelete = async (contract: SplitContract) => {
    try {
      await deleteContract(contract.id);
      notifyPlanningSuccess("Contrato excluído", "Os lançamentos já feitos não mudam.");
    } catch (err) {
      notifyPlanningError("Não foi possível excluir", err);
    }
  };

  return (
    <>
      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : error ? (
        <EmptyState
          icon={Split}
          title="Não deu para carregar os contratos"
          description={describePlanningError(error).message}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              <RotateCw aria-hidden />
              Tentar de novo
            </Button>
          }
        />
      ) : contracts.length === 0 ? (
        <EmptyState
          icon={Split}
          title="Nenhum contrato de rateio"
          description="Combine uma vez: “Pets é 50/50 com a Ana”. No lançamento, o valor a compensar já vem preenchido."
          action={<Button onClick={() => onEditorChange({ mode: "create" })}>Criar primeiro contrato</Button>}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((group, groupIndex) => (
            <section
              key={group.personId}
              aria-labelledby={`contracts-${group.personId}`}
              className="animate-rise overflow-hidden rounded-xl border border-border bg-card"
              style={{ animationDelay: `${Math.min(groupIndex, 6) * 45}ms` }}
            >
              <header className="flex items-baseline justify-between gap-3 border-b border-border-subtle px-4 py-3 md:px-5">
                <h3 id={`contracts-${group.personId}`} className="font-display text-sm font-semibold text-foreground">
                  Com {group.personName}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {group.rows.length} {group.rows.length === 1 ? "categoria" : "categorias"}
                </span>
              </header>
              <ul className="divide-y divide-border-subtle">
                {group.rows.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    onToggle={(active) => handleToggle(contract, active)}
                    onEdit={() => onEditorChange({ mode: "edit", contract })}
                    onDelete={() => handleDelete(contract)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ContractEditor
        state={editor}
        contracts={contracts}
        onClose={() => onEditorChange(null)}
        onCreate={createContract}
        onUpdate={updateContract}
      />
    </>
  );
}

function ContractRow({
  contract,
  onToggle,
  onEdit,
  onDelete,
}: {
  contract: SplitContract;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const person = contract.proportion_percentage;
  const mine = Math.round((100 - person) * 100) / 100;
  const switchId = `contract-active-${contract.id}`;

  return (
    <li className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 md:flex-nowrap md:px-5", !contract.is_active && "bg-surface-sunken/60")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-sunken">
          <IconRenderer iconName={contract.category_icon ?? "tag"} className="h-4 w-4 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-medium", contract.is_active ? "text-foreground" : "text-muted-foreground")}>
            {contract.category_name}
          </p>
          {contract.note && <p className="truncate text-xs text-muted-foreground">{contract.note}</p>}
        </div>
      </div>

      <div className="order-last w-full md:order-none md:w-56">
        <div className="flex items-baseline justify-between text-xs tabular">
          <span className="text-muted-foreground">
            Você <span className="font-medium text-foreground">{formatPct(mine, { digits: mine % 1 === 0 ? 0 : 1 })}</span>
          </span>
          <span className="text-muted-foreground">
            {contract.person_name}{" "}
            <span className="font-medium text-foreground">{formatPct(person, { digits: person % 1 === 0 ? 0 : 1 })}</span>
          </span>
        </div>
        <div
          role="img"
          aria-label={`Você paga ${mine}% e ${contract.person_name} compensa ${person}%`}
          className="mt-1.5 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full"
        >
          <span className="h-full rounded-full bg-primary transition-[flex-grow] duration-300 ease-swift" style={{ flexGrow: mine }} />
          <span className="h-full rounded-full bg-chart-3 transition-[flex-grow] duration-300 ease-swift" style={{ flexGrow: person }} />
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Switch
          id={switchId}
          checked={contract.is_active}
          onCheckedChange={onToggle}
          aria-label={`${contract.is_active ? "Pausar" : "Ativar"} contrato de ${contract.category_name}`}
          className="mr-2"
        />
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Editar contrato de ${contract.category_name}`}>
          <Pencil aria-hidden />
        </Button>
        <ConfirmationDialog
          title="Excluir contrato"
          description={`O rateio de ${contract.category_name} com ${contract.person_name} deixa de ser sugerido. Lançamentos já feitos não mudam.`}
          confirmText="Excluir contrato"
          variant="destructive"
          onConfirm={onDelete}
        >
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Excluir contrato de ${contract.category_name}`}
            className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </Button>
        </ConfirmationDialog>
      </div>
    </li>
  );
}

function ContractEditor({
  state,
  contracts,
  onClose,
  onCreate,
  onUpdate,
}: {
  state: ContractEditorState | null;
  contracts: SplitContract[];
  onClose: () => void;
  onCreate: (input: SplitContractInput) => Promise<void>;
  onUpdate: (id: string, input: SplitContractInput) => Promise<void>;
}) {
  const { people } = usePeople();
  const { categories } = useCategories();
  const [personId, setPersonId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [personPct, setPersonPct] = useState("50");
  const [note, setNote] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<{ person?: string; category?: string; pct?: string }>({});
  const [saving, setSaving] = useState(false);

  const editing = state?.mode === "edit" ? state.contract : null;
  const expenseCategories = useMemo(
    () =>
      (categories ?? [])
        .filter((category: any) => category.category_type === "expense")
        .sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR")),
    [categories],
  );

  useEffect(() => {
    if (!state) return;
    setErrors({});
    if (state.mode === "edit") {
      setPersonId(state.contract.person_id);
      setCategoryId(state.contract.category_id);
      setPersonPct(String(state.contract.proportion_percentage));
      setNote(state.contract.note ?? "");
      setActive(state.contract.is_active);
    } else {
      setPersonId(people?.length === 1 ? people[0].id : "");
      setCategoryId("");
      setPersonPct("50");
      setNote("");
      setActive(true);
    }
  }, [state, people]);

  const pct = Number(String(personPct).replace(",", "."));
  const validPct = Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const mine = validPct ? Math.round((100 - pct) * 100) / 100 : null;
  const duplicate = contracts.find(
    (contract) => contract.person_id === personId && contract.category_id === categoryId && contract.id !== editing?.id,
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!personId) next.person = "Escolha com quem a despesa é dividida.";
    if (!categoryId) next.category = "Escolha a categoria de gasto.";
    else if (duplicate) next.category = "Já existe um contrato para essa pessoa nesta categoria.";
    if (!validPct) next.pct = "Use um percentual de 0 a 100.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: SplitContractInput = {
      personId,
      categoryId,
      percentage: pct,
      note: note.trim() || null,
      isActive: active,
    };
    setSaving(true);
    try {
      if (editing) {
        await onUpdate(editing.id, input);
        notifyPlanningSuccess("Contrato atualizado");
      } else {
        await onCreate(input);
        notifyPlanningSuccess("Contrato criado", "O próximo lançamento dessa categoria já vem com a compensação.");
      }
      onClose();
    } catch (err) {
      notifyPlanningError(editing ? "Não foi possível salvar o contrato" : "Não foi possível criar o contrato", err);
    } finally {
      setSaving(false);
    }
  };

  const personName = people?.find((person) => person.id === personId)?.name ?? null;

  return (
    <Dialog open={state !== null} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar contrato de rateio" : "Novo contrato de rateio"}</DialogTitle>
            <DialogDescription>
              A regra vira sugestão no lançamento. Você sempre pode mudar o valor antes de salvar.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contract-person">Dividir com</Label>
                <Select
                  value={personId}
                  onValueChange={(value) => {
                    setPersonId(value);
                    setErrors((prev) => ({ ...prev, person: undefined }));
                  }}
                >
                  <SelectTrigger id="contract-person" aria-invalid={Boolean(errors.person)}>
                    <SelectValue placeholder="Escolha a pessoa" />
                  </SelectTrigger>
                  <SelectContent>
                    {(people ?? []).map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.person ? (
                  <p className="text-xs text-destructive">{errors.person}</p>
                ) : (
                  (people ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">Cadastre a pessoa em Organização → Pessoas.</p>
                  )
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-category">Categoria de gasto</Label>
                <Select
                  value={categoryId}
                  onValueChange={(value) => {
                    setCategoryId(value);
                    setErrors((prev) => ({ ...prev, category: undefined }));
                  }}
                >
                  <SelectTrigger id="contract-category" aria-invalid={Boolean(errors.category)}>
                    <SelectValue placeholder="Escolha a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
              </div>
            </div>

            <fieldset className="space-y-2.5">
              <legend className="text-sm font-medium leading-none text-foreground">Proporção (você / {personName ?? "pessoa"})</legend>
              <ToggleGroup
                type="single"
                value={PRESETS.find((preset) => preset.person === pct)?.label ?? ""}
                onValueChange={(value) => {
                  const preset = PRESETS.find((item) => item.label === value);
                  if (preset) {
                    setPersonPct(String(preset.person));
                    setErrors((prev) => ({ ...prev, pct: undefined }));
                  }
                }}
                aria-label="Proporções prontas"
                className="grid grid-cols-4 gap-1 rounded-xl border border-border-subtle bg-surface-sunken p-1"
              >
                {PRESETS.map((preset) => (
                  <ToggleGroupItem
                    key={preset.label}
                    value={preset.label}
                    className="h-10 rounded-lg border border-transparent tabular data-[state=on]:border-border md:h-8"
                  >
                    {preset.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="contract-pct" className="text-xs font-normal text-muted-foreground">
                    {personName ? `Parte de ${personName}` : "Parte da pessoa"} (%)
                  </Label>
                  <Input
                    id="contract-pct"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="0.01"
                    value={personPct}
                    onChange={(event) => {
                      setPersonPct(event.target.value);
                      setErrors((prev) => ({ ...prev, pct: undefined }));
                    }}
                    aria-invalid={Boolean(errors.pct)}
                    aria-describedby="contract-pct-read"
                    className="tabular"
                  />
                </div>
                <p id="contract-pct-read" className="pb-2.5 text-sm tabular text-muted-foreground" aria-live="polite">
                  Você fica com <span className="font-medium text-foreground">{mine === null ? "—" : `${mine}%`}</span>
                </p>
              </div>
              {errors.pct && <p className="text-xs text-destructive">{errors.pct}</p>}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="contract-note">
                Observação <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="contract-note"
                value={note}
                maxLength={140}
                autoComplete="off"
                placeholder="Ração, veterinário e banho…"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-sunken px-3.5 py-3">
              <Label htmlFor="contract-active" className="cursor-pointer">
                <span className="block text-sm font-medium text-foreground">Contrato ativo</span>
                <span className="block text-xs font-normal text-muted-foreground">Pausado, ele não pré-preenche o lançamento.</span>
              </Label>
              <Switch id="contract-active" checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar contrato" : "Criar contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
