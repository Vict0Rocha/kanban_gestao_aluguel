---
phase: 6
slug: baixa-e-ajustes-de-parcela
status: approved
reviewed_at: 2026-08-17
shadcn_initialized: true
preset: base-nova (neutral base, cssVariables, prefix none — see web/components.json, unchanged since Phase 5)
created: 2026-08-17
---

# Phase 6 — UI Design Contract

> Visual and interaction contract for the payment ("dar baixa"), adjustment ("acréscimo"/"desconto")
> and ledger-history actions added to `ParcelasTable` (built in Phase 5). Brownfield spec, extending
> an **already-approved** UI-SPEC (`.planning/phases/05-aba-financeiro-com-parcelas-autom-ticas/05-UI-SPEC.md`).
> No new palette, no new font, no new spacing scale, no new type size or weight is introduced —
> everything below reuses Phase 5's tokens and the project's pre-existing `Dialog`/`Sheet` primitives.
> Where this phase amends a Phase 5 decision (the row's terminal column), the amendment is called out
> explicitly rather than silently overridden.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `web/components.json`), unchanged from Phase 5 |
| Preset | `base-nova`, baseColor `neutral`, `cssVariables: true`, `prefix: ""`, `rsc: true` |
| Component library | Base UI — `@base-ui/react` (`^1.6.0`), consumed via shadcn's `dialog`/`sheet` wrappers |
| Icon library | `lucide-react` |
| Font | Body: **Plus Jakarta Sans** (`--font-body`) · Heading: **Sora** (`--font-heading-family`, loaded weights 600/700/800 only — see Typography note on `DialogTitle`) |

**Existing shadcn primitives already installed and reused as-is by this phase** (no re-init, no
duplicate): `dialog`, `sheet`, `button`, `input`, `label`, `textarea`, `table`. **No new shadcn
primitive is required.** The two form surfaces this phase needs (payment, adjustment) reuse
`Dialog`/`DialogContent` exactly as `CardDetailDialog` already does; the ledger/history surface
reuses `Sheet`/`SheetContent` exactly as `AlertsPanel` already does (right-side drawer, scrollable
list body, badge-free trigger). Both are direct structural precedents already live in production —
this phase does not invent a third modal shape.

---

## Spacing Scale

Unchanged from Phase 5 — same Tailwind-default-based scale, same two declared exceptions. This
phase introduces **zero new spacing values**.

| Token | Value | Usage in this phase |
|-------|-------|-------|
| 2xs | 4px (`gap-1`) | Segmented tipo-toggle wrapper gap (`Acréscimo`/`Desconto`), reusing `MesSwitcher`'s exact wrapper |
| xs ⚠ | 6px (`gap-1.5`) | *Inherited exception (Phase 5).* Label-to-input gap inside the two new dialogs' form fields — identical to `CardDetailDialog`'s `flex flex-col gap-1.5` per field |
| sm | 8px (`gap-2`) | Gap between the three row-level action controls (Pagamento / Ajustar / Histórico) in the new Ações column; gap between dialog helper caption and fields |
| md | 16px (`p-4`, `gap-4`) | Dialog form's outer `flex flex-col gap-4`, identical to `CardDetailDialog`; Sheet body padding, identical to `AlertsPanel` |
| lg | 24px | Not introduced at this granularity by this phase |

No new exception is added. Every non-multiple-of-4 value used by this phase is one of the two
already declared in Phase 5's UI-SPEC (`gap-1.5`); nothing this phase writes uses `p-1.5`,
`gap-0.5`, `py-0.5` or any other sub-grid value.

---

## Typography

Zero new sizes, zero new weights. This phase reuses Phase 5's two scales in full and maps three
new *roles* onto existing sizes — it does not extend the scale itself.

### Body scale — Plus Jakarta Sans — weights {400, 600} (unchanged)

| Role | Size | Weight | Where this phase uses it |
|------|------|--------|------|
| Micro-label | 12px (`text-xs`) | 600 `font-semibold` | Row action button labels (`Pagamento`, `Ajustar`), tipo-toggle segment labels (`Acréscimo`/`Desconto`), ledger-entry type label in the history Sheet (`Pagamento`/`Acréscimo`/`Desconto`/`Destrava`) |
| Body | 14px (`text-sm`) | 400 regular | Dialog helper captions (`Valor devido: R$ X · Já pago: R$ Y`), history entry date/observação/quem, dialog inline error text (`text-destructive`) |
| Body emphasis | 14px (`text-sm`) | 600 `font-semibold` | History entry valor amount (`+ R$ X` / `− R$ X`), dialog field values as the user types |

