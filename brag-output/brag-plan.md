# Brag Plan: Orbi

## What is this app?
Orbi is a Brazilian personal-finance SaaS: you upload the raw bank statement (PDF, CSV, OFX or even a photo), an AI classifier turns cryptic lines like `PAG*PADARIA CENTRAL` into categories, and a predictive engine tells you the exact day your cash runs out.

## The angle
Bank statements speak gibberish. Orbi translates. The video opens on the mess every Brazilian recognises (`PAG*PADARIA CENTRAL`, `POSTO ESTRELA 0231`, `PIX RECEBIDO SALARIO`), then lets the product's own hero line land: **Importe o extrato. O Orbi organiza.** From there it shows the product doing the thing (rows getting categorised one by one), then the flex nobody else ships: a forecast that names the day the money runs out. The whole piece lives in Orbi's own "deep space" landing palette, with orbits, stars and one restrained blue accent.

## Hook (first 2-3 seconds)
Raw uppercase bank descriptors drift in out of the dark in monospace, like noise. A clean headline cuts through: **"Seu extrato, do jeito que o banco manda."** You instantly know the problem without a single word of marketing.

## Key moments (the middle)
- The hero line slams in on two lines, "O Orbi organiza." in the accent blue, with the orbit rings turning behind it.
- The HeroLedger card (`extrato-setembro.pdf · Importação · 5 lançamentos`) classifies its rows one after another: the scan glyph becomes the category icon, the skeleton becomes `Alimentação`, `Transporte`, `Salário`, `Saúde`, `Assinaturas`, the progress bar fills, and the status flips from **Classificando** to **Categorizado**.
- Forecast tile: the real balance line draws, the dashed projection dives through zero, and a red alert dot lands with **Ruptura prevista 14/11 · −R$ 612,40**.

## Outro / punchline
The Orbi planet mark lands in the centre of the orbit rings. "Orbi" wordmark. Final line, verbatim from the landing page: **"Seu próximo extrato já chega organizado."** Then the footer: `Plano Free para sempre · app.meuorbi.com`.

## User flow worth showing
1. Entry: upload `extrato-setembro.pdf` (5 lançamentos).
2. Key action: the AI classifies each line (status "Classificando", counter "n de 5 categorizados").
3. Result: "Categorizado", and the month is readable. Then the forecast says when the cash tightens.

## Tone
- Preset: polished
- Creative direction: quiet premium fintech film at night: Orbi's star-field landing page, turned into motion
- Interpretation: few scenes, confident holds, soft crossfades and slides, a single blue accent, and no jokes except the gibberish of the bank lines. The product carries the energy.

## Format: landscape, 1920x1080
## Duration: 21.5s

## Visual identity (from the project)
- Background: `hsl(216 60% 9%)` (`.lp-space --background`), sunken `hsl(217 62% 7%)`
- Card: `hsl(216 52% 13%)`, border `hsl(215 38% 22%)`
- Accent: `hsl(213 84% 66%)` (`--primary` in space bands)
- Text: `hsl(214 32% 94%)`, muted `hsl(214 22% 70%)`
- Success: `hsl(158 46% 58%)`, alert/down: warm red
- Display font: Inter Tight 600, tracking −0.038em (fallback: the closest neutral grotesk installed, since Google Fonts is blocked in this environment)
- Body font: Inter
- Strongest visual element: HeroLedger card with the double-bezel frame (`.lp-bezel`) over the OrbitField rings and StarField

## Share copy (draft)
Seu extrato chega falando "PAG*PADARIA CENTRAL". O Orbi devolve categorias, saldo projetado e o dia exato em que o caixa aperta.

