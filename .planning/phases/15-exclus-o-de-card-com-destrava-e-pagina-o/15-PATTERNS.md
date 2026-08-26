# Phase 15: Exclusão de card com destrava e paginação - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 10 (4 destrava-relaxation + 1 new component + 6 call sites, `pagination.tsx` also counted as new file)
**Analogs found:** 10 / 10 (all have either a direct prior-version-of-the-same-file analog, or a strong same-directory sibling analog)

RESEARCH.md already contains verbatim before/after code excerpts with file:line for nearly every change in this phase (it was produced by full-file reads this session). This PATTERNS.md does not repeat that content — it points the planner at the **analogous prior commits/files** that establish the precedent for each mechanical change, plus the concrete "copy this shape" excerpt for the one net-new file (`pagination.tsx`) and its 6 call sites.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql` (new, name TBD by planner) | migration | CRUD (trigger predicate) | `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` §Seção 4 (`create or replace function impedir_exclusao_de_card_com_lancamento`) | exact — same function, same `create or replace` discipline, third iteration of the same trigger |
| `web/src/lib/kanban/actions.ts` (`cardTemLancamento`, ~576-660) | service (Server Action helper) | request-response | same file, `cancelarLancamentoAction` `.in("tipo",...)` widen at line ~1442 (Phase 12 precedent) | exact — same file, sibling function, same allowlist-widen shape |
| `web/src/lib/kanban/actions.ts` (`cancelarLancamentoAction`, 1420-1460) | service (Server Action) | CRUD (DELETE) | Phase 12 diff that added `acrescimo`/`desconto` to this same `.in()` (git history of this exact line) | exact — literal same line, third widen |
| `web/src/components/financeiro/parcela-historico-sheet.tsx` (line 128) | component | request-response (render condition) | same file, prior version of the same conditional (already includes `taxa`/`pagamento`/`acrescimo`/`desconto`) | exact — same file, same conditional, one more array entry |
| `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` | component | request-response | itself — **no change needed**, confirmed by RESEARCH.md Pattern 3; `acao="lancamento"` + `TIPO["destrava"]` already resolve correctly | exact (unchanged) |
| `web/src/components/pagination.tsx` (new) | component (shared/generic) | transform (client-side slice) | `web/src/components/search-field.tsx` (small, generic, root-level `components/`, `"use client"`, controlled-props shape) | role-match — closest "small reusable non-domain component at `components/` root" |
| `web/src/components/financeiro/id-pill.tsx` / `parcela-situacao-badge.tsx` | component (shared/generic, domain-adjacent) | transform | secondary analog for `pagination.tsx` — cited explicitly by D-06 as "same spirit" | role-match (naming/scale precedent, not props shape) |
| `web/src/components/financeiro/parcelas-table.tsx` (`ParcelasTable`, `.map()` at line 234) | component (listing) | CRUD (render array prop) | itself — consumes `LinhaParcela[]` prop, is the reference shape all 5 other call sites resemble | exact (self — first of the six, most fully-featured) |
| `web/src/components/reports/contracts-table.tsx` (`ContractsTable`, `.map()` at line 42) | component (listing) | CRUD (render array prop) | `parcelas-table.tsx` (same shape: array prop → `.map()` → `<TableRow>`) | role-match |
| `web/src/components/reports/relatorio-financeiro-lista.tsx` (`.map()` at line 58) | component (listing) | CRUD (render array prop) | `parcelas-table.tsx` | role-match |
| `web/src/components/reports/dinheiro-imobiliaria-view.tsx` (`.map()` at line 166) | component (listing, self-contained filter) | CRUD (render array prop) | `parcelas-table.tsx` for table shape; itself for the "filter state lives inside the same component" pattern (matches call sites 5/6 more than 1-3) | role-match |
| `web/src/components/financeiro/configuracao-financeira-view.tsx` (`.map()` at line 167) | component (listing, no filter) | CRUD (render array prop) | `web/src/components/arquivados/arquivados-view.tsx` (same "no filter, constant resetKey" shape) | role-match |
| `web/src/components/arquivados/arquivados-view.tsx` (`.map()` at line 114) | component (listing, no filter) | CRUD (render array prop) | `configuracao-financeira-view.tsx` (mutual analog — both no-filter, both `router.refresh()` after mutation) | role-match |

## Pattern Assignments

### 1. Destrava relaxation — migration

**File to create:** new migration, e.g. `supabase/migrations/20260826010000_relaxar_exclusao_destrava.sql`

**Analog:** `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` (which itself is `create or replace` #2 over the function first created in `supabase/migrations/20260819000000_cards_arquivado_em.sql`)

**Pattern to copy exactly — never `create function`/`create trigger` from scratch, only `create or replace function` on the existing name:**
```sql
create or replace function public.impedir_exclusao_de_card_com_lancamento()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.parcela_lancamentos pl
    join public.parcelas p on p.id = pl.parcela_id
    where p.card_id = old.id
      and pl.tipo in ('pagamento', 'acrescimo', 'desconto')  -- NOVO: destrava sai
  ) or exists (
    select 1 from public.taxas_imobiliaria t where t.card_id = old.id
  ) or exists (
    select 1 from public.caucao_eventos ce where ce.card_id = old.id
  ) then
    raise exception 'Contrato com lançamento financeiro registrado não pode ser excluído. Arquive o contrato em vez de excluir.';
  end if;
  return old;