### Heading scale — Sora — weights {700, 800} (unchanged)

This phase does **not** add a new heading role. `DialogTitle` and `SheetTitle` are reused **verbatim**
from their existing components (`font-heading text-base font-medium` — Sora at `font-medium`/500 is a
*pre-existing primitive default*, not loaded as a font file; Sora ships only 600/700/800, so the
browser substitutes the nearest loaded weight for the unrequested 500). This is the exact same
behavior `CardDetailDialog`'s "Detalhes do imóvel" title and `AlertsPanel`'s "Alertas de contrato"
title already ship with in production — this phase's two new titles (`Registrar pagamento`,
`Ajustar valor`) and one new Sheet title (`Histórico — {endereço}`) inherit it unchanged. No
component in this phase overrides `DialogTitle`/`SheetTitle`'s className.

Numbers (valor recebido, valor do ajuste, ledger amounts) use `tabular-nums`, matching
`ParcelasTable`'s existing money columns.

---

## Color

Reusing the exact CSS custom properties already defined in `web/src/app/globals.css` — no new hex
value anywhere in this phase.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--background` | Unchanged, page background |
| Secondary (30%) | `--card` `#ffffff` / `#16281a`, `--sidebar` | Dialog/Sheet popover surfaces (`bg-popover`, itself derived from card), history entry cards |
| Accent (10%) | `--primary` `#74ac1c` / `#8bc93a` | See extended reserved-for list below |
| Destructive | `--destructive` | Not used by this phase. Every action here is additive (INSERT-only, D-01) — there is no delete/undo/destroy in Phase 6. `text-destructive` is reused only for **error text**, which is the pattern's existing non-action usage (`CardDetailDialog`'s inline error), not a "destructive action" in the design-system sense. |

**Accent reserved for** — this list **extends** Phase 5's authoritative list (items 1–4 below are
carried over unchanged; item 5 is new in this phase). Nothing else in this phase's UI may use
`--primary` / `bg-primary` / `text-primary`:

*Carried over from Phase 5, unchanged:*
1. Active state of the "Financeiro" nav link
2. The ativo/inativo pill on the card, ativo state
3. The card's `valor` figure
4. Focus rings (`--ring`, applied globally, not by any component this phase writes)

*New in this phase:*
5. **The single submit button inside whichever of the two new dialogs is open** — `Registrar
   pagamento` (payment dialog) or `Aplicar ajuste` (adjustment dialog), `variant="default"` on the
   `Button` primitive (`bg-primary`). Only one dialog is ever open at a time, so this is always a
   single accent-filled control on screen at once — the same "one CTA, not a field of them" budget
   discipline as items 1–4. **The row-level action controls are explicitly NOT accent** (see below)
   specifically so that a table of 40+ rows never renders 40+ green buttons at once.

*Explicitly NOT accent (new decisions this phase must make, since row-level actions are new):*
- **Row-level "Pagamento" button** (`variant="outline"`) — neutral border/background, `text-foreground`. It is the row's primary affordance, but "primary in the row" ≠ "accent-colored" — the 10% budget is a page-level constraint, and this control repeats once per row.
- **Row-level "Ajustar" button** (`variant="ghost"`) — lower visual weight than Pagamento, matching its lower frequency of use (registering a payment is the common case; adjusting is occasional).
- **Row-level "Histórico" icon button** (`variant="ghost"`, icon-only) — lowest visual weight; it is a read/audit action, not a write.
- **The Acréscimo/Desconto tipo-toggle inside the adjustment dialog** — reuses `MesSwitcher`'s exact non-accent treatment (`bg-muted` track, active segment `bg-card text-foreground shadow-sm`). Same rationale Phase 5 already documented for `MesSwitcher`: a segmented selector is not a call to action.

**Status tokens** (`--status-good` / `--status-warning` / `--status-critical`) — this phase extends
their usage from `ParcelaSituacaoBadge` (Phase 5, unchanged) to a second place, the ledger-entry
type label in the history Sheet. Same rule as Phase 5: reserved meaning, never used for series
identity, always icon + label:

