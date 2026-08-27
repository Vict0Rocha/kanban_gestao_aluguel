# Phase 17: Exclusão de coluna sem cascade para cards ativos - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6 (RESEARCH.md already contains full working code for every file — this map confirms/deepens analog provenance for the planner)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `web/src/lib/kanban/actions.ts` — NEW `excluirColunaComMovimentoAction` | service (Server Action) | CRUD (multi-step: read-then-write) | `reordenarCardsAction` (`actions.ts:594-635`, same file) for bulk-move mechanics; `podarParcelasOrfas` (`actions.ts:395-441`) for "re-query at write time, never trust client id list" discipline | exact (mechanical) + exact (security discipline) |
| `web/src/lib/kanban/actions.ts` — MODIFIED `deleteColumnAction` (add precheck) | service (Server Action) | CRUD | `cardTemLancamento` / `deleteCardAction` (`actions.ts:671-759`) — "reject if related rows still exist" existence-check pattern | role-match |
| `web/src/lib/kanban/queries.ts` — NEW `excluirColunaComMovimento` wrapper | service (client-callable wrapper) | request-response | `reordenarCards` (Phase 16, same file) — thin `unwrap(...Action(...))` wrapper | exact |
| `web/src/components/kanban/excluir-coluna-dialog.tsx` — NEW | component (dialog) | request-response (client-triggered mutation) | `excluir-contrato-dialog.tsx` (full file) for the multi-branch `fase`-style state machine (empty / blocked / picker); `reordenar-dialog.tsx` (full file) for the column-picker list-of-buttons sub-pattern | exact (branching structure) + exact (picker sub-pattern) |
| `web/src/components/kanban/column.tsx` — MODIFIED (remove inline `AlertDialog`, add `columns` prop, wire new dialog) | component | request-response | itself (current inline `AlertDialog`, lines ~143-175) is the analog being replaced; prop-drilling pattern mirrors how `board.tsx` already passes `columns` to `ReordenarDialog` | exact |
| `web/src/components/kanban/board.tsx` — MODIFIED (`handleDeleteColumnComMovimento`, pass `columns` to `<Column>`) | component (container/handler) | request-response (optimistic update) | `handleDeleteColumn` (`board.tsx:279-286`) for `persistOrRevert` shape; `handleReordenar` (`board.tsx:351-386`) for building the destination column's optimistic card list with `GAP`-based positions | exact |

## Pattern Assignments

### `web/src/lib/kanban/actions.ts` — NEW `excluirColunaComMovimentoAction` (service, CRUD)

**Analogs:** `reordenarCardsAction` (`actions.ts:594-635`) + `podarParcelasOrfas` (`actions.ts:395-441`) + `deleteColumnAction` (`actions.ts:295-327`)

**Auth/validation pattern (from `deleteColumnAction`, lines 121-125):**
```ts
const sessao = await requireUser()
if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
const invalido = id(columnId, "Coluna")
if (invalido) return { ok: false, error: invalido }
```

**Bulk-move core pattern (from `reordenarCardsAction`, lines 594-635):** cap `cardIds.length` at 200, `Promise.all` of per-card `.update({ column_id, position: (index+1)*GAP })`, then check both `error` across all results AND zero-rows (`semLinhas`) before returning `ok`.

**"Never trust client id list, re-query at write time" discipline (from `podarParcelasOrfas`, `actions.ts:371-394` comment):** re-query `cards where column_id = columnId` inside the action itself rather than accepting a `cardIds: string[]` parameter from the client.

