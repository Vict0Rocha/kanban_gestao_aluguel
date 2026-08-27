# Phase 17: Exclusão de coluna sem cascade para cards ativos - Research

**Researched:** 2026-08-27
**Domain:** Next.js Server Actions + Supabase-js (app-layer write ordering), React client state (board.tsx optimistic updates)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Mecanismo**
- **D-01:** O diálogo de exclusão de coluna (`column.tsx`, hoje um `AlertDialog` com o aviso "Os N imóveis dessa coluna também serão excluídos") passa a oferecer um seletor de coluna de destino quando a coluna tem pelo menos 1 card — mesmo padrão visual do `ReordenarDialog` (Phase 16): lista de colunas como botões, selecionado com `variant="default"`. Confirmar move todos os cards da coluna para o destino escolhido e só então exclui a coluna — uma única ação, sem tela de confirmação adicional (mesmo espírito de D-07 da Phase 16). Quando a coluna já está vazia (0 cards), o fluxo continua exatamente como hoje — confirmação simples, sem seletor.
- **D-02:** Se a coluna sendo excluída for a única do board (nenhuma outra coluna disponível como destino) e ela tiver pelo menos 1 card, a exclusão é bloqueada com mensagem clara ("Crie outra coluna antes de excluir esta.") — nunca deixa um card ativo sem coluna nenhuma (isso é reservado para o estado de arquivado, Phase 16, não para um card em operação normal).
- **D-03:** Nenhuma migração de banco é necessária. `columns → cards on delete cascade` continua existindo no schema como rede de segurança — a fase garante, na camada de aplicação, que a coluna está sempre vazia (todos os cards já movidos) antes do `delete from columns` rodar, então o cascade nunca chega a apagar um card de verdade. Confirmado por leitura do schema (`20260728000000_init_schema.sql`) e do fluxo de `deleteColumnAction`/`reordenarCardsAction` (`web/src/lib/kanban/actions.ts`) durante a discussão — mover os cards primeiro também contorna, de propósito, a trava de `impedir_exclusao_de_card_com_lancamento` (o trigger não bloqueia mais a exclusão da coluna se nenhum card com lançamento financeiro ainda apontar para ela).

### Claude's Discretion
- Reusar `reordenarCardsAction` (Phase 16) diretamente para mover os cards, ou escrever uma Server Action nova que combina mover + excluir coluna numa chamada só — decisão de implementação, sem impacto observável para o usuário. Pesquisa deve confirmar a forma mais simples dado o que já existe.
- O escopo de cards a mover é sempre "todos os cards da coluna sendo excluída" (`column.cards.map(c => c.id)`), nunca filtrado por busca — diferente do escopo do botão "Reordenar" (que usa `matchingIds`). Não confundir os dois mecanismos.
- Janela de corrida entre "mover os cards" e "excluir a coluna" (alguém arrastar um card novo para a coluna nesse meio-tempo) — mesmo espírito de tolerância a janela pequena já documentado em `destravarParcelaAction`/`cancelarEventoCaucaoAction`; não é um caso a resolver com transação SQL nova.
- Copy exato do diálogo (título, texto do seletor, rótulo do botão) — dentro do design system já estabelecido.

### Deferred Ideas (OUT OF SCOPE)
None — discussão ficou dentro do escopo da fase.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs exist yet for this phase in `REQUIREMENTS.md` (TBD). Following this project's naming precedent for pós-milestone phases (short thematic prefix tied to the capability — REORD/ARQCOL for Phase 16, CANDEST/PAGIN for Phase 15), this research proposes:

| ID | Description | Research Support |
|----|-------------|------------------|
| EXCOL-01 | Excluir uma coluna vazia (0 cards) continua funcionando exatamente como hoje — confirmação simples, sem seletor de destino | §Finding 1, §Code Examples "Excluir coluna vazia (inalterado)" |
| EXCOL-02 | Excluir uma coluna com ≥1 card oferece um seletor de coluna de destino (mesmo padrão visual do `ReordenarDialog`); confirmar move todos os cards da coluna para o destino escolhido e só então exclui a coluna, numa única ação (client-side) | §Finding 2, §Recommended Server Action, §Recommended Client Wiring |
| EXCOL-03 | Se a coluna sendo excluída for a única do board (nenhuma outra coluna disponível como destino) e tiver ≥1 card, a exclusão é bloqueada com a mensagem "Crie outra coluna antes de excluir esta." | §Finding 3, §Code Examples "Estado bloqueado (D-02)" |
| EXCOL-04 | Nenhum card ativo é apagado em cascata ao excluir uma coluna — fechado tanto pela camada de aplicação (a coluna é garantidamente esvaziada antes do `delete`) quanto por uma trava server-side em `deleteColumnAction` que recusa excluir uma coluna não vazia mesmo se chamada fora da UI | §Finding 4 (recomendação de hardening), §Pitfall 1 |

