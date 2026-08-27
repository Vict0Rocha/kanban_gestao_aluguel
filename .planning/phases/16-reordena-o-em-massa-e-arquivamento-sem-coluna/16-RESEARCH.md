# Phase 16: Reordenação em massa e arquivamento sem coluna - Research

**Researched:** 2026-08-27
**Domain:** In-repo schema/code change (Next.js Server Actions + Supabase/Postgres) — no new external library or framework
**Confidence:** HIGH

## Summary

Both capabilities are small, code-grounded changes on top of patterns this project already uses dozens of times. Nothing here calls for a new library, a new architectural layer, or a stored procedure — every recommendation below is a direct extension of an existing function, migration style, or component in this codebase, verified by reading the actual file this session (not from training memory).

The one open question CONTEXT.md flagged for research — "how does `desarquivarCardAction` find the board's first column once `column_id` is already null?" — has a concrete, fully resolved answer: **don't store or thread a board id through the card at all.** This app has exactly one row in `public.boards`, created once by the init migration, and there is **no code path anywhere in `web/src` that ever inserts a second board row** (confirmed by grep — zero matches for `boards` inserts). Three files already resolve "the board" the same way, cold, with no id passed in: `page.tsx`, `financeiro/page.tsx`, `relatorios/page.tsx` — all do `.from("boards").select("id, name").order("created_at").limit(1).maybeSingle()`. `desarquivarCardAction` should do the exact same query, then find that board's first column by `position`. It never needs the card's former `column_id` — which is exactly right, because by the time `desarquivarCardAction` runs, that value is already null by construction (D-01).

**Primary recommendation:** For arquivamento, `alter table public.cards alter column column_id drop not null` is the only DDL needed (no other constraint touches `column_id`), `arquivarCardAction` nulls it, and `desarquivarCardAction` re-resolves "the board" via the same order-by-`created_at`-limit-1 query already used three times in this codebase, then looks up that board's first column by `position`. For the bulk-move button, reuse `matchingIds`, `positionBetween`/`GAP`, and `persistOrRevert` exactly as they exist today, and write the new Server Action as N parallel individual `.update()` calls (Supabase-js cannot set per-row differing values in a single `.update()`, and this project has zero precedent for a bulk-write RPC — every mutator so far is a simple client call).

## Suggested Requirement IDs

`.planning/REQUIREMENTS.md` has no requirement IDs for Phase 16 yet (TBD in ROADMAP.md). Following this project's established precedent — short thematic prefixes tied to the capability, not the phase number (`CANDEST-01..03` and `PAGIN-01..03` for Phase 15, `CANIMOB-01..05` for Phase 14, `IMOB-01..05` for Phase 13) — this research suggests splitting by the two independent capabilities, matching every prior phase's pattern of one prefix per capability:

- **REORD-01**: Botão "Reordenar" existe ao lado do `SearchField` no Board e abre um popup listando as colunas existentes
- **REORD-02**: Confirmar no popup move, numa única ação, todos os cards elegíveis (D-08: só os em destaque se há busca ativa, todos se não há) para a coluna escolhida
- **REORD-03**: Após o bulk move, a ordem dos cards na coluna de destino segue a ordem visual anterior (coluna → posição), com posições novas sequenciais, incluindo cards que já estavam na coluna de destino

- **ARQCOL-01**: `cards.column_id` é nullable no banco; arquivar um card grava `column_id = null` junto com `arquivado_em`
- **ARQCOL-02**: Desarquivar sempre atribui a primeira coluna (menor `position`) do board, nunca a coluna anterior à qual o card estava vinculado
- **ARQCOL-03**: Excluir uma coluna nunca mais apaga em cascata um card arquivado sem histórico financeiro — fechado estruturalmente por ARQCOL-01 (um `column_id` nulo nunca é alcançado por `on delete cascade` de `columns`)

