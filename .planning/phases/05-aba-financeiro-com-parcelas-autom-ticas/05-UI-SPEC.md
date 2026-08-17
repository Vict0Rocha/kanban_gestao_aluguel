---
phase: 5
slug: aba-financeiro-com-parcelas-autom-ticas
status: draft
shadcn_initialized: true
preset: base-nova (neutral base, cssVariables, prefix none — see web/components.json)
created: 2026-08-17
---

# Phase 5 — UI Design Contract

> Visual and interaction contract for the "Financeiro" tab, the automatic-parcela list, and the
> ativo/inativo card toggle. Brownfield spec: this project already has a production design
> system (in use by Board and Relatórios) — everything below **extends** it. No new palette, no
> new font, no new spacing scale is introduced.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `web/components.json`) |
| Preset | `base-nova`, baseColor `neutral`, `cssVariables: true`, `prefix: ""`, `rsc: true` |
| Component library | Base UI — package name is **`@base-ui/react`** (`^1.6.0`, `web/package.json:12`), *not* `@base-ui-components/react`; consumed via shadcn's `sheet`/`dialog`/`alert-dialog` wrappers |
| Icon library | `lucide-react` |
| Font | Body: **Plus Jakarta Sans** (`--font-body`, Google Font, via `next/font`) · Heading: **Sora** (`--font-heading-family`, weights 600/700/800) |

**Existing shadcn primitives already installed** (do not re-init, do not duplicate): `button`, `input`, `label`, `textarea`, `separator`, `sheet`, `dialog`, `alert-dialog`, `table`.

**No new shadcn primitive is required for this phase.** The Financeiro list reuses the already-installed `table.tsx` (same primitive `ContractsTable` in Relatórios uses). The situação badge, the mês-atual/próximo-mês switcher, and the card's ativo/inativo pill are all hand-rolled small components in the same style as the project's existing hand-rolled pieces (`ContractStatusBadge`, `StatTile`, `FilterChip` in `reports-view.tsx`) — that is the established project convention for small presentational pieces, not every visual element goes through shadcn.

---

## Spacing Scale

The project does not use a strict 8-point scale — it uses Tailwind's default scale, which includes some in-between steps (12px, 20px, 6px) already in production on cards, panels and tables. This phase reuses those exact tokens; it does not introduce new spacing values.

| Token | Value | Usage (existing, reused as-is) |
|-------|-------|-------|
| 2xs | 4px (`gap-1`) | Icon-to-text gap inside a badge (`ContractStatusBadge`, situação badge) |
| xs ⚠ | 6px (`gap-1.5`) | *Inherited exception, see Exceptions below.* Icon-to-text gap where the icon is slightly larger (nav items, card `inquilino` row) |
| sm | 8px (`gap-2`, `px-2`) | Compact row gaps, filter-chip padding |
| card-pad | 12px (`p-3`) | Card padding on the Board — the ativo/inativo pill lives inside this same padding, no extra inset |
| md | 16px (`p-4`) | `StatTile`/panel padding |
| panel ⚠ | 20px (`p-5`) | *Inherited exception, see Exceptions below.* Table-card padding (`ContractsTable`) — the parcelas table reuses this exact container |
| lg | 24px (`p-6`) | Page-level padding (`p-6` on `ReportsView`, `BoardPage` header) — Financeiro page uses the same |
| section | 32px+ | Not used at this granularity anywhere yet; not introduced here either |

### Exceptions

Two declared values are **not** multiples of 4. Both are inherited Tailwind-default tokens already
in production on surfaces this phase extends — they are **reused, not introduced**:

| Value | Token | Where it already exists in production | Why it is reused rather than normalized |
|---|---|---|---|
| 6px | `gap-1.5` | `app-shell.tsx` nav rows, `CardItem`'s `inquilino` row, `ContractStatusBadge` icon gap | Normalizing to `gap-1`/`gap-2` in the new UI only would make the parcela situação badge visibly misaligned next to the contract badge it mirrors |
| 20px | `p-5` | `ContractsTable`'s container | The parcelas table reuses that container verbatim; changing its padding would fork one shared visual shell into two |

**Rule for the executor:** these two are the *complete* list of permitted non-multiple-of-4 values.
This phase may **not** introduce any additional sub-grid value. Concretely, `py-0.5` (2px),
`gap-0.5`, `p-1.5` and similar are forbidden in the new components — where a tight vertical padding
is wanted (the ativo/inativo pill), use `py-1` (4px), which is both on-grid and identical to the
existing `FilterChip` in `reports-view.tsx`.

