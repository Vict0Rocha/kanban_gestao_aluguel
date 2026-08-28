# Phase 19: Filtro suspenso e exportação em PDF no relatório da imobiliária - Pattern Map

**Mapped:** 2026-08-28
**Files analyzed:** 6 (2 modified, 2 new, 1 type-extended module, 1 modified action)
**Analogs found:** 6 / 6 (all files have exact or near-exact analogs — this phase is a mechanical copy-adapt of a Phase 10 precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `web/src/lib/kanban/actions.ts` (`buscarReconciliacaoAction`, ~line 1976-2007) | service (Server Action) | request-response | same file, same function (widen existing `.select()`) | exact |
| `web/src/lib/kanban/reconciliacao.ts` | model/utility (pure types + matchers) | transform | same file (extend), pattern from `web/src/lib/kanban/relatorio-financeiro.ts` matchers | exact |
| `web/src/components/reports/filtro-reconciliacao.tsx` (new) | component | request-response (controlled inputs) | `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` | exact |
| `web/src/components/reports/dinheiro-imobiliaria-view.tsx` | component | CRUD (client-side filter over loaded data) | `web/src/components/reports/relatorio-financeiro-dedicado.tsx` | exact |
| `web/src/components/reports/reconciliacao-pdf.ts` (new) | utility (file-I/O, client-side PDF gen) | file-I/O | `web/src/components/reports/relatorio-financeiro-pdf.ts` | exact |
| `web/src/lib/kanban/search.ts` (`normalizeText`, unmodified, reused) | utility | transform | reused as-is | exact |

## Pattern Assignments

### `web/src/lib/kanban/actions.ts` (service, request-response)

**Analog:** same file, `buscarReconciliacaoAction`, verified current text at lines 1986-1994.

**Current pattern (to widen, additive only):**
```ts
const { data: taxas, error: erroTaxas } = await sessao.supabase
  .from("taxas_imobiliaria")
  .select("id, data, valor, origem, observacao, cards(endereco, proprietario, numero)")

if (erroTaxas) return { ok: false, error: erroDoBanco(erroTaxas.code, "carregar o relatório") }

const { data: caucaoEventos, error: erroCaucao } = await sessao.supabase
  .from("caucao_eventos")
  .select("id, data, valor, tipo, observacao, cards(endereco, proprietario, numero)")
```

**Target (only the embed widens — add `inquilino`, nothing else changes):**
```ts
.select("id, data, valor, origem, observacao, cards(endereco, proprietario, numero, inquilino)")
// ...
.select("id, data, valor, tipo, observacao, cards(endereco, proprietario, numero, inquilino)")
```

**Auth pattern (unchanged, already present at top of function):**
```ts
const sessao = await requireUser()
if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
```

**Error handling (unchanged):** `erroDoBanco(code, "carregar o relatório")` per query, early return.

---

### `web/src/lib/kanban/reconciliacao.ts` (model/utility, transform)

**Analog:** same file (extend types), matcher-shape analog `web/src/lib/kanban/relatorio-financeiro.ts:52-106` (`passaFiltroTexto`/`passaFiltroPeriodo`), accent-insensitive precedent `web/src/lib/kanban/search.ts:8-13` (`normalizeText`) and its most recent live-filter consumer `web/src/components/financeiro/configuracao-financeira-view.tsx:48-51` (Phase 18).

**Current types (verbatim, lines 16-32):**
```ts
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
```

**Target — add `inquilino: string | null` to both embeds** (nullable: `cards.inquilino` is `text`, no `NOT NULL`, `supabase/migrations/20260728000000_init_schema.sql:68`):
```ts
cards: {
  endereco: string
  proprietario: string
  numero: number
  inquilino: string | null
} | null
```

**New filter type + matchers to append** (same "one file per report" convention already documented at top of this file, comment block lines 3-14):
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

export function passaFiltroTextoReconciliacao(valor: string, filtro: string): boolean {
  const alvo = normalizeText(filtro.trim())
  if (!alvo) return true
  return normalizeText(valor).includes(alvo)
}

export function passaFiltroIdReconciliacao(numero: number, filtro: string): boolean {
  const digitos = filtro.trim()
  if (!digitos) return true
  const alvo = Number.isInteger(Number(digitos)) ? Number(digitos) : null
  return alvo !== null && numero === alvo
}

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
Existing `passaFiltroPeriodoReconciliacao` (lines 39-45) stays unchanged and is still called separately (it operates on `taxa.data`/`evento.data`, not `cards`).

**Nullable-field defensive pattern to follow everywhere `inquilino` is read** (matches existing `endereco`/`proprietario` handling already used in `dinheiro-imobiliaria-view.tsx:180` and `relatorio-financeiro.ts:85`):
```ts
cards?.inquilino ?? ""
```

---

### `web/src/components/reports/filtro-reconciliacao.tsx` (component, request-response — new file)

**Analog:** `web/src/components/reports/filtro-relatorio-financeiro-live.tsx:26-38` (props shape, `atualizarCampo` updater pattern, no own `Collapsible`).

**Props/updater pattern to copy (verbatim structure, extend 3 fields → 5):**
```tsx
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
  // ...inputs
```

**Numeric-intent input pattern for "ID do contrato"** — mirror `web/src/components/financeiro/filtro-parcelas.tsx` (`inputMode="numeric"` on a text `<Input>`, exact-match semantics resolved downstream, not a `type="number"` field):
```tsx
<Input
  id="filtro-reconc-id"
  type="text"
  inputMode="numeric"
  placeholder="Ex: 12"
  value={campos.id}
  onChange={(e) => atualizarCampo("id", e.target.value)}
/>
```

**Full target component** (complete file, ready to adapt — no own `Collapsible`, parent supplies it):
```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  filtroReconciliacaoVazio,
  type FiltroReconciliacaoValores,
} from "@/lib/kanban/reconciliacao"

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
        {/* Imóvel, Proprietário, Inquilino: type="text" + atualizarCampo */}
        {/* ID do contrato: type="text" inputMode="numeric" + atualizarCampo */}
        {/* Período: type="month", unchanged behavior from today's bare field */}
      </div>
      {temFiltroPreenchido && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" onClick={() => onChange(() => filtroReconciliacaoVazio())}>
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

### `web/src/components/reports/dinheiro-imobiliaria-view.tsx` (component, CRUD/client-side filter — modified)

**Analog:** `web/src/components/reports/relatorio-financeiro-dedicado.tsx:126-185` (the Collapsible+live-filter+Exportar-PDF composition, already shipped in production — Phase 10, RELDED-05).

**Collapsible shell + Exportar PDF button pattern to copy verbatim (only swap the inner filter component):**
```tsx
<Collapsible open={aberto} onOpenChange={setAberto}>
  <div className="flex flex-wrap items-center justify-between gap-4">
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
    <FiltroReconciliacao campos={filtro} onChange={setFiltro} />
  </CollapsiblePanel>
</Collapsible>
```

**`resetKey` composition pattern** (from `web/src/components/reports/reports-view.tsx:133`'s `contractsResetKey` — plain pipe-joined string, no `JSON.stringify` needed since none of these 5 fields are `Set`s):
```ts
const resetKey = `${filtro.imovel}|${filtro.proprietario}|${filtro.inquilino}|${filtro.id}|${filtro.periodo}`
const { itensDaPagina, pagina, totalPaginas, setPagina } = usePagination(linhas, resetKey)
```

**`handleExportarPDF` async wrapper pattern** (from `relatorio-financeiro-dedicado.tsx` ~lines 109-153):
```tsx
async function handleExportarPDF() {
  setExportando(true)
  try {
    await exportarReconciliacaoPDF(linhas, totais, filtro, hojeISO)
  } finally {
    setExportando(false)
  }
}
```

**`LinhaLista` extension for the PDF (Pitfall 2 — `tipo` is `React.ReactNode`, PDF needs a plain string):**
```ts
type LinhaLista = {
  id: string
  data: string
  valor: number
  tipo: React.ReactNode
  tipoLabel: string   // NEW — plain string for PDF, from TAXA_ORIGEM[...].label / CAUCAO_TIPO[...].label
  observacao: string | null
  cards: { endereco: string; proprietario: string; numero: number; inquilino: string | null } | null
}
```

**Anti-pattern to avoid (explicit, from existing code comment at `dinheiro-imobiliaria-view.tsx:91-98`):** this report's list is sorted DESC (most recent first) — deliberately opposite of `relatorio-financeiro-lista.tsx`'s ASC order. Never re-sort in the PDF module; consume `linhas` as already ordered by the view.

---

### `web/src/components/reports/reconciliacao-pdf.ts` (utility, file-I/O — new file)

**Analog:** `web/src/components/reports/relatorio-financeiro-pdf.ts` (full file mirrored block-for-block — header, filtros table, totals table, list table, footer).

**Imports pattern — module stays plain, NOT `"use client"`, zero top-level import of `jspdf`/`jspdf-autotable` (Pitfall 1):**
```ts
import { formatCurrency, formatDate, formatInstantDateTime } from "@/lib/kanban/format"
import type {
  FiltroReconciliacaoValores,
  ReconciliacaoTotais,
} from "@/lib/kanban/reconciliacao"
```

**Dynamic import inside the exported function only:**
```ts
export async function exportarReconciliacaoPDF(
  linhas: LinhaListaPDF[],
  totais: ReconciliacaoTotais,
  filtro: FiltroReconciliacaoValores,
  hojeISO: string
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const { autoTable } = await import("jspdf-autotable")
  // ...
}
```

**Color/layout constants — identical RGB triples, governed by the "PDF Export Layout Contract" (`.planning/phases/10-relat-rio-financeiro-dedicado/10-UI-SPEC.md:159-198`):**
```ts
const foreground: [number, number, number] = [24, 52, 28]
const muted: [number, number, number] = [92, 112, 96]
const border: [number, number, number] = [219, 238, 212]
const rowShade: [number, number, number] = [234, 246, 230]
```

**Header + filtros table (5 rows here vs. 4 in the analog — includes Inquilino and ID do contrato):**
```ts
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
```

**Totals table (6 rows — mirrors the 6 `StatTile` values on screen):**
```ts
body: [
  ["Administração", formatCurrency(totais.administracao)],
  ["Comissão 1º aluguel", formatCurrency(totais.comissao)],
  ["Total recebido", formatCurrency(totais.totalRecebido)],
  ["Caução recebida", formatCurrency(totais.caucaoRecebida)],
  ["Caução devolvida", formatCurrency(totais.caucaoDevolvida)],
  ["Caução usada", formatCurrency(totais.caucaoUsada)],
],
```

**List table — `showHead: "everyPage"` (Pitfall 4, `headerRows` does not exist in installed `jspdf-autotable@5.0.8`):**
```ts
autoTable(doc, {
  startY: afterResumoY + 16,
  head: [["Data", "Contrato", "Tipo", "Valor", "Observação"]],
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
```

**Footer loop — `doc.getNumberOfPages()`, NOT `.internal.getNumberOfPages()` (Pitfall 3):**
```ts
const totalPaginas = doc.getNumberOfPages()
for (let i = 1; i <= totalPaginas; i++) {
  doc.setPage(i)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(...muted)
  doc.text(`Página ${i} de ${totalPaginas}`, doc.internal.pageSize.getWidth() - marginX, doc.internal.pageSize.getHeight() - 20, { align: "right" })
  doc.text("Kanban Aluguel — gerado em " + formatDate(hojeISO), marginX, doc.internal.pageSize.getHeight() - 20)
}
doc.save(`dinheiro-imobiliaria-${hojeISO}.pdf`)
```

**Anti-pattern (explicit, from `relatorio-financeiro-pdf.ts:45-58`):** never import UI label components (`TaxaOrigemBadge`, `CaucaoEventoLabel`) into the PDF module. Compute the plain-text label in the view (`tipoLabel`, using `TAXA_ORIGEM[...].label` / `CAUCAO_TIPO[...].label`) and pass it down as data.

---

## Shared Patterns

### Collapsible suspenso shell
**Source:** `web/src/components/reports/relatorio-financeiro-dedicado.tsx:126-185` (already shipped, Phase 10, RELDED-05)
**Apply to:** `dinheiro-imobiliaria-view.tsx`
```tsx
<Collapsible open={aberto} onOpenChange={setAberto}>
  <CollapsibleTrigger render={<Button variant="outline" size="sm">...</Button>} />
  <CollapsiblePanel>...</CollapsiblePanel>
</Collapsible>
```
Underlying primitive: `web/src/components/ui/collapsible.tsx` (`@base-ui/react` wrapper).

### Accent-insensitive text matching
**Source:** `web/src/lib/kanban/search.ts:8-13` (`normalizeText`)
**Apply to:** `passaFiltroTextoReconciliacao` in `reconciliacao.ts` — chosen over `passaFiltroTexto` (plain `.toLowerCase().includes()` from `relatorio-financeiro.ts:60-64`) because it is the more recent codebase convention (Phase 18, `configuracao-financeira-view.tsx:48-51`).

### Nullable embed field defensive read
**Source:** `dinheiro-imobiliaria-view.tsx:180` (`linha.cards?.endereco ?? ""`), `relatorio-financeiro.ts:85`
**Apply to:** every read of `cards?.inquilino` — always via `?? ""` before normalizing/matching, `?? null`-safe before rendering (Pitfall 5).

### Client-side pagination with resetKey
**Source:** `web/src/components/pagination.tsx` (`usePagination`), composition precedent `reports-view.tsx:133`
**Apply to:** `dinheiro-imobiliaria-view.tsx` — resetKey must be a pure pipe-joined identity of the filter fields only, never derived from `taxas`/`caucaoEventos`/`linhas` (Pitfall 6).

### PDF generation (dynamic import discipline)
**Source:** `web/src/components/reports/relatorio-financeiro-pdf.ts` (full file)
**Apply to:** `reconciliacao-pdf.ts` — `jspdf`/`jspdf-autotable` imported only inside the async export function, never at module top level (Pitfall 1), `doc.getNumberOfPages()` not `.internal.` (Pitfall 3), `showHead: "everyPage"` not `headerRows` (Pitfall 4).

## No Analog Found

None. All 6 files/modules in scope have an exact same-role, same-data-flow analog already present and recently shipped in this codebase (Phase 10 for the Collapsible+PDF composition, Phase 18 for the `normalizeText` live-matcher convention).

## Metadata

**Analog search scope:** `web/src/components/reports/`, `web/src/components/financeiro/`, `web/src/lib/kanban/`
**Files scanned:** `actions.ts`, `reconciliacao.ts`, `relatorio-financeiro.ts`, `relatorio-financeiro-pdf.ts`, `relatorio-financeiro-dedicado.tsx`, `filtro-relatorio-financeiro-live.tsx`, `filtro-relatorio-financeiro.tsx`, `filtro-parcelas.tsx`, `search.ts`, `configuracao-financeira-view.tsx`, `dinheiro-imobiliaria-view.tsx`, `collapsible.tsx`, `pagination.tsx`, `reports-view.tsx`
**Pattern extraction date:** 2026-08-28