The planner should confirm final IDs/wording against `.planning/REQUIREMENTS.md`'s existing `### <PREFIX> — <description> (pós-milestone, Phase N)` section format before adding them.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `column_id` nullable + archive/unarchive board-agnostic lookup | Database / Storage (schema) | API / Backend (Server Action) | The constraint relaxation is a schema decision; the "first column of the board" resolution is business logic that belongs in the Server Action, not the client (mirrors existing `arquivarCardAction`/`desarquivarCardAction` split) |
| Column-deletion cascade risk closed by null `column_id` | Database / Storage | — | Structural: an archived card with `column_id = null` can never be reached by `on delete cascade` from `columns`, by definition — no app-layer code needed |
| Bulk "Reordenar" button UI | Browser / Client | — | Dialog + selection state is pure client interaction, same tier as the existing column/card dialogs |
| Bulk move scope resolution (search-aware) | Browser / Client | — | `matchingIds`/`isSearching` already run client-side today for the same board state; no new server round-trip needed to determine scope |
| Bulk move persistence | API / Backend (Server Action) | Database / Storage | Same tier as `moveCardAction` — Server Action validates and writes with the user's session; RLS on `cards` is the actual authorization boundary |

## Standard Stack

No new packages. This phase is exclusively additive SQL (`alter column ... drop not null`) plus TypeScript/React code following patterns already present in `web/src/lib/kanban/` and `web/src/components/kanban/`, `web/src/components/ui/`. No `npm install` step applies — the Package Legitimacy Audit and Environment Availability sections are not applicable and are omitted below per the format's own scope rules.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. No `npm install` step is part of either capability's implementation.

## Architecture Patterns

### System Architecture Diagram — Archive/unarchive

```
[Card row in "cards" table]
   column_id: uuid NOT NULL ──┐
                               │  D-01: relax to nullable
                               ▼
   column_id: uuid NULL, FK ON DELETE CASCADE (unaffected by NULL)

arquivarCardAction(cardId)
   └─ UPDATE cards SET arquivado_em = now(), column_id = NULL WHERE id = cardId
        (RLS: user session, "team full access cards" policy)

desarquivarCardAction(cardId)
   └─ SELECT id FROM boards ORDER BY created_at LIMIT 1        ── same idiom as
   └─ SELECT id FROM columns WHERE board_id = <board.id>          page.tsx /
        ORDER BY position LIMIT 1                                 financeiro/page.tsx /
        │                                                         relatorios/page.tsx
        ├─ no board found  → error (should not happen in this app)
        ├─ no column found → D-04: block, "Crie uma coluna antes de desarquivar."
        └─ found           → UPDATE cards SET arquivado_em = NULL,
                                                column_id = <first column id>
                                                WHERE id = cardId

Board page query (app/(app)/page.tsx:8-29)
   └─ .is("cards.arquivado_em", null)  ── archived cards (column_id NULL) never
                                            reach the Board's client `columns` state
```

### System Architecture Diagram — Bulk "Reordenar"

```
Board.tsx state: columns (Column[], each with cards: Card[]), query (string)

[User types in SearchField]  →  query state updates
[User clicks "Reordenar"]    →  opens Dialog listing board's columns
[User picks a column, confirms]
   │
   ▼
scope = matchingIds(columns, query)   ── D-08: query="" already matches everyone
   │                                      (search.ts:56-58, terms.length === 0 → () => true)
   ▼
orderedCards = flatten columns (position asc) → cards (position asc)
                filtered to scope
   │
   ▼
optimistic update: move each orderedCards[i] into target column,
                    position = (i + 1) * GAP  (position.ts GAP = 1000)
   │
   ▼
persistOrRevert(optimisticColumns, previousColumns,
   () => reordenarCards(cardIds, targetColumnId),   ── new query wrapper
   "Não foi possível reordenar os imóveis.")
   │
   ▼
reordenarCardsAction(cardIds: string[], columnId: string)   ── new Server Action
   └─ validate id(columnId) + every cardIds[i]
   └─ Promise.all( cardIds.map((id, i) =>
        supabase.from("cards").update({ column_id: columnId, position: (i+1)*GAP })
                 .eq("id", id) ) )
   └─ RLS "team full access cards" is the real authorization boundary, same as
      every other mutator in actions.ts
```

### Recommended Project Structure

No new directories. New files slot into existing locations:

