# Codebase Structure

**Analysis Date:** 2026-08-14

## Directory Layout

```
C:/Users/victo/OneDrive/Desktop/kanban para aluguel/
├── web/                              # Next.js 16 application
│   ├── src/
│   │   ├── app/                       # App Router pages and layouts
│   │   │   ├── layout.tsx             # Root layout (fonts, HTML structure)
│   │   │   ├── globals.css            # Global styles
│   │   │   ├── login/
│   │   │   │   └── page.tsx           # Login form (unauthenticated)
│   │   │   └── (app)/                 # Authenticated routes group
│   │   │       ├── layout.tsx         # App shell wrapper (alerts fetch)
│   │   │       ├── page.tsx           # Kanban board (main page)
│   │   │       ├── loading.tsx        # Skeleton/loading state
│   │   │       └── relatorios/
│   │   │           └── page.tsx       # Analytics/reports dashboard
│   │   │
│   │   ├── components/                # React components
│   │   │   ├── ui/                    # Shadcn UI components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── textarea.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── alert-dialog.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   └── table.tsx
│   │   │   │
│   │   │   ├── kanban/                # Kanban-specific components
│   │   │   │   ├── board.tsx          # Main board component (drag/drop)
│   │   │   │   ├── column.tsx         # Column container
│   │   │   │   ├── card-item.tsx      # Individual card display
│   │   │   │   ├── card-detail-dialog.tsx  # Edit card modal
│   │   │   │   ├── add-card-dialog.tsx    # New card modal
│   │   │   │   ├── add-column-form.tsx    # New column form
│   │   │   │   └── write-error-toast.tsx  # Error notification
│   │   │   │
│   │   │   ├── reports/               # Analytics components
│   │   │   │   ├── reports-view.tsx   # Main reports layout
│   │   │   │   ├── stat-tile.tsx      # KPI card component
│   │   │   │   ├── column-bar-chart.tsx   # Bar chart by column
│   │   │   │   ├── contracts-table.tsx    # Contracts summary table
│   │   │   │   └── contract-status-badge.tsx  # Status badge
│   │   │   │
│   │   │   ├── alerts/                # Alerts components
│   │   │   │   └── alerts-panel.tsx   # Sidebar alerts list
│   │   │   │
│   │   │   ├── app-shell.tsx          # App layout wrapper with navigation
│   │   │   └── search-field.tsx       # Global search input (highlights cards)
│   │   │
│   │   ├── lib/                       # Utility functions and business logic
│   │   │   ├── kanban/                # Kanban domain logic
│   │   │   │   ├── types.ts           # TypeScript types (Card, Column, ActionResult)
│   │   │   │   ├── actions.ts         # Server Actions (mutations, validation)
│   │   │   │   ├── queries.ts         # Query wrapper (error conversion)
│   │   │   │   ├── position.ts        # Fractional position calculation
│   │   │   │   ├── format.ts          # Format utilities (currency, dates)
│   │   │   │   ├── search.ts          # Search/filter logic
│   │   │   │   ├── report.ts          # Report aggregations (stats, charts)
│   │   │   │   └── alerts.ts          # Alert detection and status
│   │   │   │
│   │   │   ├── supabase/              # Database client initialization
│   │   │   │   ├── server.ts          # Server-side Supabase client
│   │   │   │   └── client.ts          # Browser-side Supabase client
│   │   │   │
│   │   │   ├── utils.ts               # Generic utilities (cn for class merging, etc)
│   │   │   └── base-ui-animations-workaround.ts  # Fix for @base-ui/react
│   │   │
│   │   └── proxy.ts                   # Next.js middleware (auth refresh, redirects)
│   │
│   ├── package.json                   # Next.js dependencies and scripts
│   ├── package-lock.json
│   ├── tsconfig.json                  # TypeScript configuration
│   ├── next.config.ts                 # Next.js configuration
│   ├── tailwind.config.ts             # Tailwind CSS configuration
│   ├── postcss.config.mjs             # PostCSS configuration
│   ├── eslint.config.mjs              # ESLint configuration
│   ├── CLAUDE.md                      # Symlink to ../web/AGENTS.md
│   ├── AGENTS.md                      # Notes on Next.js 16 breaking changes
│   ├── README.md                      # Project README
│   └── node_modules/                  # Dependencies (not committed)
│
├── supabase/                          # Database schema and migrations
│   ├── migrations/                    # SQL migration files
│   │   ├── 20260728000000_init_schema.sql         # Initial schema (profiles, boards, columns, cards, alerts)
│   │   ├── 20260811000000_security_hardening.sql  # CHECK constraints and validation
│   │   └── 20260811010000_security_advisor_fixes.sql  # RLS and advisor fixes
│   │
│   ├── seed.sql                       # Optional: seed data script
│   ├── config.toml                    # Supabase local dev config
│   ├── hardening_seguranca.sql        # Security hardening notes (not a migration)
│   └── .gitignore                     # Git ignore for local Supabase
│
├── .git/                              # Git repository
├── .github/                           # GitHub workflows (if any)
├── .planning/                         # Planning and documentation
│   └── codebase/                      # This analysis
│       ├── ARCHITECTURE.md            # System design and layers
│       └── STRUCTURE.md               # This file
│
└── README.md                          # Root project README
```

