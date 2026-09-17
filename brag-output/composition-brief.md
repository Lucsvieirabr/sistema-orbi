# Composition Brief: Orbi

## Objective
Create a short, polished launch-style brag video for Orbi (Sistema Orbi, app.meuorbi.com).

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape, 1920x1080, 30fps
- Duration: 21.5s

## Environment note (renderer fallback)
Hyperframes could not be installed: the session's egress policy returns 403 for the npm registry (`hyperframes`, `gsap`) and for Google Fonts. The composition is therefore a single self-contained HTML file with a pure, seekable `render(t)` function (no wall-clock animation, so every frame is deterministic). `render.py` drives the preinstalled Chromium with Playwright, captures each frame, and ffmpeg encodes and mixes the audio. `hyperframes check` could not run. The equivalent checks were done by hand: duration, asset paths are relative, every frame renders, readable holds, and frame review of the output.

## Source Material
- Project root: `sistema-orbi/`
- Primary files read: `index.html`, `src/pages/Landing.tsx`, `src/components/landing/{HeroLedger,FeatureShowcase,OrbitField,PricingSection}.tsx`, `src/components/landing/landing.css`, `src/index.css`, `src/App.tsx`, `CLAUDE.md`
- Product name: Orbi
- Tagline: "Importe o extrato. O Orbi organiza."
- Key UI to recreate: HeroLedger (import + AI classification card), ForecastTile chart (Ruptura prevista), OrbitField + StarField
- Verbatim copy:
  - Importe o extrato. / O Orbi organiza.
  - A IA lê o extrato do banco por você.
  - extrato-setembro.pdf · Importação · 5 lançamentos · Classificando / Categorizado · n de 5 categorizados
  - Corrigiu uma vez, está aprendido.
  - Saiba hoje o dia em que o caixa aperta. · Saldo real hoje R$ 3.240,10 · Ruptura prevista 14/11 · −R$ 612,40
  - Seu próximo extrato já chega organizado.
  - Plano Free para sempre · Sem cartão para começar

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium fintech film at night, set in Orbi's star-field landing page
- Hook: raw bank descriptors as noise, then "Seu extrato, do jeito que o banco manda."
- Outro: Orbi mark lands in the orbit, then "Seu próximo extrato já chega organizado."
- Avoid: generic SaaS language, abstract filler, restyling Orbi's palette

## Visual Identity
- Background `hsl(216 60% 9%)`, card `hsl(216 52% 13%)`, border `hsl(215 38% 22%)`
- Text `hsl(214 32% 94%)`, muted `hsl(214 22% 70%)`, accent `hsl(213 84% 66%)`, success `hsl(158 46% 58%)`
- Display: Inter Tight 600 → fallback TeX Gyre Heros Bold with tight tracking (only local fonts are available)
- Mono for raw bank lines: DejaVu Sans Mono
- Double-bezel surfaces (`.lp-bezel`), orbit rings with accent satellites, star field

## Storyboard
See `brag-plan.md`.
1. O extrato cru — 3.3s
2. Importe o extrato. O Orbi organiza. — 3.3s
3. A IA categoriza (HeroLedger flow) — 6.0s
4. O dia em que o caixa aperta (forecast) — 4.6s
5. Orbi (outro) — 4.3s

## Audio
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, volume 0.32, 0.6s fade-in, 1.2s fade-out
- Cue source: bundled preset (vol-12). Beat-locked: forecast draw 13.11s, mark 17.47s, final line 18.56s. Beat-grid: rows 7.64/8.19/8.74/9.29/9.83s
- Audio-reactive: per-frame RMS (ffmpeg → numpy → `assets/rms.js`) drives the orbit light and planet halo
- SFX (low HF risk): impactSoft_medium_001 (hook), interface/click_003 ×5 (rows), interface/bong_001 (Categorizado), impactSoft_medium_004 (alert), impactBell_heavy_000 (mark)
