-- Royal Glass Timesheet — Security & Bug Fixes
-- Run after 001_initial_schema.sql and 002_pwa_updates.sql

-- ============================================================
-- C-1: Prevent privilege escalation on the users table
--
-- The old "users_update_own_safe_fields" policy had no column
-- restriction — any authenticated user could promote themselves
-- to super_admin or flip is_approved via the browser client.
-- We replace it with a trigger-based guard that only permits
-- employees to change push_subscription on their own row.
-- ============================================================

DROP POLICY IF EXISTS "users_update_own_safe_fields" ON public.users;

-- Employees may still UPDATE their own row (needed for push_subscription),
-- but the trigger below blocks changes to protected columns.
CREATE POLICY "users_update_own_push_subscription" ON public.users
  FOR UPDATE
  USING  (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Service-role calls (CRON, admin API using service key) have no JWT uid
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins and super_admins can change anything
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IN ('admin', 'super_admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admins: block changes to every column except push_subscription
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Employees cannot change their role';
  END IF;
  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved THEN
    RAISE EXCEPTION 'Employees cannot change their approval status';
  END IF;
  IF NEW.pay_period_type IS DISTINCT FROM OLD.pay_period_type THEN
    RAISE EXCEPTION 'Employees cannot change pay period settings';
  END IF;
  IF NEW.pay_period_anchor_date IS DISTINCT FROM OLD.pay_period_anchor_date THEN
    RAISE EXCEPTION 'Employees cannot change pay period settings';
  END IF;
  IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
    RAISE EXCEPTION 'Employees cannot change their name directly';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Employees cannot change their email here';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_updates ON public.users;
CREATE TRIGGER guard_user_updates
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_privilege_escalation();

-- ============================================================
-- CRIT-1: Prevent double clock-in
-- A user can only have one open time entry at a time.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS one_open_entry_per_user
  ON public.time_entries (user_id)
  WHERE clock_out IS NULL;

-- ============================================================
-- LOW-8: Restrict what status an employee can set on a timesheet
-- WITH CHECK forces the new status to be 'submitted' — employees
-- cannot reset a submitted sheet back to 'draft' via the client.
-- ============================================================

DROP POLICY IF EXISTS "timesheets_update_own_draft" ON public.timesheets;

CREATE POLICY "timesheets_update_own_draft" ON public.timesheets
  FOR UPDATE
  USING  (auth.uid() = user_id AND status = 'draft')
  WITH CHECK (auth.uid() = user_id AND status = 'submitted');

-- ============================================================
-- Explicit append-only locks on audit_log
-- (Default RLS blocks UPDATE/DELETE when no policy exists,
-- but explicit policies make the intent clear.)
-- ============================================================

DROP POLICY IF EXISTS "audit_no_update" ON public.audit_log;
DROP POLICY IF EXISTS "audit_no_delete" ON public.audit_log;

CREATE POLICY "audit_no_update" ON public.audit_log
  FOR UPDATE USING (false);

CREATE POLICY "audit_no_delete" ON public.audit_log
  FOR DELETE USING (false);

-- ============================================================
-- MED-7: Allow employees to insert their own audit records
-- The old "audit_insert_admin" policy blocked the submit route
-- (which runs as the employee) from writing an audit entry.
-- We add a separate policy for employee-originated actions.
-- ============================================================

DROP POLICY IF EXISTS "audit_insert_employee_submit" ON public.audit_log;

CREATE POLICY "audit_insert_employee_submit" ON public.audit_log
  FOR INSERT WITH CHECK (
    action = 'submitted'
    AND admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_id
        AND t.user_id = auth.uid()
    )
  );
