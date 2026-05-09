-- Royal Glass Timesheet App — PWA Updates
-- Run AFTER 001_initial_schema.sql

-- ============================================================
-- get_reminder_targets() — called by the daily cron job
-- Returns users whose current period ends in `days_before` days
-- and who have push subscriptions set up.
-- Uses SECURITY DEFINER to bypass RLS (needed for cron service role context).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_reminder_targets(days_before INT DEFAULT 1)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  push_subscription JSONB,
  period_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.full_name,
    u.push_subscription,
    t.period_end
  FROM public.timesheets t
  JOIN public.users u ON u.id = t.user_id
  WHERE
    t.status = 'draft'
    AND t.period_end = (CURRENT_DATE + days_before * INTERVAL '1 day')::DATE
    AND u.push_subscription IS NOT NULL
    AND u.is_approved = true;
END;
$$;
