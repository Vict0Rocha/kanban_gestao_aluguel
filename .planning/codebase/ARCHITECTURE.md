<!-- refreshed: 2026-08-14 -->
# Architecture

**Analysis Date:** 2026-08-14

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Browser / Client Layer                       │
│  React 19 Components (@use client)                              │
│  - Board (Kanban drag/drop via dnd-kit)                         │
│  - Card details, column management                              │
│  - Reports/Analytics view                                       │
│  - Login page                                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP POST (Server Actions)
                          │ or reads (Server Components)
┌─────────────────────────▼───────────────────────────────────────┐
│              Server Layer (Next.js on Node.js)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Middleware: proxy.ts                                    │   │
│  │ - Refreshes Supabase auth cookies on each request       │   │
│  │ - Redirects unauthenticated users to /login             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Server Components (async)                               │   │
│  │ - pages: layout.tsx, page.tsx, relatorios/page.tsx      │   │
│  │ - Fetch initial board/columns/cards state from DB       │   │
│  │ - Pass to client components                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Server Actions (lib/kanban/actions.ts)                  │   │
│  │ - Validate all inputs (length, format, range)           │   │
│  │ - Uses session Supabase client (NOT service_role)       │   │
│  │ - Each action calls requireUser() for auth check        │   │
│  │ - Returns { ok: true, data } or { ok: false, error }    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Query Wrapper (lib/kanban/queries.ts)                   │   │
│  │ - Converts ActionResult errors back to exceptions       │   │
│  │ - Provides catch boundary for client-side error handling│   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Supabase Server Client (lib/supabase/server.ts)         │   │
│  │ - Session-authenticated client                          │   │
│  │ - Auth, insert, update, delete, select operations       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS to Supabase Cloud
┌─────────────────────────▼───────────────────────────────────────┐
│                  Supabase Cloud (PostgreSQL)                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Row Level Security (RLS) Policies                        │   │
│  │ - Authenticated users have full access to all tables     │   │
│  │ - Allows/denies based on auth.role() = 'authenticated'   │   │
│  │ - Catches bugs in server-side validation                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Schema Tables                                            │   │
│  │ - profiles: user metadata (mirrors auth.users)           │   │
│  │ - boards: kanban boards (currently 1 per account)        │   │
│  │ - columns: board columns                                 │   │
│  │ - cards: rental properties (imóveis)                     │   │
│  │ - alerts: contract expiration alerts                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Database Constraints                                     │   │
│  │ - Foreign keys with cascading deletes                    │   │
│  │ - Unique constraint on alert (card_id, type, date)       │   │
│  │ - Indexes on card.periodo_fim, columns.board_id          │   │
│  │ - Triggers for set_updated_at and handle_new_user        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Board | Kanban UI, drag/drop, optimistic updates | `web/src/components/kanban/board.tsx` |
| Column | Column container, card list, add card form | `web/src/components/kanban/column.tsx` |
| CardItem | Individual card display, click to detail | `web/src/components/kanban/card-item.tsx` |
| CardDetailDialog | Edit card properties, validate input | `web/src/components/kanban/card-detail-dialog.tsx` |
| AppShell | Layout wrapper, alerts sidebar | `web/src/components/app-shell.tsx` |
| ReportsView | Analytics, stats, contract tables | `web/src/components/reports/reports-view.tsx` |
| SearchField | Filter cards by property name/address | `web/src/components/search-field.tsx` |
| WriteErrorToast | Show error when write fails | `web/src/components/kanban/write-error-toast.tsx` |

## Pattern Overview

**Overall:** Layered architecture with Server Actions pattern

**Key Characteristics:**
- **Dual validation**: Client-side for UX, server-side for security
- **Optimistic updates**: UI reflects changes immediately, reverts on error
- **Session-backed security**: All DB operations use session client, never service_role
- **RLS as a safety net**: If server validation has a bug, RLS still blocks unauthorized changes
- **Separate read/write paths**: Queries fetch via Server Components; mutations via Server Actions
- **Error-as-value**: Server Actions return `{ ok, error }` to avoid Next.js error masking in production

## Layers

**Client Layer (React Components):**
- Purpose: Render UI, handle user interaction, optimistic updates
- Location: `web/src/components/`, `web/src/app/`
- Contains: React components (tsx), client-side state (useState, useCallback)
- Depends on: Server Actions (queries.ts wrapper), Supabase client-side auth
- Used by: Browser

**Server Actions Layer:**
- Purpose: Validate input, authorize user, execute database mutations
- Location: `web/src/lib/kanban/actions.ts`
- Contains: `"use server"` functions, validation helpers, async mutations
- Depends on: Supabase server client, types, alerts module
- Used by: Client components via queries.ts wrapper

**Query Wrapper Layer:**
- Purpose: Convert ActionResult errors to exceptions for catch boundaries
- Location: `web/src/lib/kanban/queries.ts`
- Contains: Async helper functions that unwrap server action results
- Depends on: Server Actions
- Used by: Client components

