# Phase 6: Baixa e ajustes de parcela - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning
**Source:** Derived from `.planning/financeiro-modulo-prompt.md` (approved spec, 2026-08-16 ideation session) and `.planning/ROADMAP.md`'s Phase 6 section (goal, success criteria, "Pilares cruzados"). This replaces a `/gsd-discuss-phase` run; the decisions below are already settled, not open questions.

<domain>
## Phase Boundary

This phase adds the first **money-moving actions** to the Financeiro list built in Phase 5: registering a payment (full or partial) and adjusting a parcela's amount due (surcharge or discount). It is the first phase where the app writes to `parcela_lancamentos`.

In scope:
- A payment action reachable from each parcela row in `ParcelasTable` (built in Phase 5) — covers both full and partial payment (BAIXA-01, BAIXA-02)
- An adjustment action (surcharge / discount) reachable from the same row (BAIXA-03, BAIXA-04)
- Every action inserts a new row into `parcela_lancamentos` — never updates or deletes an existing one (BAIXA-05, already enforced structurally by the append-only ledger design from Phase 4)
- Status recomputation after any lançamento: a parcela's `status` (`aberta`/`parcial`/`paga`) must reflect the current sum of the ledger, not just the action just taken — e.g. an acréscimo can push a `paga` parcela back to `parcial` if it uncovers the new total due
- Sanitized error handling on these writes via the project's existing `erroDoBanco()` pattern (FINSEG-03)

Explicitly NOT in scope (later phases):
- Conciliar / destravar (`status = 'conciliada'`) — Phase 7. **No parcela can reach `conciliada` before Phase 7 ships**, so Phase 6 does not need to build or test a guard against writing to a conciliada parcela; that guard, and its user-facing "destrave primeiro" message, is explicitly Phase 7's job (CONCIL-02), not this phase's.
- Relatórios financeiros — Phase 8
- Payment method field, historical backfill, export, automatic interest calculation — out of scope for the whole v2.0 milestone (see REQUIREMENTS.md Future/Out of Scope)

Requirements: **BAIXA-01, BAIXA-02, BAIXA-03, BAIXA-04, BAIXA-05, FINUI-04, FINSEG-03**
</domain>

<decisions>
## Implementation Decisions

### Ledger writes — settled, do not redesign

- **D-01:** Every action in this phase is an INSERT into `parcela_lancamentos`, never an UPDATE/DELETE of an existing row. This is already a DB-level guarantee from Phase 4 (no UPDATE/DELETE policy path is even needed for the happy path) — the application layer must match that shape, not fight it.
- **D-02:** `criado_por` is the authenticated user's id, `criado_em` defaults to `now()` at the DB level — the Server Action does not need to set it explicitly unless the existing write-action pattern in this codebase already does so for consistency (check `web/src/lib/kanban/actions.ts` for the established convention, e.g. how `setCardAtivoAction` from Phase 5 identifies the acting user).
- **D-03:** A parcela's derived state is always a sum over its lançamentos — `valorDevido = valor_original + Σacrescimo − Σdesconto`, `valorPago = Σpagamento`. This logic already exists in `web/src/lib/kanban/parcelas.ts` (`somarLancamentos`, built in Phase 5) — reuse it, do not reimplement.
- **D-04:** After any lançamento, `parcelas.status` must be recomputed and persisted: `paga` when `valorPago >= valorDevido` (and `valorDevido > 0`), `parcial` when `0 < valorPago < valorDevido`, `aberta` when `valorPago = 0`. This means an acréscimo on an already-`paga` parcela can legitimately flip it back to `parcial` — success criterion 3 in ROADMAP calls this out explicitly, it is intended, not an edge case to special-case away.

### Baixa total vs. parcial — likely the same action

- **D-05:** BAIXA-01 (baixa total) and BAIXA-02 (baixa parcial) are, from the ledger's point of view, the exact same operation — insert a `pagamento` lançamento — differing only in whether the amount entered equals or is less than the remaining amount due. **Claude's discretion, strongly recommended:** build ONE "registrar pagamento" action/dialog, pre-filled with the remaining valor devido, editable by the user. This avoids two separate flows for what is structurally one insert, and keeps the interaction within FINUI-04's ≤2-click budget. Do not build two separate UI entry points for "baixa total" and "baixa parcial" unless a concrete reason surfaces during planning.
- **D-06:** Similarly, acréscimo and desconto (BAIXA-03/04) are the same lançamento shape with a different `tipo` and sign effect on `valorDevido` — whether they share one dialog with a type toggle or are two separate actions is Claude's discretion at the UI-SPEC stage; no requirement forces either shape.

