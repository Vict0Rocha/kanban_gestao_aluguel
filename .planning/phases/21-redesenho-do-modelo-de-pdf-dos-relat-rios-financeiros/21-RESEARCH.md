# Phase 21: Redesenho do modelo de PDF dos relatórios financeiros - Research

**Researched:** 2026-08-28
**Domain:** `jspdf`/`jspdf-autotable` client-side PDF rendering (no new library, no backend/DB involvement)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Orientação e escopo**
- **D-01:** Os dois PDFs passam para **paisagem** (landscape), A4. Confirmado explicitamente pelo usuário.
- **D-02:** O redesenho vale para **os dois PDFs** — Relatório Financeiro dedicado e Dinheiro da imobiliária — com o mesmo visual novo (paleta, estilo de linha, cabeçalho/Total). Cada PDF mantém suas próprias colunas de dado, sem mudança nenhuma nelas nesta fase: Relatório Financeiro continua com Imóvel/Proprietário/Competência/Vencimento/Situação/Valor; Dinheiro da imobiliária continua com Data/Contrato (ID+proprietário)/Inquilino/Tipo/Valor/Observação (já ajustado na Phase 20 para espelhar a tela). **⚠️ See Pitfall 4 below — this parenthetical does not match `reconciliacao-pdf.ts`'s actual current columns; the operative clause ("sem mudança nenhuma nelas nesta fase") controls, and the file's real current 5-column layout is the baseline to preserve.**

**Paleta de cores**
- **D-03:** Paleta cinza, substituindo o verde inteiro do contrato atual — sem nenhuma cor viva (verde, vermelho ou azul saturado) em lugar nenhum do documento:
  - Texto principal: cinza bem escuro, quase preto (`#262626`)
  - Fundo do cabeçalho da tabela e da linha de Total: cinza bem claro (`#f2f2f2`)
  - Bordas/linhas: cinza (`#d9d9d9`)
  - Texto mudo (rótulos, rodapé): um cinza intermediário — o researcher escolhe o tom exato dentro da mesma família neutra, sem inventar uma cor fora dela
  - Confirmado explicitamente pelo usuário depois do researcher propor os hex acima como ponto de partida.

**Estilo da lista**
- **D-04:** A lista (a tabela principal, com as linhas de movimento/parcela) usa **linha horizontal sutil** separando cada linha — **sem** borda vertical entre colunas (não é grade completa, ao contrário da primeira ideia discutida) — mais **zebra**: linhas alternando branco e cinza bem claro. Decisão final, confirmada explicitamente pelo usuário depois de mudar de ideia sobre grade completa.
- **D-05:** O cabeçalho da tabela (nomes das colunas) e a nova linha de Total têm fundo cinza claro (`#f2f2f2`) e texto em negrito — únicos elementos com fundo sólido na lista, contrastando com o corpo (branco/zebra).

**Linha de Total (nova)**
- **D-06:** Uma linha **"Total"** nova, no final da lista (última linha da tabela), em negrito, com o mesmo fundo cinza do cabeçalho — soma a coluna **Valor** de todas as linhas efetivamente listadas no PDF (ou seja, já respeitando qualquer filtro aplicado — a mesma lista que o corpo da tabela mostra, nunca um total não-filtrado). Não existia antes em nenhum dos dois PDFs.

**Blocos estruturais (mantidos, só o visual muda)**
- **D-07:** Os três blocos que já existem em cada PDF — (1) título + timestamp de geração, (2) tabela compacta de filtros aplicados, (3) bloco de totais/resumo (as 4 categorias no Relatório Financeiro, os 6 totais no Dinheiro da imobiliária) — **continuam existindo, sem cortar nenhum**, só passam a usar a nova paleta cinza em vez do verde atual. Confirmado explicitamente pelo usuário ("mantém os 3, só troca o visual") depois do researcher perguntar se algum deveria ser cortado por "poluir".

**Referência visual**
- **D-08:** O usuário anexou um print de um relatório do software Sienge ("Contas a Pagar por Apropriação Financeira") — explicitamente **não é para copiar igual**, é só um guia de estilo geral (tabela em grade, cabeçalho/total com fundo sutil, alinhamento numérico à direita, visual limpo tipo planilha/ERP corporativo), a adaptar para a realidade mais simples deste projeto.

### Claude's Discretion

