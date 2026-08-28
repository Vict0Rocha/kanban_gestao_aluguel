# Phase 19: Filtro suspenso e exportação em PDF no relatório da imobiliária - Research

**Researched:** 2026-08-28
**Domain:** Client-side filtering + Server Action query widening + client-side PDF export, inside an existing Next.js 16 App Router / React 19 / TypeScript project (no new libraries, no schema change)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Padrão do filtro suspenso**
- **D-01:** O painel é **suspenso/colapsável visualmente** (mesmo shell `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` já usado em `web/src/components/financeiro/filtro-parcelas.tsx` e em `FiltroRelatorioFinanceiro`), mas o **comportamento é ao vivo** — cada campo atualiza a tela na hora, sem botão "Consultar"/"Gerar relatório". Isso é uma composição nova, não um reuso 1:1 de nenhum dos dois padrões suspensos existentes: usa a casca visual dos dois (`FiltroParcelas`/`FiltroRelatorioFinanceiro`), mas o comportamento reativo de `FiltroRelatorioFinanceiroLive`. Confirmado explicitamente pelo usuário depois de eu apresentar as duas opções (suspenso-com-botão vs. suspenso-ao-vivo) — ele escolheu a segunda.
- **D-02:** Toda a filtragem continua 100% client-side sobre o dado já carregado por `buscarReconciliacaoAction` (nenhuma mudança na forma como a página busca dado — só amplia o que a consulta já busca, ver D-04) — mesmo padrão já usado hoje pelo campo "Período".

**Campos do filtro**
- **D-03:** O painel tem cinco campos: **Imóvel** (texto livre, endereço), **Proprietário** (texto livre), **Inquilino** (texto livre), **ID do contrato** (número), e **Período** (mês — já existe hoje, só muda de posição, comportamento inalterado).
- **D-04:** `buscarReconciliacaoAction` (`web/src/lib/kanban/actions.ts`) precisa ampliar as duas consultas (`taxas_imobiliaria` e `caucao_eventos`) para incluir `inquilino` no embed `cards(...)` — hoje busca só `endereco, proprietario, numero`. Confirmado explicitamente pelo usuário depois de eu apontar que "Inquilino" não é buscado hoje por esta tela — mudança pequena e aditiva (mais um campo num `.select()` já existente), sem migração de banco. `TaxaImobiliariaRelatorio`/`CaucaoEventoRelatorio` (`web/src/lib/kanban/reconciliacao.ts`) precisam do campo `inquilino` no tipo do embed `cards`. ID do contrato (`numero`) já é buscado hoje — nenhuma mudança de consulta necessária para esse campo.

**PDF**
- **D-05:** O PDF exportado espelha a estrutura do PDF já existente do Relatório Financeiro (`web/src/components/reports/relatorio-financeiro-pdf.ts`, gerado com `jsPDF`+`jspdf-autotable`, import dinâmico dentro da função — nunca no topo do módulo, mesmo pitfall documentado lá): cabeçalho com os filtros ativos (Imóvel/Proprietário/Inquilino/ID do contrato/Período — "Todos" quando vazio, mesmo padrão), um bloco com os totais (os mesmos 6 valores já mostrados pelos `StatTile` em tela: Administração, Comissão 1º aluguel, Total recebido, Caução recebida/devolvida/usada), e a lista completa (taxas+caução unificada, já ordenada) em tabela — mesmas cores/fontes/rodapé do "PDF Export Layout Contract" já em uso. Confirmado explicitamente pelo usuário.
- **D-06:** Botão "Exportar PDF" (mesmo texto/posição relativa do botão já existente em `relatorio-financeiro-dedicado.tsx`), estado `exportando`/"Exportando..." durante a geração — mesmo padrão.

### Claude's Discretion
- Nome exato do novo módulo de exportação PDF (ex.: `reconciliacao-pdf.ts`, espelhando `relatorio-financeiro-pdf.ts`) e da função exportada.
- Posicionamento exato do painel suspenso na tela (canto superior esquerdo, como em `reports-view.tsx`, vs. outra posição que faça mais sentido no layout atual de `dinheiro-imobiliaria-view.tsx`, que hoje só tem o campo Período solto no canto direito).
- Se o filtro por "ID do contrato" aceita só dígitos (mesmo padrão de `FiltroParcelas`) ou texto livre comparado contra `numero` convertido pra string.
- Nome exato do arquivo do PDF gerado (mirar `relatorio-financeiro-${hojeISO}.pdf` — algo como `dinheiro-imobiliaria-${hojeISO}.pdf` ou `reconciliacao-${hojeISO}.pdf`).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

## Summary

This phase touches exactly four files and adds two small new ones — nothing else. It widens `buscarReconciliacaoAction`'s two `.select()` calls to include `inquilino` (a field that already exists on `cards`, nullable, no schema change), threads that field through `reconciliacao.ts`'s embedded `cards` type, adds a five-field client-side live filter panel to `dinheiro-imobiliaria-view.tsx`, and adds a PDF export module that mirrors `relatorio-financeiro-pdf.ts` byte-for-byte in structure with this screen's own data shapes.

**Important correction to the phase framing in `19-CONTEXT.md`/`STATE.md`:** both documents describe the "suspenso shell + live behavior" combination as a composition that "does not exist anywhere else in the codebase yet." Reading `web/src/components/reports/relatorio-financeiro-dedicado.tsx` in full (as the canonical refs required) shows this combination **already exists and already ships in production**: that component wraps `<Collapsible open={aberto} onOpenChange={setAberto}>` / `<CollapsibleTrigger>` around `<CollapsiblePanel><FiltroRelatorioFinanceiroLive campos={filtro} onChange={setFiltro} /></CollapsiblePanel>` — exactly the suspenso shell (D-01's first half) wrapping the live, no-submit-button field behavior (D-01's second half). This phase is not inventing a new composition; it is a **direct, mechanical copy** of a pattern already proven in this exact codebase (Phase 10, RELDED-05, in production since 2026-08-21). This lowers the risk/complexity of D-01 considerably and should shape how the planner scopes the corresponding task (copy-adapt, not design-from-scratch).

