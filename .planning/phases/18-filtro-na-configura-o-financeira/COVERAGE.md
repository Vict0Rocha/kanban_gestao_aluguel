# Phase 18: Filtro na Configuração financeira — API Coverage

No external API integration: this phase adds a live client-side search field to
`/financeiro/configuracao` by filtering an array (`ContratoConfig[]`) that the existing Server Component
already loaded, using a local matcher function and `React.useState`/`React.useMemo`. It reuses three
modules already in production in this codebase — `SearchField` (`web/src/components/search-field.tsx`),
`normalizeText` (`web/src/lib/kanban/search.ts`), and `usePagination` (`web/src/components/pagination.tsx`)
— with zero new npm/pip/cargo package, zero new external API/SDK call, zero new Server Action, and zero
database migration (see `18-RESEARCH.md` § Standard Stack / § Package Legitimacy Audit).