- Tom exato do cinza de texto mudo (rótulos/rodapé) — dentro da mesma família neutra dos hex já travados. **Resolved this session: `#6b6b6b` — see Pattern 3, tagged `[ASSUMED]` (A1 in Assumptions Log).**
- Tamanhos de fonte/margens exatos para a versão paisagem — pode reusar os valores atuais (9-10pt corpo, 18-20pt título) se couberem bem na largura maior, ou ajustar levemente; não é uma decisão de produto. **Resolved this session: reuse current values unchanged — see Pattern 3 (A3 in Assumptions Log).**
- Mecanismo exato do `jspdf-autotable` para produzir "sem borda vertical + linha horizontal sutil + zebra" (tema `"plain"` com `borderStyle` customizado, ou outra combinação de opções da biblioteca) — decisão técnica do researcher/planner. **Resolved this session: `theme:"plain"` + `styles.lineWidth: {top:0,right:0,bottom:X,left:0}` — see Pattern 1, `[VERIFIED]` against installed source.**
- Se o "PDF Export Layout Contract" em `10-UI-SPEC.md` deve ser atualizado in-place para refletir a nova paleta/estilo, ou se um novo documento substitui/complementa — decisão de onde documentar, não do que documentar. **Not resolved by this research — genuinely a documentation-location choice, no technical basis to prefer one option; left as Open Question 1 for the planner.**

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. No pending todos folded into this phase.

</user_constraints>

## Summary

This phase is a pure visual restyle of two already-shipped, structurally-mirrored PDF export modules (`relatorio-financeiro-pdf.ts`, `reconciliacao-pdf.ts`). No new npm dependency, no database/migration, no Server Action change, no on-screen component change — everything happens inside the two PDF modules, which already run entirely client-side (dynamic `import()` inside the exported function, confirmed in both files, to avoid breaking SSR of their Server Component parent routes).

Every technical mechanism CONTEXT.md left as "Claude's Discretion" was resolved by reading the **actually-installed** `jspdf-autotable@5.0.8` runtime source (`node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs`), not its `.d.ts` alone and not community docs: (1) per-side `lineWidth` (`{top,right,bottom,left}`) is natively supported by the installed version's cell-drawing code — general web search results claiming otherwise describe stale, older major versions of this library and must be disregarded for this phase; (2) a distinctly-styled Total row is implemented via the `foot`/`footStyles`/`showFoot` options (confirmed present and correctly wired in the installed runtime), not via a `didParseCell` hook on the last body row; (3) `columnStyles` — already used today for right-aligning the Valor column — does **not** apply to the `foot` section in this version, a genuine gotcha that would silently left-align the new Total row's amount if not handled explicitly.

**Primary recommendation:** `theme: "plain"` + explicit `styles.lineWidth = { top: 0, right: 0, bottom: 0.75, left: 0 }` for the list table (horizontal rule only, no vertical grid), `alternateRowStyles.fillColor` for zebra (already used today, orthogonal to lineWidth, no conflict), `headStyles`/`footStyles` with solid `#f2f2f2` fill + bold for the header row and the new Total row, and `foot: [[{content:"Total", colSpan:N-1}, {content: formatCurrency(total), styles:{halign:"right"}}]]` with `showFoot: "lastPage"` to prevent the total from repeating on every page of a multi-page export.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PDF page orientation/layout (A4 landscape) | Browser / Client | — | `new jsPDF(...)` runs inside the exported function, only ever invoked from a `"use client"` component's `onClick` handler; `jspdf`/`jspdf-autotable` are dynamically `import()`-ed to avoid executing at module scope during the parent route's SSR pass |
| Color palette / typography recolor | Browser / Client | — | Same functions, same files — pure rendering constants, no data flows through them |
| Total row computation (sum of Valor) | Browser / Client | — | Computed inside the PDF module from `linhas`, which the caller has already filtered client-side (`useMemo` in `relatorio-financeiro-dedicado.tsx`/`dinheiro-imobiliaria-view.tsx`) — no new query, no server round-trip |
| Existing 3 structural blocks (title, filtros, resumo) | Browser / Client | — | Unchanged in structure per D-07, only their `theme:"grid"` color constants move tiers-internally (still client-side `autoTable` calls) |

No capability in this phase touches Frontend Server (SSR), API/Backend, CDN/Static, or Database/Storage — confirmed by reading both PDF modules in full: no `fetch`, no Server Action import, no Supabase client.

## Standard Stack

