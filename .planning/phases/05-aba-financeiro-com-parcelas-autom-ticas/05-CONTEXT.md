# Phase 5: Aba Financeiro com parcelas automáticas - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning
**Source:** Derived from `.planning/financeiro-modulo-prompt.md` — the approved product spec (2026-08-16 ideation session) plus the toggle-placement decision confirmed in the same session. This replaces a `/gsd-discuss-phase` run; the decisions below are already settled, not open questions.

<domain>
## Phase Boundary

This phase delivers the **first user-facing slice** of the financial module: a new "Financeiro" tab, the lazy parcela-generation trigger, and the ativo/inativo toggle on the card. It does NOT deliver any financial action (dar baixa, ajustar, conciliar, destravar) — those are Phases 6-7. It does NOT deliver reports — that is Phase 8.

In scope:
- New top-level navigation tab "Financeiro", separate from Board and Relatórios
- Two sub-views inside it: "Mês atual" and "Próximo mês" — same underlying data, filtered by `competencia`
- A Server Action / data-loading path that, when the Financeiro route is visited, ensures the current-month and next-month `parcelas` exist for every `ativo = true` contract whose `competencia` falls within `[periodo_inicio, periodo_fim]` (or `periodo_fim` is null) — creating missing rows, never duplicating (enforced by the DB unique index from Phase 4, but the app-level logic must not rely on catching a constraint violation as its normal path)
- A toggle (switch/badge) on the card in the Board, to mark a contract `ativo`/`inativo` — reversible, no confirmation dialog needed (matches "sem burocracia")
- The parcela list itself showing, per row: situação (a vencer / vencida / paga / parcial / conciliada — computed at read time from `vencimento` vs today for a vencer/vencida, taken directly from `status` for the rest), valor devido, valor pago

Explicitly NOT in scope (later phases):
- Dar baixa, ajustar (acréscimo/desconto), conciliar, destravar — Phase 6/7
- Relatórios financeiros — Phase 8
- Payment method field, historical backfill, export — out of scope for the whole v2.0 milestone (see REQUIREMENTS.md Future Requirements)

Requirements: **CONTRATO-01, CONTRATO-02, PARCELA-01, PARCELA-02, PARCELA-03, PARCELA-04, FINUI-01, FINUI-02, FINUI-03**
</domain>

<decisions>
## Implementation Decisions

### Geração automática — settled, do not redesign

