# Phase 11: Cancelamento de pagamento - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

No RESEARCH.md exists for this phase (research skipped by user choice). File list and canonical
refs extracted from `11-CONTEXT.md` `<canonical_refs>`/`<code_context>` and `11-UI-SPEC.md`
Component Notes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/lib/kanban/actions.ts` — new `cancelarPagamentoAction` | service (Server Action) | CRUD (DELETE + recalculate) | same file, `registrarPagamentoAction` (lines 1016-1072) + `conciliarParcelaAction` (1159-1185) | exact (same file, same conventions) |
| `web/src/lib/kanban/queries.ts` — new `cancelarPagamento` wrapper | service (client bridge) | request-response | same file, `destravarParcela`/`conciliarParcela` (lines 134-140) | exact |
| `web/src/components/financeiro/cancelar-pagamento-dialog.tsx` (new) | component (dialog) | request-response | `web/src/components/kanban/excluir-contrato-dialog.tsx` (simple-confirm branch, lines 151-220) | exact (per UI-SPEC's own analog choice) |
| `web/src/components/financeiro/parcela-historico-sheet.tsx` (modified) | component | request-response | same file (existing `<li>` card structure, lines 69-96) | exact — self-modification, not a different analog |
| `web/src/components/financeiro/parcelas-table.tsx` — `AcoesCell` (modified, thread `parcelaConciliada`/`situacao` prop into sheet) | component | request-response | same file, lines 144-151 (`ParcelaHistoricoSheet` usage) + `DestravarParcelaDialog` wiring (152-159) | exact |
| `docs/data-model.md` (modified, doc-only) | config/docs | n/a | same file's existing "Por que nada é apagado..." section (Phase 9 precedent) | exact |

## Pattern Assignments

### `web/src/lib/kanban/actions.ts` — new `cancelarPagamentoAction` (service, CRUD)

**Analog:** same file — compose from `registrarPagamentoAction` (validation → trava de
visibilidade/conciliada → write → recalculate) and `conciliarParcelaAction` (condicioned
UPDATE/DELETE as the real race guard, not read-then-write).

**Existing helpers to reuse, not reimplement** (`web/src/lib/kanban/actions.ts:944-1014`):
```typescript
async function exigirParcelaNaoConciliada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parcelaId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("parcelas")
    .select("status")
    .eq("id", parcelaId)
    .maybeSingle()

  if (error || !data) {
    console.error("trava de conciliada da parcela (leitura)", error)
    return MENSAGEM_PARCELA_OCULTA.indeterminado
  }

  if (data.status === "conciliada") {
    return MENSAGEM_PARCELA_CONCILIADA
  }
  return null
}

async function recalcularEGravarStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  parcelaId: string
): Promise<string | null> {
  // relê valor_original + TODOS parcela_lancamentos, calcula statusDeParcela, grava
  // (ver actions.ts:971-1014) — chamar depois do DELETE, sem lógica de status nova
}
```

**Core CRUD pattern to copy — validation → trava → conditioned DELETE → recalculate**
(`registrarPagamentoAction`, `actions.ts:1016-1072`):
```typescript
export async function registrarPagamentoAction(
  parcelaId: string,
  valor: number,
  data: string,
  observacao: string | null
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(parcelaId, "Parcela") ??
    valorLancamento(valor, "Informe um valor de pagamento válido.") ??
    dataObrigatoria(data) ??
    textoOpcional(observacao, "Observação", 2000)
  if (invalido) return { ok: false, error: invalido }

  const recusa = await exigirParcelaVisivel(sessao.supabase, parcelaId)
  if (recusa) return { ok: false, error: recusa }

  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data: inserido, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .insert({ /* ... */ })
    .select("id")

  if (error) {
    console.error("registrarPagamento", error)
    return { ok: false, error: erroDoBanco(error.code, "registrar o pagamento") }
  }
  if (!inserido || inserido.length === 0) {
    return { ok: false, error: semLinhas("registrar o pagamento") }
  }

  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }

  return { ok: true, data: undefined }
}
```

**Race-condition DELETE pattern to copy** — condition the DELETE on `id` AND `tipo='pagamento'`
still holding, exactly like `conciliarParcelaAction` conditions its UPDATE on `status = "paga"`
(`actions.ts:1159-1185`):
```typescript
export async function conciliarParcelaAction(parcelaId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(parcelaId, "Parcela")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .update({ status: "conciliada", conciliada_em: new Date().toISOString(), conciliada_by: sessao.user.id })
    .eq("id", parcelaId)
    .eq("status", "paga")
    .select("id")

  if (error) {
    console.error("conciliarParcela", error)
    return { ok: false, error: erroDoBanco(error.code, "conciliar a parcela") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("conciliar a parcela") }
  }
  return { ok: true, data: undefined }
}
```

**For `cancelarPagamentoAction`, compose:**
1. `requireUser()` → `NAO_AUTENTICADO` (same as every action)
2. Validate `parcelaId` (`id(...)`) and `lancamentoId` (new, same `id(...)` validator)
3. `exigirParcelaNaoConciliada` (D-06 — reuse verbatim, do NOT reimplement)
4. `DELETE FROM parcela_lancamentos WHERE id = lancamentoId AND parcela_id = parcelaId AND tipo = 'pagamento'` conditioned exactly like `conciliarParcelaAction`'s `.eq("status","paga")` — this is the actual race guard (per CONTEXT `<code_context>` "Race safety"), not a read-then-delete
5. `error` → `erroDoBanco(error.code, "cancelar o pagamento")`; empty result → `semLinhas("cancelar o pagamento")`
6. On success, call `recalcularEGravarStatus(sessao.supabase, parcelaId)` — never hardcode `status: "aberta"`
7. Return `{ ok: true, data: undefined }`

**Error handling pattern:** identical to every other action in this file — `erroDoBanco(code, acao)` for DB errors, `semLinhas(acao)` for zero-row race losses (`actions.ts:180-188`).

---

### `web/src/lib/kanban/queries.ts` — new `cancelarPagamento` wrapper

**Analog:** `destravarParcela`/`conciliarParcela` (`queries.ts:134-140`):
```typescript
export async function conciliarParcela(parcelaId: string) {
  return unwrap(conciliarParcelaAction(parcelaId))
}