### Core
| Library | Version (installed, verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jspdf` | `4.2.1` [VERIFIED: web/package.json, confirmed via `require('jspdf/package.json').version`] | PDF document construction (`new jsPDF(...)`, `doc.text`, `doc.setFont`, `doc.getNumberOfPages`) | Already the project's chosen library since Phase 10; no reason to replace for a styling-only phase |
| `jspdf-autotable` | `5.0.8` [VERIFIED: web/node_modules/jspdf-autotable/package.json:3, `"version": "5.0.8"`] | Table layout plugin (`autoTable(doc, options)`) — used for all 3 structural blocks + the list | Same as above; the version installed exposes exactly the `foot`/`footStyles`/per-side `lineWidth` mechanics this phase needs, confirmed by direct source read (see Code Examples) |

No new package is required. **Zero new npm dependency for this phase.**

### Supporting
None — this phase adds no new library.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `foot`/`footStyles` for the Total row | `didParseCell`/`willDrawCell` hook checking `row.index === body.length - 1` on a normal body row | Hook approach works but is more code, harder to keep the row from participating in `alternateRowStyles`'s zebra logic (zebra only applies to `body` section rows, confirmed in source — a body-row "Total" would need an extra guard to suppress its own zebra fill). `foot` is structurally exempt from zebra by construction (different section), matching D-05's "only two rows with a solid, non-alternating fill" requirement for free. |
| Per-side `lineWidth` object | `didDrawCell` hook manually calling `doc.setLineWidth`+`doc.line(...)` | This was the correct approach in **older** `jspdf-autotable` major versions (per stale GitHub issues, see Pitfall 1) — unnecessary in the installed 5.0.8, which resolves `Partial<LineWidths>` natively (`drawCellBorders`, verified in source). Using a hook here would be redundant extra code duplicating built-in behavior. |

**Installation:** None — no `npm install` needed this phase.

**Version verification:** Verified via direct file read, not `npm view` (offline-safe, more precise than a registry lookup for confirming exactly what's on disk): `web/node_modules/jspdf-autotable/package.json:3` → `"version": "5.0.8"`; `require('jspdf/package.json').version` → `4.2.1`. Matches `web/package.json`'s declared ranges (`^4.2.1`, `^5.0.8`).

## Package Legitimacy Audit

**Not applicable — this phase installs zero new packages.** Both `jspdf` and `jspdf-autotable` are pre-existing, already-audited dependencies from Phase 10 (`10-RESEARCH.md`) and unchanged by this phase's scope. No `package-legitimacy check` run needed; no new entry in `package.json`.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Exportar PDF" (client component)
        │
        ▼
handleExportarPDF() — already-filtered `linhas`/`totais`/`filtro` (from useMemo)
        │
        ▼
exportarRelatorioFinanceiroPDF() / exportarReconciliacaoPDF()   [Browser/Client, jspdf-autotable]
        │
        ├─► dynamic import() jsPDF, jspdf-autotable  (SSR-safe pitfall, unchanged)
        │
        ├─► new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })   ◄── D-01 (this phase)
        │
        ├─► Block 1: título + timestamp (doc.text)                              ◄── recolor only (D-07)
        │
        ├─► Block 2: autoTable theme:"grid" — filtros aplicados                 ◄── recolor only (D-07)
        │
        ├─► Block 3: autoTable theme:"grid" — resumo/totais                     ◄── recolor only (D-07)
        │
        ├─► Block 4: autoTable — lista principal                                ◄── D-03/D-04/D-05/D-06 (this phase)
        │        │
        │        ├─ body: linhas.map(...) → same columns as today, per module
        │        ├─ theme:"plain" + styles.lineWidth {bottom-only} + lineColor #d9d9d9
        │        ├─ alternateRowStyles.fillColor (zebra, body-only by construction)
        │        ├─ headStyles: fillColor #f2f2f2, bold
        │        └─ foot: [["Total", ..., sum]], footStyles: fillColor #f2f2f2, bold, showFoot:"lastPage"
        │
        └─► Rodapé (todas as páginas, doc.getNumberOfPages loop)                ◄── recolor only (D-07)
        │
        ▼
doc.save(`<nome>-${hojeISO}.pdf`)   — browser download, no server involved
```

### Recommended Project Structure

No new files. Both modules keep their current location and shape:
```
web/src/components/reports/
├── relatorio-financeiro-pdf.ts   # recolor + landscape + Total row (this phase)
└── reconciliacao-pdf.ts          # recolor + landscape + Total row (this phase, mirrored)
```

### Pattern 1: Horizontal-rule-only + zebra list table

**What:** `theme: "plain"` (which, per the installed theme table, sets `lineWidth: 0` everywhere by default and only bolds head/foot text — no fill, no borders) as the base, then an explicit `styles.lineWidth` object that draws **only the bottom edge** of every cell.

**Why bottom-only, not top+bottom:** Two adjacent rows each drawing their own border would double-render/thicken the shared boundary line (each cell draws its own edges independently — confirmed in `drawCellBorders`, see Code Examples). Setting only `bottom` on the shared style gives exactly one clean rule per row boundary, and the last body row's bottom edge closes off the list before the Total row's own (inherited) bottom edge.

**When to use:** The list table in both modules — this is D-04's exact requirement ("linha horizontal sutil... sem borda vertical... mais zebra").

**Example:**
```typescript
// Source: jspdf-autotable@5.0.8 installed source, verified this session:
// - Styles.lineWidth: number | Partial<LineWidths> — node_modules/jspdf-autotable/dist/index.d.ts:189
// - Runtime honors the object form per-side — node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs:1899-1970 (drawCellBorders)
// - theme:"plain" leaves lineWidth at defaultStyles' 0 (no theme.table override) — jspdf.plugin.autotable.mjs:255-308

autoTable(doc, {
  startY: afterResumoY + 16,
  theme: "plain",
  head: [["Imóvel", "Proprietário", "Competência", "Vencimento", "Situação", "Valor"]],
  body: bodyRows.map((r) => r.cells),
  foot: [[
    { content: "Total", colSpan: 5 },
    { content: formatCurrency(totalValor), styles: { halign: "right" } },
  ]],
  showFoot: "lastPage",
  showHead: "everyPage",
  styles: {
    fontSize: 9,
    textColor: foreground,          // #262626
    lineColor: border,              // #d9d9d9
    lineWidth: { top: 0, right: 0, bottom: 0.75, left: 0 },
    cellPadding: 5,
  },
  headStyles: {
    fontStyle: "bold",
    fillColor: headerFill,          // #f2f2f2
    textColor: foreground,
  },
  footStyles: {
    fontStyle: "bold",
    fillColor: headerFill,          // #f2f2f2 — same as header, D-06
    textColor: foreground,
  },
  alternateRowStyles: { fillColor: rowShade }, // #f7f7f7-ish very light gray, zebra
  columnStyles: { 5: { halign: "right" } },    // applies to body only (see Pitfall 2) — Valor column
})
```

### Pattern 2: Total row via `foot`, not a body-row hook

**What:** Use `UserOptions.foot`/`footStyles`/`showFoot` — all three confirmed present in the installed 5.0.8 type surface (`node_modules/jspdf-autotable/dist/index.d.ts:60,71,217,226`) and correctly wired at runtime (`jspdf.plugin.autotable.mjs:731-741` builds `showFoot`, `:1631-1633`/`:1988-1989` render `table.foot` rows gated on `showFoot`).

**When to use:** Any time a table needs a final summary row visually distinct from — and never zebra-striped alongside — the body. This is exactly D-06's requirement.

**Example (Relatório Financeiro — Valor is column index 5, per D-02 unchanged):**
```typescript
// Compute once, share between `body` and the `foot` sum — never re-derive the
// per-row Valor a second way (RESEARCH.md task's own instruction #5: the
// Total row must sum the SAME value already computed per row, situação-
// dependent — pagas/conciliadas use valorPago, a_vencer/vencidas use
// Math.max(valorDevido - valorPago, 0), exactly as today's body.map already does).
const bodyRows = linhas.map((l) => {
  const situacao = situacaoDaParcela(l.status, l.vencimento, hojeISO) as SituacaoRelatorio
  const { valorDevido, valorPago } = somarLancamentos(l.valor_original, l.parcela_lancamentos)
  const valor =
    situacao === "paga" || situacao === "conciliada"
      ? valorPago
      : Math.max(valorDevido - valorPago, 0)
  return {
    valor,
    cells: [
      l.cards?.endereco ?? "",
      l.cards?.proprietario ?? "",
      competenciaLabelLinha(l.competencia),
      formatDate(l.vencimento),
      SITUACAO_ROTULO_SINGULAR[situacao],
      formatCurrency(valor),
    ],
  }
})
const totalValor = bodyRows.reduce((acc, r) => acc + r.valor, 0)

autoTable(doc, {
  // ...styles from Pattern 1 above...
  body: bodyRows.map((r) => r.cells),
  foot: [[
    { content: "Total", colSpan: 5 },
    // halign set directly on the cell — columnStyles does NOT reach `foot` (Pitfall 2)
    { content: formatCurrency(totalValor), styles: { halign: "right" } },
  ]],
  showFoot: "lastPage", // NOT the default "everyPage" — see Pitfall 3
})
```

**Example (Dinheiro da imobiliária — Valor is column index 3, 5 columns total, no situação branching):**
```typescript
// linhas already carries a flat `.valor` per row (taxa or caução, unified in
// dinheiro-imobiliaria-view.tsx) — no per-row derivation needed here, unlike
// the Relatório Financeiro module above.
const totalValor = linhas.reduce((acc, l) => acc + l.valor, 0)

autoTable(doc, {
  // ...styles from Pattern 1...
  head: [["Data", "Contrato", "Tipo", "Valor", "Observação"]],
  body: linhas.map((l) => [
    formatDate(l.data),
    `#${l.cards?.numero ?? 0} ${l.cards?.endereco ?? ""}`,
    l.tipoLabel,
    formatCurrency(l.valor),
    l.observacao ?? "",
  ]),
  foot: [[
    { content: "Total", colSpan: 3 },
    { content: formatCurrency(totalValor), styles: { halign: "right" } },
    "",
  ]],
  showFoot: "lastPage",
})
```

### Pattern 3: Landscape constructor + gray constants (both modules identically)

```typescript
// Source: node_modules/jspdf/types/index.d.ts:642 — orientation?: "p" | "portrait" | "l" | "landscape"
const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })

// New gray palette — replaces the old green constants byte-for-byte in both files.
const foreground: [number, number, number] = [38, 38, 38]    // #262626 (D-03, locked)
const headerFill: [number, number, number] = [242, 242, 242] // #f2f2f2 (D-03, locked — header + Total row)
const border: [number, number, number] = [217, 217, 217]     // #d9d9d9 (D-03, locked)
const muted: [number, number, number] = [107, 107, 107]      // #6b6b6b — RESEARCHER PICK, see below
const rowShade: [number, number, number] = [247, 247, 247]   // very light gray zebra fill, distinct from headerFill
```

**Muted gray pick (`#6b6b6b`):** CONTEXT.md explicitly delegates the exact tone to the researcher, constrained to "a natural extension of `#262626`, within the same neutral family." `#6b6b6b` sits roughly at the midpoint between the near-black foreground (`#262626`) and the light border (`#d9d9d9`), mirroring the same relative-lightness relationship the old palette had between its foreground (`#18341c`) and its muted tone (`#5c7060`) — used for the same two roles (labels, footer). `[ASSUMED]` — not verified against a formal contrast checker tool this session; risk is purely cosmetic (label/footer legibility), not a locked decision, and the value is trivially adjustable if the user wants it lighter/darker after seeing the rendered PDF.

