# Schnitzery design system (Release F)

Started 2026-10-22. Goal: every screen built from the same tokens and components, so the
portal looks like one product instead of 65 hand-styled pages.

## Audit (before Release F)
**Pages reviewed:** 65 · **Score: 38/100** — tokens exist, but most screens bypass them.

| Category | Defined | Hand-coded in pages |
|---|---|---|
| Colours | 25 CSS variables (legacy names: `--white` = text, `--black` = page) | 518 hex/rgba values; 65× old gold `#d4a847` |
| Typography | 2 families, no scale | 913 `fontSize` literals (12/13/14 px dominate) |
| Spacing | none | ~1,800 inline `style={{…}}` with ad-hoc padding/margins |
| Radius | 2 (`--radius`, `--radius-sm`) | 8/10/12/14/20 px mixed |
| Icons | `<Icon>` maps emoji → lucide (good) | — |

| Component | Copies found | Problems |
|---|---|---|
| KPI tile (`Stat`/`Kpi`/`Metric`) | 11 | value 18–26 px, 3 fonts, centred vs left; **`#fff` default = invisible text in light mode** (branches, hours) |
| Form field (`Field`) | 9 | label sometimes not linked to the input |
| Tabs / switches (`TabBtn`) | 5 + `.hub-tabs` | inline styles, no `aria-pressed` on 4 |
| Card / input / button style objects | 50 local `const card/input/btn` | each page slightly different |

## Tokens (globals.css, end of file)
Use the semantic names in new code; legacy names stay for old CSS.

| Token | Meaning |
|---|---|
| `--page` `--surface` `--surface-2` `--surface-3` | page background → raised surfaces |
| `--text` `--text-muted` `--text-strong` | body text, secondary text, emphasised secondary |
| `--action` `--on-action` `--gold-ink` | primary action fill, its text, action-coloured text/links |
| `--success` `--warn` `--danger` `--info` (+ `-soft`) | status colours and their tinted backgrounds |
| `--accent-soft` `--accent-line` | action-tinted background / border (static — no `color-mix`, iOS 15.4 safe) |
| `--space-1…12` | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 px |
| `--text-xs…2xl` | 12 · 13 · 14 · 16 · 20 · 24 px |
| `--radius-sm` `--radius` `--radius-lg` · `--control-h` | 8 · 12 · 14 px · 44 px touch target |

## Components (`src/components/ui.tsx`)
| Component | Use for | Notes |
|---|---|---|
| `PageHeader` | title + subtitle + actions | renders the page's only `<h1>` |
| `Panel` | card with heading row | `<section>` + `<h2>` |
| `Stat`, `StatGrid` | KPI tiles | `tone` = success/warn/danger/info/action; `variant` = tile/compact/row; `color` only during migration |
| `Field` | label + control + hint/error | wraps the control in `<label>`; error is `role="alert"` |
| `TabButton` (in `.hub-tabs`) | page-level tabs | `aria-pressed` |
| `Segmented` | small in-card switches | employee screens |
| `Badge` | status chips | success/warn/danger/default |
| `EmptyState`, `ErrorState` | no data / failed load with retry | never show an empty list for a failed load |
| Buttons | `.btn-gold` (primary), `.btn-secondary` | one primary action per area |
| Tables | `.table-scroll` > `table.data-table` | `role="region"` + `tabIndex={0}` on the wrapper |

Preview: render the kit with `scripts/checks/workspace-ux.cjs` harness or open the
generated `ui-kit-preview.html` (synthetic data).

### Do / don't
| Do | Don't |
|---|---|
| `<Stat label="Sales" value={eur(x)} tone="success" />` | `<div style={{ fontSize: 22, color: "#27ae60" }}>` |
| `var(--text)`, `var(--space-4)` | `"#fff"`, `padding: 14` |
| `<Field label=…><input className="form-input"/></Field>` | a `<div>` label next to an unlabelled input |
| `ErrorState` with retry | empty table when the request failed |

## Guard (CI)
`scripts/checks/design-tokens.cjs` counts inline styles, hard-coded colours, font-size
literals, `color-mix()` and local copies of kit components, and **fails if any count
grows** past `scripts/checks/design-baseline.json`. After migrating a page, run
`node scripts/checks/design-tokens.cjs --update` and commit the lower baseline.

## Migration status
**Done in F1:** tokens; kit; all 11 KPI tiles, 9 fields and 5 tab switches now use the kit
(18 pages); 42 `color-mix()` replaced by static tokens; 7 light-mode invisible-text bugs fixed.

**Done in F2 (codemods, `scripts/ops/style-codemod.py` + `color-codemod.py`, re-runnable):**
- 46 most repeated inline style objects → token utilities (`.ui-muted`, `.ui-title`, `.u-row`, `.ui-empty-msg`, `.ui-denied`, …) across 66 files — inline styles 1,716 → 1,217, font-size literals 877 → 666.
- Text/border colours and named colour constants → theme tokens (`--success/--danger/--info/--warn/--gold-ink/--gray`); **all `rgba(255,255,255,…)` / grey borders and tints → `--border` / `--surface-2`** (those were invisible in light mode). Hard-coded colours 597 → 428. Strong button fills, team colours, kiosk and scanner overlays (fixed dark screens) deliberately untouched.

**Next (page by page, most inline styles first), each with before/after screenshots:**
inventory (87) · attendance (67) · analytics (55) · attendance-hub (51) · transfers (45) ·
waste (44) · cover (44) · roster (43) · overview (42) · staff (40) · schedule/compare (40) ·
temp · expiry · export · geofence · labor · schedule-hub · schedule · summary · search.
Per page: replace local `card/input/btn` style objects with classes, `fontSize`/padding with
tokens, hex colours with `tone`/status tokens, `<div className="page-title">` with `PageHeader`.
