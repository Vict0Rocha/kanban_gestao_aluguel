# Phase 20: Filtro por tipo de movimento no relatório da imobiliária — API Coverage

No external API integration: this phase adds a client-side multi-select chip filter (Set-based, reusing
`FilterChip`/`toggle` from `reports-view.tsx`) over data the client component already holds in memory —
`taxas`/`caucaoEventos`, fetched by `buscarReconciliacaoAction` since Phase 13/19 — plus a JSX-only table
column swap (`proprietario`/`inquilino` were already selected by that same Server Action since Phase 19).
Zero new npm/pip/cargo package, zero new external API/SDK call, zero new Server Action, and zero database
migration (see `20-RESEARCH.md` § Standard Stack / § Package Legitimacy Audit).