export async function destravarParcela(parcelaId: string, motivo: string) {
  return unwrap(destravarParcelaAction(parcelaId, motivo))
}
```
New wrapper follows the same one-liner shape: `export async function cancelarPagamento(parcelaId: string, lancamentoId: string) { return unwrap(cancelarPagamentoAction(parcelaId, lancamentoId)) }`. Also add `cancelarPagamentoAction` to the import block at `queries.ts:1-23` (alphabetically among the other `*Action` imports).

---

### `web/src/components/financeiro/cancelar-pagamento-dialog.tsx` (new component)

**Analog:** `web/src/components/kanban/excluir-contrato-dialog.tsx` — specifically its simple
(non-blocked, non-typed-confirmation) `AlertDialog` branch, per UI-SPEC's explicit analog choice
(irreversible DELETE ⇒ `AlertDialog` + `variant="destructive"`, not the typed-confirmation input
since D-04 rejects that friction).

**Imports pattern** (`excluir-contrato-dialog.tsx:1-18`, adapt to this dialog's needs — no `Input`/`Label` needed since there's no typed confirmation):
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

**Resync-on-reopen pattern** (`excluir-contrato-dialog.tsx:54-65`, also used in `destravar-parcela-dialog.tsx:54-63`):
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

**Core confirm-and-call pattern** (`excluir-contrato-dialog.tsx:87-109`, simplified — no pre-flight fase machine needed, per UI-SPEC "no pre-flight check needed here"):
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
        : "Não foi possível cancelar o pagamento. Tente novamente."
    )
    setSaving(false)
  }
}
```

**AlertDialog JSX shape to copy** (`excluir-contrato-dialog.tsx:151-220`, destructive branch only — exact copy target is already fully specified in `11-UI-SPEC.md` lines 132-158, reproduced here for convenience):
```typescript
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
Note: unlike `excluir-contrato-dialog.tsx`'s `AlertDialogCancel` defaulting to "Cancelar", this
dialog's back-out button is explicitly labeled **"Voltar"** (UI-SPEC copywriting contract,
avoids "cancel the cancellation" collision).

---

### `web/src/components/financeiro/parcela-historico-sheet.tsx` (modified)

**Analog:** self — extend the existing `<li>` card, add a new prop for the conciliada trava (D-06 UI half).

**Current per-lançamento card** (`parcela-historico-sheet.tsx:69-96`) — insertion point is a new trailing block inside the existing `flex flex-col gap-2` `<li>`, added only for `tipo === "pagamento"` and only when the parcela isn't conciliada:
```typescript
<li
  key={lancamento.id}
  className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
>
  <div className="flex items-start justify-between gap-2">
    <LancamentoTipoLabel tipo={lancamento.tipo} />
    <span className="text-sm font-semibold tabular-nums text-foreground">
      {prefixoValor(lancamento.tipo, lancamento.valor)}
    </span>
  </div>
  <p className="text-sm text-muted-foreground">
    {formatDate(lancamento.data)} · {quem}
  </p>
  {lancamento.observacao && ( /* ... */ )}
  {lancamento.motivo && ( /* ... */ )}
  {/* NEW: */}
  {lancamento.tipo === "pagamento" && !parcelaConciliada && (
    <div className="flex justify-end">
      <Button variant="ghost" size="xs" onClick={() => abrirCancelar(lancamento)}>
        <Trash2 className="size-3" />
        Cancelar
      </Button>
    </div>
  )}
