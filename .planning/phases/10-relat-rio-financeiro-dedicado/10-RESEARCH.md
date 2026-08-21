# Phase 10: Relatório Financeiro dedicado - Research

**Researched:** 2026-08-21
**Domain:** Next.js 16 App Router (live in-memory filtering) + client-side PDF generation for a paginated financial report
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (usuário, explícito):** O filtro é dinâmico — qualquer mudança em imóvel/proprietário/período/situação recalcula os 4 cards e a lista imediatamente, sem precisar clicar em nada. Diferente deliberadamente do padrão botão-só-dispara da Phase 8 (D-04 de `08-CONTEXT.md`) — não "consertar" essa fase achando que é inconsistência com a Phase 8; ambas foram escolha explícita do usuário, em fases diferentes.
- **D-02 (usuário, explícito):** O botão que na Phase 8 se chama "Gerar relatório" **vira "Exportar PDF"** nesta página — já não dispara a consulta (que roda sozinha a cada mudança de filtro), só gera o PDF do que está na tela no momento do clique.
- **D-03 (usuário, explícito):** A lista abaixo dos cards mostra **uma linha por parcela**, não por contrato — mesmo nível de granularidade dos 4 cards. Cada linha: endereço, proprietário, competência, vencimento, situação e valor.
- **D-04 (usuário, explícito):** O PDF exportado é um documento autônomo — leva os 4 totais, a lista completa de parcelas filtradas, e um cabeçalho com os filtros que estavam aplicados no momento da exportação e a data de geração. Ninguém que abrir o PDF depois precisa lembrar ou adivinhar o que foi filtrado.
- **D-05 (usuário, explícito):** Rota nova em `/relatorios/financeiro`. O botão "Relatório financeiro" dentro da `/relatorios` atual navega direto, na mesma aba (sem `target="_blank"`).

### Claude's Discretion

- **Estratégia de dado ao vivo:** buscar uma vez ao carregar a página (`buscarParcelasRelatorioAction`, já existente) e filtrar em memória a cada tecla é o caminho natural, dado o volume (~48 contratos, poucas centenas de parcelas). Reconfirmar no plano; se o pesquisador achar um motivo técnico para preferir busca por tecla, é ponto de levantar. **Research finding: confirmado — ver "Live-filter-in-memory" abaixo, nenhum motivo técnico para preferir busca por tecla.**
- **Geração do PDF:** biblioteca/abordagem fica para pesquisa/planejamento — nenhuma preferência de produto declarada. Atenção: Next.js 16 tem breaking changes vs. conhecimento de treinamento — verificar compatibilidade antes de escolher. **Research finding: jsPDF + jspdf-autotable recomendado — ver "Standard Stack" abaixo.**
- **Estado inicial do painel de filtro:** fechado por padrão ao carregar a página (mesmo padrão de `FiltroRelatorioFinanceiro`, Phase 8).
- **Reaproveitamento de código:** `calcularRelatorioFinanceiro`, `ParcelaRelatorio`, `FiltroRelatorioValores`, `filtroRelatorioVazio`, `passaFiltroTexto`/`passaFiltroPeriodo` (todos em `web/src/lib/kanban/relatorio-financeiro.ts`) já implementam a filtragem/agregação em memória — não reimplementar. **Research finding: `passaFiltroTexto`/`passaFiltroPeriodo` NÃO estão exportadas hoje — ver "Common Pitfalls #1" abaixo, correção necessária antes de reusar.**

### Deferred Ideas (OUT OF SCOPE)

- **Rastrear dinheiro recebido pela imobiliária** (taxa de administração, primeiro aluguel, caução, taxas de gestão) — capacidade nova de modelo de dados, fora desta fase. Candidata a Phase 11 futura, a definir quando o usuário quiser seguir.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RELDED-01 | Rota nova `/relatorios/financeiro`, alcançada por botão "Relatório financeiro" em `/relatorios`; página atual inalterada | Confirmed App Router nested-route pattern (`web/src/app/(app)/relatorios/financeiro/page.tsx`) is unaffected by any Next.js 16 breaking change — see "Route structure" below. Entry-point button copy/placement locked in `10-UI-SPEC.md` §Copywriting |
| RELDED-02 | Painel de filtro dinâmico — qualquer mudança recalcula os 4 cards e a lista imediatamente | Confirmed sound at production scale (357 parcelas) via fetch-once + `useMemo` — see "Live-filter-in-memory pattern" below. No debounce needed |
| RELDED-03 | Lista abaixo dos cards, uma linha por parcela, sempre em sincronia com o filtro | `calcularRelatorioFinanceiro`'s per-row matching logic (`passaFiltroTexto`/`passaFiltroPeriodo` + situação membership) reused for the row-list, once exported — see Common Pitfalls #1 and Code Examples |
| RELDED-04 | Botão "Gerar relatório" vira "Exportar PDF" — não dispara mais a consulta, só empacota o que já está na tela | jsPDF is triggered from the already-filtered, already-sorted in-memory array — see "PDF generation library" below and Common Pitfalls #7 (never re-derive from the unfiltered dataset) |
| RELDED-05 | PDF com os 4 totais, a lista completa, cabeçalho com filtros aplicados e data de geração | jsPDF + jspdf-autotable v5 functional API covers repeating multi-page table headers, a bordered header/summary block, and a `didDrawPage`/post-loop footer with page numbers — see "PDF generation library" and Code Examples |
</phase_requirements>

## Summary

This phase is almost entirely a UI/interaction-pattern exercise on top of already-shipped, already-verified building blocks — the only genuinely new technical surface is client-side PDF generation, which is why `10-CONTEXT.md`/`10-UI-SPEC.md` both deferred that choice to this research. Everything else (live-filter-in-memory, the new App Router route, the two additive `className` props) checks out cleanly against the actual code in this repo and against Next.js 16's real breaking-changes list — none of which touch a plain, non-dynamic Server Component route.

