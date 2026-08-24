# Phase 13: Dinheiro da imobiliária - Pattern Map

**Mapped:** 2026-08-24
**Files analyzed:** 14 (new) + 3 (modified)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/2026082X000000_dinheiro_imobiliaria.sql` | migration | CRUD (DDL) | `supabase/migrations/20260816000000_financeiro_schema.sql` (+ `20260819000000_cards_arquivado_em.sql` for additive-column style) | exact |
| `web/src/lib/kanban/taxas.ts` (new lib, mirrors `parcelas.ts`) | utility | transform | `web/src/lib/kanban/parcelas.ts` (`somarLancamentos`, `statusDeParcela`, pure calc functions) | exact (structural twin, NOT the same sums) |
| `web/src/lib/kanban/actions.ts` — `registrarPagamentoAction` (extend) | service/action | request-response, CRUD | itself, `exigirParcelaVisivel`/`exigirParcelaNaoConciliada`/`recalcularEGravarStatus` (helpers to reuse, NOT extend for taxa) | exact |
| `web/src/lib/kanban/actions.ts` — `salvarPercentuaisAction` (new) | service/action | CRUD | `createColumnAction`/`updateCardAction`-style validate→write→erroDoBanco action shape | role-match |
| `web/src/lib/kanban/actions.ts` — `registrarEventoCaucaoAction` (new, tipo-aware) | service/action | event-driven, CRUD | `registrarPagamentoAction` (insert into ledger table) + `cancelarLancamento`-style tipo dispatch from `CancelarLancamentoDialog`'s `TIPO` map | role-match |
| `web/src/lib/kanban/actions.ts` — `buscarReconciliacaoAction` (new) | service/action | request-response | `buscarParcelasRelatorioAction` (feeds `/relatorios/financeiro`) | exact |
| `web/src/app/(app)/financeiro/configuracao/page.tsx` | route (Server Component) | request-response | `web/src/app/(app)/relatorios/financeiro/page.tsx` | exact |
| `web/src/components/financeiro/configuracao-financeira-view.tsx` | component (client) | CRUD | `web/src/components/financeiro/parcelas-table.tsx` (table shell + `erro`/`vazio` props) + `financeiro-view.tsx` (page-level wiring) | exact |
| `web/src/components/financeiro/configurar-percentuais-dialog.tsx` | component (dialog) | CRUD | `web/src/components/financeiro/ajustar-parcela-dialog.tsx` (not read directly, but named identical-shape analog by UI-SPEC) — use `registrar-pagamento-dialog.tsx` as the concretely-read stand-in (same field/error/footer shape) | role-match |
| `web/src/components/financeiro/registrar-pagamento-dialog.tsx` (extend) | component (dialog) | CRUD | itself | exact |
| `web/src/components/financeiro/caucao-historico-sheet.tsx` | component (sheet) | event-driven | `web/src/components/financeiro/parcela-historico-sheet.tsx` | exact |
| `web/src/components/financeiro/registrar-evento-caucao-dialog.tsx` | component (dialog, tipo-aware) | CRUD, event-driven | `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` (tipo-aware pattern via `TIPO` map) + `registrar-pagamento-dialog.tsx` (field/footer shape) | exact |
| `web/src/components/financeiro/caucao-evento-label.tsx` | component (label) | transform | `web/src/components/financeiro/lancamento-tipo-label.tsx` (`LancamentoTipoLabel`/`TIPO` map) | exact |
| `web/src/app/(app)/relatorios/imobiliaria/page.tsx` | route (Server Component) | request-response | `web/src/app/(app)/relatorios/financeiro/page.tsx` | exact |
| `web/src/components/reports/dinheiro-imobiliaria-view.tsx` (or similar) | component (client) | transform, request-response | `web/src/components/reports/relatorio-financeiro-dedicado.tsx` + `filtro-relatorio-financeiro-live.tsx` (live period filter, no submit) | exact |
| `web/src/app/(app)/financeiro/page.tsx` (extend — add entry button) | route | request-response | itself (header/actions row) | exact |
| `web/src/app/(app)/relatorios/page.tsx` (extend — add entry button) | route | request-response | Phase 10's RELDED-01 entry-button precedent (not re-read; same file) | exact |

## Pattern Assignments

### Migration: `supabase/migrations/2026082X000000_dinheiro_imobiliaria.sql`

**Analog:** `supabase/migrations/20260816000000_financeiro_schema.sql` (table+RLS+constraints), `supabase/migrations/20260819000000_cards_arquivado_em.sql` (additive column on `cards`, no-backfill nullable column, header banner)

**Header banner pattern** (financeiro_schema.sql lines 1-21; arquivado_em lines 1-28): every migration opens with a comment block stating (a) what it adds, (b) "ESTA MIGRAÇÃO É ESTRITAMENTE ADITIVA" + the exact no-drop/no-rename/no-retype guarantee, (c) "REEXECUTÁVEL" — every DDL uses `if not exists`/`create or replace`/`drop ... if exists` before recreate, (d) pointer to a runbook file under `supabase/verificacao_*.sql`. Copy this shape verbatim for the new migration; new percentual columns on `cards` follow the `arquivado_em` "nullable, no default, no backfill UPDATE" style ONLY if a null percentual is meaningful — otherwise use `financeiro_schema.sql`'s "not null default X" style (D-02 wants defaults 10/50, so prefer `not null default 10`/`not null default 50`, additive, no backfill needed because Postgres fast-default fills existing rows without rewrite — see lines 33-38).

**Table creation pattern** (financeiro_schema.sql lines 45-55, 160-170):
```sql
create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  ...
  status text not null default 'aberta',
  ...
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);
```
Use this exact shape for a new `caucao_eventos` (or similar name) table: `card_id` FK with `on delete cascade`, `tipo text` + CHECK (not a Postgres enum — see rationale lines 57-61), `valor numeric(12,2)`, `data date not null default current_date`, `observacao text`, `criado_por uuid references profiles(id)`, `criado_em timestamptz not null default now()`. Same shape applies to the "taxa da imobiliária" ledger table (e.g. `taxas_imobiliaria` or `parcela_taxas`) — separate table, NEVER a new `tipo` value inside `parcela_lancamentos` (this is D-04's locked structural constraint).

**Constraints pattern** (financeiro_schema.sql lines 68-96, 177-216): `drop constraint if exists` for every named constraint, then a single `add constraint ... check (...)` chain. Comment block after explaining *why* each constraint exists and *why* not stricter. Replicate: `check (valor > 0 and valor < 10000000)` for money columns, `check (tipo in (...))` for the ledger `tipo`, and any percentual columns should get `check (percentual >= 0 and percentual <= 100)` (new pattern, no existing analog — invent following this same drop/add/comment shape).

**Index pattern** (lines 101-122, 222-226): `create index if not exists <table>_<col>_idx on public.<table> (<col>)`. New tables need at minimum an index on `card_id` (ledger tables are always read by contract).

**RLS pattern** (lines 129-146, 233-242) — copy verbatim per new table:
```sql
alter table public.<table> enable row level security;
drop policy if exists "team full access <table>" on public.<table>;
create policy "team full access <table>"
  on public.<table> for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());
