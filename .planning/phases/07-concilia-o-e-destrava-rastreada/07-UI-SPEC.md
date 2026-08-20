---
phase: 7
slug: concilia-o-e-destrava-rastreada
status: approved
shadcn_initialized: true
preset: base-nova (pre-existing — initialized in Phase 5, not re-run this session)
created: 2026-08-19
reviewed_at: 2026-08-19
---

# Phase 7 — UI Design Contract

> Visual and interaction contract for Conciliar/Destravar. This phase adds **zero new design
> tokens** — it is a pure extension of the row-action pattern shipped in Phase 6
> (`Pagamento`/`Ajustar`/`Histórico` on `ParcelasTable`) and reuses two components that were
> already built ahead of time for this exact phase: `ParcelaSituacaoBadge`'s `conciliada` state
> (Lock icon) and `LancamentoTipoLabel`'s `destrava` state (Unlock icon). Every value below is
> confirmed by reading production code (Phases 5/6/6.1/6.2), not re-asked of the user.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `web/components.json`) |
| Preset | `style: "base-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"` |
| Component library | Base UI (`@base-ui/react`) — this project's `base-nova` style wraps Base UI primitives, **not** Radix |
| Icon library | lucide-react — this phase needs only `Lock` (Conciliar) and `Unlock` (Destravar), both already imported elsewhere in the codebase (`parcela-situacao-badge.tsx`, `lancamento-tipo-label.tsx`) |
| Font | `var(--font-body)` (body, via `font-sans`) / `var(--font-heading-family)` (dialog/sheet titles, via `font-heading`) — both pre-existing, untouched by this phase |

---

## Component Notes (row-action layout — Claude's Discretion from 07-CONTEXT.md, resolved here)

`AcoesCell` in `web/src/components/financeiro/parcelas-table.tsx` branches on `linha.situacao`.
No new spacing/sizing tokens — every button below reuses the exact `Button` variant/size
vocabulary already in the row (`outline` = the row's one "primary" action, `ghost` = secondary,
`ghost size="icon"` = Histórico). The cell keeps its existing `flex items-center gap-2`.

**Visual hierarchy (per row):** the `outline` slot is always the eye's first stop — it is the
row's one action styled with a visible border, everything else is borderless `ghost`. This phase
doesn't change that rule, it changes which action occupies the slot: `Pagamento` on every
non-conciliada row (unchanged from Phase 6), `Destravar` on a conciliada row (D-08 below).
`Conciliar` deliberately does **not** compete for that slot — it stays `ghost`, appended after
`Ajustar`, because a `paga` row's primary action is still logically "receive more money"
(Pagamento), not "lock it" — conciliar is available, not emphasized.

**Default row** (`a_vencer`, `vencida`, `parcial`, or `paga`-but-nothing-changes-otherwise):
unchanged from Phase 6 — `Pagamento` (outline, `Banknote` icon) · `Ajustar` (ghost) ·
`Histórico` (ghost, icon-only).

**`situacao === "paga"` row** — adds a 4th action, does not replace anything (a paga parcela can
still receive further lançamentos before being conciliada):
`Pagamento` (outline) · `Ajustar` (ghost) · **`Conciliar` (ghost, `Lock` icon + text — new)** ·
`Histórico` (ghost, icon-only).
- `aria-label`: `` `Conciliar parcela — ${linha.endereco}` `` (mirrors the existing
  `` `Registrar pagamento — ${linha.endereco}` `` pattern).
