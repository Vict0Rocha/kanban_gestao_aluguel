---
phase: 11
slug: cancelamento-de-pagamento
status: draft
shadcn_initialized: true
preset: base-nova (baseColor neutral, cssVariables true, iconLibrary lucide — pre-existing, not re-run this session)
created: 2026-08-21
---

# Phase 11 — UI Design Contract

> Visual and interaction contract for Cancelamento de pagamento. This phase adds **exactly one
> new interactive element**: a "Cancelar" trigger per `tipo='pagamento'` lançamento inside the
> already-shipped `ParcelaHistoricoSheet`, plus **one new dialog** it opens. Every value below is
> confirmed by reading the actual files this phase touches (`parcela-historico-sheet.tsx`,
> `destravar-parcela-dialog.tsx`, `excluir-contrato-dialog.tsx`, `arquivar-contrato-dialog.tsx`,
> `parcelas-table.tsx`, `alert-dialog.tsx`, `button.tsx`), not re-asked of the user — 11-CONTEXT.md
> already locked the behavior (D-01..D-06); this document locks the *pixels and copy*.

---

## Scope Note

In scope for this document: the "Cancelar" trigger's placement/style inside
`ParcelaHistoricoSheet`, and the new confirmation dialog's copy/component choice/color.

Out of scope (per 11-CONTEXT.md's explicit boundary — do not re-derive): `ParcelasTable`'s
`AcoesCell` (row-level table actions — untouched), Conciliar/Destravar (Phase 7, untouched), any
new route.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `web/components.json`) |
| Preset | `style: "base-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"` |
| Component library | Base UI (`@base-ui/react`) — this project's `base-nova` style wraps Base UI primitives, **not** Radix. `AlertDialog` (`web/src/components/ui/alert-dialog.tsx`) is the primitive this phase uses — already installed, already in production use by `excluir-contrato-dialog.tsx`/`arquivar-contrato-dialog.tsx` |
| Icon library | lucide-react — this phase needs only `Trash2`, already imported elsewhere in the codebase (`web/src/components/kanban/column.tsx:154`, the established icon for a genuine, permanent delete action in this project — distinct from `X`, which this codebase reserves for "close/dismiss" contexts like `ConciliarFalhaToast`/`FiltroParcelas`) |
| Font | `var(--font-body)` (body, via `font-sans`) / `var(--font-heading-family)` (dialog title, via `font-heading`) — both pre-existing, untouched by this phase |

**Component choice — `AlertDialog`, not `Dialog`:** `DestravarParcelaDialog` (the CONTEXT-cited
"closest analog") uses the plain `Dialog` primitive because it has a form field (`motivo`,
required). This phase's dialog has **no field at all** (D-04 — locked, no motivo) — it is a pure
yes/no confirmation. The exact same shape already exists twice in this codebase:
`ExcluirContratoDialog` (irreversible delete, `AlertDialogAction variant="destructive"`) and
`ArquivarContratoDialog` (reversible, `AlertDialogAction variant="default"`). Because D-01 makes
this a genuine, irreversible `DELETE` (no undo, no audit trail), `ExcluirContratoDialog` is the
correct analog to copy — `AlertDialog` + `variant="destructive"` on the confirming action, not
`ArquivarContratoDialog`'s neutral variant.

**Focal point:** the destructive `"Cancelar pagamento"` button (`AlertDialogAction
variant="destructive"`) is the dialog's single visual anchor, exactly as `excluir-contrato-dialog.tsx`
already establishes for this class of action. The row-level trigger stays neutral/`ghost` — color
is reserved for the *confirmed* action, never the button that merely opens the dialog (same rule
`07-UI-SPEC.md` and `09-UI-SPEC.md` already locked for this codebase).

---

## Component Notes

### Row-level trigger (`ParcelaHistoricoSheet`)

Current card shape (`parcela-historico-sheet.tsx`, one `<li>` per lançamento):

```
<li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
  <div className="flex items-start justify-between gap-2">
    <LancamentoTipoLabel tipo={lancamento.tipo} />
    <span>{prefixoValor(...)}</span>
  </div>
  <p>{formatDate(lancamento.data)} · {quem}</p>
  {observacao && <p>...}
  {motivo && <p>...}
</li>
```

Add a new trailing block, **only when `lancamento.tipo === "pagamento"`**, right-aligned inside
the existing `flex flex-col gap-2` card — does not touch the header row's two-column
(`justify-between`) layout at all, lowest-risk insertion point:

```
{lancamento.tipo === "pagamento" && (
  <div className="flex justify-end">
    <Button variant="ghost" size="xs" onClick={...}>
      <Trash2 className="size-3" />
      Cancelar
    </Button>
  </div>
)}
```

