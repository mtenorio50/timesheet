# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A PWA timesheet app for Royal Glass (NZ). Employees clock in/out on their phones, submit timesheets at period end, and admins review/approve. Built with Next.js 14 (App Router) + Supabase + Web Push notifications.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint via next lint
```

No test suite is configured.

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS v3
- `web-push` npm package (Web Push API for browser notifications)
- `@supabase/ssr` for Next.js cookie-based auth

## Routing Architecture

```
app/
  page.tsx              — Server Component: reads role → redirects to /admin or /employee
  layout.tsx            — Registers service worker globally
  login/                — Public (in middleware matcher exclusion)
  register/             — Public; new users land on /pending until approved
  pending/              — Public
  employee/
    page.tsx            — Clock in/out dashboard (Client Component)
    timesheet/page.tsx  — View entries, submit timesheet (Client Component)
  admin/
    page.tsx            — Employee list, pending approvals (Client Component)
    employee/[id]/      — Per-employee timesheet view + edit entries (Client Component)
api/
  admin/approve/        — POST: approve user account
  admin/edit-entry/     — POST: edit time entry + write audit log
  admin/users/          — GET: fetch all users (admin-only)
  timesheet/submit/     — POST: set timesheet status to 'submitted'
  push/subscribe/       — POST: save Web Push subscription to users.push_subscription
  push/unsubscribe/     — POST: clear push_subscription
  notify/reminders/     — POST: cron endpoint; sends push to employees whose timesheet is due
```

`middleware.ts` protects all routes except `/login`, `/register`, `/pending`, and Next.js static assets. It uses `supabase.auth.getUser()` (not `getSession()`) for server-side token validation.

## Supabase Client Patterns

Two server-side helpers in `lib/supabase-server.ts`:
- `createClient()` — uses `next/headers` cookies; for Server Components and API routes that respect RLS.
- `createServiceClient()` — uses service role key; bypasses RLS. Only use in cron/admin API routes.

One client-side helper in `lib/supabase-client.ts`:
- `createClient()` — browser client using anon key; used in all hooks and Client Components.

`lib/supabase-server.ts` imports `next/headers` and **must never be imported in Client Components**.

## Roles

- `employee` — clock in/out and submit their own timesheets
- `admin` — view all employees, edit entries, approve timesheets
- `super_admin` — same as admin + can promote/demote admins

All API routes re-check role server-side by querying the `users` table — never trust a client-supplied role. First super_admin must be set manually:

```sql
UPDATE users SET role = 'super_admin', is_approved = true WHERE email = 'your@email.com';
```

## Pay Period Logic

- `pay_period_type` (`weekly` / `fortnightly` / `monthly`) and `pay_period_anchor_date` are set per employee by admin.
- `getCurrentPeriod()` in `lib/constants.ts` calculates the current period start/end from those two values.
- **Do not calculate `total_hours` in JavaScript** — the DB trigger `calculate_entry_hours` does it automatically when `clock_out` changes from NULL to non-NULL. For admin edits to existing `clock_out` values, recalculate `total_hours` manually in the API route (see `api/admin/edit-entry/route.ts`).

## Hooks Architecture

All Client Components delegate data fetching to hooks in `hooks/`:

- `useAuth` — loads the current user's `users` row (profile) on mount; listens to `onAuthStateChange`.
- `useTimesheet(profile)` — upserts the timesheet for the current pay period on mount; exposes `submitTimesheet()`.
- `useTimeEntry()` — loads today's entries; exposes `clockIn()` / `clockOut()` and a 1-second ticker for elapsed time.
- `usePushNotifications()` — manages browser push subscription state; calls `/api/push/subscribe`.

## API Routes That Use web-push

Must include `export const runtime = 'nodejs'` at the top. The `web-push` package is Node-only and will fail in the Edge runtime.

## Push / Cron Setup

VAPID keys must be generated **once** (`npx web-push generate-vapid-keys`) and never regenerated — doing so invalidates all existing push subscriptions.

Reminder cron runs via Supabase `pg_cron` → `pg_net` HTTP POST to `/api/notify/reminders`. Requires `pg_net` extension enabled in Supabase Dashboard. The endpoint is protected by `CRON_SECRET` in the `Authorization` header.

## Environment Setup

1. Copy `.env.example` to `.env.local` and fill in all values.
2. Generate VAPID keys once (see above).

Required env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

## Database Migrations

Run in Supabase SQL Editor in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_pwa_updates.sql`

Also enable `pg_net` extension (Dashboard → Extensions).

## Setting Up the Reminder Cron

```sql
-- Enable pg_cron first (Dashboard → Extensions → pg_cron)

SELECT cron.schedule(
  'timesheet-reminder-day-before',
  '0 20 * * *',
  $$SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/notify/reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{"days_before": 1}'::jsonb
  );$$
);

SELECT cron.schedule(
  'timesheet-reminder-day-of',
  '0 20 * * *',
  $$SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/notify/reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{"days_before": 0}'::jsonb
  );$$
);
```

Times are 8pm UTC = 9am NZT.

## Deploy

```bash
npx vercel deploy
```

Push notifications require HTTPS — test against a Vercel deployment, not localhost.

## TODO (Not Yet Built)

- [ ] Resend email notifications (`/api/notify/reminders/route.ts` has a TODO comment)
- [ ] Payroll CSV export for admin
- [ ] Offline clock-in (IndexedDB + background sync)