## Audio direction
- Role: warm, steady bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3` (steady and clean, ~110 BPM)
- Music treatment: starts at 0 with a short fade-in, sits at about 0.32, fades out over the last ~1.2s under the final line
- Music cue guidance: preset `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` read. Strong cues to target: 8.74s (mid-classification), 13.11s (forecast chart starts drawing), 17.47s (Orbi mark lands), and 18.56s (final line). Beat grid for the row sequence: 7.64, 8.19, 8.74, 9.29, 9.83. Category labels are 1 word each and stay on screen as a set, so every-beat spacing is acceptable.
- Audio-reactive treatment: subtle. Music RMS makes the orbit light glow and the accent planet halo breathe. No waveform or equalizer visuals.
- SFX posture: sparse, low-HF-risk picks, motion-matched
- Audio-coupled moments: the hook line lands (soft impact), each row classified (very quiet click), "Categorizado" (soft bong), alert dot (soft thud), logo (bell)
- Restraint rule: never more than one accent per beat; no bright or repeated casino/ui clicks

## Storyboard

### Scene 1: O extrato cru (0.0–3.3s, 3.3s)
Deep-space background with stars. Raw bank descriptors from the source (`PAG*PADARIA CENTRAL`, `POSTO ESTRELA 0231`, `PIX RECEBIDO SALARIO`, `FARMACIA BEM VIVER`, `STREAMING MENSAL`, `ENERGIA ELETRICA 09/26`, `APLICACAO CDB 30D`) drift in, muted mono and slightly skewed. At about 0.6s the headline arrives: "Seu extrato, do jeito que o banco manda." It holds about 2.3s.
Sequential/interaction: yes. Raw lines fade in staggered (accents only, not required reading).
Audio intent: open calm, then a single soft landing under the headline.
Audio-coupled idea: soft impact on the headline landing.
Music: fade in.
Transition mood: soft. Raw lines blur out while the headline lifts away → Scene 2

### Scene 2: Importe o extrato. O Orbi organiza. (3.3–6.6s, 3.3s)
OrbitField rings rotating on the right half, light glow. Hero headline reveals line by line: "Importe o extrato." then "O Orbi organiza." (accent). Below: "Plano Free para sempre · Sem cartão para começar" in muted text.
Sequential/interaction: two lines masked-reveal about 0.55s apart (one beat), full headline held ~2s.
Audio intent: confident arrival.
Audio-coupled idea: none. Let the music carry it.
Transition mood: slide. The ledger card rises in from below as the headline exits → Scene 3

### Scene 3: A IA categoriza (6.6–12.6s, 6.0s)
Left: "A IA lê o extrato do banco por você." Right: the HeroLedger card, recreated faithfully (file row, status pill, 5 rows, footer counter and progress bar). Rows classify on the beat grid (7.64 → 9.83). Status flips to "Categorizado" and the counter reaches "5 de 5 categorizados". Then a callout fades in under the title: "Corrigiu uma vez, está aprendido." It holds ~2s.
Sequential/interaction: yes, 5 rows classify one by one, then the whole set holds.
Audio intent: tidy, satisfying ticks, then a soft "done".
Audio-coupled idea: quiet click per row; soft bong at "Categorizado".
Transition mood: soft crossfade → Scene 4

### Scene 4: O dia em que o caixa aperta (12.6–17.2s, 4.6s)
Title: "Saiba hoje o dia em que o caixa aperta." Forecast well: "Saldo real hoje R$ 3.240,10" and "Ruptura prevista 14/11 · −R$ 612,40". The chart draws the real line (starting on the 13.11 cue), then the dashed projection crosses the zero line, and the alert dot pops with the figure highlighted. Axis: 01/09 · hoje · +90 dias.
Sequential/interaction: line draw, then projection, then alert.
Audio intent: tension, then a clear mark.
Audio-coupled idea: soft thud when the alert dot lands.
Transition mood: slow crossfade to the orbit → Scene 5

### Scene 5: Orbi (17.2–21.5s, 4.3s)
Orbit rings centred; the Orbi planet mark scales in at the centre (17.47 cue), with the "Orbi" wordmark. Final line (18.56 cue): "Seu próximo extrato / já chega organizado." Footer at ~19.7s: "Plano Free para sempre · app.meuorbi.com". Holds to the end while the music fades.
Sequential/interaction: mark, then line, then footer.
Audio intent: resolved, premium payoff.
Audio-coupled idea: bell on the mark landing, letting it ring over the music fade.
Transition mood: end on hold.

**Music mood for this video:** steady, clean, upbeat-premium
**Audio summary:** a clean bed fades in under the raw-statement noise, gets tidy clicks as the AI sorts the rows, one soft thud at the cash-break alert, and a bell as the Orbi mark lands before the bed fades out.
