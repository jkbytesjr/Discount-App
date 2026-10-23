# DESIGN-GLASSMORPHISM.md — Dark Glassmorphism Design System (v2)

> Single source of truth for the app's look and feel. Every screen, component and
> state must follow this file. Do NOT keep legacy styling: replace it.
> Reference images (if present) live in `docs/design-refs/` — look at them with the
> Read tool before restyling and match their mood.
> A working reference page of this exact system is the "Glass Dashboard Preview"
> artifact; if a copy exists in the repo (`docs/design-refs/glass-dashboard.html`),
> open it and match it.

## 1. Concept

A dark, premium fintech interface. Behind everything sits a **vivid, recognisable
credit-card backdrop** (large gradient cards with chips, number bars and card-network
circles in magenta/orange, cyan/violet and violet/magenta, lightly blurred so they
still read as cards). All content sits on **frosted-glass panels that are genuinely
see-through**: you should be able to make out card colours and shapes behind each
panel. Feels: luxurious, editorial, fluid, glowing, calm.

## 2. Design tokens (define once as CSS variables / theme config)

```css
:root {
  /* Base */
  --bg-base: #07060f;

  /* Vibrant glows (backdrop blobs and card gradients) */
  --glow-magenta: #ff2d9b;
  --glow-violet:  #7b3cff;
  --glow-cyan:    #19d3ff;
  --glow-orange:  #ff8a3d;

  /* Glass surfaces: a light-catching gradient over a faint dark tint */
  --glass-tint:        rgba(10, 8, 24, 0.20);   /* readability layer, keep 0.15–0.25 */
  --glass-sheen:       linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04) 60%);
  --glass-sheen-hover: linear-gradient(135deg, rgba(255,255,255,0.26), rgba(255,255,255,0.08) 60%);
  --glass-bg-dark:     rgba(10, 8, 24, 0.42);   /* tables, charts, dense content */
  --glass-border:      rgba(255, 255, 255, 0.18);
  --glass-border-top:  rgba(255, 255, 255, 0.35);
  --glass-blur:        20px;                    /* 15px on mobile */
  --glass-saturate:    180%;
  --glass-shadow:      0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25);

  /* Text */
  --text-primary:   #ffffff;
  --text-secondary: rgba(255,255,255,0.76);
  --text-muted:     rgba(255,255,255,0.55);
  --line:           rgba(255,255,255,0.09);

  /* Accent */
  --accent-gradient: linear-gradient(135deg, #ff2d9b 0%, #7b3cff 55%, #19d3ff 100%);
  --accent-solid: #9b5cff;

  /* Status */
  --success: #3dffb0; --warning: #ffc83d; --danger: #ff4d6d; --info: #19d3ff;

  /* Shape & motion */
  --radius-sm: 12px; --radius-md: 20px; --radius-lg: 28px; --radius-pill: 999px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1); --dur: 240ms;

  /* Type */
  --font-display: "Montserrat", "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-body:    "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-numeric: "Montserrat", "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;

  color-scheme: dark;
}
```

## 3. Typography (premium geometric pairing)

The premium feel comes from **large, light-weight Montserrat for display moments**
(thin strokes, tight tracking, lots of air) set against **Manrope for everything
functional**. Montserrat's wide geometric forms at weight 300 read as luxurious
fintech, similar to premium card and private-banking brands. Do not use Inter, Roboto,
Arial or system fonts as the primary face.

| Role | Font | Use |
|---|---|---|
| Display / hero | **Montserrat** 300 (Light), 300 italic for the accent word | Page title, big balances, logo wordmark (600) |
| Figures and headings | **Montserrat** 400–500 | KPI figures (400), panel headings (500) |
| UI / body | **Manrope** 400/500/600/700/800 | Navigation, buttons, inputs, tables, labels, paragraphs |
| Card numbers / references | **Montserrat** 500, `font-variant-numeric: tabular-nums` | Card numbers, transaction references, codes (tracked 0.04–0.1em) |

Load from Google Fonts:
`https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap`
(or `next/font` / self-hosted equivalents). Always declare the fallback stacks above.

Rules:
- Hierarchy comes from **size and weight contrast**: huge and light (300) for hero
  numbers and titles, medium (500) for headings, regular for body.
- Scale: page title 44px (mobile 32), hero balance 62px (mobile 42), KPI figure 26px,
  panel heading 21px, logo 22px/600, body 14px, labels 11px.
