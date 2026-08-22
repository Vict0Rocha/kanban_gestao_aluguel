---
phase: 12
slug: cancelamento-de-ajustes
status: draft
shadcn_initialized: true
preset: base-nova (baseColor neutral, cssVariables true, iconLibrary lucide — pre-existing, not re-run this session)
created: 2026-08-21
---

# Phase 12 — UI Design Contract

> Visual and interaction contract for Cancelamento de ajustes. This phase does **not** introduce
> a single new pixel or color — it generalizes the exact surface `11-UI-SPEC.md` already shipped
> (one "Cancelar" trigger per eligible lançamento inside `ParcelaHistoricoSheet`, one confirmation
> `AlertDialog`) from covering `tipo='pagamento'` alone to covering `tipo='pagamento'`,
> `tipo='acrescimo'` and `tipo='desconto'` together. Every value below is either copied verbatim
> from `11-UI-SPEC.md` (untouched surfaces) or derived mechanically from `LancamentoTipoLabel`'s
> already-centralized per-tipo copy (D-08, 12-CONTEXT.md) — nothing here is a new design decision,
> per 12-CONTEXT.md's own framing ("mesma maneira que foi feito para os pagamentos").
> `tipo='destrava'` is explicitly excluded from every surface below (D-01).

---

## Scope Note

In scope for this document: widening the "Cancelar" trigger's visibility condition inside
`ParcelaHistoricoSheet` from one tipo to three, and generalizing `CancelarPagamentoDialog`'s copy
to read from `LancamentoTipoLabel` instead of a hardcoded "pagamento" string (D-08).

Out of scope (unchanged from `11-UI-SPEC.md`, do not re-derive): `ParcelasTable`'s `AcoesCell`
(row-level table actions), Conciliar/Destravar (Phase 7), any new route, the trigger's
`ghost`/`size="xs"` styling, the dialog's `AlertDialog` component choice, the destructive color
rule, the nested-portal (Sheet + AlertDialog) composition risk and its verified fix.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn (already initialized — `web/components.json`) — unchanged from Phase 11 |
| Preset | `style: "base-nova"`, `baseColor: "neutral"`, `cssVariables: true`, `iconLibrary: "lucide"` |
| Component library | Base UI (`@base-ui/react`) — `AlertDialog` (`web/src/components/ui/alert-dialog.tsx`), already installed and now proven in production for this exact Sheet-nested composition (Phase 11 human-check confirmed no visual break) |
| Icon library | lucide-react — `Trash2` for the trigger (unchanged, no new icon); `Banknote`/`TrendingUp`/`TrendingDown` for the per-tipo label are pre-existing in `LancamentoTipoLabel`, untouched by this phase |
| Font | `var(--font-body)` (body, via `font-sans`) / `var(--font-heading-family)` (dialog title, via `font-heading`) — both pre-existing, untouched |

**No new component choice to make.** `11-UI-SPEC.md` already settled `AlertDialog` +
`variant="destructive"` as the correct shape for this class of action (genuine, irreversible
`DELETE`, no motivo field). That reasoning is `tipo`-independent — cancelling an `acrescimo` or a
`desconto` is exactly as irreversible as cancelling a `pagamento` (same `DELETE` mechanism, D-02).
Nothing about the dialog's structure changes; only the copy inside it becomes tipo-aware.

---

## Component Notes

### Row-level trigger (`ParcelaHistoricoSheet`)

Current (Phase 11) condition, per `parcela-historico-sheet.tsx:107`:

```
{lancamento.tipo === "pagamento" && !parcelaConciliada && ( ... )}
```