end;
$$;
```
Full current body is in `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql:239-280` (already read integrally per RESEARCH.md — reuse that excerpt, don't re-read).

**Trigger itself is untouched** — no `create trigger` statement needed, only the function body via `create or replace function`.

**Apply discipline (D-19 hazard, Pitfall 4):** ensaio/apply cycle used in Phases 4/6.1/6.2/13/14 — single pasteable block with explicit `begin;`/`rollback;` or `do $$ ... $$` for the rehearsal, human checkpoint before real apply.

---

### 2. Destrava relaxation — `cardTemLancamento` (app pre-flight)

**File:** `web/src/lib/kanban/actions.ts` lines ~576-660

**Analog:** same function's own prior shape — it currently filters `parcela_lancamentos` with no `tipo` filter (mirroring the pre-15 trigger); apply the identical `tipo in (...)` narrowing used in the SQL above, keeping `taxas_imobiliaria`/`caucao_eventos` checks unfiltered by type (they don't have a `destrava` equivalent).

**Also update:** `cardTemLancamentoAction` (~line 788) — pure pass-through pre-flight, no text change needed (message is generic per RESEARCH.md).

---

### 3. Destrava relaxation — `cancelarLancamentoAction` allowlist widen

**File:** `web/src/lib/kanban/actions.ts` lines 1420-1460

**Analog:** this exact line's own history — Phase 12 already widened `.in("tipo", ["pagamento"])` → `.in("tipo", ["pagamento", "acrescimo", "desconto"])`. This phase repeats the identical mechanical widen:
```typescript
.in("tipo", ["pagamento", "acrescimo", "desconto", "destrava"])
```
`exigirParcelaNaoConciliada` (called line ~1433, defined `actions.ts:993-1012`) needs **no change** — it already runs before the DELETE regardless of `tipo`.

---

### 4. Destrava relaxation — "Cancelar" button render condition

**File:** `web/src/components/financeiro/parcela-historico-sheet.tsx` line 128

**Analog:** same line, same file — literal widen of the array:
```tsx
{(item.kind === "taxa" || ["pagamento", "acrescimo", "desconto", "destrava"].includes(item.tipo)) && !parcelaConciliada && (
```
No changes needed to `cancelar-lancamento-dialog.tsx` or `lancamento-tipo-label.tsx` (both already have the `destrava` entry / already resolve `acao="lancamento"` correctly per RESEARCH.md Pattern 3 — verified by full read this session, don't re-verify).

---

### 5. `web/src/components/pagination.tsx` (new component + hook)

**Analog for file placement/shape:** `web/src/components/search-field.tsx` (full file read above) — establishes the precedent for:
- Root-level `components/` placement (not nested in a domain folder) for small generic UI, `"use client"` at top
- Controlled-component props pattern (`value`/`onChange`-style, not internal fetching)
- JSDoc comment above the export explaining scope/behavior in Portuguese, matching project convention
- Uses `cn()` from `@/lib/utils` and shadcn `components/ui/*` primitives (here: `Button` instead of `Input`)

**Imports pattern to copy** (`search-field.tsx:1-7`):
```tsx
"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
```
Adapt for pagination: `ChevronLeft, ChevronRight` from `lucide-react`, `Button` from `@/components/ui/button`.

**Core pattern:** RESEARCH.md Pattern 4 (lines 202-275) already contains the complete, ready-to-use implementation of `usePagination<T>()` and `<Pagination>` — copy verbatim, including the `resetKey`-during-render reset technique (not `useEffect`) and the `TAMANHO_PAGINA = 10` constant. This is the single source of truth for this file; do not re-derive.

**Naming convention match:** project uses PT-BR identifiers for domain concepts but the hook/hook internals here already follow existing sibling naming (`ParcelaSituacaoBadge`, `IdPill`) — `usePagination`/`Pagination` (English, generic) is consistent with how non-domain-specific shared primitives are named in `components/ui/*` (English) vs. domain components (PT-BR). Keep `Pagination`/`usePagination` names in English per RESEARCH.md's own example; internal PT-BR params (`pagina`, `totalPaginas`) match the codebase's PT-BR convention for values/locals.

---

### 6. Six listing call sites — wiring `usePagination`/`Pagination` in

**Reference/primary analog:** `web/src/components/financeiro/parcelas-table.tsx`

**Core `.map()` pattern to wrap** (`parcelas-table.tsx:220-234`, verified this session):
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>ID</TableHead>
      ...
    </TableRow>
  </TableHeader>
  <TableBody>
    {linhas.map((linha) => (
      <TableRow key={linha.id}>
        ...
```
Change: replace `linhas.map(...)` with `itensDaPagina.map(...)` where `{ itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(linhas, resetKey)`, then render `<Pagination pagina={pagina} totalPaginas={totalPaginas} onPaginaChange={setPagina} />` below `</Table>`.

Props: `linhas: LinhaParcela[]` (line 192) is the existing prop; import line 9 (`import type { LinhaParcela } from "@/lib/kanban/parcelas"`) shows the existing type-import convention new imports should match (`import { usePagination, Pagination } from "@/components/pagination"`).

**Per-call-site specifics — copy RESEARCH.md's "Per-call-site wiring" table verbatim** (it already has exact `resetKey` expressions per file, `"use client"` status, and `.map()` line numbers for all 6):

| # | File | `.map()` line | resetKey source |
|---|---|---|---|
| 1 | `web/src/components/financeiro/parcelas-table.tsx` | 234 | `JSON.stringify(filtroInicial)` threaded from `financeiro-view.tsx` |
| 2 | `web/src/components/reports/contracts-table.tsx` | 42 | computed in `reports-view.tsx` from `query`/`statusFilters`/`columnFilters` |
| 3 | `web/src/components/reports/relatorio-financeiro-lista.tsx` | 58 | `JSON.stringify(filtro)` from `relatorio-financeiro-dedicado.tsx` |
| 4 | `web/src/components/reports/dinheiro-imobiliaria-view.tsx` | 166 | `periodo` (local `useState`, no new prop) |
| 5 | `web/src/components/financeiro/configuracao-financeira-view.tsx` | 167 | constant (no filter on this screen) |
| 6 | `web/src/components/arquivados/arquivados-view.tsx` | 114 | constant (no filter on this screen) |

**Analog pairing for the two "no filter" screens (5, 6):** they are each other's closest analog — both receive a flat array prop with no filter state, both call `router.refresh()` after a mutation dialog closes, both should use a constant `resetKey` (e.g. `"config"` / `"arquivados"`) so pagination position survives `router.refresh()`. See RESEARCH.md Pitfall 3 for why `useEffect(() => setPage(1), [items])` must NOT be used — array reference changes on every `router.refresh()` even when the filter didn't change.

## Shared Patterns

### Migration discipline: `create or replace function`, never recreate trigger/function
**Source:** `supabase/migrations/20260819000000_cards_arquivado_em.sql` (original create) → `supabase/migrations/20260824000000_dinheiro_imobiliaria.sql` (widen #1) → this phase (widen #2, relax)
**Apply to:** the one new migration file in this phase
```sql
create or replace function public.impedir_exclusao_de_card_com_lancamento() ...
```

### Allowlist widen via `.in("tipo", [...])`
**Source:** `web/src/lib/kanban/actions.ts` `cancelarLancamentoAction` (Phase 12 precedent: `["pagamento"]` → `["pagamento","acrescimo","desconto"]`)
**Apply to:** same line, this phase: `["pagamento","acrescimo","desconto","destrava"]`

### `resetKey`-during-render reset (not `useEffect`)
**Source:** RESEARCH.md Pattern 4, `web/src/components/pagination.tsx` (new)
**Apply to:** all 6 listing call sites — compare `resetKey !== ultimaChave` during render, call `setPagina(1)` inline, never in a `useEffect([items])`.

### Small generic component at `components/` root (not nested in domain folder)
**Source:** `web/src/components/search-field.tsx`
**Apply to:** `web/src/components/pagination.tsx`

## No Analog Found

None — every file in this phase has at least a role-match analog in the existing codebase (this phase is explicitly two sets of mechanical extensions of established patterns, confirmed by RESEARCH.md's own "Standard Stack" and "State of the Art" sections finding zero new architecture).

## Metadata

**Analog search scope:** `web/src/lib/kanban/actions.ts`, `web/src/components/financeiro/*`, `web/src/components/reports/*`, `web/src/components/arquivados/*`, `web/src/components/*.tsx` (root), `supabase/migrations/*`
**Files scanned:** ~14 (via RESEARCH.md's own integral reads this session, plus 2 verification reads: `search-field.tsx` full read, `parcelas-table.tsx` imports + `.map()` region, `parcela-historico-sheet.tsx` region already covered by RESEARCH.md)
**Pattern extraction date:** 2026-08-26
