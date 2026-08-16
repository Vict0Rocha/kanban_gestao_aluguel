# Codebase Concerns

**Analysis Date:** 2026-08-14

> ⚠️ **Este documento contém hipóteses, não fatos verificados.** Foi gerado por um
> modelo rápido varrendo o código, e pelo menos um achado não sobreviveu à
> verificação (ver a anotação em "Console.error logging in production code" e em
> "Console.error may leak error context"). Confirme cada item antes de transformá-lo
> em trabalho.

## Tech Debt

**~~Console.error logging in production code:~~ ❌ FALSO POSITIVO — verificado 2026-08-14**
- Alegação original: `console.error()` em server actions e componentes vazaria objetos de erro do banco para os logs do navegador
- **Por que está errado:** `web/src/lib/kanban/actions.ts` é `"use server"`. Os 9 `console.error` ali rodam no servidor e vão para os logs da Vercel — nunca para o console do navegador. Logar erro de banco no servidor é o comportamento correto, não um vazamento.
- **O que o navegador realmente recebe:** a Server Action retorna `{ ok: false, error }` onde a mensagem vem de `erroDoBanco()`, que mapeia apenas o *código* do erro (`23514`, `23503`, `PGRST116`) para uma frase em português. O objeto de erro cru do Supabase não sai do servidor. O `console.error` em `board.tsx` (`"use client"`) loga essa string já sanitizada.
- **Evidência:** busca por `error.message`/`error.details`/`error.hint`/`JSON.stringify(error)` em todo o `src/` retorna uma única ocorrência — `board.tsx:106` — lendo a mensagem sanitizada.
- **Conclusão:** nenhuma mudança necessária. Aplicar o "fix" sugerido (`if NODE_ENV === 'development'`) só removeria diagnóstico útil dos logs do servidor.

**Large component size:**
- Issue: Board component is 385 lines, handling drag-drop state, search state, optimistic updates, and error recovery
- Files: `web/src/components/kanban/board.tsx`
- Impact: Harder to test, reason about, and modify; mixing concerns (state, persistence, UI)
- Fix approach: Extract search logic (matchingIds, countCards filtering) into a separate hook; extract optimistic update + error recovery pattern into a custom hook; separate error handling into a discrete component

**Lack of error boundaries:**
- Issue: Components set error state locally with `catch (error) { setError(...) }`; no React Error Boundary to catch rendering crashes
- Files: 
  - `web/src/components/kanban/board.tsx` 
  - `web/src/components/kanban/card-detail-dialog.tsx`
  - `web/src/components/alerts/alerts-panel.tsx`
- Impact: Unhandled errors in child components can unmount the entire board or layout; users see a blank page with no recovery option
- Fix approach: Add an `<ErrorBoundary>` wrapper in `AppShell` or `Board` that catches and displays a user-friendly error message with an option to reload

**Alert calculation in server component layout:**
- Issue: Date calculation and alert filtering embedded in `app/(app)/layout.tsx`; recomputes on every request even when data hasn't changed
- Files: `web/src/app/(app)/layout.tsx` (lines 14–22)
- Impact: Harder to test, reusable, or optimize; couples layout to alert business logic
- Fix approach: Extract into `lib/kanban/alerts.ts` as a server utility function; memoize if possible or cache at request level

## Known Bugs

**Allowlist bypass not logged or monitored:**
- Symptoms: Users invited to Supabase project but not added to `allowed_members` see a blank board with no error message (per memory note, 2026-08-12)
- Files: `supabase/migrations/20260811000000_security_hardening.sql` (RLS policies), `web/src/app/(app)/page.tsx` (no error for missing data)
- Mitigation: App design — the board renders empty if no data, which is technically correct but confusing to new users; no audit trail of access attempts

**None confirmed as of 2026-08-14 (beyond the allowlist experience noted above)**

## Security Considerations

**RLS policies hardened but initial schema permissive:**
- Risk: If a project is forked or a backup is restored, the initial schema (20260728000000_init_schema.sql) only requires `auth.role() = 'authenticated'`, allowing any signed-up user in
- Files: 
  - Initial: `supabase/migrations/20260728000000_init_schema.sql` (lines 133–151)
  - Fixed: `supabase/migrations/20260811000000_security_hardening.sql` (lines 66–84)
- Current mitigation: Hardening migration applied; `allowed_members` table is now the source of truth; function `is_team_member()` checked by all policies
- Recommendations: 
  - Add migration rollback guards (e.g., document manual steps to re-apply hardening if schema is ever reset)
  - Audit `allowed_members` membership on deployment
  - Consider a post-migration test in CI to verify RLS enforcement

**~~Console.error may leak error context:~~ ❌ FALSO POSITIVO — verificado 2026-08-14**
- Mesmo engano da seção Tech Debt acima: mensagens do Postgres não são escritas no console do navegador. `actions.ts` é `"use server"`.
- O próprio texto original já reconhecia que "error messages are already sanitized before returning to UI" — o que contradiz a alegação de risco no mesmo item.
- **Conclusão:** nenhuma ação necessária.

