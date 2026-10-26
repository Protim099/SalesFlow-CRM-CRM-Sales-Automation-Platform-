# SalesFlow CRM

A full-stack CRM & sales-automation app for small and mid-size teams: leads, contacts & companies, a drag-and-drop pipeline, tasks & calendar, a rule-based automation engine, analytics with CSV export, roles & permissions, and multi-tenant data isolation.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Radix UI (shadcn-style components) · Lucide · Recharts · PostgreSQL + Prisma · Zod · React Hook Form · Nodemailer · Vitest · Playwright · Docker

## Quick start (local)

```bash
# 1. Install
npm install

# 2. Start PostgreSQL (or use your own)
docker compose up -d db

# 3. Configure
cp .env.example .env          # then set AUTH_SECRET:  openssl rand -base64 48

# 4. Create tables + demo data
npx prisma migrate deploy     # or: npm run db:migrate  (dev)
npm run db:seed

# 5. Run
npm run dev                   # http://localhost:3000
```

### Demo logins (password for all: `Password123!`)
| Role | Email |
|---|---|
| Admin | admin@salesflow.dev |
| Sales Manager | manager@salesflow.dev |
| Sales Rep | rep@salesflow.dev (also rep2@salesflow.dev) |

The login page shows one-click demo fills when `NODE_ENV` is not `production`.

## Run everything with Docker
```bash
export AUTH_SECRET=$(openssl rand -base64 48)
docker compose up --build -d          # app on :3000, migrations run on start
docker compose exec app npm run db:seed   # optional demo data
```
Without seeding, open `/register` to create your own workspace (you become Admin and get default stages/sources).

## Features
| Area | What's included |
|---|---|
| Dashboard | KPIs (leads, qualified, active deals, conversion, monthly revenue), target progress, revenue / pipeline / source charts, upcoming follow-ups, recent activity |
| Leads | CRUD, search, filters (status/priority/source/owner/archived), sorting, pagination, assign, qualify, archive/restore, convert-to-deal, **CSV import & export** |
| Contacts & companies | CRUD, tags, company links, associated deals, interaction history |
| Pipeline | Kanban with native drag-and-drop, stage totals, probability, expected close, owner, **required loss reason** when moving to a Lost stage |
| Tasks | Calls/meetings/emails/to-dos, due dates, in-app reminders, priorities, completion, **list + month calendar** |
| Communication | Log calls, meetings, emails and notes against leads, contacts, deals (merged timeline) |
| Automation | Visual rule builder (trigger → conditions → actions), round-robin assignment, create task, send email, set status, notify; execution history; failure handling with retry |
| Reports | Revenue won/lost by month, funnel, source conversion, team performance, loss reasons; CSV exports; 30d–1y range |
| Team & roles | Admin / Sales Manager / Sales Rep; add members, change roles, deactivate (last-admin guard) |
| Settings | Company profile & currency, monthly target, editable/reorderable stages, lead sources, notification preference, password change |
| UX | Collapsible sidebar, global search, notification center, user menu, light/dark mode, toasts, skeleton loading, empty/error states, confirmation dialogs |

## Roles
| Capability | Rep | Manager | Admin |
|---|:-:|:-:|:-:|
| Own leads / deals / tasks | ✅ | ✅ | ✅ |
| See & reassign all records | – | ✅ | ✅ |
| Delete records | – | ✅ | ✅ |
| Automation rules | – | ✅ | ✅ |
| Team-wide reports | – | ✅ | ✅ |
| Team, company settings, stages | – | – | ✅ |

## Security model
- **Auth:** bcrypt (cost 12) password hashes; signed JWT (HS256) in an `httpOnly`, `SameSite=Lax`, `Secure` (prod) cookie. Every request re-checks the membership in the DB, so role changes and deactivation take effect immediately.
- **Authorization is server-side** in every action/route (`requireSession`, `requirePermission`, `ownScope`). Hiding a button is never the only protection.
- **Tenant isolation:** every table carries `orgId`; every query filters by the session's org; related-record IDs submitted by clients are verified to belong to the org (`assertInOrg`).
- **CSRF:** server actions use Next.js's built-in Origin check; route handlers that mutate call `assertSameOrigin`; cookie is SameSite=Lax.
- **Validation:** Zod on every input, on the server. CSV import is size/row limited; CSV export neutralises spreadsheet-formula injection.
- **Rate limiting:** login, registration and import (in-memory; swap `src/lib/rate-limit.ts` for Redis if you run multiple instances).
- **Audit log:** create/update/delete/assign/import/export/login/role changes are written to `AuditLog`.
- **Safe errors:** unexpected errors are logged server-side; users get a generic message. Security headers set in `next.config.mjs`. Secrets live only in `.env`.

## Automation engine
Triggers: lead created · lead status changed · deal stage changed. Conditions are ANDed. Actions run in order.
- **No duplicates:** each (rule, event) is recorded with a unique key; the same event can never run a rule twice.
- **Failure isolation:** every action is wrapped; failures are stored per action and the run is marked FAILED.
- **Safe retry:** "Retry" re-runs only the actions that failed (max 3 attempts), never repeating successes.
- **No loops:** actions that change a lead don't re-fire triggers.
- Templates: `{{name}} {{status}} {{value}} {{owner}}`.

### Email
Set `SMTP_HOST/PORT/USER/PASS/EMAIL_FROM` for real delivery. **Without `SMTP_HOST`, development mode** prints each email to the server console (and the Automation page shows a banner).

### Reminders
Task reminders become in-app notifications when the app polls `/api/notifications` (every 60 s per open tab). For headless operation, schedule:
`curl -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/cron/reminders`

## Project layout
```
prisma/            schema.prisma, migrations/, seed.ts
src/app/           routes: (auth)/login|register, (app)/dashboard|leads|contacts|companies|pipeline|tasks|automation|reports|team|settings, api/*
src/actions/       server actions (mutations + authorization + audit)
src/lib/           auth, permissions, validators, automation engine, reports, csv, email, rate-limit
src/components/    ui/ primitives + feature components
tests/             Vitest unit tests      e2e/  Playwright specs
```

## Scripts
`npm run dev` · `build` · `start` · `typecheck` · `test` (unit) · `test:e2e` (needs running DB + seed) · `db:migrate` · `db:deploy` · `db:seed` · `db:reset`

## Deployment
1. Provision PostgreSQL 14+. Set `DATABASE_URL`, a strong `AUTH_SECRET`, `APP_URL`, SMTP vars, optional `CRON_SECRET`.
2. Build & run the Docker image (`docker build -t salesflow .`); the container applies migrations (`prisma migrate deploy`) then starts Next on :3000. Health check: `/api/health`.
3. Put it behind HTTPS (cookies are `Secure` in production) and a reverse proxy that sets `X-Forwarded-For`/`Host`.
4. Back up the database; run `/api/cron/reminders` every few minutes if you want reminders without open browser tabs.

## Notes & limits
- Monetary values are whole-number units in the organization's currency (no cents).
- Rate limiting and the login-attempt counter are per-process memory.
- Dates are stored in UTC; calendar/day boundaries use UTC.
- The initial SQL migration (`prisma/migrations/20260101000000_init`) matches `schema.prisma`; for future changes use `npx prisma migrate dev --name <change>`.
