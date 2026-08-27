# Phase 18: Filtro na Configuração financeira - Pattern Map

**Mapped:** 2026-08-27
**Files analyzed:** 1 (single file, modified only)
**Analogs found:** 1 / 1 (exact match, same codebase, different sections used as analogs for different sub-patterns)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `web/src/components/financeiro/configuracao-financeira-view.tsx` | component (client, table/list view) | CRUD (client-side filter over already-loaded data) | `web/src/components/reports/reports-view.tsx` | exact (same `SearchField` + `usePagination` composition pattern, same project) |

No other files are created or modified in this phase (confirmed by CONTEXT.md and RESEARCH.md — `page.tsx` Server Component and `search.ts` are explicitly **not touched**).

## Pattern Assignments

### `web/src/components/financeiro/configuracao-financeira-view.tsx` (component, CRUD/client-filter)

This file already exists and is modified in place — no new file is created. Three sub-patterns must be applied to it, each copied from a different location.

**Current state to modify** (`web/src/components/financeiro/configuracao-financeira-view.tsx:135-209`):
- Component signature `ConfiguracaoFinanceiraView({ linhas, todayISO, erro })`
- `usePagination(linhas, "config")` at lines 147-150, with comment citing PAGIN-03
- Two-branch conditional render at lines 154-162: `erro` → `linhas.length === 0` → table
- `<Table>`/`<Pagination>` render at lines 163-206, inside a single `<div className="rounded-2xl border border-border bg-card p-6">` card (line 153)

---

#### Sub-pattern 1: Matcher for `ContratoConfig` (analog: `web/src/lib/kanban/search.ts`)

**Analog:** `web/src/lib/kanban/search.ts:8-13` (`normalizeText`) and `:43-70` (`parseTerms`/`buildMatcher` shape)

**Do NOT import/reuse `buildMatcher`/`searchableText` directly** — they are typed for `Card` (`import type { Card, Column } from "./types"` at line 1) and `ContratoConfig` lacks `inquilino`/`telefone`/`observacoes`/`valor`. Only `normalizeText` is generic and importable as-is.

`normalizeText` to import unchanged (`web/src/lib/kanban/search.ts:8-13`):
```typescript
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
}
```

`buildMatcher` shape to mirror locally (`web/src/lib/kanban/search.ts:43-70`, adapted for 3 fields, no digits-matching needed since `numero` is a plain int):
```typescript
function parseTerms(query: string): string[] {
  return normalizeText(query).split(/\s+/).filter(Boolean)
}

export function buildMatcher(query: string): CardMatcher {
  const terms = parseTerms(query)
  if (terms.length === 0) return () => true

  return (card) => {
    const text = searchableText(card)
    const digits = searchableDigits(card)

    return terms.every((term) => {
      if (text.includes(term)) return true
      const termDigits = onlyDigits(term)
      return termDigits.length > 0 && digits.includes(termDigits)
    })
  }
}
```

**Local implementation to write inside `configuracao-financeira-view.tsx`** (add near top, after imports, before `ConfiguracaoFinanceiraView`):
```typescript
import { normalizeText } from "@/lib/kanban/search"

/**
 * D-03 (18-CONTEXT.md): ContratoConfig não tem inquilino/telefone/
 * observacoes como o Card completo do Board, então buildMatcher/
 * searchableText de search.ts (tipados para Card) não se aplicam aqui —
 * matcher próprio para os três campos já visíveis na tabela: número,
 * endereço, proprietário. Mesmo contrato de buildMatcher: todos os termos
 * precisam bater, cada um em qualquer um dos três campos.
 */
function searchableText(linha: ContratoConfig): string {
  return normalizeText(
    [String(linha.numero), linha.endereco, linha.proprietario].join(" ")
  )
}

function buildContratoMatcher(query: string): (linha: ContratoConfig) => boolean {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return () => true

  return (linha) => {
    const text = searchableText(linha)
    return terms.every((term) => text.includes(term))
  }
}
```

**Anti-pattern to avoid:** Do not extend `buildMatcher`/`searchableText` in `search.ts` to accept a union/generic type — that module stays coherent around `Card`/`Column` (Board + Reports consumers). Write the matcher local to this file instead.

---

#### Sub-pattern 2: `SearchField` usage + `resetKey` composition (analog: `web/src/components/reports/reports-view.tsx`)

**Analog:** `web/src/components/reports/reports-view.tsx:98` (state), `:104-118` (memoized filter), `:129-133` (resetKey composition), `:156-159` (`SearchField` render)

State + filter pattern to mirror (`reports-view.tsx:98, 104-118`):
```typescript
const [query, setQuery] = React.useState("")
...
const filteredColumns = React.useMemo(() => {
  const matchesQuery = buildMatcher(query)
  return columns
    .filter(...)
    .map((column) => ({
      ...column,
      cards: column.cards.filter((card) => matchesQuery(card) && ...),
    }))
}, [columns, columnFilters, statusFilters, query, today])
```

`resetKey` composition pattern to mirror (`reports-view.tsx:129-133`):
```typescript
// PAGIN-03: chave de identidade do filtro ativo — volta a paginação de
// ContractsTable para a página 1 quando busca/status/coluna mudam, mas
// nunca reseta por causa de um `router.refresh()` não relacionado (Pitfall
// 3, 15-RESEARCH.md).
const contractsResetKey = `${query}|${[...statusFilters].sort().join(",")}|${[...columnFilters].sort().join(",")}`
```

Since `configuracao-financeira-view.tsx` has only one filter dimension (query), the composition simplifies to using `query` directly as `resetKey` — matching the simpler single-value precedent `dinheiro-imobiliaria-view.tsx`'s `resetKey={periodo}` rather than the composed-string precedent above.