**Login page UX does not warn of allowlist requirement:**
- Risk: User enters email/password, logs in successfully, sees empty board; could lead to support burden or confusion
- Files: `web/src/app/login/page.tsx`
- Current mitigation: None (by design, to avoid leaking whether an email is registered)
- Recommendations: 
  - Add welcome message to `app/(app)/page.tsx` when board is null, explaining next steps
  - Consider a serverless function to notify admins of new login attempts from non-allowlisted users

**No CSRF token validation on Server Actions:**
- Risk: Minimal; Next.js Server Actions use automatic CSRF protection via origin and referer checks
- Files: N/A (framework-level)
- Current mitigation: Next.js SameSite cookies, referer validation built-in; security headers in `next.config.ts` prevent framing
- Recommendations: Document this reliance for future maintainers

**No input rate limiting on Server Actions:**
- Risk: Unauthenticated or resource-exhausted attackers could spam write operations
- Files: `web/src/lib/kanban/actions.ts`
- Current mitigation: Supabase auth required (requireUser()), but no per-user rate limit at app layer
- Recommendations: Consider Supabase native rate limiting or middleware-level throttling if scale increases

## Performance Bottlenecks

**Alert scan on every layout render:**
- Problem: `app/(app)/layout.tsx` filters all cards with `periodo_fim` and calls alert comparison logic on every request
- Files: `web/src/app/(app)/layout.tsx` (lines 14–22)
- Current behavior: Runs on every navigation to `/` or `/relatorios`, even if no alerts are visible
- Recommendations: 
  - Cache in a server utility with request-level deduplication
  - Consider moving to a periodic background job if user count grows
  - Index `periodo_fim` is present (migration line 80), so query is efficient

**Large Board component state re-renders:**
- Problem: Board manages `columns`, `activeCard`, `activeColumn`, `writeError`, and `query` in top-level state; any drag-over updates all columns, causing potential re-renders of filtered/unfiltered cards
- Files: `web/src/components/kanban/board.tsx` (lines 61–77)
- Recommendations: 
  - Memoize Card and Column components with React.memo to prevent unnecessary re-renders
  - Consider `useTransition` for search state to deprioritize UI updates

**Search matching uses O(n*m) set membership check:**
- Problem: `matchingIds()` iterates all cards and compares against query for each; no indexing or fuzzy matching
- Files: `web/src/lib/kanban/search.ts`
- Current impact: Imperceptible on <500 cards; may slow on 5k+ cards
- Recommendations: Implement Trie-based search or use a library like `fuse.js` if search becomes a feature focus

## Fragile Areas

**Date format consistency:**
- Files: 
  - Actions: `web/src/lib/kanban/actions.ts` (DATA_ISO regex, line 52)
  - Components: `web/src/components/kanban/card-detail-dialog.tsx` (date input binding)
  - Layout: `web/src/app/(app)/layout.tsx` (manual ISO string construction, lines 21–22)
- Why fragile: Date conversion uses inline string formatting in layout; regex validation in actions assumes ISO format; HTML input type="date" may not enforce ISO on all browsers
- Safe modification: 
  - Create `lib/kanban/date.ts` with date utilities: `toISO(date: Date)`, `fromISO(str: string)`, `isValidISO(str: string)`
  - Use `lib/kanban/date.ts` in actions, components, and layout
  - Add test for date edge cases (leap years, month boundaries)

**Numeric value parsing in card-detail-dialog:**
- Files: `web/src/components/kanban/card-detail-dialog.tsx` (line 65)
- Why fragile: Uses `Number(form.valor.replace(",", "."))` to support comma as decimal separator; no localization, so decimal point on some keyboards will fail
- Safe modification: 
  - Use a number input type="number" or a masked input library
  - Define a consistent locale policy for numbers (e.g., always use `.` in backend)

**RLS policy evaluation order:**
- Files: `supabase/migrations/20260811000000_security_hardening.sql` (policy creation order)
- Why fragile: Dropping and recreating policies can leave the database in an inconsistent state if migration fails mid-run
- Safe modification: 
  - Wrap policy changes in a transaction (Supabase migrations do this automatically, but document it)
  - Test rollback on a staging database before production apply

## Scaling Limits

**Single board per account (by design):**
- Current capacity: App assumes 1 board, 1 team, unlimited columns/cards
- Limitation: If multi-board or multi-tenant is added later, current RLS policies (using auth role, not board ownership) will require rewrite
- Recommendations: 
  - Add `--` comment in next schema change documenting the 1:1 account:board assumption
  - Plan migration path to `user_id` in RLS clauses if multi-board is needed