| Ledger entry (`tipo`) | Icon (lucide) | Color token | Amount prefix |
|---|---|---|---|
| `pagamento` | `Banknote` | `text-status-good` | `+ R$ X` (money received) |
| `acrescimo` | `TrendingUp` | `text-status-warning` | `+ R$ X` (raises what's owed — same tone as the `parcial` badge, which an acréscimo can legitimately cause) |
| `desconto` | `TrendingDown` | `text-muted-foreground` | `− R$ X` (lowers what's owed; not a warning, so neutral) |
| `destrava` | `Unlock` | `text-muted-foreground` | `—` (event, not money — not reachable until Phase 7, but the history Sheet is built to render all four `tipo` values now so Phase 7 doesn't have to reopen this component, same future-proofing precedent as `ParcelaSituacaoBadge`) |

The row-level "Pagamento" button reuses the same `Banknote` icon as the `pagamento` ledger-entry
icon above — a deliberate visual echo so the user connects the row action to what it produces in
the history.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (row, always visible) | **`Pagamento`** — the row-level button that opens the payment dialog. Short label by design: it repeats on every row, and the fuller phrasing lives in the dialog title it opens (`Registrar pagamento`). |
| Row button aria-label | `Registrar pagamento — {endereco}` |
| Row button — Ajustar | Label `Ajustar`. Aria-label `Ajustar valor — {endereco}` |
| Row button — Histórico | Icon-only. Aria-label `Ver histórico de lançamentos — {endereco}` |
| Payment dialog title | `Registrar pagamento` |
| Payment dialog description | `{endereco} — competência {mês por extenso}/{ano}` (e.g. `Rua das Flores, 123 — competência agosto/2026`) |
| Payment dialog helper caption | `Valor devido: {formatCurrency(valorDevido)} · Já pago: {formatCurrency(valorPago)}` |
| Payment field — valor | Label `Valor recebido (R$)`. Pre-filled with the remaining amount (`valorDevido − valorPago`) formatted with comma decimal, **only when that remainder is greater than zero**; if the parcela is already fully paid or overpaid, the field starts empty with placeholder `0,00` — there is no sensible "remaining" figure to suggest. Always editable — this is what makes baixa parcial and baixa total the same field (D-05). |
| Payment field — data | Label `Data do pagamento`. `type="date"`, defaults to today (server-pinned `todayISO`, same SSR/hydration-agreement pattern already used for alerts). |
| Payment field — observação | Label `Observação (opcional)`. Placeholder `Ex.: pago via Pix`. |
| Payment submit button | `Registrar pagamento`; while saving, `Registrando...` with the button disabled — mirrors `CardDetailDialog`'s `Salvando...` pattern exactly. |
| Payment validation (client, pre-submit) | `Informe um valor de pagamento válido.` (empty, non-numeric, or ≤ 0) · `Informe a data do pagamento.` (empty date) |
| Adjustment dialog title | `Ajustar valor` |
| Adjustment dialog description | `{endereco} — competência {mês por extenso}/{ano}` |
| Adjustment dialog helper caption | `Valor devido atual: {formatCurrency(valorDevido)}` |
| Adjustment tipo toggle | Two segments: `Acréscimo` / `Desconto`. Default selection: `Acréscimo` (the spec's own example — multa por atraso — and BAIXA-03 is listed before BAIXA-04). |
| Adjustment field — valor | Label `Valor do ajuste (R$)`. Empty by default, placeholder `0,00` — there is no sensible prefill for an adjustment amount, unlike payment. |
| Adjustment field — observação | Label `Observação (opcional)`. Placeholder changes with the selected tipo: `Ex.: multa por atraso` (Acréscimo) / `Ex.: desconto por pagamento antecipado` (Desconto). |
| Adjustment consequence note | Always-visible muted line under the fields, 14px `text-muted-foreground`: `Isso pode mudar a situação da parcela na lista — por exemplo, uma parcela paga pode voltar a parcial.` This turns ROADMAP success-criterion 3's intended behavior into something the user is told, not surprised by, matching the module's "correção fácil" framing. |
| Adjustment submit button | `Aplicar ajuste`; while saving, `Aplicando...`, disabled. |
| Adjustment validation (client, pre-submit) | `Informe um valor de ajuste válido.` (empty, non-numeric, or ≤ 0) |
| History Sheet title | `Histórico — {endereco}` |
| History Sheet subtitle | `Competência {mês por extenso}/{ano} · Vencimento {formatDate(vencimento)}` |
| History empty state | `Nenhum lançamento registrado ainda. Dar baixa ou lançar um ajuste aparece aqui.` — same empty-state voice as `ParcelasTable`'s existing copy (explains *why* it's empty and *what makes it stop being empty*, never a bare "Nada aqui"). |
| History entry — quem | `{profiles.full_name ?? profiles.email ?? "—"}` — never the raw `criado_por` UUID. |
| Error state — payment write fails | Inline in the dialog (see Interaction Contract below), reusing the thrown Server Action message verbatim — e.g. `Não foi possível registrar o pagamento. Tente novamente.` or, for a CHECK-constraint rejection, the existing `Os dados informados não passaram na validação.` (both already produced by `erroDoBanco()`, FINSEG-03). |
| Error state — adjustment write fails | Same shape: `Não foi possível registrar o ajuste. Tente novamente.` (or the CHECK-constraint message). |
| Destructive confirmation | **None.** No destructive action exists in this phase (D-01: every action is an INSERT; corrections are new ledger rows, never edits or deletes). Do not wrap either dialog's submit in an `AlertDialog` — that would misrepresent an additive action as a destructive one and contradict the "correção fácil" framing this phase exists to deliver. |

---

## Interaction Contract — FINUI-04 (≤2 clicks)

This is the one hard numeric constraint on this phase's UI. Concretely, for the common case (full
payment, on time, no observação needed):

1. **Click 1:** user clicks the row's `Pagamento` button (`Banknote` icon + label, always visible,
   not hover-gated — same reasoning Phase 5 gave for the ativo/inativo pill: this is a frequent,
   day-to-day action, not an occasional one, so it must be glanceable and immediately clickable,
   including on touch devices where hover doesn't exist). The dialog opens **pre-filled**: valor =
   full remaining amount, data = today. No typing required.
2. **Click 2:** user clicks `Registrar pagamento` in the dialog footer. The Server Action runs,
   the dialog closes, `router.refresh()` re-renders the row with the new `valorPago`/situação.

Total: 2 clicks, 0 required keystrokes, for a full on-time payment. Baixa **parcial** is the same
two clicks plus editing the pre-filled amount down (typing is not a click and is not budgeted by
FINUI-04, which only names "dar baixa" reachable in ≤2 clicks — the requirement is about
navigation/steps, not about whether the amount happens to be typed).

Ajustar and Histórico are **not** covered by FINUI-04 (the requirement only names baixa) and are not
click-budgeted — they may be one click to open plus whatever the user needs to do inside.

**No explicit "Cancelar" button is added to either dialog's footer.** Both `CardDetailDialog` (the
established precedent) and this phase's two new dialogs rely on the `DialogContent`'s built-in close
control (top-right `X`, `Esc`, and overlay click) to dismiss — adding a second, redundant Cancel
button would be exactly the kind of "passo burocrático extra" the product spec explicitly warns
against. The footer therefore contains exactly one button: the accent-colored submit action.

**Error handling inside the dialogs deliberately deviates from `CardDetailDialog`'s existing
pattern, with a stated reason:** `CardDetailDialog`'s `catch` block discards whatever message the
thrown error carries and always shows a hardcoded generic string. This phase's two dialogs instead
surface the *actual* thrown message — `error instanceof Error ? error.message : fallback` — because
FINSEG-03 becomes verifiable for the first time in this phase (D-08: this is the first user-triggered
write that can hit a real database CHECK constraint), and the specific `erroDoBanco()`-produced
string (e.g. "Os dados informados não passaram na validação.") is more actionable to a leigo user
than a one-size-fits-all "algo deu errado." The message is still guaranteed sanitized — it is never
anything other than what `erroDoBanco()` already produced server-side; this phase just stops
throwing that string away on the way to the screen. Rendered as `<p className="text-sm
text-destructive">`, same visual treatment `CardDetailDialog` already uses.

**Data flow, not optimistic-then-revert:** unlike the single-field ativo/inativo toggle (Phase 5),
these are ledger inserts with a server-side derived status recompute — the UI does not attempt to
predict the resulting `valorPago`/`status` client-side. On success: close the dialog, call
`router.refresh()` (same pattern `AlertsPanel` already uses after `resolveAlert`). No success toast —
the dialog closing and the row updating **is** the confirmation; adding a toast on top would be
another instance of the "burocracia" the module's pillars explicitly reject.

**History data is not lazily fetched.** The Sheet's list is populated from data already present in
the page's initial server-side query (the same `parcela_lancamentos` embed `ParcelasTable` already
uses for its sums, extended with the additional columns the history view needs — `id`, `data`,
`observacao`, `motivo`, `criado_em`, and a `profiles(full_name, email)` join on `criado_por`).
Opening the Sheet is therefore instant, with no loading state of its own — consistent with Phase 5's
decision that the whole route inherits `app/(app)/loading.tsx` and introduces no new loading UI.