```
No other predicate. Never reintroduce `auth.role() = 'authenticated'`.

**Backstop-trigger pattern (optional, evaluate need):** `20260819000000_cards_arquivado_em.sql` lines 85-148 shows the `impedir_exclusao_de_card_com_lancamento` trigger (`security invoker`, `set search_path = ''`, fully-qualified table names, single `raise exception` at SQLSTATE P0001, `before delete on cards for each row`). If deleting a `card` should also be blocked when it has caução/taxa ledger rows, this function's `where` clause needs extending (or a parallel trigger added) — flag for the planner as an open question grounded in D-04's "aditivo" spirit.

---

### `web/src/lib/kanban/taxas.ts` (new pure-calc module)

**Analog:** `web/src/lib/kanban/parcelas.ts` (whole file, esp. lines 1-9, 395-431)

**Module header constraint** (parcelas.ts lines 1-9): "Este módulo NÃO pode importar `@/lib/supabase/server` nem `next/headers`" — pure functions only, because types/functions here are consumed by client components. Mirror this constraint in the new `taxas.ts`.

**Central rule to implement, D-01/D-08:** first-competência-of-contract lookup is `min(competencia) where card_id = ...` (a query, not a pure function — belongs in the Server Action, see below), then:
```ts
// mirrors somarLancamentos's pure-calc shape (parcelas.ts:395-413)
export function percentualAplicavel(
  competencia: string,
  primeiraCompetenciaDoContrato: string,
  percentualAdministracao: number,
  percentualComissaoPrimeiroAluguel: number
): { percentual: number; origem: "administracao" | "comissao_primeiro_aluguel" } {
  if (competencia === primeiraCompetenciaDoContrato) {
    return { percentual: percentualComissaoPrimeiroAluguel, origem: "comissao_primeiro_aluguel" }
  }
  return { percentual: percentualAdministracao, origem: "administracao" }
}
```
**D-04 boundary — the single most important line to put in this file's header comment:** "Nada aqui soma ou é somado por `somarLancamentos`/`statusDeParcela` (parcelas.ts). A taxa da imobiliária é estruturalmente separada do livro-razão de `parcela_lancamentos` e nunca entra em `valorDevido`/`valorPago`/`status` de uma parcela." This mirrors the doc-comment discipline already used throughout `parcelas.ts` (e.g. lines 391-394 on `somarLancamentos`).

**Caução saldo calc** (new, no analog — invent following `somarLancamentos`'s reduce-over-array shape): `saldo = sum(recebido) - sum(devolvido) - sum(usado)`.

---

### `web/src/lib/kanban/actions.ts` — extend `registrarPagamentoAction`

**Analog:** itself (lines 1016-1069+), plus helpers `exigirParcelaVisivel` (895-931), `exigirParcelaNaoConciliada` (944-963), `recalcularEGravarStatus` (971-1014), `semLinhas`/`erroDoBanco` (180-190).

**Current signature and body** (lines 1016-1069):
```ts
export async function registrarPagamentoAction(
  parcelaId: string,
  valor: number,
  data: string,
  observacao: string | null
): Promise<ActionResult> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido =
    id(parcelaId, "Parcela") ??
    valorLancamento(valor, "Informe um valor de pagamento válido.") ??
    dataObrigatoria(data) ??
    textoOpcional(observacao, "Observação", 2000)
  if (invalido) return { ok: false, error: invalido }

  const recusa = await exigirParcelaVisivel(sessao.supabase, parcelaId)
  if (recusa) return { ok: false, error: recusa }
  const recusaConciliada = await exigirParcelaNaoConciliada(sessao.supabase, parcelaId)
  if (recusaConciliada) return { ok: false, error: recusaConciliada }

  const { data: inserido, error } = await sessao.supabase
    .from("parcela_lancamentos")
    .insert({ parcela_id: parcelaId, tipo: "pagamento", valor, data,
      observacao: observacao?.trim() || null, criado_por: sessao.user.id })
    .select("id")

  if (error) return { ok: false, error: erroDoBanco(error.code, "registrar o pagamento") }
  if (!inserido || inserido.length === 0) return { ok: false, error: semLinhas("registrar o pagamento") }

  const erroStatus = await recalcularEGravarStatus(sessao.supabase, parcelaId)
  if (erroStatus) return { ok: false, error: erroStatus }
  ...
}
```

**Extension point:** add a new parameter `taxaImobiliaria: number | null` (or a second explicit "0 counts as legit" — UI-SPEC allows R$ 0,00 to be submittable, D-03). After the existing `parcela_lancamentos` insert + `recalcularEGravarStatus` call succeeds, insert a SEPARATE row into the new taxa ledger table (`taxas_imobiliaria` or similar), scoped by `card_id` (resolved via `parcela.card_id`, per the CONTEXT.md canonical-refs note: "a Server Action precisa resolver o contrato via `parcela.card_id`"). **Critical: do NOT call `recalcularEGravarStatus` for the taxa insert** — that function only touches `parcelas.status` from `parcela_lancamentos`, and the taxa table is intentionally outside that computation (D-04). Reuse `exigirParcelaVisivel`/`exigirParcelaNaoConciliada` as-is (same parcela, same visibility/lock rules apply to whether a taxa can be registered) — do not duplicate or fork them.

**New action `salvarPercentuaisAction`** — same validate→write→erroDoBanco shape as any simple update action (see `createColumnAction` lines 196-219 for the general shape: `requireUser()` → inline `??`-chained validators → `.insert()/.update()` → `erroDoBanco(error?.code, "<ação>")`/`semLinhas`).

**New action `registrarEventoCaucaoAction`** — tipo-aware (`"recebido" | "devolvido" | "usado"`), same insert shape as `registrarPagamentoAction`'s ledger insert but against the new caução table, no `recalcularEGravarStatus` call at all (caução never touches `parcelas`).

**New action `buscarReconciliacaoAction`** — modeled on `buscarParcelasRelatorioAction` (feeds `/relatorios/financeiro/page.tsx`): `requireUser()` → query → return `{ ok: true, data: {...} }` / `{ ok: false, error }`, consumed by a Server Component page (`relatorios/imobiliaria/page.tsx`) the same way.

---

### `web/src/components/financeiro/registrar-pagamento-dialog.tsx` (extend)

**Analog:** itself, full file (172 lines) — read in full above.

**Current structure to preserve exactly:** `wasOpen` resync-on-reopen pattern (lines 71-80), `valorInicial()` helper (lines 35-39) computing the suggested starting value, `flex flex-col gap-1.5` field wrapper (lines 132-141 etc.), single error line + `DialogFooter` with one submit button (lines 161-167).

**New props required** (per UI-SPEC §2): `percentualAplicavel: number`, `origemPercentual: "administracao" | "comissao_primeiro_aluguel"` — computed server-side by the parent (`AcoesCell`/`ParcelasTable`), passed down, never looked up inside the dialog.

**New "smart default, sticky once touched" interaction — concrete implementation guidance** (no existing precedent in this codebase, UI-SPEC §2 spells it out precisely): add a `taxaTocada` boolean state, reset in the same `wasOpen` resync block (lines 71-80) alongside `setValor`/`setData`/`setObservacao`/`setError`. Initialize taxa field to `round2(percentualAplicavel / 100 * parsedValorInicial)` on open. On every `onChange` of the existing "Valor recebido" `Input` (line 139, currently just `setValor(e.target.value)`), ALSO recompute the taxa field IF `!taxaTocada`:
```ts
onChange={(e) => {
  setValor(e.target.value)
  if (!taxaTocada) {
    const novoValor = Number(e.target.value.replace(",", "."))
    if (Number.isFinite(novoValor)) {
      setTaxa(round2((percentualAplicavel / 100) * novoValor).toFixed(2).replace(".", ","))
    }
  }
}}
```
The taxa field's own `onChange` sets `taxaTocada = true` before setting its value. Field placement: directly below "Valor recebido," above "Data do pagamento" (renumber existing fields 3rd/4th). Helper text below field per Copywriting Contract, `text-xs text-muted-foreground` (no existing analog for a helper line under a field in this dialog — closest precedent is the two `<p className="text-sm text-muted-foreground">` context lines in `DialogHeader`, lines 122-128, same tone class family scaled to `text-xs`).

**`AjustarParcelaDialog` is explicitly untouched** — D-07 confirmed, do not add symmetry.

---

### `web/src/components/financeiro/parcela-historico-sheet.tsx` → `caucao-historico-sheet.tsx`

**Analog:** `parcela-historico-sheet.tsx`, full file (139 lines) — read above.

**Sheet shell to copy** (lines 57-66): `Sheet open/onOpenChange` → `SheetContent side="right" className="w-full p-0 sm:max-w-md"` → `SheetHeader className="border-b border-border"` with `SheetTitle` + subtitle `<p className="text-sm text-muted-foreground">`.

**List body to copy** (lines 68-124): `<div className="flex-1 overflow-y-auto p-4">`, empty-state `<p className="text-sm text-muted-foreground">` when list is empty, else `<ul className="flex flex-col gap-3">` of `<li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">` cards, each showing a type label (top-right value with sign), date + author line, optional observação line. `prefixoValor` (lines 26-30) is the exact pattern for the `+`/`−` sign prefix — for caução: `+` recebido, `−` devolvido/usado (UI-SPEC §3 confirms same convention).

