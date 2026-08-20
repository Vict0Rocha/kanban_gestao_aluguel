# Phase 9: Integridade de datas do contrato nas parcelas - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 6 (2 new, 4 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `web/src/lib/kanban/parcelas.ts` (add: candidatoOrfao/parcelasOrfas predicate; modify: competenciasAlvo/competenciasAlvoParaCard for D-06) | utility (pure functions) | transform | itself — `competenciaNoPeriodo` / `competenciasAlvoParaCard` in the same file | exact (extend existing module, same style) |
| `web/src/lib/kanban/actions.ts` (modify: `updateCardAction`; add: new pre-flight Server Action, e.g. `contarParcelasOrfasAction`) | controller / service (Server Action) | CRUD + request-response | `updateCardAction` itself (modify-in-place); `deleteColumnAction` for the DELETE shape; `contarParcelasEmAbertoAction` for the pre-flight shape | exact |
| `web/src/lib/kanban/queries.ts` (add: thin `unwrap()` wrapper for the new pre-flight action) | service (client-server bridge) | request-response | `contarParcelasEmAberto` (lines 94-96) | exact |
| `web/src/components/kanban/card-detail-dialog.tsx` (modify: `handleSubmit` to call pre-flight before `onSave`, and render the new confirm step) | component | request-response | `arquivar-contrato-dialog.tsx` (pre-flight-then-confirm flow) composed into itself | role-match (dialog already exists, need to add a nested confirm step, pattern borrowed from a sibling dialog) |
| new confirm sub-component/dialog (nested `AlertDialog`, D-05) — planner's call whether it's inline in `card-detail-dialog.tsx` or a new sibling file | component | request-response | `arquivar-contrato-dialog.tsx` (full file) | exact |
| `supabase/limpeza_parcelas_orfas.sql` (NEW, one-time D-08 cleanup) | migration / script (one-time, NOT a numbered migration) | batch | `supabase/verificacao_cards_numero.sql` / `supabase/verificacao_financeiro.sql` (SELECT-first, human-reviewed runbook tone) — no exact "select-then-delete" precedent exists yet | role-match (tone/structure only — no prior script in this repo actually performs a DELETE; this one introduces that pattern) |

## Pattern Assignments

### `web/src/lib/kanban/parcelas.ts` — new orphan predicate + D-06 fallback change

**Analog:** same file, `competenciaNoPeriodo` (lines 156-164) and `competenciasAlvoParaCard` (lines 230-239)

**Reuse verbatim** — the orphan test is simply the negation of the existing function, do not reimplement:
```typescript
// Source: web/src/lib/kanban/parcelas.ts:156-164
export function competenciaNoPeriodo(
  competencia: string,
  periodoInicio: string | null,
  periodoFim: string | null
): boolean {
  if (periodoInicio && competencia < inicioDoMes(periodoInicio)) return false
  if (periodoFim && competencia > inicioDoMes(periodoFim)) return false
  return true
}
```
Orphan test (D-02, new code): `!competenciaNoPeriodo(parcela.competencia, novoInicio, novoFim)`.