- Click behavior (D-07 — single click, no dialog): button calls the server action directly,
  swaps its own label to **"Conciliando..."** and disables itself while pending (same
  non-optimistic "wait for server" discipline as Phase 6.2's arquivar/excluir), then
  `router.refresh()` on success. **No local `dialogoAberto` state is used for this action.**

**`situacao === "conciliada"` row** — **replaces** `Pagamento`/`Ajustar` (they are refused by
the server anyway per CONCIL-02; showing live buttons that always error is worse than not
showing them — D-08 resolved this way):
**`Destravar` (outline, `Unlock` icon + text — new, takes over the row's "primary" outline
slot that Pagamento occupied)** · `Histórico` (ghost, icon-only, unchanged — this is how
CONCIL-04's destrava history stays reachable).
- `aria-label`: `` `Destravar parcela — ${linha.endereco}` ``.
- Click opens a new `DestravarParcelaDialog` (third dialog in the `dialogoAberto` union type,
  alongside `"pagamento" | "ajustar" | "historico"` → add `"destravar"`), built structurally
  identical to `AjustarParcelaDialog`/`RegistrarPagamentoDialog` (same `wasOpen` resync trick,
  same `DialogHeader`/`DialogFooter` shape, same single-button footer).

**Conciliar-failure surface (new, small):** because Conciliar has no dialog, a server-side
refusal (rare — e.g. a stale tab where the parcela was already conciliada in another tab) needs
a surface. Add a local toast in `parcelas-table.tsx` — visually **identical** to
`web/src/components/kanban/write-error-toast.tsx` (same fixed bottom-center position, same
`border-destructive/30 bg-card` card, same `AlertCircle` icon, same dismiss button, same
7s auto-dismiss) but with its own component (do not import the Board's toast — different
subtext, see Copywriting Contract). This is the only new visual surface in the whole phase; it
is a copy-and-rename of an existing pattern, not a new design decision.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-text gaps inside buttons (unchanged) |
| sm | 8px | `AcoesCell` button gap (`gap-2`, unchanged), toast internal gaps |
| md | 16px | Dialog/Sheet padding, form field stacking (`gap-4`, unchanged) |
| lg | 24px | Not used by this phase |
| xl | 32px | Not used by this phase |
| 2xl | 48px | Not used by this phase |
| 3xl | 64px | Not used by this phase |
| 3xs ⚠ | 12px (`gap-3`/`p-3`) | *Inherited, production-established.* `ParcelaHistoricoSheet`'s lançamento cards (Phase 6); the new `motivo` line this phase adds to that same card (see Copywriting Contract) reuses the identical 12px rhythm — no new value introduced by this phase, listed here (not just as prose below) so a future reader sees the full scale in one table |

Not a multiple-of-4 token, carried forward for the reason above — same "inherited, not
introduced" treatment `06.2-UI-SPEC.md` already established for this exact 3xs row.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px (`text-sm`) | 400 regular | 1.5 (default leading) |
| Label | 12px (`text-xs`) | 600 semibold | 1.2 (tight — badges, pills, `LancamentoTipoLabel`, `ParcelaSituacaoBadge`) |
| Heading | 16px (`text-base`, `font-heading`) | 500 medium — **inherited** from `DialogTitle`/`SheetTitle` primitives (pre-existing across the whole app since Phase 5, not a token this phase introduces) | 1.0 (`leading-none`) |
| Display | Not used by this phase | — | — |

Two weights this phase's own copy uses: **400 regular** (body text, dialog descriptions,
`motivo`/observação values) and **600 semibold** (button labels, badge/label text). The 500
heading weight is inherited from shared `DialogTitle`/`SheetTitle` components this phase reuses
verbatim (no new heading element is authored here) and is out of scope for this phase's own
token declaration.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` `#f4fcf4` light / `#0e1a10` dark | Page background behind the Financeiro table (unchanged) |
| Secondary (30%) | `var(--card)` `#ffffff` light / `#16281a` dark | Table container, `DestravarParcelaDialog` surface, `ParcelaHistoricoSheet` and its lançamento cards, the new Conciliar-failure toast card |
| Accent (10%) | `var(--primary)` `#74ac1c` light / `#8bc93a` dark | Reserved for **exactly one element in this phase**: the `DestravarParcelaDialog`'s submit button ("Destravar", `variant="default"`) — the dialog's single confirming action, same rule Phase 6 established for "Registrar pagamento"/"Aplicar ajuste" |
| Destructive | `var(--destructive)` `oklch(0.577 0.245 27.325)` light / `oklch(0.704 0.191 22.216)` dark | Inline validation/server-error text (`text-sm text-destructive`) inside `DestravarParcelaDialog`; the same slot in `RegistrarPagamentoDialog`/`AjustarParcelaDialog` when a CONCIL-02 refusal surfaces there; the `AlertCircle` icon + border in the new Conciliar-failure toast |

Accent reserved for: **`DestravarParcelaDialog`'s "Destravar" submit button only.** The row-level
`Conciliar` and `Destravar` buttons themselves are neutral (`ghost`/`outline` — no primary
color), matching the existing rule that accent marks the one confirming action *inside* a
dialog, never a row-level trigger that opens one.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Row action: **"Conciliar"** (`Lock` icon, single click, no dialog — D-07, already confirmed with the user). Dialog CTA: **"Destravar"** (submit button inside `DestravarParcelaDialog`) |
| Empty state heading | Not introduced by this phase. |
| Empty state body | No new empty state: the three existing `VAZIO_LABEL` strings (`ParcelasTable`, Phase 5/6.1) are untouched, and `ParcelaHistoricoSheet`'s existing empty copy ("Nenhum lançamento registrado ainda. Dar baixa ou lançar um ajuste aparece aqui.") never actually fires for a `conciliada` row, because CONCIL-01 requires `status = 'paga'` before conciliar — a conciliada parcela always has at least the `pagamento` lançamento that made it `paga`. |
| Error state — CONCIL-02 (server refuses pagamento/ajuste on a conciliada parcela) | **"Esta parcela está conciliada e travada contra alteração. Destrave antes de registrar pagamento ou lançar um ajuste."** Rendered in the *existing* inline error slot (`{error && <p className="text-sm text-destructive">{error}</p>}`) already present in `RegistrarPagamentoDialog` and `AjustarParcelaDialog` — no new error surface for this case. Reached in practice via a stale second tab (same class of race the Phase 6.2 visibility trava already handles). |
| Error state — Conciliar one-click failure | The server-provided message (via the existing `erroDoBanco()` pattern, e.g. `"Não foi possível conciliar a parcela: sem permissão ou o registro já não existe."`) rendered in the new toast (see Component Notes) with a fixed subtext **"Tente novamente."** — deliberately *not* `WriteErrorToast`'s "A alteração foi desfeita" subtext, because Conciliar is non-optimistic: nothing was changed on screen that needs undoing. |
| Error state — Destravar, empty motivo (client-side) | **"Informe o motivo da destrava."** — mirrors the phrasing of `RegistrarPagamentoDialog`'s `"Informe um valor de pagamento válido."`, blocks submit before the server round-trip, same rule the DB's `parcela_lancamentos_destrava_exige_motivo` CHECK enforces server-side. |
| Error state — Destravar, server rejection | Falls through to the same inline slot with the `erroDoBanco()`-produced string, e.g. `"Não foi possível destravar a parcela. Tente novamente."` — same pattern as every other dialog in the module. |
| Destructive confirmation | **None for either action.** Conciliar is one click by design (D-07 — a confirmation dialog on top of it would be dialog fatigue, already rejected by the user in this session's discussion). Destravar's required `motivo` field is the friction gate in place of a confirm dialog (D-04) — neither action deletes or destroys data; both are corrections recorded in an append-only ledger, consistent with the project's stated philosophy: "correção fácil, todos erram em algum momento." |

### `DestravarParcelaDialog` — field-level copy

| Field | Copy |
|-------|------|
| Dialog title | "Destravar parcela" |
| Description line 1 | `{endereco} — competência {mês por extenso}/{ano}` (identical helper to `descricaoCompetencia` in the sibling dialogs) |
| Description line 2 | `Valor pago: {formatCurrency(valorPago)}` (context, mirrors `AjustarParcelaDialog`'s "Valor devido atual") |
| Field label | "Motivo da destrava" — **no "(opcional)" suffix**, unlike every observação field elsewhere in the module; this is the one required text field in the whole Financeiro surface |
| Placeholder | "Ex.: valor lançado errado, corrigir e destravar para nova baixa" |
| Submit button (idle / pending) | "Destravar" / "Destravando..." |
| Max length | 2000 chars, via `textoObrigatorio(motivo, "Motivo", 2000)` in `actions.ts` — same cap already used for `observacao` elsewhere, not a new limit |

### `ParcelaHistoricoSheet` — CONCIL-04 gap closed here

The sheet already renders `LancamentoTipoLabel` (has a `destrava` state, Unlock icon), the
date+quem line, and — conditionally — `observacao`. It does **not** currently render `motivo`,
even though `LancamentoDetalhado.motivo` already exists on the type (built ahead of time in
Phase 6). Add one more conditional block, styled identically to the existing `observacao`
paragraph but with a label prefix so a destrava's reason reads distinctly from a free-text
observação:

```
{lancamento.motivo && (
  <p className="text-sm text-muted-foreground">
    <span className="font-medium text-foreground">Motivo: </span>
    {lancamento.motivo}
  </p>
)}
```

Placed alongside (not replacing) the existing `observacao` block — the two are mutually
exclusive in practice (destrava writes only `motivo`, other tipos never write `motivo`), so no
shared conditional logic is needed. `prefixoValor` already returns `"—"` for `destrava` (Phase 5
built this ahead of time) and needs no change.

---

## UI Considerations

Applicable state considerations resolved: 9 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| loading | Conciliar row button (`interactive-control`) | ✅ covered | Button label swaps to "Conciliando..." and disables itself while the server action is in flight (non-optimistic wait-for-server, matching Phase 6.2's arquivar/excluir buttons) |
| error | Conciliar row button (`interactive-control`) | ✅ covered | Server-provided message renders in the new Conciliar-failure toast (Copywriting Contract row "Conciliar one-click failure") |
| loading | Destravar row button (`interactive-control`) | dismissed | Button only opens a dialog synchronously (no async on click) — loading applies to the dialog's submit, not this trigger |
| loading | `DestravarParcelaDialog` submit (`form`) | ✅ covered | "Destravando..." label + `disabled={saving}`, identical pattern to `RegistrarPagamentoDialog`/`AjustarParcelaDialog` |
| empty | `DestravarParcelaDialog` (`form`, unfilled `motivo`) | ✅ covered | Client-side validation blocks submit with "Informe o motivo da destrava." before any server round-trip |
| error | `DestravarParcelaDialog` (`form`) | ✅ covered | Server rejection (e.g. CHECK constraint, network) renders via `erroDoBanco()` in the existing inline `text-sm text-destructive` slot |
| long-text | `DestravarParcelaDialog` motivo field (`form`) | ✅ covered | Standard shadcn `Textarea` wraps by default (same as every other observação field in the module); 2000-char server cap mirrors existing free-text fields |
| long-text | `ParcelaHistoricoSheet` motivo line (`static-content`) | ✅ covered | Renders in the same `<p className="text-sm text-muted-foreground">` block styling already proven for `observacao`, wraps naturally inside the sheet's `overflow-y-auto` container |
| zero-one-many | `ParcelasTable` mixed situações (paga / conciliada / other rows in the same table) | dismissed | Pre-existing table already renders heterogeneous `situacao` values per row (Phase 5/6); this phase adds row-action variants but does not change how the table itself handles 0/1/many rows |
| empty | `ParcelaHistoricoSheet` for a conciliada parcela's history | 🧪 backstop | Claimed in Copywriting Contract that this state never fires (conciliar requires `paga`, which requires ≥1 `pagamento` lançamento) — logically sound from `avaliarVisibilidadeParcela`/`statusDeParcela`, but not yet exercised against a real conciliada row in production; verify visually once Conciliar ships in this phase's plan |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|--------------|
| shadcn official | None new — this phase reuses `Dialog`, `Sheet`, `Button`, `Textarea`, `Label` (all already installed since Phase 5/6) | not required |
| Third-party | none | not applicable |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: FLAG (no explicit visual-hierarchy statement) — fixed: hierarchy paragraph added to Component Notes
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: FLAG (12px exception not in the token table) — fixed: added as `3xs` row
- [x] Dimension 6 Registry Safety: PASS

**Approval:** APPROVED (gsd-ui-checker, 2026-08-19) — both non-blocking FLAGs resolved by the orchestrator before planning