**Primary recommendation:** Copy the `relatorio-financeiro-dedicado.tsx` + `filtro-relatorio-financeiro-live.tsx` + `relatorio-financeiro-pdf.ts` trio almost mechanically: (1) widen the two `.select()` calls and the two embed types (additive, four lines total), (2) add a new pure module `filtroReconciliacaoVazio`/`FiltroReconciliacaoValores`/two matcher functions co-located in `reconciliacao.ts` (same "one file per report" convention already documented there), (3) add a new client component `FiltroReconciliacao` mirroring `FiltroRelatorioFinanceiroLive`'s shape (5 inputs instead of 3+chips, no `Collapsible` of its own — the parent supplies it, same as the Phase 10 precedent), (4) add `reconciliacao-pdf.ts` mirroring `relatorio-financeiro-pdf.ts` block-for-block with this screen's 6 totals and unified list. Zero new npm dependencies, zero database migration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Widen `taxas_imobiliaria`/`caucao_eventos` embed to include `inquilino` | API / Backend (Server Action) | Database (read-only, no schema change) | `buscarReconciliacaoAction` already owns this query; `inquilino` is an existing nullable column on `cards`, no migration needed |
| Five-field live filter (Imóvel/Proprietário/Inquilino/ID/Período) | Browser / Client | — | 100% in-memory filter over already-loaded data, same tier as the existing `periodo` filter (D-02) |
| Collapsible panel open/close state | Browser / Client | — | Local `React.useState`, same as every other `Collapsible` usage in this codebase (`aberto`/`setAberto`) |
| PDF generation | Browser / Client | — | `jsPDF`/`jspdf-autotable` run entirely client-side via dynamic `import()`; no server round-trip, same as `relatorio-financeiro-pdf.ts` |
| Pagination reset on filter change | Browser / Client | — | `usePagination`'s `resetKey`, purely a client-side identity comparison |

## Standard Stack

### Core
No new libraries. This phase reuses, unchanged in version:

| Library | Version (verified in `web/package.json`) | Purpose | Why Standard (in this codebase) |
|---------|---------|---------|--------------|
| `jspdf` | `^4.2.1` | PDF document generation, client-side | Already the sole PDF engine in this codebase (`relatorio-financeiro-pdf.ts`) — reusing avoids a second PDF stack for a near-identical use case |
| `jspdf-autotable` | `^5.0.8` | Table layout inside the jsPDF document | Paired with `jspdf` for every tabular block (header/summary/list) in the existing PDF module |
| `@base-ui/react` (Collapsible) | already in `package.json` (used by `web/src/components/ui/collapsible.tsx`) | Collapsible primitive underlying every "filtro suspenso" panel in this codebase | Already the sole collapsible primitive in the design system |

**Installation:** None. `npm install` is not needed for this phase — confirmed by reading `web/package.json` (`jspdf`/`jspdf-autotable` already present as production dependencies) `[VERIFIED: web/package.json]`.

### Supporting
| Module | Purpose | When to Use |
|---------|---------|-------------|
| `web/src/lib/kanban/search.ts` (`normalizeText`) | Accent-insensitive substring matching, `NFD` + strip combining marks + lowercase | Text-field matching (Imóvel/Proprietário/Inquilino) — see Open Question 2 below for the recommended vs. alternative pattern |
| `web/src/components/pagination.tsx` (`usePagination`, `Pagination`) | Client-side pagination, 12 items/page, `resetKey`-driven reset | Already wired into `dinheiro-imobiliaria-view.tsx`; only the `resetKey` composition changes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Copying `relatorio-financeiro-pdf.ts`'s structure into a new module | Making the existing module generic/parameterized for both reports | Would touch a file (`relatorio-financeiro-pdf.ts`) outside this phase's declared boundary and risk regressing Phase 10's already-verified PDF (`RELDED-05`, confirmed in production) for no user-visible benefit — the two reports' data shapes (`ParcelaRelatorio[]` vs. `LinhaLista[]`) are different enough that a shared abstraction would need generics/casting, adding risk without reducing code meaningfully (each module is ~190 lines, ~70% boilerplate specific to its own columns) |
| `normalizeText` (search.ts) for text matching | `passaFiltroTexto` (plain `.toLowerCase().includes()`, from `relatorio-financeiro.ts`) | See Open Question 2 — both are real precedents in this codebase; recommendation given below |

## Package Legitimacy Audit

Not applicable — **zero new packages** are installed by this phase. `jspdf` and `jspdf-autotable` are already present in `web/package.json` as direct dependencies (`^4.2.1` / `^5.0.8`), already vetted and in production use since Phase 10 (2026-08-21). No `npm install` command appears anywhere in this phase's task list.

## Architecture Patterns

### System Architecture Diagram

```
Server Component (page.tsx, unchanged shape)
  │
  │  await buscarReconciliacaoAction()
  ▼
Server Action (actions.ts) — WIDENED (D-04)
  .select("id, data, valor, origem, observacao,
           cards(endereco, proprietario, numero, inquilino)")   ← +inquilino
  .select("id, data, valor, tipo, observacao,
           cards(endereco, proprietario, numero, inquilino)")   ← +inquilino
  │
  │  taxas[], caucaoEventos[], hojeISO  (RLS already scoped to session, unchanged)
  ▼
DinheiroImobiliariaView (client component)
  │
  ├─ filtro: FiltroReconciliacaoValores  (imovel, proprietario, inquilino, id, periodo)
  │     ▲ onChange, live, no submit button (D-01/D-02)
  │     │
  │  ┌──┴─────────────────────────────┐
  │  │ FiltroReconciliacao (new)      │  ← Collapsible/CollapsiblePanel shell
  │  │ (mirrors FiltroRelatorioFinanceiroLive shape,
  │  │  wrapped by parent's Collapsible — same as
  │  │  relatorio-financeiro-dedicado.tsx already does)
  │  └─────────────────────────────────┘
  │
  ├─ linhas = useMemo(taxas, caucaoEventos, filtro)      ← in-memory filter+merge+sort (unchanged shape, now 5-field)
  ├─ totais = useMemo(calcularReconciliacao(...))         ← unchanged
  ├─ resetKey = composed 5-field string                   ← usePagination(linhas, resetKey)
  │
  └─ "Exportar PDF" button → handleExportarPDF()
        │
        │  exportarReconciliacaoPDF(linhas, totais, filtro, hojeISO)
        ▼
     reconciliacao-pdf.ts (new, plain module — NOT "use client")
        dynamic import("jspdf") + import("jspdf-autotable")  ← only inside the function (Pitfall #3, RELDED precedent)
        header (title + timestamp) → filtro table (5 rows) → totals table (6 rows) → list table (autoTable, showHead:"everyPage") → footer (every page)
        doc.save(`dinheiro-imobiliaria-${hojeISO}.pdf`)
```