- Large display text: line-height 1.05–1.1, **letter-spacing -0.035em to -0.04em**,
  plus a soft `text-shadow: 0 2px 24px rgba(0,0,0,.25)` so thin strokes stay legible over
  bright card colours. Never go below weight 300, and never use weight 300 under 28px.
- Emphasise one word of the page title in *italic 300* with the accent gradient text
  (`background-clip: text`), e.g. "Good evening, *Jai*". Use this device once per page.
- Labels / eyebrows: Manrope 600-700, 11px, **uppercase, letter-spacing 0.14-0.16em**,
  colour `--text-muted`. Currency codes next to large amounts: Manrope 700, 15px,
  uppercase, letter-spacing 0.14em, in `--text-secondary`.
- Tables, forms and long text stay in Manrope. Use `font-variant-numeric: tabular-nums`
  on every aligned number.
- Text on glass is white or white-alpha, never grey.

## 4. Page background (the signature look)

Fixed, full-viewport, behind everything (`position: fixed; inset: 0; z-index: -1;
pointer-events: none`). The goal is that **glass panels visibly reveal vivid card
shapes and colour behind them**, so the cards must be sharp enough to recognise.

Layers, bottom to top:
1. `--bg-base`.
2. **3 soft colour blobs** (magenta, violet, cyan): 520–600px, `filter: blur(100px)`,
   opacity 0.6–0.75, slow drift animation (28–38s, transform only).
3. **3 large vivid credit cards** (the hero of the backdrop), absolutely positioned so
   they straddle and sit partly behind the main panels and extend off-screen:
   - Size 640–760px wide, aspect ratio ~1.586, `border-radius: 30px`, 1px white-alpha
     border, deep shadow, inner top highlight.
   - Gradients: card 1 magenta → coral → orange (top-left, rotate -14°); card 2 cyan →
     blue → violet (right, rotate +12°); card 3 violet → purple → magenta (bottom,
     rotate -7°). Each has a soft white radial highlight in one corner.
   - Detail so they read as cards: gold chip (top-left area), a row of number bars
     (repeating-linear-gradient), two overlapping translucent circles bottom-right.
   - **Blur only 3–8px** (different per card for depth), opacity 0.9–0.98.
     Do NOT blur them into mush (the old 18–40px was too much) and do not drop opacity
     below 0.85, or the glass has nothing to show through.
4. Grain overlay (SVG feTurbulence, opacity 0.05, `mix-blend-mode: overlay`).
5. Light vignette: radial gradient to `rgba(0,0,0,0.35)` at the edges only.

Mobile: shrink the cards to ~360–420px wide, reduce blob blur to 70px.
`prefers-reduced-motion`: disable blob drift.

Reference snippet for one card:

```css
.vc { position:absolute; border-radius:30px; overflow:hidden;
  border:1px solid rgba(255,255,255,.4);
  box-shadow:0 30px 80px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.55); }
.vc::before { content:""; position:absolute; left:7%; top:22%; width:15%; aspect-ratio:1.3;
  border-radius:14px; background:linear-gradient(135deg,#ffe9a0,#ff9d4d); }            /* chip */
.vc::after  { content:""; position:absolute; right:8%; bottom:9%; width:17%; aspect-ratio:1;
  border-radius:50%; background:rgba(255,255,255,.4);
  box-shadow:-4.2vmin 0 0 rgba(255,255,255,.26); }                                       /* network circles */
.vc1 { width:760px; height:480px; left:-150px; top:4vh; transform:rotate(-14deg); filter:blur(5px);
  background:radial-gradient(circle at 20% 15%,rgba(255,255,255,.55),transparent 42%),
             linear-gradient(135deg,#ff2d9b,#ff6a5c 55%,#ff8a3d); }
```

## 5. Glass component recipe

```css
.glass {
  background-color: var(--glass-tint);
  background-image: var(--glass-sheen);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  border-top-color: var(--glass-border-top);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow);
}
.glass-dark { background-color: var(--glass-bg-dark); }          /* tables, charts, long text */
.glass-interactive:hover { transform: translateY(-2px); background-image: var(--glass-sheen-hover);
  border-color: rgba(255,255,255,.3); box-shadow: 0 12px 40px rgba(123,60,255,.3), inset 0 1px 0 rgba(255,255,255,.3); }
```

- Use plain `.glass` for hero panels, sidebar, topbar, KPI tiles, modals (they should
  clearly show the cards behind). Use `.glass-dark` only where there is dense text
  (tables, charts, budgets) so contrast stays ≥ 4.5:1.