---

## Visual Hierarchy

### Parcela row — reading order (amends Phase 5)

Phase 5 established Situação as the row's deliberate terminal column ("the row's verdict"). This
phase adds a 7th column, **Ações**, after it — the amendment is stated explicitly rather than left
implicit, because Phase 5's own text calls out the "same terminal position" reasoning by name:

| Position | Column | Why here |
|---|---|---|
| 1–5 | *(unchanged from Phase 5)* Imóvel, Proprietário, Vencimento, Valor devido, Valor pago | No change |
| 6 | Situação | Still the row's verdict — *what happened* — immediately before *what to do about it* |
| 7 **(new)** | **Ações** | The natural next step after reading the verdict: identity → facts → verdict → response. Left-aligned (not right-aligned like the money columns) — these are controls, not figures, and reading them left-to-right (Pagamento, most likely action, first) matches the frequency-ordered weight established in Color above. |

### Row action weight, left to right

`Pagamento` (outline, heaviest of the three) → `Ajustar` (ghost, text label) → `Histórico`
(ghost, icon-only, lightest). This ordering is deliberate: it puts the highest-frequency action
first and closest to Situação, and the lowest-frequency, read-only action last and least visually
insistent — mirroring how Phase 5 ordered the row's *facts* by how directly they answer "is this
parcela OK."