**New addition — `SheetFooter`** (not used by `parcela-historico-sheet.tsx` today, but the component already exists under `web/src/components/ui/sheet.tsx` per UI-SPEC's Registry Safety note): `mt-auto flex flex-col gap-2 p-4`, rendered conditionally per computed saldo — 0/1/2 buttons (UI-SPEC §3 copy). This is a genuinely new shape in this codebase; no existing call site to copy from beyond the component definition itself.

**No cancel button per event** — deliberate divergence from `parcela-historico-sheet.tsx` lines 107-118 (`Trash2`/"Cancelar" ghost button) — caução events have no cancellation mechanism this phase, so that block is NOT replicated.

**Ordering divergence to note for planner:** this Sheet is chronological ASCENDING (oldest first) — same as `parcela-historico-sheet.tsx`'s underlying `LancamentoDetalhado[]` order — do not flip to descending like the reconciliation report (§4) uses.

---

### `web/src/components/financeiro/cancelar-lancamento-dialog.tsx` → `registrar-evento-caucao-dialog.tsx`

**Analog:** `cancelar-lancamento-dialog.tsx`, full file (111 lines) — read above, for the **tipo-aware generalization pattern** (one component, three copy variants via a lookup map), NOT for its destructive/`AlertDialog` shape (caução events are additive, not destructive — UI-SPEC explicitly rules out `AlertDialog`/destructive styling here).

**Pattern to copy:** `tipo` prop typed as a union (`Extract<..., "pagamento" | "acrescimo" | "desconto">` at line 40) driving copy via a lookup map (`TIPO[tipo].label` at lines 27, 50, 85-87, 105). For the caução dialog, build an analogous local map keyed by `"recebido" | "devolvido" | "usado"` → `{ title, submitLabel, submitLoadingLabel }` (per UI-SPEC Copywriting Contract: "Registrar caução recebida"/"Registrar devolução da caução"/"Registrar uso da caução").

**Shape to copy from `registrar-pagamento-dialog.tsx` instead (§3 UI-SPEC explicitly says "same shape as `RegistrarPagamentoDialog`")**: `Dialog` + `DialogContent className="sm:max-w-md"`, three fields (`Valor`, `Data`, `Observação`) in `flex flex-col gap-1.5` wrappers, one error line, one-button `DialogFooter` — copy `registrar-pagamento-dialog.tsx` lines 117-171 as the base, replace the `AlertDialog` structure entirely (do not use `cancelar-lancamento-dialog.tsx`'s `AlertDialog*` components — this is additive, not destructive).

**`wasOpen` resync pattern** — copy from either analog (both use it identically): lines 71-80 of `registrar-pagamento-dialog.tsx` or lines 55-62 of `cancelar-lancamento-dialog.tsx`.

**Pre-fill rule (UI-SPEC):** "Valor" is pre-filled with full saldo for devolução/uso (editable — partial devolução/uso is legit), empty for recebimento — mirror `valorInicial()`'s pattern (parcela-historico-sheet is not the source here; `registrar-pagamento-dialog.tsx` lines 35-39's `valorInicial` shape is the closest concrete precedent for a "computed starting string, empty when non-applicable" helper).

---

### `web/src/components/financeiro/lancamento-tipo-label.tsx` → `caucao-evento-label.tsx`

**Analog:** referenced (not read in full — imported at `parcela-historico-sheet.tsx:9` and `cancelar-lancamento-dialog.tsx:9` as `TIPO`/`LancamentoTipoLabel`). Icon+label component keyed by tipo, exported as both a `TIPO` lookup map (used by dialogs for copy) and a `LancamentoTipoLabel` component (used by the sheet for the badge). Mirror this exact dual-export shape for `CaucaoEventoLabel`/`CAUCAO_TIPO`, keyed by `"recebido" | "devolvido" | "usado"`, using the status-tone icons from UI-SPEC (Color §Status tones: `PiggyBank`/`Undo2`/`ShieldCheck`).

---

### `web/src/app/(app)/relatorios/financeiro/page.tsx` → `web/src/app/(app)/relatorios/imobiliaria/page.tsx`

**Analog:** full file (43 lines) — read above, copy near-verbatim.

```tsx
export default async function RelatorioFinanceiroPage() {
  const resultado = await buscarParcelasRelatorioAction()
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-2">
        <Link href="/relatorios" className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ChevronLeft className="size-3.5" />
          Relatórios
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Relatório Financeiro</h1>
          <p className="text-sm text-muted-foreground">...</p>
        </div>
      </div>
      {resultado.ok ? (
        <RelatorioFinanceiroDedicado parcelas={resultado.data.parcelas} hojeISO={resultado.data.hojeISO} />
      ) : (
        <p className="text-sm text-muted-foreground">Não foi possível carregar o relatório agora. Tente novamente.</p>
      )}
    </div>
  )
}
```
Replace `buscarParcelasRelatorioAction` with the new `buscarReconciliacaoAction`, back link text "Relatórios" (unchanged, same parent route), `h1` text "Dinheiro da imobiliária" + subtitle per Copywriting Contract, and swap `RelatorioFinanceiroDedicado` for the new client view component. The `resultado.ok ? ... : <p>...</p>` ternary is the exact page-level error pattern (E4's "error" backstop resolution in UI-SPEC's error-state row).

---

### `web/src/components/reports/relatorio-financeiro-dedicado.tsx` + `filtro-relatorio-financeiro-live.tsx` → new reconciliation view

**Analog:** both files, full — read above.

**Live-filter, no-submit pattern** (`relatorio-financeiro-dedicado.tsx` lines 52-67, `filtro-relatorio-financeiro-live.tsx` lines 20-45): local `filtro` state IS the applied state (no draft/apply split), every `onChange` writes directly via `onChange((atual) => ({ ...atual, [campo]: valor }))`, tiles/list recompute via `React.useMemo` keyed on `[parcelas, filtro, hojeISO]` (or period). No "Gerar" button anywhere. Copy this shape for the reconciliation view — a single `Período` `type="month"` field defaulting to `hojeEmCuiaba()`'s month, no `Collapsible`/`Filter` toggle (UI-SPEC §4 explicitly rules that out — "single field does not warrant the Filtrar/Fechar filtros toggle pattern").

**Tile grid pattern** (lines 174-192):
```tsx
<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  {categorias.map((categoria) => {
    const { icon, label } = ICONE_E_ROTULO[categoria.situacao]
    return (
      <StatTile key={...} icon={icon} label={label} value={String(categoria.quantidade)}
        hint={formatCurrency(categoria.total)}
        tone={categoria.situacao === "vencida" && categoria.quantidade > 0 ? "alert" : "default"} />
    )
  })}
</div>
```
For §4's six-tile grid, use `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` (UI-SPEC's exact override) instead of the 4-col variant, `StatTile` reused verbatim with the six labels from Copywriting Contract, `value={formatCurrency(...)}` instead of a quantity (since these are money totals, not counts) — check `StatTile`'s props shape before assuming `value`/`hint` split matches 1:1 (StatTile itself was not re-read here — component location `web/src/components/reports/stat-tile.tsx`, confirm exact prop names during planning, not assumed from this analog alone).