```
web/src/lib/kanban/
├── actions.ts        # add reordenarCardsAction (near moveCardAction, ~line 574)
│                      # modify arquivarCardAction (line 730) / desarquivarCardAction (line 759)
├── queries.ts         # add reordenarCards() wrapper (near moveCard, ~line 76)
└── types.ts           # Card.column_id: string -> string | null (line 3)

web/src/components/kanban/
├── board.tsx           # add "Reordenar" button + dialog trigger, inside the
│                        # existing flex div at line 362
└── reordenar-dialog.tsx  # NEW — Dialog + Button-per-column list, modeled on
                           # arquivar-contrato-dialog.tsx's AlertDialog shape
```

### Pattern 1: Single-board resolution (reuse, don't reinvent)

**What:** This codebase resolves "the" board with the same 4-line query in three separate files, never passing a board id in from outside.
**When to use:** Any server-side code (including the new `desarquivarCardAction`) that needs to know which board a card belongs to when it cannot derive that from the card's own row.
**Example:**
```typescript
// Source: web/src/app/(app)/page.tsx:8-13 (verified this session)
const { data: board } = await supabase
  .from("boards")
  .select("id, name")
  .order("created_at")
  .limit(1)
  .maybeSingle()
```
The identical shape appears in `web/src/app/(app)/financeiro/page.tsx:73` and `web/src/app/(app)/relatorios/page.tsx:10`. `desarquivarCardAction` should call this same shape (selecting only `id`) rather than inventing a `cards.board_id` column or trying to resolve the board from the card's (already-null) `column_id`.

### Pattern 2: Optimistic write with revert (`persistOrRevert`)

**What:** Apply the new state to React state immediately, call the Server Action, and roll back + toast on failure.
**When to use:** Every Board mutation that doesn't already have its own in-dialog loading state (bulk move qualifies — same as drag-and-drop, column rename, delete-column, toggle-ativo).
**Example:**
```typescript
// Source: web/src/components/kanban/board.tsx:116-133 (verified this session)
function persistOrRevert(
  optimistic: ColumnType[],
  revertTo: ColumnType[],
  persist: () => Promise<unknown>,
  message: string
) {
  setColumns(optimistic)
  persist().catch((error: unknown) => {
    console.error(error)
    setColumns(revertTo)
    const doServidor = error instanceof Error ? error.message : ""
    setWriteError(doServidor || message)
  })
}
```
The new `handleReordenar` in `board.tsx` should build `optimistic`/`revertTo` and call this exact function — no new revert mechanism needed.

### Pattern 3: Search-scope reuse for D-08 (no client-side branch)

**What:** `matchingIds(columns, query)` already returns every card id when `query` is empty.
**Example:**
```typescript
// Source: web/src/lib/kanban/search.ts:56-58, 81-92 (verified this session)
export function buildMatcher(query: string): CardMatcher {
  const terms = parseTerms(query)
  if (terms.length === 0) return () => true   // <- empty query matches everyone
  ...
}
export function matchingIds(columns: Column[], query: string): Set<string> {
  const matches = buildMatcher(query)
  const ids = new Set<string>()
  for (const column of columns) {
    for (const card of column.cards) {
      if (matches(card)) ids.add(card.id)
    }
  }
  return ids
}
```
Calling `matchingIds(columns, query)` with the Board's live `query` state (already computed every render as `matchedIds`, `board.tsx:72-75`) implements both halves of D-08 with zero new branching: search active → only matches; no search → literally everyone, because `terms.length === 0`.

### Anti-Patterns to Avoid

