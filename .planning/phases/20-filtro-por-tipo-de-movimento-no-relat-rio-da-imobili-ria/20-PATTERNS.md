# Phase 20: Filtro por tipo de movimento no relatório da imobiliária - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 3 (all existing, modified — no new files this phase)
**Analogs found:** 3 / 3 (all "exact" — same files already implement 90% of the target pattern, extended by direct in-repo precedent)

This phase is a pure extension of Phase 19's own code. There is no meaningful "different file" analog search needed: the closest analog to each file being modified is itself (post-Phase-19 state) plus one true external precedent (`filtro-relatorio-financeiro-live.tsx`'s "Situação" chip row and `relatorio-financeiro-dedicado.tsx`'s `Set`-in-`resetKey`) for the one genuinely new piece of UI/state (the chip row).

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|----------------|------|-----------|-----------------|---------------|
| `web/src/lib/kanban/reconciliacao.ts` | utility (pure filter/aggregation module) | transform | itself (Phase 19) + `web/src/lib/kanban/taxas.ts` (`OrigemTaxa`, `TipoCaucao` types) | exact |
| `web/src/components/reports/filtro-reconciliacao.tsx` | component (filter panel) | request-response (client state) | `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` (chip row "Situação", lines 83-109) | exact |
| `web/src/components/reports/dinheiro-imobiliaria-view.tsx` | component (data view: filter + table + PDF trigger) | CRUD (client-side filter/derive over fetched data) | itself (Phase 19) + `web/src/components/reports/reports-view.tsx` (`FilterChip`/`toggle`, `contractsResetKey` sort precedent) + `web/src/components/reports/relatorio-financeiro-dedicado.tsx` (`Set`-in-`resetKey` precedent, lines 69-80) | exact |
| `web/src/components/reports/reconciliacao-pdf.ts` | utility (PDF export) | file-I/O | **not modified this phase** (D-08/D-09) | n/a — zero-change file |

## Pattern Assignments

### `web/src/lib/kanban/reconciliacao.ts` (utility, transform)

**Analog:** itself (current state, verified this session) + `web/src/lib/kanban/taxas.ts:13,89`

**Current type shape to extend** (lines 58-69):
```typescript
export type FiltroReconciliacaoValores = {
  imovel: string
  proprietario: string
  inquilino: string
  id: string
  periodo: string
}

export function filtroReconciliacaoVazio(): FiltroReconciliacaoValores {
  return { imovel: "", proprietario: "", inquilino: "", id: "", periodo: "" }
}
```

**Pattern to apply** — add `tipos: Set<TipoMovimentoReconciliacao>` field + new type + new pure predicate, reusing the existing two-literal `OrigemTaxa` union as a superset (no mapping function needed):
```typescript
import type { OrigemTaxa, TipoCaucao } from "./taxas"

export type TipoMovimentoReconciliacao = OrigemTaxa | "caucao"

export type FiltroReconciliacaoValores = {
  imovel: string
  proprietario: string
  inquilino: string
  id: string
  periodo: string
  tipos: Set<TipoMovimentoReconciliacao>
}

export function filtroReconciliacaoVazio(): FiltroReconciliacaoValores {
  return {
    imovel: "",
    proprietario: "",
    inquilino: "",
    id: "",
    periodo: "",
    tipos: new Set(),
  }
}

export function passaFiltroTipoReconciliacao(
  tipo: TipoMovimentoReconciliacao,
  tipos: Set<TipoMovimentoReconciliacao>
): boolean {
  if (tipos.size === 0) return true
  return tipos.has(tipo)
}
```

**`calcularReconciliacao` — 4th parameter, no default value** (current signature lines 141-145):
```typescript
export function calcularReconciliacao(
  taxas: TaxaImobiliariaRelatorio[],
  caucaoEventos: CaucaoEventoRelatorio[],
  periodo: string,
  tipos: Set<TipoMovimentoReconciliacao>   // NEW — no default, so the one existing 3-arg call site fails to compile until updated (intentional tripwire)
): ReconciliacaoTotais {
  // ... existing accumulation loops, each gains one guard clause:
  for (const taxa of taxas) {
    if (!passaFiltroPeriodoReconciliacao(taxa.data, periodo)) continue
    if (!passaFiltroTipoReconciliacao(taxa.origem, tipos)) continue   // NEW
    if (taxa.origem === "administracao") administracao += taxa.valor
    else comissao += taxa.valor
  }
  for (const evento of caucaoEventos) {
    if (!passaFiltroPeriodoReconciliacao(evento.data, periodo)) continue
    if (!passaFiltroTipoReconciliacao("caucao", tipos)) continue      // NEW — constant "caucao", never evento.tipo (D-02)
    if (evento.tipo === "recebido") caucaoRecebida += evento.valor
    else if (evento.tipo === "devolvido") caucaoDevolvida += evento.valor
    else caucaoUsada += evento.valor
  }
  return { administracao, comissao, caucaoRecebida, caucaoDevolvida, caucaoUsada, totalRecebido: administracao + comissao + caucaoRecebida }
}
```

