# Phase 10: Relatório Financeiro dedicado - Pattern Map

**Mapped:** 2026-08-21
**Files analyzed:** 9 (2 modified, 7 new)
**Analogs found:** 9 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `web/src/lib/kanban/relatorio-financeiro.ts` (modify: export 2 fns) | utility | transform | itself (existing file) | exact |
| `web/src/components/financeiro/parcela-situacao-badge.tsx` (modify: additive `className`) | component | request-response | itself (existing file) | exact |
| `web/src/components/reports/reports-view.tsx` (`FilterChip`, modify: additive `className`) | component | request-response | itself (existing file) | exact |
| `web/src/app/(app)/relatorios/financeiro/page.tsx` | route (Server Component) | request-response | `web/src/app/(app)/relatorios/page.tsx` | exact |
| `web/src/components/reports/relatorio-financeiro-dedicado.tsx` | component (client) | CRUD (in-memory filter/aggregate) | `web/src/components/reports/relatorio-financeiro.tsx` | exact |
| `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` | component (client) | request-response | `web/src/components/reports/filtro-relatorio-financeiro.tsx` | exact |
| `web/src/components/reports/relatorio-financeiro-lista.tsx` | component (client, table) | transform | `web/src/components/financeiro/parcelas-table.tsx` | role-match |
| `web/src/components/reports/relatorio-financeiro-pdf.ts` | utility (PDF builder) | file-I/O | none (new capability) — see "No Analog Found" | none |
| `web/src/app/(app)/relatorios/page.tsx` (modify: add entry-point `<Link>` button) | route (Server Component) | request-response | itself (existing file) | exact |

## Pattern Assignments

### `web/src/lib/kanban/relatorio-financeiro.ts` (utility, transform) — modify only

**Analog:** itself, current content already read in full.