New condition (the only line that changes in this file's render logic):

```
{["pagamento", "acrescimo", "desconto"].includes(lancamento.tipo) && !parcelaConciliada && (
  <div className="flex justify-end">
    <Button variant="ghost" size="xs" onClick={() => setCancelando(lancamento)}>
      <Trash2 className="size-3" />
      Cancelar
    </Button>
  </div>
)}
```

Everything else about the trigger is byte-identical to `11-UI-SPEC.md`: `variant="ghost"
size="xs"`, `Trash2` icon at `size-3`, visible "Cancelar" text label (not icon-only — this
project's every acceptance criterion is verified by a human reading the screen, per Phase 11's
own rationale), no destructive tint on the trigger itself (destructive color stays reserved for
the dialog's confirming action — see Color section). The 24px touch-target exception carries over
unchanged (same justification: visible text label, spacious sheet padding, pre-existing button
size token).

`aria-label`, if the executor wants one: generalize the Phase 11 template to read the tipo —
`` `Cancelar ${TIPO[lancamento.tipo].label.toLowerCase()} de ${formatCurrency(lancamento.valor)} — ${formatDate(lancamento.data)}` ``
(reusing `LancamentoTipoLabel`'s exported label map, or an equivalent local lowercase lookup).

### Visibility rule (D-06/D-07 — conciliada trava, UI half — unchanged)

Identical to Phase 11: `parcelaConciliada` is already threaded into `ParcelaHistoricoSheet` as a
prop (`parcela-historico-sheet.tsx:47`) — no new prop needed. No "Cancelar" button, for any of the
three eligible tipos, renders when the parcela is conciliada. This remains the UI-visible
consequence of the server-enforced `exigirParcelaNaoConciliada` trava (D-07), not the boundary
itself.

### Generalized dialog: `CancelarPagamentoDialog` → tipo-aware

D-08 (12-CONTEXT.md, explicit): one component for all three tipos, not three copies. The
component gains a `tipo` prop (`LancamentoDetalhado["tipo"]`, narrowed at the call site to
`"pagamento" | "acrescimo" | "desconto"` — `destrava` is never passed in, since the trigger that
opens this dialog never renders for `destrava` per the visibility rule above) and reads its label
from `LancamentoTipoLabel`'s existing `TIPO` map rather than a hardcoded "pagamento" string.
Naming the renamed file/component/prop (e.g. `CancelarLancamentoDialog`,
`cancelarLancamentoAction`) is explicitly left to the planner/executor per 12-CONTEXT.md's
`<decisions>` § Claude's Discretion — this document only fixes the pixels and copy, not the
identifier.

**Known production bug — do not reintroduce.** `data` can be an empty string while the dialog is
mounted-but-closed (`cancelando === null` in `ParcelaHistoricoSheet` renders
`data={cancelando?.data ?? ""}`). `formatDate("")` constructs an invalid `Date`, and
`Intl.DateTimeFormat.format()` throws (`RangeError: Invalid time value`) the instant any parcela
row renders — this exact bug shipped and broke production once already (Phase 11, fixed in
`284e52b`). The current fixed code guards with `{data ? ` em ${formatDate(data)}` : ""}` — this
guard **must** survive the generalization unchanged; it is not specific to `tipo='pagamento'`.

```
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancelar este {rotulo}?</AlertDialogTitle>
      <AlertDialogDescription>
        {TIPO[tipo].label} de {formatCurrency(valor)}
        {data ? ` em ${formatDate(data)}` : ""}. O lançamento é apagado e o
        status da parcela é recalculado a partir do que sobrar. Esta ação
        não pode ser desfeita.
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
        {saving ? "Cancelando..." : `Cancelar ${rotulo}`}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Where `rotulo = TIPO[tipo].label.toLowerCase()` — `"pagamento"` / `"acréscimo"` / `"desconto"`.
This produces, verbatim, the exact three strings in the Copywriting Contract below. No gender or
agreement edge case: "este pagamento" / "este acréscimo" / "este desconto" all take the masculine
`este` correctly, so a single template works for all three tipos without a lookup table for
grammatical gender.

No `AlertDialogMedia`/icon in the header — unchanged from Phase 11 (matches
`ExcluirContratoDialog`'s plain-text irreversible-delete precedent).

**Composition risk — already resolved, not reopened.** Phase 11's human-check confirmed the
Sheet-nested `AlertDialog` does not break visually in this codebase. This phase reuses the exact
same composition (same two components, same nesting) — no new verification needed beyond
confirming each of the three tipos individually still opens/closes cleanly, since the risk was in
the portal composition itself, not in which tipo's copy is displayed.

---

## Spacing Scale

Declared values (must be multiples of 4) — unchanged from `11-UI-SPEC.md`, no new spacing
introduced by widening a boolean condition and swapping a hardcoded string for a lookup:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | `gap-1` inside the `size="xs"` trigger button (icon-to-label) |
| sm | 8px | Card's existing `gap-2` rhythm (`ParcelaHistoricoSheet`'s `<li>`) |
| md | 16px | `AlertDialogContent`'s existing `p-4`/`gap-4` (pre-existing component default) |
| lg | 24px | Not used by this phase |
| xl | 32px | Not used by this phase |
| 2xl | 48px | Not used by this phase |
| 3xl | 64px | Not used by this phase |

Exceptions: the row trigger's `size="xs"` button is 24px tall (`h-6`) — same accepted, pre-existing
exception as Phase 11 (visible text label, spacious sheet padding, pre-shipped token).

---

## Typography

Unchanged from `11-UI-SPEC.md` — no new size or weight introduced:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body / dialog description | 14px (`text-sm`) | 400 regular | default (Tailwind `text-sm`, ~1.43) |
| Row trigger label ("Cancelar") | 12px (`text-xs`, `size="xs"` button) | 500 medium (inherited `buttonVariants` default) | default tight button line-height |
| Dialog title | 16px (`text-base`) | 500 medium (inherited `AlertDialogTitle` default) | `leading-none` |
| Error text | 14px (`text-sm`), `text-destructive` | 400 regular | same as body |

Two weights total: 400 regular (description/error), 500 medium (button label/title) — both
inherited component defaults.

---

## Color

Unchanged from `11-UI-SPEC.md` — same rule, now applied uniformly across three tipos instead of
one:

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--background)` | Page background behind the Financeiro table (unchanged) |
| Secondary (30%) | `var(--popover)` / `var(--card)` | `AlertDialogContent` surface, `ParcelaHistoricoSheet`'s lançamento cards (unchanged) |
| Accent (10%) | `var(--primary)` | **Not used anywhere in this phase** — no "confirm and proceed happily" action for any of the three tipos |
| Destructive | `var(--destructive)` `oklch(0.577 0.245 27.325)` light / `oklch(0.704 0.191 22.216)` dark | **Exactly two places, per tipo:** (1) `AlertDialogAction variant="destructive"` — the "Cancelar {rotulo}" confirm button, because the action performs a real, irreversible `DELETE` regardless of which of the three tipos is being cancelled (D-02); (2) inline error text (`text-sm text-destructive`) inside the dialog on server rejection |

Accent reserved for: not applicable — same as Phase 11. The row-level "Cancelar" trigger stays
neutral `ghost` for all three tipos; destructive color marks only the confirmed action inside the
dialog. **Note:** `LancamentoTipoLabel`'s own per-tipo icon tint (`text-status-good` for
pagamento, `text-status-warning` for acréscimo, `text-muted-foreground` for desconto/destrava) is
a pre-existing, untouched surface — it colors the tipo badge at the top of each `<li>`, not the
cancel trigger or the dialog. This phase does not touch that mapping.

---

## Copywriting Contract

Every row below is generated mechanically from `TIPO[tipo].label` (`LancamentoTipoLabel`) —
`"Pagamento"` / `"Acréscimo"` / `"Desconto"` — per D-08. No new copy is authored per tipo; the
sentence templates are Phase 11's, with the tipo label substituted in.

| Element | Copy |
|---------|------|
| Row trigger label | **"Cancelar"** (unchanged) — appears next to any lançamento whose `tipo` is `pagamento`, `acrescimo`, or `desconto`, only when the parcela is not conciliada (D-07) |
| Dialog title | **"Cancelar este pagamento?"** / **"Cancelar este acréscimo?"** / **"Cancelar este desconto?"** — `` `Cancelar este ${rotulo}?` `` |
| Dialog description | **"Pagamento de {formatCurrency(valor)} em {formatDate(data)}. O lançamento é apagado e o status da parcela é recalculado a partir do que sobrar. Esta ação não pode ser desfeita."** / same sentence with **"Acréscimo de..."** / **"Desconto de..."** — `` `${TIPO[tipo].label} de ${formatCurrency(valor)}${data ? ` em ${formatDate(data)}` : ""}. O lançamento é apagado e o status da parcela é recalculado a partir do que sobrar. Esta ação não pode ser desfeita.` `` |
| Dialog back-out button | **"Voltar"** (unchanged) — same collision-avoidance rationale as Phase 11 extends cleanly to all three tipos: "Cancelar" would read as "cancel the cancellation" whether the thing being cancelled is a pagamento, an acréscimo, or a desconto |
| Confirm button (idle / pending) | **"Cancelar pagamento"** / **"Cancelar acréscimo"** / **"Cancelar desconto"**, then **"Cancelando..."** while `saving` — `` `Cancelar ${rotulo}` `` / `"Cancelando..."` (the pending label stays tipo-agnostic, matching Phase 11) |
| Error state (server rejects — e.g. lançamento already gone) | **"Não foi possível cancelar o pagamento. Tente novamente."** / **"Não foi possível cancelar o acréscimo..."** / **"Não foi possível cancelar o desconto..."** — `` `Não foi possível cancelar o ${rotulo}. Tente novamente.` ``, via `erroDoBanco()` sanitization if the rejection is a raw DB error |
| Error state — conciliada race (parcela becomes conciliada in another tab between sheet load and confirm click) | **"Esta parcela está conciliada e travada contra alteração. Destrave antes de cancelar."** — generalized from Phase 11's pagamento-specific wording ("...antes de cancelar um pagamento") to a tipo-neutral close, since the same server message now guards three different actions; still reuses the exact CONCIL-02 opening sentence already shipped in `07-UI-SPEC.md` |
| Empty state | Not introduced by this phase — `ParcelaHistoricoSheet`'s existing empty copy ("Nenhum lançamento registrado ainda...") is untouched; cancelling any lançamento (of any tipo) can reduce the list to zero rows, already handled by the existing `lancamentos.length === 0` conditional |
| Destructive confirmation | See "Dialog title"/"Dialog description"/"Confirm button" rows above — one confirmation surface serving three tipos |

---

## UI Considerations

Extends `11-UI-SPEC.md`'s probe coverage (E1 row trigger, E2 confirmation dialog, E3 Sheet/AlertDialog
composition) to the widened tipo set. No new element category is introduced — the only material
change is E1's `zero-one-many` row, which now spans three tipos instead of one, and E2's
`populated` row, which now has three copy variants instead of one. Every other row from Phase 11
carries over unchanged (same components, same states, same resolutions).

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| zero-one-many | "Cancelar" triggers across a parcela's lançamentos list, now spanning 3 eligible tipos (E1) | ✅ resolved (explicit) | Each `pagamento`/`acrescimo`/`desconto` lançamento gets its own independent trigger (D-03, inherited from 11-CONTEXT.md D-02) — a parcela can show zero, one, or many triggers in any combination of the three tipos (e.g. 1 pagamento + 2 acréscimos + 1 desconto = 4 independent triggers); each cancels only that specific row. `destrava` rows never render a trigger, at any count |
| conditional visibility | "Cancelar" trigger on a conciliada parcela's lançamentos, any tipo (E1) | ✅ resolved (explicit) | Hidden entirely for all three eligible tipos (D-07) — unchanged mechanism from Phase 11, now gating three tipos instead of one |
| populated | `CancelarPagamentoDialog`/generalized dialog with a real amount/date, 3 copy variants (E2) | ✅ resolved (explicit) | Title + description + confirm-button rows above, one template parameterized by `TIPO[tipo].label` — same destructive-variant confirm button regardless of which of the 3 tipos is shown |
| loading | Confirm button while `saving` (E2) | ✅ resolved (explicit) | "Cancelando..." label + `disabled={saving}` — tipo-agnostic, unchanged from Phase 11 |
| error | Server rejection, generic (E2) | ✅ resolved (explicit) | Inline `text-sm text-destructive` slot, tipo-aware message — see Copywriting Contract |
| error | Race — parcela becomes conciliada mid-flow (E2) | ✅ resolved (explicit) | Same inline slot, tipo-neutral message reusing the CONCIL-02 opening sentence — see Copywriting Contract |
| overflow | Long `endereco`/large `valor` inside the dialog description (E2) | ✅ resolved (explicit) | Same short single-sentence shape as Phase 11 for all 3 tipos — no realistic overflow risk at this project's scale, already proven in production for the pagamento variant |
| composition | `AlertDialog` opened from inside an already-open `Sheet` (E3) | 🧪 resolved (backstop, already verified in Phase 11) | Not a new risk — same composition, already human-checked in production for the pagamento path (11-UI-SPEC.md). Executor should still spot-check that acréscimo/desconto triggers open the same dialog instance cleanly, since it is now reached from three different rows instead of one, but the underlying portal risk was already retired |

**Dismissed in bulk (carried over from Phase 11, unchanged reasoning):** E1's
`empty`/`loading`/`error`/`partial` — the row trigger is still a static, always-rendered `Button`
with a fixed "Cancelar" label and no data fetch of its own. E2's `partial`/`long-text` — dialog
content is still read synchronously and completely from the clicked lançamento, with no free-text
user input rendered inside it beyond what the `overflow` row already covers.

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

---

## Registry Safety

No new shadcn components needed — identical inventory to `11-UI-SPEC.md`: `AlertDialog`,
`AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`,
`AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`, and `Button` are all already
installed and in active production use. `Trash2` (lucide-react) is already imported elsewhere in
the codebase. No new package, no new registry, no new icon.

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
