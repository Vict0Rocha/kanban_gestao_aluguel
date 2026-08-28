# Phase 21: Redesenho do modelo de PDF dos relatórios financeiros - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 2 (both modified, no new files)
**Analogs found:** 2 / 2 — each file is the best analog for the other (already structurally mirrored per D-05/19-CONTEXT.md discipline); no third-party analog needed.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `web/src/components/reports/relatorio-financeiro-pdf.ts` | utility (client-side PDF export module) | transform (in-memory array → rendered PDF, no I/O beyond browser download) | `web/src/components/reports/reconciliacao-pdf.ts` (mirror sibling) | exact — same role, same data flow, same library, deliberately kept in lockstep since Phase 19 |
| `web/src/components/reports/reconciliacao-pdf.ts` | utility (client-side PDF export module) | transform | `web/src/components/reports/relatorio-financeiro-pdf.ts` (mirror sibling) | exact |

Both files are themselves the closest analog for each other — there is no third PDF-export module in the codebase, and the "Don't Hand-Roll" / "adapt, don't copy" discipline from RESEARCH.md means the Sienge screenshot reference is explicitly NOT a code analog, only a visual-inspiration source (D-08).

## Pattern Assignments

### `web/src/components/reports/relatorio-financeiro-pdf.ts` (utility, transform)

**Analog:** `web/src/components/reports/reconciliacao-pdf.ts` (current state, pre-phase) — both files change together this phase, so treat "current relatorio-financeiro-pdf.ts" as its own baseline to edit in place, using reconciliacao-pdf.ts only as confirmation the two must land byte-for-byte parallel.

**Imports pattern** (relatorio-financeiro-pdf.ts:1-9) — unchanged this phase:
```typescript
import { formatCurrency, formatDate, formatInstantDateTime } from "@/lib/kanban/format"
import { situacaoDaParcela, somarLancamentos } from "@/lib/kanban/parcelas"
import {
  SITUACAO_RELATORIO_ORDEM,
  type CategoriaRelatorio,
  type FiltroRelatorioValores,
  type ParcelaRelatorio,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"
```
No new imports needed — no new npm dependency this phase (RESEARCH.md "Standard Stack").

**Dynamic import pitfall (must preserve)** (relatorio-financeiro-pdf.ts:66-68):
```typescript
// RESEARCH.md Pitfall #3: só aqui dentro da função, nunca no topo do arquivo.
const { jsPDF } = await import("jspdf")
const { autoTable } = await import("jspdf-autotable")
```
Never hoist to module scope — breaks SSR of the Server Component parent route.

**Constructor — orientation change (D-01)** (relatorio-financeiro-pdf.ts:72):
```typescript
// BEFORE:
const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
// AFTER (this phase):
const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })
```

