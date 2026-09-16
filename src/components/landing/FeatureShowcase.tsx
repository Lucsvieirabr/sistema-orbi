import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Keyboard,
  Upload,
  Coffee,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Fuel,
  House,
  Image as ImageIcon,
  Layers,
  PiggyBank,
  Sparkles,
  User,
  Users,
  Split,
  FolderKanban,
  ShoppingBasket,
  Flag,
} from "lucide-react";

import { Reveal } from "./Reveal";

const MAPPINGS = [
  { raw: "POSTO ESTRELA 0231", category: "Transporte", icon: Fuel },
  { raw: "PAG*PADARIA CENTRAL", category: "Alimentação", icon: Coffee },
  { raw: "ENERGIA ELETRICA 09/26", category: "Moradia", icon: House },
  { raw: "APLICACAO CDB 30D", category: "Investimentos", icon: PiggyBank },
];

const CAPABILITIES: Array<{ icon: typeof CreditCard; title: string; text: string; premium?: boolean }> = [
  {
    icon: CreditCard,
    title: "Faturas pelo fechamento",
    text: "Cada compra entra na fatura certa, calculada pelo dia de fechamento do seu cartão.",
  },
  {
    icon: Layers,
    title: "Parcelas e contas fixas",
    text: "Lance uma vez. Parcelamentos e recorrências se distribuem sozinhos pelos próximos meses.",
  },
  {
    icon: CalendarClock,
    title: "Painel de assinaturas",
    text: "Veja quanto streaming, apps e serviços recorrentes pesam no seu mês.",
  },
  {
    icon: FlaskConical,
    title: "Motor Preditivo",
    text: "Saldo de 30, 90 ou 365 dias, alerta do dia em que o caixa rompe e cenários para testar a compra em 10x antes de fazer.",
    premium: true,
  },
  {
    icon: Split,
    title: "Rateios e acertos",
    text: "Pets 50/50, mercado 60/40 e viagens que viram uma frase: “João deve R$ 350,00 para você”, com PIX Copia e Cola.",
    premium: true,
  },
  {
    icon: PiggyBank,
    title: "Orçamentos e metas",
    text: "Teto por categoria, metas com prazo e o fechamento do mês em linhas de DRE.",
    premium: true,
  },
  {
    icon: FolderKanban,
    title: "Projetos de Vida",
    text: "Casamento, reforma, enxoval: cada evento com orçamento próprio, fora da média do mês, e um relatório final ao arquivar.",
    premium: true,
  },
  {
    icon: ShoppingBasket,
    title: "Inflação Pessoal",
    text: "O quanto o seu mercado, a farmácia, o combustível e as assinaturas subiram, medido nas suas próprias compras.",
    premium: true,
  },
];