**Fallback discriminator to extend for D-06** (`competenciasAlvo` / `competenciasAlvoParaCard`):
```typescript
// Source: web/src/lib/kanban/parcelas.ts:93-105 (competenciasAlvo, unconditional 2-month fallback today)
export function competenciasAlvo(hojeISO: string): [string, string] {
  const [anoStr, mesStr] = hojeISO.split("-")
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  const atual = `${ano}-${String(mes).padStart(2, "0")}-01`
  const proximoMes = mes === 12 ? 1 : mes + 1
  const proximoAno = mes === 12 ? ano + 1 : ano
  const proximo = `${proximoAno}-${String(proximoMes).padStart(2, "0")}-01`
  return [atual, proximo]
}

// Source: web/src/lib/kanban/parcelas.ts:181-183 (temPeriodoCompleto — the existing discriminator style to mirror)
export function temPeriodoCompleto(card: CardParaGeracao): boolean {
  return Boolean(card.periodo_inicio) && Boolean(card.periodo_fim)
}

// Source: web/src/lib/kanban/parcelas.ts:230-239 (competenciasAlvoParaCard — where the branch lives)
export function competenciasAlvoParaCard(
  card: CardParaGeracao,
  hojeISO: string
): string[] {
  if (temPeriodoCompleto(card)) {
    return competenciasDoPeriodo(card.periodo_inicio!, card.periodo_fim!)
  }
  return competenciasAlvo(hojeISO)
}
```
D-06 needs a THIRD discriminator inserted here — "both dates null" (current-month-only) vs. "only `periodo_inicio` set" (unchanged, current+next). Mirror the `temPeriodoCompleto`-style boolean helper naming convention (e.g. `semNenhumaData(card)`), and branch either inside `competenciasAlvoParaCard` before calling `competenciasAlvo`, or by adding a parameter to `competenciasAlvo` itself (RESEARCH.md Open Question #1 — planner's discretion, both are low-risk since `competenciasAlvo` has exactly one caller today).

**Comment-writing convention to copy** (every exported function in this file has a JSDoc block citing the decision ID it implements and why — e.g. lines 149-155, 173-180, 224-229). New functions must follow this: cite D-01/D-02/D-03/D-06 explicitly in the docblock.

---

### `web/src/lib/kanban/actions.ts` — `updateCardAction` poda branch + new pre-flight action

**Analog:** `updateCardAction` itself (lines 346-380), `deleteColumnAction` (lines 270-302), `contarParcelasEmAbertoAction` (lines 617-675)

**Imports pattern** — no new imports needed; the file already imports `createClient`, error helpers, and `id()`/`validarPeriodo` validators used throughout.

**Current `updateCardAction`, the file to extend in place** (lines 346-380):
```typescript
// Source: web/src/lib/kanban/actions.ts:346-380
export async function updateCardAction(
  cardId: string,
  input: CardDetailsInput
): Promise<ActionResult<Card>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel") ?? validarDetalhes(input)
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("cards")
    .update({
      proprietario: input.proprietario.trim(),
      endereco: input.endereco.trim(),
      valor: input.valor,
      inquilino: input.inquilino?.trim() || null,
      telefone: input.telefone?.trim() || null,
      periodo_inicio: input.periodo_inicio || null,
      periodo_fim: input.periodo_fim || null,
      observacoes: input.observacoes?.trim() || null,
    })
    .eq("id", cardId)
    .select()
    .single<Card>()

  if (error || !data) {
    console.error("updateCard", error)
    return { ok: false, error: erroDoBanco(error?.code, "salvar o imóvel") }
  }
  return { ok: true, data }
}
```
**Pitfall 2 (RESEARCH.md):** today this is a blind UPDATE — no prior SELECT. Needs a `SELECT periodo_inicio, periodo_fim FROM cards WHERE id = cardId` before the UPDATE (or read the pre-update row another way) to detect "did the dates actually change" (D-04).

**DELETE + zero-rows shape to mirror** (lines 270-302, `deleteColumnAction`) — note the `P0001` trigger branch does NOT apply here (no trigger exists on `parcelas`), and per Pitfall 1, a zero-rows-affected DELETE for pruning is NOT automatically `semLinhas` failure — it can legitimately mean the race already excluded that row:
```typescript
// Source: web/src/lib/kanban/actions.ts:270-302
const { data, error } = await sessao.supabase
  .from("columns")
  .delete()
  .eq("id", columnId)
  .select("id")

if (error) {
  console.error("deleteColumn", error)
  if (error.code === "P0001") {
    return { ok: false, error: EXCLUSAO_COLUNA_BLOQUEADA_POR_LANCAMENTO }
  }
  return { ok: false, error: erroDoBanco(error.code, "excluir a coluna") }
}
if (!data || data.length === 0) {
  return { ok: false, error: semLinhas("excluir a coluna") }
}
return { ok: true, data: undefined }
```

**"Has any lançamento" join pattern to adapt** (`parcela_id` instead of `card_id`) — lines 428-443:
```typescript
// Source: web/src/lib/kanban/actions.ts:428-443
async function cardTemLancamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cardId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("parcela_lancamentos")
    .select("id, parcelas!inner(card_id)")
    .eq("parcelas.card_id", cardId)
    .limit(1)
  if (error) { console.error("cardTemLancamento", error); return null }
  return (data?.length ?? 0) > 0
}
```

**Pre-flight Server Action shape to mirror exactly** (D-05's count action) — lines 617-675:
```typescript
// Source: web/src/lib/kanban/actions.ts:617-675
export async function contarParcelasEmAbertoAction(
  cardId: string
): Promise<ActionResult<{ quantidade: number; total: number }>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }

  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }

  const { data, error } = await sessao.supabase
    .from("parcelas")
    .select("...")
    .eq("card_id", cardId)

  if (error) {
    console.error("contarParcelasEmAberto", error)
    return { ok: false, error: erroDoBanco(error.code, "consultar as parcelas do imóvel") }
  }
  // ... pure-function filter over the rows, accumulate quantidade/total
  return { ok: true, data: { quantidade, total } }
}
```
The new pre-flight action for D-05 (e.g. `contarParcelasOrfasAction(cardId, novoInicio, novoFim)`) should follow this exact shape: `requireUser()` → validate `cardId` (+ new candidate dates) → query `parcelas` for the card with `status='aberta'` + `parcela_lancamentos(id)` embed → filter with the new `!competenciaNoPeriodo(...)` predicate AND zero-lançamento check → return `{ quantidade }`. **Per Pitfall 1, this count is advisory-only** — `updateCardAction`'s own delete branch must re-query at save time, never accept an ID list from the client/pre-flight result.

**Error sanitization to reuse, not reinvent** (lines 174-184):
```typescript
// Source: web/src/lib/kanban/actions.ts:174-184
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

**Validation helper to reuse:** `validarPeriodo` (lines 158-162) already rejects `fim < inicio` — no new validation logic needed for the date pair itself, only for the new pruning query's inputs (reuse `id()` helper, line ~82-86, for `cardId`).

---

### `web/src/lib/kanban/queries.ts` — thin wrapper for the new pre-flight action

**Analog:** `contarParcelasEmAberto` (lines 94-96)

```typescript
// Source: web/src/lib/kanban/queries.ts:33-37 (unwrap — the bridge helper every wrapper uses)
async function unwrap<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise
  if (!result.ok) throw new Error(result.error)
  return result.data
}

// Source: web/src/lib/kanban/queries.ts:94-96 (the exact shape to mirror for the new pre-flight wrapper)
export async function contarParcelasEmAberto(id: string) {
  return unwrap(contarParcelasEmAbertoAction(id))
}
```
New wrapper (e.g. `contarParcelasOrfas(cardId, novoInicio, novoFim)`) should be a one-line `unwrap(...)` call added to this file and to the `import { ... } from "./actions"` block at the top (lines 3-22), alphabetically ordered like the rest.

---

### `web/src/components/kanban/card-detail-dialog.tsx` — pre-flight-before-save + nested confirm (D-05)

**Analog (full pre-flight-then-confirm flow to compose in):** `web/src/components/kanban/arquivar-contrato-dialog.tsx` (full file, 161 lines)

**Confirmation-state machine to mirror** (adapt the 3-state enum to D-05's simpler "count > 0 or not" case — no "conferindo" polling needed before every keystroke, only right before submit):
```typescript
// Source: web/src/components/kanban/arquivar-contrato-dialog.tsx:24-28
type PendenciaEstado =
  | { fase: "conferindo" }
  | { fase: "com-pendencia"; quantidade: number; total: number }
  | { fase: "sem-pendencia" }
  | { fase: "falhou" }
```

**AlertDialog JSX shape to mirror** (lines 97-160) — swap "Arquivar este imóvel?" copy for D-05's wording ("Esta alteração vai apagar N parcelas — Confirmar e salvar"):
```typescript
// Source: web/src/components/kanban/arquivar-contrato-dialog.tsx:97-160
<AlertDialog open={open} onOpenChange={onOpenChange}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Arquivar este imóvel?</AlertDialogTitle>
      <AlertDialogDescription>...</AlertDialogDescription>
    </AlertDialogHeader>
    {/* phase-conditional content blocks */}
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction variant="default" disabled={saving} onClick={() => { void handleConfirm() }}>
        {saving ? "Arquivando..." : "Arquivar"}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Integration point in the file being modified** — current `handleSubmit` (lines 66-98) calls `onSave` directly; D-05 requires inserting the pre-flight check (call the new `contarParcelasOrfas` query) BEFORE calling `onSave`, opening the nested confirm dialog only if `quantidade > 0`, and calling `onSave` only after "Confirmar e salvar" is clicked (or immediately if `quantidade === 0`, per D-05's "no new friction for the common case"):
```typescript
// Source: web/src/components/kanban/card-detail-dialog.tsx:66-98 (current, to be extended)
async function handleSubmit(event: React.FormEvent) {
  event.preventDefault()
  // ...validation...
  setSaving(true)
  setError(null)
  try {
    await onSave(card.id, { /* ...periodo_inicio/periodo_fim included here... */ })
    onOpenChange(false)
  } catch {
    setError("Não foi possível salvar. Tente novamente.")
  } finally {
    setSaving(false)
  }
}
```
Note: `periodo_inicio`/`periodo_fim` are read from `form` (lines 88-89) — the pre-flight call needs these two candidate values plus `card.id`, mirroring how `ArquivarContratoDialog` calls `contarParcelasEmAberto(card.id)` in a `useEffect` keyed on `[open, card.id]` (lines 60-78) — but here the trigger is "user clicked Salvar", not "dialog opened", so the call belongs inside `handleSubmit`, not a `useEffect`.

---

### `supabase/limpeza_parcelas_orfas.sql` — one-time D-08 cleanup (NEW file)

**Analog (tone/structure only, no DELETE precedent exists):** `supabase/verificacao_cards_numero.sql` and `supabase/verificacao_financeiro.sql`

**Pattern to copy:** BLOCO-numbered comment structure, an explicit "PRÉ-VOO" read-only SELECT block first, loud warning comments before any destructive block, e.g.:
```sql
-- ============================================================
-- BLOCO 1 — PRÉ-VOO (rode sozinho, só leitura, não altera nada)
-- ============================================================
select ... from public.parcelas where ...;   -- lista as 27 órfãs para revisão humana

-- ============================================================
-- BLOCO 2 — EXCLUSÃO (só rode depois de revisar o BLOCO 1)
-- ============================================================
delete from public.parcelas where id in (...);
```
**Key divergence from every existing script in `supabase/`:** those are all verification runbooks that end in `rollback;` — this is the first script in the repo meant to actually commit a `DELETE`. Do not wrap it in `begin;...rollback;` — the whole point (D-08) is that the operator reviews BLOCO 1's output, then deliberately runs BLOCO 2 separately. **Critical:** this must NOT go in `supabase/migrations/` — it is a standalone one-time script (Pitfall 4).

**DELETE predicate must reuse D-02's full criterion** (status='aberta' AND zero `parcela_lancamentos`), written directly in SQL — mirror the `WHERE NOT EXISTS (...)` shape RESEARCH.md recommends as a second defense layer:
```sql
where parcelas.status = 'aberta'
  and not exists (
    select 1 from public.parcela_lancamentos pl where pl.parcela_id = parcelas.id
  )
  and <out-of-period test, e.g. competencia < período atual do card, or > período atual>
```

## Shared Patterns

### Auth gate (every Server Action)
**Source:** every action in `web/src/lib/kanban/actions.ts`, e.g. `updateCardAction` lines 350-351
```typescript
const sessao = await requireUser()
if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
```
**Apply to:** the new pre-flight Server Action, and no change needed for `updateCardAction` (already has it).

### Error sanitization
**Source:** `erroDoBanco` / `semLinhas` (`actions.ts:174-184`)
**Apply to:** all new/modified query and delete error paths in `actions.ts`. **Divergence:** the DELETE for pruning must NOT check `error.code === "P0001"` (no trigger exists on `parcelas`), unlike `deleteColumnAction`.

### RLS — no new policy needed
**Source:** `supabase/migrations/20260816000000_financeiro_schema.sql:158-161` — `create policy "team full access parcelas" on public.parcelas for all to authenticated using (is_team_member()) with check (is_team_member())`. `for all` already covers DELETE.
**Apply to:** nothing — this is a confirmed non-change, noted so the plan doesn't add an unnecessary migration.

### Pre-flight-count-then-confirm dialog
**Source:** `arquivar-contrato-dialog.tsx` (full file) and `excluir-contrato-dialog.tsx` (not read in full this session, but named by RESEARCH.md as the same-family precedent with heavier fricton for full-contract deletion — do not copy its stronger "type to confirm" friction, D-05 explicitly wants the lighter "Confirmar e salvar" click only)
**Apply to:** the new D-05 confirmation step nested in/around `card-detail-dialog.tsx`.

### Docblock convention citing decision IDs
**Source:** every exported function in `web/src/lib/kanban/parcelas.ts` (e.g. lines 89-91, 107-111, 117-125, 149-155)
**Apply to:** all new functions in `parcelas.ts` and the new/modified actions in `actions.ts` — cite D-01 through D-08 by ID in the comment, matching this codebase's established practice of documenting *why*, not just *what*.

## No Analog Found

None — every file in scope has at least a role-match analog. The one partial gap is noted above: `supabase/limpeza_parcelas_orfas.sql` has no prior *DELETE-executing* script to copy in this repo (all existing `supabase/*.sql` verification scripts end in `rollback;`); only the BLOCO-numbered structural tone is reusable, the destructive-block pattern itself is new to this codebase.

## Metadata

**Analog search scope:** `web/src/lib/kanban/` (parcelas.ts, actions.ts, queries.ts, visibilidade.ts, types.ts), `web/src/components/kanban/` (card-detail-dialog.tsx, arquivar-contrato-dialog.tsx, excluir-contrato-dialog.tsx), `supabase/` (all `*.sql` at root), `supabase/migrations/20260816000000_financeiro_schema.sql`
**Files scanned:** 10
**Pattern extraction date:** 2026-08-20