- **Storing `board_id` directly on `cards` "just in case":** Not needed. The single-board resolution query (Pattern 1) already answers "which board" without a new column, a backfill, or a migration beyond the one `column_id` DDL change. Adding a redundant `cards.board_id` would be a second source of truth that could drift from `columns.board_id` for cards that still have a column.
- **A single `update ... where id = any($1)` for the bulk move:** Supabase-js's `.update()` sets one identical value set for every row matched by the filter — it cannot express "row A gets position 1000, row B gets position 2000" in one call. Don't try to force this into one query; N parallel `.update()` calls is the correct and only expressible shape with this client.
- **Re-deriving the "which cards are archived" filter inside the bulk-move Server Action:** Unnecessary. Per D-09, archived cards never reach the Board's `columns` client state in the first place (`app/(app)/page.tsx:25` filters them out of the query), so the `cardIds` array the client sends can never contain an archived card's id — same trust boundary `moveCardAction` already operates under.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Determining which cards to bulk-move when a search is/isn't active | A new client-side branch (`if searching ... else ...`) | `matchingIds(columns, query)` (search.ts) | Already implements both branches via the empty-query special case; a new branch would duplicate logic that already lives in one place |
| Finding "the board" for `desarquivarCardAction` | A new `cards.board_id` column, or a join through the (already-null) `column_id` | The existing `boards` order-by-`created_at`-limit-1 query (Pattern 1) | This exact query already runs 3x in the codebase for the identical purpose; a 4th slightly different mechanism would be an unnecessary second idiom |
| Assigning new sequential positions to bulk-moved cards | A bespoke gap-filling algorithm | `GAP = 1000` constant already exported from `position.ts`, multiplied by index | The project already has one fractional-indexing convention (`positionBetween`/`GAP`); a bulk operation is the one case where full renumbering (not `positionBetween`) is correct, but the same `GAP` unit should be reused for consistency of magnitude |

**Key insight:** Every piece this phase needs already exists somewhere in the codebase in near-identical shape. The work is composition, not invention — which is also why the confidence rating on architecture is HIGH rather than MEDIUM.

## Runtime State Inventory

This phase includes a schema migration (`alter column column_id drop not null`) but is not a rename/refactor/migration phase in the sense that triggers this section (no string rename, no rebrand, no data relocation). Included briefly for completeness since a DDL change is involved:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no existing archived cards currently have a non-null `column_id` that needs backfilling; D-01 nulls `column_id` only going forward, on the next archive action. Cards already archived today (with their old `column_id` still pointing at a real column) are **not** touched by the migration itself — only by the next `arquivarCardAction`/`desarquivarCardAction` call on them. | None automatic — see Open Questions for whether already-archived cards should be backfilled |
| Live service config | None — no n8n/external service config references `column_id` | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: Already-archived cards keep their stale `column_id` after the migration
**What goes wrong:** The migration only relaxes the constraint; it does not touch existing rows. Any card archived *before* this phase ships still has `column_id` pointing at a real column. If that column is later deleted, D-02's protection ("an archived card can never be cascade-deleted because `column_id` is null") does **not** apply to those pre-existing archived cards — they're still vulnerable to the exact cascade risk D-02 is meant to close.
**Why it happens:** `alter column ... drop not null` is a metadata-only change; it never issues an `UPDATE`.
**How to avoid:** Planner should add a one-time backfill (`update cards set column_id = null where arquivado_em is not null`) as part of the migration plan, run in the same ensaio→apply cycle — not a separate follow-up. Confirm count of already-archived cards before writing the backfill (small, ~single digits based on current production state, but verify with a pre-flight `select count(*) from cards where arquivado_em is not null` rather than assuming).
**Warning signs:** If the planner's migration only contains the `alter column` statement with no backfill `update`, this gap will exist silently until someone re-archives each affected card.

### Pitfall 2: SQL Editor connection-pooling can turn an ensaio into a real push (D-19, project-wide hazard)
**What goes wrong:** The Supabase SQL Editor's connection pooling can silently drop the `begin;`/`rollback;` wrapper around a rehearsal transaction if it's pasted or run as separate blocks instead of one single paste+click — this has caused several accidental production pushes in this project's history, most recently Phase 14's 14-02 plan and Phase 15's 15-04.
**Why it happens:** Documented, recurring hazard specific to this project's tooling (no Supabase CLI installed; SQL Editor is the only path to production).
**How to avoid:** The ensaio script for `alter table public.cards alter column column_id drop not null` (and any backfill `update`) must be written and executed as a single pasteable block — `begin; ... rollback;` all in one paste, one click. Do not split into multiple Editor tabs or runs.
**Warning signs:** Any ensaio plan that describes running statements "in sequence" across multiple Editor actions rather than one paste is at risk.