**Landscape page dimensions (verified):** A4 landscape is `841.89 × 595.28` pt, versus portrait's `595.28 × 841.89` pt — confirmed by reading `node_modules/jspdf/dist/jspdf.node.js:1092` (`a4: [595.28, 841.89]`) plus the constructor's documented orientation-swap behavior (`:995,4168`). `pageWidth = doc.internal.pageSize.getWidth()` (already used in both files) picks this up automatically — no hardcoding needed.

**`marginX = 40` and the `cellWidth: 90` label column (Blocks 2/3):** No change needed. These are body-only `theme:"grid"` tables (no `head`/`foot` option), so `columnStyles` fully applies (confirmed — the body-only restriction in Pitfall 2 only affects tables that also declare a `head`/`foot`). A fixed 90pt label column becomes proportionally *narrower* on the wider landscape page (90/841.89 ≈ 10.7% vs 90/595.28 ≈ 15.1% today) — visually safe, no adjustment required. `marginX` staying at 40pt is `[ASSUMED]` low-risk (CONTEXT.md's discretion note explicitly allows reusing current values if they "couberem bem" — they do, since landscape only adds width).

### Anti-Patterns to Avoid
- **Trusting general web search for jspdf-autotable border behavior over the installed source:** WebSearch results for "lineWidth per side" surfaced old GitHub issues (`simonbengtsson/jsPDF-AutoTable#398`, `#637`) describing versions where per-side border width wasn't supported and a `didDrawCell` hook was required. The **installed** 5.0.8 supports it natively (see Pitfall 1) — do not implement the hook workaround, it would be redundant dead code fighting a feature the library already has.
- **Relying on `columnStyles` to right-align the Total row's amount:** it silently won't — see Pitfall 2. Set `halign` on the `foot` cell's own `styles` instead.
- **Leaving `showFoot` at its default:** the default is `"everyPage"` (verified in source, `jspdf.plugin.autotable.mjs:739`), which would repeat the whole-list Total on every page of a filtered export spanning 2+ pages — misleading on a multi-page document where the total is NOT a per-page subtotal. Always set `showFoot: "lastPage"` explicitly.
- **Setting both `top` and `bottom` lineWidth on the same style:** doubles/thickens the rendered line at each row boundary, since each cell draws its own borders independently (`drawCellBorders`). Use `bottom` only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-row horizontal rule with no vertical lines | A custom `didDrawCell` hook calling `doc.line(...)` manually | `styles.lineWidth: { top:0, right:0, bottom:X, left:0 }` | Natively supported by the installed 5.0.8 runtime (verified in source) — a hook would duplicate ~15 lines of logic (`drawCellBorders`) the library already runs for you |
| Distinctly-styled final summary row | A body row + `didParseCell` hook checking `row.index === lastIndex` | `foot`/`footStyles`/`showFoot` | Structurally exempt from `alternateRowStyles` zebra by section, and from `columnStyles`'s body-only scoping being a footgun rather than a feature — using `foot` sidesteps both issues cleanly |
| Sum of the Total row's Valor column | Re-deriving the per-row financial value a second time (e.g., recomputing `situacaoDaParcela`/`somarLancamentos` inline again inside a separate reduce) | Compute the per-row value ONCE (in `bodyRows`), reuse it both for the rendered cell and the sum | Two independent implementations of the same situação-dependent formula (pagas/conciliadas = `valorPago`, a_vencer/vencidas = `Math.max(valorDevido - valorPago, 0)`) are a bug magnet — any future edit to one and not the other silently desyncs the displayed rows from the printed Total |

**Key insight:** Every mechanic this phase needs is already exposed by the exact `jspdf-autotable` version already installed — no library upgrade, no new dependency, no hook-based workaround is required anywhere in this phase.

## Common Pitfalls

### Pitfall 1: Community docs/GitHub issues about jspdf-autotable border options are version-stale
**What goes wrong:** Implementing a `didDrawCell`/manual `doc.setLineWidth`+`doc.line()` workaround for per-side borders, believing (from WebSearch results referencing `simonbengtsson/jsPDF-AutoTable` issues #398/#637) that `lineWidth` only accepts a single scalar in this library.
**Why it happens:** Those GitHub issues are from older major versions. The **installed** `jspdf-autotable@5.0.8` accepts `Partial<LineWidths>` (`{top,right,bottom,left}`) both in its types (`index.d.ts:189`) and its runtime cell-drawing code (`jspdf.plugin.autotable.mjs:1899-1970`, function `drawCellBorders`), confirmed by reading the actual installed `.mjs` bundle this session — not by trusting the type file alone, and not by trusting search results.
**How to avoid:** Use the native `Partial<LineWidths>` object directly (Pattern 1 above); do not add a hook.
**Warning signs:** If a future contributor "fixes" this by adding a `didDrawCell`/`willDrawCell` hook that manually draws lines, that's a sign they didn't check the installed version's actual capability.

### Pitfall 2: `columnStyles` does not reach the `foot` section
**What goes wrong:** Reusing the existing `columnStyles: { 5: { halign: "right" } }` (or `{3: {...}}` for reconciliacao) and expecting it to also right-align the new Total row's amount cell — it silently won't, leaving the Total's number left-aligned while the rows above it are right-aligned.
**Why it happens:** Verified in source: `var colStyles = sectionName === 'body' ? columnStyles : {}` (`jspdf.plugin.autotable.mjs:1518`) — `columnStyles` is explicitly gated to `body` rows only; `head`/`foot` never receive it.
**How to avoid:** Set `halign: "right"` directly on the `foot` row's amount `CellDef.styles` (see Pattern 2's code sketches) — per-cell `styles` on a `CellDef` is applied last in the merge order (`assign(themeStyles, cellInputStyles)`, `jspdf.plugin.autotable.mjs:1524`) and always wins.
**Warning signs:** Total row renders with the label left-aligned (correct) but the amount also left-aligned, out of visual alignment with every value above it.

### Pitfall 3: `showFoot` defaults to `"everyPage"`
**What goes wrong:** A grand Total repeating identically at the bottom of every page of a multi-page PDF, looking like (and being misread as) a per-page subtotal — production already has 350+ parcelas, so a filtered-down export spanning 2+ pages is a realistic scenario (the existing `showHead: "everyPage"` comment in both files already documents this exact scale concern for the header row).
**Why it happens:** Verified default in source: `showFoot = (_b = options.showFoot) !== null && _b !== void 0 ? _b : 'everyPage'` (`jspdf.plugin.autotable.mjs:739`).
**How to avoid:** Explicitly pass `showFoot: "lastPage"`.
**Warning signs:** Exporting a filtered PDF long enough to span 2+ pages and seeing "Total: R$ X" identically at the bottom of page 1 and page 2.

### Pitfall 4: `reconciliacao-pdf.ts`'s actual current columns do not match CONTEXT.md D-02's parenthetical description
**What goes wrong:** Assuming the Dinheiro da imobiliária PDF already has 6 columns including "Inquilino" (as D-02 states parenthetically) and either leaving it that way in the plan, or — worse — silently "fixing" it to add Inquilino/switch Contrato to proprietário under the belief that's just restoring an already-existing state, when D-02 elsewhere explicitly locks "sem mudança nenhuma" in either PDF's columns this phase.
**Why it happens:** CONTEXT.md D-02 says: *"Dinheiro da imobiliária continua com Data/Contrato (ID+proprietário)/Inquilino/Tipo/Valor/Observação (já ajustado na Phase 20 para espelhar a tela)"* — this describes the Phase 20 **on-screen table** columns (`dinheiro-imobiliaria-view.tsx`, verified this session — its `<TableHead>` row is literally `Data / Contrato / Inquilino / Tipo / Valor / Observação`, and its "Contrato" cell renders `<IdPill/>` + `linha.cards?.proprietario`). But `reconciliacao-pdf.ts`'s actual, current `head` array (read in full this session) is `[["Data", "Contrato", "Tipo", "Valor", "Observação"]]` — **5 columns, no Inquilino** — and its "Contrato" cell content is `` `#${l.cards?.numero ?? 0} ${l.cards?.endereco ?? ""}` `` — **endereço, not proprietário**. `ROADMAP.md`'s own Phase 20 entry confirms this was a deliberate, in-scope decision to defer: *"a célula 'Contrato' da lista troca endereço por proprietário e ganha uma coluna 'Inquilino' separada — endereço sai completamente da tela, mas continua presente no PDF (fora de escopo desta fase, D-08/D-09)"* and its success criterion #4 states *"`reconciliacao-pdf.ts` permanece byte a byte inalterado... confirmado em produção"*.
**How to avoid:** The planner must treat `reconciliacao-pdf.ts`'s **current, real** 5-column layout (Data/Contrato+endereço/Tipo/Valor/Observação) as the D-02 baseline to preserve unchanged this phase, not the 6-column on-screen table CONTEXT.md's parenthetical conflated it with. This is purely a documentation imprecision in CONTEXT.md's aside, not a locked decision to add a column — D-02's operative sentence ("sem mudança nenhuma nelas nesta fase") controls, and it is unambiguous.
**Warning signs:** A plan or diff that adds an "Inquilino" column or changes "Contrato" from address to owner name inside `reconciliacao-pdf.ts` during this phase.

## Code Examples

Already covered in full under Architecture Patterns 1–3 above (color constants, landscape constructor, list-table styling, Total row for both modules, structural-block recolor). No additional snippets needed — both files' Blocks 1–3 (título, filtros, resumo) and the footer loop require **only** a search-and-replace of the four color tuples plus the constructor's `orientation` value; their `autoTable`/`doc.text` call shapes are otherwise untouched by this phase (D-07).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| A4 portrait, green palette (`#18341c`/`#5c7060`/`#dbeed4`/`#74ac1c`/`#eaf6e6`), `theme:"grid"` list with full borders, no Total row | A4 landscape, gray palette (`#262626`/`#f2f2f2`/`#d9d9d9`/`#6b6b6b`), `theme:"plain"`+bottom-only rule+zebra list, bolded `#f2f2f2` Total row via `foot` | This phase (2026-08) | Corporate/ERP-style visual (D-08's Sienge-inspired "adapt, don't copy" brief), and the list is now self-summarizing without the reader needing to add it up by hand |

**Deprecated/outdated:** The old `10-UI-SPEC.md` "PDF Export Layout Contract" (§ lines ~159-217) is superseded by this phase's new color/orientation/list-style values; its structural requirements (3 blocks, repeating header row, empty-state copy, footer convention) remain valid and unchanged per D-07/D-08. CONTEXT.md leaves "whether to update `10-UI-SPEC.md` in place or write a new doc" as Claude's Discretion for the planner — this research does not resolve that, it is a documentation-location decision, not a technical one (see Open Questions).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Muted gray label/footer tone = `#6b6b6b` | Pattern 3 (color constants) | Cosmetic only — trivially adjustable after visual review; not a locked value |
| A2 | Zero-row branch keeps showing only the "nenhum resultado" message (no table, no Total row) — not restructured by this phase | Pattern 2 note | Cosmetic/UX only; D-06 doesn't explicitly address the 0-row case, and D-07 says structure stays as-is |
| A3 | `marginX = 40pt` unchanged on the wider landscape page | Pattern 3 | Purely cosmetic whitespace; CONTEXT.md explicitly permits reusing current values if they still fit |

**None of the above are HIGH-risk** — this phase's core mechanics (per-side lineWidth, `foot`/`footStyles`/`showFoot`, `columnStyles` body-only scoping, jsPDF landscape orientation literal, exact A4 landscape pt dimensions) are all `[VERIFIED]` against the installed package's source this session, not `[ASSUMED]`.

## Open Questions

1. **Where does the recolored/relandscaped contract get documented?**
   - What we know: CONTEXT.md explicitly leaves this as Claude's Discretion — either update `10-UI-SPEC.md`'s existing "PDF Export Layout Contract" section in place, or write a new phase-owned doc.
   - What's unclear: Which the planner should choose; this research doesn't have a technical basis to prefer one over the other (both are equally valid, it's a documentation-organization choice, not implementation).
   - Recommendation: In-place update to `10-UI-SPEC.md` §"PDF Export Layout Contract" is lower-friction (one canonical doc for the contract, avoids a second doc that could drift out of sync) — but flag for the planner/user to confirm, since it's explicitly not locked.

2. **Should the new Total row also appear when the filtered list has exactly 0 rows?**
   - What we know: D-06 defines the Total as summing "todas as linhas efetivamente listadas" — with 0 rows the sum is trivially 0, but today's empty-state branch shows a message instead of rendering the table at all (both modules).
   - What's unclear: Whether the user would want to see "Total: R$ 0,00" in that case, or whether the existing message-only behavior is sufficient (which this research assumes, A2 above).
   - Recommendation: Keep current behavior (message only, no table/Total) unless the user says otherwise during planning/UAT — lowest-risk interpretation, and D-06/D-07 don't call for restructuring the empty-state branch.

## Environment Availability

Skipped — this phase has no external dependencies (no new tool, service, runtime, or CLI). It modifies two existing TypeScript modules using two already-installed npm packages, executed entirely in the browser.

## Validation Architecture

Skipped — `.planning/config.json` has `workflow.nyquist_validation: false` (explicit).

## Security Domain

Required per `.planning/config.json` (`security_enforcement: true`, `security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Unchanged — this phase touches no auth code path |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | Unchanged — the underlying data (`parcelas`, `taxas_imobiliaria`, `caucao_eventos`) is fetched, filtered, and authorized entirely upstream of these two PDF modules (RLS + Server Components), untouched by this phase; the PDF module only receives already-filtered, already-authorized arrays as function arguments |
| V5 Input Validation | No new surface | No new user-controlled input is introduced — colors/orientation are hardcoded constants; the only "input" to the Total-row sum is the same `linhas`/`ParcelaRelatorio[]`/numeric `.valor` fields already flowing through the existing, unvalidated-by-this-phase call sites |
| V6 Cryptography | No | Not applicable — no crypto operation anywhere in this phase |

### Known Threat Patterns for this stack

None applicable. This phase is a client-side rendering/styling change with zero new inputs, zero new endpoints, zero new data access, and zero new dependency. It cannot introduce injection, auth bypass, or crypto misuse classes of vulnerability — the only meaningful "risk" is a cosmetic rendering bug (misaligned Total, repeating footer total across pages), both addressed directly in Common Pitfalls above.

## Sources

### Primary (HIGH confidence — read directly this session)
- `web/node_modules/jspdf-autotable/dist/index.d.ts` (full file) — `UserOptions`, `Styles`, `StylesProps`, `Settings`, `LineWidths` type shapes
- `web/node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.mjs` (targeted reads: lines 60-140, 255-330, 420-455, 678-741, 1495-1525, 1629-1745, 1888-1990) — runtime confirmation of theme defaults, style-merge cascade order, `drawCellBorders`, `showFoot` default and gating logic
- `web/node_modules/jspdf/types/index.d.ts` (targeted grep) — `orientation` literal union, `getNumberOfPages()` signature
- `web/node_modules/jspdf/dist/jspdf.node.js` (targeted grep) — A4 format dimensions `[595.28, 841.89]`
- `web/node_modules/jspdf-autotable/package.json:3` — installed version `5.0.8`
- `web/package.json` — declared dependency ranges
- `web/src/components/reports/relatorio-financeiro-pdf.ts` (full file) — current implementation, colors, structure
- `web/src/components/reports/reconciliacao-pdf.ts` (full file) — current implementation, colors, structure, actual (not assumed) column set
- `web/src/components/reports/relatorio-financeiro-dedicado.tsx` / `dinheiro-imobiliaria-view.tsx` (full files) — how `linhas`/`totais`/`filtro` reach the PDF functions, on-screen column sets (for Pitfall 4's contrast)
- `web/src/lib/kanban/relatorio-financeiro.ts` / `reconciliacao.ts` (full files) — `ParcelaRelatorio`/`FiltroRelatorioValores`/`ReconciliacaoTotais`/`FiltroReconciliacaoValores` type shapes
- `.planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md` § PDF Export Layout Contract — the contract this phase supersedes
- `.planning/ROADMAP.md` Phase 20 entry — source of the Pitfall 4 contradiction discovery

### Secondary (MEDIUM confidence)
None — every claim requiring library-mechanics confirmation was resolved by direct source read, not documentation lookup.

### Tertiary (LOW confidence — superseded/disregarded)
- WebSearch results for "jspdf-autotable lineWidth per side" and "jspdf-autotable foot footStyles showFoot" — both surfaced information about **older** major versions of the library (pre-per-side-lineWidth support, `footerRows` instead of `showFoot`) that does not match the installed 5.0.8. Retained in this doc only as a documented example of why source-verification overrode search results (Pitfall 1) — do not act on these search results directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed by direct file read, zero new dependency
- Architecture: HIGH — every mechanism (per-side lineWidth, foot/footStyles/showFoot, columnStyles scoping, landscape dimensions) verified against installed runtime source, not memory or docs
- Pitfalls: HIGH — all 4 pitfalls trace to a specific verified source line, including the CONTEXT.md/actual-code discrepancy (Pitfall 4), which was discovered by cross-reading the phase's own canonical references against the file they describe

**Research date:** 2026-08-28
**Valid until:** No expiry concern — findings are pinned to the exact installed `jspdf@4.2.1`/`jspdf-autotable@5.0.8` versions already locked in `package.json`; re-verify only if either version is bumped in a future phase.