For PDF generation, **`jsPDF` + `jspdf-autotable`** is the clear recommendation: both are long-established, extremely high-download, pure-client-side JS libraries with zero Node-native dependencies (no `fs`/`stream` polyfill risk under Turbopack), both ship their own TypeScript types, and `jspdf-autotable` is purpose-built for exactly this document shape — a bordered header/summary block plus a flat table that repeats its header row automatically on every new page, which the UI-SPEC's PDF Export Layout Contract requires at production's current ~350+ parcela scale. `@react-pdf/renderer` (JSX-based, also React-19-compatible) was considered and rejected — not for a version-compatibility reason, but because its pagination/repeating-header story is less battle-tested for dense tabular reports and it duplicates React's own component model unnecessarily for what is, at bottom, an imperative "draw a table" problem. `html2canvas`+`jsPDF` (DOM screenshot) was rejected because it produces non-selectable, non-searchable raster text and has no clean multi-page table pagination story. Server-side generation (headless browser) was rejected as disproportionate — it would be the first Node-native/Chromium dependency in a Vercel-deployed app that otherwise has zero server-side rendering dependencies beyond Supabase, for an internal tool serving one team.

Two real, previously-undocumented discrepancies were found between `10-CONTEXT.md`/`10-UI-SPEC.md`'s assumptions and the actual code, both cheap to fix and both must be called out to the planner explicitly: (1) `passaFiltroTexto`/`passaFiltroPeriodo` in `relatorio-financeiro.ts` are **not** exported today, despite both documents describing them as "já exportadas" — the row-list needs them exported before it can reuse them without duplicating the matching logic; (2) `ParcelaSituacaoBadge`'s internal `SITUACAO[situacao]` object already destructures a local variable literally named `className` — adding an incoming `className` **prop** with the same name, as the UI-SPEC's additive-prop plan requires, will shadow/collide unless the local destructure is renamed first.

