# Phase 20: Filtro por tipo de movimento no relatório da imobiliária - Research

**Researched:** 2026-08-28
**Domain:** Client-side multi-select filter (React 19 state) + table column rewrite, entirely within one already-shipped Next.js 16 client component and its pure-function sibling module. No new library, no new Server Action, no new database access.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Seletor de tipo de movimento**
- **D-01:** Chips clicáveis multi-select, mesmo componente `FilterChip`/`toggle` (`reports-view.tsx`) já usado pela "Situação" no Relatório Financeiro dedicado (`FiltroRelatorioFinanceiroLive`) — três chips (**Administração**, **Comissão 1º aluguel**, **Caução**) mais um chip **"Todos"**. Nenhum chip de tipo selecionado (`tipos.size === 0`) significa "mostra tudo", mesma semântica de `situacoes` — não é preciso marcar "Todos" manualmente, é o estado vazio.
- **D-02:** "Caução" é **um único chip**, cobrindo os três subtipos já existentes (recebida/devolvida/usada) juntos — não há chip separado por subtipo. Confirmado explicitamente pelo usuário depois de eu apresentar as duas opções.
- **D-03:** O filtro de tipo afeta **tudo**: a lista embaixo, os 6 `StatTile` em cima (Administração/Comissão/Total recebido/Caução recebida/devolvida/usada) e o PDF exportado — desmarcar "Comissão", por exemplo, zera o `StatTile` de Comissão e para de somá-la em "Total recebido", além de remover essas linhas da lista e do PDF. Confirmado explicitamente pelo usuário ("Afeta tudo: lista + totais + PDF").
- **D-04 (Claude's Discretion, recomendação):** Quando um tipo é desmarcado, o `StatTile` correspondente mostra R$ 0,00 — não desaparece do grid. Não há precedente neste projeto de esconder um `StatTile` condicionalmente, e escondê-lo mudaria o layout do grid de forma inconsistente entre estados do filtro; zerar é o comportamento mais simples e mais consistente com o resto da tela.

**Colunas da lista**
- **D-05:** A célula "Contrato" (hoje `IdPill` + endereço, lado a lado) **mantém exatamente esse formato visual** — só troca o texto ao lado do `IdPill` de endereço para **proprietário**. Não vira duas colunas separadas (ID / Proprietário) — o usuário foi explícito sobre isso depois de eu propor errado da primeira vez.
- **D-06:** Uma coluna nova, separada, **"Inquilino"** — depois da coluna "Contrato". Colunas finais da tabela: **Data, Contrato (IdPill + proprietário), Inquilino, Tipo, Valor, Observação** — Tipo/Valor/Observação inalteradas.
- **D-07:** Endereço **sai completamente** da tela — não fica em tooltip nem em nenhum outro lugar da linha.

**PDF (Phase 19, não revisitar o layout agora)**
- **D-08:** O PDF continua com as mesmas colunas de hoje (`Data/Contrato ("#numero endereco")/Tipo/Valor/Observação`, sem Proprietário/Inquilino separados) — **nenhuma mudança de layout do PDF nesta fase**. A única mudança no PDF é que ele passa a receber `linhas` já filtradas pelo tipo (D-03) — menos linhas quando um filtro de tipo está ativo, mesmo mecanismo que já filtra por Imóvel/Proprietário/Inquilino/ID/Período desde a Phase 19.
- **D-09 (explícito, fora de escopo):** O usuário disse que o PDF "não está como eu gostaria" e vai trazer um modelo (template) numa fase futura — **não redesenhar o PDF agora**, nem tentar adivinhar o que ele quer. Registrar como ideia adiada.

### Claude's Discretion
- Nome exato do novo tipo TypeScript pra representar os 3 valores do chip de tipo (ex.: `"administracao" | "comissao_primeiro_aluguel" | "caucao"`) — precisa mapear `taxa.origem` (`administracao`/`comissao_primeiro_aluguel`, já existe) e os três `evento.tipo` de caução (`recebido`/`devolvido`/`usado`, já existem) para uma única categoria "caucao" na hora de filtrar.
- Como compor o `resetKey` de `usePagination` — agora precisa incluir também o novo estado de tipos selecionados (um `Set`), não só os 5 campos de texto/período já existentes desde a Phase 19. `relatorio-financeiro-dedicado.tsx` já resolve exatamente esse problema (resetKey com `Set` dentro, via `JSON.stringify` ou `[...set].sort().join(",")`) — mirar esse precedente.
- Onde exatamente os chips ficam posicionados dentro do painel suspenso, relativo aos 5 campos já existentes.

### Deferred Ideas (OUT OF SCOPE)
- **Redesenho do layout do PDF de Dinheiro da imobiliária** — o usuário disse explicitamente que o PDF atual "não está como eu gostaria" e que vai trazer um modelo próprio depois desta fase. Não é escopo desta fase (D-09) — vira uma fase futura quando o usuário trouxer o modelo.
</user_constraints>

## Project Constraints (from CLAUDE.md)

`web/CLAUDE.md` `@`-includes `web/AGENTS.md`, which states: **"This is NOT the Next.js you know"** — this Next.js 16 install has breaking changes vs. training data; read `node_modules/next/dist/docs/` before writing code that touches a Next.js API, and heed deprecation notices.

**Applicability to this phase:** none of the changes required by Phase 20 touch a Next.js API. Everything happens inside an already-`"use client"` component (`dinheiro-imobiliaria-view.tsx`) and two pure TypeScript modules (`reconciliacao.ts`, `filtro-reconciliacao.tsx`). No routing, no Server Action signature change, no `next/headers`, no new data fetch. The planner does not need to consult `node_modules/next/dist/docs/` for this phase — flagged here only to document that the check was made, not skipped.

`web/CLAUDE.md` also references a project skill (`sketch-findings-kanban-para-aluguel`) for design decisions/CSS patterns — not invoked during this research pass since the phase reuses existing, already-shipped visual components (`FilterChip`, `IdPill`, `Table`) byte-for-byte; no new visual pattern is being introduced.

## Summary

Phase 20 is a pure extension of code shipped in Phase 19, touching exactly the same five files that Phase 19 touched (`dinheiro-imobiliaria-view.tsx`, `reconciliacao.ts`, `filtro-reconciliacao.tsx`) plus zero new ones. Reading the current, post-Phase-19 state of these files confirms every assumption in CONTEXT.md holds, and surfaces one simplification the planner should take: because `OrigemTaxa` (`"administracao" | "comissao_primeiro_aluguel"`) already has the exact two literal values the chip filter needs, the new filter-category type can be declared as `OrigemTaxa | "caucao"` instead of a fresh three-literal union — no separate `taxa.origem → categoria` mapping function is needed at all, and no `TipoCaucao → categoria` mapping function is needed either, because **all three** `TipoCaucao` subtypes collapse to the single literal `"caucao"` (D-02) — a constant, not a lookup.

The single most load-bearing finding from actually reading the code (not assuming) is that **zero data-layer change is required for D-05/D-06/D-07**. `buscarReconciliacaoAction` (`actions.ts:1976-2010`) already selects `cards(endereco, proprietario, numero, inquilino)` for both `taxas_imobiliaria` and `caucao_eventos` — `proprietario` and `inquilino` are already on every row reaching the client, a byproduct of Phase 19's own D-04 (`inquilino` was added then). The column swap is therefore JSX-only: read `linha.cards.proprietario` instead of `linha.cards.endereco` in the existing "Contrato" cell, and add one new `TableCell` reading `linha.cards.inquilino`. The `endereco` field must **not** be removed from any type (`LinhaLista`, `TaxaImobiliariaRelatorio.cards`, `CaucaoEventoRelatorio.cards`) — `reconciliacao-pdf.ts:161` (`` `#${l.cards?.numero ?? 0} ${l.cards?.endereco ?? ""}` `` ) still reads it for the PDF's "Contrato" column, unchanged per D-08/D-09.

D-08 is confirmed by direct read of `reconciliacao-pdf.ts` in full: its only inputs are `linhas` (a `LinhaListaPDF[]` shaped from `tipoLabel`/`cards`, no `tipo` JSX, no per-type branching anywhere in the module), `totais`, `filtro`, and `hojeISO`. It has zero knowledge of movement type beyond rendering whatever `tipoLabel` string it's handed — it already benefits automatically from any upstream filtering of `linhas`/`totais`, exactly as it already does for the 5 Phase-19 filter fields. **Zero code changes required in `reconciliacao-pdf.ts`.**

**Primary recommendation:** Add one field (`tipos: Set<TipoMovimentoReconciliacao>`) to `FiltroReconciliacaoValores`, one pure predicate (`passaFiltroTipoReconciliacao`) to `reconciliacao.ts`, one 4th parameter to `calcularReconciliacao`, one chip row to `filtro-reconciliacao.tsx` (mirroring the existing "Situação" row in `filtro-relatorio-financeiro-live.tsx` almost verbatim), one filter clause in each of the two `.filter()` chains inside `dinheiro-imobiliaria-view.tsx`'s `linhas` `useMemo`, one segment appended to the existing pipe-joined `resetKey`, and swap+add two `TableCell`s. No new package, no new Server Action, no new migration, no change to `reconciliacao-pdf.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chip UI rendering + click state (`FilterChip`, `toggle`) | Browser / Client | — | Pure React state in an already-`"use client"` component tree; no server round-trip (same pattern as the 5 existing filter fields since Phase 19) |
| Category mapping (`taxa.origem`/caução → `TipoMovimentoReconciliacao`) | Browser / Client | — | Pure function in `reconciliacao.ts`, imported only by the client component; module explicitly forbidden from importing `next/headers`/`@/lib/supabase/server` (see file header comment) |
| List filtering (`linhas` useMemo) | Browser / Client | — | Same `useMemo` that already filters by Imóvel/Proprietário/Inquilino/ID/Período (Phase 19) — one more `.filter()` clause in the same chain, still client-side over already-fetched data |
| StatTile total zeroing (`calcularReconciliacao`) | Browser / Client | — | Pure aggregation function, already client-only (module comment: "chamada só pelo componente cliente... nunca no servidor") |
| PDF generation | Browser / Client | — | `jsPDF`/`jspdf-autotable` run in-browser via dynamic `import()`; consumes whatever `linhas`/`totais` the client already computed — no server involvement, unchanged this phase |
| Data fetch (`cards(endereco, proprietario, numero, inquilino)`) | API / Backend | Database / Storage | Already complete since Phase 19 — `buscarReconciliacaoAction` (Server Action) already selects every field this phase needs; zero change required |

## Standard Stack

No new library is introduced by this phase. All components/functions reused are already installed and in production use since Phase 8–19:

| Library | Version | Purpose | Why Standard (for this codebase) |
|---------|---------|---------|-----------------------------------|
| React (`useState`/`useMemo`) | 19 (already in `package.json`) | Chip selection state, derived `linhas`/`totais` | Already the pattern for every other filter field in this component |
| `jspdf` / `jspdf-autotable` | already installed (used by `reconciliacao-pdf.ts` since Phase 19) | PDF export | Unchanged this phase — `reconciliacao-pdf.ts` is not touched |

**Installation:** none — no `npm install` needed for this phase.

**Version verification:** not applicable — no new package.

## Package Legitimacy Audit

**Not applicable.** This phase installs zero external packages. All code reuses existing, already-audited project modules (`FilterChip`/`toggle` from `reports-view.tsx`, `jspdf`/`jspdf-autotable` already in `package.json` since Phase 19). No `npm install` command appears anywhere in this research or in the resulting plan.

**Packages removed due to [SLOP] verdict:** none — no packages evaluated.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```
Browser (client component tree, all "use client")
┌─────────────────────────────────────────────────────────────────┐
│ DinheiroImobiliariaView                                          │
│                                                                    │
│  filtro: FiltroReconciliacaoValores  ←── setFiltro ──┐            │
│    { imovel, proprietario, inquilino, id, periodo,   │            │
│      tipos: Set<TipoMovimentoReconciliacao> }  ◄─────┤            │
│         │                                             │            │
│         │ passed as `campos`                          │ onChange   │
│         ▼                                             │            │
│  ┌─────────────────────────────┐                      │            │
│  │ FiltroReconciliacao          │──── click chip ──────┘            │
│  │ (5 text/period inputs        │                                   │
│  │  + NEW chip row: Todos/      │  uses FilterChip + toggle()       │
│  │  Administração/Comissão/     │  (imported from reports-view.tsx, │
│  │  Caução)                     │   unmodified)                     │
│  └─────────────────────────────┘                                   │
│         │                                                          │
│         ▼ filtro flows into:                                       │
│  ┌───────────────────────┐      ┌──────────────────────────────┐   │
│  │ linhas (useMemo)       │      │ totais = calcularReconciliacao│   │
│  │  taxas.filter(         │      │   (taxas, caucaoEventos,      │   │
│  │    periodo, cards,     │      │    periodo, tipos)  ← +1 arg  │   │
│  │    NEW: tipo)          │      │   zeroes categories whose     │   │
│  │  caucaoEventos.filter( │      │   chip is deselected (D-04)   │   │
│  │    periodo, cards,     │      └──────────────────────────────┘   │
│  │    NEW: tipo="caucao") │                   │                     │
│  └───────────────────────┘                    ▼                     │
│         │                              6× StatTile (screen)          │
│         ▼                                                            │
│  Table (Data / Contrato[IdPill+proprietario] / Inquilino / Tipo /    │
│         Valor / Observação)  ← D-05/D-06/D-07 JSX-only change        │
│         │                                                            │
│         ▼ (on "Exportar PDF" click)                                  │
│  exportarReconciliacaoPDF(linhas, totais, filtro, hojeISO)            │
│  reconciliacao-pdf.ts — UNCHANGED, consumes already-filtered data     │
└─────────────────────────────────────────────────────────────────┘
         ▲
         │ initial fetch, unchanged since Phase 19
Server Action: buscarReconciliacaoAction()
  .select("id, data, valor, origem, observacao,
           cards(endereco, proprietario, numero, inquilino)")   ← already has everything needed
```

### Recommended Project Structure

No new files. All changes land in existing files:
```
web/src/
├── lib/kanban/reconciliacao.ts              # + TipoMovimentoReconciliacao, passaFiltroTipoReconciliacao,
│                                             #   `tipos` field on FiltroReconciliacaoValores,
│                                             #   calcularReconciliacao gains a 4th param
├── components/reports/
│   ├── filtro-reconciliacao.tsx             # + chip row (mirrors filtro-relatorio-financeiro-live.tsx ~83-109)
│   ├── dinheiro-imobiliaria-view.tsx         # + filter clause in `linhas` useMemo (×2),
│   │                                         #   + resetKey segment, + calcularReconciliacao call arg,
│   │                                         #   Contrato cell: endereco→proprietario, + Inquilino TableCell/TableHead
│   └── reconciliacao-pdf.ts                 # UNCHANGED (D-08, verified in full this session)
```

### Pattern 1: Set-based multi-select filter, empty = "no filter"
**What:** A `Set<T>` of selected values where `size === 0` means "show everything," combined with a `toggle()` helper that adds/removes a value from the Set immutably.
**When to use:** Any multi-select chip row in this codebase — already used for `statusFilters`/`columnFilters` (`reports-view.tsx`) and `situacoes` (`relatorio-financeiro-dedicado.tsx`/`filtro-relatorio-financeiro-live.tsx`). Phase 20's `tipos` field is the fourth instance of this exact pattern.
**Example:**
```typescript
// Source: web/src/components/reports/reports-view.tsx:31-35 (read in full this session)
export function toggle<T>(current: Set<T>, value: T): Set<T> {
  const next = new Set(current)
  if (!next.delete(value)) next.add(value)
  return next
}
```
```typescript
// Source: web/src/components/reports/filtro-relatorio-financeiro-live.tsx:87-108 (read in full this session)
<FilterChip
  active={campos.situacoes.size === 0}
  onClick={() => onChange(() => ({ ...campos, situacoes: new Set() }))}
  className="font-semibold"
>
  Todas
</FilterChip>
{SITUACAO_OPTIONS.map((option) => (
  <FilterChip
    key={option.value}
    active={campos.situacoes.has(option.value)}
    onClick={() =>
      onChange((atual) => ({
        ...atual,
        situacoes: toggle(atual.situacoes, option.value),
      }))
    }
    className="font-semibold"
  >
    {option.label}
  </FilterChip>
))}
```

### Pattern 2: Category collapsing via superset union type (recommended for this phase)
**What:** `TipoMovimentoReconciliacao` should be declared `OrigemTaxa | "caucao"`, not a fresh 3-literal union. `OrigemTaxa` already contains the exact two string literals (`"administracao"`, `"comissao_primeiro_aluguel"`) the chip filter needs — reusing it means `taxa.origem` (type `OrigemTaxa`) is directly assignable to `TipoMovimentoReconciliacao` with zero conversion function, and a future third `OrigemTaxa` value (unlikely, but this is the kind of drift TypeScript unions protect against) would propagate automatically.
**When to use:** This phase's filter-category type specifically. No mapping function is needed for either source:
- Taxa side: `taxa.origem` (already `OrigemTaxa`) — pass straight through.
- Caução side: all three `TipoCaucao` values (`recebido`/`devolvido`/`usado`) collapse to the same literal — pass the string constant `"caucao"`, never `evento.tipo`.
**Example:**
```typescript
// Verified from web/src/lib/kanban/taxas.ts:13 (read in full this session):
// export type OrigemTaxa = "administracao" | "comissao_primeiro_aluguel"
// Verified from web/src/lib/kanban/taxas.ts:89 (read in full this session):
// export type TipoCaucao = "recebido" | "devolvido" | "usado"

// New, in reconciliacao.ts:
import type { OrigemTaxa, TipoCaucao } from "./taxas"

export type TipoMovimentoReconciliacao = OrigemTaxa | "caucao"

export function passaFiltroTipoReconciliacao(
  tipo: TipoMovimentoReconciliacao,
  tipos: Set<TipoMovimentoReconciliacao>
): boolean {
  if (tipos.size === 0) return true
  return tipos.has(tipo)
}
```

### Anti-Patterns to Avoid
- **Adding a `"todos"` literal to `TipoMovimentoReconciliacao`:** "Todos" is not a stored value — it's the empty-`Set` state, exactly like every other chip row in this codebase (`statusFilters`, `columnFilters`, `situacoes`). Clicking "Todos" must call `setFiltro` with `tipos: new Set()`, never insert a literal `"todos"` into the Set.
- **Building a `TipoCaucao → TipoMovimentoReconciliacao` lookup map:** unnecessary — D-02 collapses all three subtypes to the same constant. A lookup table here would be over-engineering for a value that's always `"caucao"` regardless of input.
- **Deleting `endereco` from `LinhaLista`/`TaxaImobiliariaRelatorio.cards`/`CaucaoEventoRelatorio.cards`:** D-07 removes it from the *screen*, not from the data. `reconciliacao-pdf.ts:161` still reads `linha.cards?.endereco` for the PDF's "Contrato" column — deleting the field would break the PDF export at compile time (and if the type were loosened instead of the field deleted, it would break silently at runtime with `undefined` printed into the PDF).
- **Passing `filtro` (the whole object) into `calcularReconciliacao` instead of just `filtro.tipos`:** the function's existing signature takes primitives/simple values (`taxas`, `caucaoEventos`, `periodo: string`) — keep the new 4th parameter as `tipos: Set<TipoMovimentoReconciliacao>`, matching the existing style rather than switching to a single `filtro` object, to keep the diff minimal and the function's `useMemo` dependency array precise (`[taxas, caucaoEventos, filtro.periodo, filtro.tipos]`, not the whole `filtro` object, to avoid depending on unrelated field changes — though note `filtro.tipos` itself changes identity on every toggle since it's rebuilt via `toggle()`, exactly like the other filter fields already do).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-select chip UI | A new chip/badge component | `FilterChip` (`reports-view.tsx`, exported, already used 3× in this codebase) | Byte-for-byte visual and interaction consistency with "Situação"/"Contrato"/"Coluna" rows; zero new CSS |
| Toggle-a-value-in-a-Set logic | Manual `Array.filter`/`includes` state juggling | `toggle<T>(current, value)` (`reports-view.tsx:31-35`, exported) | Already handles the add/delete-if-present branch correctly; reused 3× already |
| `resetKey` composition with a `Set` inside | Ad-hoc string concatenation of `[...set]` without sorting | `[...set].sort().join(",")` (this file's own existing pipe-joined style) or `JSON.stringify({...filtro, tipos: [...filtro.tipos].sort()})` (`relatorio-financeiro-dedicado.tsx:73-80` precedent) | Unsorted array serialization makes the key order-dependent — clicking chips in a different sequence to reach the same final Set would produce a different key, causing spurious pagination resets |

**Key insight:** every piece of this phase's UI/filter mechanics already has a direct, in-repo precedent shipped and confirmed working in production (Phase 8/10/19). There is no novel pattern to invent here — the work is mechanical extension, and the research risk is entirely about correctly locating and mirroring the existing precedent, not about external unknowns.

## Common Pitfalls

### Pitfall 1: Removing `endereco` from the data model instead of just the JSX
**What goes wrong:** D-07 says endereço "sai completamente da tela" — it's tempting to delete the `endereco` field from `LinhaLista`/`TaxaImobiliariaRelatorio.cards`/`CaucaoEventoRelatorio.cards` since nothing on screen reads it after the swap.
**Why it happens:** the instruction reads like a data requirement, but it's a presentation requirement — D-08/D-09 explicitly keep the PDF's `"#numero endereco"` column unchanged, and that PDF code reads `linha.cards?.endereco` (`reconciliacao-pdf.ts:161`, verified this session).
**How to avoid:** touch only the JSX in `dinheiro-imobiliaria-view.tsx`'s table cells. Leave every type (`LinhaLista`, `TaxaImobiliariaRelatorio`, `CaucaoEventoRelatorio`) and the Server Action's `.select(...)` string completely untouched — `endereco` stays wired end-to-end, just unrendered on screen.
**Warning signs:** a TypeScript error in `reconciliacao-pdf.ts` after editing `dinheiro-imobiliaria-view.tsx`/`reconciliacao.ts` is the tripwire — if `npx tsc --noEmit` fails there, `endereco` was removed from a shared type that shouldn't have changed.

### Pitfall 2: Forgetting to thread `filtro.tipos` into `calcularReconciliacao`'s call site
**What goes wrong:** adding the 4th parameter to `calcularReconciliacao`'s signature without updating the one call site in `dinheiro-imobiliaria-view.tsx:93-96` leaves the StatTiles un-zeroed (D-03/D-04 silently unmet) even though the list itself filters correctly.
**Why it happens:** the list filter (`linhas` useMemo) and the totals filter (`calcularReconciliacao`) are two separate `.filter()`/aggregation code paths reading the same `filtro` object — it's easy to update one and miss the other, especially since they're ~10 lines apart, not adjacent.
**How to avoid:** this is actually TypeScript-enforced — adding a required 4th parameter to `calcularReconciliacao` makes the existing 3-arg call site a compile error, so `npx tsc --noEmit` catches this automatically. Do NOT give the new parameter a default value (e.g. `tipos: Set<...> = new Set()`) — that would silence the compile-time catch and let the omission ship silently.
**Warning signs:** `npx tsc --noEmit` failing on `dinheiro-imobiliaria-view.tsx`'s `calcularReconciliacao(...)` call is expected and desired mid-edit — the fix is adding the argument, not adding a default.

### Pitfall 3: Two independent filter chains, easy to update only one
**What goes wrong:** the `linhas` `useMemo` builds `taxaLinhas` and `caucaoLinhas` as two separate `.filter().map()` pipelines (`dinheiro-imobiliaria-view.tsx:103-127`, read in full this session). The new type-filter clause must be added to **both** — a common mistake is adding `.filter((taxa) => passaFiltroTipoReconciliacao(taxa.origem, filtro.tipos))` to the taxa pipeline and forgetting the caução pipeline needs `.filter((evento) => passaFiltroTipoReconciliacao("caucao", filtro.tipos))` too (note: passing the constant `"caucao"`, not `evento.tipo`).
**Why it happens:** the two pipelines are visually similar and easy to pattern-match against each other, but the caução one needs a literal constant, not a per-row field read — a naive copy-paste of the taxa clause (`evento.origem` doesn't exist on `CaucaoEventoRelatorio`) would fail to compile, but a less naive copy-paste using `evento.tipo` directly (without mapping through D-02's collapse) would compile and silently produce per-subtype filtering instead of the single unified "Caução" category — a real bug, not caught by the type system.
**How to avoid:** write the caução-side filter clause as `passaFiltroTipoReconciliacao("caucao", filtro.tipos)` explicitly, with a comment referencing D-02, so a future editor doesn't "fix" it to read `evento.tipo`.
**Warning signs:** if selecting only the "Caução" chip still hides devolução/uso rows relative to what's expected, the caução filter clause is reading `evento.tipo` instead of the constant `"caucao"`.

### Pitfall 4: `resetKey` becoming order-sensitive
**What goes wrong:** appending `[...filtro.tipos].join(",")` (without `.sort()`) to the existing pipe-joined `resetKey` (`dinheiro-imobiliaria-view.tsx:143`) produces a different string for the same final selection depending on click order (e.g. clicking Administração-then-Caução vs. Caução-then-Administração), because `Set` iteration order follows insertion order, not a stable canonical order.
**Why it happens:** `Set` is not guaranteed insertion-order-stable across all removal/re-add sequences in a way a human would expect, and unlike an array the natural instinct is to iterate it directly.
**How to avoid:** mirror the existing in-repo precedent exactly — `reports-view.tsx:133`'s `contractsResetKey` already does `[...columnFilters].sort().join(",")` for this exact reason. Use `[...filtro.tipos].sort().join(",")` when appending to the pipe-joined `resetKey`.
**Warning signs:** pagination resetting to page 1 on a filter re-render where the *set of selected chips* didn't actually change (only click order did) is the observable symptom — low severity (UX annoyance, not data bug) but easy to avoid up front.

## Code Examples

Verified patterns from this project's own source (read in full this session — not external docs, since this phase introduces no new library):

### Extending `FiltroReconciliacaoValores` and `filtroReconciliacaoVazio`
```typescript
// web/src/lib/kanban/reconciliacao.ts — current state (lines 58-69, read in full this session):
// export type FiltroReconciliacaoValores = {
//   imovel: string
//   proprietario: string
//   inquilino: string
//   id: string
//   periodo: string
// }
// export function filtroReconciliacaoVazio(): FiltroReconciliacaoValores {
//   return { imovel: "", proprietario: "", inquilino: "", id: "", periodo: "" }
// }

// New:
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

### `calcularReconciliacao` gaining a 4th parameter (D-04)
```typescript
// web/src/lib/kanban/reconciliacao.ts — current signature (line 141-145, read in full this session):
// export function calcularReconciliacao(
//   taxas: TaxaImobiliariaRelatorio[],
//   caucaoEventos: CaucaoEventoRelatorio[],
//   periodo: string
// ): ReconciliacaoTotais {

export function calcularReconciliacao(
  taxas: TaxaImobiliariaRelatorio[],
  caucaoEventos: CaucaoEventoRelatorio[],
  periodo: string,
  tipos: Set<TipoMovimentoReconciliacao>
): ReconciliacaoTotais {
  let administracao = 0
  let comissao = 0
  let caucaoRecebida = 0
  let caucaoDevolvida = 0
  let caucaoUsada = 0

  for (const taxa of taxas) {
    if (!passaFiltroPeriodoReconciliacao(taxa.data, periodo)) continue
    if (!passaFiltroTipoReconciliacao(taxa.origem, tipos)) continue
    if (taxa.origem === "administracao") administracao += taxa.valor
    else comissao += taxa.valor
  }

  for (const evento of caucaoEventos) {
    if (!passaFiltroPeriodoReconciliacao(evento.data, periodo)) continue
    if (!passaFiltroTipoReconciliacao("caucao", tipos)) continue
    if (evento.tipo === "recebido") caucaoRecebida += evento.valor
    else if (evento.tipo === "devolvido") caucaoDevolvida += evento.valor
    else caucaoUsada += evento.valor
  }

  return {
    administracao,
    comissao,
    caucaoRecebida,
    caucaoDevolvida,
    caucaoUsada,
    totalRecebido: administracao + comissao + caucaoRecebida,
  }
}
```
Call site update in `dinheiro-imobiliaria-view.tsx:93-96`:
```typescript
const totais = React.useMemo(
  () => calcularReconciliacao(taxas, caucaoEventos, filtro.periodo, filtro.tipos),
  [taxas, caucaoEventos, filtro.periodo, filtro.tipos]
)
```

### `linhas` useMemo — both filter chains gain a clause (`dinheiro-imobiliaria-view.tsx:102-137`)
```typescript
const taxaLinhas: LinhaLista[] = taxas
  .filter((taxa) => passaFiltroPeriodoReconciliacao(taxa.data, filtro.periodo))
  .filter((taxa) => passaFiltroCardsReconciliacao(taxa.cards, filtro))
  .filter((taxa) => passaFiltroTipoReconciliacao(taxa.origem, filtro.tipos))
  .map((taxa) => ({ /* unchanged */ }))

const caucaoLinhas: LinhaLista[] = caucaoEventos
  .filter((evento) => passaFiltroPeriodoReconciliacao(evento.data, filtro.periodo))
  .filter((evento) => passaFiltroCardsReconciliacao(evento.cards, filtro))
  // D-02: every TipoCaucao subtype collapses to the same "caucao" category —
  // pass the constant, never `evento.tipo` (see Pitfall 3).
  .filter(() => passaFiltroTipoReconciliacao("caucao", filtro.tipos))
  .map((evento) => ({ /* unchanged */ }))
```
`useMemo` dependency array (`dinheiro-imobiliaria-view.tsx:137`) is already `[taxas, caucaoEventos, filtro]` (the whole `filtro` object, not individual fields) — no change needed there since `filtro.tipos` is part of `filtro`.

### `resetKey` composition (`dinheiro-imobiliaria-view.tsx:143`)
```typescript
// Current:
// const resetKey = `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}`

// New — appends the sorted, joined Set, mirroring reports-view.tsx:133's
// `[...columnFilters].sort().join(",")` (Pitfall 4):
const resetKey = `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}|${[...filtro.tipos].sort().join(",")}`
```

### Chip row in `filtro-reconciliacao.tsx` (mirrors `filtro-relatorio-financeiro-live.tsx:83-109`)
```typescript
// New imports at top of filtro-reconciliacao.tsx:
import { FilterChip, toggle } from "@/components/reports/reports-view"
import {
  filtroReconciliacaoVazio,
  type FiltroReconciliacaoValores,
  type TipoMovimentoReconciliacao,
} from "@/lib/kanban/reconciliacao"

const TIPO_MOVIMENTO_OPTIONS: { value: TipoMovimentoReconciliacao; label: string }[] = [
  { value: "administracao", label: "Administração" },
  { value: "comissao_primeiro_aluguel", label: "Comissão 1º aluguel" },
  { value: "caucao", label: "Caução" },
]

// Inserted after the existing grid of 5 <Input> fields (after line 100,
// `</div>` closing `grid grid-cols-[repeat(5,1fr)]`), before the
// `temFiltroPreenchido && (...)` block:
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
        onChange((atual) => ({
          ...atual,
          tipos: toggle(atual.tipos, option.value),
        }))
      }
      className="font-semibold"
    >
      {option.label}
    </FilterChip>
  ))}