**Full recommended implementation is already written out verbatim in RESEARCH.md lines 152-245** (`excluirColunaComMovimentoAction`) — copy directly, including:
- Server-authoritative re-query of both `columnId` and `destinoColumnId` rows + `board_id` equality check (new validation not present in either analog, needed because this action accepts two ids)
- `base = maior position já usada no destino` (mirrors `handleCreateCard`'s "append after max position" caution)
- Sequential shape: move cards → check errors/zero-rows → only then `.from("columns").delete(...)` (same P0001 mapping as existing `deleteColumnAction`)

**Error handling pattern:** `console.error("excluirColunaComMovimento (<step>)", error)` then `erroDoBanco(error.code, "<ação em português>")` — matches every other multi-step action in this file (e.g. `podarParcelasOrfas`, `registrarPagamentoAction`).

---

### `web/src/lib/kanban/actions.ts` — MODIFIED `deleteColumnAction` (service, CRUD)

**Analog:** `cardTemLancamento`/`deleteCardAction` existence-check pattern (`actions.ts:671-759`)

**Current state (lines 121-137, to be modified):**
```ts
export async function deleteColumnAction(columnId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
  const invalido = id(columnId, "Coluna")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("columns").delete().eq("id", columnId).select("id")

  if (error) {
    if (error.code === "P0001") return { ok: false, error: EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO }
    return { ok: false, error: erroDoBanco(error.code, "excluir a coluna") }
  }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("excluir a coluna") }
  return { ok: true, data: undefined }
}
```

**Precheck to add (RESEARCH.md lines 450-474), modeled on existence-check-before-write style used elsewhere in this file:**
```ts
const { data: algumCard, error: erroCard } = await sessao.supabase
  .from("cards").select("id").eq("column_id", columnId).limit(1)
if (erroCard) {
  console.error("deleteColumn (precheck)", erroCard)
  return { ok: false, error: erroDoBanco(erroCard.code, "excluir a coluna") }
}
if ((algumCard?.length ?? 0) > 0) {
  return { ok: false, error: "Esta coluna ainda tem imóveis. Mova-os para outra coluna antes de excluir." }
}
```

**Also required in the same edit:** remove/update the now-stale comment at `actions.ts:310-317` that argues against a precheck ("Nenhuma pré-checagem própria é acrescentada aqui...") — Pitfall 1 in RESEARCH.md flags this explicitly.

---

### `web/src/lib/kanban/queries.ts` — NEW `excluirColunaComMovimento` wrapper (service, request-response)

**Analog:** `reordenarCards` (Phase 16, same file) — every wrapper in this file follows the identical one-line shape.

**Pattern:**
```ts
export async function excluirColunaComMovimento(id: string, destinoId: string) {
  return unwrap(excluirColunaComMovimentoAction(id, destinoId))
}
```

---

### `web/src/components/kanban/excluir-coluna-dialog.tsx` — NEW (component, request-response)

**Primary analog:** `excluir-contrato-dialog.tsx` (full file) — multi-branch state-machine structure (`fase: verificando | permitido | bloqueado | verificacao-falhou` at lines 26-30). This phase's component needs 3 branches instead of 4, and — unlike `excluir-contrato-dialog.tsx` — needs **no async pre-flight/loading branch**, because `column.cards.length` and sibling-column count are already synchronously available from `Board`'s client state. Branch selection here is a plain `if`/`return` cascade, not `useState`-driven `fase`.

**Secondary analog:** `reordenar-dialog.tsx` (full file) — the column-picker sub-pattern (list of `Button`s, `variant={selecionada === c.id ? "default" : "ghost"}`) is copied for the picker branch. **Do not reuse `ReordenarDialog` as a component directly** — its trigger renders a labeled "Reordenar" button, but this dialog's trigger must stay the existing small icon-only trash-can `Button` already inline in `column.tsx`'s header.

**Confirm-and-close semantics — deviate from `ReordenarDialog`'s `await onConfirm()` pattern:** RESEARCH.md notes `ReordenarDialog`'s await is cosmetic (the call site wraps a sync function in `async`, resolving on next microtask regardless of persistence outcome). Model this dialog's confirm handler on `handleDeleteColumn`'s existing fire-and-forget `persistOrRevert` pattern instead — call `onExcluirComMovimento(...)` synchronously and `setOpen(false)` immediately, no local `saving` state.

**Full recommended component is written out verbatim in RESEARCH.md lines 264-381** — three branches:
1. `vazia` (0 cards): `AlertDialog`, same copy as today ("Essa ação não pode ser desfeita."), calls `onExcluirVazia`
2. `outrasColunas.length === 0` (D-02 blocked state): `AlertDialog`, single "Fechar" `AlertDialogCancel`, message "Crie outra coluna antes de excluir esta." — mirrors `excluir-contrato-dialog.tsx`'s `fase === "bloqueado"` branch (`excluir-contrato-dialog.tsx:111-147`)
3. picker (≥1 card, ≥1 other column): `Dialog` + list of `Button`s (copied from `reordenar-dialog.tsx`), confirm button `disabled={!selecionada}`, fires `onExcluirComMovimento(column.id, selecionada!)` then closes

**Imports pattern** (from RESEARCH.md's full component, lines 267-279):
```tsx
"use client"
import * as React from "react"
import { Trash2 } from "lucide-react"
import type { Column as ColumnType } from "@/lib/kanban/types"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
```

---

### `web/src/components/kanban/column.tsx` — MODIFIED (component, request-response)

**Analog:** itself — the block being replaced (current inline `AlertDialog`, lines ~143-175, quoted in full in RESEARCH.md lines 76-103 and CONTEXT.md line 48).

**Change:** replace that block with:
```tsx
<ExcluirColunaDialog
  column={column}
  outrasColunas={columns.filter((c) => c.id !== column.id)}
  onExcluirVazia={onDeleteColumn}
  onExcluirComMovimento={onDeleteColumnComMovimento}
/>
```

**Prop signature change** — current (lines 28-57):
```ts
{ column, searching, matchedIds, onRename, onDeleteColumn, onDeleteCard, onArquivarCard,
  onUpdateCard, onToggleAtivo, onCreateCard, registerRef }
```
Add `columns: ColumnType[]` and `onDeleteColumnComMovimento: (id: string, destinoId: string) => void` — mirrors how `ReordenarDialog` already receives `columns={columns}` directly from `Board` (`board.tsx:412`).

---

### `web/src/components/kanban/board.tsx` — MODIFIED (component/container, request-response with optimistic update)

**Analogs:** `handleDeleteColumn` (`board.tsx:279-286`) for the `persistOrRevert` envelope; `handleReordenar` (`board.tsx:351-386`) for building the destination column's optimistic card list.

**`handleDeleteColumn` pattern to envelope (lines 279-286):**
```ts
async function handleDeleteColumn(id: string) {
  persistOrRevert(
    columns.filter((c) => c.id !== id),
    columns,
    () => deleteColumn(id),
    "Não foi possível excluir a coluna."
  )
}
```

**New handler — full implementation in RESEARCH.md lines 418-441**, combines both analogs: filters the origin column out, appends origin's cards (remapped `column_id` + `base + (index+1)*GAP` position, `base` = destination's current max position) into the destination column, then `persistOrRevert(optimistic, columns, () => excluirColunaComMovimento(columnId, destinoColumnId), "Não foi possível excluir a coluna.")`.

**Also required:** add `columns={columns}` to the existing `<Column ... />` render call (`board.tsx:434-449`), same prop `Board` already passes to `ReordenarDialog` at line 412.

---

## Shared Patterns

### Server Action auth/validation envelope
**Source:** `actions.ts` — every action (e.g. `deleteColumnAction` lines 121-125, `excluirColunaComMovimentoAction` lines 168-176 in RESEARCH.md)
**Apply to:** the new `excluirColunaComMovimentoAction` and the modified `deleteColumnAction`
```ts
const sessao = await requireUser()
if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
const invalido = id(columnId, "Coluna") /* ?? id(otherId, "...") if multiple ids */
if (invalido) return { ok: false, error: invalido }
```

### "Re-query at write time, never trust client id list/flag" discipline
**Source:** `podarParcelasOrfas` (`actions.ts:371-394`), extended in this phase to `excluirColunaComMovimentoAction`'s card re-query and the `deleteColumnAction` precheck
**Apply to:** both `actions.ts` changes — never accept a `cardIds` array or an "is this column empty" boolean from the client; always re-derive from the database at write time.

### `persistOrRevert` optimistic-write envelope
**Source:** `board.tsx` — every `handle*` function (e.g. `handleDeleteColumn` 279-286, `handleReordenar` 351-386)
**Apply to:** the new `handleDeleteColumnComMovimento` — same three-argument shape (`optimisticState, previousState, () => serverCall(...), errorMessage`).

### Multi-branch dialog state machine
**Source:** `excluir-contrato-dialog.tsx` (`fase` branching, lines 26-30 and 111-147 for the blocked branch)
**Apply to:** `excluir-coluna-dialog.tsx` — same "return a different JSX tree per precondition" shape, simplified to a synchronous `if`/`return` cascade since no async pre-flight is needed here.

### Column-picker list-of-buttons UI
**Source:** `reordenar-dialog.tsx` (full file)
**Apply to:** the picker branch of `excluir-coluna-dialog.tsx` — `Button` list with `variant={selecionada === c.id ? "default" : "ghost"}`, no `RadioGroup`.

## No Analog Found

None — RESEARCH.md's exhaustive direct reads (full-file reads of every touched/referenced file) produced strong analogs for all 6 files in scope. All code excerpts above are traceable to files RESEARCH.md confirms were read directly this session at HIGH confidence.

## Metadata

**Analog search scope:** `web/src/lib/kanban/actions.ts`, `web/src/lib/kanban/queries.ts`, `web/src/components/kanban/*.tsx` (column.tsx, board.tsx, reordenar-dialog.tsx, excluir-contrato-dialog.tsx)
**Files scanned:** 6 target files + 5 analog source files (all read in full or by targeted line range during RESEARCH.md's own research pass; this pattern-mapping pass reused RESEARCH.md's excerpts rather than re-reading, per no-duplicate-read rule)
**Pattern extraction date:** 2026-08-27
</content>