Suggest planner add these to `REQUIREMENTS.md § EXCOL` (mirroring `§ REORD`/`§ ARQCOL` format) before or during planning.
</phase_requirements>

## Summary

This phase needs **zero database migration** — confirmed. The FK `cards.column_id → columns.id on delete cascade` (`20260728000000_init_schema.sql:59`) stays exactly as-is as a safety net; the fix is purely ordering discipline in the application layer (empty the column before deleting it). This is genuinely the first phase since Phase 4 that touches zero SQL.

The trigger `impedir_exclusao_de_card_com_lancamento()` (current body: `20260826010000_relaxar_exclusao_destrava.sql:60-103`) checks `where p.card_id = old.id` per cascaded row — but a card whose `column_id` was already updated away from the deleted column **is never part of the cascade's row set to begin with** (Postgres FK cascade only touches rows still referencing the deleted parent at delete time). So moving cards out first isn't just avoiding a predicate match — it structurally removes those cards from the cascade's scope entirely, the same "closes by construction, not by check" property Phase 16 used for archived cards (`column_id = null`).

**Primary recommendation:** write ONE new combined Server Action, `excluirColunaComMovimentoAction(columnId, destinoColumnId)`, that re-queries the column's current cards server-side (never trusts a client-supplied `cardIds` array — matches this codebase's `podarParcelasOrfas` discipline), moves them with append-safe positions, then deletes the column — two sequential Supabase calls in one function body, not a SQL transaction (confirmed: this codebase's Supabase-js client has no multi-statement transaction primitive anywhere, server or client). **Also add a non-empty-column precheck directly inside the existing `deleteColumnAction`** — this is the one piece of hardening CONTEXT.md's discretion section doesn't explicitly call for but that the phase's own stated guarantee (EXCOL-04 / D-03) requires to actually hold at the server boundary, not just by UI convention. Without it, `deleteColumnAction` remains callable directly (Server Actions are real POST endpoints, per this codebase's own documented philosophy) against a non-empty column with no financial history, cascading real active cards exactly as it does today.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Column-deletion UI (picker / blocked state) | Browser / Client (`column.tsx`, new `excluir-coluna-dialog.tsx`) | — | Pure presentation + optimistic dispatch; column list and card counts already live in Board's client state, no round-trip needed to decide which UI variant to show |
| Move-then-delete write | API / Backend (Server Action, `actions.ts`) | — | The only place the guarantee "column is empty before delete runs" can be enforced authoritatively; client can request it but cannot be trusted to enforce it |
| "Column is currently non-empty" re-check | API / Backend | — | Must be re-queried server-side at write time, not trusted from client's `column.cards` snapshot (race window explicitly accepted by CONTEXT.md, but the *decision to refuse* must still be server-authoritative) |
| Cascade safety net | Database / Storage (`on delete cascade` FK) | — | Stays exactly as-is (D-03) — never reached by the app's own delete path once the column-emptying guarantee holds, but remains the last-resort backstop |

## Standard Stack

No new libraries. This phase is exclusively additive code inside the existing stack (Next.js Server Actions, Supabase-js, React client state, Base UI `AlertDialog`/`Dialog` primitives already in `web/src/components/ui/`).

**Version verification:** N/A — no packages installed or upgraded.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. Skipped per protocol (audit is required only "whenever this phase installs external packages").

## Findings

### Finding 1 — Current delete-column dialog and what `Column` receives today

`web/src/components/kanban/column.tsx:143-175` — the current `AlertDialog`:

```tsx
<AlertDialog>
  <AlertDialogTrigger
    render={
      <Button variant="ghost" size="icon-sm"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Excluir coluna" />
    }
  >
    <Trash2 className="size-3.5" />
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Excluir a coluna &quot;{column.name}&quot;?</AlertDialogTitle>
      <AlertDialogDescription>
        {column.cards.length > 0
          ? `Os ${column.cards.length} imóveis dessa coluna também serão excluídos. Essa ação não pode ser desfeita.`
          : "Essa ação não pode ser desfeita."}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction variant="destructive" onClick={() => onDeleteColumn(column.id)}>
        Excluir
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

The line 161 warning ("Os N imóveis dessa coluna também serão excluídos") is exactly the sentence D-01 removes for the non-empty case.

`Column`'s current prop signature (`column.tsx:28-57`) is:

```ts
{ column, searching, matchedIds, onRename, onDeleteColumn, onDeleteCard, onArquivarCard,
  onUpdateCard, onToggleAtivo, onCreateCard, registerRef }
```

**Confirmed: `Column` does NOT currently receive the full list of sibling columns.** `Board` (`board.tsx:434-449`) renders `<Column key={column.id} column={column} searching={...} matchedIds={...} onRename={...} onDeleteColumn={...} ... />` — no `columns` prop passed down today. This must be added (`<Column columns={columns} ... />`), same as `ReordenarDialog` already receives `columns={columns}` directly in `Board`'s own JSX (`board.tsx:412`).

### Finding 2 — `deleteColumnAction`, `reordenarCardsAction`, and the recommended combined action

`deleteColumnAction` (`actions.ts:295-327`) today:

```ts
export async function deleteColumnAction(columnId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
  const invalido = id(columnId, "Coluna")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("columns").delete().eq("id", columnId).select("id")

  if (error) {
    // ... nenhuma pré-checagem própria — só mapeia P0001 do trigger
    if (error.code === "P0001") return { ok: false, error: EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO }
    return { ok: false, error: erroDoBanco(error.code, "excluir a coluna") }
  }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("excluir a coluna") }
  return { ok: true, data: undefined }
}
```

The comment at lines 310-317 explicitly justifies the *absence* of a precheck ("Nenhuma pré-checagem própria é acrescentada aqui — o trigger de banco já cobre este caminho de cascade atomicamente"). **This comment becomes wrong once this phase ships** — see Finding 4 and Pitfall 1.

`reordenarCardsAction` (`actions.ts:594-635`) is the direct mechanical precedent: validates `columnId`, caps `cardIds.length` at 200, validates every id, then `Promise.all` of per-card `.update({ column_id, position: (index+1)*GAP })`, checking both `error` and `semLinhas` (zero-rows) across all results before returning `ok`.

**Recommendation: write a new combined Server Action, not two client round-trips.** Rationale, concretely:

1. **Security, not just simplicity.** If the client instead calls `reordenarCardsAction` then `deleteColumnAction` as two separate round-trips (option a), `deleteColumnAction` remains reachable on its own as a raw POST endpoint against a non-empty column with no financial history — it would cascade those cards exactly as it does today. The whole point of D-03's guarantee only holds if the column-emptying step and the delete step are not two independently-callable actions that a client (or a bug, or devtools) can invoke out of order.
2. **Server-side re-query beats a client-supplied `cardIds` array.** `reordenarCardsAction` takes `cardIds: string[]` from the client. For this phase, re-querying `cards where column_id = columnId` inside the combined action (mirroring `podarParcelasOrfas`'s "never receives an id list from outside, re-queries the candidate set at delete time" discipline, `actions.ts:371-394` comment) is *simpler* to call (no array to build/pass) and closes the race window tighter — a card dragged into the column between dialog-open and confirm-click is still captured by the fresh re-query, not missed by a stale client snapshot.
3. **No SQL transaction either way.** Confirmed: nothing in this codebase's Supabase-js usage (server or client) does a multi-statement transaction; every multi-step write (`registrarPagamentoAction`, `podarParcelasOrfas` inside `updateCardAction`) is sequential awaited calls with manual rollback-equivalent guards (check-before-proceed), never a wrapping `BEGIN/COMMIT`. The combined action follows the identical shape: move, then check for errors, then delete — nothing new architecturally.

### Recommended Server Action

```ts
// actions.ts — add near deleteColumnAction

const CARDIDS_DEMAIS_COLUNA = "Muitos imóveis nesta coluna para mover de uma vez."

/**
 * Combina "mover todos os cards da coluna para outra" + "excluir a coluna"
 * numa única chamada de servidor (D-01/D-03, 17-CONTEXT.md). Nunca aceita
 * a lista de cardIds do cliente — reconsulta os cards da coluna de origem
 * no momento da escrita, mesma disciplina de podarParcelasOrfas — e nunca
 * confia que `destinoColumnId` pertence ao mesmo board sem reconferir.
 */
export async function excluirColunaComMovimentoAction(
  columnId: string,
  destinoColumnId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(columnId, "Coluna") ?? id(destinoColumnId, "Coluna de destino")
  if (invalido) return { ok: false, error: invalido }

  if (columnId === destinoColumnId) {
    return { ok: false, error: "A coluna de destino precisa ser diferente da coluna sendo excluída." }
  }

  // Server-authoritative: reconsulta as duas colunas, confirma que existem
  // e pertencem ao mesmo board — nunca confia num destino vindo do cliente.
  const { data: colunas, error: erroColunas } = await sessao.supabase
    .from("columns").select("id, board_id").in("id", [columnId, destinoColumnId])
  if (erroColunas) {
    console.error("excluirColunaComMovimento (colunas)", erroColunas)
    return { ok: false, error: erroDoBanco(erroColunas.code, "excluir a coluna") }
  }
  const origem = colunas?.find((c) => c.id === columnId)
  const destino = colunas?.find((c) => c.id === destinoColumnId)
  if (!origem || !destino) return { ok: false, error: semLinhas("excluir a coluna") }
  if (origem.board_id !== destino.board_id) {
    return { ok: false, error: "A coluna de destino precisa estar no mesmo board." }
  }

  // Reconsulta os cards da coluna de origem, na ordem visual atual — nunca
  // recebe essa lista de fora (mesmo motivo de podarParcelasOrfas).
  const { data: cards, error: erroCards } = await sessao.supabase
    .from("cards").select("id")
    .eq("column_id", columnId)
    .order("position", { ascending: true })
  if (erroCards) {
    console.error("excluirColunaComMovimento (cards)", erroCards)
    return { ok: false, error: erroDoBanco(erroCards.code, "excluir a coluna") }
  }

  const cardIds = (cards ?? []).map((c) => c.id)
  if (cardIds.length > 200) return { ok: false, error: CARDIDS_DEMAIS_COLUNA }

  if (cardIds.length > 0) {
    // Base = maior position já usada no destino, para não colidir com
    // cards que já estavam lá (mesmo cuidado de handleCreateCard).
    const { data: ultimoDestino } = await sessao.supabase
      .from("cards").select("position")
      .eq("column_id", destinoColumnId)
      .order("position", { ascending: false }).limit(1).maybeSingle()
    const base = ultimoDestino?.position ?? 0

    const resultados = await Promise.all(
      cardIds.map((cardId, index) =>
        sessao.supabase.from("cards")
          .update({ column_id: destinoColumnId, position: base + (index + 1) * GAP })
          .eq("id", cardId).select("id")
      )
    )
    const comErro = resultados.find((r) => r.error)
    if (comErro?.error) {
      console.error("excluirColunaComMovimento (mover)", comErro.error)
      return { ok: false, error: erroDoBanco(comErro.error.code, "mover os imóveis") }
    }
    const semLinha = resultados.some((r) => !r.data || r.data.length === 0)
    if (semLinha) return { ok: false, error: semLinhas("mover os imóveis") }
  }

  // A coluna está agora garantidamente vazia — mesmo caminho de
  // deleteColumnAction (P0001 mapeado do mesmo jeito, defesa em
  // profundidade mesmo sem cards restantes para cascatear).
  const { data, error } = await sessao.supabase
    .from("columns").delete().eq("id", columnId).select("id")
  if (error) {
    console.error("excluirColunaComMovimento (delete)", error)
    if (error.code === "P0001") return { ok: false, error: EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO }
    return { ok: false, error: erroDoBanco(error.code, "excluir a coluna") }
  }
  if (!data || data.length === 0) return { ok: false, error: semLinhas("excluir a coluna") }
  return { ok: true, data: undefined }
}
```

`web/src/lib/kanban/queries.ts` needs a matching thin wrapper (same shape as every other action there):

```ts
export async function excluirColunaComMovimento(id: string, destinoId: string) {
  return unwrap(excluirColunaComMovimentoAction(id, destinoId))
}
```

### Finding 3 — `ReordenarDialog` reuse vs. a sibling component

`ReordenarDialog` (`reordenar-dialog.tsx`, full file read) is self-contained: owns its own `Dialog`/`DialogTrigger`, `open`/`selecionada`/`saving`/`error` state, and the trigger renders a visible "Reordenar" button with an icon + label — this is wrong UI for the column-delete case (trigger must stay the existing small trash-can `Button` already inline in `column.tsx`'s header, not a labeled button).

**This project's actual convention** (checked `web/src/components/kanban/*dialog*.tsx` and `web/src/components/financeiro/*dialog*.tsx`): mostly small, focused, single-purpose dialog components (`add-card-dialog.tsx`, `arquivar-contrato-dialog.tsx`, `excluir-contrato-dialog.tsx`, `reordenar-dialog.tsx`, `ajustar-parcela-dialog.tsx`, `destravar-parcela-dialog.tsx`, `registrar-pagamento-dialog.tsx`, `configurar-percentuais-dialog.tsx`, `registrar-evento-caucao-dialog.tsx`), each composing the shared `Dialog`/`AlertDialog` primitives directly. **One exception**: `cancelar-lancamento-dialog.tsx` was deliberately generalized with a `rotulo`/`acao` prop pair (per `docs/data-model.md:159`) — but only because its three variants (lançamento/taxa/caução) are structurally identical single-step confirms with no branching. Column deletion is NOT that case: it needs three distinct UI shapes (simple confirm / column picker / blocked message), the same shape of branching `excluir-contrato-dialog.tsx` already handles via an internal `fase` state machine (`verificando | permitido | bloqueado | verificacao-falhou`, `excluir-contrato-dialog.tsx:26-30`).

**Recommendation: a new sibling component `excluir-coluna-dialog.tsx`**, mirroring `excluir-contrato-dialog.tsx`'s multi-branch pattern (but simpler — no async pre-flight needed, since `column.cards.length` and sibling-column count are already synchronously known from Board's client state, unlike `excluir-contrato-dialog.tsx`'s server pre-check for financial history). Self-contained with its own trigger (like `ReordenarDialog`/`AddCardDialog`), because the branching decision needs no round-trip:

```tsx
// web/src/components/kanban/excluir-coluna-dialog.tsx
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

export function ExcluirColunaDialog({
  column,
  outrasColunas,
  onExcluirVazia,
  onExcluirComMovimento,
}: {
  column: ColumnType
  outrasColunas: ColumnType[]
  onExcluirVazia: (columnId: string) => void
  onExcluirComMovimento: (columnId: string, destinoColumnId: string) => void
}) {
  const vazia = column.cards.length === 0
  const [open, setOpen] = React.useState(false)
  const [selecionada, setSelecionada] = React.useState<string | null>(null)

  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setSelecionada(null)
  }

  const trigger = (
    <Button variant="ghost" size="icon-sm"
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      aria-label="Excluir coluna">
      <Trash2 className="size-3.5" />
    </Button>
  )

  if (vazia) {
    return (
      <AlertDialog>
        <AlertDialogTrigger render={trigger} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a coluna &quot;{column.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onExcluirVazia(column.id)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  if (outrasColunas.length === 0) {
    return (
      <AlertDialog>
        <AlertDialogTrigger render={trigger} />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir esta coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Crie outra coluna antes de excluir esta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Fechar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Mover os {column.cards.length} imóveis e excluir &quot;{column.name}&quot;
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {outrasColunas.map((c) => (
            <Button key={c.id} type="button"
              variant={selecionada === c.id ? "default" : "ghost"}
              className="justify-start"
              onClick={() => setSelecionada(c.id)}>
              {c.name}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" disabled={!selecionada}
            onClick={() => {
              onExcluirComMovimento(column.id, selecionada!)
              setOpen(false)
            }}>
            Mover e excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Note the confirm button fires `onExcluirComMovimento` synchronously and closes immediately — no local `saving`/awaited-confirm state, matching `handleDeleteColumn`'s existing fire-and-forget `persistOrRevert` pattern (`board.tsx:279-286`), not `ReordenarDialog`'s `await onConfirm()` pattern. (`ReordenarDialog`'s await is largely cosmetic in practice — `handleReordenar` in `board.tsx:360-386` is a synchronous function wrapped in an `async` arrow at the call site, `board.tsx:412`, so the awaited promise resolves on the next microtask regardless of persistence outcome. Don't copy that indirection here; go straight to fire-and-forget like `handleDeleteColumn` already does.)

Wiring in `column.tsx`: replace the inline `AlertDialog` block (lines 143-175) with:

```tsx
<ExcluirColunaDialog
  column={column}
  outrasColunas={columns.filter((c) => c.id !== column.id)}
  onExcluirVazia={onDeleteColumn}
  onExcluirComMovimento={onDeleteColumnComMovimento}
/>
```

which requires adding `columns: ColumnType[]` and `onDeleteColumnComMovimento: (id: string, destinoId: string) => void` to `Column`'s prop type, and `Board` passing `columns={columns}` when it renders `<Column>` (`board.tsx:434-449`).

### Finding 4 — Board.tsx optimistic-update shape, and the recommended handler

`handleDeleteColumn` today (`board.tsx:279-286`):

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

`handleReordenar` (`board.tsx:351-386`) is the shape to mirror for building the *destination column's* optimistic card list — it filters cards out of every column, then appends the moved set (with fresh `GAP`-based positions) into the target column.

**Recommended new handler**, combining both:

```ts
function handleDeleteColumnComMovimento(columnId: string, destinoColumnId: string) {
  const origem = columns.find((c) => c.id === columnId)
  if (!origem) return

  const destinoAtual = columns.find((c) => c.id === destinoColumnId)
  const base = destinoAtual?.cards.reduce((max, c) => Math.max(max, c.position), 0) ?? 0
  const movidos = origem.cards.map((card, index) => ({
    ...card,
    column_id: destinoColumnId,
    position: base + (index + 1) * GAP,
  }))

  const optimistic = columns
    .filter((c) => c.id !== columnId)
    .map((c) => (c.id === destinoColumnId ? { ...c, cards: [...c.cards, ...movidos] } : c))

  persistOrRevert(
    optimistic,
    columns,
    () => excluirColunaComMovimento(columnId, destinoColumnId),
    "Não foi possível excluir a coluna."
  )
}
```

The client-side `base + (index+1)*GAP` formula deliberately mirrors the server-side one in the recommended Server Action exactly — both append after the destination's existing max position, in the same card order (`origem.cards` is already in visual/position order client-side; the server re-query uses `.order("position", { ascending: true })` for the same reason). This isn't strictly required for correctness (no reconciliation happens on success — same as every other `persistOrRevert` caller in this file, the optimistic value is simply left in place until next reload), but keeping the formulas identical avoids a silent position drift that would only surface as a reordered destination column on the next full page load.

**Recommendation beyond CONTEXT.md's explicit discretion — harden `deleteColumnAction` itself:**

Add a precheck to the *existing* `deleteColumnAction` (used verbatim for the D-01 empty-column path): before deleting, check whether the column still has any cards, and refuse if so.

```ts
export async function deleteColumnAction(columnId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
  const invalido = id(columnId, "Coluna")
  if (invalido) return { ok: false, error: invalido }

  // D-03/EXCOL-04 (17-CONTEXT.md): esta é a trava real de "coluna sempre
  // vazia antes do delete" — não uma conveniência de UI. Sem ela,
  // deleteColumnAction continuaria alcançável fora da interface (Server
  // Actions são endpoints POST de verdade) contra uma coluna não vazia
  // sem lançamento financeiro, cascateando cards ativos de verdade — o
  // mesmo buraco que esta fase existe para fechar.
  const { data: algumCard, error: erroCard } = await sessao.supabase
    .from("cards").select("id").eq("column_id", columnId).limit(1)
  if (erroCard) {
    console.error("deleteColumn (precheck)", erroCard)
    return { ok: false, error: erroDoBanco(erroCard.code, "excluir a coluna") }
  }
  if ((algumCard?.length ?? 0) > 0) {
    return { ok: false, error: "Esta coluna ainda tem imóveis. Mova-os para outra coluna antes de excluir." }
  }

  // ... resto inalterado (o .delete() existente)
}
```

This message is never expected to reach a real user through the normal UI (the UI always routes non-empty columns through `excluirColunaComMovimentoAction`; it's unreachable unless someone bypasses the dialog), so it doesn't need to be exported from `visibilidade.ts` for client-side comparison the way `EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO` is — it's a pure backstop, not a UI-state-switching signal.

This is the one piece of this design that goes slightly beyond the letter of CONTEXT.md's discretion section (which frames the reordenarCardsAction-vs-new-action choice as "no observable impact to the user") — flagging it explicitly for the planner/user because it *is* new server-side behavior, even though it's unreachable through the shipped UI and directly serves D-03's own stated goal ("garante... que a coluna está sempre vazia... antes do delete"). Recommend the planner keep it; it costs one cheap existence-check query and closes a real gap consistent with every other write in this codebase (`deleteCardAction`'s comment: "Server Actions são endpoints POST de verdade, alcançáveis fora da interface").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column-emptying before delete | A new position/reorder algorithm from scratch | The exact `(base) + (index+1) * GAP` formula already used by `handleReordenar`/`reordenarCardsAction` | Same fractional-indexing scheme this codebase already committed to; a different formula here would be a second, divergent position strategy |
| Destination-column validation | Trusting `column.board_id` implicitly (single-board app) | Explicit re-query + `board_id` comparison server-side | Cheap, and matches this codebase's "never trust client state for anything that gates a write" discipline even where a shortcut (single board) would currently work |
| "Column empty" decision | An extra Server Action just to check card count before showing the dialog | `column.cards.length` already in Board's client state | No round-trip needed — Board already holds the full card list per column |

**Key insight:** every write in this codebase that decides "is this safe to do" re-derives the answer from the database at write time rather than trusting a client-supplied flag or list — `exigirParcelaVisivel`, `exigirParcelaNaoConciliada`, `cardTemLancamento`, `podarParcelasOrfas` all follow this. The combined action and the `deleteColumnAction` precheck are just this same discipline applied to column emptiness.

## Common Pitfalls

### Pitfall 1: Leaving `deleteColumnAction` as a raw unconditional delete
**What goes wrong:** The phase's own guarantee ("no active card is ever cascade-deleted") silently doesn't hold at the server boundary — only at the UI's convention of always calling the combined action for non-empty columns.
**Why it happens:** The existing code comment (`actions.ts:310-317`) explicitly argues *against* adding a precheck, reasoning that the DB trigger already covers cascade "atomically" — true only for cards *with* financial history. A card with zero lançamentos is not covered by the trigger and would cascade silently exactly as it does today if `deleteColumnAction` is called directly on a non-empty column.
**How to avoid:** Add the precheck described in Finding 4, and update/remove the now-stale comment at `actions.ts:310-317` in the same plan.
**Warning signs:** A plan that only touches `column.tsx`/`board.tsx`/adds the combined action but leaves `deleteColumnAction` byte-for-byte unchanged.

### Pitfall 2: Trusting a client-supplied `cardIds` list for "which cards to move"
**What goes wrong:** A card dragged into the column being deleted between dialog-open and confirm-click could be silently left behind (and then cascade-deleted) if the move step only acts on a list captured at dialog-open time.
**Why it happens:** `reordenarCardsAction`'s existing shape takes `cardIds` from the client — an easy but stale-prone thing to copy verbatim.
**How to avoid:** The recommended combined action re-queries `cards where column_id = columnId` at write time (Finding 2), closing this specific race — CONTEXT.md's "Claude's Discretion" section explicitly accepts *some* residual race tolerance (same spirit as `destravarParcelaAction`), but there's no cost to closing this particular instance since re-querying is not meaningfully more code than accepting a list.
**Warning signs:** A plan whose combined action signature includes a `cardIds: string[]` parameter instead of just `(columnId, destinoColumnId)`.

### Pitfall 3: Partial move failure followed by delete anyway
**What goes wrong:** If the `Promise.all` of per-card moves partially fails (network blip, RLS edge case) and the code proceeds to delete the column regardless, the cards that didn't get moved are still linked to the column at delete time and get cascade-deleted for real.
**Why it happens:** Easy to forget the `semLinhas`-style zero-rows check that `reordenarCardsAction` already does (`actions.ts:625-633`), not just the `error` check.
**How to avoid:** The combined action in Finding 2 checks both `comErro` and `semLinha` and returns before ever reaching the `.from("columns").delete(...)` call.
**Warning signs:** A plan's combined action only checks `.error` on the move step, not the zero-affected-rows case.

## Code Examples

### Excluir coluna vazia (inalterado, D-01)
```ts
// column.tsx — este ramo continua chamando deleteColumn(id) exatamente
// como hoje; nenhuma mudança de comportamento observável.
onExcluirVazia={onDeleteColumn} // === handleDeleteColumn, board.tsx:279-286
```

### Estado bloqueado (D-02)
See Finding 3's `outrasColunas.length === 0` branch — single "Fechar" action, no destructive button, mirrors `excluir-contrato-dialog.tsx`'s `fase === "bloqueado"` branch structurally (`excluir-contrato-dialog.tsx:111-147`).

## State of the Art

Not applicable — no external library/API surface changed in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Suggested `EXCOL-01..04` requirement IDs and their exact wording are not yet in `REQUIREMENTS.md` and are proposed here, not confirmed with the user | `<phase_requirements>` | Planner/user may prefer different IDs or a different split; low risk, cosmetic |
| A2 | Adding a non-empty-column precheck to `deleteColumnAction` is presented as a recommendation, not something CONTEXT.md's decisions explicitly locked | Finding 4 | If the user disagrees this is in scope, the phase still functions correctly through the UI alone (D-03's guarantee holds by convention, not by hard server gate) — but the stated EXCOL-04-level guarantee ("no active card is ever cascade-deleted") would be UI-convention-only, not server-enforced |

## Open Questions

1. **Should the `deleteColumnAction` precheck (Finding 4) be in scope for this phase's plan, or flagged as a follow-up?**
   - What we know: It's cheap (one `.limit(1)` existence query), consistent with every other write in this codebase, and directly serves D-03's own stated goal.
   - What's unclear: CONTEXT.md's decisions don't explicitly mandate it — it was surfaced by this research as necessary for the guarantee to hold at the server boundary, not just the UI.
   - Recommendation: Include it in the same plan as the combined action — it's a few lines inside a function already being touched for other reasons (the stale comment removal), not a separate unit of work.

2. **Exact copy for the picker dialog title/button label.** CONTEXT.md leaves this to discretion ("dentro do design system já estabelecido"). This research proposes "Mover os N imóveis e excluir 'Nome'" / "Mover e excluir" as concrete, code-ready defaults consistent with `ReordenarDialog`'s "Mover cards para uma coluna" / "Confirmar" — the planner/executor should treat these as a starting point, not a locked decision.

## Docs Update Needed — `docs/data-model.md`

Two existing bullets describe the pre-Phase-17 cascade behavior in a way that becomes misleading once this phase ships:

- **`docs/data-model.md:135`** — `- **Cascata (\`on delete cascade\`)** — apagar uma coluna remove seus cards; apagar um card remove seus alertas. Evita registros órfãos.` This sentence is still schema-accurate (the FK is untouched, D-03) but now describes only the *safety-net* behavior, never the path the app itself takes for a column with active cards.
- **`docs/data-model.md:142`** — the trigger-backstop bullet says *"...e a Server Action de exclusão de card (\`deleteCardAction\`) só cobre um deles (o outro, excluir a coluna inteira, nunca foi coberto)."* This clause ("nunca foi coberto") becomes literally false after this phase — `deleteColumnAction`/`excluirColunaComMovimentoAction` now do cover that path at the app layer (plus the recommended precheck).

**Recommended fix, following this project's established pattern (Phase 9/15/16 each appended a new bullet rather than silently rewriting an old one):** add one new bullet after line 142, e.g. "**Coluna sempre vazia antes de excluir, sem migração nova (D-01/D-02/D-03, Phase 17)**" explaining that `on delete cascade` on `columns → cards` stays as a safety net (line 135 still literally true), but the app now guarantees the column has zero cards before the `delete` runs (moving them to a chosen destination first, or blocking if no destination exists) — so the cascade is never exercised against a real active card through the shipped UI. Cross-reference it from line 142's bullet with a short "(see Phase 17 bullet below)" note, since that bullet's central claim about "the other path was never covered" is being revised.

## Sources

### Primary (HIGH confidence — read directly this session)
- `web/src/components/kanban/column.tsx` — full file, current delete dialog (lines 143-175), prop signature (lines 28-57)
- `web/src/lib/kanban/actions.ts` — `deleteColumnAction` (295-327), `reordenarCardsAction` (594-635), `podarParcelasOrfas` (395-441), `deleteCardAction`/`cardTemLancamento` (671-759)
- `web/src/components/kanban/reordenar-dialog.tsx` — full file
- `web/src/components/kanban/board.tsx` — full file, `handleDeleteColumn` (279-286), `handleReordenar` (351-386), `Column` render call (434-449)
- `web/src/lib/kanban/types.ts` — full file, `Card`/`Column`/`ActionResult` types
- `web/src/lib/kanban/queries.ts` — full file, client-wrapper pattern (`unwrap`)
- `web/src/lib/kanban/visibilidade.ts` — full file, `EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO` (170-171)
- `web/src/components/kanban/excluir-contrato-dialog.tsx` — full file, multi-`fase` branching pattern precedent
- `supabase/migrations/20260728000000_init_schema.sql:59` — `column_id uuid not null references public.columns(id) on delete cascade`
- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` — full file, current `impedir_exclusao_de_card_com_lancamento()` body (lines 60-103), confirms trigger predicate is per-card (`p.card_id = old.id`), unaffected by column-emptying reasoning except by structurally excluding moved cards from the cascade set
- `supabase/migrations/20260819000000_cards_arquivado_em.sql` — full file, original trigger + comment establishing the two-cascade-paths analysis this phase closes the second half of
- `docs/data-model.md` — lines 100-161, confirmed stale bullets at 135/142, confirmed established "append new bullet" pattern for prior phases (138, 141, 152, 158, 159)
- `.planning/REQUIREMENTS.md` — lines 162-182, 306-311, confirmed `REORD`/`ARQCOL` naming precedent
- `.planning/config.json` — confirmed `nyquist_validation: false` (Validation Architecture section skipped), `security_enforcement: true` (Security Domain section included below)

### Secondary / Tertiary
None used — all claims in this research trace to files read directly this session (see provenance tags above); no WebSearch or external documentation was needed since this phase is entirely internal application code with no new library surface.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No new surface | `requireUser()` already gates every Server Action, unchanged |
| V3 Session Management | No new surface | Unchanged |
| V4 Access Control | Yes | RLS via `is_team_member()` (unchanged policy) continues to gate `columns`/`cards` reads/writes; the new combined action runs with the user's session, never `service_role`, same as every other action in `actions.ts` |
| V5 Input Validation | Yes | `id()` UUID validation on both `columnId` and `destinoColumnId`, same pattern as every other action; explicit `columnId !== destinoColumnId` check; explicit same-`board_id` check |
| V6 Cryptography | No | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct POST to `deleteColumnAction` bypassing the UI's move-first convention | Tampering | The recommended non-empty-column precheck (Finding 4) — server-side gate, not UI convention |
| Client-supplied `cardIds`/destination trusted without re-verification | Tampering | Combined action re-queries cards and re-validates destination `board_id` server-side (Finding 2) |
| Partial write left in an unsafe intermediate state (cards half-moved, column then deleted anyway) | Tampering / Repudiation of data integrity | Explicit `error` + zero-rows (`semLinhas`) check on the move step before the delete step ever runs (Pitfall 3) |

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new stack surface, entirely existing codebase patterns
- Architecture (combined action vs. two round-trips): HIGH — grounded in direct reads of every relevant existing action and the security reasoning that follows from this codebase's own stated Server Action philosophy
- No-migration conclusion (D-03): HIGH — confirmed by reading the FK definition and the current trigger body directly this session, not assumed from training data
- Docs staleness findings: HIGH — both flagged bullets read directly this session with exact line numbers

**Research date:** 2026-08-27
**Valid until:** No expiry driver — this is internal application code with no external dependency drift risk; re-verify only if `actions.ts`/`column.tsx`/`board.tsx` change again before this phase is planned