**Do not touch:** `endereco` field on `TaxaImobiliariaRelatorio.cards`/`CaucaoEventoRelatorio.cards` — stays wired for `reconciliacao-pdf.ts`.

---

### `web/src/components/reports/filtro-reconciliacao.tsx` (component, request-response)

**Analog:** `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` (lines 83-109, "Situação" chip row, `[VERIFIED]`)

**Imports pattern to add:**
```typescript
import { FilterChip, toggle } from "@/components/reports/reports-view"
import type { TipoMovimentoReconciliacao } from "@/lib/kanban/reconciliacao"
```

**Core chip-row pattern (mirrored from analog, lines 87-108 of the analog file):**
```typescript
const TIPO_MOVIMENTO_OPTIONS: { value: TipoMovimentoReconciliacao; label: string }[] = [
  { value: "administracao", label: "Administração" },
  { value: "comissao_primeiro_aluguel", label: "Comissão 1º aluguel" },
  { value: "caucao", label: "Caução" },
]

// Placement: after the existing grid of 5 <Input> fields, before the
// `temFiltroPreenchido && (...)` "Limpar filtros" block.
<div className="mt-3 flex flex-wrap items-center gap-2">
  <span className="shrink-0 text-xs font-semibold text-muted-foreground uppercase">
    Tipo
  </span>
  <FilterChip
    active={campos.tipos.size === 0}
    onClick={() => onChange((atual) => ({ ...atual, tipos: new Set() }))}
    className="font-semibold"
  >
    Todos
  </FilterChip>
  {TIPO_MOVIMENTO_OPTIONS.map((option) => (
    <FilterChip
      key={option.value}
      active={campos.tipos.has(option.value)}
      onClick={() =>
        onChange((atual) => ({ ...atual, tipos: toggle(atual.tipos, option.value) }))
      }
      className="font-semibold"
    >
      {option.label}
    </FilterChip>
  ))}
</div>
```

**`temFiltroPreenchido` extension (current lines 35-41)** — must gain `tipos` check so "Limpar filtros" appears correctly:
```typescript
const temFiltroPreenchido = Boolean(
  campos.imovel.trim() ||
    campos.proprietario.trim() ||
    campos.inquilino.trim() ||
    campos.id.trim() ||
    campos.periodo.trim() ||
    campos.tipos.size > 0   // NEW
)
```

---

### `web/src/components/reports/dinheiro-imobiliaria-view.tsx` (component, CRUD/client-derive)

**Analog:** itself (Phase 19 state) + `web/src/components/reports/reports-view.tsx:133` (`contractsResetKey`, sorted-Set-in-key precedent) + `web/src/components/reports/relatorio-financeiro-dedicado.tsx:69-80` (`Set`-in-`resetKey` precedent)

**`calcularReconciliacao` call site update (lines 93-96):**
```typescript
const totais = React.useMemo(
  () => calcularReconciliacao(taxas, caucaoEventos, filtro.periodo, filtro.tipos),
  [taxas, caucaoEventos, filtro.periodo, filtro.tipos]
)
```

**`linhas` useMemo — both filter chains gain a clause (lines 102-137):**
```typescript
const taxaLinhas: LinhaLista[] = taxas
  .filter((taxa) => passaFiltroPeriodoReconciliacao(taxa.data, filtro.periodo))
  .filter((taxa) => passaFiltroCardsReconciliacao(taxa.cards, filtro))
  .filter((taxa) => passaFiltroTipoReconciliacao(taxa.origem, filtro.tipos))   // NEW
  .map((taxa) => ({ /* unchanged */ }))

const caucaoLinhas: LinhaLista[] = caucaoEventos
  .filter((evento) => passaFiltroPeriodoReconciliacao(evento.data, filtro.periodo))
  .filter((evento) => passaFiltroCardsReconciliacao(evento.cards, filtro))
  // D-02: all TipoCaucao subtypes collapse to "caucao" — constant, never evento.tipo
  .filter(() => passaFiltroTipoReconciliacao("caucao", filtro.tipos))   // NEW
  .map((evento) => ({ /* unchanged */ }))
```
`useMemo` dep array is already `[taxas, caucaoEventos, filtro]` (whole `filtro` object) — no change needed.