## Directory Purposes

**`web/`:**
- Purpose: Next.js 16 full-stack web application
- Contains: React components, Server Actions, API layer, styling
- Key files: `src/app/`, `src/components/`, `src/lib/`, `package.json`

**`web/src/app/`:**
- Purpose: App Router pages and layouts (Next.js routing)
- Contains: Page components (tsx), layout wrappers, route groups
- Key files: `layout.tsx` (root), `(app)/layout.tsx` (authenticated), `(app)/page.tsx` (board), `login/page.tsx`

**`web/src/components/`:**
- Purpose: Reusable React components
- Contains: UI components (Shadcn), domain-specific components (kanban, reports)
- Patterns: Client-only components use `"use client"` directive

**`web/src/lib/`:**
- Purpose: Business logic, utilities, client initialization
- Contains: Server Actions, queries, types, formatting, database clients
- Organization: Grouped by domain (kanban, supabase, general utilities)

**`web/src/lib/kanban/`:**
- Purpose: Kanban domain logic and types
- Key files:
  - `types.ts`: Card, Column, ActionResult types
  - `actions.ts`: Server Actions for mutations (create/update/delete/move)
  - `queries.ts`: Error wrapper layer (exception conversion)
  - `position.ts`: Fractional position algorithm for drag/drop ordering
  - `search.ts`: Card search and filter logic
  - `format.ts`: Currency and date formatting
  - `report.ts`: Analytics aggregations
  - `alerts.ts`: Contract expiration alert detection

**`web/src/lib/supabase/`:**
- Purpose: Supabase client initialization (isolates env var access)
- Files:
  - `server.ts`: For Server Components and Server Actions (uses process.env)
  - `client.ts`: For browser-side code (uses next/navigation secrets)

**`supabase/migrations/`:**
- Purpose: Version-controlled database schema
- Execution: Applied in order by Supabase CLI
- Key migrations:
  - `20260728000000_init_schema.sql`: Core tables and RLS setup
  - `20260811000000_security_hardening.sql`: ADD CHECK constraints
  - `20260811010000_security_advisor_fixes.sql`: Security and advisor fixes

**`supabase/config.toml`:**
- Purpose: Local Supabase dev server config
- Contains: Project name, studio settings, auth settings

## Key File Locations

**Entry Points:**
- `web/src/proxy.ts`: Middleware (runs before every request)
- `web/src/app/layout.tsx`: Root layout (wraps all pages)
- `web/src/app/(app)/page.tsx`: Kanban board (main page)
- `web/src/app/(app)/relatorios/page.tsx`: Analytics dashboard
- `web/src/app/login/page.tsx`: Login form

**Configuration:**
- `web/package.json`: Dependencies, build scripts
- `web/tsconfig.json`: TypeScript settings
- `web/next.config.ts`: Next.js build/runtime settings
- `web/tailwind.config.ts`: Tailwind CSS design tokens
- `supabase/config.toml`: Supabase local dev config

**Core Logic:**
- `web/src/lib/kanban/actions.ts`: All database mutations with validation
- `web/src/lib/kanban/queries.ts`: Query error wrapper
- `web/src/lib/kanban/types.ts`: Type definitions for Card, Column, ActionResult
- `web/src/components/kanban/board.tsx`: Drag/drop logic and optimistic updates

**Components:**
- `web/src/components/kanban/board.tsx`: Main kanban board
- `web/src/components/kanban/column.tsx`: Column container
- `web/src/components/kanban/card-item.tsx`: Card display
- `web/src/components/reports/reports-view.tsx`: Analytics view
- `web/src/components/app-shell.tsx`: Navigation and alerts sidebar

**Database Schema:**
- `supabase/migrations/20260728000000_init_schema.sql`: Schema definition
- `supabase/migrations/20260811000000_security_hardening.sql`: Constraints
- `supabase/migrations/20260811010000_security_advisor_fixes.sql`: Fixes

**Testing:**
- Not present (no test files found)

## Naming Conventions