### Scope carried from Phase 5 / cross-cutting

- **D-07 (ROADMAP "Pilares cruzados"):** Parcelas belonging to an already-**inactive** contract (`cards.ativo = false`, from Phase 5's CONTRATO-02) continue to accept baixa and ajuste normally — inactive only stops *new parcela generation* (Phase 5's concern), it never restricts *actions on parcelas that already exist* (this phase's concern). Do not filter or disable the payment/adjustment actions based on `cards.ativo`.
- **D-08:** FINSEG-03 becomes verifiable for the first time in this phase — this is the first user-triggered write that can be rejected by a database constraint (e.g. a negative value slipping past client validation, hitting `parcela_lancamentos_valor_nao_negativo`). The rejection must reach the user as a plain-language message, never a raw Postgres error — same `erroDoBanco()` pattern already used everywhere else in the app.
- **D-09:** Both "Mês atual" and "Próximo mês" views (built in Phase 5, same `ParcelasTable`/`FinanceiroView` components) get the same actions — there is no requirement restricting payment/adjustment to only the current month's parcelas, and adding the actions to the shared table component naturally makes them available in both views without extra wiring. Advance/early payment on a next-month parcela is a legitimate real-world case (the spec's original design note: "aluguel pago adiantado é um arranjo real").

### Claude's Discretion

- Exact dialog/popover shape for the payment and adjustment actions, as long as the payment path is reachable in ≤2 clicks from the row (FINUI-04) and defaults are sensible (date defaults to today, amount defaults to the remaining valor devido).
- Whether acréscimo/desconto share one action or are two, and their click budget (not constrained by FINUI-04, which only names baixa).
- Exact `observacao` field UX (BAIXA-05 requires the ledger to support an optional observação — already a nullable column in `parcela_lancamentos`; whether every action's dialog exposes it or only some is a UI-SPEC call).
</decisions>

<specifics>
## Specific Ideas

- User's framing throughout the whole module: praticidade, confiança, sem burocracia, and correção fácil ("afinal, todos erram em algum momento"). This phase is where that last point first becomes concrete: a wrong acréscimo or a mistyped payment is corrected by lançando algo novo por cima, never by editing or deleting — the fix is a new ledger entry, and the UI should make that feel like a normal correction, not a workaround.
- ROADMAP success criterion 4 is explicit that the parcela's own history view must show all lançamentos, not just the latest state — this phase should surface that history somewhere reachable from the row, not just accumulate it invisibly in the database.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/financeiro-modulo-prompt.md` — the approved spec.
- `.planning/ROADMAP.md` § Phase 6 — goal, 5 success criteria, "Pilares cruzados" (quoted above in full).
- `.planning/phases/05-aba-financeiro-com-parcelas-autom-ticas/05-01-SUMMARY.md` and `05-02-SUMMARY.md` — what already exists: `ParcelasTable`, `ParcelaSituacaoBadge` (already supports `parcial` visually, unreached until now), `FinanceiroView`, `lib/kanban/parcelas.ts` (`somarLancamentos`, `situacaoDaParcela`, `montarLinhas` — the exact functions this phase's writes must stay consistent with).
- `.planning/phases/05-aba-financeiro-com-parcelas-autom-ticas/05-03-SUMMARY.md` — the most recent precedent for a Server Action that writes financial-adjacent state (`setCardAtivoAction`): mirrors `moveCardAction`, optimistic-update-then-revert via `persistOrRevert()`, single-column-literal update, `WriteErrorToast`. The payment/adjustment actions in this phase are the next step up in complexity (ledger insert + derived status recompute) but should follow the same authentication/validation/error-handling shape.
- `supabase/migrations/20260816000000_financeiro_schema.sql` — live schema: `parcela_lancamentos` columns, the 6 CHECK constraints (`tipo` enum, non-negative valor, `destrava` motivo requirement — not relevant yet since `destrava` isn't used until Phase 7, but the constraint exists now and a `pagamento`/`acrescimo`/`desconto` insert must satisfy the others), RLS via `is_team_member()`.
- `docs/data-model.md` — entity documentation and the append-only ledger rationale.
- `web/src/lib/kanban/actions.ts` and `queries.ts` — established Server Action conventions (`requireUser()`, validation helpers, `erroDoBanco()`) to mirror.
</canonical_refs>

<open_questions>
## Open Questions

None blocking. The main structural choice left open (one payment dialog vs. two, one adjustment action vs. two) is deliberately deferred to Claude's Discretion / the UI-SPEC stage — see D-05/D-06 above.
</open_questions>
