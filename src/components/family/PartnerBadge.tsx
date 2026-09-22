import { AuthorAvatar } from "@/components/family/AuthorTag";
import { useFamilyGroup } from "@/hooks/use-family-group";
import { cn } from "@/lib/utils";

/**
 * Selo "é do parceiro" em cadastros somente-leitura (metas, orçamentos,
 * projetos, acertos): foto/iniciais + nome real no lugar do genérico "Parceiro".
 */
export function PartnerBadge({ userId, className }: { userId?: string | null; className?: string }) {
  const { authorOf, directory } = useFamilyGroup();
  const author = authorOf(userId) ?? directory.find((person) => !person.isSelf) ?? null;
  const name = author && !author.isSelf ? author.name : "Parceiro(a)";

  return (
    <span
      title={`De ${name}`}
      className={cn(
        "inline-flex max-w-[10rem] shrink-0 items-center gap-1 rounded-full py-px pl-px pr-2 text-2xs font-medium leading-4",
        "bg-chart-6/10 text-chart-6 ring-1 ring-inset ring-chart-6/20",
        !author && "pl-2",
        className,
      )}
    >
      {author && <AuthorAvatar author={author} className="h-4 w-4 text-[0.5rem]" />}
      <span className="sr-only">De </span>
      <span className="truncate">{name}</span>
    </span>
  );
}