- `variant="ghost" size="xs"` — the smallest labeled button size already declared in
  `button.tsx` (`h-6`, `text-xs`, icon `size-3`, `gap-1`). Deliberately **not** icon-only (unlike
  `AcoesCell`'s `Histórico` button): CANPAG-01 requires a visible "Cancelar" **label**, and this
  project has no automated test suite — every acceptance criterion in `ROADMAP.md`/`STATE.md` is
  verified by a human reading the screen, so the word "Cancelar" must be legible on the button
  itself, not only in an `aria-label`.
- `aria-label` not needed beyond the visible text (the button already has a text child) — but if
  the executor wants one for clarity in a dense list, use
  `` `Cancelar pagamento de ${formatCurrency(lancamento.valor)} — ${formatDate(lancamento.data)}` ``.
- **Color:** `ghost` variant, no destructive tint on the trigger — matches the established rule
  (color is reserved for the dialog's confirming action, see Color section).
- **Touch target exception:** `size="xs"` is 24px tall, below the usual 44px guidance. Accepted
  here because (a) the button carries a visible text label, not just an icon, (b) it sits inside
  a spacious sheet with generous surrounding whitespace (`p-3` card padding, `gap-2` card rhythm,
  `p-4` sheet content padding), and (c) this exact size token is already shipped in production
  elsewhere in the app — this is not a novel risk introduced by this phase.

### Visibility rule (D-06 — conciliada trava, UI half)

`ParcelaHistoricoSheet` does not currently receive the parent parcela's `situacao`/status as a
prop (only `endereco`, `competencia`, `vencimento`, `lancamentos`, `open`, `onOpenChange`). Per
D-06, **no** "Cancelar" button — for any lançamento, not just `pagamento` ones — may render when
the parcela is `conciliada`. This requires threading one new boolean prop into the sheet (e.g.
`parcelaConciliada: boolean`, sourced from `AcoesCell`'s `linha.situacao === "conciliada"` —
exact prop name is the planner's call). This is a **UI-visible consequence of a server-enforced
rule** (`exigirParcelaNaoConciliada`, D-06) — the button hiding here is convenience, not the
security boundary; the boundary is the Server Action's own re-check (already locked in
11-CONTEXT.md `<code_context>`, out of scope for this document).

### New dialog: `CancelarPagamentoDialog`

Structurally a copy of `ExcluirContratoDialog`'s non-blocked branch (no pre-flight check needed
here — D-06's trava is a simple boolean already known from the sheet's prop, not an async
pre-flight query like `cardTemLancamento`), minus the typed-confirmation input (D-04 explicitly
rejects that friction level — "confirmação simples", unlike `ExcluirContratoDialog`'s
`digite excluir {numero}`).

```
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancelar este pagamento?</AlertDialogTitle>
      <AlertDialogDescription>
        Pagamento de {formatCurrency(valor)} em {formatDate(data)}. O lançamento é apagado
        e o status da parcela é recalculado a partir do que sobrar. Esta ação não pode ser
        desfeita.
      </AlertDialogDescription>
    </AlertDialogHeader>

    {error && <p className="text-sm text-destructive">{error}</p>}

    <AlertDialogFooter>
      <AlertDialogCancel>Voltar</AlertDialogCancel>
      <AlertDialogAction
        variant="destructive"
        disabled={saving}
        onClick={() => { void handleConfirm() }}
      >
        {saving ? "Cancelando..." : "Cancelar pagamento"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

No `AlertDialogMedia`/icon in the header — matches `ExcluirContratoDialog`'s plain-text
irreversible-delete precedent (`09-UI-SPEC.md` made the identical choice for the same reason: an
icon here would be decoration, not information).

**⚠ Known composition risk — nested portal (AlertDialog opened from inside an open Sheet):**
every existing `AlertDialog`/`Dialog` usage in this codebase today is triggered directly from a
table row or card (`AcoesCell`, `column.tsx`) — never from *inside* an already-open `Sheet`. This
phase is the **first** case of one Base UI portal (`AlertDialog`) opening while another
(`Sheet`) is already open and remains open behind it (the sheet is not meant to close — the user
should land back in the same scrollable list after cancelling or backing out). This codebase has
documented, in `conciliar-falha-toast.tsx`'s own comment, that "Base UI 1.6 não limpa os
atributos `[data-starting-style]`/`[data-ending-style]`, o que já quebrou o Dialog e o Sheet
deste projeto duas vezes" — the exact class of primitive this new composition touches twice at
once. Both `Sheet` and `AlertDialog` use `z-50`; visually this is very likely fine (DOM order
puts the later-portaled `AlertDialog` on top), but the animation/`data-starting-style` fragility
is a real, previously-triggered failure mode in this exact codebase. **Executor must visually
verify** opening/closing the dialog from within an open sheet (both the confirm path and the
"Voltar" back-out path) before considering this phase done — if the animation breaks the same way
it broke twice before, follow `ConciliarFalhaToast`'s precedent: drop the `data-starting-style`/
`data-ending-style` transition classes for this specific composition rather than debugging Base
UI's internals further.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1` inside the new `size="xs"` button (icon-to-label); unchanged from existing button internals |
| sm | 8px | Card's existing `gap-2` rhythm (`ParcelaHistoricoSheet`'s `<li>`), dialog's `gap-4`/`p-4` sections use the next token up — no new 8px usage introduced beyond what's already there |
| md | 16px | `AlertDialogContent`'s existing `p-4`/`gap-4` (pre-existing component default, not re-authored) |
| lg | 24px | Not used by this phase |
| xl | 32px | Not used by this phase |
| 2xl | 48px | Not used by this phase |
| 3xl | 64px | Not used by this phase |