</li>
```

**New prop signature** — add `parcelaConciliada: boolean` alongside the existing props
(`parcela-historico-sheet.tsx:34-41`):
```typescript
export function ParcelaHistoricoSheet({
  endereco,
  competencia,
  vencimento,
  lancamentos,
  parcelaConciliada,   // NEW
  open,
  onOpenChange,
}: {
  endereco: string
  competencia: string
  vencimento: string
  lancamentos: LancamentoDetalhado[]
  parcelaConciliada: boolean   // NEW
  open: boolean
  onOpenChange: (open: boolean) => void
}) { /* ... */ }
```
The sheet also needs local state for which lançamento's cancel-dialog is open (a `React.useState<LancamentoDetalhado | null>` picking the clicked lançamento, then rendering `<CancelarPagamentoDialog>` conditionally) — same "one dialog instance, opened by row click" shape as `AcoesCell`'s `dialogoAberto` state machine below.

---

### `web/src/components/financeiro/parcelas-table.tsx` — `AcoesCell` (modified)

**Analog:** self — existing dialog-open state machine and `ParcelaHistoricoSheet` wiring.

**Existing state + wiring pattern** (`parcelas-table.tsx:46-48, 144-151`):
```typescript
const [dialogoAberto, setDialogoAberto] = React.useState<
  "pagamento" | "ajustar" | "historico" | "destravar" | null
>(null)

// ...

<ParcelaHistoricoSheet
  endereco={linha.endereco}
  competencia={linha.competencia}
  vencimento={linha.vencimento}
  lancamentos={linha.lancamentos}
  open={dialogoAberto === "historico"}
  onOpenChange={(open) => setDialogoAberto(open ? "historico" : null)}
/>
```
**Change needed:** thread `parcelaConciliada={linha.situacao === "conciliada"}` into this
`<ParcelaHistoricoSheet>` call — `linha: LinhaParcela` already carries `situacao` (used at
`parcelas-table.tsx:69, 105, 230`), so no new data fetch, just pass the existing field through.
No change needed to the `dialogoAberto` union or any other row-level action (D-05 — the new
action lives entirely inside the sheet, not in `AcoesCell`'s own button row).

---

## Shared Patterns

### Server Action error handling (`erroDoBanco`/`semLinhas`)
**Source:** `web/src/lib/kanban/actions.ts:180-188`
**Apply to:** `cancelarPagamentoAction`
```typescript
function semLinhas(acao: string) {
  return `Não foi possível ${acao}: a operação não afetou nenhuma linha (outra aba já mudou este registro?).`
}
function erroDoBanco(codigo: string | undefined, acao: string) {
  // sanitizes raw Postgres error into a user-facing message
  if (codigo === "PGRST116") return semLinhas(acao)
  // ...
}
```

### Conciliada trava (D-06)
**Source:** `web/src/lib/kanban/actions.ts:944-963` — `exigirParcelaNaoConciliada`
**Apply to:** `cancelarPagamentoAction` (server boundary) and `ParcelaHistoricoSheet`/`AcoesCell` (UI-visible consequence only, not the real boundary)

### Status recalculation (D-03)
**Source:** `web/src/lib/kanban/actions.ts:971-1014` — `recalcularEGravarStatus`, backed by `web/src/lib/kanban/parcelas.ts:395-431` (`somarLancamentos`, `statusDeParcela`)
**Apply to:** `cancelarPagamentoAction`, called immediately after the conditioned DELETE succeeds — never write `status: "aberta"` directly.

### Server Action → client bridge (`unwrap`)
**Source:** `web/src/lib/kanban/queries.ts:25-30, 134-140`
**Apply to:** new `cancelarPagamento` wrapper — turns `{ ok, error }` back into a thrown `Error`, which is what every dialog's `try/catch` already expects.

### AlertDialog destructive-confirm shape
**Source:** `web/src/components/kanban/excluir-contrato-dialog.tsx:151-220`
**Apply to:** `CancelarPagamentoDialog` — `AlertDialogAction variant="destructive"`, disabled while `saving`, inline `text-sm text-destructive` error slot, resync-on-reopen `wasOpen` guard.

## No Analog Found

None — every file in scope has a close, current analog in the same module (financeiro/kanban Server Action + AlertDialog conventions already fully established by Phases 6/7/9).

## Metadata

**Analog search scope:** `web/src/lib/kanban/` (`actions.ts`, `queries.ts`, `parcelas.ts`), `web/src/components/financeiro/` (`parcela-historico-sheet.tsx`, `destravar-parcela-dialog.tsx`, `parcelas-table.tsx`), `web/src/components/kanban/excluir-contrato-dialog.tsx`
**Files scanned:** 7 read in full or targeted ranges (all ≤ 400 lines except `actions.ts`, read via targeted 280-line range covering lines 940-1220)
**Pattern extraction date:** 2026-08-21
