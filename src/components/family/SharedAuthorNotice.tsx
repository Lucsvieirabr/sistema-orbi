import { useFamilyGroup } from "@/hooks/use-family-group";

/**
 * Aviso discreto no modal de edição quando a transação é do parceiro:
 * "Criado por Ana". A edição é permitida (Plano Casal), mas conta, cartão,
 * rateio e vínculos ficam com quem lançou — o banco garante, aqui só avisa.
 */
export function SharedAuthorNotice({ ownerId }: { ownerId?: string | null }) {
  const { authorOf } = useFamilyGroup();
  const author = authorOf(ownerId);
  if (!author || author.isSelf) return null;

  return (
    <p
      role="note"
      className="flex items-start gap-2 rounded-lg bg-chart-6/[0.07] px-2.5 py-2 text-xs text-muted-foreground ring-1 ring-inset ring-chart-6/15"
    >
      <span
        aria-hidden
        className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-chart-6 text-[0.625rem] font-semibold text-background"
      >
        {author.initial}
      </span>
      <span className="text-pretty">
        Criado por <span className="font-medium text-foreground">{author.name}</span>. Você pode ajustar descrição,
        valor, data, categoria, status e quem pagou — conta, cartão e rateio ficam com quem lançou.
      </span>
    </p>
  );
}
