# Phase 16: Reordenação em massa e arquivamento sem coluna - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 7 (2 new, 5 modified)
**Analogs found:** 7 / 7 (RESEARCH.md already contains full before/after code for most; this file adds analog file:line pointers, excerpts, and the missing "list picker" analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/<ts>_arquivamento_sem_coluna.sql` | migration | batch (DDL + backfill) | `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` | role-match (DDL style differs: plain `ALTER TABLE`, not `create or replace function`) |
| `web/src/lib/kanban/actions.ts` — `arquivarCardAction` (line 730) | controller (Server Action) | CRUD (update) | itself, pre-change version | exact (in-place edit) |
| `web/src/lib/kanban/actions.ts` — `desarquivarCardAction` (line 759) | controller (Server Action) | CRUD (update, multi-step read-then-write) | `app/(app)/page.tsx:8-13` (single-board resolution query) + itself | exact for board/column lookup, in-place edit for the rest |
| `web/src/lib/kanban/actions.ts` — new `reordenarCardsAction` | controller (Server Action) | CRUD (bulk update, N rows) | `moveCardAction` (`actions.ts:546-574`) | role-match (single-row analog; no bulk-write precedent exists) |
| `web/src/lib/kanban/queries.ts` — new `reordenarCards` wrapper | service (client bridge) | request-response | `moveCard` (`queries.ts:76-78`) | exact |
| `web/src/lib/kanban/types.ts` — `Card.column_id` | model (type) | — | itself, pre-change version | exact (in-place edit) |
| `web/src/lib/kanban/position.ts` — export `GAP` | utility | transform | itself, pre-change version | exact (in-place edit, add one `export`) |
| `web/src/components/kanban/board.tsx` — button + dialog wiring | component | event-driven (UI) | itself, `handleSetCardAtivo`-style handler + `persistOrRevert` (lines 110-133, 335-347) | exact |
| `web/src/components/kanban/reordenar-dialog.tsx` (new) | component (Dialog) | request-response (confirm action) | `add-card-dialog.tsx` (Dialog shape) + `arquivar-contrato-dialog.tsx` (confirm/error/saving-state shape); **no existing "pick one of a list" component found** — see below | partial (composed from two analogs, no single list-picker precedent) |

## Pattern Assignments

### `supabase/migrations/<ts>_arquivamento_sem_coluna.sql` (migration, batch)

**Analog:** `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` (style/header/comment conventions only — the DDL shape itself is new to this project, no prior `alter column ... drop not null` exists)

**Header/comment convention to copy** (full file read):
```sql
-- ============================================================
-- <Title> — Kanban Aluguel (Phase N)
--
-- <what changes and why, tied to CONTEXT.md decision IDs>
--
-- ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA. O app está em produção no
-- Vercel + Supabase com ~N imóveis reais e nenhum ambiente de
-- staging. ...
--
-- Runbook operacional que ensaia e prova esta mudança contra o banco
-- real, com ensaio em transação revertida e verificação pós-push:
-- supabase/verificacao_<nome>.sql
-- ============================================================
```
Note the file ends with an explicit "RLS — nenhuma linha de policy nesta migração" section even when RLS is untouched (lines 114-123) — this project's convention is to state that explicitly rather than omit it. Phase 16's migration should do the same for RLS and add a parallel explicit note that the FK's `on delete cascade` behavior is unaffected by a nullable column (per D-02's own reasoning).

**DDL shape for Phase 16** (not present in any existing migration — RESEARCH.md Pitfall 1 already specifies the exact two statements needed, single pasteable block per D-19/Pitfall 2):
```sql
alter table public.cards alter column column_id drop not null;

update public.cards
set column_id = null
where arquivado_em is not null;
```

**Original NOT NULL constraint being relaxed** — `supabase/migrations/20260728000000_init_schema.sql` line ~59: `column_id uuid not null references public.columns(id) on delete cascade`.

---

### `web/src/lib/kanban/actions.ts` — `arquivarCardAction` (controller, CRUD)

**Analog:** itself (in-place edit), `actions.ts:730-757` (already fully quoted with the exact one-line diff in RESEARCH.md "Code Examples" — verified against source this session, matches line-for-line). Change: add `column_id: null` to the `.update()` payload alongside the existing `arquivado_em: new Date().toISOString()`.

---

### `web/src/lib/kanban/actions.ts` — `desarquivarCardAction` (controller, CRUD)

**Analog for the new board/column lookup step:** `web/src/app/(app)/page.tsx:8-13` (verified this session — identical shape also at `financeiro/page.tsx:73`, `relatorios/page.tsx:10`):
```typescript
const { data: board } = await supabase
  .from("boards")
  .select("id, name")
  .order("created_at")
  .limit(1)
  .maybeSingle()
```
RESEARCH.md already provides the fully composed replacement body (board lookup → first-column-by-`position` lookup → D-04 empty-board guard → final `.update({ arquivado_em: null, column_id: primeiraColuna.id })`) — verified consistent with the `id`/`erroDoBanco`/`semLinhas` helpers actually defined in `actions.ts:93-96, 198-208`. Use that composed body directly.

**Validation/error helpers to reuse** (`actions.ts:93-96`, `198-208`):
```typescript
function id(valor: unknown, campo: string) {
  if (typeof valor !== "string" || !UUID.test(valor)) return `${campo} inválido.`
  return null
}
function semLinhas(acao: string) {
  return `Não foi possível ${acao}: sem permissão ou o registro já não existe.`
}
function erroDoBanco(codigo: string | undefined, acao: string) {
  if (codigo === "23514") return "Os dados informados não passaram na validação."
  if (codigo === "23503") return "O registro relacionado não existe mais."
  if (codigo === "PGRST116") return semLinhas(acao)
  return `Não foi possível ${acao}. Tente novamente.`
}
```

---

### `web/src/lib/kanban/actions.ts` — new `reordenarCardsAction` (controller, CRUD bulk)

**Analog:** `moveCardAction` (`actions.ts:546-574`, verified this session, matches RESEARCH.md's citation exactly):
```typescript
export async function moveCardAction(
  cardId: string,
  columnId: string,
  position: number
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(cardId, "Imóvel") ??
    id(columnId, "Coluna") ??
    numeroFinito(position, "Posição")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({ column_id: columnId, position })
    .eq("id", cardId)
    .select("id")

  if (error) {
    console.error("moveCard", error)
    return { ok: false, error: erroDoBanco(error.code, "mover o imóvel") }
  }
  if (!data || data.length === 0) {
    return { ok: false, error: semLinhas("mover o imóvel") }
  }
  return { ok: true, data: undefined }
}
```
Bulk version: same `requireUser` guard, same `id()` validation per-element plus an array-emptiness check, same `erroDoBanco`/`semLinhas` error mapping, but `Promise.all` over N individual `.update()` calls instead of one (Supabase-js has no per-row-differing-values bulk update — confirmed by RESEARCH.md's grep for `.rpc(`/bulk precedent, zero matches). Full composed shape already in RESEARCH.md "Code Examples" section — use `GAP` (see below) instead of the magic number `1000`.

**Session import block to copy** (`actions.ts:1-27`) — same file, no new imports needed for this action beyond what's already there (`id`, `erroDoBanco`, `semLinhas`, `requireUser`, `ActionResult` are all already in-scope module-level).

---

### `web/src/lib/kanban/queries.ts` — new `reordenarCards` wrapper (service)

**Analog:** `moveCard` (`queries.ts:76-78`):
```typescript
export async function moveCard(id: string, columnId: string, position: number) {
  return unwrap(moveCardAction(id, columnId, position))
}
```
New wrapper: `export async function reordenarCards(cardIds: string[], columnId: string) { return unwrap(reordenarCardsAction(cardIds, columnId)) }` — add `reordenarCardsAction` to the import block at `queries.ts:1-28` (alphabetical among the other `...Action` imports, matching existing ordering convention).

---

### `web/src/lib/kanban/position.ts` (utility)

**Current full file** (6 lines, already read in full):
```typescript
const GAP = 1000

export function positionBetween(
  before: number | undefined,
  after: number | undefined
): number {
  if (before === undefined && after === undefined) return GAP
  if (before === undefined) return after! - GAP
  if (after === undefined) return before + GAP
  return (before + after) / 2
}
```
Change: `const GAP = 1000` → `export const GAP = 1000` (RESEARCH.md flags this exact gap — the bulk action needs the raw constant, not `positionBetween`'s two-neighbor signature).

---

### `web/src/components/kanban/board.tsx` — button + dialog wiring (component)

**Insertion point** (`board.tsx:362-385`, verified this session, matches RESEARCH.md citation):
```tsx
<div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-4 md:px-6">
  <SearchField
    value={query}
    onChange={setQuery}
    onSubmit={handleSearchSubmit}
    resultSummary={searching ? `${matchCount} de ${totalCards} imóveis em destaque` : undefined}
  />
  {searching && ( /* ... */ )}
</div>
```
Add the "Reordenar" `Button` (opens `ReordenarDialog`) as a sibling of `SearchField` inside this same flex div, per D-06.

**`persistOrRevert` pattern to reuse for the bulk move** (`board.tsx:110-133`, verified this session):
```typescript
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
**Nearby caller shape to mirror** for the new `handleReordenar` (`board.tsx:335-347`, the `handleSetCardAtivo`-style call site):
```typescript
persistOrRevert(
  columns.map((c) => ({
    ...c,
    cards: c.cards.map((card) => (card.id === id ? { ...card, ativo } : card)),
  })),
  columns,
  () => setCardAtivo(id, ativo),
  "Não foi possível salvar a alteração do imóvel."
)
```
The bulk-move handler follows the same three-argument shape: build `optimistic` columns (all `matchedIds` cards reassigned to the target column with sequential `GAP`-based positions, per D-10/D-08), pass current `columns` as `revertTo`, call `() => reordenarCards(cardIds, targetColumnId)`, with message `"Não foi possível reordenar os imóveis."` (matches this project's existing Portuguese error-message convention, e.g. `"Não foi possível salvar a alteração do imóvel."`).

**Search-scope resolution to reuse** (`web/src/lib/kanban/search.ts:56-58, 81-92`, already imported into `board.tsx` as `matchingIds`/`isSearching` at line 30, and already computed every render as `matchedIds` at `board.tsx:72-75` — no new computation needed, just read the existing `matchedIds` state when the dialog confirms).

---

### `web/src/components/kanban/reordenar-dialog.tsx` (new component, Dialog)

**No exact "list of selectable items, click one, confirm" analog exists in this codebase.** Grep across `web/src/components/{kanban,financeiro,ui}` for `DialogContent|DropdownMenu|RadioGroup|<select` found 13 files; none renders a clickable list of options for the user to pick exactly one from (`add-card-dialog.tsx` is a text-field form, `arquivar-contrato-dialog.tsx` is a single-action AlertDialog with no list, `column.tsx`/`card-detail-dialog.tsx` are detail/edit forms). This is a genuinely new UI shape for the project — compose it from two analogs:

**Analog 1 — Dialog shell/trigger/footer shape:** `add-card-dialog.tsx` (full file, verified this session):
```tsx
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset() }}>
  <DialogTrigger render={<Button variant="ghost" className="..." />}>
    <Plus className="size-4" />
    Adicionar imóvel
  </DialogTrigger>
  <DialogContent>
    <DialogHeader><DialogTitle>Novo imóvel</DialogTitle></DialogHeader>
    {/* body */}
    <DialogFooter>
      <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar"}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
Note `DialogTrigger` uses a `render={<Button .../>}` prop, not `asChild` — this project's `ui/dialog.tsx` wraps a Base-UI-style primitive (per `AGENTS.md`'s warning that this Next.js/component setup diverges from familiar defaults — verify `components/ui/dialog.tsx`'s actual prop contract before writing JSX, don't assume Radix's `asChild`).

**Analog 2 — confirm/saving/error state shape:** `arquivar-contrato-dialog.tsx` (full file, verified this session, `saving`/`error` state + `handleConfirm` + disabled-during-save button):
```tsx
const [saving, setSaving] = React.useState(false)
const [error, setError] = React.useState<string | null>(null)

async function handleConfirm() {
  setSaving(true)
  setError(null)
  try {
    await arquivarCard(card.id)
    onArquivado(card.id)
    onOpenChange(false)
  } catch (err) {
    setError(err instanceof Error ? err.message : "Não foi possível arquivar o imóvel. Tente novamente.")
    setSaving(false)
  }
}
// ...
{error && <p className="text-sm text-destructive">{error}</p>}
```
**New list-rendering shape (no analog — write from scratch, simple):** a vertical stack of `Button variant="ghost"` (or similar) rows, one per `columns` entry, `onClick` sets `selectedColumnId` state; confirm button disabled until a selection exists. Keep it minimal — this project has no `RadioGroup` primitive (confirmed: `ui/dialog.tsx` full-file read found none), so plain selectable buttons with a highlighted/selected visual state (e.g. `variant={selectedColumnId === column.id ? "default" : "ghost"}`) is the natural, dependency-free fit, consistent with D-07's "one popup, no second confirm screen" (the Dialog's own confirm button doubles as the only commit action, same shape as `arquivar-contrato-dialog.tsx`'s single `AlertDialogAction`).

## Shared Patterns

### Server Action skeleton (auth + validation + error mapping)
**Source:** `web/src/lib/kanban/actions.ts:52-61` (`requireUser`), `:93-96` (`id`), `:198-208` (`semLinhas`/`erroDoBanco`)
**Apply to:** `desarquivarCardAction`, `reordenarCardsAction` (both new/modified Server Actions this phase)
```typescript
const sessao = await requireUser()
if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
const invalido = id(cardId, "Imóvel") /* ...compose with ?? for more fields */
if (invalido) return { ok: false, error: invalido }
// ...query...
if (error) { console.error("<label>", error); return { ok: false, error: erroDoBanco(error.code, "<ação>") } }
if (!data || data.length === 0) return { ok: false, error: semLinhas("<ação>") }
return { ok: true, data: undefined }
```

### Single-board resolution
**Source:** `web/src/app/(app)/page.tsx:8-13` (also `financeiro/page.tsx:73`, `relatorios/page.tsx:10`)
**Apply to:** `desarquivarCardAction`'s new board/first-column lookup
```typescript
const { data: board } = await supabase
  .from("boards").select("id, name").order("created_at").limit(1).maybeSingle()
```

### Optimistic write with revert
**Source:** `web/src/components/kanban/board.tsx:116-133` (`persistOrRevert`)
**Apply to:** the new bulk-move handler in `board.tsx` — same function, no new mechanism.

### Client query wrapper convention
**Source:** `web/src/lib/kanban/queries.ts:39-43` (`unwrap`), `:76-78` (`moveCard`)
**Apply to:** new `reordenarCards` wrapper — throws on `{ ok: false }` so the existing `persistOrRevert` `.catch()` already handles it uniformly.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `web/src/components/kanban/reordenar-dialog.tsx` (list-picker portion only) | component | request-response | No existing component in this codebase renders a clickable list of options to pick exactly one from and confirm — composed from `add-card-dialog.tsx` (Dialog shell) + `arquivar-contrato-dialog.tsx` (confirm/error/saving state); the list-of-buttons body itself must be written fresh, kept intentionally simple per D-07 |
| `supabase/migrations/<ts>_arquivamento_sem_coluna.sql` (the `alter column ... drop not null` statement itself) | migration | batch | No prior migration in this project relaxes a `NOT NULL` constraint — only the surrounding comment/header conventions and the "ensaio in one pasteable block" discipline (Pitfall 2/D-19) carry over from `20260826010000_relaxar_exclusao_destrava.sql` |

## Metadata

**Analog search scope:** `web/src/lib/kanban/`, `web/src/components/kanban/`, `web/src/components/financeiro/`, `web/src/components/ui/`, `web/src/app/(app)/`, `supabase/migrations/`
**Files scanned:** ~20 (targeted, per RESEARCH.md's own exhaustive prior pass plus this session's verification reads and one new grep for list-picker precedent)
**Pattern extraction date:** 2026-08-27
