# Testing Patterns

**Analysis Date:** 2026-08-14

## Test Framework

**Runner:**
- Not present as of 2026-08-14
- No jest, vitest, or other test runner configured
- No test configuration file found in project root or `web/`

**Run Commands:**
```bash
npm run lint  # Available: ESLint only
npm run build # Build verification
npm run dev   # Manual testing in browser
```

No automated test runner available; `package.json` scripts show no test entry.

## Test File Organization

**Location:**
- Not applicable — no test files exist in the codebase
- Searched `web/src/**/*.test.*` and `web/src/**/*.spec.*` with no results

## Test Structure

No test files present in this codebase as of 2026-08-14.

## Mocking

**Framework:** Not applicable — no testing framework installed

## Coverage

**Requirements:** Not enforced

## Test Types

**Unit Tests:** Not present

**Integration Tests:** Not present

**E2E Tests:** Not used

## Verification Approach (if no automated tests)

This project uses manual verification and lint/build gates:

1. **Lint Gate:**
   - ESLint runs via `npm run lint`
   - Next.js core-web-vitals and TypeScript presets enforce code quality
   - Catches type errors and style violations before build

2. **Build Gate:**
   - `npm run build` compiles TypeScript and Next.js
   - Strict type checking enabled (`"strict": true` in tsconfig.json)
   - Build fails if TypeScript or Next.js compilation errors occur
   - Ensures code correctness at compile time

3. **Manual Browser Testing:**
   - `npm run dev` runs dev server for manual testing
   - Developers test UI interactions directly in browser
   - Kanban drag-and-drop verified via UI interaction
   - Server actions tested via form submissions in dev mode

4. **Database Layer Defense:**
   - Supabase RLS (Row Level Security) acts as runtime guard
   - Database CHECK constraints enforce data validity
   - Server actions validate before writes, but database is second defense
   - Migration files define constraints that mirror server-side validation

5. **Type Safety:**
   - TypeScript strict mode catches many bugs at compile time
   - Explicit types for server action returns (`ActionResult<T>`) prevent undefined behavior
   - Type definitions in `lib/kanban/types.ts` drive component contracts

6. **Code Review:**
   - Pull request workflow expected (project has git history)
   - Recent commits show collaborative development (merge commits visible)

---

*Testing analysis: 2026-08-14*
