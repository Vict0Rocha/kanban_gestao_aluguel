# External Integrations

**Analysis Date:** 2026-08-14

## APIs & External Services
**Backend-as-a-Service:**
- Supabase - Managed PostgreSQL database, authentication, real-time subscriptions, storage
  - SDK/Client: `@supabase/supabase-js` 2.111.0, `@supabase/ssr` 0.12.4
  - Auth: Email/password authentication (configured via Supabase Auth)
  - Real-time: Enabled for database subscriptions
  - Connection env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Captcha/Bot Protection:**
- None currently active (Turnstile was tested and removed - see git commits `cb36d50`, `4f0bbde`, `b905875` for history)

**Analytics:**
- None detected in dependencies

**Monitoring & Observability:**
- None configured

## Data Storage
**Databases:**
- PostgreSQL 17 (Supabase managed)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Client: `@supabase/supabase-js` (TypeScript/JavaScript)
  - Access: Row-Level Security (RLS) policies enforce authorization
  - Schema tables: `profiles`, `boards`, `columns`, `cards`

**File Storage:**
- Supabase Storage (S3-compatible, enabled locally and in production)
  - File size limit: 50MiB default
  - Buckets: Not explicitly configured in this project yet

**Caching:**
- None explicitly configured

## Authentication & Identity
**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: Email/password authentication
  - JWT tokens with 1-hour expiry (configurable)
  - Refresh token rotation enabled
  - Session management via HTTP-only cookies (SameSite=Lax)
  - Signup disabled in config (controlled via Supabase project settings)
  - No multi-factor authentication configured
  - No social OAuth providers configured

**Session Management:**
- Cookie-based via `@supabase/ssr` middleware
- Server-side session validation on every request (proxy.ts)
- Client-side session available via Supabase client instance

## Monitoring & Observability
**Error Tracking:**
- None detected

**Logs:**
- Local development: Supabase Studio UI available at http://127.0.0.1:54323
- Production: Depends on deployment platform (Vercel logs, etc.)

**Analytics:**
- Supabase Analytics (enabled in config.toml, backend: PostgreSQL)
- No application-level analytics configured

## CI/CD & Deployment
**Hosting:**
- Not explicitly configured; supports any Node.js host
- Recommended: Vercel (Next.js native), but compatible with self-hosted Node.js, Docker, etc.

**CI Pipeline:**
- Not configured in repository (no .github/workflows/, gitlab-ci.yml, etc.)

## Environment Configuration
**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase API endpoint (public, safe in browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous/public API key (public, safe in browser)

**Optional env vars:**
- `OPENAI_API_KEY` - For Supabase AI features in Studio (development only)

**Secrets location:**
- `.env.local` - Local development secrets (git-ignored)
- `.env.example` - Template for environment variables (safe to commit)
- Production: Environment variables set in deployment platform (Vercel, etc.)

## Webhooks & Callbacks
**Incoming:**
- None detected

**Outgoing:**
- None detected
- Supabase Auth has built-in email hooks (for password reset, confirmations, etc.) but not explicitly configured

## Security Headers & Policies
**Content Security Policy:**
- `frame-ancestors 'none'` - Prevents clickjacking attacks
- No inline script CSP (allows Next.js to inject scripts without nonce complications)

**Additional Security Headers:**
- `X-Frame-Options: DENY` - No framing allowed
- `X-Content-Type-Options: nosniff` - Prevents MIME-type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()` - Disables unused APIs

## Development Tools
**Local Email Testing:**
- Supabase local SMTP server at http://127.0.0.1:54324 (in-process email capture)

**Local API Endpoints:**
- Supabase API: http://127.0.0.1:54321
- Database: localhost:54322
- Studio (GUI): http://127.0.0.1:54323

---

*Integration audit: 2026-08-14*