Exceptions: the row trigger's `size="xs"` button is 24px tall (`h-6`) — below the usual 44px
touch-target guidance. See Component Notes "Touch target exception" for the justification; this
is an accepted, pre-existing button-size token (`button.tsx`), not a new value authored by this
phase.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body / dialog description | 14px (`text-sm`) | 400 regular | default (Tailwind `text-sm`, ~1.43) — inherited from `AlertDialogDescription` |
| Row trigger label ("Cancelar") | 12px (`text-xs`, `size="xs"` button) | 500 medium — inherited from `buttonVariants`' base `font-medium` class, not re-declared per instance | default tight button line-height |
| Dialog title | 16px (`text-base`) | 500 medium — inherited from `AlertDialogTitle` default | `leading-none` |
| Error text | 14px (`text-sm`), `text-destructive` | 400 regular | same as body |

Two weights total in this phase's new surface: **400 regular** (dialog description/error text)
and **500 medium** (button label, dialog title — both inherited component defaults, not authored
per-instance). No new weight introduced.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` | Page background behind the Financeiro table (unchanged) |
| Secondary (30%) | `var(--popover)` / `var(--card)` | `AlertDialogContent` surface, `ParcelaHistoricoSheet`'s lançamento cards (both pre-existing surfaces, unchanged) |
| Accent (10%) | `var(--primary)` | **Not used anywhere in this phase.** There is no "confirm and proceed happily" action here — the one confirming action is destructive, not primary |
| Destructive | `var(--destructive)` `oklch(0.577 0.245 27.325)` light / `oklch(0.704 0.191 22.216)` dark | **Exactly two places:** (1) `AlertDialogAction variant="destructive"` — the "Cancelar pagamento" confirm button, because the action performs a real, irreversible `DELETE` (D-01), same visual-honesty rule `excluir-contrato-dialog.tsx` already established; (2) inline error text (`text-sm text-destructive`) inside the dialog if the server rejects the cancellation |

Accent reserved for: not applicable — no accent-colored element in this phase's new surface. The
row-level "Cancelar" trigger itself stays neutral `ghost` (no destructive tint) — destructive
color marks the *confirmed* action inside the dialog, never the row-level button that only opens
it. This mirrors the identical rule `07-UI-SPEC.md` locked for `Conciliar`/`Destravar`'s row
triggers and `09-UI-SPEC.md` locked for its confirmation dialog.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA (row trigger) | **"Cancelar"** — `ghost`, `size="xs"`, `Trash2` icon + text, appears only next to `tipo='pagamento'` lançamentos, only when the parcela is not conciliada (D-06) |
| Dialog title | **"Cancelar este pagamento?"** |
| Dialog description | **"Pagamento de {formatCurrency(valor)} em {formatDate(data)}. O lançamento é apagado e o status da parcela é recalculado a partir do que sobrar. Esta ação não pode ser desfeita."** — carries D-01 (real delete), D-03 (recalculated status, not hardcoded), and the irreversibility warning from the user's own example phrasing in 11-CONTEXT.md `<decisions>` D-04 |
| Dialog back-out button | **"Voltar"** — deliberately **not** the codebase's usual `AlertDialogCancel` default of "Cancelar": in every other dialog "Cancelar" unambiguously means "abort the destructive thing," but here the destructive thing *is itself* named "cancelar" (cancelar pagamento) — reusing the word for the abort button would read as "cancel the cancellation," a confusing double-negative unique to this one dialog. "Voltar" sidesteps the collision without introducing any new interaction pattern (it is still a plain `AlertDialogCancel`, same close-and-return behavior as every other dialog's "Cancelar") |
| Confirm button (idle / pending) | **"Cancelar pagamento"** / **"Cancelando..."** — deliberately more specific than a bare "Cancelar" (same specificity precedent as `ExcluirContratoDialog`'s "Excluir definitivamente" vs. its own back-out "Cancelar"), `disabled={saving}` while in flight |
| Error state (server rejects — e.g. race with conciliação, or lançamento already gone) | Inline inside the dialog, same slot pattern as `excluir-contrato-dialog.tsx`: **"Não foi possível cancelar o pagamento. Tente novamente."** (via `erroDoBanco()` sanitization if the rejection is a raw DB error) — dialog stays open, user can retry or back out via "Voltar" |
| Error state — conciliada race (server refuses because the parcela became conciliada in another tab between the sheet loading and the confirm click) | Same inline slot, server-provided message via the existing `erroDoBanco()`/CONCIL-02-style pattern, e.g. **"Esta parcela está conciliada e travada contra alteração. Destrave antes de cancelar um pagamento."** — mirrors the exact CONCIL-02 string already shipped in `07-UI-SPEC.md`, reused verbatim for consistency across the module |
| Empty state | Not introduced by this phase — `ParcelaHistoricoSheet`'s existing empty copy ("Nenhum lançamento registrado ainda...") is untouched; if a parcela's only `pagamento` lançamento is cancelled, the sheet naturally falls back to whatever lançamentos remain (possibly none, possibly `acrescimo`/`desconto`/`destrava` rows) — no special-cased copy needed, the existing conditional (`lancamentos.length === 0`) already covers a fully-empty result |
| Destructive confirmation | See "Dialog title"/"Dialog description"/"Confirm button" rows above — this phase's one and only confirmation surface |

---

## UI Considerations

Applicable state considerations resolved: 7 covered, 1 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | "Cancelar" triggers across a parcela's lançamentos list (`list-collection`) | ✅ covered | Per D-02, each `tipo='pagamento'` lançamento gets its own independent trigger — a parcela with 0 pagamentos shows none, 1 shows one, 2+ (partial payments) shows one per row, each cancels only that specific row |
| conditional visibility | "Cancelar" trigger on a conciliada parcela's lançamentos (`interactive-control`) | ✅ covered | Hidden entirely (D-06) — see Component Notes "Visibility rule"; server-side `exigirParcelaNaoConciliada` is the real trava, this is the UI-visible consequence |
| loading | `CancelarPagamentoDialog` confirm button (`form`) | ✅ covered | "Cancelando..." label + `disabled={saving}`, identical pattern to `Destravando...`/`Excluindo...` in the two closest sibling dialogs |
| error | `CancelarPagamentoDialog` server rejection (`form`) | ✅ covered | Inline `text-sm text-destructive` slot, `erroDoBanco()`-sanitized — see Copywriting Contract "Error state" rows |
| error | Race — parcela becomes conciliada between sheet open and confirm click (`form`) | ✅ covered | Reuses the exact CONCIL-02 message string already shipped in Phase 7 — see Copywriting Contract |
| populated | `CancelarPagamentoDialog` with a real amount/date (`static-content`) | ✅ covered | Title + description rows above; destructive-variant confirm button |
| overflow | Long `endereco`/large `valor` inside the dialog description (`static-content`) | dismissed | Dialog description is a single short sentence with a currency figure and a short date — no realistic overflow risk at this project's production scale (~46 imóveis), same class of text already proven to wrap cleanly in every sibling dialog |
| composition | `AlertDialog` opened from inside an already-open `Sheet` (`interactive-control`) | 🧪 backstop | First occurrence of this portal-on-portal composition in the codebase; this codebase has a documented history of exactly this class of Base UI bug (`data-starting-style`/`data-ending-style` not clearing, per `conciliar-falha-toast.tsx`'s own comment). See Component Notes "Known composition risk" for the required manual verification and fallback |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

No new shadcn components needed — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`,
`AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`,
`AlertDialogTitle`, and `Button` are all already installed and in active production use
(`excluir-contrato-dialog.tsx`, `arquivar-contrato-dialog.tsx`). `Trash2` (lucide-react) is
already imported elsewhere in the codebase (`column.tsx`) — no new package, no new registry.

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | `alert-dialog`, `button` (both pre-existing, no reinstall needed) | not required |
| third-party | none | not applicable |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
