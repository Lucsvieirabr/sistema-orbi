import { useId, useState, type FormEvent } from "react";
import { Loader2, RotateCw, Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useToast } from "@/hooks/use-toast";
import { useFeature } from "@/hooks/use-feature";
import { useFamilyGroup, type FamilyMember } from "@/hooks/use-family-group";
import { cn } from "@/lib/utils";

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

type InviteState = "active" | "pending" | "expired" | "unsent";

function inviteState(member: FamilyMember): InviteState {
  if (member.status === "active") return "active";
  if (!member.invite_sent_at || !member.invite_expires_at) return "unsent";
  return new Date(member.invite_expires_at).getTime() < Date.now() ? "expired" : "pending";
}

function inviteNote(member: FamilyMember, state: InviteState): string {
  switch (state) {
    case "active":
      return "Vocês compartilham o Nosso espaço.";
    case "unsent":
      return "Envie o convite por e-mail para liberar o aceite.";
    case "expired":
      return "O link expirou. Reenvie para gerar um novo.";
    default:
      return `Enviado em ${shortDate.format(new Date(member.invite_sent_at!))} · vale até ${shortDate.format(new Date(member.invite_expires_at!))}`;
  }
}

/**
 * Status do convite. "Pendente" pulsa em âmbar: do outro lado há uma decisão
 * em aberto. Ativo e expirado ficam parados — não há mais nada acontecendo.
 */
function InviteChip({ state }: { state: InviteState }) {
  if (state === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-2xs font-medium text-success ring-1 ring-inset ring-success/20">
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
        Ativo
      </span>
    );
  }

  if (state === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground ring-1 ring-inset ring-border">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
        Expirado
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2 py-0.5 text-2xs font-medium text-warning ring-1 ring-inset ring-warning/25">
      <span className="relative grid h-1.5 w-1.5 place-items-center" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-warning motion-safe:animate-beacon" />
        <span className="relative h-1.5 w-1.5 rounded-full bg-warning" />
      </span>
      Pendente
    </span>
  );
}

/**
 * Plano Casal — bloco único dentro de Configurações.
 * Criar grupo → convidar por e-mail → a pessoa aceita no link (/invite/accept).
 * Até o aceite nada é compartilhado; o convite fica "Pendente".
 */
export function FamilyGroupSettings() {
  const { toast } = useToast();
  const fieldId = useId();
  const { hasFeature, isLoading: featureLoading } = useFeature("familia_compartilhada");
  const { groupId, isOwner, members, directory, isLoading, createGroup, invitePartner, removePartner } =
    useFamilyGroup();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (featureLoading || isLoading) {
    return null;
  }

  const fail = (e: unknown, fallback: string) =>
    toast({
      title: "Não foi possível concluir",
      description: (e instanceof Error && e.message) || fallback,
      variant: "destructive",
    });

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const handleCreate = () =>
    run("create", async () => {
      try {
        await createGroup();
        toast({ title: "Plano Casal criado", description: "Agora convide a pessoa que vai dividir o Orbi com você." });
      } catch (e) {
        fail(e, "Não foi possível criar o Plano Casal.");
      }
    });

  const sendInvite = (target: string, key: string) =>
    run(key, async () => {
      try {
        const delivered = await invitePartner(target);
        if (delivered) {
          setEmail("");
          toast({
            title: "Convite enviado",
            description: `Enviamos o link para ${target}. O acesso só é liberado depois do aceite.`,
          });
        } else {
          toast({
            title: "Convite salvo, e-mail não enviado",
            description: "Tente “Reenviar” em alguns instantes.",
            variant: "destructive",
          });
        }
      } catch (e) {
        fail(e, "Não foi possível enviar o convite.");
      }
    });

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const value = email.trim();
    if (!isValidEmail(value)) {
      setEmailError("Informe um e-mail válido, como nome@email.com.");
      return;
    }
    setEmailError(null);
    void sendInvite(value, "invite");
  };

  const handleRemove = (member: FamilyMember) =>
    run(`remove:${member.id}`, async () => {
      try {
        await removePartner(member.id);
        toast(
          member.status === "active"
            ? { title: "Parceiro removido", description: "O acesso compartilhado foi revogado." }
            : { title: "Convite cancelado", description: "O link enviado deixou de funcionar." },
        );
      } catch (e) {
        fail(e, "Não foi possível remover.");
      }
    });

  const partner = directory.find((person) => !person.isSelf) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plano Casal</CardTitle>
        <CardDescription>
          Uma assinatura, dois acessos. Quem aceita o convite vê contas, cartões e lançamentos no Nosso espaço.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasFeature ? (
          <p className="text-sm text-muted-foreground">
            Disponível no Plano Casal. Faça upgrade para compartilhar suas finanças com outra pessoa.
          </p>
        ) : !groupId ? (
          <Button onClick={handleCreate} disabled={busy !== null}>
            {busy === "create" && <Loader2 className="animate-spin" aria-hidden />}
            Criar Plano Casal
          </Button>
        ) : !isOwner ? (
          <p className="text-sm text-muted-foreground">
            Você faz parte de um Plano Casal. Alterne entre <strong>Meu espaço</strong> e{" "}
            <strong>Nosso espaço</strong> no topo da tela.
          </p>
        ) : (
          <div className="space-y-4">
            {members.length === 0 && (
              <form onSubmit={handleInvite} noValidate className="max-w-md space-y-2">
                <Label htmlFor={fieldId}>E-mail de quem você quer convidar</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id={fieldId}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="nome@email.com…"
                    value={email}
                    aria-invalid={emailError ? true : undefined}
                    aria-describedby={`${fieldId}-hint`}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    disabled={busy !== null}
                  />
                  <Button type="submit" disabled={busy !== null} className="sm:w-auto">
                    {busy === "invite" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                    {busy === "invite" ? "Enviando…" : "Convidar"}
                  </Button>
                </div>
                <p
                  id={`${fieldId}-hint`}
                  className={cn("text-xs", emailError ? "text-destructive" : "text-muted-foreground")}
                  aria-live="polite"
                >
                  {emailError ??
                    "A pessoa recebe um link por e-mail. Nada é compartilhado até ela aceitar com a conta do Orbi desse e-mail."}
                </p>
              </form>
            )}

            <ul className="space-y-2">
              {members.map((member) => {
                const state = inviteState(member);
                const isActive = state === "active";
                const removing = busy === `remove:${member.id}`;
                const resending = busy === `resend:${member.id}`;

                return (
                  <li key={member.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <UserAvatar
                      name={isActive ? partner?.name : null}
                      avatarPath={isActive ? partner?.avatarPath : null}
                      tone="partner"
                      className={cn("h-9 w-9 text-xs", !isActive && "bg-muted text-muted-foreground")}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-sm font-medium" translate="no">
                          {isActive && partner ? partner.name : member.email}
                        </p>
                        <InviteChip state={state} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {isActive && partner ? `${member.email} · ` : ""}
                        {inviteNote(member, state)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void sendInvite(member.email, `resend:${member.id}`)}
                          disabled={busy !== null}
                        >
                          {resending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCw aria-hidden />}
                          <span className="hidden sm:inline">{state === "unsent" ? "Enviar" : "Reenviar"}</span>
                          <span className="sr-only sm:hidden">Reenviar convite para {member.email}</span>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleRemove(member)}
                        disabled={busy !== null}
                        aria-label={isActive ? `Remover ${member.email}` : `Cancelar convite para ${member.email}`}
                      >
                        {removing ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 className="text-destructive" aria-hidden />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