### Recommended Project Structure
No new directories. Two new files, both siblings of their mirrored counterparts:
```
web/src/lib/kanban/
└── reconciliacao.ts               # EXTEND: + FiltroReconciliacaoValores, filtroReconciliacaoVazio,
                                    #          passaFiltroTextoReconciliacao, passaFiltroIdReconciliacao

web/src/components/reports/
├── dinheiro-imobiliaria-view.tsx  # MODIFY: Collapsible shell, filtro state, resetKey, Exportar PDF button
├── filtro-reconciliacao.tsx       # NEW: 5-field live filter body (no own Collapsible — parent supplies it)
└── reconciliacao-pdf.ts           # NEW: mirrors relatorio-financeiro-pdf.ts structure
```

### Pattern 1: Suspenso shell + live behavior (already proven — Phase 10 precedent)
**What:** `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` wraps a filter body whose fields write directly to parent state on every `onChange`, with no "Consultar"/"Gerar" button.
**When to use:** Exactly this phase's D-01. Already shipped and verified in production at `relatorio-financeiro-dedicado.tsx` (RELDED-05, confirmed 2026-08-21).
**Example (verbatim structure from the existing, shipped component):**
```tsx
// Source: web/src/components/reports/relatorio-financeiro-dedicado.tsx:126-185 (read this session)
<Collapsible open={aberto} onOpenChange={setAberto}>
  <div className="flex flex-wrap items-center justify-between gap-4">
    {/* ...left side content... */}
    <div className="flex items-center gap-2">
      <CollapsibleTrigger
        render={
          <Button variant="outline" size="sm">
            {aberto ? <X className="size-3.5" /> : <Filter className="size-3.5" />}
            {aberto ? "Fechar filtros" : "Filtrar"}
          </Button>
        }
      />
      <Button variant="default" onClick={handleExportarPDF} disabled={exportando}>
        <FileDown className="size-3.5" />
        {exportando ? "Exportando..." : "Exportar PDF"}
      </Button>
    </div>
  </div>

  <CollapsiblePanel>
    <FiltroRelatorioFinanceiroLive campos={filtro} onChange={setFiltro} />
  </CollapsiblePanel>
</Collapsible>
```
Apply this unchanged to `dinheiro-imobiliaria-view.tsx`, swapping `FiltroRelatorioFinanceiroLive` for the new `FiltroReconciliacao`.

### Pattern 2: Live filter field body (no own Collapsible/no submit button)
**What:** A plain `"use client"` component receiving `campos`/`onChange` props, each input writing straight into parent state via an updater function.
**Example (verbatim structure, adapt field count 3→5):**
```tsx
// Source: web/src/components/reports/filtro-relatorio-financeiro-live.tsx:26-38 (read this session)
export function FiltroRelatorioFinanceiroLive({
  campos,
  onChange,
}: {
  campos: FiltroRelatorioValores
  onChange: (updater: (atual: FiltroRelatorioValores) => FiltroRelatorioValores) => void
}) {
  function atualizarCampo(
    campo: "imovel" | "proprietario" | "periodo",
    valor: string
  ) {
    onChange((atual) => ({ ...atual, [campo]: valor }))
  }
  // ...5 inputs instead of 3, same shape, for the new component
```

### Pattern 3: Widened `.select()` embed — verified exact current text
```ts
// Source: web/src/lib/kanban/actions.ts:1986-1994 (read this session)
const { data: taxas, error: erroTaxas } = await sessao.supabase
  .from("taxas_imobiliaria")
  .select("id, data, valor, origem, observacao, cards(endereco, proprietario, numero)")

if (erroTaxas) return { ok: false, error: erroDoBanco(erroTaxas.code, "carregar o relatório") }

const { data: caucaoEventos, error: erroCaucao } = await sessao.supabase
  .from("caucao_eventos")
  .select("id, data, valor, tipo, observacao, cards(endereco, proprietario, numero)")
```
Widened form (add `inquilino` to both embeds only):
```ts
.select("id, data, valor, origem, observacao, cards(endereco, proprietario, numero, inquilino)")
// ...
.select("id, data, valor, tipo, observacao, cards(endereco, proprietario, numero, inquilino)")
```

### Anti-Patterns to Avoid
- **Re-sorting the PDF list ascending:** `dinheiro-imobiliaria-view.tsx:91-98` documents a *deliberate* divergence from `relatorio-financeiro-lista.tsx`'s ascending order — this report is DESC (most recent first). The PDF module must consume `linhas` as already ordered by the view, never re-sort or import the ASC comparator from the Relatório Financeiro side.
- **Passing raw `React.ReactNode` (`linha.tipo`) into jsPDF/autotable:** `autoTable`'s `body` cells must be strings/numbers, not JSX. See Pitfall 2 below.
- **Importing a UI/label component from a PDF module:** `relatorio-financeiro-pdf.ts` never imports from `components/*` label components — it locally redefines its own `SITUACAO_ROTULO_PLURAL`/`SINGULAR` maps (`relatorio-financeiro-pdf.ts:45-58`). Mirror this: compute the plain-text label in the view (which already imports `TAXA_ORIGEM`/`CAUCAO_TIPO`) and pass it down as data, not as an import inside the new PDF module.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accent-insensitive text matching | A second `normalize`/strip-accents implementation | `normalizeText` (`web/src/lib/kanban/search.ts:8-13`, already exported, zero server imports) | Already correct (NFD + `\p{M}` strip + lowercase), already the pattern chosen in the most recent sibling phase (18, `configuracao-financeira-view.tsx:48-51`) |
| PDF page/table layout, page-break-aware repeating headers | Manual `doc.text()` loops with manual Y-position tracking across page breaks | `jspdf-autotable`'s `autoTable(doc, {...})` with `showHead: "everyPage"` | Already the only PDF table mechanism in this codebase; hand-rolled pagination would have to reimplement `jspdf-autotable`'s page-break detection, which the existing module explicitly chose not to disable (`relatorio-financeiro-pdf.ts:203-215`) |
| Client-side pagination with a bounded page-number window | A new pagination component for this screen | `usePagination`/`Pagination` (`web/src/components/pagination.tsx`, already imported by `dinheiro-imobiliaria-view.tsx`) | Already shared across all 6 non-Board listings (PAGIN-01..03, Phase 15) — only the `resetKey` argument changes for this phase |

**Key insight:** Every piece this phase needs — collapsible shell, live filter body, accent-insensitive matcher, PDF table engine, pagination — already has exactly one canonical implementation in this codebase. The work here is composition and copy-adaptation, not new engineering.

## Common Pitfalls

