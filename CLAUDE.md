# Royal Glass Timesheet App — Claude Context

## What This Is

A PWA timesheet app for Royal Glass (NZ). Employees clock in/out on their phones, submit timesheets at period end, and admins review/approve. Built with Next.js 14 (App Router) + Supabase + Web Push notifications.

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Supabase (PostgreSQL + Auth + RLS)
- Tailwind CSS v3
- `web-push` npm package (Web Push API for browser notifications)
- `@supabase/ssr` for Next.js cookie-based auth

## Roles

- `employee` — can clock in/out and submit their own timesheets
- `admin` — can view all employees, edit entries, approve timesheets
- `super_admin` — same as admin + can promote/demote admins

First super_admin must be set manually via SQL after signing up:
```sql
UPDATE users SET role = 'super_admin', is_approved = true WHERE email = 'your@email.com';
```

## Pay Period Logic

- Pay period type (`weekly` / `fortnightly` / `monthly`) and `pay_period_anchor_date` are set per employee by admin.
- `getCurrentPeriod()` in `lib/constants.ts` calculates the current period start/end from those two values.
- **Do not calculate `total_hours` in JavaScript** — a DB trigger does it automatically on clock-out.

## Environment Setup

1. Copy `.env.example` to `.env.local` and fill in all values.
2. Generate VAPID keys **once**:
   ```bash
   npx web-push generate-vapid-keys
   ```
   Copy output to `.env.local`. Never regenerate — breaks existing push subscriptions.

## Database Migrations

Run in Supabase SQL Editor in order:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_pwa_updates.sql`

Also enable the `pg_net` extension in Supabase Dashboard → Extensions (required for cron HTTP calls).

## Setting Up the Reminder Cron (Supabase pg_cron)

Run this SQL in Supabase after deploying to Vercel:

```sql
-- Enable pg_cron extension first (Dashboard → Extensions → pg_cron)

-- T-1 day reminder (9am NZT = 8pm UTC previous day)
SELECT cron.schedule(
  'timesheet-reminder-day-before',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/notify/reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{"days_before": 1}'::jsonb
  );
  $$
);

-- Day-of reminder
SELECT cron.schedule(
  'timesheet-reminder-day-of',
  '0 20 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-app.vercel.app/api/notify/reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_CRON_SECRET"}'::jsonb,
    body := '{"days_before": 0}'::jsonb
  );
  $$
);
```

## Key Architectural Notes

- `middleware.ts` uses `createServerClient` directly (not from `lib/supabase-server.ts`) because it needs the NextRequest/NextResponse cookie API.
- API routes that use `web-push` must have `export const runtime = 'nodejs'` at the top.
- `lib/supabase-server.ts` must never be imported in Client Components — it imports `next/headers`.
- `createServiceClient()` in `lib/supabase-server.ts` bypasses RLS. Only use in API routes (cron, admin operations).
- The DB trigger `calculate_entry_hours` only fires when `clock_out` changes from NULL to non-NULL. Admin edits to existing clock_out values must manually recalculate `total_hours` in the API route.
- `app/manifest.ts` is served at `/manifest.webmanifest` (not `/manifest.json`).

## Local Development

```bash
npm install
npm run dev
```

Push notifications only work on HTTPS. For local testing, deploy to Vercel first.

## Deploy to Vercel

```bash
npx vercel deploy
```

Set all env vars from `.env.example` in Vercel dashboard before deploying.

## TODO (Not Yet Built)

- [ ] Resend email notifications (TODO comment in `/api/notify/reminders/route.ts`)
- [ ] Payroll CSV export for admin
- [ ] Offline clock-in (IndexedDB + background sync)