**No PDF export, no `Collapsible`** — this view is simpler than `RelatorioFinanceiroDedicado`: drop `exportando`/`erroExportacao`/`FiltroRelatorioFinanceiroLive`'s `Collapsible` wrapper entirely; keep only the `<div className="flex flex-wrap items-center justify-between gap-4">` actions row (right-aligned Período input) and the tile grid + list below.

**List sort divergence:** UI-SPEC mandates DESCENDING by date (most recent first) for this report's list — opposite of `relatorio-financeiro-dedicado.tsx`'s `linhasFiltradas` sort (lines 88-90, ascending). Do not copy that `.sort()` direction; invert the comparator.

---

## Shared Patterns

### Server Action shape (auth → validate → write → sanitize error)
**Source:** `web/src/lib/kanban/actions.ts` lines 47-56 (`requireUser`), 180-190 (`semLinhas`/`erroDoBanco`), 1016-1069 (`registrarPagamentoAction` as the fullest example)
**Apply to:** every new Server Action this phase (`salvarPercentuaisAction`, `registrarEventoCaucaoAction`, `buscarReconciliacaoAction`, extended `registrarPagamentoAction`)
```ts
async function requireUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return { supabase, user }
}
const NAO_AUTENTICADO = "Sessão expirada. Entre novamente para continuar."

function semLinhas(acao: string) {
  return `Não foi possível ${acao}: sem permissão ou o registro já não existe.`
}
function erroDoBanco(codigo: string | undefined, acao: string) {
  if (codigo === "23514") return "Os dados informados não passaram na validação."
  if (codigo === "23503") return "O registro relacionado não existe mais."
  if (codigo === "PGRST116") return semLinhas(acao)
  return `Não foi possível ${acao}. Tente novamente.`
}
```
Never use `service_role` — always the session-scoped client from `requireUser()`, RLS stays the backstop.