function IaTile() {
  return (
    <article className="lp-tile lp-space" aria-labelledby="tile-ia">
      <span className="lp-tile__rule" aria-hidden />
      <div className="lp-tile__copy">
        <h3 className="lp-h3" id="tile-ia">
          A IA lê o extrato do banco por você.
        </h3>
        <p className="lp-body">
          Envie o PDF, o CSV ou até a foto do extrato. O Orbi extrai cada linha, limpa descrições como “PAG*” e
          “COMPRA CARTAO” e sugere a categoria certa. Você só confere.
        </p>
      </div>

      <div className="lp-well">
        <div className="lp-pipeline">
          <div className="lp-formats">
            <span className="lp-format">
              <FileText strokeWidth={1.5} aria-hidden />
              PDF
            </span>
            <span className="lp-format">
              <FileSpreadsheet strokeWidth={1.5} aria-hidden />
              CSV
            </span>
            <span className="lp-format">
              <ImageIcon strokeWidth={1.5} aria-hidden />
              Foto
            </span>
            <ArrowRight className="lp-formats__arrow" strokeWidth={1.5} aria-hidden />
            <span>categorias sugeridas</span>
          </div>

          <ul className="lp-map">
            {MAPPINGS.map((row, index) => {
              const Icon = row.icon;
              return (
                <Reveal as="li" key={row.raw} className="lp-map__row" delay={120 + index * 90}>
                  <span className="lp-map__raw">{row.raw}</span>
                  <ArrowRight className="lp-map__arrow" strokeWidth={1.5} aria-hidden />
                  <span className="lp-map__cat">
                    <span className="lp-glyph" aria-hidden>
                      <Icon strokeWidth={1.5} />
                    </span>
                    {row.category}
                  </span>
                </Reveal>
              );
            })}
          </ul>

          <p className="lp-learned">
            <Sparkles strokeWidth={1.5} aria-hidden />
            <span>
              <strong>Corrigiu uma vez, está aprendido.</strong> Cada ajuste vira padrão e o próximo extrato já chega
              mais certo.
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

function CasalTile() {
  const [mode, setMode] = useState<"pessoal" | "casal">("casal");
  const casal = mode === "casal";

  return (
    <article className="lp-tile" aria-labelledby="tile-casal">
      <div className="lp-tile__copy">
        <h3 className="lp-h3" id="tile-casal">
          Finanças a dois, sem planilha compartilhada.
        </h3>
        <p className="lp-body">
          Cada pessoa tem sua conta, isolada no banco de dados. No Plano Casal, vocês alternam entre a visão pessoal e a
          do casal com uma assinatura só.
        </p>
      </div>

      <div className="lp-well">
        <div className="lp-duo">
          <div className="lp-duo__top">
            <div className="lp-seg" role="group" aria-label="Modo de visualização">
              <span className="lp-seg__thumb" data-pos={casal ? 1 : 0} aria-hidden />
              <button type="button" className="lp-seg__btn" aria-pressed={!casal} onClick={() => setMode("pessoal")}>
                <User strokeWidth={1.5} aria-hidden />
                Pessoal
              </button>
              <button type="button" className="lp-seg__btn" aria-pressed={casal} onClick={() => setMode("casal")}>
                <Users strokeWidth={1.5} aria-hidden />
                Casal
              </button>
            </div>
          </div>

          <svg className="lp-duo__art" viewBox="0 0 320 150" aria-hidden focusable="false">
            <defs>
              <clipPath id="lp-duo-clip">
                <circle cx="130" cy="72" r="58" />
              </clipPath>
            </defs>
            <circle className="lp-duo__ring" cx="130" cy="72" r="58" />
            <circle className="lp-duo__ring" cx="190" cy="72" r="58" data-dim={!casal} />
            <circle className="lp-duo__overlap" cx="190" cy="72" r="58" clipPath="url(#lp-duo-clip)" data-dim={!casal} />
            <text className="lp-duo__label" x="96" y="146" textAnchor="middle">
              Você
            </text>
            <text className="lp-duo__label" x="224" y="146" textAnchor="middle">
              Parceiro(a)
            </text>
          </svg>

          <div className="lp-duo__figure" aria-live="polite">
            <span key={`label-${mode}`} className="lp-swap">
              {casal ? "Saldo do casal" : "Seu saldo"}
            </span>
            <strong key={`value-${mode}`} className="lp-figure lp-swap">
              {casal ? "R$ 8.750,00" : "R$ 5.432,50"}
            </strong>
          </div>
        </div>
      </div>
    </article>
  );
}

function ForecastTile() {
  return (
    <article className="lp-tile" aria-labelledby="tile-forecast">
      <div className="lp-tile__copy">
        <h3 className="lp-h3" id="tile-forecast">
          Saiba hoje o dia em que o caixa aperta.
        </h3>
        <p className="lp-body">
          O Motor Preditivo soma faturas, parcelas e salário ao saldo real e desconta o ralo dos gastos do dia a dia. Se
          a linha cruzar o zero, você recebe a data e quanto vai faltar. Nos Cenários Hipotéticos, teste a compra antes
          de fazer.
        </p>
      </div>

      <div className="lp-well">
        <div className="lp-forecast">
          <div className="lp-forecast__figures">
            <div>
              <span>Saldo real hoje</span>
              <strong className="lp-figure">R$ 3.240,10</strong>
            </div>
            <div>
              <span>Ruptura prevista</span>
              <strong className="lp-figure lp-figure--down">14/11 · −R$ 612,40</strong>
            </div>
          </div>

          <Reveal className="lp-chart" variant="fade">
            <svg viewBox="0 0 320 120" role="img" aria-label="Linha do saldo real até hoje e projeção pontilhada que cruza o zero em 14 de novembro">
              <line className="lp-chart__grid" x1="0" y1="20" x2="320" y2="20" />
              <line className="lp-chart__grid" x1="0" y1="60" x2="320" y2="60" />
              <line className="lp-chart__grid" x1="0" y1="100" x2="320" y2="100" />
              <g className="lp-chart__draw">
                <path
                  className="lp-chart__real"
                  d="M4 70 L32 64 L60 80 L88 74 L116 88 L144 82 L172 92 L196 86"
                />
                <path className="lp-chart__proj" d="M196 86 L220 70 L244 80 L262 104 L290 108 L314 112" />
                <line className="lp-chart__today" x1="196" y1="8" x2="196" y2="112" />
                <line className="lp-chart__zero" x1="0" y1="100" x2="320" y2="100" />
                <circle className="lp-chart__dot" cx="196" cy="86" r="4.5" />
                <circle className="lp-chart__dot lp-chart__dot--alert" cx="259" cy="100" r="5.5" />
              </g>
            </svg>
            <div className="lp-chart__axis" aria-hidden>
              <span>01/09</span>
              <span>hoje</span>
              <span>+90 dias</span>
            </div>
          </Reveal>
        </div>
      </div>
    </article>
  );
}

const PROJECT_ROWS = [
  { label: "Anel de ouro 18k", value: "R$ 5.000,00", tag: "Pago" },
  { label: "Sinal do buffet", value: "R$ 2.000,00", tag: "Agendado" },
];

function ProjectsTile() {
  return (
    <article className="lp-tile" aria-labelledby="tile-projects">
      <div className="lp-tile__copy">
        <h3 className="lp-h3" id="tile-projects">
          Casamento, reforma, enxoval. Cada um com o seu caixa.
        </h3>
        <p className="lp-body">
          A meta juntou o dinheiro, o evento começou: execute a meta e o valor guardado vira o orçamento do projeto. A compra
          atípica fica lá dentro e não bagunça a média nem os orçamentos do mês.
        </p>
      </div>

      <div className="lp-well">
        <div className="lp-project">
          <div className="lp-project__head">
            <span className="lp-glyph" aria-hidden>
              <FolderKanban strokeWidth={1.5} />
            </span>
            <div>
              <strong>Casamento 2027</strong>
              <span>Veio da meta · R$ 12.000,00 guardados</span>
            </div>
          </div>

          <div className="lp-project__figures">
            <div>
              <span>Custo realizado</span>
              <strong className="lp-figure">R$ 7.000,00</strong>
            </div>
            <div>
              <span>Orçamento</span>
              <strong className="lp-figure lp-figure--muted">R$ 15.000,00</strong>
            </div>
          </div>

          <Reveal className="lp-pace" variant="fade" aria-label="47% do orçamento usado com 38% do prazo percorrido">
            <span className="lp-pace__track" aria-hidden>
              <span className="lp-pace__fill lp-pace__fill--wash" />
              <span className="lp-pace__fill" />
              <span className="lp-pace__tick" />
            </span>
            <span className="lp-pace__legend" aria-hidden>
              <span>47% do orçamento</span>
              <span>38% do prazo</span>
            </span>
          </Reveal>

          <ul className="lp-project__rows">
            {PROJECT_ROWS.map((row, index) => (
              <Reveal as="li" key={row.label} delay={160 + index * 110}>
                <span>{row.label}</span>
                <span className="lp-project__tag">{row.tag}</span>
                <strong className="lp-tabular">{row.value}</strong>
              </Reveal>
            ))}
          </ul>

          <p className="lp-learned">
            <Flag strokeWidth={1.5} aria-hidden />
            <span>
              <strong>Fora do DRE do mês.</strong> No fim, o relatório diz quanto custou e quanto sobrou do orçamento.
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

const INFLATION_ROWS = [
  { label: "Assinaturas e streaming", pct: "+15,2%", width: 0.95, note: "Netflix: R$ 44,90 → R$ 55,90", hot: true },
  { label: "Mercado", pct: "+10,4%", width: 0.66, note: "Supermercado Bom Preço: compra típica +R$ 32,45", hot: true },
  { label: "Farmácia", pct: "+6,8%", width: 0.43, note: "Drogaria São Bento" },
  { label: "Refeição fora de casa", pct: "+5,1%", width: 0.32, note: "Padaria Central" },
];

function InflationTile() {
  return (
    <article className="lp-tile lp-space" aria-labelledby="tile-inflation">
      <span className="lp-tile__rule" aria-hidden />
      <div className="lp-tile__copy">
        <h3 className="lp-h3" id="tile-inflation">
          A sua inflação, não a do jornal.
        </h3>
        <p className="lp-body">
          O Orbi compara o mesmo supermercado, a mesma farmácia e a mesma assinatura com eles mesmos, mês a mês. Você vê o
          preço que subiu, não o volume que você comprou, e recebe o aviso para reajustar o teto antes de estourar.
        </p>
      </div>

      <div className="lp-well">
        <div className="lp-inflation">
          <div className="lp-inflation__head">
            <strong className="lp-inflation__figure lp-tabular">+8,5%</strong>
            <span>Sua inflação pessoal nos últimos 6 meses. O custo de manutenção do seu estilo de vida subiu.</span>
          </div>

          <Reveal as="ul" className="lp-inflation__bars" variant="fade">
            {INFLATION_ROWS.map((row, index) => (
              <li key={row.label} style={{ ["--i" as string]: index, ["--w" as string]: row.width }}>
                <div className="lp-inflation__line">
                  <span>{row.label}</span>
                  <strong className={row.hot ? "lp-tabular lp-inflation__hot" : "lp-tabular"}>{row.pct}</strong>
                </div>
                <span className="lp-inflation__track" aria-hidden>
                  <span className="lp-inflation__fill" data-hot={row.hot ? "true" : undefined} />
                </span>
                <span className="lp-inflation__note">{row.note}</span>
              </li>
            ))}
          </Reveal>

          <p className="lp-inflation__alert">
            <ShoppingBasket strokeWidth={1.5} aria-hidden />
            <span>
              Mercado subiu mais de 10%: <strong>reajuste o teto para R$ 1.545,60</strong> antes da segunda semana.
            </span>
          </p>
        </div>
      </div>
    </article>
  );
}

const TYPING_ROWS = [62, 48, 70, 40, 56];

const SUGGESTED = [
  { label: "Alimentação", icon: Coffee },
  { label: "Transporte", icon: Fuel },
  { label: "Moradia", icon: House },
  { label: "Investimentos", icon: PiggyBank },
];

function TimeTile() {
  return (
    <article className="lp-tile" aria-labelledby="tile-time">
      <div className="lp-tile__copy">
        <h3 className="lp-h3" id="tile-time">
          Menos digitação. Mais decisão.
        </h3>
        <p className="lp-body">
          O extrato inteiro entra de uma vez, com as categorias já sugeridas. O tempo de copiar linha por linha volta
          para você decidir o que fazer com o dinheiro.
        </p>
      </div>

      <div className="lp-well lp-compare">
        <div className="lp-compare__col">
          <span className="lp-compare__label">
            <Keyboard strokeWidth={1.5} aria-hidden />
            Planilha à mão
          </span>
          <ul className="lp-typing" aria-hidden>
            {TYPING_ROWS.map((width, index) => (
              <Reveal as="li" key={index} delay={200 + index * 420}>
                <span className="lp-typing__bar" style={{ width: `${width}%` }} />
                {index === TYPING_ROWS.length - 1 && <span className="lp-caret" />}
                <span className="lp-typing__bar lp-typing__bar--short" />
              </Reveal>
            ))}
          </ul>
          <span className="lp-compare__foot">Linha por linha, todo mês.</span>
        </div>

        <div className="lp-compare__col lp-compare__col--orbi">
          <span className="lp-compare__label">
            <Upload strokeWidth={1.5} aria-hidden />
            Com o Orbi
          </span>
          <Reveal className="lp-drop" delay={260}>
            <span className="lp-glyph" aria-hidden>
              <FileText strokeWidth={1.5} />
            </span>
            <div>
              <strong>extrato-setembro.pdf</strong>
              <span>Importado e categorizado</span>
            </div>
            <span className="lp-check" aria-hidden>
              <Check strokeWidth={2} />
            </span>
          </Reveal>
          <Reveal as="ul" className="lp-tags" delay={420} variant="fade">
            {SUGGESTED.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <Icon strokeWidth={1.5} aria-hidden />
                  {item.label}
                </li>
              );
            })}
          </Reveal>
          <span className="lp-compare__foot">
            <strong>Uma importação.</strong> Você só revisa.
          </span>
        </div>
      </div>
    </article>
  );
}

export function FeatureShowcase() {
  return (
    <section id="recursos" className="lp-section" aria-labelledby="recursos-title">
      <div className="lp-container">
        <div className="lp-section__head">
          <Reveal as="h2" className="lp-h2" id="recursos-title">
            Cada real na órbita certa, sem esforço.
          </Reveal>
          <Reveal as="p" className="lp-lede" delay={120}>
            Automação onde você perdia tempo, previsão onde havia dúvida, um caixa próprio para cada grande evento e o índice
            de preços que só as suas compras podem dar.
          </Reveal>
        </div>

        <div className="lp-bento">
          <Reveal className="lp-bento__cell lp-tile--ia">
            <IaTile />
          </Reveal>
          <Reveal className="lp-bento__cell lp-tile--casal" delay={120}>
            <CasalTile />
          </Reveal>
          <Reveal className="lp-bento__cell lp-tile--forecast">
            <ForecastTile />
          </Reveal>
          <Reveal className="lp-bento__cell lp-tile--time" delay={120}>
            <TimeTile />
          </Reveal>
          <Reveal className="lp-bento__cell lp-tile--inflation">
            <InflationTile />
          </Reveal>
          <Reveal className="lp-bento__cell lp-tile--projects" delay={120}>
            <ProjectsTile />
          </Reveal>
        </div>

        <ul className="lp-caps">
          {CAPABILITIES.map((cap, index) => {
            const Icon = cap.icon;
            return (
              <Reveal as="li" key={cap.title} className="lp-cap" delay={index * 80}>
                <span className="lp-glyph" aria-hidden>
                  <Icon strokeWidth={1.5} />
                </span>
                <h3>
                  {cap.title}
                  {cap.premium && <span className="lp-cap__plan">Pro e Casal</span>}
                </h3>
                <p>{cap.text}</p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
