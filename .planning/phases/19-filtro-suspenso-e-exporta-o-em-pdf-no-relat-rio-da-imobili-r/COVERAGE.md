# Phase 19: Filtro suspenso e exportação em PDF no relatório da imobiliária — API Coverage

No external API integration: this phase adds a live client-side filter panel (5 fields) to
`/relatorios/imobiliaria` by widening an existing Server Action query (`buscarReconciliacaoAction`, one
additional column — `cards.inquilino`, already present in the schema) and filtering the already-loaded array
in memory, plus a PDF export module (`reconciliacao-pdf.ts`) that reuses `jspdf`/`jspdf-autotable` —
already-installed, already-in-production dependencies since Phase 10 (`relatorio-financeiro-pdf.ts`), reused
unchanged. Zero new npm/pip/cargo package, zero new external API/SDK call, zero database migration (see
`19-RESEARCH.md` § Standard Stack / § Package Legitimacy Audit).