### D-04 boundary (the phase's central structural constraint)
**Source:** `web/src/lib/kanban/parcelas.ts` lines 395-431 (`somarLancamentos`, `statusDeParcela`), `web/src/lib/kanban/actions.ts` lines 971-1014 (`recalcularEGravarStatus`)
**Apply to:** every new write path for taxa/caução — these two functions must NEVER receive or be triggered by taxa/caução data. `recalcularEGravarStatus` is called exactly once per `registrarPagamentoAction`/`ajustarParcelaAction` invocation today (for the existing `parcela_lancamentos` insert only); the new taxa insert added to `registrarPagamentoAction` must sit AFTER that call completes and must NOT itself trigger a second call to `recalcularEGravarStatus`. `somarLancamentos`'s `LancamentoResumo["tipo"]` union (`"pagamento" | "acrescimo" | "desconto" | "destrava"`) must never gain a `"taxa"` member — this is the literal encoding of D-04.

### Additive migration discipline
**Source:** `supabase/migrations/20260816000000_financeiro_schema.sql` full header (lines 1-21), `supabase/migrations/20260819000000_cards_arquivado_em.sql` full header (lines 1-28)
**Apply to:** the new migration file — no dropped/renamed/retyped columns, every DDL statement idempotent (`if not exists`/`create or replace`/`drop ... if exists` before recreate), RLS via `public.is_team_member()` only, comment-driven rationale for every constraint and every deliberately-absent index/constraint.

