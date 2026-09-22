import type { FamilyAuthor } from "@/hooks/use-family-group";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

/**
 * Avatar de uma pessoa do casal: foto → iniciais do apelido → glifo.
 * Parceiro no tom de identidade (chart-6), você no navy do Orbi.
 */
export function AuthorAvatar({ author, className }: { author: FamilyAuthor; className?: string }) {
  return (
    <UserAvatar
      name={author.initials ? author.name : null}
      avatarPath={author.avatarPath}
      tone={author.isSelf ? "self" : "partner"}
      className={className}
    />
  );
}

interface AuthorTagProps {
  author: FamilyAuthor;
  className?: string;
  /** Só o avatar (contas, cartões, cabeçalhos apertados). */
  compact?: boolean;
}

/**
 * Plano Casal — selo "quem lançou" de uma transação.
 *
 * Avatar de inicial + primeiro nome. Discreto por padrão: o próprio usuário
 * aparece neutro ("Você"); o parceiro ganha o tom de identidade (chart-6),
 * que é o que o olho precisa achar ao varrer o extrato do casal.
 * Presentacional: quem decide exibir (modo Casal ativo) é a lista.
 */
export function AuthorTag({ author, className, compact = false }: AuthorTagProps) {
  const label = author.isSelf ? "Você" : author.name;

  if (compact) {
    return (
      <span title={author.isSelf ? "Seu" : `De ${author.name}`} className={cn("inline-flex shrink-0", className)}>
        <AuthorAvatar author={author} className="h-5 w-5 text-[0.5625rem] ring-2 ring-background" />
        <span className="sr-only">{author.isSelf ? "Seu" : `De ${author.name}`}</span>
      </span>
    );
  }

  return (
    <span
      title={`Lançado por ${author.isSelf ? "você" : author.name}`}
      className={cn(
        "inline-flex max-w-[8.5rem] shrink-0 items-center gap-1 rounded-full py-px pl-px pr-1.5 text-2xs font-medium leading-4 ring-1 ring-inset",
        author.isSelf
          ? "bg-muted/60 text-muted-foreground ring-border-subtle"
          : "bg-chart-6/10 text-chart-6 ring-chart-6/20",
        className,
      )}
    >
      <AuthorAvatar author={author} className="h-4 w-4 text-[0.5rem]" />
      <span className="sr-only">Lançado por </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