### Dialog focal point

Both new dialogs follow `CardDetailDialog`'s established hierarchy verbatim: the popover
(`bg-popover`, `ring-1 ring-foreground/10`) is the only raised surface on screen while open (the
backdrop dims everything else to `bg-black/10` with blur); inside it, the single accent-colored
submit button in the footer (`bg-muted/50` footer band, same as `CardDetailDialog`) is the heaviest
element — there is exactly one thing to do to finish, never a competing set of equally-weighted
buttons.

### History Sheet focal point

Follows `AlertsPanel` verbatim: a right-side drawer, header with a plain-text title (no accent), a
scrollable list of `bg-card` entry cards. No entry is visually privileged over another — unlike the
row's Situação badge, the history is a neutral audit trail, not a verdict, so no ledger-entry
type outranks another in weight (all use the same 12px/600 label + `tabular-nums` amount treatment,
differing only in the semantic status-token color documented above).

---

## Component Inventory (new/changed for this phase)

| Component | Follows the pattern of | Notes |
|---|---|---|
| `components/financeiro/registrar-pagamento-dialog.tsx` | `components/kanban/card-detail-dialog.tsx` | `Dialog`/`DialogContent`, one form, one accent submit button, inline `text-destructive` error (with the stated deviation: surfaces the real thrown message, not a hardcoded generic) |
| `components/financeiro/ajustar-parcela-dialog.tsx` | Same as above, plus the tipo toggle | Tipo toggle reuses `mes-switcher.tsx`'s exact class strings (2-segment, `bg-muted`/`bg-card shadow-sm`), inlined locally since it is single-use inside this one dialog — no shared component extraction needed for a 2-option control used in exactly one place |
| `components/financeiro/parcela-historico-sheet.tsx` | `components/alerts/alerts-panel.tsx` | `Sheet`/`SheetContent side="right"`, header + scrollable `flex flex-col gap-3` list of entry cards (`rounded-xl border border-border bg-card p-3`, same shape as `AlertRow`) |
| `components/financeiro/lancamento-tipo-label.tsx` | `components/financeiro/parcela-situacao-badge.tsx` | Icon + label + status-token color, 4-state map (`pagamento`/`acrescimo`/`desconto`/`destrava`) — see Color table above. Built to support all 4 states now even though `destrava` isn't reachable until Phase 7, same future-proofing precedent `ParcelaSituacaoBadge` already set |
| `components/financeiro/parcelas-table.tsx` (changed) | — | Add `TableHead` "Ações" and a matching `TableCell` per row containing the three action controls; extend `LinhaParcela` (or a new richer row type) with the lançamento detail array the history Sheet and both dialogs need |
| `lib/kanban/parcelas.ts` (changed) | — | Extend `LancamentoResumo`/`ParcelaComCard` (or add a richer sibling type) to carry `id`, `data`, `observacao`, `motivo`, `criado_em`, and the joined `profiles(full_name, email)` — `somarLancamentos` keeps working unchanged against the richer shape (it only reads `.tipo`/`.valor`, structurally compatible, D-03: reuse, don't reimplement) |
| `lib/kanban/actions.ts` (changed) | `setCardAtivoAction` | New `registrarPagamentoAction` and `ajustarParcelaAction`, each: `requireUser()` → validate → INSERT into `parcela_lancamentos` → recompute and `UPDATE parcelas.status` (D-04) → `erroDoBanco()` on failure. A small shared helper (e.g. `recalcularStatusParcela`) avoids duplicating the `paga`/`parcial`/`aberta` derivation between the two actions |
| `lib/kanban/queries.ts` (changed) | `resolveAlert` | Thin `registrarPagamento`/`ajustarParcela` wrappers that `unwrap()` the two new actions, so the dialogs' `catch` blocks receive the real thrown message per the Interaction Contract above |

No change to `mes-switcher.tsx`, `financeiro-view.tsx`'s competência-switching logic, or
`card-item.tsx` — this phase touches only the row and its new surfaces.

---

## UI Considerations

Applicable state considerations resolved: 7 covered, 0 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | History Sheet, parcela with zero lançamentos | ✅ covered | Copy defined in Copywriting Contract (`Nenhum lançamento registrado ainda...`). A freshly-generated, never-touched parcela is the normal case for most rows on a first visit — not an edge case. |
| loading | History Sheet | ✅ covered | Not lazily fetched — data ships in the page's initial server-side query (see Interaction Contract). No new loading state is introduced. |
| loading | Payment/Adjustment dialog submit | ✅ covered | Button disables and relabels (`Registrando...`/`Aplicando...`), identical to `CardDetailDialog`'s `Salvando...` pattern. |
| error | Payment/Adjustment write rejected by the server | ✅ covered | Inline `text-destructive` message inside the dialog, surfacing the real `erroDoBanco()`-sanitized string — see Interaction Contract for the stated deviation from `CardDetailDialog`'s generic-only catch. |
| populated | Ações column at typical row volume (~46 contracts × up to 2 competências) | ✅ covered | Three compact controls (`outline` + `ghost` + icon-only `ghost`) fit within the `Table`'s existing `overflow-x-auto` container; no layout change to the container itself. |
| zero-one-many | History Sheet entries | ✅ covered | Zero → empty state above. One or many → the same `li` card list renders either without layout change, same shape as `AlertsPanel`'s list; no counter copy needed (consistent with Phase 5's decision not to add one to the parcelas list either). |
| long-text | History Sheet — observação field | ✅ covered | Wraps naturally inside the entry card, no truncation — same precedent `ParcelasTable`'s endereço cell already set in Phase 5. |

Two Phase-5-carried considerations are **not re-litigated** here because this phase does not change
them: overflow (page-level scroll, unchanged) and the parcela row's own long-text handling
(endereço column, unchanged).

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | None new — reuses the already-installed `dialog.tsx` and `sheet.tsx` primitives verbatim; every new piece (`registrar-pagamento-dialog`, `ajustar-parcela-dialog`, `parcela-historico-sheet`, `lancamento-tipo-label`) is hand-rolled in the project's own established small-component style, matching how `ParcelaSituacaoBadge`/`MesSwitcher` were built in Phase 5, not pulled from a registry | not required |
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
