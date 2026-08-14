# Coding Conventions

**Analysis Date:** 2026-08-14

## Naming Patterns

**Files:**
- kebab-case for all component and utility files: `card-item.tsx`, `add-card-dialog.tsx`, `base-ui-animations-workaround.ts`
- Directory structure mirrors functionality: `components/kanban/`, `lib/kanban/`

**Functions:**
- camelCase for all functions: `createCard()`, `deleteCard()`, `findColumnOf()`, `textoObrigatorio()`, `validarData()`
- Prefix validation functions with domain: `textoObrigatorio()`, `numeroFinito()`, `validarValor()`
- Helper functions are small, single-purpose utilities

**Variables:**
- camelCase for all variable declarations: `activeCard`, `searchQuery`, `writeError`, `matchedIds`
- Boolean predicates often have verb prefixes: `isDragging`, `isSearching`
- State hook variables: `const [state, setState]`

**Types:**
- PascalCase for all type definitions: `Card`, `Column`, `CardDetailsInput`, `ActionResult<T>`
- Use `type` keyword for type aliases: `export type Card = { ... }`
- Domain-specific prefixes in related types: `CardDetailsInput` (for form input)

**Constants:**
- UPPER_SNAKE_CASE for all constants: `UUID`, `TELEFONE`, `DATA_ISO`, `NAO_AUTENTICADO`
- Regex patterns and validation strings are constants

## Code Style

**Formatting:**
- Next.js v16 default formatting (ES2017 target, ESM modules)
- Strict TypeScript enabled (`"strict": true`)
- JSX as `react-jsx` (no React import needed in JSX files)
- Indentation: 2 spaces (inferred from actual files)

**Linting:**
- ESLint v9 with `eslint-config-next` presets
- Core Web Vitals rules (`eslint-config-next/core-web-vitals`)
- TypeScript support (`eslint-config-next/typescript`)
- No Prettier config found; Next.js defaults used

## Import Organization

**Order:**
1. React and React DOM imports: `import * as React from "react"`
2. External library imports: `import { useSortable } from "@dnd-kit/sortable"`
3. Internal imports with @/ alias: `import { cn } from "@/lib/utils"`
4. Type imports marked with `type` keyword

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in `tsconfig.json`)
- All relative imports use @/ alias, never `../../../`
- Keeps imports clean and refactoring-safe

## Error Handling

**Patterns:**
- `ActionResult<T>` type for server action returns: `{ ok: true; data: T } | { ok: false; error: string }`
- Validation errors returned as structured results, never thrown exceptions (Next.js replaces exception messages in production)
- Server actions validate inputs before database operations
- User authentication checked in each server action via `requireUser()` 
- Database RLS (Row Level Security) acts as second defense layer
- No `service_role` used; client uses session token so RLS always applies

**Validation:**
- Validation functions (`textoObrigatorio()`, `validarValor()`, `validarData()`) mirror database CHECK constraints
- Validation mirrors database constraints (from migration files) to provide user-friendly messages
- Two-level validation: browser for quick UX feedback, server for actual enforcement

## Logging

**Framework:** `console` (no structured logging framework installed)

**Patterns:**
- Comments used instead of debug logs; code is self-documenting
- No log levels or logging framework detected
- Error messages captured in `ActionResult` type and surfaced to UI

## Comments

**When to Comment:**
- Comments explain WHY, not WHAT (code shows what it does)
- Architectural decisions documented: why dialogs are siblings not descendants of sortable divs
- Business logic constraints explained: "busca aqui realça, não filtra" (search highlights, doesn't filter)
- Design trade-offs justified: why drag remains enabled during search
- Server action comments explain security model: two independent defenses (validation + RLS)

**JSDoc/TSDoc:**
- Used for type definitions and complex behavior: `/** Retorno das Server Actions. Não usamos `throw` ... */`
- Parameter documentation in function signatures: inline comments for complex types
- No @param/@returns JSDoc seen; types already express this via TypeScript

**Language:**
- Comments primarily in Portuguese (business domain is Portuguese-speaking)
- Technical terms often left in English (e.g., `RLS`, `service_role`)

## Function Design

**Size:** Functions are small and focused; complex operations decomposed into helper functions

**Parameters:**
- Explicit inline object destructuring preferred: `{ card, matched, onDelete, onUpdate }`
- Type definitions via TypeScript, not JSDoc
- Callbacks passed as function props: `onDelete: (id: string) => void`

**Return Values:**
- Server actions return `ActionResult<T>` for error handling
- UI components return JSX.Element (implicit)
- Helper functions typed with explicit return type annotations
- Async functions properly await: no fire-and-forget patterns observed

## Module Design

**Exports:**
- Named exports standard: `export function CardItem({ ... })`
- Type exports marked with `type` keyword: `export type Card = { ... }`
- Single responsibility per file

**Barrel Files:**
- Not observed in this codebase; direct imports from individual files preferred

**File Structure:**
- `src/app/` — Next.js 16 App Router pages and layouts
- `src/components/` — React components, organized by feature (kanban, ui, alerts, reports)
- `src/lib/` — Utilities, types, queries, and server actions
- `src/lib/kanban/` — Domain-specific code: types, actions, queries, formatting, search

---

*Convention analysis: 2026-08-14*