</div>
```
`temFiltroPreenchido` (line 35-41) must gain the new field so "Limpar filtros" appears when only a type chip is active:
```typescript
const temFiltroPreenchido = Boolean(
  campos.imovel.trim() ||
    campos.proprietario.trim() ||
    campos.inquilino.trim() ||
    campos.id.trim() ||
    campos.periodo.trim() ||
    campos.tipos.size > 0
)
```

### Table column swap in `dinheiro-imobiliaria-view.tsx` (D-05/D-06/D-07)
```typescript
// Current header (lines 264-271, read in full this session):
// <TableHeader>
//   <TableRow>
//     <TableHead>Data</TableHead>
//     <TableHead>Contrato</TableHead>
//     <TableHead>Tipo</TableHead>
//     <TableHead className="text-right">Valor</TableHead>
//     <TableHead>Observação</TableHead>
//   </TableRow>
// </TableHeader>

// New:
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
```
```typescript
// Current "Contrato" cell (lines 279-286, read in full this session):
// <TableCell className="text-sm">
//   <div className="flex items-center gap-2">
//     <IdPill numero={linha.cards?.numero ?? 0} />
//     <span className="font-semibold text-foreground">
//       {linha.cards?.endereco ?? ""}
//     </span>
//   </div>
// </TableCell>

