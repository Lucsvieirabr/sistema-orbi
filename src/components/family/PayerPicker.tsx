import { AuthorAvatar } from "@/components/family/AuthorTag";
import { Label } from "@/components/ui/label";
import { useSpace } from "@/hooks/use-space";
import { cn } from "@/lib/utils";

interface PayerPickerProps {
  /** `null` = quem lança (dono da linha) pagou. */
  value: string | null;
  onChange: (next: string | null) => void;
  /** Dono da transação em edição; `null` na criação (= usuário logado). */
  ownerId?: string | null;
}

/**
 * Nosso espaço — "Quem pagou?".
 *
 * Duas fichas (avatar + nome), a do dono marcada por padrão. Serve ao acerto
 * de caixa do casal e ao "quem gastou o quê" do Fechamento; não mexe no
 * saldo (a despesa segue na conta/cartão escolhido). Fora do Nosso espaço
 * não renderiza.
 */
export function PayerPicker({ value, onChange, ownerId }: PayerPickerProps) {
  const { isWeSpace, me, partner } = useSpace();
  if (!isWeSpace || !me || !partner) return null;

  const owner = ownerId ?? me.userId;
  const selected = value ?? owner;
  const people = [me, partner];

  return (
    <div className="space-y-2">
      <Label id="payer-label" className="text-sm">
        Quem pagou?
      </Label>
      <div role="radiogroup" aria-labelledby="payer-label" className="flex flex-wrap gap-2">
        {people.map((person) => {
          const active = selected === person.userId;
          return (
            <button
              key={person.userId}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(person.userId === owner ? null : person.userId)}
              className={cn(
                "press inline-flex h-10 items-center gap-2 rounded-full border pl-1 pr-3.5 text-sm transition-colors duration-200 md:h-9",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                active
                  ? person.isSelf
                    ? "border-foreground/30 bg-foreground/5 text-foreground"
                    : "border-chart-6/40 bg-chart-6/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <AuthorAvatar author={person} className="h-7 w-7 text-[0.6875rem] md:h-6 md:w-6 md:text-[0.625rem]" />
              {person.isSelf ? "Eu" : person.name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Só registra quem desembolsou — o saldo continua na conta ou cartão escolhido.
      </p>
    </div>
  );
}