### Pitfall 1: Top-of-module import of `jspdf`/`jspdf-autotable` breaks SSR
**What goes wrong:** `relatorios/imobiliaria/page.tsx` is a Server Component by default; if the new PDF module imports `jspdf`/`jspdf-autotable` at module top level, the import executes during server rendering and breaks (documented at `relatorio-financeiro-pdf.ts:11-17`, "RESEARCH.md Pitfall #3").
**Why it happens:** `jspdf`/`jspdf-autotable` reference browser globals not present in the Node/Edge SSR environment.
**How to avoid:** `const { jsPDF } = await import("jspdf")` and `const { autoTable } = await import("jspdf-autotable")` **inside** the exported async function only, exactly as `relatorio-financeiro-pdf.ts:67-68` does. Never a static `import` at the top of the new `reconciliacao-pdf.ts`.
**Warning signs:** Build/runtime error referencing `document`/`window`/`btoa` undefined during SSR of `/relatorios/imobiliaria`.

### Pitfall 2: `linha.tipo` is JSX, not a string — the PDF list can't consume it directly
**What goes wrong:** `LinhaLista.tipo` (`dinheiro-imobiliaria-view.tsx:40`) is typed `React.ReactNode` and holds a `<TaxaOrigemBadge .../>` or `<CaucaoEventoLabel .../>` element. Passing this straight into `autoTable`'s `body` array (which expects strings/numbers per cell) will render `[object Object]` or throw.
**Why it happens:** The on-screen table renders `tipo` as JSX in a `<TableCell>`; the PDF table needs a plain string for the same conceptual value.
**How to avoid:** Extend `LinhaLista` with a parallel `tipoLabel: string` field, populated from the same label source maps already imported by the view — `TAXA_ORIGEM[taxa.origem].label` (`web/src/components/financeiro/taxa-origem-label.tsx:15-22`, values `"Administração"`/`"Comissão 1º aluguel"`) and `CAUCAO_TIPO[evento.tipo].label` (`web/src/components/financeiro/caucao-evento-label.tsx:14-30`, values `"Recebida"`/`"Devolvida"`/`"Usada"`). Pass `linhas` (with both `tipo` and `tipoLabel`) to the PDF function; the PDF function reads only `tipoLabel`.
**Warning signs:** PDF table's "Tipo" column showing `[object Object]` or blank cells.

### Pitfall 3: `doc.getNumberOfPages()` is a top-level `jsPDF` method, not `doc.internal.getNumberOfPages()`
**What goes wrong:** Copying the footer loop from memory/older docs may reach for `doc.internal.getNumberOfPages()`, which the installed `jspdf@4.2.1` does not expose that way.
**Why it happens:** Already documented in the existing module as a correction of a stale citation in `10-UI-SPEC.md`/an earlier `10-RESEARCH.md` — confirmed against `jspdf/types/index.d.ts` in the actually-installed package (`relatorio-financeiro-pdf.ts:224-228`).
**How to avoid:** `const totalPaginas = doc.getNumberOfPages()` (no `.internal`), exactly as the existing module does.
**Warning signs:** TypeScript error "Property 'getNumberOfPages' does not exist on type..." if reached through `.internal`.