### Pitfall 3: `'name'::regprocedure` needs explicit empty parens for a zero-arg function
**What goes wrong:** If this phase's runbook does any `pg_get_functiondef`-style introspection (e.g., to snapshot `impedir_exclusao_de_card_com_lancamento()` before/after, to prove D-02's cascade-risk claim empirically against the live trigger), casting a bare function name string to `regprocedure` fails for zero-argument functions unless the parens are explicit: `'impedir_exclusao_de_card_com_lancamento()'::regprocedure`, not `'impedir_exclusao_de_card_com_lancamento'::regprocedure`.
**Why it happens:** `regprocedure` (unlike `regproc`) requires the full signature, including empty parens, to disambiguate from overloads — bit this project's operator during a live rehearsal in Phase 15's 15-04.
**How to avoid:** If the runbook includes any `regprocedure` cast, always include the parens, even for zero-arg functions. This phase's DDL (`alter column ... drop not null`) doesn't need this kind of introspection at all — it's a plain `ALTER TABLE`, not a function replace — so this pitfall is unlikely to be triggered, but is worth keeping in the runbook checklist since Section 2/2b of the archive capability touches the same trigger function's territory conceptually.
**Warning signs:** A `regprocedure` cast in the runbook missing `()` in the string literal for a function that takes zero arguments.

### Pitfall 4: Forgetting the D-04 empty-board guard leaves an orphaned, invisible card
**What goes wrong:** If `desarquivarCardAction` doesn't check for "board has zero columns" and instead sets `column_id = null` (or fails silently), the card becomes `arquivado_em = null` but with no column — invisible on the Board (which only iterates `column.cards`), effectively lost from every screen.
**Why it happens:** The board query in `page.tsx` filters `arquivado_em is null` but still expects every surviving card to belong to a column it's iterating over; a card with `arquivado_em = null` and `column_id = null` fits neither "archived" (Arquivados list, which filters `not("arquivado_em", "is", null)`) nor "on the Board" (which iterates columns, never a bare card list).
**How to avoid:** `desarquivarCardAction` must return a clear error ("Crie uma coluna antes de desarquivar.") and perform no write when the board it resolves has zero columns — this is D-04, explicitly marked in CONTEXT.md as "Claude's Discretion, confirmar no planning," but the code-grounded reasoning above confirms blocking (not silently orphaning) is the only safe choice given how `page.tsx`/`arquivados/page.tsx` query cards.
**Warning signs:** A `desarquivarCardAction` implementation that writes `column_id: firstColumn?.id ?? null` without an early return when `firstColumn` is undefined.

## Code Examples

### `arquivarCardAction` — current code (to be modified)
```typescript
// Source: web/src/lib/kanban/actions.ts:730-757 (verified this session)
export async function arquivarCardAction(cardId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ arquivado_em: new Date().toISOString() })
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("arquivarCard", error)
    return { ok: false, error: erroDoBanco(error.code, "arquivar o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("arquivar o imóvel") }
  }
  return { ok: true, data: undefined }
}
```
**Recommended change:** add `column_id: null` to the `.update()` payload (D-01). No other line changes.

### `desarquivarCardAction` — current code (to be modified)
```typescript
// Source: web/src/lib/kanban/actions.ts:759-785 (verified this session)
export async function desarquivarCardAction(cardId: string): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ arquivado_em: null })
    .eq("id", cardId)
    .select("id")
  // ...
}
```
**Recommended change:** insert the board/first-column resolution (Pattern 1) between the `id()` validation and the final `.update()` call, and add `column_id: <firstColumn.id>` to the update payload. Concrete shape:
```typescript
const { data: board, error: erroBoard } = await sessao.supabase
  .from("boards")
  .select("id")
  .order("created_at")
  .limit(1)
  .maybeSingle()

if (erroBoard || !board) {
  console.error("desarquivarCard (board)", erroBoard)
  return { ok: false, error: erroDoBanco(erroBoard?.code, "desarquivar o imóvel") }
}

const { data: primeiraColuna, error: erroColuna } = await sessao.supabase
  .from("columns")
  .select("id")
  .eq("board_id", board.id)
  .order("position", { ascending: true })
  .limit(1)
  .maybeSingle()

if (erroColuna) {
  console.error("desarquivarCard (coluna)", erroColuna)
  return { ok: false, error: erroDoBanco(erroColuna.code, "desarquivar o imóvel") }
}
if (!primeiraColuna) {
  // D-04: bloqueia em vez de desarquivar sem coluna (card ficaria invisível)
  return { ok: false, error: "Crie uma coluna antes de desarquivar." }
}

const { data, error } = await sessao.supabase
  .from("cards")
  .update({ arquivado_em: null, column_id: primeiraColuna.id })
  .eq("id", cardId)
  .select("id")
```

