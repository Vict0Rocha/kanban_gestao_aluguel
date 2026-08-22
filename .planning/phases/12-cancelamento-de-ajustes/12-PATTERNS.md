# Phase 12: Cancelamento de ajustes - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 4 (3 modified, 0 net-new — this phase is a pure generalization of Phase 11's own files, no new files)
**Analogs found:** 4 / 4 (all self-analogs — Phase 11's own code is both the pattern source and the file being modified)

**Scope note:** Every file in this phase already exists and was written in Phase 11. There is no
"find an analog elsewhere" step — the analog for each file IS the current content of that same
file. This document extracts the exact before/after diff each file needs, not a cross-codebase
pattern search.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `web/src/lib/kanban/actions.ts` (`cancelarPagamentoAction`) | service (Server Action) | CRUD (DELETE) | itself (Phase 11, lines 1293-1333) | exact — widen one `.eq()` to `.in()` |
| `web/src/lib/kanban/queries.ts` (`cancelarPagamento`) | service (client wrapper) | request-response | itself (Phase 11, lines 143-145) | exact — no signature change needed unless renamed |
| `web/src/components/financeiro/cancelar-pagamento-dialog.tsx` | component | request-response | itself (Phase 11, whole file) | exact — add `tipo` prop, read `TIPO[tipo].label` instead of hardcoded "pagamento" |
| `web/src/components/financeiro/parcela-historico-sheet.tsx` | component | request-response | itself (Phase 11, lines 107-118 + 126-135) | exact — widen boolean condition from `===` to `.includes()`, pass `tipo` through to dialog |

No files with zero analog — this phase does not touch schema, migrations, or any file Phase 11
didn't already establish the pattern for.

## Pattern Assignments

### `web/src/lib/kanban/actions.ts` — `cancelarPagamentoAction` (service, CRUD)

**Analog:** itself, `web/src/lib/kanban/actions.ts:1293-1333` (Phase 11)

**Current full function (lines 1293-1333):**
```typescript
export async function cancelarPagamentoAction(
  parcelaId: string,
  lancamentoId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela") ?? id(lancamentoId, "Lançamento")
  if (invalido) return { ok: false, error: invalido }

  // D-06: mesma trava que registrarPagamentoAction/ajustarParcelaAction já
  // usam, reuso verbatim — nenhuma parcela conciliada aceita cancelamento de
  // lançamento nenhum.
  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .delete()
    .eq("id", lancamentoId)
    .eq("parcela_id", parcelaId)
    .eq("tipo", "pagamento")
    .select("id")

  if (error) {
    console.error("cancelarPagamento", error)
    return { ok: false, error: erroDoBanco(error.code, "cancelar o pagamento") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("cancelar o pagamento") }
  }

  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}
```

**The only substantive change needed:** `.eq("tipo", "pagamento")` → `.in("tipo", ["pagamento", "acrescimo", "desconto"])`. This is the DELETE-conditioned race-safety trava (D-06 in 12-CONTEXT.md, D-06 in 11-CONTEXT.md) — never read-then-write. Everything else (`requireUser()`, `id()` validation, `exigirParcelaNaoConciliada`, `recalcularEGravarStatus`, `erroDoBanco`/`semLinhas` sanitization) is byte-identical, reused verbatim.

**Naming (Claude's Discretion per 12-CONTEXT.md):** either keep `cancelarPagamentoAction` name as-is (it now covers 3 tipos implicitly via the lançamento's own `id`), or rename to `cancelarLancamentoAction`. If renamed, update the export list in `web/src/lib/kanban/queries.ts:6-21` and the JSDoc comment block above the function (lines 1279-1292, which currently says "Cada lançamento `tipo='pagamento'`" — needs to say "pagamento/acréscimo/desconto").

**Shared helpers referenced (do not duplicate, import/call as-is):**
- `exigirParcelaNaoConciliada` — `web/src/lib/kanban/actions.ts:944-963`
- `recalcularEGravarStatus` — `web/src/lib/kanban/actions.ts:971-1014`
- `id()` validator, `erroDoBanco()`, `semLinhas()` — used identically, no change

---

### `web/src/lib/kanban/queries.ts` — `cancelarPagamento` (service, client wrapper)

**Analog:** itself, `web/src/lib/kanban/queries.ts:143-145` (Phase 11)

**Current (lines 143-145):**
```typescript
export async function cancelarPagamento(parcelaId: string, lancamentoId: string) {
  return unwrap(cancelarPagamentoAction(parcelaId, lancamentoId))
}
```

**Change:** none required to the signature — `lancamentoId` alone is enough for the server action to find and validate the row's `tipo`. If the Server Action is renamed (see above), rename this wrapper and its import (line 6 in the import block) to match, and update the call site in `cancelar-pagamento-dialog.tsx`.

---

### `web/src/components/financeiro/cancelar-pagamento-dialog.tsx` (component, request-response)

**Analog:** itself, whole file (103 lines, Phase 11) — read in full above.

**Imports pattern (lines 1-17) — unchanged, add one import:**
```typescript
"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { formatCurrency, formatDate } from "@/lib/kanban/format"
import { cancelarPagamento } from "@/lib/kanban/queries"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
```
Add: `import type { LancamentoDetalhado } from "@/lib/kanban/parcelas"` for the `tipo` prop type, and import the `TIPO` label map — currently `TIPO` is a private const inside `lancamento-tipo-label.tsx` (not exported). **Executor must export `TIPO` from `lancamento-tipo-label.tsx`** (or export a small `TIPO_LABEL` map) so this dialog can read `TIPO[tipo].label` per D-08 (12-CONTEXT.md) instead of re-declaring the three strings.

**Props pattern (lines 25-39) — add `tipo`:**
```typescript
export function CancelarPagamentoDialog({   // or renamed CancelarLancamentoDialog
  parcelaId,
  lancamentoId,
  tipo,          // NEW: "pagamento" | "acrescimo" | "desconto" (never "destrava" — trigger never opens for it)
  valor,
  data,
  open,
  onOpenChange,
}: {
  parcelaId: string
  lancamentoId: string
  tipo: Extract<LancamentoDetalhado["tipo"], "pagamento" | "acrescimo" | "desconto">
  valor: number
  data: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
```

**Reset-on-open pattern (lines 44-54) — unchanged, reuse verbatim:**
```typescript
const [wasOpen, setWasOpen] = React.useState(open)
if (open !== wasOpen) {
  setWasOpen(open)
  if (open) {
    setSaving(false)
    setError(null)
  }
}
```

**Error-handling pattern (lines 56-71) — swap hardcoded string for tipo-aware template:**
```typescript
async function handleConfirm() {
  setSaving(true)
  setError(null)
  try {
    await cancelarPagamento(parcelaId, lancamentoId)
    onOpenChange(false)
    router.refresh()
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : `Não foi possível cancelar o ${rotulo}. Tente novamente.`   // was hardcoded "o pagamento"
    )
    setSaving(false)
  }
}
```
Where `const rotulo = TIPO[tipo].label.toLowerCase()`.

**Core JSX pattern (lines 73-102) — the known production bug guard MUST survive unchanged:**
```typescript
<AlertDialogDescription>
  {TIPO[tipo].label} de {formatCurrency(valor)}
  {data ? ` em ${formatDate(data)}` : ""}. O lançamento é apagado e o
  status da parcela é recalculado a partir do que sobrar. Esta ação
  não pode ser desfeita.
</AlertDialogDescription>
```
**Critical:** the `{data ? ... : ""}` guard (line 80 in current file) is the exact fix for the `RangeError: Invalid time value` bug shipped and fixed in commit `284e52b`. `formatDate("")` throws. This guard is not tipo-specific — it must be copied byte-for-byte, never re-simplified to `formatDate(data)` unconditionally, regardless of which tipo is being cancelled.

Title and confirm button become templated:
```typescript
<AlertDialogTitle>Cancelar este {rotulo}?</AlertDialogTitle>
...
{saving ? "Cancelando..." : `Cancelar ${rotulo}`}
```

---

### `web/src/components/financeiro/parcela-historico-sheet.tsx` (component, request-response)

**Analog:** itself, `web/src/components/financeiro/parcela-historico-sheet.tsx` (Phase 11, full file read above).

**State pattern (line 55) — unchanged:**
```typescript
const [cancelando, setCancelando] = React.useState<LancamentoDetalhado | null>(null)
```

**Trigger visibility condition (lines 107-118) — the one line that changes in render logic:**
```typescript
// BEFORE (Phase 11):
{lancamento.tipo === "pagamento" && !parcelaConciliada && (

// AFTER (Phase 12, per 12-UI-SPEC.md Component Notes):
{["pagamento", "acrescimo", "desconto"].includes(lancamento.tipo) && !parcelaConciliada && (
  <div className="flex justify-end">
    <Button variant="ghost" size="xs" onClick={() => setCancelando(lancamento)}>
      <Trash2 className="size-3" />
      Cancelar
    </Button>
  </div>
)}
```
Everything else about the trigger (icon, size, ghost variant, text label) is byte-identical — no visual change, per UI-SPEC.

**Dialog wiring (lines 126-135) — add `tipo` prop passthrough:**
```typescript
<CancelarPagamentoDialog   // or renamed CancelarLancamentoDialog
  parcelaId={parcelaId}
  lancamentoId={cancelando?.id ?? ""}
  tipo={cancelando?.tipo ?? "pagamento"}   // NEW — safe fallback while closed, dialog is mounted-but-closed so this value is never acted on
  valor={cancelando?.valor ?? 0}
  data={cancelando?.data ?? ""}
  open={cancelando !== null}
  onOpenChange={(open) => {
    if (!open) setCancelando(null)
  }}
/>
```
Note: `cancelando?.tipo` is typed `LancamentoDetalhado["tipo"]` which includes `"destrava"` — but since the trigger (above) never sets `cancelando` to a `destrava` lançamento, this is safe in practice. If TypeScript strictness requires it, narrow with a small cast or a type guard at the `setCancelando` call site; do not change the visibility condition to accommodate this — the visibility condition is the actual guard (D-01).

**Import line (line 8) — update only if the component/file is renamed:**
```typescript
import { CancelarPagamentoDialog } from "@/components/financeiro/cancelar-pagamento-dialog"
```

---

## Shared Patterns

### Auth + validation (Server Action entry, unchanged)
**Source:** `web/src/lib/kanban/actions.ts:1297-1301` (and every other action in the file)
**Apply to:** `cancelarPagamentoAction`/renamed equivalent — no change needed, already correct
```typescript
const sessao = await requireUser()
if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

const invalido = id(parcelaId, "Parcela") ?? id(lancamentoId, "Lançamento")
if (invalido) return { ok: false, error: invalido }
```

### Conciliada trava (server + UI halves)
**Server source:** `exigirParcelaNaoConciliada`, `web/src/lib/kanban/actions.ts:944-963` — reused verbatim, unchanged.
**UI source:** `parcela-historico-sheet.tsx`'s `!parcelaConciliada` clause in the trigger condition — the visibility rule, already threaded as a prop from the parent (`parcela-historico-sheet.tsx:47`), no new prop needed.
**Error copy generalization (12-UI-SPEC.md Copywriting Contract):** the conciliada-race error message needs to drop its pagamento-specific wording. Current message constant (line 933-934 of `actions.ts`):
```typescript
const MENSAGEM_PARCELA_CONCILIADA =
  "Esta parcela está conciliada e travada contra alteração. Destrave antes de registrar pagamento ou lançar um ajuste."
```
This message is already tipo-neutral (shared by `registrarPagamentoAction`/`ajustarParcelaAction`/`cancelarPagamentoAction` today) — no change needed here; it already reads correctly for all three tipos. UI-SPEC's "generalized" wording ("...antes de cancelar.") refers to a *different*, more specific message that may exist client-side in the dialog's own fallback error text — verify at implementation time whether `MENSAGEM_PARCELA_CONCILIADA` (server, shared, generic) is what actually surfaces, or whether the dialog has its own copy of a pagamento-specific variant to update. Based on the code read here, only the shared server constant is in play — no separate client-side string was found duplicating this message.

### DELETE-conditioned race safety (core mechanism)
**Source:** `cancelarPagamentoAction`, `web/src/lib/kanban/actions.ts:1309-1315`
**Apply to:** the single line change in this same function — `.eq("tipo", "pagamento")` → `.in("tipo", ["pagamento", "acrescimo", "desconto"])`. This is the actual concurrency guard (never read-then-write); widening the `.in()` list is the entire scope of the server-side change.

### Status recalculation (never hardcoded)
**Source:** `recalcularEGravarStatus`, `web/src/lib/kanban/actions.ts:971-1014` — reused verbatim, unchanged, called identically after the DELETE succeeds.

### Tipo label centralization (D-08)
**Source:** `TIPO` const, `web/src/components/financeiro/lancamento-tipo-label.tsx:11-32` — currently **not exported** (module-private). Must be exported (or re-exported via a small named export like `TIPO_LABEL`) so `cancelar-pagamento-dialog.tsx` can read `TIPO[tipo].label` without re-declaring the three strings ("Pagamento"/"Acréscimo"/"Desconto"). This is the single cross-cutting change needed to satisfy D-08's "one component, no duplicated rótulos" requirement.

## No Analog Found

None. This phase modifies exactly the four files Phase 11 already created; every pattern needed already exists in those same files.

## Metadata

**Analog search scope:** `web/src/lib/kanban/actions.ts`, `web/src/lib/kanban/queries.ts`, `web/src/components/financeiro/cancelar-pagamento-dialog.tsx`, `web/src/components/financeiro/parcela-historico-sheet.tsx`, `web/src/components/financeiro/lancamento-tipo-label.tsx`
**Files scanned:** 5 (all read in full or via targeted line ranges, no re-reads)
**Pattern extraction date:** 2026-08-21
