import type { Config } from "tailwindcss";

/**
 * Orbi — configuracao do Design System.
 * Toda cor aqui e um alias semantico de uma CSS var definida em src/index.css,
 * entao light/dark trocam sozinhos sem nenhuma variante `dark:` no JSX.
 *
 * Nao ha utilitarios de gradiente: superficies do Orbi sao chapadas e
 * separadas por hairline + whitespace. `bg-clip-text` com gradiente foi
 * removido do sistema (era a origem de texto invisivel na tela de Planos).
 */
export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    /* Na raiz (e nao em `extend`) para que `xs` seja emitido ANTES de `sm`/`md`.
       Em `extend` o breakpoint novo vai para o fim da cascata e vence os
       maiores — invertendo o mobile-first. */
    screens: {
      xs: "400px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    container: {
      center: true,
      padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1440px" },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      /* Escala tipografica: cada degrau ja carrega leading e tracking.
         Regra: quanto maior o texto, mais fechado o tracking; quanto menor,
         mais aberto. Cromo pequeno respira, dado grande fecha. */
      fontSize: {
        "3xs": ["0.625rem", { lineHeight: "0.875rem", letterSpacing: "0.04em" }],
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
        xs: ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0.01em" }],
        sm: ["0.8125rem", { lineHeight: "1.3125rem" }],
        base: ["0.9375rem", { lineHeight: "1.6" }],
        lg: ["1.0625rem", { lineHeight: "1.5", letterSpacing: "-0.01em" }],
        xl: ["1.25rem", { lineHeight: "1.35", letterSpacing: "-0.015em" }],
        "2xl": ["1.5rem", { lineHeight: "1.22", letterSpacing: "-0.02em" }],
        "3xl": ["1.875rem", { lineHeight: "1.14", letterSpacing: "-0.025em" }],
        "4xl": ["2.375rem", { lineHeight: "1.08", letterSpacing: "-0.03em" }],
        "5xl": ["3rem", { lineHeight: "1.04", letterSpacing: "-0.035em" }],
      },
      letterSpacing: {
        eyebrow: "0.09em",
        figure: "-0.025em",
      },
      colors: {
        border: "hsl(var(--border))",
        "border-subtle": "hsl(var(--border-subtle))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          sunken: "hsl(var(--surface-sunken))",
        },
        brand: {
          50: "hsl(var(--brand-050))",
          200: "hsl(var(--brand-200))",
          500: "hsl(var(--brand-500))",
          700: "hsl(var(--brand-700))",
          900: "hsl(var(--brand-900))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          muted: "hsl(var(--sidebar-muted))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
          marker: "hsl(var(--sidebar-marker))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
      },
      boxShadow: {
        none: "none",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        primary: "var(--shadow-primary)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 10px)",
      },
      spacing: {
        header: "3.5rem",
        "header-lg": "4.5rem",
        sidebar: "16rem",
        "bottom-nav": "4rem",
        "bottom-nav-offset": "var(--bottom-nav-offset)",
      },
      /* Escala de empilhamento. Existir aqui e nao no JSX e o que impede o
         proximo `z-50` avulso de subir na frente de um modal: cada camada tem
         um nome e uma ordem.
           header      30  cabecalho sticky
           bottom-nav  40  barra inferior (mobile)
           fab         45  acoes flutuantes — acima da barra, abaixo do overlay
           overlay     50  Dialog/Sheet/Drawer/Popover/Tooltip (Radix)
           toast      100  ultima palavra, sempre visivel */
      zIndex: {
        header: "30",
        "bottom-nav": "40",
        fab: "45",
        overlay: "50",
        toast: "100",
      },
      minHeight: { touch: "2.75rem" },
      minWidth: { touch: "2.75rem" },
      height: {
        header: "3.5rem",
        "header-lg": "4.5rem",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "collapsible-down": {
          from: { height: "0", opacity: "0" },
          to: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
        },
        "collapsible-up": {
          from: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
          to: { height: "0", opacity: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        /* Entrada escalonada de cards: sobe 8px e assenta. */
        rise: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        /* Halo do FAB em destaque. So `box-shadow`: nao reflui layout, nao
           empurra o vizinho e nao pinta pixel fora do circulo. */
        "fab-pulse": {
          "0%, 100%": { boxShadow: "var(--shadow-primary), 0 0 0 0 hsl(var(--primary) / 0.42)" },
          "55%": { boxShadow: "var(--shadow-primary), 0 0 0 12px hsl(var(--primary) / 0)" },
        },
        /* Cursor falso do campo de codigo (input-otp). */
        "caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" },
        },
        /* Respiro do balao de onboarding: 3px, quase subliminar. */
        "hint-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-3px)" },
        },
        /* Halo do sinal de "e-mail a caminho": um anel que expande e some.
           So `transform` e `opacity` — compositor puro, zero reflow. */
        halo: {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "60%": { opacity: "0", transform: "scale(1.4)" },
        },
        /* Orbita lenta do arco de 1px: o gesto da marca em estado de espera. */
        "orbit-ring": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "collapsible-down": "collapsible-down 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
        "collapsible-up": "collapsible-up 0.16s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
        rise: "rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
        "fab-pulse": "fab-pulse 2.6s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "hint-float": "hint-float 3.4s cubic-bezier(0.45, 0, 0.55, 1) infinite",
        "caret-blink": "caret-blink 1.2s ease-out infinite",
        halo: "halo 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite",
        "orbit-ring": "orbit-ring 9s linear infinite",
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(0.22, 1, 0.36, 1)",
        entrance: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
