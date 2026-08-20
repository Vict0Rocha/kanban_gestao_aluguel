# Phase 9: Integridade de datas do contrato nas parcelas - Research

**Researched:** 2026-08-20
**Domain:** Server Action write-path logic + one-time SQL cleanup, on an existing Next.js 16.3/React 19/Supabase (Postgres+RLS) app. No new library, no new framework, no external service.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Apagar, não só esconder (reverte D-03)**
- **D-01:** Ao contrário da decisão já documentada em `docs/data-model.md` (D-03 — "nada é apagado quando uma parcela deixa de aparecer"), esta fase **apaga de verdade** as parcelas órfãs. Decisão explícita do usuário, dada depois de ver o conflito com D-03 apontado diretamente: ele quer evitar "informações soltas e desnecessárias no banco de dados". — **Reversibility:** one-way — parcela apagada não volta; se o usuário reverter o período depois, a parcela é gerada de novo do zero, com `valor_original` fotografando o `cards.valor` **daquele momento**, que pode já ser diferente do original (mesmo comportamento que D-03 já previa como consequência de regenerar).
- **D-02:** Critério de "órfã apagável": pertence ao card, está **fora do período atual** (`competenciaNoPeriodo` de `web/src/lib/kanban/parcelas.ts:156` devolvendo `false` — reaproveitar esta função, não reimplementar o teste de período), `status = 'aberta'` **e** não existe nenhuma linha em `parcela_lancamentos` para ela. As duas condições (status E ausência de lançamento) são redundantes na prática — todo status diferente de `aberta` implica pelo menos um lançamento — mas ambas devem ser checadas, mesma defesa em profundidade usada na consulta de verificação desta conversa. Nunca checar só o status.
- **D-03:** A regra não distingue órfã "no futuro" de órfã "no passado" — mudar `periodo_inicio` para frente (cortando meses do início) poda exatamente como mudar `periodo_fim` para trás (cortando meses do fim), pelo mesmo critério de D-02. Generalização deliberada do exemplo dado pelo usuário (que falou só do caso "encurtar do fim"): o princípio que ele declarou logo depois ("todas as partes do sistema precisam respeitar exatamente a data que está no contrato") não distingue direção. Se o planner/executor achar isso arriscado demais para uma fase, é o ponto certo para levantar no plano.

