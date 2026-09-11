import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, Lock, ShieldCheck, UserCheck } from "lucide-react";

import orbiLogo from "@/assets/orbi-logo_white.png";
import pixLogo from "@/assets/pix-white.svg";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { ForecastChip, HeroLedger } from "@/components/landing/HeroLedger";
import { LandingNav } from "@/components/landing/LandingNav";
import { Magnetic } from "@/components/landing/Magnetic";
import { OrbiMark, OrbitField, StarField } from "@/components/landing/OrbitField";
import { PricingSection } from "@/components/landing/PricingSection";
import { Reveal } from "@/components/landing/Reveal";
import "@/components/landing/landing.css";

const TRUST = [
  { title: "Pagamento pelo Asaas", text: "Pix, boleto ou cartão de crédito", pix: true },
  { title: "Dados isolados por usuário", text: "Row Level Security no banco", icon: ShieldCheck },
  { title: "Tráfego e banco cifrados", text: "TLS em trânsito, criptografia em repouso", icon: Lock },
  { title: "Seus dados, suas regras", text: "Consentimento e direitos pela LGPD", icon: UserCheck },
];

const STEPS = [
  {
    title: "Crie sua conta",
    text: "Cadastro com e-mail e senha. O plano Free já libera contas, cartões e o extrato do mês, sem pedir cartão.",
  },
  {
    title: "Importe o extrato",
    tag: "Pro e Casal",
    text: "Envie o arquivo do seu banco. A IA sugere a categoria de cada lançamento e você só confirma o que precisar.",
  },
  {
    title: "Enxergue o mês inteiro",
    text: "Saldo real, saldo projetado, faturas e parcelas no mesmo painel, atualizados a cada lançamento.",
  },
];

function PrimaryCta({ label = "Comece Agora" }: { label?: string }) {
  return (
    <Magnetic>
      <Link to="/login?modo=cadastro" className="lp-btn lp-btn--primary">
        {label}
        <span className="lp-btn__icon" aria-hidden>
          <ArrowUpRight strokeWidth={1.75} data-magnet-icon />
        </span>
      </Link>
    </Magnetic>
  );
}