// New — same shape, endereco -> proprietario (D-05), plus a new Inquilino
// cell immediately after (D-06):
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
No change needed to `LinhaLista`'s type (`dinheiro-imobiliaria-view.tsx:55-68`) — it already carries `cards: { endereco, proprietario, numero, inquilino }`, all four fields, verified by reading the file in full this session.

## State of the Art

Not applicable — this phase makes no framework/library version change and follows patterns already established and shipped in this exact codebase across Phases 8, 10, and 19. There is no "old vs. new approach" axis here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chip label text "Administração"/"Comissão 1º aluguel"/"Caução" (not reusing `TAXA_ORIGEM[...].label` programmatically) — CONTEXT.md names these labels directly, and they match `TAXA_ORIGEM`'s existing labels (`taxa-origem-label.tsx:16,19`, verified this session) verbatim, but the plan sketch above hardcodes them as a local `TIPO_MOVIMENTO_OPTIONS` array rather than importing `TAXA_ORIGEM` to derive two of the three labels. | Code Examples — chip row | Low: purely cosmetic style choice (local literal array vs. derived from `TAXA_ORIGEM`), does not affect behavior; if the planner prefers deriving from `TAXA_ORIGEM` for DRY-ness that's a valid, lower-risk alternative — flagging only because CONTEXT.md itself doesn't specify which. |