**Primary recommendation:** Fetch parcelas once server-side (Server Component, reusing `buscarParcelasRelatorioAction`'s query shape), hold `FiltroRelatorioValores` state client-side and derive both the 4 tiles and the row-list via `useMemo` on every field change (no debounce needed at ~357-parcela scale), and generate the PDF entirely client-side with `jsPDF` + `jspdf-autotable`'s v5 functional API (`autoTable(doc, {...})`, not the legacy `doc.autoTable({...})` method), dynamically imported so the SSR'd route never touches `document`/`window` at module scope.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Initial parcelas fetch (`parcelas` + `hojeEmCuiaba()`) | Frontend Server (SSR) | Database/Storage | Next.js Server Component performs the query with the user's session-scoped Supabase client — same shape as `relatorios/page.tsx` and `buscarParcelasRelatorioAction` |
| Access control on the query | Database/Storage | — | RLS via `is_team_member()` (Phase 4), unchanged — the app-level `requireUser()` check is defense-in-depth, not the primary gate |
| Live filter state + derived tiles/rows (`useMemo`) | Browser/Client | — | Runs entirely in the already-hydrated client component; no network round-trip per keystroke (D-01's "ao vivo" requirement is a client-tier concern, not a server one) |
| Row-list rendering | Browser/Client | — | Pure presentational — same `Table`/`TableRow` primitives already used by `ParcelasTable`/`ArquivadosView` |
| PDF generation | Browser/Client | — | `jsPDF`/`jspdf-autotable` run in-browser against the already-fetched, already-filtered in-memory array; zero server round-trip, zero new API route |
| PDF file delivery to disk | Browser/Client | — | `jsPDF`'s built-in `doc.save(filename)` triggers a browser-native download via Blob — no server endpoint, no `file-saver` dependency needed |
| Entry-point navigation (`/relatorios` → `/relatorios/financeiro`) | Browser/Client | Frontend Server (SSR) | `next/link` client-side navigation to a route whose page itself renders server-side |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `jspdf` | 4.2.1 [VERIFIED: npm registry, `npm view jspdf version`] | Core PDF document builder — pages, text, geometry, embedded fonts | 12.2M weekly downloads [VERIFIED: `gsd_run query package-legitimacy check`], no Node-native deps, ships own TS types (`types/index.d.ts`), 10+ year track record, the de-facto standard for client-side PDF generation in the JS ecosystem |
| `jspdf-autotable` | 5.0.8 [VERIFIED: npm registry, `npm view jspdf-autotable version`] | Table plugin for jsPDF — automatic pagination with repeating header rows | 3.39M weekly downloads [VERIFIED: package-legitimacy check], peer dep `jspdf: "^2 \|\| ^3 \|\| ^4"` [VERIFIED: `npm view jspdf-autotable peerDependencies`] is satisfied by jsPDF 4.2.1, purpose-built for exactly this document shape (bordered header block + flat multi-page table with repeating headers) |

### Supporting

None needed. `jsPDF.save(filename)` handles the browser download natively — no `file-saver` or equivalent required.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsPDF + jspdf-autotable | `@react-pdf/renderer` 4.6.1 | React-19-compatible (`peerDependencies.react: "^19.0.0"` [VERIFIED: `npm view @react-pdf/renderer peerDependencies`]) and legitimate (4.3M weekly downloads), but flagged `SUS` by the legitimacy gate purely on a "too-new latest publish" heuristic (last publish 2026-08-14) — the package itself is not suspicious, just recently released. Rejected on **technical** grounds instead: its JSX component model (`<Document>`/`<Page>`/`<View>`) is a heavier fit for a report whose core shape is "one flat table with a repeating header," and its automatic-pagination/repeating-header story is less proven for dense tabular data than autotable's, which was purpose-built for it |
| jsPDF + jspdf-autotable | `html2canvas` + `jsPDF` (DOM screenshot) | Would visually match the on-screen table pixel-for-pixel with near-zero new layout code, but bakes the table into a raster image — text becomes non-selectable/non-searchable in the resulting PDF (a real regression for a "documento autônomo" meant to be referenced later, D-04), and a screenshot has no native concept of "repeat this header row on page 2" — multi-page pagination would have to be hand-rolled by manually slicing canvases, which is exactly the kind of hand-rolling `jspdf-autotable` already solves |
| jsPDF + jspdf-autotable | `window.print()` + `@media print` CSS | Zero new dependencies, and Chrome/Firefox/Safari all support `thead { display: table-header-group }` repeating on print by default — a technically valid path. Rejected because the locked copy contract (`10-UI-SPEC.md`) names the button **"Exportar PDF"** with a `FileDown` (download) icon, which implies a direct file artifact, not opening the OS print dialog and asking the user to manually choose "Save as PDF" as the destination — a materially different, more manual UX than what the locked copy promises |
| jsPDF + jspdf-autotable | Server-side generation (headless browser, e.g. Puppeteer/Playwright) | Would guarantee pixel-perfect fidelity to the on-screen HTML/CSS, but introduces the app's first Chromium-binary dependency, meaningfully complicates Vercel serverless deployment (cold starts, `@sparticuz/chromium`-style packaging), and is disproportionate for an internal tool with ~48 contracts — rejected on the same "smallest reasonable dependency footprint" principle the phase context calls for |

**Installation:**
```bash
npm install jspdf jspdf-autotable
```

**Version verification:** confirmed via `npm view jspdf version` (4.2.1) and `npm view jspdf-autotable version` (5.0.8) against the live npm registry in this session — both packages, and their peer-dependency graph, are current as of 2026-08-21.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|--------------|
| jspdf | npm | long-established (repo since ~2012) | 12,239,261/wk | github.com/parallax/jsPDF | OK | Approved |
| jspdf-autotable | npm | long-established | 3,386,588/wk | github.com/simonbengtsson/jsPDF-AutoTable | OK | Approved |
| @react-pdf/renderer | npm | long-established, but last publish 6 days before this research | 4,303,159/wk | github.com/diegomura/react-pdf | SUS (reason: `too-new` publish heuristic only) | Considered, not selected (technical rejection above, not a legitimacy concern — no `checkpoint:human-verify` needed since it is not being installed) |
| html2canvas | npm | long-established | 14,447,263/wk | github.com/niklasvh/html2canvas | OK | Considered, not selected (technical rejection above) |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `@react-pdf/renderer` — flagged only by the too-new-publish heuristic despite legitimate high-download status; not being installed in this phase, so no `checkpoint:human-verify` gate applies. If a future phase reconsiders `@react-pdf/renderer`, re-run the legitimacy check at that time (the "too-new" trigger will have expired).

All four packages above were discovered via WebSearch/training knowledge and independently confirmed via `npm view`/the legitimacy seam against the live registry in this session — `jspdf` and `jspdf-autotable` (the two actually recommended) both carry `[VERIFIED: npm registry]` per the version/legitimacy checks run above; no `checkpoint:human-verify` task is required for them per the gate's `OK` disposition rule.

## Architecture Patterns

### System Architecture Diagram

```
Browser (gestor)
   │
   │ 1. GET /relatorios/financeiro
   ▼
Next.js Server Component  (web/src/app/(app)/relatorios/financeiro/page.tsx)
   │   requireUser() + session-scoped Supabase client (RLS: is_team_member())
   │   [same shape as buscarParcelasRelatorioAction / relatorios/page.tsx]
   ▼
Supabase Postgres — parcelas ⨝ cards(endereco, proprietario)
   │   D-05 (Phase 8, reused verbatim): no arquivado_em/ativo filter —
   │   archived/inactive contracts still count toward totals
   ▼
returns { parcelas: ParcelaRelatorio[], hojeISO } as props
   ▼
Client Component ("use client")  relatorio-financeiro-dedicado.tsx
   │   holds FiltroRelatorioValores state — every onChange updates it directly
   │   (D-01: no submit button, nothing to "apply")
   │
   ├─► useMemo → calcularRelatorioFinanceiro(parcelas, filtro, hojeISO)
   │        → CategoriaRelatorio[4] → 4× <StatTile> (recomputed live)
   │
   ├─► useMemo → per-parcela pass reusing passaFiltroTexto/passaFiltroPeriodo/
   │        situação-membership → linhasFiltradas[] (sorted by vencimento asc)
   │        → <Table> rows (recomputed live, D-03: one row per parcela)
   │
   └─► onClick "Exportar PDF"
          │   dynamic import("jspdf"), dynamic import("jspdf-autotable")
          │   — never imported at module scope (would break SSR/build)
          ▼
       new jsPDF({ unit: "pt", format: "a4" })
          │   header block (title, "Gerado em", applied-filters table)
          │   summary block (4 totals, same CategoriaRelatorio[4] already on screen)
          │   autoTable(doc, { head, body: linhasFiltradas, headerRows: 1 })
          │        — header row repeats automatically on every new page
          │   post-layout loop: doc.setPage(i) → "Página i de N" footer
          ▼
       doc.save("relatorio-financeiro-....pdf")
          → browser-native download, zero server round-trip, zero new API route
```

A reader can trace the primary use case — open the page, type into a filter field, watch the tiles/list update, click "Exportar PDF", get a file — entirely by following the arrows above; the only branch is the optional PDF export at the end, which consumes exactly the same in-memory `linhasFiltradas` the on-screen table already rendered (see Common Pitfalls #7).

### Recommended Project Structure
```
web/src/
├── app/(app)/relatorios/
│   ├── page.tsx                              # unchanged except one new <Link> button
│   └── financeiro/
│       └── page.tsx                          # new Server Component, mirrors relatorios/page.tsx
├── components/reports/
│   ├── relatorio-financeiro.tsx               # unchanged (Phase 8's collapsible-panel version)
│   ├── filtro-relatorio-financeiro.tsx         # unchanged (Phase 8's version, click-triggered)
│   ├── relatorio-financeiro-dedicado.tsx       # new — client component, live filter state + tiles + list
│   ├── filtro-relatorio-financeiro-live.tsx    # new — adapted panel, no submit button (or inline in the above)
│   ├── relatorio-financeiro-lista.tsx          # new — the 6-column parcela table
│   └── relatorio-financeiro-pdf.ts             # new — pure PDF-building function, no JSX, imports jspdf dynamically
└── lib/kanban/
    └── relatorio-financeiro.ts                 # existing — add `export` to passaFiltroTexto/passaFiltroPeriodo
```

### Pattern 1: Fetch-once, filter-in-memory (Live-filter-in-memory pattern)

**What:** The Server Component fetches `parcelas` exactly once per page load (same query shape as `buscarParcelasRelatorioAction`); the client component never re-fetches on filter change — it recomputes derived state from the same in-memory array via `useMemo`.

**When to use:** Confirmed sound for this phase's scale. Production currently has 357 parcelas total [VERIFIED: STATE.md, "`parcelas_total_depois = 357`" — Phase 9 cleanup confirmation] across ~48 contracts. Filtering/aggregating an array of ~357 objects on every keystroke inside a `useMemo` is a sub-millisecond operation — there is no technical reason to prefer a per-keystroke server round-trip, which would only add network latency and contradict D-01's "ao vivo" requirement. **No debounce is needed** on the free-text fields at this scale, despite the UI-SPEC leaving a 150–250ms debounce as an "acceptable implementation detail" fallback — that fallback exists for a volume this app is nowhere near yet.

**Example (adapted from `relatorio-financeiro.tsx:43-49`, the exact `useMemo` pattern already shipped in this codebase — Phase 8 only gates it behind a click; this phase removes the gate):**
```typescript
// Source: web/src/components/reports/relatorio-financeiro.tsx:43-49 (existing pattern)
const categorias = React.useMemo(
  () => calcularRelatorioFinanceiro(dados.parcelas, filtro, dados.hojeISO),
  [filtro, dados]
)
// Phase 10 difference: `filtro` updates on every onChange (D-01), not only
// inside a `gerar()` handler triggered by a button click (Phase 8's D-04)
```

### Pattern 2: Live filter panel — no submit button

**What:** `FiltroRelatorioFinanceiro` (Phase 8) has a "Gerar relatório" button at the bottom that calls `onGerar(campos)`. The Phase 10 equivalent removes that button entirely — every `<Input onChange>` calls `setCampos` directly, and the parent's `useMemo` (Pattern 1) picks the change up on the next render.

**When to use:** Whenever the filter state IS the applied state (D-01) — there is no "draft vs applied" distinction to represent.

**Example:**
```tsx
// Adapted from filtro-relatorio-financeiro.tsx:47-52 — same setCampos shape,
// no onGerar callback needed since there's nothing to "generate"
function atualizarCampo(campo: "imovel" | "proprietario" | "periodo", valor: string) {
  onChange((atual) => ({ ...atual, [campo]: valor }))
}
```

### Pattern 3: Client-side PDF generation, dynamically imported

**What:** `jsPDF`/`jspdf-autotable` reference `document`/`window` internally and must never be imported at module scope in a file whose render path could execute during SSR. The safe pattern is either `next/dynamic` with `{ ssr: false }` around a component, or — simpler here, since the export is triggered by a click handler, not rendered — a dynamic `import()` **inside** the `onClick` handler itself.

**Example:**
```typescript
// Source: pattern confirmed via WebSearch against multiple Next.js App
// Router + jsPDF integration reports (2026) — "document is not defined"
// during SSR is the documented failure mode without this guard
async function exportarPDF(linhas: LinhaRelatorio[], categorias: CategoriaRelatorio[], filtro: FiltroRelatorioValores, hojeISO: string) {
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")
  // ... build doc, see "PDF generation library" Code Examples below
}
```

### Pattern 4: Additive `className` on shared components, via `cn()`

**What:** `FilterChip` and `ParcelaSituacaoBadge` each hard-code one off-grid value internally (`font-medium`, `gap-1.5`). Both gain an **optional** `className` prop, merged **last** via the project's existing `cn()` (`clsx` + `tailwind-merge`, `web/src/lib/utils.ts:1-6`) so a passed class cleanly overrides the matching default utility class via tailwind-merge's same-group conflict resolution. Every existing call site (none of which pass this new prop) renders byte-identical to today.

**When to use:** Exactly this situation — a shared, already-shipped component needs a **one-off** visual deviation for a single new call site, without forking the file or introducing a variant prop.

### Anti-Patterns to Avoid

- **Refetching `parcelas` from the server on every filter keystroke:** defeats the entire point of "ao vivo" (D-01), adds real network latency the click-triggered Phase 8 version never had, and is explicitly *not* what `10-CONTEXT.md`'s Claude's Discretion section calls for.
- **Reimplementing the per-row matching logic instead of exporting `passaFiltroTexto`/`passaFiltroPeriodo`:** would create a second, divergence-prone copy of filter semantics between the tile totals and the row-list — see Common Pitfalls #1.
- **Screenshotting the DOM via `html2canvas` for the PDF:** loses text selectability/searchability and has no native multi-page-table pagination story — see "Alternatives Considered" above.
- **Overwriting `FilterChip`/`ParcelaSituacaoBadge`'s internal default classes instead of merging additively:** would silently change Phase 5–8 screens that already ship and are in production use.
- **Building the PDF from the unfiltered `dados.parcelas` array instead of the currently-filtered `linhasFiltradas`:** would silently disagree with what the user actually filtered on screen at export time — see Common Pitfalls #7.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Multi-page PDF table with a header row that repeats on every new page | Manual page-break math (measure remaining page height, slice rows, redraw header) | `jspdf-autotable`'s `autoTable(doc, { head, body, headerRows: 1 })` | This is the plugin's core, purpose-built feature — repeating the header on every new page is its **default behavior**, confirmed via the library's own issue tracker [CITED: github.com/simonbengtsson/jsPDF-AutoTable, "Prevent repeated header row" issue #78 — confirming the default is to repeat, and it must be explicitly disabled to turn off] |
| "Página X de Y" footer | Guessing total page count up front | `jsPDF`'s two-pass pattern: run `autoTable(...)`, then loop `for (let i = 1; i <= doc.internal.getNumberOfPages(); i++) { doc.setPage(i); doc.text(...) }` | Total page count is only known **after** the table has fully laid out (rows can span an unknown number of pages depending on filtered result size) — drawing the footer inside `didDrawPage` alone cannot know the eventual total |
| Currency/date/competência formatting anywhere in this phase | New `Intl.NumberFormat`/`Intl.DateTimeFormat` instances, or `new Date(competencia)` on a "YYYY-MM-DD" string | `formatCurrency`/`formatDate`/`formatInstantDate`/`hojeEmCuiaba` (`web/src/lib/kanban/format.ts`), and the `mesFormatter`/`mesPorExtenso` pattern already duplicated across `ajustar-parcela-dialog.tsx`/`destravar-parcela-dialog.tsx`/`registrar-pagamento-dialog.tsx`/`parcela-historico-sheet.tsx` | Reusing these is both a correctness requirement (Cuiabá-timezone "hoje" bug already fixed once, `STATE.md` 2026-08-19 lesson) and an explicit `10-CONTEXT.md` instruction |
| Situação classification (paga/a_vencer/vencida/conciliada) | Reimplementing the vencimento-vs-hoje comparison | `situacaoDaParcela` (`parcelas.ts:380-388`) via `calcularRelatorioFinanceiro`, D-06 (Phase 8) | Single source of truth already established; reimplementing risks drift between the tile totals and any new surface |
| 4-category aggregation (count + total per situação) | A second reducer over `parcelas` | `calcularRelatorioFinanceiro` (`relatorio-financeiro.ts:82-135`) | Pure, already handles the D-07 pago-vs-devido split correctly; this is precisely the function `10-CONTEXT.md` names as reusable |

**Key insight:** almost nothing genuinely new needs writing in this phase's data layer — the only new code is (a) a thin per-row filter pass that composes the same three predicates the aggregator already uses, and (b) the PDF-drawing function itself. Everything else is composition of Phase 5–9 primitives.

## Common Pitfalls

### Pitfall 1: `passaFiltroTexto`/`passaFiltroPeriodo` are not actually exported today

**What goes wrong:** `10-CONTEXT.md` and `10-UI-SPEC.md` both describe these two functions as already-exported, reusable filter predicates ("passaFiltroTexto/passaFiltroPeriodo... já exportadas de relatorio-financeiro.ts"). Reading the actual file shows they are private module functions.

**Why it happens:** The functions exist and do exactly the right thing — they're just missing the `export` keyword, because until this phase nothing outside `calcularRelatorioFinanceiro` itself needed to call them directly.

**How to avoid:** Add `export` to both function declarations before building the row-list's filter pass. This is a purely additive, zero-behavior-change edit — `calcularRelatorioFinanceiro`'s existing internal calls are unaffected.

```typescript
// web/src/lib/kanban/relatorio-financeiro.ts:59, quoted verbatim as currently
// written (no `export` keyword):
// [VERIFIED: web/src/lib/kanban/relatorio-financeiro.ts:59]
function passaFiltroTexto(valor: string, filtro: string): boolean {

// web/src/lib/kanban/relatorio-financeiro.ts:71, quoted verbatim:
// [VERIFIED: web/src/lib/kanban/relatorio-financeiro.ts:71]
function passaFiltroPeriodo(competencia: string, periodo: string): boolean {

// Required fix — add `export` to both, no other change:
export function passaFiltroTexto(valor: string, filtro: string): boolean { /* unchanged body */ }
export function passaFiltroPeriodo(competencia: string, periodo: string): boolean { /* unchanged body */ }
```

**Warning signs:** A TypeScript import error (`Module has no exported member 'passaFiltroTexto'`) the moment the row-list component tries to import them — this is a compile-time catch, not a runtime one, so it will surface immediately during `npm run lint`/`tsc --noEmit`, not silently.

### Pitfall 2: `ParcelaSituacaoBadge`'s internal destructure already uses the name `className`

**What goes wrong:** The UI-SPEC's additive-prop plan (§8) asks for an optional `className` prop merged via `cn()`. But `ParcelaSituacaoBadge`'s body already destructures a **local** variable named `className` from its internal lookup table — adding a same-named incoming prop without renaming the local variable first will shadow one or the other, not merge them.

**Why it happens:** The component's per-situação styling table (`SITUACAO[situacao]`) happens to store its color utility class under the key `className` — a naming collision that's invisible until you actually try to add the new prop.

**How to avoid:** Rename the local destructure (e.g. to `toneClassName`) when adding the prop, then pass both into `cn()`.

```tsx
// web/src/components/financeiro/parcela-situacao-badge.tsx:47-55, quoted
// verbatim as currently written:
// [VERIFIED: web/src/components/financeiro/parcela-situacao-badge.tsx:47-55]
export function ParcelaSituacaoBadge({ situacao }: { situacao: Situacao }) {
  const { icon: Icon, label, className } = SITUACAO[situacao]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}

// Required fix — additive prop + renamed local destructure:
export function ParcelaSituacaoBadge({
  situacao,
  className,
}: {
  situacao: Situacao
  className?: string
}) {
  const { icon: Icon, label, className: toneClassName } = SITUACAO[situacao]

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", toneClassName, className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
```

**Warning signs:** Without the rename, TypeScript will flag a duplicate-binding error (`Identifier 'className' has already been declared`) at the destructure site the moment the prop is added — again a compile-time catch, but worth calling out explicitly since it's easy to write the additive prop exactly as the UI-SPEC describes it (top-level, no mention of the internal collision) and hit this immediately.

### Pitfall 3: importing jsPDF/jspdf-autotable at module scope breaks SSR

**What goes wrong:** Both libraries touch `document`/`window` during module initialization in some code paths. Importing either at the top of a file that a Server Component (even indirectly) renders — or even at the top of a `"use client"` file whose render path Next.js pre-renders on the server — throws `document is not defined` during the build or SSR pass.

**Why it happens:** This route (`/relatorios/financeiro`) is server-rendered by default (no `force-dynamic`/client-only wrapping specified), so any client component within it still gets an initial server render pass.

**How to avoid:** Only import `jspdf`/`jspdf-autotable` inside the click handler itself, via dynamic `import()` (Pattern 3 above) — never at module top-level, and never unconditionally inside the client component's render body.

**Warning signs:** A build failure or a server-rendered error page the first time `npm run build`/`next build` (Turbopack, default in this project — see State of the Art below) tries to statically analyze the new route, if the import is placed incorrectly.

### Pitfall 4: `jspdf-autotable` v5's API is NOT `doc.autoTable({...})`

**What goes wrong:** Nearly every older tutorial, and most LLM training data, uses the legacy `doc.autoTable({...})` method-call style (the plugin patches itself onto the `jsPDF` prototype via a side-effect import). As of `jspdf-autotable` v5 — the version actually installed by this phase (5.0.8) — the plugin is **no longer auto-applied in non-browser environments**, and the documented, current API is a **named functional import**.

**Why it happens:** A deliberate v5 breaking change for better ESM/TypeScript support [CITED: github.com/simonbengtsson/jsPDF-AutoTable issue #997, "Propose new exporting API for better ESM & Typescript support"].

**How to avoid:** Use the current functional API. The legacy method-call style still works only if `applyPlugin(jsPDF)` is called first — simpler to just use the functional form directly.

```typescript
// Correct, current (v5) usage:
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"

const doc = new jsPDF({ unit: "pt", format: "a4" })
autoTable(doc, { head: [[...]], body: [[...]] })

// WRONG — legacy v3/v4-era pattern, will throw
// "doc.autoTable is not a function" on jspdf-autotable 5.0.8 without an
// explicit applyPlugin(jsPDF) call first:
// doc.autoTable({ head: [[...]], body: [[...]] })
```

**Warning signs:** `TypeError: doc.autoTable is not a function` at the first PDF export attempt if the legacy call style is used from memory/training data without checking the installed version's current API.

### Pitfall 5: PDF export building from the wrong array

**What goes wrong:** The PDF-building function must consume the exact same filtered, sorted array the on-screen table is currently rendering (`linhasFiltradas`) — not the raw `dados.parcelas` the page fetched. Passing the unfiltered array would silently produce a PDF that disagrees with what the user filtered on screen, directly undermining D-04's promise that the PDF is "o estado atual da tela."

**Why it happens:** Both arrays are in scope in the same client component; it's an easy copy-paste mistake to reach for `dados.parcelas` (the "obvious" full dataset) instead of the derived `linhasFiltradas`.

**How to avoid:** The PDF export function's signature should only accept the already-filtered array (and the already-computed `categorias`), never the raw fetch result — make it structurally impossible to pass the wrong one by not giving the export function access to `dados.parcelas` at all.

**Warning signs:** A PDF that shows more rows than the on-screen table did at export time — only catchable by a filtered export where the counts visibly disagree, so verify this explicitly during human-check.

### Pitfall 6: accented Portuguese characters in jsPDF's default fonts

**What goes wrong:** jsPDF's built-in standard fonts (Helvetica/Times/Courier) use WinAnsiEncoding, which covers the Latin-1 Supplement range (ã, ç, é, ê, í, ó, ô, õ, ú, ü) — this is well-established, common practice for Portuguese/Spanish/French PDF generation with jsPDF and should work out of the box for this report's copy ("Relatório Financeiro", "não", "página", competência month names). This is **training knowledge, not verified against jsPDF 4.2.1's exact font metrics in this session** [ASSUMED].

**Why it happens:** Font-encoding edge cases are exactly the kind of thing that looks fine in most cases but can silently mis-render one character in an unusual combination.

**How to avoid:** Visually sanity-check the exported PDF's header ("Relatório Financeiro"), competência labels (month names like "Agosto"/"Setembro" — no accents there, but check "não foi possível..." error copy if ever mirrored into a PDF context) during the phase's human-check step — don't assume without a visual check.

**Warning signs:** A rendered glyph that looks like a box, question mark, or wrong character where an accented letter should be.

### Pitfall 7: calling a `"use server"` function directly from a Server Component

**What goes wrong:** `buscarParcelasRelatorioAction` is exported from a `"use server"` file and today is only ever called from a client component (`relatorio-financeiro.tsx:54`). Calling it directly from the new Server Component (`relatorios/financeiro/page.tsx`) is a valid, standard Next.js pattern — Server Actions are plain async functions when called server-side, with zero RPC overhead — but its `ActionResult` discriminated-union return shape (`{ ok: false, error }` / `{ ok: true, data }`) must be handled explicitly in the new page, the same way `relatorio-financeiro.tsx` already does, or an `{ ok: false }` response will silently produce a broken page instead of the locked error copy ("Não foi possível carregar o relatório agora. Tente novamente.").

**Why it happens:** It's easy to assume a function marked `"use server"` can only be invoked via the client-server RPC boundary; in practice it is callable exactly like any other async function once you are already executing on the server, and this repo has no existing precedent of a Server Component calling one of these functions directly to copy from.

**How to avoid:** Either call `buscarParcelasRelatorioAction()` directly from the new Server Component and branch on `result.ok` before rendering (mirroring the client component's existing error handling), or replicate its query shape inline in the new page (as `relatorios/page.tsx` does today for `columns`) — both are valid; the planner should pick one explicitly rather than leave the error path unhandled.

## Code Examples

### Live filter — deriving both tiles and rows from one fetch

```typescript
// Adapted from web/src/components/reports/relatorio-financeiro.tsx:43-49
// (existing, shipped pattern — this phase removes the `aplicado`/click gate)
const categorias = React.useMemo(
  () => calcularRelatorioFinanceiro(dados.parcelas, filtro, dados.hojeISO),
  [filtro, dados]
)

const linhasFiltradas = React.useMemo(() => {
  return dados.parcelas
    .filter((p) => {
      const endereco = p.cards?.endereco ?? ""
      const proprietario = p.cards?.proprietario ?? ""
      if (!passaFiltroTexto(endereco, filtro.imovel)) return false
      if (!passaFiltroTexto(proprietario, filtro.proprietario)) return false
      if (!passaFiltroPeriodo(p.competencia, filtro.periodo)) return false
      const situacao = situacaoDaParcela(p.status, p.vencimento, dados.hojeISO)
      if (filtro.situacoes.size > 0 && !filtro.situacoes.has(situacao)) return false
      return true
    })
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0))
}, [filtro, dados])
```

### PDF export — functional `jspdf-autotable` v5 API, repeating headers, page-number footer

```typescript
// Source: jspdf-autotable v5.0.8 functional API [CITED: github.com/simonbengtsson/jsPDF-AutoTable
// issue #997]; repeating-header default behavior [CITED: github.com/simonbengtsson/jsPDF-AutoTable
// issue #78]. Never import at module scope — see Common Pitfall #3.
async function exportarRelatorioPDF(
  linhas: LinhaRelatorioParcela[],
  categorias: CategoriaRelatorio[],
  filtro: FiltroRelatorioValores,
  geradoEmISO: string
) {
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })

  // Header block — title, generation timestamp, applied-filters table.
  doc.setFontSize(18)
  doc.text("Relatório Financeiro", 40, 50)
  // ... "Gerado em {data} às {hora}" via formatInstantDate/hojeEmCuiaba,
  // then a bordered label:value table for imóvel/proprietário/período/situação.

  // Summary block — 4 totals, same CategoriaRelatorio[] the on-screen tiles show.
  // ... compact bordered row/table, per PDF Export Layout Contract §3.

  autoTable(doc, {
    startY: 160, // below header + summary blocks
    head: [["Imóvel", "Proprietário", "Competência", "Vencimento", "Situação", "Valor"]],
    body: linhas.map((l) => [l.endereco, l.proprietario, l.competenciaLabel, l.vencimentoLabel, l.situacaoLabel, l.valorLabel]),
    headerRows: 1, // repeats on every new page — this IS the default, explicit for clarity
    styles: { fontSize: 9 },
    headStyles: { fontStyle: "bold", fillColor: undefined }, // no heavy fill, per PDF contract §8 palette
  })

  // Footer — page numbers require a second pass: total page count is only
  // known after autoTable has finished laying out all rows.
  const totalPaginas = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.text(`Página ${i} de ${totalPaginas}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" })
    doc.text(`Kanban Aluguel — gerado em ${geradoEmISO}`, 40, doc.internal.pageSize.getHeight() - 20)
  }

  doc.save(`relatorio-financeiro-${geradoEmISO}.pdf`)
}
```

### Additive `className` — `FilterChip` (no naming collision, simpler case)

```tsx
// Source: web/src/components/reports/reports-view.tsx:37-61, current signature
// [VERIFIED: web/src/components/reports/reports-view.tsx:37-45]:
export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {

// Required additive change:
export function FilterChip({
  active,
  children,
  onClick,
  className,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| `doc.autoTable({...})` — plugin auto-patched onto the `jsPDF` prototype via side-effect import | `import { autoTable } from "jspdf-autotable"; autoTable(doc, {...})` — explicit functional call | `jspdf-autotable` v5.0.0 [CITED: GitHub issue #997] | Training-data code examples using the legacy method-call style will throw `doc.autoTable is not a function` on the version this phase installs (5.0.8) unless `applyPlugin(jsPDF)` is called first — see Common Pitfall #4 |
| `next dev --turbopack` / `next build --turbopack` (explicit flag required) | `next dev` / `next build` (Turbopack is the default) | Next.js 16.0 [CITED: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`, "Turbopack by default"] | This project's `package.json` scripts already reflect the new default (`"dev": "next dev"`, `"build": "next build"`, no flag) [VERIFIED: web/package.json:6-9] — confirms this app is already building with Turbopack, which is the exact reason PDF-library Node-native-dependency risk (jsPDF/jspdf-autotable have none) mattered for this research |
| Synchronous `params`/`searchParams`/`cookies()` access | Fully async-only | Next.js 16.0 [CITED: version-16.md, "Async Request APIs (Breaking change)"] | Not applicable to this phase's new route — `relatorios/financeiro/page.tsx` has no dynamic segments and no `searchParams` usage, same as `relatorios/page.tsx` today |

**Deprecated/outdated:** `next/legacy/image`, `middleware.ts` (renamed `proxy.ts`), `images.domains` config — none of these are touched by this phase; noted only because `web/AGENTS.md` requires checking the local Next.js 16 docs before recommending any API, and none of the breaking changes in `version-16.md` affect a static, non-dynamic App Router page.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | jsPDF's default WinAnsiEncoding-based standard fonts render Portuguese accented characters (ã, ç, é, etc.) correctly without embedding a custom font | Common Pitfalls #6 | Low — worst case is a visually broken glyph in the PDF title/labels, caught immediately by the phase's required human-check of the exported PDF; fix is a one-line custom-font addition (e.g. `doc.addFont(...)` with a Unicode TTF) if needed |

**If this table is empty:** N/A — one low-risk assumption logged above; every other claim in this research was verified via `Read`, `npm view`, the package-legitimacy seam, or a cited official source (Next.js bundled docs, jsPDF-AutoTable's own GitHub issue tracker).

## Open Questions

None outstanding — both of `10-CONTEXT.md`'s "Claude's Discretion" items (data strategy, PDF library) are resolved above with a single, actionable recommendation each, and the two code-level discrepancies found (unexported filter helpers, the `className` naming collision) are documented as concrete, cheap fixes rather than open decisions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Next.js 16 runtime (min 20.9.0) | ✓ | v24.15.0 [VERIFIED: `node --version`] | — |
| npm | package installation | ✓ | 11.12.1 [VERIFIED: `npm --version`] | — |
| jspdf (npm registry) | PDF generation | ✓ | 4.2.1 [VERIFIED: `npm view jspdf version`] | — |
| jspdf-autotable (npm registry) | Multi-page PDF table | ✓ | 5.0.8 [VERIFIED: `npm view jspdf-autotable version`] | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — both required packages resolved cleanly against the live registry in this session.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | no | Unchanged — Supabase Auth session cookie, untouched by this phase |
| V3 Session Management | no | Unchanged |
| V4 Access Control | yes | RLS via `is_team_member()` on `parcelas`/`cards` (Phase 4), reused verbatim — this phase's Server Component query uses the same session-scoped Supabase client pattern as `relatorios/page.tsx`/`buscarParcelasRelatorioAction`, never `service_role` |
| V5 Input Validation | yes (minimal surface) | The only user input in this phase (the four filter fields) never reaches a SQL query at all — the "fetch once, filter in memory" strategy (Claude's Discretion, confirmed sound above) means there is no parameterization surface, and therefore no SQL-injection vector, for this feature's filter inputs. React JSX auto-escapes on-screen rendering; jsPDF's `.text()` API takes literal strings (not HTML/markup), so there is no injection surface in the PDF path either |
| V6 Cryptography | no | Not applicable — no new secrets, tokens, or crypto operations introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| A client-crafted `situacoes` filter value outside the 4-value `SituacaoRelatorio` union | Tampering | TypeScript's literal union type at compile time; at runtime `calcularRelatorioFinanceiro`'s `Map` lookup is bounded to the 4 known keys `situacaoDaParcela` can ever produce — an unrecognized value simply fails the `filtro.situacoes.has(...)` check rather than crashing |
| Calling `buscarParcelasRelatorioAction`/its query shape directly from a Server Component, bypassing the client wrapper's `requireUser()` → error-copy handling | Information Disclosure (weak — auth itself is not bypassable) | The `requireUser()` guard (or RLS-backed equivalent) must run inside the new Server Component's own code path too, not only assumed from the client component's existing error handling — RLS is defense-in-depth even if an app-level check were accidentally skipped |
| PDF export built from a stale or unfiltered in-memory snapshot instead of the currently-displayed filtered rows | Tampering (data-integrity, not confidentiality) | Build the PDF strictly from `linhasFiltradas`/`categorias` already derived on screen, never from the raw fetch result — see Common Pitfall #5 |

## Sources

### Primary (HIGH confidence)
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` — Next.js 16 breaking-changes list, read in full this session
- `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md` — Turbopack configuration/behavior, read in full this session
- `npm view jspdf version` / `npm view jspdf-autotable version` / `npm view jspdf-autotable peerDependencies` / `npm view @react-pdf/renderer peerDependencies` — live npm registry queries, this session
- `gsd_run query package-legitimacy check --ecosystem npm jspdf jspdf-autotable @react-pdf/renderer html2canvas` — legitimacy seam output, this session
- Direct `Read` of `web/src/lib/kanban/relatorio-financeiro.ts`, `web/src/components/reports/relatorio-financeiro.tsx`, `web/src/components/reports/filtro-relatorio-financeiro.tsx`, `web/src/components/reports/reports-view.tsx`, `web/src/components/financeiro/parcela-situacao-badge.tsx`, `web/src/components/financeiro/parcelas-table.tsx`, `web/src/lib/kanban/parcelas.ts`, `web/src/lib/kanban/format.ts`, `web/src/lib/kanban/actions.ts` (`buscarParcelasRelatorioAction`), `web/src/app/(app)/relatorios/page.tsx`, `web/src/lib/utils.ts` — this session

### Secondary (MEDIUM confidence)
- github.com/simonbengtsson/jsPDF-AutoTable, issue #997 ("Propose new exporting API for better ESM & Typescript support") — WebSearch, confirmed against the actually-installed 5.0.8 version's `package.json` `exports` field
- github.com/simonbengtsson/jsPDF-AutoTable, issue #78 ("Prevent repeated header row on multiple pages") — WebSearch, confirming repeating-header default behavior

### Tertiary (LOW confidence)
- General WebSearch results on jsPDF + Next.js App Router SSR integration (`document is not defined` failure mode, dynamic-import fix) — consistent across multiple independent community sources (Medium, dev.to, GitHub issues), but not an official Next.js or jsPDF doc; treated as corroborating community consensus rather than an authoritative source

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — both recommended packages verified live against the npm registry and the legitimacy seam this session, with peer-dependency compatibility confirmed against this repo's exact React/Next versions
- Architecture: HIGH — every reused pattern (fetch-once-filter-in-memory, Server Component → Client Component prop passing, additive `className`) was verified by reading the actual current source files, not assumed from the UI-SPEC's description of them
- Pitfalls: HIGH — the two code-level discrepancies (unexported filter helpers, `className` naming collision) were found by reading the actual files, not inferred; the jspdf-autotable v5 API pitfall was confirmed against the specific installed version's `package.json` `exports` field, not just general web search

**Research date:** 2026-08-21
**Valid until:** 14 days (PDF library versions/APIs move faster than this app's other dependencies — re-run `npm view jspdf version`/`npm view jspdf-autotable version` before executing if this research is more than 2 weeks old; the Next.js 16/Turbopack findings are stable for the standard 30-day window)