### `erro`/`vazio` page-level prop pattern (UI-SPEC's flagged gap for §1's Configuração financeira table)
**Source:** `web/src/app/(app)/financeiro/page.tsx` lines 77-162 (try/catch → `erro = true`), `web/src/components/financeiro/financeiro-view.tsx` lines 31-47 (props), `web/src/components/financeiro/parcelas-table.tsx` lines 166-194 (`erro`/`vazio`/`mensagemVazia` rendering)
**Apply to:** `configuracao-financeira-view.tsx` and its page — copy the exact `erro?: boolean` optional prop + ternary rendering:
```tsx
// page.tsx
let linhas: ContratoConfig[] = []
let erro = false
try {
  const { data, error } = await supabase.from("cards").select(...)
  if (error) throw error
  linhas = data ?? []
} catch (erroCapturado) {
  console.error("financeiro/configuracao", erroCapturado)
  erro = true
}
// ...
<ConfiguracaoFinanceiraView linhas={linhas} erro={erro} />
```
```tsx
// component
{erro ? (
  <p className="text-sm text-muted-foreground">Não foi possível carregar os dados agora. Tente novamente.</p>
) : linhas.length === 0 ? (
  <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado ainda.</p>
) : (
  <Table>...</Table>
)}
```
This is the exact gap the UI-SPEC's "UI Considerations" table flagged (E1 table `error` row: "not explicitly speced... planner should reuse the same `erro` boolean prop pattern already established by `ParcelasTable`/`FinanceiroView`"). Table wrapper: `rounded-2xl border border-border bg-card p-6` (UI-SPEC §1 — note `p-6`, not `ParcelasTable`'s `p-5`, per the Spacing Scale table's explicit `lg` token rationale).