**Quando a poda roda (Claude's Discretion — nenhuma área foi selecionada para discussão; usuário respondeu "sem preferência" em todas)**
- **D-04:** Poda roda **síncrona**, dentro da mesma Server Action que grava `periodo_inicio`/`periodo_fim` (`updateCardAction`, `web/src/lib/kanban/actions.ts:345`) — não preguiçosa como a geração (`garantirParcelas`). Razão: apagar é muito mais consequente que gerar (gerar é aditivo/idempotente via upsert; apagar é destrutivo). Rodar na hora do salvar liga a causa (editar a data) ao efeito (parcelas sumindo) no mesmo instante, em vez de a poda acontecer num momento imprevisível — a próxima vez que alguém abrir Financeiro ou Relatórios, que hoje é uma tela deliberadamente só-leitura. Só dispara quando `periodo_inicio` e/ou `periodo_fim` realmente mudam de valor nesta chamada — não em todo salvar de card.
- **D-05:** Antes de apagar, se a edição vai remover uma ou mais parcelas órfãs, o salvamento mostra quantas serão apagadas e exige um clique explícito de confirmação ("Confirmar e salvar", não o texto digitado tipo "excluir <id>" — esse nível de fricção fica reservado para excluir o contrato inteiro). Se a edição não apaga nenhuma parcela (o caso comum), salva exatamente como hoje, sem fricção nova. — **Reversibility:** reversible — é só uma camada de UI; dá pra remover a confirmação depois sem afetar dado nenhum.

**"Sem data" — o que conta**
- **D-06:** A mudança ("sem data gera só o mês atual") vale **só quando as duas datas estão vazias** (`periodo_inicio` E `periodo_fim` nulos). Contrato com só `periodo_inicio` preenchido (prazo indeterminado) **continua** gerando atual + próximo mês, sem mudança. Se o usuário quis dizer os dois casos, é uma correção rápida no plano.
- **D-07:** A mudança de D-06 vale só para geração **daqui pra frente** — não apaga retroativamente uma parcela de "próximo mês" já gerada para um contrato sem data antes desta fase. Mesmo precedente já registrado em `parcelas.ts:129-132`.

**Limpeza das 27 órfãs já existentes**
- **D-08:** Entra no mesmo plano de execução desta fase, não fica separada. Mesmo padrão do projeto: script SQL revisável pelo usuário no SQL Editor, não uma migração que apaga sem mostrar antes o que vai ser removido — nunca um `DELETE` disparado direto por uma migração sem o usuário ver a lista primeiro.

### Claude's Discretion
Nenhuma das 4 áreas foi selecionada para discussão — o usuário respondeu "sem preferência" no menu de seleção. D-04, D-05, D-06, D-07 e D-08 acima são todas decisões tomadas por Claude, documentadas com o raciocínio para que o usuário possa corrigir facilmente ao revisar o CONTEXT.md antes do planejamento. D-01/D-02/D-03 vieram diretamente da conversa antes da sessão formal de discussão (incluindo a consulta SQL que confirmou as 27 órfãs) e não foram reabertas.

### Deferred Ideas (OUT OF SCOPE)
- **Página dedicada de Relatório Financeiro** (botão "Relatório financeiro" dentro de `/relatorios`, nova rota, filtro dinâmico ao vivo, lista dos contratos filtrados, exportação em PDF) — vira Phase 10, planejada logo depois desta.
- **Ativo/inativo também apagando (não só escondendo)** — não pedido pelo usuário; continua no comportamento "esconder" de D-02/Phase 6.2. Não expandir esta fase para isso sem pedido explícito.
</user_constraints>

## Summary

This phase adds destructive logic (`DELETE`) to a codebase that, until now, has treated "hide, never delete" as an explicit architectural decision (D-03 in `docs/data-model.md`, from Phase 6.2). Every piece needed to implement the phase already exists in the codebase as a reusable primitive: the period-membership test (`competenciaNoPeriodo`), the "has any lançamento" join pattern (`cardTemLancamento`), the single write entry point (`updateCardAction`), the error-sanitization helper (`erroDoBanco`), and — critically — two directly-analogous pre-flight-count-then-confirm UI flows already shipped in this exact file family (`excluir-contrato-dialog.tsx`, `arquivar-contrato-dialog.tsx`). Nothing here requires inventing a new pattern; the work is composition, not design.

The single highest-risk unknown named in the task brief — whether a `DELETE` on `parcelas` needs a new RLS policy — is resolved by directly reading the RLS policy in the migration file: `"team full access parcelas" ... for all to authenticated using (is_team_member()) with check (is_team_member())`. `for all` covers `DELETE` already; **no new RLS policy is needed**. Likewise, no trigger exists on `parcelas` itself (the only relevant trigger, `cards_impede_exclusao_com_lancamento`, fires on `cards`, not `parcelas`) and no `CHECK` constraint restricts `DELETE` — only `INSERT`/`UPDATE` are constrained. The `parcela_lancamentos.parcela_id` foreign key is `on delete cascade`, which is irrelevant in practice here because D-02's own criterion (zero lançamentos) guarantees there is nothing to cascade — but it does mean a bug that deletes a parcela *with* lançamentos would silently destroy that history too, with no trigger to stop it. This is the one place this phase's own logic, not the schema, is the only backstop — see Common Pitfalls.

**Primary recommendation:** Implement pruning as a new pure function in `parcelas.ts` (candidate-orphan detection, reusing `competenciaNoPeriodo` verbatim) called from two places: (1) a new pre-flight Server Action mirroring `contarParcelasEmAbertoAction`'s shape, used by the new confirmation dialog; (2) synchronously inside `updateCardAction`, gated on the server detecting that `periodo_inicio`/`periodo_fim` actually changed (requires reading the pre-update row — `updateCardAction` today does a blind `UPDATE` with no prior `SELECT`). Delete via `.from("parcelas").delete().in("id", candidateIds).select("id")`, following the exact `semLinhas`/`erroDoBanco` pattern every other mutating action in `actions.ts` already uses.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Poda ativa (delete orphaned parcelas on date edit) | API/Backend (Server Action `updateCardAction`) | Database/Storage (RLS `using is_team_member()` as backstop, FK cascade as no-op safety net) | D-04 locks this as synchronous, inside the write action that already owns `periodo_inicio`/`periodo_fim` — never client-triggered, never a background job |
| Pre-flight orphan count (for confirmation dialog) | API/Backend (new Server Action, read-only) | Browser/Client (renders count, drives dialog open/close state) | Same shape as existing `contarParcelasEmAbertoAction`/`cardTemLancamentoAction` — a read query the client calls before committing to a destructive submit |
| Confirmation dialog (D-05) | Browser/Client (`CardDetailDialog` / new nested `AlertDialog`) | — | Pure UI state machine; already fully specified in `09-UI-SPEC.md` |
| "Sem data" generation fallback (current-month-only) | API/Backend (`parcelas.ts` pure functions, called from `garantirParcelas`) | — | Same tier as all existing generation logic (`competenciasAlvo`) — no UI or DB change, a pure-function branch |
| One-time cleanup of 27 existing orphans (D-08) | Database/Storage (SQL Editor script) | — | Explicitly out of the app tier — same pattern as every other one-time production script in `supabase/` (`verificacao_financeiro.sql`, etc.); never a code path a user can trigger |

## Standard Stack

Not applicable — this phase introduces no new library, framework, or external service. It is pure application logic (Server Action + pure functions) plus one UI confirmation step built entirely from shadcn primitives already installed and in active use (`AlertDialog`, `Button` — see `09-UI-SPEC.md` § Registry Safety, which confirms no new component is needed). Existing stack, confirmed current in `web/package.json`:

| Library | Version | Role in this phase |
|---------|---------|---------------------|
| next | ^16.3.0 [VERIFIED: web/package.json:21] | Server Actions (`"use server"`) — unchanged, no new API surface used |
| react | 19.2.4 [VERIFIED: web/package.json:22] | Client dialog state — unchanged |
| @supabase/supabase-js | ^2.111.0 [VERIFIED: web/package.json:17] | `.delete().in(...)` — standard PostgREST client method, already used elsewhere (`deleteCardAction`, `deleteColumnAction`) |
| @supabase/ssr | ^0.12.4 [VERIFIED: web/package.json:16] | Session-scoped server client — unchanged |
| typescript | ^5 [VERIFIED: web/package.json:36] | — |

## Package Legitimacy Audit

Not applicable — no package installation in this phase. Skipping the gate per its own trigger condition ("whenever this phase installs external packages").

## Architecture Patterns

### System Architecture Diagram

```
Browser (CardDetailDialog, card-detail-dialog.tsx)
    │ user edits periodo_inicio/periodo_fim, clicks "Salvar"
    ▼
[NEW] pre-flight Server Action (podaPreVooAction?)   ← read-only
    │ candidatasOrfas(cardId, periodo_inicio novo, periodo_fim novo)
    │ SELECT parcelas WHERE card_id=X AND status='aberta'
    │   embed parcela_lancamentos(id)
    ▼
count > 0? ──no──► form submits normally (updateCardAction, unchanged path)
    │ yes
    ▼
[NEW] AlertDialog (D-05) — "Esta alteração vai apagar N parcelas"
    │ user clicks "Confirmar e salvar"
    ▼
updateCardAction(cardId, input)         ← existing entry point, actions.ts:346
    │ 1. SELECT current periodo_inicio/periodo_fim (NEW — today this is a blind UPDATE)
    │ 2. UPDATE cards SET periodo_inicio=..., periodo_fim=...
    │ 3. if periodo_inicio or periodo_fim actually changed (D-04):
    │      re-run candidatasOrfas() against the NEW period (fresh read, not client-trusted)
    │      DELETE FROM parcelas WHERE id IN (candidateIds)   ← RLS "for all" covers this
    ▼
Card returned to client → dialog closes → board/financeiro reflect fewer parcelas
```

```
[SEPARATE, one-time, D-08] SQL Editor script (supabase/limpeza_parcelas_orfas.sql)
    SELECT candidates (same D-02 criteria, in SQL) → operator reviews → DELETE
    Never touched by app code, never triggered by a user action.
```

### Recommended Project Structure

No new files/folders required beyond what's already implied by the UI-SPEC:

```
web/src/lib/kanban/
├── parcelas.ts          # add: candidatoOrfao()/parcelasOrfas() pure predicate — reuses competenciaNoPeriodo
├── actions.ts            # extend: updateCardAction (poda synchronous branch); add: new pre-flight Server Action
└── queries.ts             # add: thin unwrap() wrapper for the new pre-flight action, mirroring contarParcelasEmAberto

web/src/components/kanban/
└── card-detail-dialog.tsx  # extend: nested AlertDialog per UI-SPEC (or new sibling component, planner's call per UI-SPEC note)

supabase/
└── limpeza_parcelas_orfas.sql   # NEW, one-time D-08 cleanup script — read-verify-delete, same runbook tone as verificacao_financeiro.sql
```

### Pattern 1: Pre-flight-count-then-confirm (already established twice in this codebase)
**What:** A read-only Server Action computes a count before a destructive action is available to submit; the dialog shows a loading state while the count is fetched, then either proceeds with zero friction (count=0) or shows a confirmation with the count (count>0).
**When to use:** Exactly this phase's D-05 requirement.
**Example (existing precedent, not modified by this phase):**
```typescript
// Source: web/src/lib/kanban/actions.ts:617-675 (contarParcelasEmAbertoAction)
export async function contarParcelasEmAbertoAction(
  cardId: string
): Promise<ActionResult<{ quantidade: number; total: number }>> {
  const sessao = await requireUser()
  if (!sessao) return { ok: false, error: NAO_AUTENTICADO }
  const invalido = id(cardId, "Imóvel")
  if (invalido) return { ok: false, error: invalido }
  // ... query + pure-function filter, count accumulated in a loop
  return { ok: true, data: { quantidade, total } }
}
```
The new pre-flight action for this phase should follow this exact shape: `requireUser()` → validate `cardId` (and the two candidate dates) → query → apply the new pure predicate → return `{ quantidade }`.

### Pattern 2: "Has any lançamento" join, reused not reimplemented
**What:** `parcela_lancamentos!inner` embed to test existence without loading rows you don't need.
**Example:**
```typescript
// Source: web/src/lib/kanban/actions.ts:428-443 (cardTemLancamento)
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
D-02's criterion is the mirror image: "parcela_id has NO lançamentos". The natural query shape for the pruning candidate set is a `LEFT` embed (`parcela_lancamentos(id)`) filtered client-side (server-side JS) for `.length === 0`, since Supabase's PostgREST client does not offer a clean "not exists" embed filter — this matches how `contarParcelasEmAbertoAction` already reads `parcela_lancamentos` as a plain (non-`!inner`) embed and filters in JS.

### Pattern 3: Delete with `.select("id")` + `semLinhas` fallback
**What:** Every mutating action in this codebase treats an RLS-filtered zero-rows-affected result as a distinct failure mode from a Postgres error, because RLS silently filters rows rather than raising.
**Example:**
```typescript
// Source: web/src/lib/kanban/actions.ts:270-302 (deleteColumnAction), same shape reused for deleteCardAction
const { data, error } = await sessao.supabase
  .from("columns")
  .delete()
  .eq("id", columnId)
  .select("id")

if (error) { /* erroDoBanco(error.code, ...) */ }
if (!data || data.length === 0) { /* semLinhas(...) — NOT necessarily an error for the pruning case, see Pitfall 1 */ }
```
**Divergence for this phase:** unlike `deleteColumnAction`/`deleteCardAction`, a zero-rows-affected DELETE of orphan parcelas is not automatically a failure — see Pitfall 1 below (race between pre-flight count and confirmed save).

### Anti-Patterns to Avoid
- **Reimplementing the period-membership test.** `competenciaNoPeriodo` (`parcelas.ts:156-164`) already does exactly `"is this competência outside periodo_inicio/periodo_fim"` — D-02 explicitly names this as the function to reuse (negated). Writing a second date-comparison inline in `actions.ts` creates the exact two-implementations-diverge risk that `visibilidade.ts`'s own doc comment calls out as the root cause of the Phase 6.2 bug this whole milestone-adjacent fix chain traces back to.
- **Trusting client-supplied "did the date change" flag.** D-04 requires the server to detect the change itself. `updateCardAction` today does a blind `UPDATE` with no prior `SELECT` — the pruning branch needs to read the row's current `periodo_inicio`/`periodo_fim` (or capture the returned pre-update values) before deciding whether to run at all.
- **Checking only `status = 'aberta'` without also joining `parcela_lancamentos`.** D-02 is explicit: check both, even though they are redundant in practice today. The redundancy is deliberate defense-in-depth (same posture already used in the SQL query that found the 27 orphans, per `09-DISCUSSION-LOG.md:34`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| "Is this competência outside the period?" | A new date-range comparison | `competenciaNoPeriodo` (`parcelas.ts:156`) | Already handles null `periodo_inicio`/`periodo_fim` correctly (D-01 in that function's own precedent); a second implementation is the exact bug class Phase 6.2 was built to eliminate |
| "Does this parcela have any lançamento?" | A new EXISTS-style query | The join shape of `cardTemLancamento` (`actions.ts:428`), adapted to `parcela_id` | Established, tested pattern; only the join key changes |
| Pre-flight count before a destructive confirm | A bespoke loading/error state machine | The `PreVooFase` pattern from `excluir-contrato-dialog.tsx` (verificando / permitido / bloqueado / verificacao-falhou) | UI-SPEC explicitly cites this file as the tone/pattern precedent; D-05's confirm flow is a lighter-weight variant of the same shape |
| Sanitizing a DB error for the deletion path | A new error-mapping function | `erroDoBanco(codigo, acao)` (`actions.ts:179`) | Already handles `23514` (CHECK violation), `23503` (FK violation), `PGRST116`/`semLinhas` (RLS-filtered zero rows) — all directly relevant to a DELETE call |

**Key insight:** every primitive this phase needs already exists in the codebase, verified by name and line number in `09-CONTEXT.md`'s canonical_refs and confirmed by direct reading here. The planning risk in this phase is not "what library/pattern to use" — it's sequencing the synchronous poda correctly inside `updateCardAction` and getting the pre-flight/confirmed-save race handled (see Pitfall 1).

## Runtime State Inventory

This is not a rename/refactor/migration phase in the generic sense, but per the task brief this section is included because the phase performs a real `DELETE` against production data with no staging environment.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 27 orphaned `parcelas` rows already confirmed in production (`09-DISCUSSION-LOG.md:34`) — 2 test contracts ("A", "outro"), all `status='aberta'`, zero lançamentos. This is the D-08 target. | One-time SQL Editor script (read-verify-delete), not a migration — see D-08 and Code Examples below |
| Live service config | None — no external service config references parcela rows | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts / installed packages | None — no schema change, no new dependency | None |

**Nothing else found in any category** — verified by reading `supabase/migrations/20260816000000_financeiro_schema.sql` in full (the only migration that touches `parcelas`/`parcela_lancamentos`) and by grepping the repo for "órfã"/"orphan", which surfaced only the phase's own planning docs and the STATE.md record of the 27-row finding.

## Common Pitfalls

### Pitfall 1: Race between pre-flight count and confirmed save
**What goes wrong:** The pre-flight action computes N orphans; the user sees "N parcelas serão apagadas" and confirms; but between the pre-flight fetch and the confirmed submit, a lançamento could theoretically be added to one of those candidate parcelas by a concurrent session (unlikely at ~48 contracts / low concurrency, but the codebase's own convention — see `exigirParcelaVisivel`, `exigirParcelaNaoConciliada` — is to always re-check server-side at the point of the real write, never trust a pre-flight result as authoritative).
**Why it happens:** Two round-trips (pre-flight, then confirmed save) with a gap the user controls (reading the dialog, clicking).
**How to avoid:** `updateCardAction`'s synchronous poda branch (D-04) must **re-query** the candidate set at save time — never delete the IDs the pre-flight action returned. This is already implied by "poda roda síncrona... dentro da mesma Server Action que grava periodo_inicio/periodo_fim" (D-04) but should be made explicit in the plan: the pre-flight count is advisory-only, the save-time query is the source of truth. This also means a zero-rows-affected DELETE at save time (because the race went the other way — the parcela gained a lançamento between pre-flight and confirm) is a **correct outcome, not a `semLinhas` failure** — that parcela simply no longer matches the criteria and should be silently excluded from the delete, not treated as an error.
**Warning signs:** If the plan has `updateCardAction` accept a list of parcela IDs from the client (from the pre-flight response) and delete exactly those IDs, that is the anti-pattern to catch in review.

### Pitfall 2: Detecting "did periodo_inicio/periodo_fim actually change" requires a pre-update read that doesn't exist today
**What goes wrong:** `updateCardAction` today (`actions.ts:346-380`) does a single blind `UPDATE ... SET ... WHERE id = cardId` with no prior `SELECT`. D-04 requires the poda to fire "só... quando periodo_inicio e/ou periodo_fim realmente mudam de valor" — the server cannot know this without either (a) reading the row before the update, or (b) comparing the `UPDATE`'s returned new row against a value read earlier in the same call.
**Why it happens:** The existing action was written before this requirement existed; adding it is a genuine new read, not a refactor of existing logic.
**How to avoid:** Add a `SELECT periodo_inicio, periodo_fim FROM cards WHERE id = cardId` immediately before the `UPDATE` inside `updateCardAction`, compare to `input.periodo_inicio`/`input.periodo_fim`, and only run the poda branch if either differs. This is one extra round-trip per save — acceptable given the codebase's own precedent of accepting extra reads for correctness at this scale (`docs/data-model.md`'s D-06 tradeoff note for `visibilidade.ts` makes the same call explicitly: "~48 contratos... o custo é irrelevante").
**Warning signs:** A plan that runs poda on every `updateCardAction` call regardless of which fields changed (would re-run the delete-candidate query on every phone-number edit, wasted work but not incorrect — still worth flagging in review as it contradicts D-04's explicit "só dispara quando" language).

### Pitfall 3: Deleting a parcela that DOES have lançamentos would cascade-delete financial history silently
**What goes wrong:** `parcela_lancamentos.parcela_id references public.parcelas(id) on delete cascade` [VERIFIED: supabase/migrations/20260816000000_financeiro_schema.sql:162] `"parcela_id uuid not null references public.parcelas(id) on delete cascade,"`. There is no trigger analogous to `cards_impede_exclusao_com_lancamento` guarding `parcelas` deletes — that trigger only fires on `cards`. If the candidate-selection logic has a bug that includes a parcela with a lançamento (e.g. an off-by-one in the join, or checking `status <> 'aberta'` instead of `status = 'aberta'`), the DELETE would succeed and silently destroy the ledger entry too, with zero backstop at the database level.
**Why it happens:** This phase is the first one to introduce a real `DELETE` on `parcelas`; every prior phase (4-8) only ever `INSERT`/`UPDATE`s this table, so no protective trigger was ever needed until now.
**How to avoid:** The application-level check (D-02: `status='aberta'` AND zero-lançamento join, checked together as defense-in-depth) is the **only** protection — get this exactly right and covered by the plan's verification step. Consider recommending the plan add a `WHERE NOT EXISTS (SELECT 1 FROM parcela_lancamentos WHERE parcela_id = parcelas.id)` guard directly in the DELETE statement itself (not just in the candidate-selection SELECT that runs moments before) as a second, atomic layer against exactly this race — mirroring how `deleteCardAction` relies on the `cards_impede_exclusao_com_lancamento` trigger as a backstop against the same class of race between a pre-check and the actual write. This phase has no equivalent trigger available, so the DELETE statement's own WHERE clause is the only place this protection can live.
**Warning signs:** A plan step that deletes by ID list computed from an earlier, separate query without re-asserting the "no lançamento" condition in the DELETE's own predicate.

### Pitfall 4: The D-08 cleanup script must not run as a migration
**What goes wrong:** Every other schema change in this project ends up in `supabase/migrations/*.sql`. D-08 explicitly does not want that: "nunca um DELETE disparado direto por uma migração sem o usuário ver a lista primeiro." A plan that puts the 27-row cleanup into a numbered migration file breaks this decision and — because migrations in this project are re-runnable/idempotent by convention (`if not exists`/`drop ... if exists`) — a blind `DELETE` migration has no such safety valve; it just runs.
**Why it happens:** Migration files are the path of least resistance for "a SQL change that needs to happen in production."
**How to avoid:** Follow the established pattern: a standalone script in `supabase/` (not `supabase/migrations/`) with a SELECT-first, human-reviewed structure, same tone as `verificacao_financeiro.sql`/`verificacao_cards_numero.sql` — BLOCO-numbered, read-only block first, DELETE block clearly separated and requiring the operator to run it deliberately after reviewing the SELECT's output.
**Warning signs:** A plan task that adds `supabase/migrations/2026082X..._limpeza_parcelas_orfas.sql`.

## Code Examples

### RLS policy — confirmed to already cover DELETE, no new policy needed
```sql
-- Source: supabase/migrations/20260816000000_financeiro_schema.sql:131-136
create policy "team full access parcelas"
  on public.parcelas for all to authenticated
  using (public.is_team_member())
  with check (public.is_team_member());
```
`for all` expands to `SELECT, INSERT, UPDATE, DELETE`. `using` governs `SELECT`/`UPDATE`/`DELETE` row visibility; `with check` governs `INSERT`/`UPDATE` new-row validity. A `DELETE` from an authenticated, allowlisted session is already permitted — [VERIFIED: supabase/migrations/20260816000000_financeiro_schema.sql:131-136].

### Full schema of the two relevant tables, for exact column/constraint names
```sql
-- Source: supabase/migrations/20260816000000_financeiro_schema.sql:45-55, 73-81, 160-170, 184-196
create table if not exists public.parcelas (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  competencia date not null,
  vencimento date not null,
  valor_original numeric(12,2) not null,
  status text not null default 'aberta',
  conciliada_em timestamptz,
  conciliada_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
-- status in ('aberta', 'parcial', 'paga', 'conciliada')  (parcelas_status_valido)

create table if not exists public.parcela_lancamentos (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references public.parcelas(id) on delete cascade,
  tipo text not null,
  valor numeric(12,2) not null default 0,
  data date not null default current_date,
  observacao text,
  motivo text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);
```
[VERIFIED: supabase/migrations/20260816000000_financeiro_schema.sql:45-55,73-81,160-170,184-196]

### `competenciaNoPeriodo` — the function D-02 mandates reusing
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
[VERIFIED: web/src/lib/kanban/parcelas.ts:156-164] — the "orphan" test is the negation of this: `!competenciaNoPeriodo(parcela.competencia, novoInicio, novoFim)`.

### `competenciasAlvo` — the fallback D-06 restricts to current-month-only
```typescript
// Source: web/src/lib/kanban/parcelas.ts:93-105
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
```
[VERIFIED: web/src/lib/kanban/parcelas.ts:93-105] — currently returns `[atual, proximo]` unconditionally. D-06 requires this to return only `[atual]` when the caller determines both `periodo_inicio` AND `periodo_fim` are null (a change made at the call site, `competenciasAlvoParaCard` at `parcelas.ts:230-239`, or by adding a parameter to `competenciasAlvo` itself — planner's call, but the discriminator condition itself — "only when BOTH dates are null, not when only `periodo_inicio` is set" — must reuse `temPeriodoCompleto`'s sibling logic, not reinvent it).

### `deleteColumnAction` — the exact DELETE + error-handling shape to mirror
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
[VERIFIED: web/src/lib/kanban/actions.ts:270-302] — note the `P0001` trigger-error branch does not apply to `parcelas` (no trigger exists there); the pruning delete should NOT check for `P0001`.

## State of the Art

Not meaningfully applicable — this is an internal architectural reversal (D-01 reverting D-03), not an adoption of a new external technology. The one relevant "before/after" is internal:

| Old Approach (D-03, Phase 6.2) | New Approach (D-01, Phase 9) | When Changed | Impact |
|--------------------------------|-------------------------------|---------------|--------|
| Orphaned parcelas are hidden via `avaliarVisibilidadeParcela`, never deleted — reversible by design | Orphaned parcelas with zero lançamentos are deleted for real, synchronously, when the triggering date edit is saved | This phase (Phase 9), user decision after seeing 27 orphans leak into Phase 8's reports | One-way: a later date-range widening regenerates a fresh parcela via `garantirParcelas`, with `valor_original` snapshotting the card's *current* value, which may differ from the original — same consequence D-03's own doc comment already anticipated as the cost of ever regenerating |

**Not deprecated:** `avaliarVisibilidadeParcela`/`filtrarParcelasVisiveis` (`visibilidade.ts`) remain fully valid and unchanged — they still govern the "hide" path for `arquivado`/`inativo-mes-futuro` cases (D-01/D-02 of Phase 6.2, untouched by this phase per the CONTEXT.md deferred-scope note). This phase only changes what happens to a narrower subset: parcelas that are *both* out-of-period *and* have zero lançamentos, which today fall under `visibilidade.ts`'s `fora-do-periodo` hide reason and will now be deleted instead of hidden.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The best implementation shape for "does periodo_inicio/periodo_fim actually change" detection is a `SELECT` immediately before the `UPDATE` inside `updateCardAction`, rather than comparing against a value passed by the client | Common Pitfalls #2, Architecture diagram | Low — this is a design recommendation, not a verified fact; the planner may choose a different mechanism (e.g. an `UPDATE ... RETURNING` compared against a value read in a prior request) as long as it stays server-side per D-04 |
| A2 | A `WHERE NOT EXISTS (...)` guard directly in the pruning `DELETE`'s predicate (not just in the prior candidate-selection SELECT) is the right second layer of defense against Pitfall 3's race | Common Pitfalls #3 | Low-medium — this is a recommended hardening, not something the codebase already does elsewhere for `parcelas`; the planner could instead accept the single-query risk as acceptable at this scale (~48 contracts, low write concurrency), but should make that a conscious choice, not an oversight |
| A3 | The pre-flight Server Action for D-05's confirmation dialog should be a brand-new action (not a parameter added to `updateCardAction` itself, since it must run before the user commits to saving) | Architecture Patterns, Recommended Project Structure | Low — this follows the existing `cardTemLancamentoAction`/`contarParcelasEmAbertoAction` precedent directly; an alternative shape is unlikely but not verified against the UI-SPEC's literal wording |

**All schema, RLS, trigger, and function-signature claims above (the load-bearing ones) are `[VERIFIED]` against files read this session — this log covers only implementation-shape recommendations, not the risk assessment itself.**

## Open Questions

1. **Does `competenciasAlvo`'s signature change, or does the "both dates null" branch live entirely in `competenciasAlvoParaCard`?**
   - What we know: `competenciasAlvoParaCard` (`parcelas.ts:230-239`) already discriminates on `temPeriodoCompleto` (both dates present) vs. the `competenciasAlvo` fallback. D-06 adds a third discriminator: fallback-with-both-null vs. fallback-with-only-`periodo_inicio`.
   - What's unclear: whether the cleanest implementation adds a parameter to `competenciasAlvo(hojeISO, ambosNulos)` or instead branches at the call site in `competenciasAlvoParaCard` before calling the unmodified `competenciasAlvo`.
   - Recommendation: leave this to planner/executor discretion — both are correct and equally testable; note that `competenciasAlvo`'s current unconditional-two-months return is consumed only by this one call site today (confirmed no other caller in the codebase via the function inventory above), so either shape is low-risk.

2. **Exact wording/placement of the extra `SELECT` inside `updateCardAction` for change-detection (Pitfall 2) — combine with the existing single query, or a separate round-trip?**
   - What we know: `updateCardAction` today issues exactly one query (`UPDATE ... RETURNING *`). Adding a `SELECT` before it is a second round-trip.
   - What's unclear: whether it's preferable to instead always run the pruning candidate-query (which is itself needed regardless) and treat "count is 0" as functionally equivalent to "dates didn't change" — collapsing the two checks into one query, at the cost of running the candidate query on every save (not just date-changing saves).
   - Recommendation: the planner should weigh this against D-04's explicit language ("só dispara quando... realmente mudam de valor") — a literal reading suggests the change-check must gate whether the candidate query runs at all, not be inferred from its result being empty. Flag for the plan.

## Environment Availability

Skipped — this phase has no external dependency beyond the already-running Supabase project (Postgres + RLS), which every phase since Phase 4 has depended on identically. No new tool, service, or runtime is introduced.

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` [VERIFIED: .planning/config.json]. Confirmed also by direct inspection: no test framework, no `test` script, no `*.test.*`/`*.spec.*` files exist anywhere in `web/` [VERIFIED: `grep -n "\"test\"" web/package.json` returned no match; `ls web/src/lib/kanban/*.test.*` returned no files]. This matches the project-wide pattern (REQUIREMENTS.md `## Future Requirements § TEST` — automated testing is explicitly deferred project-wide, not specific to this phase). Verification for this phase will be lint + build + manual SQL Editor / browser confirmation, same as every prior phase in this milestone.

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1` [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Unchanged — `requireUser()` gate already covers this action, not touched by this phase |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | RLS policy `"team full access parcelas"` (`for all ... using is_team_member() with check is_team_member()`) already covers `DELETE` — confirmed above, no new policy needed. This is the phase's single most safety-critical access-control fact and it is already correct. |
| V5 Input Validation | Yes | `validarPeriodo` (`actions.ts:158-162`, existing) already rejects `fim < inicio`; the new pruning logic must validate `cardId` via the existing `id()` helper (`actions.ts:82-86`) exactly like every other action |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Over-broad DELETE (wrong WHERE clause deletes more than intended) | Tampering / Elevation of Privilege (data destruction beyond the acting user's intent) | Server-side re-computation of the candidate set at delete time (never trust a client-supplied ID list), plus the `WHERE NOT EXISTS (parcela_lancamentos)` guard recommended in Pitfall 3, plus RLS as the outer perimeter (already in place, `is_team_member()`) |
| Stale-read race between pre-flight count and confirmed destructive action | Tampering (client acting on data that changed between read and write) | Re-query at write time inside the same Server Action call that performs the delete — see Pitfall 1; this is the same pattern the codebase already uses for `exigirParcelaVisivel`/`exigirParcelaNaoConciliada`'s "recheck on every write, never trust the client's belief about current state" |
| Silent data loss with no audit trail (a deleted `parcelas` row leaves no ledger entry, unlike every other financial mutation in this app which is append-only) | Repudiation | This is a **deliberate, user-approved deviation** (D-01) from the append-only philosophy `docs/data-model.md` documents for `parcela_lancamentos` — not a gap to close in this phase, but the plan should have `updateCardAction` at minimum `console.error`/log which parcela IDs were pruned (mirroring the existing `console.error("updateCard", error)` convention used for every other action) so a production incident investigation has *some* trace, even without a formal audit table |

## Sources

### Primary (HIGH confidence — direct file reads this session)
- `supabase/migrations/20260816000000_financeiro_schema.sql` — full schema, constraints, RLS policy for `parcelas`/`parcela_lancamentos`
- `supabase/migrations/20260819000000_cards_arquivado_em.sql` — confirms the only relevant trigger fires on `cards`, not `parcelas`
- `web/src/lib/kanban/parcelas.ts` — `competenciaNoPeriodo`, `competenciasAlvo`, `competenciasAlvoParaCard`, `garantirParcelas`
- `web/src/lib/kanban/actions.ts` — `updateCardAction`, `cardTemLancamento`, `cardTemLancamentoAction`, `contarParcelasEmAbertoAction`, `deleteCardAction`, `deleteColumnAction`, `erroDoBanco`, `semLinhas`
- `web/src/lib/kanban/visibilidade.ts` — `avaliarVisibilidadeParcela`, confirms the "hide" path this phase narrows but does not remove
- `web/src/lib/kanban/queries.ts`, `web/src/lib/kanban/types.ts` — client-server bridge shapes, `Card`/`CardDetailsInput`/`ActionResult` types
- `web/src/components/kanban/card-detail-dialog.tsx`, `excluir-contrato-dialog.tsx` — existing form/dialog patterns to extend/mirror
- `docs/data-model.md` — the D-03 decision this phase reverts, and the D-01/D-06 visibility-rule documentation this phase's scope note excludes from change
- `.planning/phases/06.2-ciclo-de-vida-do-contrato/06.2-CONTEXT.md` — original D-03 rationale from the user
- `.planning/phases/09-integridade-de-datas-do-contrato-nas-parcelas/09-DISCUSSION-LOG.md` — confirms the 27-orphan count and the criteria used to find them
- `web/package.json` — confirmed current dependency versions
- `.planning/config.json` — confirmed `nyquist_validation: false`, `security_enforcement: true`

### Secondary (MEDIUM confidence)
- None used — no web search was needed; every fact in this document was verifiable directly from the repository.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new stack introduced
- RLS/schema/trigger findings: HIGH — all read directly from migration files this session, quoted verbatim, no training-data inference used
- Architecture/implementation-shape recommendations: HIGH for "what existing pattern to reuse" (verified by file+line), MEDIUM for the specific new-code shape recommendations (Assumptions Log A1-A3) — these are design suggestions for the planner, not verified facts
- Pitfalls: HIGH — each is derived directly from reading the actual schema/trigger/RLS state, not assumed from a similar project

**Research date:** 2026-08-20
**Valid until:** No expiry driver — this is an internal-codebase research document tied to the current commit, not a fast-moving external dependency. Re-verify only if the schema changes again before this phase is planned/executed.

<phase_requirements>
## Phase Requirements

ROADMAP.md lists this phase's `Requirements` field as `TBD` — no requirement IDs have been assigned yet in `REQUIREMENTS.md` (this phase's traceability entries do not exist there either). This is expected: Phase 9 was inserted after v2.0's requirement set (`CONTRATO`/`PARCELA`/.../`FINDOC`, 39 total, all mapped) closed. The planner should propose new requirement IDs (a plausible new category, e.g. `INTEG-01..0N`, following the project's existing per-domain-prefix convention) as part of planning, covering at minimum: active pruning of orphaned parcelas on date edit (D-01/D-02/D-03), the pre-save confirmation step (D-05), the no-date generation fallback (D-06/D-07), and the one-time cleanup (D-08). Not addable here — RESEARCH.md is not the place to assign requirement IDs against REQUIREMENTS.md.
</phase_requirements>