function Hero() {
  return (
    <section className="lp-hero lp-space" data-space-band aria-labelledby="hero-title">
      <StarField count={56} seed={11} />

      <div className="lp-container">
        <div className="lp-hero__grid">
          <div className="lp-hero__copy">
            <Reveal as="h1" id="hero-title" className="lp-display" variant="lines" immediate>
              <span className="lp-line">
                <span>Importe o extrato.</span>
              </span>
              <span className="lp-line">
                <span className="lp-accent">O Orbi organiza.</span>
              </span>
            </Reveal>

            <Reveal as="p" className="lp-lede" immediate delay={260}>
              A IA lê o PDF ou o CSV do seu banco e categoriza cada lançamento por você. Sobra o que importa: saldo
              real, saldo projetado, faturas e parcelas sob controle, sozinho ou a dois.
            </Reveal>

            <Reveal className="lp-hero__cta" immediate delay={380}>
              <PrimaryCta />
              <a href="#planos" className="lp-btn lp-btn--ghost">
                Ver planos
              </a>
            </Reveal>

            <Reveal as="ul" className="lp-assure" immediate delay={480} variant="fade">
              <li>
                <Check strokeWidth={2} aria-hidden />
                Plano Free para sempre
              </li>
              <li>
                <Check strokeWidth={2} aria-hidden />
                Sem cartão para começar
              </li>
              <li>
                <Check strokeWidth={2} aria-hidden />
                Cancele quando quiser
              </li>
            </Reveal>
          </div>

          <div className="lp-hero__visual">
            <OrbitField />
            <Reveal immediate delay={320} style={{ position: "relative", width: "100%", display: "flex", justifyContent: "inherit" }}>
              <HeroLedger />
            </Reveal>
            <ForecastChip />
          </div>
        </div>
      </div>

      <div className="lp-trust">
        <div className="lp-container">
          <ul className="lp-trust__list" aria-label="Segurança e pagamento">
            {TRUST.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="lp-trust__item">
                  <span className="lp-glyph" aria-hidden>
                    {item.pix ? (
                      <img className="lp-trust__pix" src={pixLogo} alt="" width={16} height={16} />
                    ) : (
                      <Icon strokeWidth={1.5} />
                    )}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.text}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="lp-section" aria-labelledby="como-title">
      <div className="lp-container">
        <div className="lp-section__head">
          <Reveal as="h2" className="lp-h2" id="como-title">
            Do extrato bruto ao mês sob controle.
          </Reveal>
          <Reveal as="p" className="lp-lede" delay={120}>
            Nada de planilha para montar nem categoria para digitar. Três passos e o Orbi assume o trabalho repetitivo.
          </Reveal>
        </div>

        <Reveal as="ol" className="lp-steps" variant="track">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} className="lp-step" delay={index * 140}>
              <span className="lp-step__num" aria-hidden>
                {index + 1}
              </span>
              <div>
                <h3>
                  {step.title}
                  {step.tag && <span className="lp-pill">{step.tag}</span>}
                </h3>
                <p>{step.text}</p>
              </div>
            </Reveal>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <div className="lp-space" data-space-band>
      <section className="lp-final" aria-labelledby="final-title">
        <StarField count={40} seed={29} />
        <OrbitField />
        <div className="lp-container">
          <div className="lp-final__inner">
            <div className="lp-final__copy">
              <Reveal as="h2" className="lp-display" id="final-title" variant="lines">
                <span className="lp-line">
                  <span>Seu próximo extrato</span>
                </span>
                <span className="lp-line">
                  <span className="lp-accent">já chega organizado.</span>
                </span>
              </Reveal>
              <Reveal as="p" className="lp-lede" delay={160}>
                Crie a conta, comece no Free e ative a IA classificadora quando o volume de lançamentos pedir.
              </Reveal>
            </div>
            <Reveal className="lp-final__actions" delay={240}>
              <PrimaryCta />
              <Link to="/login" className="lp-btn lp-btn--ghost">
                Já tenho conta
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer__top">
            <div className="lp-footer__brand">
              <Link to="/" className="lp-brand" aria-label="Orbi, página inicial">
                <OrbiMark src={orbiLogo} />
                <span className="lp-brand__word">Orbi</span>
              </Link>
              <p>Gestão financeira com IA que classifica seus extratos e mostra o mês antes de ele acontecer.</p>
            </div>

            <nav className="lp-footer__col" aria-labelledby="footer-produto">
              <h2 id="footer-produto">Produto</h2>
              <ul>
                <li>
                  <a href="#recursos">Recursos</a>
                </li>
                <li>
                  <a href="#como-funciona">Como funciona</a>
                </li>
                <li>
                  <a href="#planos">Planos</a>
                </li>
              </ul>
            </nav>

            <nav className="lp-footer__col" aria-labelledby="footer-conta">
              <h2 id="footer-conta">Conta</h2>
              <ul>
                <li>
                  <Link to="/login">Entrar</Link>
                </li>
                <li>
                  <Link to="/login?modo=cadastro">Criar conta</Link>
                </li>
              </ul>
            </nav>

            <nav className="lp-footer__col" aria-labelledby="footer-legal">
              <h2 id="footer-legal">Legal</h2>
              <ul>
                <li>
                  <Link to="/legal/termos-de-uso">Termos de Uso</Link>
                </li>
                <li>
                  <Link to="/legal/politica-de-privacidade">Política de Privacidade</Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="lp-footer__bottom">
            <p className="lp-tabular">© {new Date().getFullYear()} Orbi. Todos os direitos reservados.</p>
            <p>Assinaturas processadas com segurança pelo Asaas.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Landing() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Orbi · Importe o extrato, a IA organiza suas finanças";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="lp">
      <a className="lp-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <LandingNav />
      <main id="conteudo">
        <Hero />
        <FeatureShowcase />
        <HowItWorks />
        <PricingSection />
      </main>
      <FinalCall />
    </div>
  );
}