---

## Typography

Two independent scales, each capped at **exactly 2 weights**. No new size and no new weight is
introduced — every value below already exists in production (`ReportsView`, `ContractsTable`,
`CardItem`).

### Body scale — Plus Jakarta Sans (`--font-body`) — weights {400, 600}

| Role | Size | Weight | Line Height | Where this phase uses it |
|------|------|--------|-------------|------|
| Micro-label | 12px (`text-xs`) | 600 `font-semibold` | default (~1.4) | Parcela situação badge, "Mês atual"/"Próximo mês" switcher labels, ativo/inativo pill |
| Body | 14px (`text-sm`) | 400 regular | 1.5 | Parcela table rows (valor devido, valor pago, competência), page subheading |
| Body emphasis | 14px (`text-sm`) | 600 `font-semibold` | 1.5 | The imóvel/endereço cell (the row's identity column), matching `ContractsTable`'s `font-medium text-foreground` slot |

**`font-medium` (500) is not part of this contract.** Existing production components use it
(`ContractStatusBadge`, `FilterChip`), and those files are not being restyled — but every *new*
component in this phase uses `font-semibold` where emphasis is wanted. At `text-xs`/`text-sm`, 500
and 600 are one step apart and carry no distinct meaning in this phase's UI, so the contract
collapses them to a single emphasis weight rather than shipping both.

### Heading scale — Sora (`--font-heading`, `font-heading`) — weights {700, 800}

Size-locked: this scale is used *only* for h1 and h2, never for body-scale text.

| Role | Size | Weight | Line Height | Where this phase uses it |
|------|------|--------|-------------|------|
| Section heading (h2) | 16px (`text-base`) | 700 `font-bold` | 1.2 | Parcelas table heading, reusing `ContractsTable`'s h2 treatment verbatim |
| Page title (h1) | 24px (`text-2xl`) | 800 `font-extrabold` | 1.2 | Financeiro page h1, reusing `ReportsView`/`BoardPage`'s h1 treatment verbatim |

Numbers (valor devido, valor pago) use `tabular-nums`, matching `ContractsTable`'s currency/date columns.

---

## Color

Reusing the exact CSS custom properties already defined in `web/src/app/globals.css` — no new hex value is introduced anywhere in this phase.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` `#f4fcf4` (light) / `#0e1a10` (dark) | Page background behind the Financeiro tab, same as Board/Relatórios |
| Secondary (30%) | `--card` `#ffffff` (light) / `#16281a` (dark), `--sidebar` `#18341c` | The parcelas table container (`bg-card`), the nav sidebar |
| Accent (10%) | `--primary` `#74ac1c` (light) / `#8bc93a` (dark) | See the single reserved-for list below — that list is authoritative |
| Destructive | `--destructive` (oklch red) | Not used by this phase — no destructive action exists in Phase 5 (dar baixa/ajustar/conciliar/destravar are Phase 6/7). Reserved token, unused here. |

**Accent reserved for** — this is the one authoritative list; nothing else in this phase's UI may use `--primary` / `bg-primary` / `text-primary`:

*New in this phase:*
1. Active state of the "Financeiro" nav link — `bg-sidebar-primary text-sidebar-primary-foreground`, the already-established `NavLinks` pattern, applied by adding one entry to `NAV_ITEMS`
2. The ativo/inativo pill in its **ativo** state — `border-primary/40 bg-primary/10 text-primary` (a tinted, non-solid accent: it marks a live contract without competing with the `valor` figure beside it)

*Inherited, pre-existing, untouched by this phase:*
3. The card's `valor` figure — `text-primary` in `card-item.tsx`, already in production; this phase only moves it into a flex row, it does not restyle it
4. Focus rings — `--ring` is defined as the same green globally in `globals.css` and applied by the base layer (`outline-ring/50`), not by any component this phase writes

*Explicitly NOT accent:*
- The **active segment of the Mês atual / Próximo mês switcher** uses `bg-card text-foreground shadow-sm` on a `bg-muted` track — a raised-surface treatment, not a color-fill treatment. This is deliberate: the switcher is a view selector, not a call to action, and giving it the brand green would put two competing accent surfaces on the same page as the nav's active link.
- **Parcela situação badges** use the semantic status tokens below, never the brand accent — situação is a status signal, not a call to action.

**Status tokens** (`--status-good` / `--status-warning` / `--status-critical`, already defined and already governed by the rule in `globals.css`: "reserved meaning, never used for series identity, always shipped with an icon + label rather than color alone" — this phase follows that rule exactly, extending `ContractStatusBadge`'s pattern to parcelas):

| Situação (parcela) | Icon (lucide) | Color token | Note |
|---|---|---|---|
| A vencer | `Clock` | `text-muted-foreground` (neutral — not yet a problem) | Only situação a freshly-generated parcela can have besides "vencida" — no baixa exists yet in this phase |
| Vencida | `AlertCircle` | `text-status-critical` | Mirrors `ContractStatusBadge`'s "Vencido" exactly |
| Paga | `CheckCircle2` | `text-status-good` | Cannot occur yet in this phase's data (no `darBaixa` action until Phase 6) — build the badge to support it now so Phase 6 doesn't touch this component |
| Parcial | `CircleDollarSign` | `text-status-warning` | Same note — future-proofed, not reachable this phase |
| Conciliada | `Lock` | `text-muted-foreground` | Same note — future-proofed, not reachable this phase |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | **None in this phase.** Parcela generation is automatic and silent (no "Gerar parcelas" button exists — PARCELA-01 explicitly forbids one). The only interactive write in this phase is the ativo/inativo toggle on the card, which is not a CTA in the traditional sense (see Toggle row below). |
| Toggle label (card, ativo state) | `Ativo` |
| Toggle label (card, inativo state) | `Inativo` |
| Toggle `aria-label` | `"Marcar {endereco} como inativo"` / `"Marcar {endereco} como ativo"` (mirrors the existing `aria-label="Excluir card"` pattern — always names the concrete card, never a bare "Toggle") |
| Nav label | `Financeiro` |
| Sub-view label (mês atual) | `Mês atual` |
| Sub-view label (próximo mês) | `Próximo mês` |
| Page heading (h1) | `Financeiro` |
| Page subheading | `Parcelas do mês atual e do próximo mês de cada contrato ativo.` (mirrors the existing subheading tone: `"Uma visão geral da carteira para apoiar a decisão do dia."` on Relatórios) |
| Table heading (h2, inside the list container) | `Parcelas — mês atual` / `Parcelas — próximo mês` (matches `ContractsTable`'s h2 pattern, "Situação dos contratos") |
| Empty state heading/body — no active contracts at all | *(no separate heading — one paragraph, matching `ContractsTable`'s empty-state style exactly)*: `Nenhum contrato ativo no momento. Marque um contrato como ativo no board para ele começar a gerar parcelas automaticamente.` |
| Empty state — active contracts exist but this competência has no rows yet (edge case: generation ran but every contract's `periodo_fim` excludes this month) | `Nenhuma parcela para este período. Contratos ativos sem parcela aqui já passaram do período contratado.` |
| Empty state — no board at all | Reuse verbatim: `Nenhum board encontrado.` (already the exact copy on `BoardPage`) |
| Error state (generation or fetch fails) | `Não foi possível carregar as parcelas deste mês. Tente novamente.` — routed through the same `erroDoBanco()`-style sanitization as the rest of the app; never a raw Postgres message. Rendered as an inline message inside the table container (same visual slot as the empty-state paragraph), not a toast — this is a load failure, not a reverted write. |
| Error state (toggle write fails) | Reuse the **component** `WriteErrorToast` as-is; supply a **new message string** following the codebase's established `Não foi possível {ação}.` pattern (`board.tsx` passes a per-action string — `"Não foi possível mover o imóvel."`, `"Não foi possível excluir o imóvel."`, `"Não foi possível renomear a coluna."`). For this phase: **`Não foi possível salvar a alteração do imóvel.`** The second line (`"A alteração foi desfeita. Verifique sua conexão e tente de novo."`) is hard-coded inside `write-error-toast.tsx` and comes for free — do not duplicate or override it. The toggle write is just another optimistic card write like the ones `board.tsx` already handles. |
| Destructive confirmation | **None.** No destructive action exists in this phase. The ativo/inativo toggle is explicitly *not* destructive (D-09: reversible, single click, no confirmation dialog) — do not add an `AlertDialog` around it; that would contradict the "sem burocracia" decision already locked in CONTEXT.md. |

---

## Visual Hierarchy

### Financeiro page — focal point

**The primary visual anchor is the parcelas table container**, not the page title and not the month
switcher. Concretely: the page renders on `--background`, and the single `bg-card` panel
(`rounded-2xl border border-border bg-card p-5`) is the only raised surface in the content area, so
the eye lands there first. The h1 ("Financeiro", 24px Sora 800) is the second stop — it is large but
sits on the flat page background with no container of its own, exactly as on Relatórios.

Descending order of visual weight on this page:

1. **Parcelas table panel** — the only raised `bg-card` surface, the widest element, holds all the data the user came for
2. **Page title h1** — largest type, but unenclosed and on the flat background
3. **Mês atual / Próximo mês switcher** — small, but the only pill-shaped interactive control above the table, so it reads as the one thing to click; its raised active segment (`bg-card shadow-sm`) is the sole motion cue in the header area
4. **Page subheading** — 14px, `text-muted-foreground`, explanatory only
5. **Active nav link** — accent-filled but off in the dark sidebar rail, spatially separate from the content column

### Parcela row — reading order

Left to right, the row is ordered so the user can scan a single column to answer a single question:

| Position | Column | Why here | Visual weight |
|---|---|---|---|
| 1 | **Imóvel (endereço)** | The identity column — the user thinks in properties, so this is what they scan for | `text-sm font-semibold text-foreground` — the heaviest thing in the row |
| 2 | Proprietário | Secondary identity, disambiguates two units at the same address | `text-sm text-muted-foreground` |
| 3 | Vencimento | The fact that drives situação; sits immediately before it so the badge reads as its consequence | `text-sm tabular-nums text-muted-foreground` |
| 4 | Valor devido | Right-aligned, `tabular-nums` — the money column the eye scans vertically, exactly as in `ContractsTable` | `text-sm tabular-nums text-foreground` |
| 5 | Valor pago | Right-aligned, immediately after valor devido so the two are compared without eye travel; `R$ 0,00` throughout this phase | `text-sm tabular-nums text-muted-foreground` |
| 6 | **Situação** | Last, as the row's verdict — same terminal position `ContractsTable` gives `ContractStatusBadge` | Icon + `text-xs font-semibold` + status color |

Rationale for the two bold ends: the row is anchored by *what* (column 1) and *so what* (column 6),
with the neutral-toned supporting facts held between them at lower contrast.

### Board card — focal point unchanged

The card's existing focal point is `valor` (`text-sm font-semibold text-primary`) and this phase does
not displace it. The ativo/inativo pill joins that row as a right-aligned, lower-contrast companion:
tinted rather than filled in its ativo state, fully muted in its inativo state. If both were solid
accent surfaces they would fight; the pill's `bg-primary/10` tint is what keeps `valor` first.

---

## Component Inventory (new for this phase)

Brownfield note: every item below is a small addition following an existing sibling pattern — none introduces a new interaction paradigm.

| Component | Follows the pattern of | Notes |
|---|---|---|
| `app/(app)/financeiro/page.tsx` | `app/(app)/relatorios/page.tsx` | Server Component: fetch board → columns → cards (same query shape), then call the lazy parcela-generation function server-side before rendering, same philosophy as `alerts.ts` |
| `lib/kanban/parcelas.ts` (or `financeiro.ts`) | `lib/kanban/alerts.ts` | Houses the read-time "a vencer/vencida" derivation (D-07) and the ensure-parcelas-exist generation logic (D-01–D-06); pure functions + one Server Action, mirroring the alerts module's split |
| `components/financeiro/financeiro-view.tsx` | `components/reports/reports-view.tsx` | Client component holding the Mês atual/Próximo mês selection state; single list component, filtered by `competencia`, per D-12 |
| `components/financeiro/parcelas-table.tsx` | `components/reports/contracts-table.tsx` | Same container shell (`rounded-2xl border border-border bg-card p-5`, h2 + subtext + `Table`), same empty-state paragraph styling |
| `components/financeiro/parcela-situacao-badge.tsx` | `components/reports/contract-status-badge.tsx` | Icon + label + status-token color, never color alone — see Color table above for the 5-state mapping. Text at `text-xs font-semibold` (the new-component emphasis weight; the older sibling's `font-medium` is not carried over) |
| `components/financeiro/mes-switcher.tsx` | Visual language of `FilterChip` in `reports-view.tsx`, but single-select (segmented control, not combinable filter) | `bg-muted p-1 rounded-full` wrapper, two buttons at `text-xs font-semibold`; active = `bg-card text-foreground shadow-sm`, inactive = `text-muted-foreground hover:text-foreground`. Deliberately **not** accent-filled — see Color |
| Ativo/Inativo pill on `CardItem` | Visual language of `FilterChip` (rounded-full border pill) + the existing `stopPropagation` pattern already used by `CardItem`'s delete button | See layout note below |

### Nav change

Add `Financeiro` to `NAV_ITEMS` in `app-shell.tsx`, between `Board` and `Relatórios` (operational, day-to-day view sits next to the other day-to-day view; the more analytical Relatórios stays last). Icon: `Wallet` (lucide) — already used thematically for "Receita mensal" in `StatTile`, not currently used as a nav icon, semantically apt for a money-facing tab.

```
{ href: "/", label: "Board", icon: LayoutDashboard },
{ href: "/financeiro", label: "Financeiro", icon: Wallet },
{ href: "/relatorios", label: "Relatórios", icon: BarChart3 },
```

### Card toggle — layout note

`CardItem` currently renders `valor` as a full-width paragraph at the bottom of the card. Change that line to a flex row (`flex items-center justify-between`): `valor` stays left-aligned in its existing style (`text-sm font-semibold text-primary`), the ativo/inativo pill sits right-aligned in the same row. This keeps the pill **always visible** (not hover-gated like the delete button, which is a rare/destructive action) because ativo/inativo is a glanceable status, not an occasional action — matching D-08's "prioritizes day-to-day speed over a cleaner-looking board." The pill must call `event.stopPropagation()` on click (same guard the delete button already uses), so tapping it never opens the card-detail dialog.

Pill classes: `rounded-full border px-2 py-1 text-xs font-semibold transition-colors` — active (`ativo`): `border-primary/40 bg-primary/10 text-primary`; inactive (`inativo`): `border-border bg-muted text-muted-foreground`. `py-1` (4px), not `py-0.5` — on-grid, and identical to the existing `FilterChip` this pill's visual language follows. No icon — the label word (`Ativo`/`Inativo`) is the entire signal, kept intentionally quiet so it doesn't compete visually with `valor` in the same row.

---

## UI Considerations

Applicable state considerations resolved: 8 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Parcelas list (mês atual / próximo mês) | ✅ covered | No active contracts → copy defined in Copywriting Contract ("Nenhum contrato ativo..."). Active contracts exist but none has a row for this competência (period boundary) → separate copy defined ("Nenhuma parcela para este período..."). No board at all → reuses `BoardPage`'s exact existing empty copy. |
| loading | Parcelas list, Financeiro nav route | ✅ covered | Inherits the route group's existing `app/(app)/loading.tsx`, same as Board and Relatórios already do — no new loading UI is introduced or needed. |
| error | Parcelas list (generation/fetch failure) | ✅ covered | Sanitized message defined in Copywriting Contract, rendered inline in the table container, following the project's `erroDoBanco()` no-raw-Postgres rule. |
| error | Ativo/Inativo toggle (write failure) | ✅ covered | Reuses the existing `WriteErrorToast` component and copy verbatim — same optimistic-update-then-revert pattern already implemented in `board.tsx`. |
| populated | Parcelas list at typical volume (~46 contracts × up to 2 competências) | ✅ covered | Standard table rendering, same container/row pattern as `ContractsTable`, which already handles this volume for Relatórios. |
| partial | Parcela row (some field missing) | ✅ covered | Dismissed as inapplicable: a generated parcela row is always fully populated — `valor pago = R$ 0,00` in this phase (no baixa capability exists yet) is a valid complete state, not missing data. |
| overflow | Parcelas list, long list of rows | ✅ covered | Inherits page-level scroll from `AppShell`'s `<main className="overflow-auto">`, identical to how the Board and the Relatórios table already scroll — no new scroll container is introduced. |
| zero-one-many | Parcelas list | ✅ covered | Zero → empty state (above). One or many → the `Table` primitive renders either without layout change, same as `ContractsTable` today; no singular/plural counter copy is required for this phase (Relatórios' "X de Y imóveis" counter pattern is available to reuse in Phase 8 if a report needs it, not needed here). |
| long-text | Parcelas row — imóvel/endereço cell | ✅ covered | Follows the `ContractsTable` precedent exactly: the address cell wraps naturally, no truncation or ellipsis is applied. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | None new — reuses the already-installed `table.tsx` primitive; every other new piece (`parcela-situacao-badge`, `mes-switcher`, the card pill) is hand-rolled in the project's own established small-component style, matching how `ContractStatusBadge`/`StatTile`/`FilterChip` were built, not pulled from a registry | not required |
| Third-party | none declared | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