**Files:**
- React components: `PascalCase.tsx` (e.g., `Board.tsx`, `CardItem.tsx`)
- Utilities/hooks: `camelCase.ts` (e.g., `position.ts`, `search.ts`)
- Server Actions: Grouped in `actions.ts`, named `*Action` (e.g., `createCardAction`)
- Query wrappers: Named functions without suffix (e.g., `createCard()`)
- Types: Defined in `types.ts`, named as `TypeName` (e.g., `Card`, `Column`)
- CSS files: `globals.css` (root), per-component inline Tailwind
- Migration files: `[timestamp]_[description].sql` (e.g., `20260728000000_init_schema.sql`)

**Directories:**
- React components: `components/` (with subdirs by domain: `kanban/`, `reports/`, `ui/`, `alerts/`)
- Business logic: `lib/` (with subdir `kanban/` for domain logic)
- Database: `supabase/migrations/` for versioned schema
- Client init: `lib/supabase/`
- Types: `lib/kanban/types.ts` (not a separate folder)

**Database:**
- Tables: `snake_case` (e.g., `public.cards`, `public.columns`)
- Columns: `snake_case` (e.g., `proprietario`, `periodo_fim`)
- Enums: `snake_case` (e.g., `alert_type`, `alert_status`)
- Indexes: `[table]_[column(s)]_idx` (e.g., `cards_column_id_idx`)
- Constraints: Implicit (PK, FK, CHECK defined inline in CREATE TABLE)

**Functions:**
- Server Actions: Verb + Noun + "Action" (e.g., `createCardAction`, `moveColumnAction`)
- Query wrappers: Verb + Noun (e.g., `createCard`, `moveColumn`)
- Helpers: Descriptive (e.g., `positionBetween`, `matchingIds`, `formatCurrency`)
- Validators: `validar` + Noun (Portuguese, e.g., `validarValor`, `validarData`)

## Where to Add New Code

**New Feature:**
- Page route: Create folder in `web/src/app/(app)/` with `page.tsx`
- Component: Add to `web/src/components/` in appropriate subdirectory (kanban, reports, etc)
- Server Action: Add function to `web/src/lib/kanban/actions.ts`
- Query wrapper: Add function to `web/src/lib/kanban/queries.ts`
- Type: Add to `web/src/lib/kanban/types.ts`
- Utility: Add to appropriate file in `web/src/lib/`

**New Database Table:**
- Create migration: `supabase/migrations/[timestamp]_[description].sql`
- Include: CREATE TABLE, indexes, RLS policies, triggers if needed
- Apply locally: `supabase db pull` or manual load in Supabase Studio
- Test: Restart local dev server or push to remote Supabase

**New Component:**
- Implementation: `web/src/components/[domain]/[ComponentName].tsx`
- Styling: Use Tailwind classes inline (no separate CSS)
- Imports: Use `@/` alias for absolute imports (configured in tsconfig.json)
- Client/Server: Mark with `"use client"` if interactive, omit if Server Component

**Utilities:**
- Shared helpers: `web/src/lib/utils.ts` (generic) or `web/src/lib/kanban/[domain].ts` (domain-specific)
- Format functions: `web/src/lib/kanban/format.ts`
- Validators: In `web/src/lib/kanban/actions.ts` (server-side only)

**Styling:**
- Global: `web/src/app/globals.css`
- Component-level: Tailwind class names in JSX (no CSS modules)
- Design tokens: `web/tailwind.config.ts` (colors, spacing, fonts)

## Special Directories

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (listed in .gitignore)
- Size: ~500MB+ (contains Next.js, React, Supabase SDK, etc)

**`.git/`:**
- Purpose: Git version control metadata
- Generated: Yes (by `git init` or `git clone`)
- Committed: N/A (metadata only)

**`supabase/.gitignore`:**
- Purpose: Ignore local Supabase dev database and volumes
- Contains: `node_modules`, local containers, CLI cache
- Never commit: `.supabase/`, `.env.local`

**`.planning/codebase/`:**
- Purpose: Architecture and structure documentation (you are reading this)
- Generated: Yes (by this mapping task)
- Committed: Yes (helps onboard contributors)

## Next.js 16 Specifics

**Middleware renamed to proxy:**
- Old: `middleware.ts` (Next.js ≤15)
- New: `proxy.ts` + `export config` (Next.js 16+)
- Change: See `web/src/proxy.ts`

**App Router (Not Pages Router):**
- Routes defined by folder structure under `app/`
- Layout nesting with layout.tsx files
- Server Components by default (use `"use client"` to opt into client)

**Server Actions:**
- Functions marked with `"use server"` directive
- Called from client components via form actions or event handlers
- Auto-serialized over HTTP POST by Next.js

**Next.js 16 Breaking Changes:**
- See `web/AGENTS.md` for notes on API changes and deprecations

---

*Structure analysis: 2026-08-14*