**Target implementation, replacing lines 144-150 of `configuracao-financeira-view.tsx`:**
```typescript
const [query, setQuery] = React.useState("")

const matchesQuery = React.useMemo(() => buildContratoMatcher(query), [query])
const linhasFiltradas = React.useMemo(
  () => linhas.filter(matchesQuery),
  [linhas, matchesQuery]
)

// FILTCFG-02: query (estado local do componente) sobrevive a um
// router.refresh() sem mudar — a prop `linhas` recebe referência nova, mas
// resetKey não muda, então a página do usuário não é perdida (mesmo cuidado
// do Pitfall 3, 15-RESEARCH.md). Mudar o texto da busca, por outro lado,
// muda `query` e volta a paginação para a página 1.
const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(
  linhasFiltradas,
  query
)
```

**Critical anti-pattern (Pitfall 2 in RESEARCH.md):** `resetKey` must be exactly `query` (or a pure derivation of it) — never `linhas`, `linhasFiltradas`, or any array-derived value (length, reference). Using an array-derived value would reset pagination on every `router.refresh()` even when the filter didn't change.

`SearchField` render pattern to mirror (`reports-view.tsx:156-159`):
```typescript
<SearchField
  value={query}
  onChange={setQuery}
  resultSummary={`${report.totalImoveis} de ${totalCards} imóveis`}
  ...
/>
```

**Import to add:**
```typescript
import { SearchField } from "@/components/search-field"
```

**`SearchField` component contract** (`web/src/components/search-field.tsx:14-34`, unchanged, no modification needed):
```typescript
export function SearchField({
  value,
  onChange,
  placeholder = "Buscar por proprietário, endereço, inquilino...",
  className,
  resultSummary,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  resultSummary?: string
  onSubmit?: () => void
})
```

**Critical pitfall:** the default `placeholder` (`search-field.tsx:17`) says "...inquilino" which does not apply here (D-03 only covers número/endereço/proprietário). Always pass an explicit `placeholder="Buscar por número, endereço ou proprietário..."`.

---

#### Sub-pattern 3: Third empty-state branch (analog: `web/src/components/reports/contracts-table.tsx`)

**Analog:** `web/src/components/reports/contracts-table.tsx:37-40` — established precedent for "filtered, no match" messaging, distinct from "no data at all".

**Current 2-branch conditional to extend** (`configuracao-financeira-view.tsx:154-162`):
```typescript
{erro ? (
  <p className="text-sm text-muted-foreground">
    Não foi possível carregar os dados agora. Tente novamente.
  </p>
) : linhas.length === 0 ? (
  <p className="text-sm text-muted-foreground">
    Nenhum contrato cadastrado ainda.
  </p>
) : (
  ...table...
)}
```

**Target 3-branch conditional + `SearchField` placement** (mirrors `contracts-table.tsx` empty-filtered-state precedent, `"Nenhum imóvel corresponde aos filtros selecionados."`):
```tsx
return (
  <div className="rounded-2xl border border-border bg-card p-6">
    {!erro && linhas.length > 0 && (
      <div className="mb-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Buscar por número, endereço ou proprietário..."
          resultSummary={`${linhasFiltradas.length} de ${linhas.length} contratos`}
        />
      </div>
    )}
    {erro ? (
      <p className="text-sm text-muted-foreground">
        Não foi possível carregar os dados agora. Tente novamente.
      </p>
    ) : linhas.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Nenhum contrato cadastrado ainda.
      </p>
    ) : linhasFiltradas.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Nenhum contrato corresponde à busca.
      </p>
    ) : (
      <div>
        <Table>{/* itensDaPagina already comes filtered — table body unchanged */}</Table>
        <Pagination pagina={pagina} totalPaginas={totalPaginas} onPaginaChange={setPagina} />
      </div>
    )}
  </div>
)
```

**Ordering matters:** `erro` → `linhas.length === 0` (dataset empty) → `linhasFiltradas.length === 0` (filter matched nothing) → table. `SearchField` sits outside this conditional chain (still visible when the filter finds nothing, so the user can edit the term without clearing first), but only renders when `!erro && linhas.length > 0`.

---

## Shared Patterns

### Client-side live filter composed with existing pagination
**Source:** `web/src/components/reports/reports-view.tsx` (full component pattern: `useState` query + `useMemo` filter + `usePagination` with query-derived `resetKey`)
**Apply to:** `configuracao-financeira-view.tsx` only (single file this phase)

### `normalizeText` accent-insensitive normalization
**Source:** `web/src/lib/kanban/search.ts:8-13`
**Apply to:** the new local `searchableText`/`buildContratoMatcher` functions — import unchanged, do not reimplement.

### Three-branch empty state (error / empty dataset / empty filtered result)
**Source:** `web/src/components/reports/contracts-table.tsx:37-40`
**Apply to:** `configuracao-financeira-view.tsx` render logic.

## No Analog Found

None — this phase modifies exactly one existing file, and every sub-pattern needed has a direct, already-in-production analog in the same codebase (`reports-view.tsx`, `search.ts`, `search-field.tsx`, `contracts-table.tsx`, `pagination.tsx`).

## Metadata

**Analog search scope:** `web/src/components/reports/`, `web/src/lib/kanban/`, `web/src/components/` (search-field, pagination), `web/src/components/financeiro/` (target file itself)
**Files scanned/read this session:** `configuracao-financeira-view.tsx` (full), `search-field.tsx` (full), `search.ts` (lines 1-75), `reports-view.tsx` (lines 90-160), plus CONTEXT.md/RESEARCH.md (already exhaustively verified analogs with line numbers by the researcher — this pattern map re-confirmed those line numbers directly)
**Pattern extraction date:** 2026-08-27