**Color constants — full palette swap (D-03)** (relatorio-financeiro-pdf.ts:81-84):
```typescript
// BEFORE (green, superseded):
const foreground: [number, number, number] = [24, 52, 28] // #18341c
const muted: [number, number, number] = [92, 112, 96] // #5c7060
const border: [number, number, number] = [219, 238, 212] // #dbeed4
const rowShade: [number, number, number] = [234, 246, 230] // #eaf6e6

// AFTER (gray, this phase — RESEARCH.md Pattern 3, verified hex):
const foreground: [number, number, number] = [38, 38, 38]    // #262626
const headerFill: [number, number, number] = [242, 242, 242] // #f2f2f2 (NEW — header + Total row fill)
const border: [number, number, number] = [217, 217, 217]     // #d9d9d9
const muted: [number, number, number] = [107, 107, 107]      // #6b6b6b [ASSUMED — Claude's Discretion, RESEARCH.md A1]
const rowShade: [number, number, number] = [247, 247, 247]   // very light gray zebra, distinct from headerFill
```
`headerFill` is a new constant name (didn't exist in green palette — header used `fillColor: [255,255,255]` white before). Reuse identically in both files.

**Structural blocks 1-3 (filtros/resumo, D-07 — recolor only, no structural change)** (relatorio-financeiro-pdf.ts:119-160):
```typescript
autoTable(doc, {
  startY: 66,
  theme: "grid",
  body: [
    ["Imóvel", filtro.imovel.trim() || "Todos"],
    ["Proprietário", filtro.proprietario.trim() || "Todos"],
    ["Período", periodoAtivo],
    ["Situação", situacoesAtivas],
  ],
  styles: {
    fontSize: 9,
    textColor: foreground,   // was green foreground, now #262626
    lineColor: border,       // was #dbeed4, now #d9d9d9
    cellPadding: 5,
  },
  columnStyles: {
    0: { fontStyle: "bold", cellWidth: 90 },
  },
})
```
`theme: "grid"` is UNCHANGED here — D-04's "no vertical border + horizontal rule + zebra" applies only to the list table (Block 4), not these `theme:"grid"` filter/resumo blocks. Only their color constants (`textColor`, `lineColor`) swap from green to gray tuples.

**Core list-table pattern — full redesign (D-03/D-04/D-05/D-06)** (relatorio-financeiro-pdf.ts:175-220, RESEARCH.md Pattern 1 + Pattern 2):
```typescript
// bodyRows computed once, valor reused for both the rendered cell and the
// Total sum — do not re-derive the situação-dependent formula a second time
// (RESEARCH.md "Don't Hand-Roll" table, row 3).
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
  startY: afterResumoY + 16,
  theme: "plain",                              // was implicit/default before; now explicit (D-04)
  head: [["Imóvel", "Proprietário", "Competência", "Vencimento", "Situação", "Valor"]],
  body: bodyRows.map((r) => r.cells),
  foot: [[
    { content: "Total", colSpan: 5 },
    { content: formatCurrency(totalValor), styles: { halign: "right" } }, // columnStyles doesn't reach foot — Pitfall 2
  ]],
  showFoot: "lastPage",                         // NOT default "everyPage" — Pitfall 3
  showHead: "everyPage",                        // unchanged
  styles: {
    fontSize: 9,
    textColor: foreground,
    lineColor: border,
    lineWidth: { top: 0, right: 0, bottom: 0.75, left: 0 }, // horizontal-rule-only, no vertical grid — D-04
    cellPadding: 5,
  },
  headStyles: { fontStyle: "bold", fillColor: headerFill, textColor: foreground }, // was white fill before
  footStyles: { fontStyle: "bold", fillColor: headerFill, textColor: foreground }, // NEW — Total row, D-06
  alternateRowStyles: { fillColor: rowShade }, // zebra — was already present, now new gray tone
  columnStyles: { 5: { halign: "right" } },
})
```

**Empty-state branch (unchanged structurally, recolor only)** (relatorio-financeiro-pdf.ts:165-173): keep `doc.setTextColor(...muted)` message-only behavior; no Total row when `linhas.length === 0` (RESEARCH.md Assumption A2).

**Footer loop (recolor only, D-07)** (relatorio-financeiro-pdf.ts:229-246): unchanged structure, only `doc.setTextColor(...muted)` picks up the new gray tuple.

---

### `web/src/components/reports/reconciliacao-pdf.ts` (utility, transform)

**Analog:** `relatorio-financeiro-pdf.ts` — same transformations apply (landscape, gray palette, `theme:"plain"` list + Total row), EXCEPT this file's list-table columns also change shape (corrected D-02 — see below), unlike relatorio-financeiro-pdf.ts whose columns stay fixed.

**Imports / type (unchanged)** (reconciliacao-pdf.ts:1-32) — note `LinhaListaPDF.cards` **already declares** an `inquilino: string | null` field today, even though the current `body.map` never reads it:
```typescript
type LinhaListaPDF = {
  id: string
  data: string
  valor: number
  tipoLabel: string
  observacao: string | null
  cards: {
    endereco: string
    proprietario: string
    numero: number
    inquilino: string | null   // ← already present, currently unused by body.map — this phase starts using it
  } | null
}
```
No type change needed — the field is already there, waiting to be consumed.

**Constructor / colors** — identical transformation to relatorio-financeiro-pdf.ts above (orientation `"portrait"` → `"landscape"`; same 5 color constants swapped green → gray, same `headerFill` addition). See that file's excerpts; copy verbatim into this file (reconciliacao-pdf.ts:57, 66-69).

**Structural blocks 1-2 (filtros/resumo, D-07 — recolor only)** (reconciliacao-pdf.ts:95-139): same `theme:"grid"` pattern as relatorio-financeiro-pdf.ts's Blocks 1-2, just with this file's own 5-row filtro body and 6-row resumo body (`totais.administracao`, `.comissao`, etc.) — content unchanged, only `textColor`/`lineColor` swap to gray.

**Core list-table pattern — redesign PLUS corrected column change (D-04/D-05/D-06 + corrected D-02)** (reconciliacao-pdf.ts:154-176):

Current (pre-phase) baseline — 5 columns:
```typescript
head: [["Data", "Contrato", "Tipo", "Valor", "Observação"]],
body: linhas.map((l) => [
  formatDate(l.data),
  `#${l.cards?.numero ?? 0} ${l.cards?.endereco ?? ""}`,
  l.tipoLabel,
  formatCurrency(l.valor),
  l.observacao ?? "",
]),
```

**Target this phase — 6 columns** (per the orchestrator's correction overriding RESEARCH.md Pitfall 4 / Pattern 2's second example, which is now stale):
```typescript
const totalValor = linhas.reduce((acc, l) => acc + l.valor, 0)

