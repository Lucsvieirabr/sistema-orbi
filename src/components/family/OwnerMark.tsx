import { AuthorTag } from "@/components/family/AuthorTag";
import { useSpace } from "@/hooks/use-space";

/**
 * Avatar de dono para contas, cartões e demais cadastros no Nosso espaço.
 * Fora dele (ou sem vínculo) não renderiza — Meu espaço fica limpo.
 */
export function OwnerMark({ userId, className }: { userId?: string | null; className?: string }) {
  const { isWeSpace, authorOf } = useSpace();
  if (!isWeSpace) return null;
  const author = authorOf(userId);
  return author ? <AuthorTag author={author} compact className={className} /> : null;
}
