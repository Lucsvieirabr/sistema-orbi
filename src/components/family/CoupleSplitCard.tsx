import { Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatMoney, plural } from "@/components/planning/planning-utils";
import { useCoupleExpenseSplit } from "@/hooks/use-monthly-closing";
import { useSpace } from "@/hooks/use-space";
import { cn } from "@/lib/utils";

interface CoupleSplitCardProps {
  month: string;
  excludeProjects?: boolean;
}

/**
 * Fechamento do mês no Nosso espaço — "quem gastou o quê".
 *
 * Uma frase que responde a pergunta ("Você representou 40% das despesas,
 * Ana representou 60%") + uma barra única dividida em dois tons (você neutro,
 * parceiro chart-6 — as mesmas cores dos avatares do extrato). Despesa
 * atribuída a quem PAGOU (fallback: quem lançou), líquida de rateio.
 *
 * Silencioso por construção: fora do Nosso espaço, sem gasto no mês ou com a
 * RPC indisponível, não renderiza nada — o DRE segue igual.
 */
export function CoupleSplitCard({ month, excludeProjects = true }: CoupleSplitCardProps) {
  const { isWeSpace } = useSpace();
  const { data } = useCoupleExpenseSplit(month, excludeProjects, isWeSpace);

  if (!isWeSpace || !data || data.total <= 0 || data.people.length < 2) return null;

  const [first, second] = data.people;
  const nameOf = (person: typeof first) => (person.isSelf ? "Você" : person.name);

  return (
    <Card>
      <CardHeader className="pb-3">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden />
          Quem gastou o quê
        </p>
        <p className="text-pretty text-base font-medium text-foreground md:text-lg">
          {nameOf(first)} representou{" "}
          <span className="tabular">{first.pct}%</span> das despesas, {nameOf(second)} representou{" "}
          <span className="tabular">{second.pct}%</span>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={data.people.map((person) => `${nameOf(person)} ${person.pct}%`).join(", ")}
        >
          {data.people.map((person) => (
            <span
              key={person.userId}
              style={{ width: `${person.pct}%` }}
              className={cn(
                "h-full transition-[width] duration-500 ease-entrance first:rounded-l-full last:rounded-r-full",
                person.isSelf ? "bg-foreground/60" : "bg-chart-6",
              )}
            />
          ))}
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {data.people.map((person) => (
            <li key={person.userId} className="flex items-center gap-3">
              <span
                aria-hidden
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  person.isSelf ? "bg-foreground/10 text-foreground" : "bg-chart-6 text-background",
                )}
              >
                {(person.isSelf ? "V" : person.name.charAt(0)).toLocaleUpperCase("pt-BR")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {nameOf(person)} <span className="tabular text-muted-foreground">· {person.pct}%</span>
                </p>
                <p className="tabular text-xs text-muted-foreground">
                  {formatMoney(person.total)} em {plural(person.count, "lançamento", "lançamentos")}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Total do casal: <span className="tabular font-medium text-foreground">{formatMoney(data.total)}</span> ·
          contado por quem pagou, já descontada a parte de rateios.
        </p>
      </CardContent>
    </Card>
  );
}