autoTable(doc, {
  startY: afterResumoY + 16,
  theme: "plain",
  head: [["Data", "Contrato", "Inquilino", "Tipo", "Valor", "Observação"]], // was 5 cols, now 6 — "Inquilino" added
  body: linhas.map((l) => [
    formatDate(l.data),
    `#${l.cards?.numero ?? 0} ${l.cards?.proprietario ?? ""}`, // was l.cards?.endereco — now proprietario
    l.cards?.inquilino ?? "",                                   // NEW column
    l.tipoLabel,
    formatCurrency(l.valor),
    l.observacao ?? "",
  ]),
  foot: [[
    { content: "Total", colSpan: 4 },                           // was colSpan:3 in the stale 5-col example — now 4 (labels span Data/Contrato/Inquilino/Tipo)
    { content: formatCurrency(totalValor), styles: { halign: "right" } },
    "",                                                          // trailing empty cell for Observação column
  ]],
  showFoot: "lastPage",
  showHead: "everyPage",
  styles: {
    fontSize: 9,
    textColor: foreground,
    lineColor: border,
    lineWidth: { top: 0, right: 0, bottom: 0.75, left: 0 },
    cellPadding: 5,
  },
  headStyles: { fontStyle: "bold", fillColor: headerFill, textColor: foreground },
  footStyles: { fontStyle: "bold", fillColor: headerFill, textColor: foreground },
  alternateRowStyles: { fillColor: rowShade },
  columnStyles: { 4: { halign: "right" } }, // Valor is now column index 4 (was 3) because Inquilino was inserted at index 2
})
```

**Column-index shift consequence:** because "Inquilino" is inserted between "Contrato" and "Tipo", every downstream column reference shifts by one: Valor moves from index 3 → 4 (`columnStyles`), and the `foot` row's label `colSpan` moves from 3 → 4. This is the single most error-prone mechanical detail in this file's change — verify the `foot` row renders as `[Total spanning 4 cols][Valor sum][""]` = 6 total foot cells matching the 6-column `head`.

**Empty-state / footer loop** (reconciliacao-pdf.ts:144-152, 178-198): same recolor-only treatment as relatorio-financeiro-pdf.ts, message text unchanged ("Nenhuma taxa ou movimento de caução encontrado...").

---

## Shared Patterns

### Gray color constants (D-03) — apply to both files identically
**Source:** RESEARCH.md Pattern 3 (verified against `10-UI-SPEC.md`'s superseded green contract)
```typescript
const foreground: [number, number, number] = [38, 38, 38]    // #262626
const headerFill: [number, number, number] = [242, 242, 242] // #f2f2f2
const border: [number, number, number] = [217, 217, 217]     // #d9d9d9
const muted: [number, number, number] = [107, 107, 107]      // #6b6b6b [ASSUMED]
const rowShade: [number, number, number] = [247, 247, 247]
```
**Apply to:** every `doc.setTextColor(...)`, `styles.textColor`, `styles.lineColor`, `headStyles`/`footStyles.fillColor`, `alternateRowStyles.fillColor` call site in both files.

### Landscape constructor (D-01) — apply to both files
**Source:** `new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" })` — replaces `"portrait"` in both files' single `new jsPDF(...)` call. `marginX = 40` stays unchanged (RESEARCH.md A3 — proportionally safe on the wider page, no code change needed).

### List-table theme + Total row (D-04/D-05/D-06) — apply to the Block-4 `autoTable` call only, in both files
**Source:** RESEARCH.md Pattern 1 + Pattern 2 (verified against installed `jspdf-autotable@5.0.8` source)
- `theme: "plain"` + `styles.lineWidth: { top: 0, right: 0, bottom: 0.75, left: 0 }` — never set both `top` and `bottom` (doubles the rendered line, Anti-Pattern in RESEARCH.md)
- `headStyles`/`footStyles`: `fillColor: headerFill` (`#f2f2f2`), `fontStyle: "bold"`
- `foot` row's amount cell needs `styles: { halign: "right" }` set directly — `columnStyles` does NOT reach `foot` (Pitfall 2, verified in `jspdf-autotable` source: `colStyles = sectionName === 'body' ? columnStyles : {}`)
- `showFoot: "lastPage"` always explicit — default is `"everyPage"`, which would repeat the grand total on every page of a multi-page export (Pitfall 3)
- Total sum computed from the same in-memory value already used per body row — never re-derive independently (Don't Hand-Roll table)

### Blocks 1-3 (title/timestamp, filtros, resumo) structure (D-07) — unchanged in both files
**Source:** existing `theme: "grid"` `autoTable` calls (Blocks 1-2) and `doc.text` calls (title/timestamp) in both files — only color constants change; layout, row content, and `columnStyles: { 0: { fontStyle: "bold", cellWidth: 90 } }` all stay exactly as-is.

### SSR-safety dynamic import (unchanged, must preserve in both files)
**Source:** both files, top of exported function:
```typescript
const { jsPDF } = await import("jspdf")
const { autoTable } = await import("jspdf-autotable")
```
Never move to module scope.

## No Analog Found

None — both target files exist today and mutually serve as each other's analog; no file in this phase lacks a close match.

## Metadata

**Analog search scope:** `web/src/components/reports/` (both files read in full — 251 and 203 lines respectively, well under the 2,000-line large-file threshold, single Read call each, no re-reads needed)
**Files scanned:** 2 (both target files) + 2 already covered by RESEARCH.md (`relatorio-financeiro-dedicado.tsx`, `dinheiro-imobiliaria-view.tsx` — caller sites, no changes needed per CONTEXT.md canonical refs, not re-read here since RESEARCH.md already confirmed no changes needed there)
**Pattern extraction date:** 2026-08-28