**No pagination on card listing:**
- Problem: Loads all columns and all cards for a board on every page request
- Files: `web/src/app/(app)/page.tsx` (lines 15–24)
- Current capacity: Performant for <10k cards; 50k cards will cause noticeable load time
- Recommendations: 
  - Implement cursor-based pagination or lazy-load columns
  - Use `order_by` and `limit` in Supabase query

**Search within board is O(n) on every keystroke:**
- Files: `web/src/lib/kanban/search.ts`, `web/src/components/kanban/board.tsx` (useMemo on line 72)
- Current capacity: Performant for <5k cards; useMemo prevents recalculation on re-render
- Recommendations: Use `useTransition` to defer updates on very large datasets; consider server-side search if data grows

## Dependencies at Risk

**None identified — npm audit clean as of 2026-08-14**
- Last audit: `npm audit --omit=dev` returned 0 vulnerabilities
- Note: Supabase SDK (`@supabase/ssr`, `@supabase/supabase-js`) is actively maintained and audited by Supabase team

## Missing Critical Features

**No automated test suite:**
- Problem: No unit, integration, or E2E tests; all verification is manual or via build/lint gates
- Blocks: 
  - Confident refactoring (e.g., extracting board hooks)
  - Regression detection on security fixes
  - Demonstrating feature coverage for stakeholders
- Priority: **High** — given recent security hardening, tests on RLS and Server Actions validation are important

**No password strength enforcement on login:**
- Problem: User can set a 1-character password; no complexity rules
- Blocks: Weak account security; relies on Supabase project settings
- Priority: **Low** — can rely on Supabase Auth admin to enforce, but app could add client-side UX hint

**~~No email verification:~~ ❌ FALSO POSITIVO — verificado 2026-08-14**
- Alegação original: Supabase Auth não exigiria verificação de e-mail
- **Por que está errado:** `GET /auth/v1/settings` retorna `mailer_autoconfirm: false` — o Supabase **exige** confirmação de e-mail; não confirma automaticamente. Terceiro achado deste documento a não se sustentar após verificação.
- **Conclusão:** nenhuma ação necessária.

**No audit log of RLS denials:**
- Problem: When a user is removed from `allowed_members`, their queries silently fail with zero rows (not an error); no record of why
- Blocks: Diagnosing access issues, compliance auditing
- Priority: **Low** (early-stage project) but should be added if app scales

## Test Coverage Gaps

**Server Actions validation logic untested:**
- What's not tested: `textoObrigatorio`, `validarValor`, `validarTelefone`, `validarPeriodo`, `validarDetalhes` functions; regex patterns for UUID, phone, date
- Files: `web/src/lib/kanban/actions.ts` (lines 50–127)
- Risk: Bug in validation logic silently passes invalid data to database (though CHECK constraints catch it); error message may mismatch actual error
- Priority: **High** — this is the app's primary defense layer

**RLS policies untested:**
- What's not tested: Allowlist membership check; policy WITH CHECK clauses; policy evaluation order
- Files: `supabase/migrations/20260811000000_security_hardening.sql`
- Risk: A refactored policy could accidentally grant unauthorized access; security hardening migration could regress if run against old state
- Priority: **High** — security-critical

**Board drag-and-drop untested:**
- What's not tested: Move card between columns; move card within column; optimistic update + error recovery; revert on RLS denial
- Files: `web/src/components/kanban/board.tsx`
- Risk: User sees card move, then it reverts silently; no visibility into why; edge cases (simultaneous drags, network latency) unknown
- Priority: **Medium** — core UX feature but manually tested in dev

**Search filtering untested:**
- What's not tested: Case-insensitive matching; partial string match; matching on multiple fields (proprietario, endereco)
- Files: `web/src/lib/kanban/search.ts`
- Risk: Search returns unexpected results; user unable to find properties
- Priority: **Medium** — feature works but edge cases unknown

**Alert logic untested:**
- What's not tested: Trigger date calculation (contract vencendo vs vencido); alert generation for edge dates (today vs tomorrow); alert deduplication
- Files: `web/src/lib/kanban/alerts.ts`, `web/src/app/(app)/layout.tsx`
- Risk: Alerts fire on wrong date; duplicate alerts generated; dismissed alert re-appears on refresh
- Priority: **Medium** — users rely on alerts for business decisions

**No integration tests for Server Actions + RLS:**
- What's not tested: Happy path (authenticated user, in allowlist, valid input); sad path (user not in allowlist, RLS denies); malformed input
- Risk: A refactored action could bypass validation; a policy change could silently fail writes
- Priority: **High** — security + data integrity

**No E2E tests:**
- What's not tested: Full user flow (login → create board → add card → edit → delete); error recovery; cross-browser compatibility
- Files: Entire app
- Risk: Regression after refactor; browser-specific bugs (e.g., date input handling in Safari)
- Priority: **Medium** (early-stage) but should be planned before larger team

---

*Concerns audit: 2026-08-14*