### Entry-button-not-nav-item pattern (RELDED-01 precedent)
**Source:** not re-read this session (already cited in UI-SPEC lines 52-57 as the RELDED-01 precedent from Phase 10) — apply the same placement convention: `Button variant="outline" size="sm"` inside the existing page's header/actions row, never added to `AppShell`'s `NAV_ITEMS`.

## No Analog Found

None — every file in this phase has at least a role-match analog above. The two genuinely novel interactions (taxa field's live-recompute-until-touched in §2, and the `SheetFooter` persistent action footer in §3) have no direct prior implementation in this codebase; UI-SPEC specifies both precisely enough to implement from spec + the closest structural analog (`wasOpen` resync pattern; `Sheet`/`SheetFooter` component definitions).

## Metadata

**Analog search scope:** `web/src/lib/kanban/`, `web/src/components/financeiro/`, `web/src/components/reports/`, `web/src/app/(app)/financeiro/`, `web/src/app/(app)/relatorios/`, `supabase/migrations/`
**Files read in full:** `20260816000000_financeiro_schema.sql`, `20260819000000_cards_arquivado_em.sql`, `parcelas.ts`, `registrar-pagamento-dialog.tsx`, `parcela-historico-sheet.tsx`, `cancelar-lancamento-dialog.tsx`, `relatorios/financeiro/page.tsx`, `relatorio-financeiro-dedicado.tsx`, `filtro-relatorio-financeiro-live.tsx`, `financeiro/page.tsx`, `financeiro-view.tsx`; targeted reads: `actions.ts` (lines 1-60, 170-220, 890-1069)
**Pattern extraction date:** 2026-08-24
