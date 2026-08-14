# Technology Stack

**Analysis Date:** 2026-08-14

## Languages
**Primary:**
- TypeScript 5 - Full codebase (frontend and server logic)
- SQL - Database schema and migrations (PostgreSQL)

## Runtime
**Environment:**
- Node.js (v20+, inferred from Next.js 16.3.0 requirement)

**Package Manager:**
- npm
- Lockfile: present

## Frameworks
**Core:**
- Next.js 16.3.0 - Full-stack React framework, SSR/API routes, Server Actions
- React 19.2.4 - UI component library

**UI & Styling:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind
- Base UI React 1.6.0 - Headless UI components (unstyled accessible components)
- shadcn 4.16.0 - Component library built on top of Base UI
- lucide-react 1.27.0 - Icon library

**Drag & Drop:**
- @dnd-kit/core 6.3.1 - Headless drag-and-drop library
- @dnd-kit/sortable 10.0.0 - Sortable preset for dnd-kit
- @dnd-kit/utilities 3.2.2 - Utilities for dnd-kit

**Typography & Animation:**
- tw-animate-css 1.4.0 - CSS animations for Tailwind
- class-variance-authority 0.7.1 - Type-safe component variants
- tailwind-merge 3.6.0 - Merge Tailwind CSS classnames

**Testing:**
- Not configured in current package.json

**Build/Dev:**
- TypeScript compiler (via tsc)
- ESLint 9 with Next.js config (eslint-config-next 16.2.12)
- Next.js built-in dev server and build tooling

## Key Dependencies
**Critical:**
- @supabase/ssr 0.12.4 - Server-side authentication context for Next.js 16+
- @supabase/supabase-js 2.111.0 - JavaScript client for Supabase API (auth, database, real-time)

**Infrastructure:**
- next 16.3.0 - React framework with App Router, Server Components, Server Actions
- react-dom 19.2.4 - React DOM rendering

## Configuration
**Environment:**
- Environment variables in `.env.local` (local development)
- `.env.example` present for reference
- Runtime config via `process.env.NEXT_PUBLIC_SUPABASE_*` in browser context
- Build-time configuration via `next.config.ts`

**Build:**
- `tsconfig.json` - TypeScript configuration with path alias `@/*` → `./src/*`
- `next.config.ts` - Security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)
- `supabase/config.toml` - Supabase local development environment configuration
  - PostgreSQL 17 database engine
  - Auth enabled with email/password signup disabled (allow new signups configurable)
  - Real-time subscriptions enabled
  - Storage enabled (50MiB default limit)
  - Analytics enabled
  - Edge Functions (Deno v2)

## Database
**Schema:**
- PostgreSQL 17 (via Supabase)
- Migrations in `supabase/migrations/` directory:
  - `20260728000000_init_schema.sql` - Initial schema (profiles, boards, columns, cards)
  - `20260811000000_security_hardening.sql` - RLS policies and security constraints
  - `20260811010000_security_advisor_fixes.sql` - Security Advisor recommendations
- Tables: `profiles`, `boards`, `columns`, `cards` with RLS policies

## Platform Requirements
**Development:**
- Node.js (v20+ inferred)
- npm or pnpm
- Supabase CLI for local database (optional, for `supabase start`)
- PostgreSQL 17 driver/client (provided by Supabase local setup)

**Production:**
- Node.js runtime environment (Vercel recommended, but any Node.js host works)
- Remote Supabase project connection via environment variables
- Supports Vercel, self-hosted Node.js, containers (Docker-ready)

---

*Stack analysis: 2026-08-14*
