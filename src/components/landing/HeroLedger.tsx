import { useEffect, useState } from "react";
import { ArrowUpRight, Coffee, FileText, Fuel, HeartPulse, Repeat, ScanLine, Wallet } from "lucide-react";

import { prefersReducedMotion } from "./Reveal";

const ROWS = [
  { raw: "PAG*PADARIA CENTRAL", category: "Alimentação", value: "−R$ 18,40", icon: Coffee },
  { raw: "POSTO ESTRELA 0231", category: "Transporte", value: "−R$ 212,00", icon: Fuel, tag: "aprendido" },
  { raw: "PIX RECEBIDO SALARIO", category: "Salário", value: "+R$ 6.480,00", icon: Wallet, income: true },
  { raw: "FARMACIA BEM VIVER", category: "Saúde", value: "−R$ 64,75", icon: HeartPulse },
  { raw: "STREAMING MENSAL", category: "Assinaturas", value: "−R$ 39,90", icon: Repeat, tag: "fixa" },
];

export function HeroLedger() {
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDone(ROWS.length);
      return;
    }

    const timers = ROWS.map((_, index) => window.setTimeout(() => setDone(index + 1), 1500 + index * 520));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const finished = done === ROWS.length;

  return (
    <figure className="lp-ledger lp-bezel" aria-label="Exemplo de extrato importado sendo categorizado pela IA do Orbi" style={{ margin: 0 }}>
      <div className="lp-bezel__core">
        <div className="lp-ledger__head">
          <div className="lp-ledger__file">
            <span className="lp-glyph">
              <FileText strokeWidth={1.5} />
            </span>
            <div style={{ minWidth: 0 }}>
              <strong>extrato-setembro.pdf</strong>
              <span>Importação · 5 lançamentos</span>
            </div>
          </div>
          <span className="lp-status" data-done={finished}>
            <span className="lp-status__dot" aria-hidden />
            {finished ? "Categorizado" : "Classificando"}
          </span>
        </div>

        <ul className="lp-ledger__rows">
          {ROWS.map((row, index) => {
            const classified = index < done;
            const Icon = row.icon;
            return (
              <li key={row.raw} className="lp-row">
                <span className="lp-glyph" aria-hidden>
                  <ScanLine className="lp-row__scan" strokeWidth={1.5} data-off={classified} />
                  <Icon strokeWidth={1.5} data-off={!classified} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="lp-row__raw">{row.raw}</span>
                  <span className="lp-row__cat">
                    <span className="lp-row__skeleton" data-off={classified} aria-hidden />
                    <span className="lp-row__cat-label" data-off={!classified}>
                      {row.category}
                      {row.tag && <span className="lp-row__tag">{row.tag}</span>}
                    </span>
                  </span>
                </span>
                <span className={row.income ? "lp-row__value lp-row__value--in lp-tabular" : "lp-row__value lp-tabular"}>
                  {row.value}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="lp-ledger__foot">
          <span className="lp-tabular">
            {done} de {ROWS.length} categorizados
          </span>
          <span className="lp-progress" aria-hidden>
            <span style={{ transform: `scaleX(${done / ROWS.length})` }} />
          </span>
        </div>
      </div>
    </figure>
  );
}

export function ForecastChip() {
  return (
    <div className="lp-chip-float lp-bezel">
      <div className="lp-bezel__core">
        <span className="lp-chip-float__label">Saldo projetado para 30/09</span>
        <strong className="lp-chip-float__value lp-tabular">R$ 4.812,40</strong>
        <span className="lp-chip-float__delta lp-tabular">
          <ArrowUpRight strokeWidth={1.75} aria-hidden />
          R$ 1.572,30 até o fim do mês
        </span>
      </div>
    </div>
  );
}