**Supabase Client Layer:**
- Purpose: Encapsulate database connection and auth refresh
- Location: `web/src/lib/supabase/client.ts` (browser), `web/src/lib/supabase/server.ts` (Node.js)
- Contains: Supabase client initialization
- Depends on: @supabase/supabase-js, env vars
- Used by: Server actions, server components

**Database Layer (Supabase PostgreSQL):**
- Purpose: Persist data, enforce RLS, apply constraints
- Location: `supabase/migrations/`, `supabase/config.toml`
- Contains: Schema tables, RLS policies, triggers, functions
- Depends on: PostgreSQL, auth extension
- Used by: Server actions via Supabase client

## Data Flow

### Primary Request Path: Create/Update Card

1. User types in dialog, clicks Save (`web/src/components/kanban/card-detail-dialog.tsx`)
2. Client calls `updateCard(id, input)` → `queries.ts:updateCard()`
3. `updateCard()` calls `updateCardAction()` (Server Action in `actions.ts`)
4. Server Action:
   - Calls `requireUser()` to check session
   - Validates each field against regex/length limits (mirrors DB CHECK constraints)
   - Creates Supabase session client
   - Calls `supabase.from('cards').update(...).eq('id', id)`
   - Returns `{ ok: true, data: updatedCard }` or `{ ok: false, error: message }`
5. Query wrapper `unwrap()` converts to exception or returns data
6. Client catches exception, reverts optimistic state, shows WriteErrorToast
7. Supabase server:
   - RLS policy checks auth.role() = 'authenticated' (passes for session client)
   - Triggers auto-set updated_at
   - Returns updated row or error
8. Response returned to client

### Drag/Drop Card Flow

1. User drags card to new column (`web/src/components/kanban/board.tsx:onDragEnd`)
2. Component applies optimistic update: `setColumns(newPosition)`
3. Component calls `moveCard(cardId, newColumnId, newPosition)` → Server Action
4. Server action validates and updates DB
5. If successful: optimistic state persists
6. If fails: component reverts to previous state in catch block

### Login Flow

1. User enters email/password in login form (`web/src/app/login/page.tsx`)
2. Form calls `supabase.auth.signInWithPassword()` (browser client)
3. Supabase returns session token, stored in cookie
4. Middleware (`proxy.ts`) refreshes token on next request
5. Server components and actions can now access user via `supabase.auth.getUser()`
6. Router redirects to `/`

**State Management:**
- **Client state**: React useState (columns, cards, search query, modal visibility)
- **Server state**: Database (single source of truth)
- **Session state**: Supabase auth cookies (refreshed per request)
- **No global state library**: Context is used sparingly (alerts provider in AppShell)

## Key Abstractions

**Card (Imóvel):**
- Purpose: Represents a rental property
- Type: `web/src/lib/kanban/types.ts:Card`
- Fields: proprietario, valor, endereco, inquilino, telefone, periodo_inicio, periodo_fim, observacoes, position
- DB: `public.cards` table

**Column:**
- Purpose: Represents a status column in the kanban board
- Type: `web/src/lib/kanban/types.ts:Column`
- Fields: id, board_id, name, position, cards[]
- DB: `public.columns` table
- Contains: Array of cards in order by position

**Board:**
- Purpose: Container for columns (kanban board)
- Type: Implicit (not a separate type, referenced by board_id)
- DB: `public.boards` table
- Currently: Only 1 board per account (hardcoded in queries)

**Alert:**
- Purpose: Auto-generated alert when contract expires
- Types: 'contrato_vencendo' (30 days before), 'contrato_vencido' (on/after expiry)
- Status: 'pendente' (not sent), 'enviado' (dismissed), 'descartado' (user discarded)
- DB: `public.alerts` table
- Triggered by: Contracts with periodo_fim set

**ActionResult:**
- Purpose: Encapsulate success/error from server actions
- Type: `{ ok: true, data: T } | { ok: false, error: string }`
- Why: Avoids Next.js masking error messages in production

## Entry Points

**Root Middleware:**
- Location: `web/src/proxy.ts`
- Triggers: Every HTTP request (matcher in config excludes static assets)
- Responsibilities:
  - Refresh Supabase auth session cookie
  - Redirect unauthenticated users to /login
  - Redirect authenticated users away from /login back to /
  - Pass through all other requests

**Root Layout:**
- Location: `web/src/app/layout.tsx`
- Triggers: Every page render
- Responsibilities:
  - Load Google Fonts (Plus Jakarta Sans, Sora)
  - Set HTML lang="pt-BR", apply CSS variables
  - Render BaseUiAnimationsWorkaround (workaround for @base-ui/react animations)
  - Render global styles from globals.css
  - Wrap children (all pages)