### Pitfall 4: `headerRows` is not a real `jspdf-autotable` option in the installed version
**What goes wrong:** Some documentation/plans reference `headerRows: 1` to force the header to repeat on every page. The installed `jspdf-autotable@5.0.8` has no such property (confirmed by the existing module's author reading `dist/index.d.ts` directly, `relatorio-financeiro-pdf.ts:203-214`).
**How to avoid:** Use `showHead: "everyPage"` explicitly (this is already the library default in `5.0.8`, but declaring it protects against a future accidental disable).
**Warning signs:** TypeScript error on an unrecognized `UserOptions` property, or (if using `any`) a silent no-op.

### Pitfall 5: `inquilino` is nullable — must be defended in both the matcher and the PDF
**What goes wrong:** `cards.inquilino` is `text` with no `NOT NULL` constraint (`supabase/migrations/20260728000000_init_schema.sql:68`, `inquilino text,`) — some contracts legitimately have no `inquilino` value. A matcher or PDF cell that assumes `cards.inquilino` is always a string will crash on `.toLowerCase()`/`.includes()` calls against `null`.
**How to avoid:** Always read through `cards?.inquilino ?? ""` before normalizing/matching or rendering, same defensive pattern already used for `endereco`/`proprietario` throughout `dinheiro-imobiliaria-view.tsx` (`linha.cards?.endereco ?? ""`, line 180) and `relatorio-financeiro.ts` (`p.cards?.endereco ?? ""`, line 85).
**Warning signs:** `TypeError: Cannot read properties of null (reading 'toLowerCase')` at runtime for any contract lacking an `inquilino` value.

### Pitfall 6: Resetting `usePagination`'s page on every `router.refresh()`, not just on real filter changes
**What goes wrong:** `15-RESEARCH.md` Pitfall 3 (referenced in `pagination.tsx:27-34`) documents that a `resetKey` must be a pure identity of the *filter*, never something that also changes on unrelated re-renders/mutations — otherwise an unrelated data refresh silently kicks the user back to page 1.
**How to avoid:** Compose the new `resetKey` purely from the 5 filter field values (`` `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}` ``, mirroring `reports-view.tsx:133`'s `contractsResetKey` — a plain pipe-joined string of raw field values). Do not derive it from `taxas`/`caucaoEventos`/`linhas` (those change on every underlying data refresh, not just on filter changes).
**Warning signs:** Page silently resets to 1 after an unrelated action elsewhere in the app triggers a `router.refresh()` on this route (none currently do for this specific page, but the pattern must not introduce this class of bug).

## Code Examples

### 1. Widened Server Action query (`web/src/lib/kanban/actions.ts`, around line 1986)
```ts
// BEFORE (verified verbatim, actions.ts:1986-1994):
const { data: taxas, error: erroTaxas } = await sessao.supabase
  .from("taxas_imobiliaria")
  .select("id, data, valor, origem, observacao, cards(endereco, proprietario, numero)")

if (erroTaxas) return { ok: false, error: erroDoBanco(erroTaxas.code, "carregar o relatório") }

const { data: caucaoEventos, error: erroCaucao } = await sessao.supabase
  .from("caucao_eventos")
  .select("id, data, valor, tipo, observacao, cards(endereco, proprietario, numero)")

// AFTER — only the embed widens, nothing else in this function changes:
const { data: taxas, error: erroTaxas } = await sessao.supabase
  .from("taxas_imobiliaria")
  .select(
    "id, data, valor, origem, observacao, cards(endereco, proprietario, numero, inquilino)"
  )

if (erroTaxas) return { ok: false, error: erroDoBanco(erroTaxas.code, "carregar o relatório") }

const { data: caucaoEventos, error: erroCaucao } = await sessao.supabase
  .from("caucao_eventos")
  .select(
    "id, data, valor, tipo, observacao, cards(endereco, proprietario, numero, inquilino)"
  )
```

### 2. Widened embed types (`web/src/lib/kanban/reconciliacao.ts`, lines 16-32)
```ts
// BEFORE (verified verbatim):
export type TaxaImobiliariaRelatorio = {
  id: string
  data: string
  valor: number
  origem: OrigemTaxa
  observacao: string | null
  cards: { endereco: string; proprietario: string; numero: number } | null
}

export type CaucaoEventoRelatorio = {
  id: string
  data: string
  valor: number
  tipo: TipoCaucao
  observacao: string | null
  cards: { endereco: string; proprietario: string; numero: number } | null
}

// AFTER — inquilino added, nullable (cards.inquilino is `text`, no NOT NULL —
// supabase/migrations/20260728000000_init_schema.sql:68, `inquilino text,`):
export type TaxaImobiliariaRelatorio = {
  id: string
  data: string
  valor: number
  origem: OrigemTaxa
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
}

export type CaucaoEventoRelatorio = {
  id: string
  data: string
  valor: number
  tipo: TipoCaucao
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
}
```

### 3. New filter type + matchers (add to `web/src/lib/kanban/reconciliacao.ts`, same "one file per report" convention already documented at the top of that file)
```ts
import { normalizeText } from "./search"

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

/** Campo vazio nunca filtra. Accent-insensitive — ver Open Question 2. */
export function passaFiltroTextoReconciliacao(valor: string, filtro: string): boolean {
  const alvo = normalizeText(filtro.trim())
  if (!alvo) return true
  return normalizeText(valor).includes(alvo)
}

/** Mesmo padrão de financeiro/page.tsx:64-65 — id não numérico é ignorado
 *  (comparação exata, não substring), nunca derruba o filtro. */
export function passaFiltroIdReconciliacao(numero: number, filtro: string): boolean {
  const digitos = filtro.trim()
  if (!digitos) return true
  const alvo = Number.isInteger(Number(digitos)) ? Number(digitos) : null
  return alvo !== null && numero === alvo
}

/** Composição única dos 4 campos derivados de `cards` — reusada tanto para
 *  taxaLinhas quanto para caucaoLinhas dentro do useMemo de `linhas`. */
export function passaFiltroCardsReconciliacao(
  cards: { endereco: string; proprietario: string; numero: number; inquilino: string | null } | null,
  filtro: FiltroReconciliacaoValores
): boolean {
  if (!passaFiltroTextoReconciliacao(cards?.endereco ?? "", filtro.imovel)) return false
  if (!passaFiltroTextoReconciliacao(cards?.proprietario ?? "", filtro.proprietario)) return false
  if (!passaFiltroTextoReconciliacao(cards?.inquilino ?? "", filtro.inquilino)) return false
  if (!passaFiltroIdReconciliacao(cards?.numero ?? -1, filtro.id)) return false
  return true
}
```

### 4. New live filter component (`web/src/components/reports/filtro-reconciliacao.tsx`, new file)
```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  filtroReconciliacaoVazio,
  type FiltroReconciliacaoValores,
} from "@/lib/kanban/reconciliacao"

// Mirrors filtro-relatorio-financeiro-live.tsx's shape (campos/onChange props,
// no own Collapsible — the parent, dinheiro-imobiliaria-view.tsx, supplies
// Collapsible/CollapsibleTrigger/CollapsiblePanel exactly as
// relatorio-financeiro-dedicado.tsx already does for FiltroRelatorioFinanceiroLive).
export function FiltroReconciliacao({
  campos,
  onChange,
}: {
  campos: FiltroReconciliacaoValores
  onChange: (
    updater: (atual: FiltroReconciliacaoValores) => FiltroReconciliacaoValores
  ) => void
}) {
  function atualizarCampo(
    campo: "imovel" | "proprietario" | "inquilino" | "id" | "periodo",
    valor: string
  ) {
    onChange((atual) => ({ ...atual, [campo]: valor }))
  }

  const temFiltroPreenchido = Boolean(
    campos.imovel.trim() ||
      campos.proprietario.trim() ||
      campos.inquilino.trim() ||
      campos.id.trim() ||
      campos.periodo.trim()
  )

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card px-5 py-4">
      <div className="grid grid-cols-[repeat(5,1fr)] gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-imovel">Imóvel</Label>
          <Input
            id="filtro-reconc-imovel"
            type="text"
            placeholder="Endereço do imóvel"
            value={campos.imovel}
            onChange={(e) => atualizarCampo("imovel", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-proprietario">Proprietário</Label>
          <Input
            id="filtro-reconc-proprietario"
            type="text"
            placeholder="Nome do proprietário"
            value={campos.proprietario}
            onChange={(e) => atualizarCampo("proprietario", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-inquilino">Inquilino</Label>
          <Input
            id="filtro-reconc-inquilino"
            type="text"
            placeholder="Nome do inquilino"
            value={campos.inquilino}
            onChange={(e) => atualizarCampo("inquilino", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-id">ID do contrato</Label>
          <Input
            id="filtro-reconc-id"
            type="text"
            inputMode="numeric"
            placeholder="Ex: 12"
            value={campos.id}
            onChange={(e) => atualizarCampo("id", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="filtro-reconc-periodo">Período</Label>
          <Input
            id="filtro-reconc-periodo"
            type="month"
            value={campos.periodo}
            onChange={(e) => atualizarCampo("periodo", e.target.value)}
          />
        </div>
      </div>

      {temFiltroPreenchido && (
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            onClick={() => onChange(() => filtroReconciliacaoVazio())}
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
```

### 5. `dinheiro-imobiliaria-view.tsx` composition (key changes only)
```tsx
// LinhaLista gains tipoLabel (plain string, for the PDF — see Pitfall 2) and
// widens cards.inquilino:
type LinhaLista = {
  id: string
  data: string
  valor: number
  tipo: React.ReactNode
  tipoLabel: string
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null
  } | null
}

// State: filtro replaces the bare `periodo` state
const [filtro, setFiltro] = React.useState<FiltroReconciliacaoValores>(
  filtroReconciliacaoVazio()
)
const [aberto, setAberto] = React.useState(false)
const [exportando, setExportando] = React.useState(false)

const totais = React.useMemo(
  () => calcularReconciliacao(taxas, caucaoEventos, filtro.periodo),
  [taxas, caucaoEventos, filtro.periodo]
)

const linhas = React.useMemo<LinhaLista[]>(() => {
  const taxaLinhas: LinhaLista[] = taxas
    .filter((taxa) => passaFiltroPeriodoReconciliacao(taxa.data, filtro.periodo))
    .filter((taxa) => passaFiltroCardsReconciliacao(taxa.cards, filtro))
    .map((taxa) => ({
      id: taxa.id,
      data: taxa.data,
      valor: taxa.valor,
      tipo: <TaxaOrigemBadge origem={taxa.origem} />,
      tipoLabel: TAXA_ORIGEM[taxa.origem].label,
      observacao: taxa.observacao,
      cards: taxa.cards,
    }))

  const caucaoLinhas: LinhaLista[] = caucaoEventos
    .filter((evento) => passaFiltroPeriodoReconciliacao(evento.data, filtro.periodo))
    .filter((evento) => passaFiltroCardsReconciliacao(evento.cards, filtro))
    .map((evento) => ({
      id: evento.id,
      data: evento.data,
      valor: evento.valor,
      tipo: <CaucaoEventoLabel tipo={evento.tipo} />,
      tipoLabel: CAUCAO_TIPO[evento.tipo].label,
      observacao: evento.observacao,
      cards: evento.cards,
    }))

  return [...taxaLinhas, ...caucaoLinhas].sort((a, b) =>
    b.data < a.data ? -1 : b.data > a.data ? 1 : 0
  )
}, [taxas, caucaoEventos, filtro])

// resetKey: plain pipe-joined string, mirrors reports-view.tsx:133's
// contractsResetKey (no Set fields here, so no JSON.stringify needed —
// unlike relatorio-financeiro-dedicado.tsx's listaResetKey, which needs it
// only because of `situacoes: Set`).
const resetKey = `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}`
const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(linhas, resetKey)

async function handleExportarPDF() {
  setExportando(true)
  try {
    await exportarReconciliacaoPDF(linhas, totais, filtro, hojeISO)
  } finally {
    setExportando(false)
  }
}

// JSX: wrap the existing header row + StatTile grid + table in
// <Collapsible open={aberto} onOpenChange={setAberto}>, add
// CollapsibleTrigger + "Exportar PDF" Button (mirrors relatorio-financeiro-
// dedicado.tsx:126-155 verbatim), <CollapsiblePanel><FiltroReconciliacao
// campos={filtro} onChange={setFiltro} /></CollapsiblePanel>.
```

### 6. New PDF module (`web/src/components/reports/reconciliacao-pdf.ts`, new file — mirrors `relatorio-financeiro-pdf.ts` block-for-block)
```ts
import { formatCurrency, formatDate, formatInstantDateTime } from "@/lib/kanban/format"
import type {
  FiltroReconciliacaoValores,
  ReconciliacaoTotais,
} from "@/lib/kanban/reconciliacao"

// Module stays plain (no "use client"), same rule as relatorio-financeiro-pdf.ts:
// zero top-level import of jspdf/jspdf-autotable (Pitfall #3/#1 above).

type LinhaListaPDF = {
  id: string
  data: string
  valor: number
  tipoLabel: string
  observacao: string | null
  cards: { endereco: string; proprietario: string; numero: number } | null
}

const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })

function periodoLabel(periodo: string): string {
  const [ano, mes] = periodo.split("-").map(Number)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return mesPorExtenso.charAt(0).toUpperCase() + mesPorExtenso.slice(1) + ` de ${ano}`
}

export async function exportarReconciliacaoPDF(
  linhas: LinhaListaPDF[],
  totais: ReconciliacaoTotais,
  filtro: FiltroReconciliacaoValores,
  hojeISO: string
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
  const docComAutoTable = doc as unknown as { lastAutoTable?: { finalY: number } }

  // Same exact hex-derived RGB triples as relatorio-financeiro-pdf.ts:81-84 —
  // the PDF Export Layout Contract (10-UI-SPEC.md) governs both reports' PDFs.
  const foreground: [number, number, number] = [24, 52, 28]
  const muted: [number, number, number] = [92, 112, 96]
  const border: [number, number, number] = [219, 238, 212]
  const rowShade: [number, number, number] = [234, 246, 230]

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 40

  doc.setFont("helvetica", "bold")
  doc.setFontSize(19)
  doc.setTextColor(...foreground)
  doc.text("Dinheiro da imobiliária", marginX, 50)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(...muted)
  doc.text(
    `Gerado em ${formatInstantDateTime(new Date().toISOString())}`,
    pageWidth - marginX,
    50,
    { align: "right" }
  )

  const periodoAtivo = /^\d{4}-\d{2}$/.test(filtro.periodo)
    ? periodoLabel(filtro.periodo)
    : "Todos"

  autoTable(doc, {
    startY: 66,
    theme: "grid",
    body: [
      ["Imóvel", filtro.imovel.trim() || "Todos"],
      ["Proprietário", filtro.proprietario.trim() || "Todos"],
      ["Inquilino", filtro.inquilino.trim() || "Todos"],
      ["ID do contrato", filtro.id.trim() || "Todos"],
      ["Período", periodoAtivo],
    ],
    styles: { fontSize: 9, textColor: foreground, lineColor: border, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 } },
  })

  const afterFiltrosY = docComAutoTable.lastAutoTable?.finalY ?? 66

  autoTable(doc, {
    startY: afterFiltrosY + 16,
    theme: "grid",
    body: [
      ["Administração", formatCurrency(totais.administracao)],
      ["Comissão 1º aluguel", formatCurrency(totais.comissao)],
      ["Total recebido", formatCurrency(totais.totalRecebido)],
      ["Caução recebida", formatCurrency(totais.caucaoRecebida)],
      ["Caução devolvida", formatCurrency(totais.caucaoDevolvida)],
      ["Caução usada", formatCurrency(totais.caucaoUsada)],
    ],
    styles: { fontSize: 9, textColor: foreground, lineColor: border, cellPadding: 5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 } },
  })

  const afterResumoY = docComAutoTable.lastAutoTable?.finalY ?? afterFiltrosY + 16

  if (linhas.length === 0) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(...muted)
    doc.text(
      "Nenhuma taxa ou movimento de caução encontrado para os filtros aplicados.",
      marginX,
      afterResumoY + 24
    )
  } else {
    autoTable(doc, {
      startY: afterResumoY + 16,
      head: [["Data", "Contrato", "Tipo", "Valor", "Observação"]],
      // linhas já vem ordenada (DESC — dinheiro-imobiliaria-view.tsx:91-98):
      // nunca reordenar aqui (Anti-Pattern acima).
      body: linhas.map((l) => [
        formatDate(l.data),
        `#${l.cards?.numero ?? 0} ${l.cards?.endereco ?? ""}`,
        l.tipoLabel,
        formatCurrency(l.valor),
        l.observacao ?? "",
      ]),
      showHead: "everyPage",
      styles: { fontSize: 9, textColor: foreground, lineColor: border },
      headStyles: { fontStyle: "bold", fillColor: [255, 255, 255], textColor: foreground },
      alternateRowStyles: { fillColor: rowShade },
      columnStyles: { 3: { halign: "right" } },
    })
  }

  const totalPaginas = doc.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(...muted)
    doc.text(
      `Página ${i} de ${totalPaginas}`,
      doc.internal.pageSize.getWidth() - marginX,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" }
    )
    doc.text(
      "Kanban Aluguel — gerado em " + formatDate(hojeISO),
      marginX,
      doc.internal.pageSize.getHeight() - 20
    )
  }

  doc.save(`dinheiro-imobiliaria-${hojeISO}.pdf`)
}
```

## State of the Art

Not applicable — this phase reuses existing, already-current internal patterns (all shipped within the last 8 days of this same project). No external ecosystem "old vs. new approach" axis applies.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended file names (`filtro-reconciliacao.tsx`, `reconciliacao-pdf.ts`) and the exported PDF filename (`dinheiro-imobiliaria-${hojeISO}.pdf`) | Code Examples, Open Questions 4/6 | Low — explicitly listed as "Claude's Discretion" in `19-CONTEXT.md`; the planner/user can rename freely without touching any behavior |
| A2 | Recommendation to use `normalizeText` (accent-insensitive) rather than `passaFiltroTexto` (plain lowercase substring) for the three text fields | Open Question 2 | Low-medium — both patterns exist in this codebase; choosing the other one is a one-line-per-call change, not a rework, and does not affect correctness, only whether "Sao Paulo" matches "São Paulo" |

**All other claims in this research are `[VERIFIED]`** — confirmed by reading the actual source files this session (line-cited above), not from training memory or web search. This phase touches no external documentation, no new library, and no database schema.

## Open Questions

The 6 "non-obvious pieces" flagged by the orchestrator are answered directly below (not left as open questions — restated here for traceability, with the concrete recommendation already reflected in the Code Examples section above):

1. **Widening `buscarReconciliacaoAction`'s two `.select()` calls + `reconciliacao.ts`'s embedded `cards` type — is it safe/additive?**
   Yes, confirmed safe. `cards.inquilino` is `text`, nullable, no `NOT NULL` (`supabase/migrations/20260728000000_init_schema.sql:68` `[VERIFIED: supabase/migrations/20260728000000_init_schema.sql:68]`, quote: `inquilino text,`). RLS on `cards` is row-level only, via `is_team_member()` (no column-level grants/policies found across all 8 migration files that reference RLS/security). The Server Action's session (`requireUser()`) is unchanged — widening the embed adds a column already readable by that same session under the existing row-level policy, nothing new is exposed. Exact diff sketched in Code Examples §1/§2.

2. **Text matcher: `normalizeText` (search.ts) vs. `passaFiltroTexto` (relatorio-financeiro.ts)?**
   Both are real, current precedents. `passaFiltroTexto` (`web/src/lib/kanban/relatorio-financeiro.ts:60-64`) is plain `.toLowerCase().includes()` — used by the *closest* structural sibling (`FiltroRelatorioFinanceiroLive`/`RelatorioFinanceiroDedicado`, same reports/ directory). `normalizeText` (`web/src/lib/kanban/search.ts:8-13`) is accent-insensitive (NFD + strip combining marks) — used by the *most recently shipped* sibling (Phase 18, `configuracao-financeira-view.tsx:48-51`, completed 2026-08-28, i.e. yesterday relative to this research). **Recommendation: use `normalizeText`.** It is a strict UX improvement (matches "Joao" against "João") with zero added dependency (already in the same `lib/kanban/` directory, zero server imports, safe to import from a pure module), and it is the more recent codebase convention. Sketch in Code Examples §3 (`passaFiltroTextoReconciliacao`).

3. **`resetKey` composition for `usePagination`.**
   Today: `usePagination(linhas, periodo)` (`dinheiro-imobiliaria-view.tsx:103`). Precedent for combining multiple fields: `reports-view.tsx:133`, `` const contractsResetKey = `${query}|${[...statusFilters].sort().join(",")}|${[...columnFilters].sort().join(",")}` `` — plain pipe-joined string, no `JSON.stringify` (that's only needed in `relatorio-financeiro-dedicado.tsx:73-80` because one of its fields is a `Set`). Since none of the 5 new fields here (`imovel`/`proprietario`/`inquilino`/`id`/`periodo`) are Sets, the `reports-view.tsx` pattern applies directly: `` `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}` ``. Sketch in Code Examples §5.

4. **New standalone component vs. inline logic?**
   **Recommendation: new standalone component**, `FiltroReconciliacao` (`web/src/components/reports/filtro-reconciliacao.tsx`), mirroring `FiltroRelatorioFinanceiroLive`'s prop shape (`campos`/`onChange`) 1:1, with 5 inputs instead of 3+chips. Reasoning: (a) it matches the existing convention exactly — every "filtro suspenso"/"live filter" panel in this codebase is its own file, never inlined into the view; (b) the correction in the Summary section means this is *not* an unprecedented composition needing extra design care — it is a mechanical copy of `relatorio-financeiro-dedicado.tsx` + `filtro-relatorio-financeiro-live.tsx`, so a separate file costs nothing extra in design risk; (c) keeps `dinheiro-imobiliaria-view.tsx`'s diff small and reviewable (state + wiring only, not 5 new `<Input>` blocks inline).

5. **New PDF module structure.**
   Sketched in full in Code Examples §6 (`reconciliacao-pdf.ts`), mirroring `relatorio-financeiro-pdf.ts` block-for-block: same color/font constants (`foreground`/`muted`/`border`/`rowShade`, identical RGB triples), same dynamic-import-inside-function discipline, same `doc.getNumberOfPages()` (not `.internal.`), same `showHead: "everyPage"`, same footer loop. Data-shape differences: header block has 5 filter rows (not 4 — includes Inquilino/ID do contrato in addition to Imóvel/Proprietário/Período, no Situação chips since this report has none), summary block has 6 totals (not 4), list columns are `Data/Contrato/Tipo/Valor/Observação` (not `Imóvel/Proprietário/Competência/Vencimento/Situação/Valor`) since the on-screen table already combines imóvel+contrato-id into one "Contrato" column (`IdPill` + endereço) — the PDF list mirrors that combined column via `` `#${numero} ${endereco}` `` rather than splitting into two columns, keeping the PDF table visually consistent with the on-screen table it's exporting.

