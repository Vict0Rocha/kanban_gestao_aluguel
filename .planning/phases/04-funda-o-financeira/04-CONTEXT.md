# Phase 4: Fundação financeira - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Source:** Derived from `.planning/financeiro-modulo-prompt.md` — an approved product spec produced in a full ideation session with the user (2026-08-16). This replaces a `/gsd-discuss-phase` run; the decisions below are already settled, not open questions.

<domain>
## Phase Boundary

This phase delivers the **database foundation** for the financial module — nothing user-facing.

In scope:
- Migration adding `cards.ativo`, table `parcelas`, table `parcela_lancamentos`
- RLS policies on both new tables, via the existing `is_team_member()` function
- CHECK constraints enforcing financial rules at the database level
- Updating `docs/data-model.md` with the new entities and the reasoning behind them

Explicitly NOT in this phase (they belong to Phases 5-8):
- Any React component, route, or navigation change
- Any Server Action
- The lazy parcela-generation logic itself
- Any report

Requirements: **FINSEG-01, FINSEG-02, FINDOC-01**
</domain>

<decisions>
## Implementation Decisions

### Schema shape — settled, do not redesign

- **D-01:** `cards.ativo boolean not null default true` — manual flag controlling whether a contract participates in parcela generation. Default `true` so the ~46 existing production rows keep working untouched.
- **D-02:** `parcelas` columns: `id uuid pk`, `card_id uuid fk → cards on delete cascade`, `competencia date` (day 1 of the reference month, e.g. `2026-08-01` — a date, never a `"MM/YYYY"` string), `vencimento date`, `valor_original numeric(12,2)`, `status text`, `conciliada_em timestamptz`, `conciliada_by uuid fk → profiles`.
- **D-03:** `parcela_lancamentos` columns: `id uuid pk`, `parcela_id uuid fk → parcelas on delete cascade`, `tipo text`, `valor numeric(12,2)`, `data date`, `observacao text`, `motivo text`, `criado_por uuid fk → profiles`, `criado_em timestamptz default now()`.
- **D-04:** Allowed `parcelas.status` values: `aberta`, `parcial`, `paga`, `conciliada`. Allowed `parcela_lancamentos.tipo` values: `pagamento`, `acrescimo`, `desconto`, `destrava`.
- **D-05:** Unique index on `parcelas (card_id, competencia)` — one parcela per contract per month. Mirrors the existing unique index on `alerts (card_id, type, trigger_date)`.
- **D-06:** "A vencer" and "vencida" are **NOT stored**. They are derived at read time from `vencimento` vs today, the same way contract alerts already work in `web/src/lib/kanban/alerts.ts`. Do not add a status value for them.
- **D-07:** `valor_original` is a snapshot taken when the parcela is generated, so a later rent adjustment on the card never rewrites parcelas that already exist.

### Why a ledger instead of editable fields — the load-bearing decision

- **D-08:** Financial history is append-only. Partial payment, surcharge, discount, and post-conciliation correction are all **the same operation**: insert a row into `parcela_lancamentos`. Nothing is ever overwritten or deleted.
- **D-09:** A parcela's amount due (`valor_original + acréscimos - descontos`) and amount paid (sum of `pagamento` rows) are **derived by summing lançamentos**, never stored as mutable columns that could drift from the ledger.
- **D-10:** This is what makes "correção com histórico" work without a separate audit table. Do not introduce a parallel audit/history table.

### Security — this is the phase where the pillars become real

- **D-11:** RLS on both new tables uses `public.is_team_member()`, the same `security definer` function already protecting `cards` and `alerts`. Do NOT invent a new permission scheme, role table, or `auth.role() = 'authenticated'` check — the latter was the exact hole fixed in migration `20260811000000_security_hardening.sql`.
- **D-12:** CHECK constraints must reject, at the database level and independently of any form: negative values, `status` outside the allowed set, `tipo` outside the allowed set, a `destrava` lançamento with null/empty `motivo`, and (via the unique index) a duplicate `(card_id, competencia)`.
- **D-13:** Constraints exist because writing directly through PostgREST bypasses any rule that lives only in React. This mirrors the reasoning already recorded in `docs/data-model.md` for the `cards`/`columns` constraints.

### Migration safety — production has real data

- **D-14:** The app is live on Vercel + Supabase with ~46 real properties. The migration must be **additive and backward compatible**: no dropped columns, no renamed columns, no nullable-without-default additions to `cards`, nothing that makes the running app's existing queries fail.
- **D-15:** New migration file follows the existing naming convention in `supabase/migrations/` (timestamp prefix, e.g. `20260816000000_financeiro_schema.sql`).

### Claude's Discretion

- Exact constraint names and whether to use `CHECK (...)` inline vs named table constraints — follow whatever the existing migrations already do.
- Whether `status` is a text column with a CHECK or a Postgres enum — the spec says either is fine; pick what matches the existing schema style and note the choice.
- Whether to add supporting indexes beyond the required unique one (e.g. on `parcelas.vencimento` for the future reports), as long as they are justified.
</decisions>

<specifics>
## Specific Ideas

- The user's framing throughout: *"praticidade e confiança"* — the database layer contributes "confiança" by making bad financial data impossible to write, even by accident or by a future bug in a Server Action.
- The user explicitly said *"afinal, todos erram em algum momento"* — the ledger design exists to make errors correctable rather than preventable-by-bureaucracy.
- Documentation is not a trailing chore: the spec's pillar 4 states documentation happens **in the phase that introduced the decision**, which is why FINDOC-01 lives here and not in a final phase.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/financeiro-modulo-prompt.md` — the approved spec. Its "⚠ LEIA PRIMEIRO" table lists decisions that are closed; do not reopen them.
- `docs/data-model.md` — current schema, entity diagram, and the established "decisão + porquê" documentation style that FINDOC-01 must match.
- `supabase/migrations/20260811000000_security_hardening.sql` — where `is_team_member()` is defined and where the existing RLS + CHECK constraint patterns live. Copy these patterns.
- `supabase/migrations/20260728000000_init_schema.sql` — original schema, including the `alerts` unique-index pattern that D-05 mirrors.
- `web/src/lib/kanban/alerts.ts` — the read-time-derivation pattern referenced by D-06.
- `.planning/codebase/CONVENTIONS.md` — project code conventions.
</canonical_refs>

<open_questions>
## Open Questions

None blocking. Three product assumptions were explicitly confirmed by the user and are **out of scope for v2.0**: no historical backfill of past months, no payment-method field, no PDF/Excel export.
</open_questions>