**All other claims in this research are `[VERIFIED: <path>:<lines>]`** — every code snippet, type shape, and data-flow claim above was confirmed by reading the actual current-state source file in full during this session (not from training-data memory of the codebase, and not from grep alone). No `[CITED]` or unverified `[ASSUMED]` claims exist beyond A1 above, since this phase introduces no new external library, API, or documentation dependency.

## Open Questions

None blocking. The one open item from CONTEXT.md's "Claude's Discretion" — exact chip label wording and where the chip row sits relative to the 5 existing fields — is resolved above (mirror `filtro-relatorio-financeiro-live.tsx`'s "Situação" row placement: after the input grid, before the "Limpar filtros" conditional block) with HIGH confidence, since it's a direct precedent copy, not a novel decision.

## Environment Availability

Skipped — this phase has no new external dependency. `jspdf`/`jspdf-autotable` are already installed and already exercised by `reconciliacao-pdf.ts` in production since Phase 19; nothing about their availability changes in this phase.

## Security Domain

`security_enforcement` is enabled (`.planning/config.json`: `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No change to auth flow; `buscarReconciliacaoAction` already calls `requireUser()` (verified: `actions.ts:1983-1984`), unchanged this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | No new Server Action, no new RLS-scoped table access; the two `.select()` queries already used are unchanged byte-for-byte |
| V5 Input Validation | No new surface | The only new "input" is which `FilterChip` the user clicks, which sets a `Set<TipoMovimentoReconciliacao>` — a TypeScript union type constrained at compile time, never free text, and never serialized into a request (it stays in browser `useState`, consumed only by client-side pure functions). No new value reaches a database query, a Server Action argument, or a URL — the entire filter pipeline (Phase 19's 5 fields + this phase's chip Set) operates only over data already fetched under RLS |
| V6 Cryptography | No | Not applicable — no crypto involved |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| None new this phase | — | This phase adds zero new Server Action, zero new database query, and zero new value that flows from the browser back to the server. The `tipos: Set<...>` filter state is browser-memory-only, consumed exclusively by pure client-side filter/aggregation functions (`passaFiltroTipoReconciliacao`, `calcularReconciliacao`), and never reaches `buscarReconciliacaoAction` or any RLS-protected query. The existing RLS/allowlist boundary (documented in `PROJECT.md` Constraints) is unaffected because the underlying data fetch is byte-for-byte unchanged (`actions.ts:1986-2000`, verified this session) |

## Sources

### Primary (HIGH confidence — all `[VERIFIED]`, read in full this session)
- `.planning/phases/20-filtro-por-tipo-de-movimento-no-relat-rio-da-imobili-ria/20-CONTEXT.md` — locked decisions and discretion areas
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` — current post-Phase-19 state of the client component to modify (lines 1-308)
- `web/src/lib/kanban/reconciliacao.ts` — `FiltroReconciliacaoValores`, `passaFiltroCardsReconciliacao`, `calcularReconciliacao`, `ReconciliacaoTotais` (lines 1-181)
- `web/src/lib/kanban/taxas.ts` — `OrigemTaxa` (line 13), `TipoCaucao` (line 89)
- `web/src/components/financeiro/taxa-origem-label.tsx` — `TAXA_ORIGEM` labels (lines 15-22)
- `web/src/components/financeiro/caucao-evento-label.tsx` — `CAUCAO_TIPO` labels (lines 14-30)
- `web/src/components/reports/reports-view.tsx` — `FilterChip`, `toggle()`, `contractsResetKey` precedent (lines 31-64, 133)
- `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` — "Situação" chip row precedent (lines 83-109)
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` — `listaResetKey` `Set`-in-resetKey precedent (lines 69-80)
- `web/src/components/reports/filtro-reconciliacao.tsx` — component to extend with the new chip row (lines 1-115)
- `web/src/components/financeiro/id-pill.tsx` — `IdPill` component signature/usage (lines 19-39)
- `web/src/components/reports/reconciliacao-pdf.ts` — confirms D-08 (module has zero per-type logic, consumes pre-filtered `linhas`) (lines 1-204)
- `web/src/lib/kanban/actions.ts:1976-2010` — `buscarReconciliacaoAction`, confirms `proprietario`/`inquilino` are already selected server-side, zero data-layer change needed
- `web/CLAUDE.md`, `web/AGENTS.md` — project constraints (Next.js 16 breaking-changes warning, confirmed not applicable to this phase's scope)
- `.planning/config.json` — `workflow.nyquist_validation: false` (Validation Architecture section correctly omitted), `workflow.security_enforcement: true` (Security Domain section included)

### Secondary (MEDIUM confidence)
None — no web/documentation sources were needed for this phase; every claim traces to an in-repo file read this session.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — zero new dependency, all reused code read in full
- Architecture: HIGH — every file touched was read in full this session, not assumed from CONTEXT.md's description
- Pitfalls: HIGH — each pitfall derived from an actual code-reading discovery (e.g., two independent filter chains, PDF module's continued dependence on `endereco`), not speculative

**Research date:** 2026-08-28
**Valid until:** No expiry driver — this research has no external-library version dependency to go stale. Valid until the underlying files (`dinheiro-imobiliaria-view.tsx`, `reconciliacao.ts`, `filtro-reconciliacao.tsx`, `reconciliacao-pdf.ts`, `actions.ts`) change again in a future phase.