**Required change** (Pitfall #1 from RESEARCH.md) — add `export` to two functions, no other change (lines 59, 71):
```typescript
// BEFORE (web/src/lib/kanban/relatorio-financeiro.ts:59, 71):
function passaFiltroTexto(valor: string, filtro: string): boolean { ... }
function passaFiltroPeriodo(competencia: string, periodo: string): boolean { ... }

// AFTER — purely additive, zero behavior change:
export function passaFiltroTexto(valor: string, filtro: string): boolean { ... }
export function passaFiltroPeriodo(competencia: string, periodo: string): boolean { ... }
```

**Reuse verbatim (do not touch, do not reimplement):**
- `calcularRelatorioFinanceiro(parcelas, filtro, hojeISO)` (lines 82-135) — the single source of the 4-category aggregation, D-06/D-07 logic.
- `ParcelaRelatorio`, `FiltroRelatorioValores`, `CategoriaRelatorio`, `SituacaoRelatorio`, `SITUACAO_RELATORIO_ORDEM`, `filtroRelatorioVazio()` — all types/helpers this phase's new files import directly.
- Module comment at lines 4-9: this file must never import `@/lib/supabase/server` or `next/headers` — it's consumed by `"use client"` components.

---

### `web/src/app/(app)/relatorios/financeiro/page.tsx` (route, request-response) — new

**Analog:** `web/src/app/(app)/relatorios/page.tsx` (full file, 36 lines, quoted above)

**Imports pattern:**
```typescript
import { createClient } from "@/lib/supabase/server"
import { hojeEmCuiaba } from "@/lib/kanban/format"
```

**Core pattern** — Server Component, fetch once, pass as props (adapt the query to `buscarParcelasRelatorioAction`'s shape — either call it directly server-side per RESEARCH.md Pitfall #7, or replicate its query inline the way `relatorios/page.tsx` does for `columns`):
```typescript
export default async function RelatorioFinanceiroPage() {
  const resultado = await buscarParcelasRelatorioAction() // "use server" fn, callable directly server-side
  if (!resultado.ok) {
    // render locked error copy: "Não foi possível carregar o relatório agora. Tente novamente."
  }
  return (
    <RelatorioFinanceiroDedicado
      parcelas={resultado.data.parcelas}
      hojeISO={resultado.data.hojeISO}
    />
  )
}
```

**Error handling pattern:** branch explicitly on `ActionResult`'s `{ ok: false, error }` / `{ ok: true, data }` discriminated union (see `buscarParcelasRelatorioAction` excerpt below) — mirror how `relatorio-financeiro.tsx:57-65` handles `!resultado.ok` client-side, but here it must happen server-side since the page calls the action directly (RESEARCH.md Pitfall #7).

**Data fetch pattern to reuse** (`buscarParcelasRelatorioAction`, `web/src/lib/kanban/actions.ts:1297-1325`):
```typescript
export async function buscarParcelasRelatorioAction(): Promise<
  ActionResult<{ parcelas: ParcelaRelatorio[]; hojeISO: string }>
> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .select(
      "competencia, vencimento, valor_original, status, cards(endereco, proprietario), parcela_lancamentos(tipo, valor)"
    )
  // D-05: deliberately NO .is("cards.arquivado_em", null) / .eq("ativo", true)
  // — archived/inactive contracts count toward this report's totals.
  if (error) {
    console.error("buscarParcelasRelatorio", error)
    return { ok: false, error: erroDoBanco(error.code, "carregar o relatório") }
  }
  return {
    ok: true,
    data: { parcelas: (data ?? []) as unknown as ParcelaRelatorio[], hojeISO: hojeEmCuiaba() },
  }
}
```
Auth pattern: `requireUser()` session-scoped Supabase client, never `service_role` — RLS via `is_team_member()` is the real gate; this is defense-in-depth.

---

### `web/src/components/reports/relatorio-financeiro-dedicado.tsx` (client component, CRUD in-memory) — new

**Analog:** `web/src/components/reports/relatorio-financeiro.tsx` (full file, 115 lines, quoted above)

**Imports pattern** (lines 1-15 of analog):
```typescript
"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Clock, Lock, type LucideIcon } from "lucide-react"

import { formatCurrency } from "@/lib/kanban/format"
import {
  calcularRelatorioFinanceiro,
  passaFiltroTexto,       // newly exported — see relatorio-financeiro.ts change above
  passaFiltroPeriodo,     // newly exported
  filtroRelatorioVazio,
  type FiltroRelatorioValores,
  type ParcelaRelatorio,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"
import { situacaoDaParcela } from "@/lib/kanban/parcelas"
import { StatTile } from "@/components/reports/stat-tile"
```

**Core pattern — the key gatilho change (D-01).** Phase 8's version gates `useMemo` behind a click-set `aplicado` state (lines 31-49, 51-65 quoted above); Phase 10 removes the gate entirely — filter state IS applied state:
```typescript
// Phase 8 pattern (relatorio-financeiro.tsx:43-49) — DO adapt, don't copy the gate:
const categorias = React.useMemo(
  () => calcularRelatorioFinanceiro(dados.parcelas, filtro, dados.hojeISO),
  [filtro, dados]
)

// Phase 10 addition — row-list derived the same way, reusing the newly-exported predicates
// (RESEARCH.md "Code Examples" — Live filter, verbatim-adaptable):
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

**Icon/label map to reuse verbatim** (analog lines 17-23):
```typescript
const ICONE_E_ROTULO: Record<SituacaoRelatorio, { icon: LucideIcon; label: string }> = {
  paga: { icon: CheckCircle2, label: "Pagas" },
  a_vencer: { icon: Clock, label: "A vencer" },
  vencida: { icon: AlertCircle, label: "Vencidas" },
  conciliada: { icon: Lock, label: "Conciliadas" },
}
```

**Tile grid pattern to reuse verbatim** (analog lines 93-111) — `StatTile` unmodified, same grid classes, same `tone="alert"` rule:
```tsx
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  {categorias.map((categoria) => {
    const { icon, label } = ICONE_E_ROTULO[categoria.situacao]
    return (
      <StatTile
        key={categoria.situacao}
        icon={icon}
        label={label}
        value={String(categoria.quantidade)}
        hint={formatCurrency(categoria.total)}
        tone={categoria.situacao === "vencida" && categoria.quantidade > 0 ? "alert" : "default"}
      />
    )
  })}
</div>
```

**Error handling pattern** (analog lines 80-83, adapt copy per UI-SPEC): render locked copy "Não foi possível carregar o relatório agora. Tente novamente." when the Server Component's fetch failed (passed down as a prop/flag, since this phase's data load is no longer a client-click — no `erro` state set by an `onClick` handler like Phase 8's `gerar()`).

**Note:** unlike the Phase 8 analog, there is no `carregando`/`aplicado`/`gerar()` triggered-by-click state machine to port — data arrives once as props from the Server Component (per UI-SPEC §1/§7 and RESEARCH.md's Architectural Responsibility Map).

---

### `web/src/components/reports/filtro-relatorio-financeiro-live.tsx` (client component, request-response) — new

**Analog:** `web/src/components/reports/filtro-relatorio-financeiro.tsx` (full file, 181 lines, quoted above)

**Imports pattern** (analog lines 1-19):
```typescript
"use client"

import * as React from "react"
import { Filter, X } from "lucide-react"

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FilterChip, toggle } from "@/components/reports/reports-view"
import {
  filtroRelatorioVazio,
  type FiltroRelatorioValores,
  type SituacaoRelatorio,
} from "@/lib/kanban/relatorio-financeiro"
```

**Core pattern — field/chip markup reused verbatim** (analog lines 66-158): same `Collapsible`/`CollapsibleTrigger`/`CollapsiblePanel` structure, same three `Input` fields (Imóvel/Proprietário/Período), same `FilterChip`+`toggle()` situação row. **Key difference (D-01):** no `onGerar` callback, no "Gerar relatório" button — every field's `onChange` calls the parent's setter directly:
```typescript
// Adapted from analog's atualizarCampo (lines 47-52) — same shape, but the
// state now lives in (or is lifted to) the parent so the tile/list useMemo
// picks it up on every keystroke, not just on a submit click:
function atualizarCampo(campo: "imovel" | "proprietario" | "periodo", valor: string) {
  onChange((atual) => ({ ...atual, [campo]: valor }))
}
```
Panel default-closed state pattern reused verbatim (analog line 42): `const [aberto, setAberto] = React.useState(false)`.

"Limpar filtros" conditional-render pattern reused verbatim (analog lines 54-59, 170-174):
```typescript
const temFiltroPreenchido = Boolean(
  campos.imovel.trim() || campos.proprietario.trim() || campos.periodo.trim() || campos.situacoes.size > 0
)
// ...
{temFiltroPreenchido && (
  <Button variant="ghost" onClick={limpar}>Limpar filtros</Button>
)}
```

**Spacing deviation (per UI-SPEC §Layout Contract #4):** this new file uses its own on-grid classes (`px-6 py-4`, `gap-2` field wrapper) rather than the analog's `px-5 py-4`/`gap-1.5` — it is new markup, not an import of the Phase 8 file, so it does not inherit the analog's exact spacing.

---

### `web/src/components/reports/relatorio-financeiro-lista.tsx` (client component, transform) — new

**Analog:** `web/src/components/financeiro/parcelas-table.tsx` (table structure, lines 1-25 imports + lines 195-207 header quoted above)

**Imports pattern:**
```typescript
import { formatCurrency, formatDate } from "@/lib/kanban/format"
import { ParcelaSituacaoBadge } from "@/components/financeiro/parcela-situacao-badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
```

**Table header pattern** (analog lines 195-207) — adapt to this phase's exact 6 columns (UI-SPEC §6, no ID/Ações columns):
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Imóvel</TableHead>
      <TableHead>Proprietário</TableHead>
      <TableHead>Competência</TableHead>
      <TableHead>Vencimento</TableHead>
      <TableHead>Situação</TableHead>
      <TableHead className="text-right">Valor</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>{/* map linhasFiltradas */}</TableBody>
</Table>
```

**Competência formatting pattern to reuse verbatim** (`web/src/components/financeiro/registrar-pagamento-dialog.tsx:20-32`, duplicated in `parcela-historico-sheet.tsx`/`destravar-parcela-dialog.tsx`/`ajustar-parcela-dialog.tsx` — reuse the same pattern, do not invent "MM/YYYY"):
```typescript
const mesFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long" })
// competencia arrives as "YYYY-MM-01" — never new Date(competencia) directly
// (UTC-parsing off-by-one-day bug, same reason documented in parcelas.ts):
function competenciaLabel(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number)
  const mesPorExtenso = mesFormatter.format(new Date(ano, mes - 1, 1))
  return `${mesPorExtenso} de ${ano}` // e.g. "Agosto de 2026"
}
```

**Vencimento/Valor cell pattern** (`formatDate`/`formatCurrency`, `web/src/lib/kanban/format.ts:6-20`):
```typescript
export function formatCurrency(value: number) { return currencyFormatter.format(value) }
export function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return dateFormatter.format(new Date(year, month - 1, day))
}
```

**Situação cell pattern — additive `className` prop** (see `ParcelaSituacaoBadge` modification below):
```tsx
<ParcelaSituacaoBadge situacao={situacao} className="gap-2" />
```

**Valor cell business rule (D-07, do not reimplement independently — reuse the same `somarLancamentos` values `calcularRelatorioFinanceiro` already computed per parcela, or recompute identically):** pagas/conciliadas show `valorPago`; a_vencer/vencidas show `Math.max(valorDevido - valorPago, 0)`.

---

### `web/src/components/financeiro/parcela-situacao-badge.tsx` (component, request-response) — modify only

**Analog:** itself, current content (56 lines, quoted above)

**Required change** (RESEARCH.md Pitfall #2 — naming collision, `className` already used internally as a destructured key):
```tsx
// BEFORE (web/src/components/financeiro/parcela-situacao-badge.tsx:47-55):
export function ParcelaSituacaoBadge({ situacao }: { situacao: Situacao }) {
  const { icon: Icon, label, className } = SITUACAO[situacao]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <Icon className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}

// AFTER — additive prop + renamed local destructure, existing call sites unaffected:
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

---

### `web/src/components/reports/reports-view.tsx` — `FilterChip` (component, request-response) — modify only

**Analog:** itself, current content (`web/src/components/reports/reports-view.tsx:31-61`, quoted above — `toggle<T>` at lines 31-35 reused unmodified alongside)

**Required change** — additive `className`, no collision here (simpler than `ParcelaSituacaoBadge`):
```tsx
// BEFORE (reports-view.tsx:37-45):
export function FilterChip({
  active, children, onClick,
}: { active: boolean; children: React.ReactNode; onClick: () => void }) {

// AFTER:
export function FilterChip({
  active, children, onClick, className,
}: { active: boolean; children: React.ReactNode; onClick: () => void; className?: string }) {
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
This phase's own usage: `<FilterChip className="font-semibold" ...>` (situação chip row, per UI-SPEC §Typography). Existing call sites (Phase 8, no prop passed) render unchanged.

---

### `web/src/app/(app)/relatorios/page.tsx` (route) — modify only, add entry-point button

**Analog:** itself, current content (36 lines, quoted above) — the button is added to the `ReportsView`/filter-panel header row per UI-SPEC §Copywriting, not to `page.tsx`'s own body (this Server Component only fetches/passes props). Verify exact insertion point inside `reports-view.tsx`'s filter panel header (`filtro-relatorio-financeiro.tsx:66-90`'s header row is the closest sibling markup — button sits "between the panel's heading block and its own 'Filtrar' trigger").
```tsx
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
// ...
<Link href="/relatorios/financeiro">
  <Button variant="outline" size="sm">
    <ArrowUpRight className="size-3.5" />
    Relatório financeiro
  </Button>
</Link>
```

## Shared Patterns

### Auth / data access (Server Actions with session, never `service_role`)
**Source:** `web/src/lib/kanban/actions.ts:1297-1325` (`buscarParcelasRelatorioAction`), pattern also in `relatorios/page.tsx:1,7-14`
**Apply to:** `relatorios/financeiro/page.tsx` — call `requireUser()`-backed `buscarParcelasRelatorioAction()` directly server-side (RESEARCH.md Pitfall #7), branch on `ActionResult`'s `{ ok, ... }` shape explicitly, never silently ignore `ok: false`.

### Cuiabá-timezone "hoje" (never native `Date`)
**Source:** `web/src/lib/kanban/format.ts:43-45` (`hojeEmCuiaba`)
**Apply to:** `relatorios/financeiro/page.tsx` (server-side "hoje" for `situacaoDaParcela`), any PDF generation-timestamp copy (`formatInstantDate`, lines 69-71 of the same file).

### Currency/date formatting (never a fresh `Intl` instance per-call)
**Source:** `web/src/lib/kanban/format.ts:6-20` (`formatCurrency`, `formatDate`)
**Apply to:** `relatorio-financeiro-lista.tsx`, `relatorio-financeiro-dedicado.tsx`, `relatorio-financeiro-pdf.ts` — same functions, module-level formatter instances, reused everywhere money/dates render.

### `cn()` additive-className merge
**Source:** `web/src/lib/utils.ts:1-6` (`clsx` + `tailwind-merge`)
**Apply to:** both modified shared components (`FilterChip`, `ParcelaSituacaoBadge`) — pass the incoming `className` **last** in the `cn()` call so tailwind-merge's same-group conflict resolution favors it over the internal default.

### Situação classification (single source of truth)
**Source:** `web/src/lib/kanban/parcelas.ts` (`situacaoDaParcela`, lines ~380-388 per RESEARCH.md), consumed via `calcularRelatorioFinanceiro`
**Apply to:** `relatorio-financeiro-dedicado.tsx`'s row-list `useMemo` — call `situacaoDaParcela(status, vencimento, hojeISO)` directly for the per-row pass (same call `calcularRelatorioFinanceiro` makes internally), never reimplement the paga/a_vencer/vencida/conciliada comparison.

### Dynamic import for browser-only libraries under SSR
**Source:** no existing precedent in this codebase (new pattern for this phase) — RESEARCH.md Pattern 3 / Pitfall #3
**Apply to:** `relatorio-financeiro-pdf.ts` — `jsPDF`/`jspdf-autotable` must only be `import()`-ed inside the `onClick` handler that triggers "Exportar PDF", never at module scope, since this route is server-rendered by default.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `web/src/components/reports/relatorio-financeiro-pdf.ts` | utility (PDF builder) | file-I/O | No PDF generation exists anywhere in this codebase today — genuinely new capability. RESEARCH.md's "Code Examples" section (functional `jspdf-autotable` v5 API, `autoTable(doc, {...})`, two-pass page-number footer) is the closest thing to a pattern to follow; treat RESEARCH.md as the primary reference for this one file, not a codebase analog. Must consume only the already-filtered `linhasFiltradas`/`categorias` (never `dados.parcelas`) per Pitfall #5, and must use the v5 functional API (`autoTable(doc, {...})`, not `doc.autoTable({...})`) per Pitfall #4. |

## Metadata

**Analog search scope:** `web/src/app/(app)/relatorios/`, `web/src/components/reports/`, `web/src/components/financeiro/`, `web/src/lib/kanban/`
**Files scanned:** 12 (all directly named in `10-CONTEXT.md`'s `<canonical_refs>` and `10-RESEARCH.md`'s "Recommended Project Structure")
**Pattern extraction date:** 2026-08-21