**`resetKey` composition (line 143) — mirror sorted-Set precedent (`reports-view.tsx:133`, `relatorio-financeiro-dedicado.tsx:69-80`), never unsorted:**
```typescript
const resetKey = `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}|${[...filtro.tipos].sort().join(",")}`
```

**Table header/cell pattern (D-05/D-06/D-07), current lines 264-286:**
```typescript
// Header — insert one <TableHead>Inquilino</TableHead> after Contrato:
<TableHeader>
  <TableRow>
    <TableHead>Data</TableHead>
    <TableHead>Contrato</TableHead>
    <TableHead>Inquilino</TableHead>
    <TableHead>Tipo</TableHead>
    <TableHead className="text-right">Valor</TableHead>
    <TableHead>Observação</TableHead>
  </TableRow>
</TableHeader>

// Contrato cell — endereco -> proprietario (same IdPill + span shape), plus new Inquilino cell:
<TableCell className="text-sm">
  <div className="flex items-center gap-2">
    <IdPill numero={linha.cards?.numero ?? 0} />
    <span className="font-semibold text-foreground">
      {linha.cards?.proprietario ?? ""}
    </span>
  </div>
</TableCell>
<TableCell className="text-sm text-muted-foreground">
  {linha.cards?.inquilino ?? ""}
</TableCell>
```
No change to `LinhaLista` type (lines 55-68) — `cards: { endereco, proprietario, numero, inquilino }` already carries all four fields.

---

### `web/src/components/reports/reconciliacao-pdf.ts` — UNCHANGED (D-08/D-09)

No pattern assignment needed. Verified in full this session (per RESEARCH.md): the module's only inputs are `linhas`, `totais`, `filtro`, `hojeISO` — it has zero per-type branching and automatically benefits from `linhas`/`totais` already being filtered upstream. `reconciliacao-pdf.ts:161` still reads `linha.cards?.endereco` for its own "Contrato" column (`"#numero endereco"`) — do not touch this file, and do not remove `endereco` from any shared type.

## Shared Patterns

### Set-based multi-select filter, empty = "no filter"
**Source:** `web/src/components/reports/reports-view.tsx:31-35` (`toggle<T>`)
**Apply to:** `filtro-reconciliacao.tsx` (new `tipos` chip row), `reconciliacao.ts` (`passaFiltroTipoReconciliacao`)
```typescript
export function toggle<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current)
  if (!next.delete(value)) next.add(value)
  return next
}
```

### `resetKey` with a `Set` field — always sorted before join
**Source:** `web/src/components/reports/reports-view.tsx:133` and `web/src/components/reports/relatorio-financeiro-dedicado.tsx:69-80`
**Apply to:** `dinheiro-imobiliaria-view.tsx`'s `resetKey`
```typescript
`${[...someSet].sort().join(",")}`
```
Never join an unsorted `Set` — click order would otherwise produce spurious pagination resets (Pitfall 4 in RESEARCH.md).

### Category collapsing via superset union type (no mapping function)
**Source:** `web/src/lib/kanban/taxas.ts:13` (`OrigemTaxa`), `:89` (`TipoCaucao`)
**Apply to:** `reconciliacao.ts`'s new `TipoMovimentoReconciliacao` type
```typescript
export type TipoMovimentoReconciliacao = OrigemTaxa | "caucao"
```
`taxa.origem` passes straight through (already typed `OrigemTaxa`); all three `TipoCaucao` values pass the constant `"caucao"` — never `evento.tipo` (D-02, Pitfall 3).

## No Analog Found

None — every file in scope has a strong, verified analog (either its own Phase 19 state, or a direct in-repo precedent for the one new UI pattern).

## Metadata

**Analog search scope:** `web/src/components/reports/`, `web/src/lib/kanban/`
**Files scanned:** `dinheiro-imobiliaria-view.tsx` (308 lines), `reconciliacao.ts` (180 lines), `filtro-reconciliacao.tsx` (114 lines), `reports-view.tsx` (256 lines), `filtro-relatorio-financeiro-live.tsx` (120 lines), `relatorio-financeiro-dedicado.tsx`, `taxas.ts`, `reconciliacao-pdf.ts` — all verified in full during Phase 20's RESEARCH.md pass (this session reused those verified excerpts rather than re-reading identical ranges).
**Pattern extraction date:** 2026-08-28
**Note:** RESEARCH.md for this phase already contains exhaustive `[VERIFIED: path:lines]` code excerpts for every pattern above — this PATTERNS.md reorganizes those same verified excerpts into per-file pattern assignments for the planner, without re-reading any file range already captured there.
