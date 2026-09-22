import { useEffect, useMemo, useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";

import { formatMoney } from "@/components/planning/planning-utils";
import { notifyPlanningError, notifyPlanningSuccess } from "@/components/planning/notify";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import type { LedgerTransfer } from "@/hooks/use-ledgers";
import { buildPixPayload, isValidPixKey, normalizePixKey } from "@/lib/pix";

const KIND_HINT: Record<string, string> = {
  email: "Chave de e-mail",
  cpf: "Chave CPF",
  cnpj: "Chave CNPJ",
  phone: "Chave de celular",
  evp: "Chave aleatória",
  unknown: "Celular com +55, e-mail, CPF, CNPJ ou chave aleatória",
};

/**
 * PIX Copia e Cola de uma transferência do fechamento. O código é gerado no
 * navegador (BR Code estático com valor). Quando quem recebe é o dono do
 * evento, a chave pode ser salva no próprio evento para os próximos acertos.
 */
export function PixDialog({
  transfer,
  ledgerName,
  ownerPixKey,
  ownerPixName,
  canSaveOwnerPix,
  onClose,
  onSaveOwnerPix,
}: {
  transfer: LedgerTransfer | null;
  ledgerName: string;
  ownerPixKey: string | null;
  ownerPixName: string | null;
  canSaveOwnerPix: boolean;
  onClose: () => void;
  onSaveOwnerPix: (key: string | null, name: string | null) => Promise<void>;
}) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const toOwner = transfer?.to_key === "owner";

  useEffect(() => {
    if (!transfer) return;
    setCopied(false);
    if (transfer.to_key === "owner") {
      setKey(ownerPixKey ?? "");
      setName(ownerPixName ?? "");
    } else {
      setKey(transfer.to_pix ?? "");
      setName(transfer.to_name);
    }
  }, [transfer, ownerPixKey, ownerPixName]);

  const normalized = normalizePixKey(key);
  const keyIsValid = !key.trim() || isValidPixKey(key);
  const payload = useMemo(() => {
    if (!transfer || !normalized.key || !keyIsValid) return "";
    try {
      return buildPixPayload({
        key: normalized.key,
        name: name || transfer.to_name,
        amount: transfer.amount,
        description: ledgerName,
      });
    } catch {
      return "";
    }
  }, [transfer, normalized.key, keyIsValid, name, ledgerName]);

  const copy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const keyChanged = toOwner && (key.trim() !== (ownerPixKey ?? "") || name.trim() !== (ownerPixName ?? ""));

  const save = async () => {
    setSaving(true);
    try {
      await onSaveOwnerPix(key.trim() || null, name.trim() || null);
      notifyPlanningSuccess("Chave PIX salva no evento");
    } catch (err) {
      notifyPlanningError("Não foi possível salvar a chave", err);
    } finally {
      setSaving(false);
    }
  };

  const payer = transfer?.from_key === "owner" ? "Você" : transfer?.from_name;
  const receiver = toOwner ? "você" : transfer?.to_name;

  return (
    <Dialog open={transfer !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-muted-foreground" aria-hidden />
            PIX Copia e Cola
          </DialogTitle>
          <DialogDescription>
            {payer} deve{" "}
            <span className="font-medium tabular text-foreground">{formatMoney(transfer?.amount ?? 0)}</span> para {receiver}. Um
            único código no lugar de cada gasto miúdo.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor="pix-key">Chave PIX de {toOwner ? "recebimento" : receiver}</Label>
              <Input
                id="pix-key"
                value={key}
                maxLength={77}
                autoComplete="off"
                spellCheck={false}
                placeholder="+5511999998888, e-mail ou CPF"
                onChange={(event) => setKey(event.target.value)}
                aria-describedby="pix-key-hint pix-key-error"
                aria-invalid={!keyIsValid}
              />
              <p id="pix-key-hint" className="text-xs text-muted-foreground">
                {key.trim() ? KIND_HINT[normalized.kind] : KIND_HINT.unknown}
              </p>
              {!keyIsValid && (
                <p id="pix-key-error" className="text-xs text-destructive">
                  Chave inválida. Confira o formato e os dígitos verificadores.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pix-name">Nome do recebedor</Label>
              <Input
                id="pix-name"
                value={name}
                maxLength={25}
                autoComplete="off"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pix-payload">Código</Label>
            <Textarea
              id="pix-payload"
              readOnly
              value={payload}
              rows={4}
              placeholder="Informe a chave para gerar o código."
              className="resize-none break-all font-mono text-xs md:text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          {toOwner && canSaveOwnerPix && (
            <Button variant="ghost" onClick={save} disabled={!keyChanged || saving || !keyIsValid} className="sm:mr-auto">
              {saving ? "Salvando…" : "Salvar chave no evento"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={copy} disabled={!payload}>
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            <span aria-live="polite">{copied ? "Copiado" : "Copiar código"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