**App Layout (Authenticated):**
- Location: `web/src/app/(app)/layout.tsx`
- Triggers: Every page under (app) route group
- Responsibilities:
  - Fetch all cards with alerts for this period
  - Calculate today's date on server (so client hydration matches)
  - Pass alert data to AppShell component
  - Wrap route children

**Board Page:**
- Location: `web/src/app/(app)/page.tsx`
- Triggers: GET `/`
- Responsibilities:
  - Fetch first board from DB (limit 1)
  - Fetch all columns and cards for that board
  - Pass data to Board component
  - Show "No board found" if none exist

**Reports Page:**
- Location: `web/src/app/(app)/relatorios/page.tsx`
- Triggers: GET `/relatorios`
- Responsibilities:
  - Fetch board and columns/cards (same as board page)
  - Calculate today's date on server
  - Pass to ReportsView component
  - Render analytics dashboard

**Login Page:**
- Location: `web/src/app/login/page.tsx`
- Triggers: GET `/login` (when unauthenticated)
- Responsibilities:
  - Render email/password form
  - Call Supabase browser client to sign in
  - On success: redirect to `/`

## Architectural Constraints

- **Threading:** Single-threaded event loop per Next.js instance (Node.js default); Supabase handles concurrency
- **Global state:** None (avoided). AppShell uses React Context for alerts, but data still lives in DB
- **Auth model:** Supabase JWTs in cookies, refreshed per request by proxy.ts
- **RLS scope:** All policies check `auth.role() = 'authenticated'` (team-wide access, no per-user row filtering)
- **Card positioning:** Uses `double precision` in DB (fractional numbers), calculated with `positionBetween()` utility to avoid collisions during concurrent drags
- **Alerts generation:** Manual, not automatic; triggered by server component queries, not by DB triggers (keeps schema simple)

## Anti-Patterns

### Mixing service_role and session client
**What happens:** Using `service_role` key for all mutations would bypass RLS
**Why it's wrong:** 
- Concentrates all authorization logic in server actions
- One bug in actions.ts breaks the entire security model
- RLS serves as a safety net; losing it is dangerous
**Do this instead:** Always use session client (`createClient()` in `web/src/lib/supabase/server.ts`); let RLS be the final check

### Throwing exceptions from Server Actions
**What happens:** Client sees generic "An error occurred" in production
**Why it's wrong:** Users can't understand what went wrong; server logs contain real error but client-side debugging is impossible
**Do this instead:** Return `{ ok: false, error: "User-facing message" }` from actions; let query wrapper convert to exception for catch boundaries

### Trusting client-side validation
**What happens:** User bypasses form validation (via dev tools), sends bad data
**Why it's wrong:** No security check, users might maliciously craft requests to POST /actions directly
**Do this instead:** Validate again in Server Actions (done in `actions.ts` with regex/length checks); match DB CHECK constraints

### Not refreshing auth on every request
**What happens:** User session expires while using app; component tries to write, fails with "Unauthorized"
**Why it's wrong:** User gets confused, thinks they lost their changes
**Do this instead:** Middleware refreshes token on every request (`proxy.ts`), so getUser() always returns current session

## Error Handling

**Strategy:** Return errors as values from Server Actions, convert to exceptions at the query wrapper layer

**Patterns:**

1. **Server Action Validation Error:**
   - Action validates input, returns `{ ok: false, error: "Campo X inválido" }`
   - Query wrapper unwraps to exception
   - Client catch block reverts optimistic state, shows toast

2. **Database RLS Denial:**
   - User removed from allowlist while session still active
   - RLS policy `using (auth.role() = 'authenticated')` denies mutation
   - Supabase returns auth error
   - Server action returns error message
   - Client reverts state, shows toast

3. **Network Error:**
   - Request to Supabase times out or fails
   - Supabase client throws
   - Query wrapper propagates to client catch
   - Same revert/toast behavior

4. **Authentication Expiry:**
   - Session cookie expires before request
   - Middleware detects, redirects to /login before Server Action runs
   - If action somehow runs, `requireUser()` returns null, action returns "Sessão expirada"

## Cross-Cutting Concerns

**Logging:**
- Client-side: Browser console.error() in Board component catch block
- Server-side: No dedicated logging (could integrate Winston, Pino)
- Database: Audit table not implemented (could add triggers to log mutations)

**Validation:**
- Client-side: HTML5 input types (email, number), form state checks
- Server-side: Regex and length validation in Server Actions (matches DB CHECK constraints in migration 20260811000000)
- Database: CHECK constraints on numeric ranges, NOT NULL on required fields

**Authentication:**
- Client-side: Supabase browser client with email/password
- Server-side: Supabase server client refreshes auth cookie via proxy.ts
- Database: RLS policies enforce auth.role() = 'authenticated'

**Authorization:**
- Model: Team-wide access (all authenticated users see all data)
- Enforcement: RLS policies (auth.role() = 'authenticated')
- Future: Could add per-property or per-user row-level filters if needed

---

*Architecture analysis: 2026-08-14*