### New Server Action shape — `reordenarCardsAction`
```typescript
// Modeled on moveCardAction (actions.ts:546-574, verified this session) and
// the parallel-fetch precedent at web/src/app/(app)/layout.tsx:23 (Promise.all)
export async function reordenarCardsAction(
  cardIds: string[],
  columnId: string
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalidoColuna = id(columnId, "Coluna")
  if (invalidoColuna) return { ok: false, error: invalidoColuna }
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return { ok: false, error: "Nenhum imóvel selecionado." }
  }
  for (const cardId of cardIds) {
    const invalido = id(cardId, "Imóvel")
    if (invalido) return { ok: false, error: invalido }
  }

  const resultados = await Promise.all(
    cardIds.map((cardId, index) =>
      sessao.supabase
        .from("cards")
        .update({ column_id: columnId, position: (index + 1) * 1000 })
        .eq("id", cardId)
        .select("id")
    )
  )

  const falhou = resultados.find((r) => r.error)
  if (falhou?.error) {
    console.error("reordenarCards", falhou.error)
    return { ok: false, error: erroDoBanco(falhou.error.code, "reordenar os imóveis") }
  }
  const semNenhuma = resultados.some((r) => !r.data || r.data.length === 0)
  if (semNenhuma) {
    return { ok: false, error: semLinhas("reordenar os imóveis") }
  }
  return { ok: true, data: undefined }
}
```
Note: `1000` should reference the exported `GAP` constant from `position.ts` rather than a magic number — `position.ts` currently only exports `GAP` implicitly via `positionBetween`; the planner should either export `GAP` directly or add a small helper, since the bulk case needs the raw constant, not the two-neighbor `positionBetween` function.

## State of the Art