- Never use an opaque fill on a main panel. If the card colours behind a panel are not
  visible, the tint is too dark or the backdrop is too blurred.
- Solid-colour fallback via `@supports not (backdrop-filter: blur(1px))`.

## 6. Component rules

- **App shell**: left sidebar is a floating glass panel (16px margin, radius 28px), not
  edge-to-edge; below 900px it becomes a horizontal scrolling bar. Top bar is glass.
  Content max-width ~1320px, 16px gaps.
- **Cards / panels**: `.glass`, padding 22–28px, radius 28px. Panel headings use Montserrat
  500 (21px) with a small muted Manrope subtitle (13px).
- **Hero balance panel**: label (uppercase, tracked) → huge light Montserrat amount → success pill
  → actions; on the right a tilted (-3°) gradient credit card widget with chip,
  Montserrat number, reflection sweep on hover.
- **Buttons**: Primary = `--accent-gradient`, white Manrope 600, 14px radius, glow
  `0 8px 24px rgba(123,60,255,.45)`. Secondary = glass + border. Min height 44px.
  Focus ring 2px `--glow-cyan` + 2px offset.
- **Inputs**: `rgba(255,255,255,0.06)` fill, 1px glass border, radius 14px, focus =
  `--accent-solid` border + 4px soft glow ring.
- **Segmented controls**: glass pill container, pressed item `rgba(255,255,255,.16)`.
- **Tables**: `.glass-dark`, header Manrope 11px uppercase tracked muted, row dividers
  `--line`, row hover `rgba(255,255,255,.06)`, amounts right-aligned tabular, avatars as
  coloured 36px rounded squares with initials.
- **Modals / drawers / menus**: `.glass` with blur 32px, scrim `rgba(5,4,15,.55)`.
- **Badges**: pill, tinted status colour at 15% fill + 38% border + coloured text.
- **Charts**: transparent background inside `.glass-dark`, gradient line + area fill,
  gridlines `rgba(255,255,255,.09)`, dashed cyan budget line, emphasised end point.
- **Progress bars**: 8px, `rgba(255,255,255,.1)` track, gradient fills.
- **Icons**: 1.5px stroke, round caps, white-alpha; active nav icon uses gradient stroke.
- **Skeletons**: shimmering white-alpha gradient. **Scrollbars**: thin translucent.

## 6b. Liquid-glass selection motion (signature interaction)

Whenever the user moves between options in a **navigation list, segmented control, tab
bar or filter group**, a single glass "droplet" indicator travels from the old item to the
new one like liquid: it **stretches toward the target, squeezes slightly across its
width, then settles with a small squash-and-overshoot**. It replaces the static active
background on those items (the active item only changes text colour and icon gradient).

Behaviour:
- One shared indicator element per group (`.liquid`), absolutely positioned inside the
  group container (`position: relative`); items sit above it (`position: relative; z-index: 1`).
- Motion (~680ms, Web Animations API): keyframes
  `from rect` -> `union of from+to rect, cross-axis squeezed ~8-14%` (at 42%) ->
  `to rect with scale(1.07, .93)` (horizontal) or `scale(.95, 1.07)` (vertical) (at 76%) ->
  `to rect, scale(1)`. Per-segment easings: `cubic-bezier(.4,0,.2,1)`,
  `cubic-bezier(.2,.9,.3,1)`, `ease-out`.
- While moving, add `.moving`: brighter (`brightness(1.22) saturate(1.2)`) with a larger
  magenta/cyan glow, removed on finish.
- Indicator look: gradient glass fill (white .30 -> .09, faint magenta), 1px white .42
  border, inner top highlight + inner bottom violet glow, outer violet glow,
  `backdrop-filter: blur(6px) saturate(200%) brightness(1.15)`, and a soft specular
  highlight (`::after`, top 38%). Radius 14px (nav) or 10px (segmented controls).
- Press feedback on every button, nav item and segment: `transform: scale(.95-.96)`
  on `:active` with a spring-like `--ease` transition.
- Navigation items also smooth-scroll to their section when they have a target.
- Re-snap (no animation) on resize, after fonts load and on `load`.
- Respect `prefers-reduced-motion`: no animation, indicator simply jumps to the item.
- Build it as a reusable primitive (`LiquidIndicator` / `useLiquidSelection`) used by
  Sidebar nav, SegmentedControl, Tabs and any filter chips. Keep keyboard behaviour and
  `aria-current` / `aria-pressed` states correct; the indicator is `aria-hidden`.

