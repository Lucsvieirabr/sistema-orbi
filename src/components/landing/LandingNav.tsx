import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Moon, Sun } from "lucide-react";

import orbiLogo from "@/assets/orbi-logo_white.png";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

import { OrbiMark } from "./OrbitField";

const LINKS = [
  { href: "#recursos", label: "Recursos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#planos", label: "Planos" },
];

export function LandingNav() {
  const { theme, toggleTheme } = useTheme();
  const [overSpace, setOverSpace] = useState(true);
  const isDark = theme === "dark";

  useEffect(() => {
    const bands = Array.from(document.querySelectorAll<HTMLElement>("[data-space-band]"));
    if (bands.length === 0 || typeof IntersectionObserver === "undefined") return;

    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        setOverSpace(visible.size > 0);
      },
      { rootMargin: "0px 0px -93% 0px", threshold: 0 },
    );

    bands.forEach((band) => observer.observe(band));
    return () => observer.disconnect();
  }, []);

  return (
    <header className="lp-nav">
      <nav className={cn("lp-nav__bar", overSpace && "lp-space")} aria-label="Principal">
        <Link to="/" className="lp-brand" aria-label="Orbi, página inicial">
          <OrbiMark src={orbiLogo} />
          <span className="lp-brand__word">Orbi</span>
        </Link>

        <ul className="lp-nav__links">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a className="lp-nav__link" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="lp-nav__actions">
          <button
            type="button"
            className="lp-icon-btn"
            onClick={toggleTheme}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            title={isDark ? "Tema claro" : "Tema escuro"}
          >
            <Sun strokeWidth={1.5} data-off={!isDark} aria-hidden />
            <Moon strokeWidth={1.5} data-off={isDark} aria-hidden />
          </button>
          <Link to="/login" className="lp-nav__link lp-nav__login">
            Entrar
          </Link>
          <Link to="/login?modo=cadastro" className="lp-btn lp-btn--primary lp-btn--sm">
            Comece Agora
            <span className="lp-btn__icon" aria-hidden>
              <ArrowUpRight strokeWidth={1.75} />
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