6. **ID do contrato: digits-only exact match, or free-text substring against `String(numero)`?**
   **Recommendation: digits-only, exact match** (mirrors `FiltroParcelas`'s pattern, not a substring). Verified server-side precedent at `web/src/app/(app)/financeiro/page.tsx:64-65,135-136`: `` const idNumerico = idBusca && Number.isInteger(Number(idBusca)) ? Number(idBusca) : null `` then `` query = query.eq("cards.numero", idNumerico) `` — an exact equality comparison, non-numeric input silently ignored (never a substring match). This client-side filter should replicate that exact semantics in memory: `Number.isInteger(Number(filtro.id.trim()))` guard, then `cards.numero === alvo`. Sketch: `passaFiltroIdReconciliacao` in Code Examples §3. Rationale: contract IDs are sequential integers (`cards.numero`, `CONTRATO-03`/`IdPill`), and a user typing "12" almost certainly means contract #12, not "any contract whose number contains the digit sequence 12" (which would also match #120, #512, etc. — surprising and inconsistent with the one existing precedent for this exact field).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No — unchanged | `requireUser()` session check, already present in `buscarReconciliacaoAction`, untouched by this phase |
| V3 Session Management | No — unchanged | Same Supabase JWT session as every other Server Action in this codebase |
| V4 Access Control | Yes — widened query, needs confirmation (done above) | RLS via `is_team_member()`, row-level only on `cards`/`taxas_imobiliaria`/`caucao_eventos` — no column-level policy exists, so adding `inquilino` to an already-permitted embed does not cross any access boundary. `[VERIFIED: supabase/migrations, 8 files grepped for column-level grant/RLS patterns — none found beyond row-level is_team_member()]` |
| V5 Input Validation | Yes — new filter inputs | All 5 filter fields are matched **entirely in memory** (`.includes()`/`===`), never interpolated into a query string or passed to Supabase — no injection surface. The one field needing defensive parsing is "ID do contrato": guard with `Number.isInteger(Number(...))` before comparison (Open Question 6), exactly as the existing server-side precedent does, to avoid `NaN`/coercion surprises, not for security but for correctness |
| V6 Cryptography | No — not applicable | No new crypto/secrets touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Widened `.select()` exposing a field beyond what the session is authorized to read | Information Disclosure | Not applicable here — RLS is row-level, not column-level, on this schema; the field (`inquilino`) was already fully readable by any session that can read the row at all (same session already reads `endereco`/`proprietario`/`numero` from the identical row) |
| Client-side PDF generation embedding data the current session shouldn't have | Information Disclosure | The PDF function receives only `linhas`/`totais` already computed from data the Server Action already returned to this session — no new data enters the client beyond what D-04's widened query already fetches under RLS |
| Malformed "ID do contrato" input crashing the filter/PDF (`NaN`, non-integer) | Denial of Service (client-side, low severity) | `Number.isInteger(Number(...))` guard before any numeric comparison (Open Question 6/Pitfall 5) — malformed input is ignored, never thrown |

## Sources

### Primary (HIGH confidence — all read directly this session)
- `web/src/lib/kanban/actions.ts:1966-2007` — `buscarReconciliacaoAction`, exact current `.select()` calls
- `web/src/lib/kanban/reconciliacao.ts` (full file) — `TaxaImobiliariaRelatorio`/`CaucaoEventoRelatorio`/`calcularReconciliacao`/`passaFiltroPeriodoReconciliacao`
- `web/src/components/reports/dinheiro-imobiliaria-view.tsx` (full file) — current `LinhaLista`, `periodo` state, `usePagination` wiring
- `web/src/components/financeiro/filtro-parcelas.tsx` (full file) — Collapsible shell + `id` field's numeric intent (`inputMode="numeric"`)
- `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` (full file) — live/no-submit-button pattern
- `web/src/components/reports/filtro-relatorio-financeiro.tsx` (full file) — secondary suspenso-with-button reference
- `web/src/components/ui/collapsible.tsx` (full file) — underlying `@base-ui/react` primitive
- `web/src/components/reports/relatorio-financeiro-pdf.ts` (full file) — exact PDF module to mirror
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` (full file) — **the already-shipped suspenso+live composition** (correction in Summary)
- `web/src/components/reports/reports-view.tsx:83-140` — `contractsResetKey` composition precedent
- `web/src/components/reports/stat-tile.tsx` (full file) — `StatTile` props, mirrored into PDF summary
- `web/src/components/pagination.tsx` (full file) — `usePagination`/`Pagination`
- `web/src/lib/kanban/search.ts` (full file) — `normalizeText`
- `web/src/lib/kanban/relatorio-financeiro.ts:52-106` — `passaFiltroTexto`/`passaFiltroPeriodo` (alternative matcher pattern)
- `web/src/components/financeiro/configuracao-financeira-view.tsx:1-62` — most recent live-matcher precedent (Phase 18)
- `web/src/components/financeiro/taxa-origem-label.tsx` (full file) — `TAXA_ORIGEM` label map
- `web/src/components/financeiro/caucao-evento-label.tsx` (full file) — `CAUCAO_TIPO` label map
- `web/src/components/financeiro/id-pill.tsx` (full file) — `IdPill` component
- `web/src/app/(app)/financeiro/page.tsx:44-221` — server-side "ID do contrato" exact-match precedent
- `supabase/migrations/20260728000000_init_schema.sql:68` — `cards.inquilino` column definition (`text`, nullable)
- `supabase/migrations/20260811000000_security_hardening.sql:100-114` — `cards_inquilino_tamanho` CHECK constraint (nullable-or-≤200 chars)
- `web/package.json` — `jspdf@^4.2.1`, `jspdf-autotable@^5.0.8` already present
- `.planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md:159-198` — "PDF Export Layout Contract" (colors, typography, footer convention)
- `.planning/phases/19-.../19-CONTEXT.md` (full file) — locked decisions
- `.planning/config.json` — `workflow.nyquist_validation: false`, `workflow.security_enforcement: true`

### Secondary (MEDIUM confidence)
None — no external documentation or web sources were needed for this phase; every question was answerable by reading this codebase directly.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, both PDF/Collapsible libraries already verified installed and in production use
- Architecture: HIGH — the target composition (suspenso shell + live filter) is already shipped and verified in production at `relatorio-financeiro-dedicado.tsx`, not a novel design
- Pitfalls: HIGH — all 6 pitfalls are either directly documented in the existing, already-shipped source code comments (read this session) or derived from reading the exact current type/schema definitions

**Research date:** 2026-08-28
**Valid until:** No external expiry — this research is entirely internal-codebase-derived; valid until the mirrored source files (`relatorio-financeiro-pdf.ts`, `relatorio-financeiro-dedicado.tsx`, `reconciliacao.ts`, `search.ts`) change materially.