Reference implementation (framework-agnostic; port to React/Vue/etc. as needed):

```js
function liquid(box, sel, isActive) {
  const items = [...box.querySelectorAll(sel)];
  const ind = Object.assign(document.createElement('span'), { className: 'liquid' });
  ind.setAttribute('aria-hidden', 'true'); box.prepend(ind);
  const R = el => ({ l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });
  const K = (r, tf, offset) => ({ left: r.l+'px', top: r.t+'px', width: r.w+'px', height: r.h+'px', transform: tf, offset });
  const place = r => Object.assign(ind.style, { left: r.l+'px', top: r.t+'px', width: r.w+'px', height: r.h+'px' });
  let cur = null, anim = null;
  const snap = el => { cur = el; anim?.cancel(); place(R(el)); ind.style.opacity = 1; };
  function go(el) {
    if (el === cur) return;
    const from = R(ind), to = R(el);
    const vertical = Math.abs(to.t - from.t) > Math.abs(to.l - from.l);
    const u = { l: Math.min(from.l, to.l), t: Math.min(from.t, to.t) };
    u.w = Math.max(from.l + from.w, to.l + to.w) - u.l;
    u.h = Math.max(from.t + from.h, to.t + to.h) - u.t;
    if (vertical) { u.l = to.l + to.w * .04; u.w = to.w * .92; } else { u.t = to.t + to.h * .07; u.h = to.h * .86; }
    anim?.cancel(); cur = el; place(to); ind.classList.add('moving');
    const kf = [K(from,'scale(1)',0), K(u,'scale(1)',.42),
                K(to, vertical ? 'scale(.95,1.07)' : 'scale(1.07,.93)', .76), K(to,'scale(1)',1)];
    ['cubic-bezier(.4,0,.2,1)','cubic-bezier(.2,.9,.3,1)','ease-out'].forEach((e,i) => kf[i].easing = e);
    const a = anim = ind.animate(kf, { duration: 680 });
    a.onfinish = () => { if (anim === a) { anim = null; ind.classList.remove('moving'); } };
  }
  items.forEach(el => el.addEventListener('click', () => go(el)));
  snap(items.find(isActive) || items[0]);
}
```

## 7. Layout, spacing, motion

- 4px grid; spacing 4/8/12/16/24/32/48/64. 12-column content grid, 16px gap.
- Avoid more than ~3 stacked glass layers.
- Transitions `var(--dur) var(--ease)` on background, border, transform, shadow.
- Section entrance: fade + 12px rise, 60ms stagger (start from `opacity: 0.001`, never
  leave content invisible at rest). Nothing bouncy.

## 8. Accessibility & performance (non-negotiable)

- Text contrast on glass ≥ 4.5:1: if bright card colours sit behind small text, use
  `.glass-dark` or raise `--glass-tint` alpha to 0.3, never remove the see-through effect
  from hero panels entirely.
- Visible keyboard focus on every interactive element.
- ≤ ~6 simultaneous large `backdrop-filter` surfaces; no blur on individual list rows.
- Animate only `transform` and `opacity`; honour `prefers-reduced-motion`.
- Mobile: blur 15px, smaller cards (360–420px), fewer effects.

## 9. Implementation checklist for the agent

1. Read this file and any images/HTML in `docs/design-refs/`.
2. Inspect the stack (framework, CSS approach: Tailwind / CSS modules / styled-components / MUI) and follow it.
3. Install/load the two font families (Montserrat, Manrope); centralise tokens (CSS variables + theme extension).
4. Add the global backdrop component once at the app root: blobs + 3 vivid credit cards + grain + vignette.
5. Build primitives: `LiquidIndicator` (section 6b), `GlassCard`, `Button`, `Input`, `Select`, `SegmentedControl`, `Modal`, `Badge`, `Table`, `Sidebar`, `Topbar`, `CreditCard`, `StatTile`.
6. Wire the liquid indicator into the sidebar, segmented controls, tabs and filters. Migrate every page and component to those primitives; remove old colours, flat/opaque cards and default fonts.
7. Update `theme-color` (`#07060f`), `color-scheme: dark`, favicon.
8. Build, lint, type-check; open the app and visually verify each main screen at desktop and mobile widths. Confirm that vivid card colours are visible through the glass panels and that text contrast holds.
9. Do not change business logic, routes, data fetching or component APIs.