- **D-01:** Generation is **lazy, read-triggered, no cron** — same philosophy as `web/src/lib/kanban/alerts.ts`. It runs when the Financeiro route/page is loaded (server-side, in the page's data-loading path — a Server Component fetch or a Server Action called on mount, following whatever pattern `web/src/app` already uses for the Board and Relatórios pages).
- **D-02:** Ensures **two competências**: the current month and the next month. Both, every time the page loads — not just current month.
- **D-03:** Only contracts with `cards.ativo = true` participate. An inactive contract's *existing* parcelas remain listed and manageable; inactive just stops new rows from being created for it.
- **D-04:** A competência is only generated if it falls inside `[periodo_inicio, periodo_fim]` of the contract, where a null `periodo_fim` means open-ended (always in range going forward). Do not generate a parcela for a competência before `periodo_inicio` or after `periodo_fim`.
- **D-05:** `valor_original` on a newly generated parcela is a snapshot of the card's current `valor` at generation time — do not read this from `cards.valor` again later; once written, a parcela's `valor_original` is fixed (Phase 4 already enforces this is just a plain column, no trigger re-syncing it).
- **D-06:** Idempotency is a database guarantee (`parcelas_unica_por_competencia` unique index from Phase 4), but the application logic should check-then-insert (or upsert-on-conflict-do-nothing) rather than treating a unique-violation as the expected steady-state path — cleaner control flow, and avoids depending on Postgres error codes for normal operation.
- **D-07:** "A vencer" / "vencida" are never stored — compute at read time: `status IN ('aberta','parcial') AND vencimento < today` → vencida; `status IN ('aberta','parcial') AND vencimento >= today` → a vencer. `paga` and `conciliada` are their own displayed situação, taken directly from the stored `status`.

### Toggle ativo/inativo — settled

- **D-08:** Lives **directly on the card in the Board view** — a small badge/switch, not hidden inside the edit modal. User's explicit choice: prioritizes day-to-day speed over a cleaner-looking board.
- **D-09:** Reversible with a single interaction (toggle back), no confirmation dialog — matches the "sem burocracia" pillar. This is a low-stakes, easily-undone action (unlike the Phase 4 production migration), so no `checkpoint:decision` framing applies to its *runtime* UX — normal optimistic-update patterns already used elsewhere on the Board (drag-and-drop) are the right model to follow.
- **D-10:** Toggling to inativo must NOT retroactively touch existing parcelas of that contract — no cascade delete, no status change on them. It only affects future generation (D-03).

### Financeiro tab structure — settled

- **D-11:** Top-level nav tab, sibling to Board and Relatórios (see existing nav in `web/src/app` — follow that pattern, do not nest Financeiro under Relatórios).
- **D-12:** Two sub-views ("Mês atual" / "Próximo mês") inside the tab — same list component, different `competencia` filter. Not two separate pages/routes necessarily; Claude's discretion on tabs-within-tab vs segmented control vs two route segments, as long as it reads as clearly separated views per the spec's intent ("uma visão do próximo mês ajuda a gestão ter uma visão mais analítica").
- **D-13:** Each parcela row must show: imóvel/contrato it belongs to, situação, valor devido, valor pago. No action buttons yet in this phase (dar baixa etc. is Phase 6) — but leave room in the layout; Phase 6 will add inline actions to this same list.

### Claude's Discretion

- Exact visual treatment of the ativo/inativo toggle on the card (icon-only badge vs labeled switch) — UI-SPEC phase should settle this against the existing card visual design.
- Whether "Mês atual"/"Próximo mês" are tabs, a segmented control, or two stacked sections — as long as they read as clearly separate (D-12).
- Whether parcela generation runs as a Server Component data fetch or an explicit Server Action triggered on page load — follow whatever the existing Board/Relatórios pages already do for their initial data load.
</decisions>

<specifics>
## Specific Ideas

- User's framing: dar visibilidade sem burocracia — the Financeiro tab should feel like a natural extension of the Board/Relatórios pair already in the nav, not a bolted-on separate app.
- The "duas visões" (mês atual/próximo mês) request was explicit and specific: *"quero conseguir controlar as parcelas do mês atual e do próximo mês, separadamente é claro, mas uma visão do próximo mês ajuda a gestão ter uma visão mais analítica e controlada dos contratos."* — the separation matters to the user, not just the presence of both months in one list.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/financeiro-modulo-prompt.md` — the approved spec (ⓘ note: its own internal phase breakdown into 6 phases was superseded by the roadmapper's 5-phase split; trust ROADMAP.md's Phase 5 boundary, not the spec's "Fase 2"/"Fase 4" labels).
- `.planning/phases/04-funda-o-financeira/04-01-PLAN.md` and `04-01-SUMMARY.md` — the exact schema this phase reads/writes: `cards.ativo`, `public.parcelas` (columns, constraints, unique index), RLS via `is_team_member()`.
- `docs/data-model.md` — current entity documentation, updated in Phase 4 with the financial entities and the "geração preguiçosa" / "ativo manual" design rationale — read this for the *why*, not just the schema.
- `web/src/lib/kanban/alerts.ts` — the read-time-derivation pattern D-01/D-07 extend to parcelas.
- `web/src/app/` — existing Board and Relatórios pages/routes, for navigation structure, data-loading pattern (Server Components vs Server Actions), and card component structure (for the toggle placement).
- `.planning/codebase/CONVENTIONS.md` and `.planning/codebase/ARCHITECTURE.md` — project code conventions and structure.
</canonical_refs>

<open_questions>
## Open Questions

None blocking on product decisions — all settled in the approved spec. Visual/interaction specifics are deferred to the UI-SPEC (gsd-ui-phase), per Claude's Discretion above.
</open_questions>