Not applicable — no external ecosystem/library versioning is involved in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The count of already-archived cards needing a `column_id` backfill is small (single digits) | Runtime State Inventory / Pitfall 1 | If actually large, the backfill `update` is still safe (a single `update ... where arquivado_em is not null` is O(rows), trivial at this project's scale of ~50-60 total cards), so risk is low even if the estimate is off — flagged as `[ASSUMED]` because it wasn't verified with a live SQL count against production this session (no DB credentials available to the assistant) |
| A2 | `GAP = 1000` is large enough that `(cardIds.length) * 1000` never approaches a `double precision` precision concern at this project's realistic scale (~50-60 cards total, all in one bulk move at most) | Code Examples / Common Pitfalls | None realistically — `double precision` has ~15-17 significant decimal digits; even 10,000 cards at `GAP=1000` only reaches 10,000,000, far below any precision boundary |

**If this table is empty:** N/A — two low-risk assumptions logged above; both verified as low-impact even if the underlying estimate is off.

## Open Questions

1. **Should the migration backfill `column_id = null` for cards already archived before this phase ships?**
   - What we know: The DDL (`alter column ... drop not null`) does not touch existing rows; D-02's cascade-risk fix only applies to cards archived *after* this phase's code ships, unless a backfill runs.
   - What's unclear: Exact current count of already-archived cards in production (no DB credentials available to the assistant this session — human must run the count query).
   - Recommendation: Planner should add `update public.cards set column_id = null where arquivado_em is not null` to the same migration, ensaio'd in the same transaction as the `alter column` statement (single pasteable block per D-19).

2. **D-04 (empty-board guard) is explicitly marked "Claude's Discretion, confirmar no planning" in CONTEXT.md.**
   - What we know: Blocking (not silently orphaning) is the only safe choice given how `page.tsx` and `arquivados/page.tsx` query cards (see Pitfall 4) — this is a strong recommendation, not a genuinely open technical question.
   - What's unclear: Only the exact wording of the error message and whether the UI should proactively disable/hide the "Desarquivar" button when it already knows (client-side) there are zero columns, versus only showing the server's rejection message.
   - Recommendation: Planner locks D-04 as "block with message" per the reasoning in Pitfall 4; UI polish (disable vs. reject) is a legitimate implementation detail for the plan to decide.

3. **Exact naming for the new Server Action / query wrapper / dialog component.**
   - What we know: CONTEXT.md leaves this as "Claude's Discretion" — examples given were `moverTodosCardsAction`/`reordenarCardsAction`.
   - What's unclear: Nothing blocking — this research used `reordenarCardsAction`/`reordenarCards`/`reordenar-dialog.tsx` as working names throughout, consistent with the Portuguese naming convention already used everywhere else in `actions.ts`/`queries.ts`.
   - Recommendation: Planner can adopt these names directly or choose alternates; no functional impact either way.

4. **Sequential vs. parallel writes for the bulk Server Action.**
   - What we know: CONTEXT.md marks this "decisão de implementação, sem impacto observável para o usuário." This research recommends `Promise.all` (parallel) over a sequential loop, based on the one `Promise.all` precedent found in the codebase (`layout.tsx:23`, for reads) and the small scale (~50-60 rows max) making the difference immaterial either way.
   - What's unclear: Nothing blocking.
   - Recommendation: Planner can choose either; `Promise.all` is marginally faster and no less safe (each `.update()` is independently scoped to one row by `id`, so partial failure mid-batch is possible either way and must be handled the same regardless of ordering — see the `Common Pitfalls`-adjacent note below).

5. **Partial-failure semantics for the bulk move — what happens if row 30 of 55 fails?**
   - What we know: Neither a single SQL transaction nor Postgres RPC is used (no precedent in this codebase for either), so the N individual `.update()` calls are not atomic as a group. `moveCardAction`'s single-row case has no partial-failure concept to borrow from.
   - What's unclear: Whether the plan should accept "some cards moved, error reported to the user" as an acceptable outcome (matching every other `Promise.all`/loop pattern's honesty about partial completion) or should attempt a compensating rollback of the succeeded updates on partial failure.
   - Recommendation: Given this project's established philosophy (`persistOrRevert`'s comment: "RLS barrando alguém removido da allowlist... ou a rede caindo" are the realistic failure modes, not mid-batch application bugs) and the small scale, accepting partial completion + a clear error message (consistent with `erroDoBanco`'s existing philosophy of surfacing DB errors rather than hiding them) is recommended over building a compensating-transaction mechanism that has no precedent anywhere else in this codebase.

## Environment Availability

Not applicable — this phase introduces no new external tool, service, runtime, or dependency. It uses only the Supabase SQL Editor (already the project's sole migration path, per every prior phase) and the existing Next.js/Supabase-js stack already running in production.

## Validation Architecture

Skipped — `.planning/config.json` has `workflow.nyquist_validation: false` (verified this session: `.planning/config.json:24`, `"nyquist_validation": false`).

## Security Domain

`security_enforcement` is `true` in `.planning/config.json` (verified this session: `.planning/config.json:47`), so this section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — both new/modified actions call `requireUser()` exactly like every existing action in `actions.ts` |
| V3 Session Management | No | Unchanged — no session handling code is touched |
| V4 Access Control | Yes | RLS policy `"team full access cards"` (`auth.role() = 'authenticated'`, `20260728000000_init_schema.sql:143-146`) already governs every `cards` write, including the new bulk `.update()` calls and the modified archive actions — no new policy needed, same authorization boundary as `moveCardAction` |
| V5 Input Validation | Yes | `id()` (UUID regex, `actions.ts:93-96`) validates every `cardId` and `columnId` in the new bulk action, same as every existing mutator; array length/emptiness checked before any DB call |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bulk action called directly (outside the UI) with an arbitrary `cardIds` array to move cards a user shouldn't be able to touch | Elevation of Privilege / Tampering | RLS on `cards` already scopes every row to `is_team_member()`/`authenticated` — a non-team-member's `.update()` calls silently filter to zero affected rows (the existing `semLinhas` pattern already handles this: `actions.ts:198-200`), same protection every other mutator relies on. No new mitigation needed. |
| Malformed/oversized `cardIds` array (e.g., thousands of fake UUIDs) used to trigger many DB round-trips as a denial-of-service vector | Denial of Service | At this project's realistic scale (≤60 cards ever exist on the board), the array can never legitimately exceed ~60 entries; the planner should still cap array length defensively (e.g., reject arrays > 200) before the `Promise.all`, consistent with this project's existing "fail closed" philosophy (`deleteCardAction`'s comment on failing closed, `actions.ts:665-672`) |
| Column-deletion cascade silently destroying an archived card's row (D-02's original motivating risk) | Repudiation / Tampering (data loss) | Closed structurally by D-01: `column_id = null` on archive means `on delete cascade` from `columns` can never reach that row again — confirmed by reading the trigger body (`20260826010000_relaxar_exclusao_destrava.sql:79-89`) and the FK definition (`20260728000000_init_schema.sql:59`); no additional trigger change needed |

## Sources

### Primary (HIGH confidence — read directly this session)
- `supabase/migrations/20260728000000_init_schema.sql` (lines 44-79, 133-146) — `columns`/`cards` table definitions, FK/not-null constraints, RLS policies
- `supabase/migrations/20260819000000_cards_arquivado_em.sql` (full file) — `arquivado_em` column, original `impedir_exclusao_de_card_com_lancamento()` trigger body
- `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` (full file) — current trigger body (confirms D-02's cascade-risk claim: only `parcela_lancamentos`/`taxas_imobiliaria`/`caucao_eventos` block deletion, never archived status alone)
- `web/src/lib/kanban/actions.ts` (lines 1-1287, plus targeted reads to 1799 for the arquivamento block) — `arquivarCardAction`, `desarquivarCardAction`, `moveCardAction`, `deleteColumnAction`, validation helpers
- `web/src/lib/kanban/types.ts` (full file) — `Card`, `Column`, `ActionResult` types
- `web/src/lib/kanban/queries.ts` (full file) — client wrapper convention (`unwrap`, naming)
- `web/src/lib/kanban/search.ts` (full file) — `matchingIds`/`isSearching`/`buildMatcher` confirming D-08's empty-query-matches-all claim
- `web/src/lib/kanban/position.ts` (full file) — `GAP`/`positionBetween`
- `web/src/components/kanban/board.tsx` (full file) — `handleDragEnd`, `persistOrRevert`, JSX insertion point (line 362), `findColumnOf`
- `web/src/components/kanban/card-item.tsx` (full file) — the one client-side read of `card.column_id` (line 64), confirming the ripple is contained
- `web/src/components/kanban/arquivar-contrato-dialog.tsx` (full file) — dialog/error-handling pattern to model the new bulk-move dialog on
- `web/src/components/ui/dialog.tsx` (full file) — confirms no `RadioGroup` primitive exists; Dialog + Button list is the natural fit
- `web/src/app/(app)/page.tsx` (full file) — confirms `.is("cards.arquivado_em", null)` board query filter, and single-board resolution idiom
- `web/src/app/(app)/arquivados/page.tsx` (full file) — confirms zero `column_id` usage outside Board files
- `docs/data-model.md` (lines 1-70, 115-161) — existing documentation style for `cards`/`columns`, "Decisões de design" section format
- `.planning/config.json` (full file) — `nyquist_validation: false`, `security_enforcement: true`
- `.planning/REQUIREMENTS.md` (targeted grep) — requirement ID naming precedent (CANDEST, PAGIN, CANIMOB, IMOB)
- Codebase-wide grep for `column_id`, `boardId`/`board_id`, `.rpc(`, `Promise.all`, `createBoard`/board inserts — confirms ripple containment and absence of bulk-write/RPC precedent

### Secondary (MEDIUM confidence)
- None — all findings this session were verified directly against source files, not from web search or training-data recall.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no external stack involved
- Architecture: HIGH — every recommendation is a direct read of existing code, cited with file:line
- Pitfalls: HIGH for Pitfalls 1, 2, 4 (code/schema-grounded); Pitfall 3 carried forward from the task brief's own documented project history (D-19-adjacent lesson from Phase 15's 15-04), not independently re-verified this session since this migration doesn't require `regprocedure` introspection

**Research date:** 2026-08-27
**Valid until:** No expiry driver — this is in-repo research tied to the current state of the codebase, not a time-sensitive external ecosystem; re-verify file:line citations if significant code changes land in `actions.ts`/`board.tsx`/the migrations directory before this phase is planned/executed
