-- Royal Glass Timesheet App — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin', 'super_admin')),
  is_approved BOOLEAN NOT NULL DEFAULT false,
  pay_period_type TEXT NOT NULL DEFAULT 'fortnightly' CHECK (pay_period_type IN ('weekly', 'fortnightly', 'monthly')),
  pay_period_anchor_date DATE,
  push_subscription JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  total_hours NUMERIC(6, 2) NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, period_start)
);

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES public.timesheets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  total_hours NUMERIC(6, 2),
  notes TEXT,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID REFERENCES public.timesheets(id),
  entry_id UUID REFERENCES public.time_entries(id),
  admin_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  reason TEXT,
  notes TEXT,
  before_data JSONB,
  after_data JSONB,
  visible_to_employee BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-insert into public.users when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'employee',
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_auth_user();

-- Auto-calculate total_hours when an entry is clocked out
CREATE OR REPLACE FUNCTION public.calculate_entry_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL THEN
    NEW.total_hours := ROUND(
      EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600.0,
      2
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_clock_out ON public.time_entries;
CREATE TRIGGER on_clock_out
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.calculate_entry_hours();

-- Keep timesheet.total_hours in sync when a time_entry changes
CREATE OR REPLACE FUNCTION public.sync_timesheet_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.timesheets
  SET total_hours = (
    SELECT COALESCE(SUM(total_hours), 0)
    FROM public.time_entries
    WHERE timesheet_id = COALESCE(NEW.timesheet_id, OLD.timesheet_id)
      AND total_hours IS NOT NULL
  )
  WHERE id = COALESCE(NEW.timesheet_id, OLD.timesheet_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_entry_hours_change ON public.time_entries;
CREATE TRIGGER on_entry_hours_change
  AFTER INSERT OR UPDATE OR DELETE ON public.time_entries
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_timesheet_hours();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- users policies
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "users_update_own_safe_fields" ON public.users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_admin" ON public.users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

-- notification_prefs policies
CREATE POLICY "notif_prefs_own" ON public.notification_prefs
  FOR ALL USING (auth.uid() = user_id);

-- timesheets policies
CREATE POLICY "timesheets_select_own" ON public.timesheets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "timesheets_insert_own" ON public.timesheets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timesheets_update_own_draft" ON public.timesheets
  FOR UPDATE USING (auth.uid() = user_id AND status = 'draft')
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "timesheets_select_admin" ON public.timesheets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "timesheets_update_admin" ON public.timesheets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

-- time_entries policies
CREATE POLICY "entries_select_own" ON public.time_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "entries_insert_own_unlocked" ON public.time_entries
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_id
        AND t.user_id = auth.uid()
        AND t.status = 'draft'
    )
  );

CREATE POLICY "entries_update_own_unlocked" ON public.time_entries
  FOR UPDATE USING (auth.uid() = user_id AND is_locked = false)
  WITH CHECK (auth.uid() = user_id AND is_locked = false);

CREATE POLICY "entries_select_admin" ON public.time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "entries_update_admin" ON public.time_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

-- audit_log policies (append-only — no UPDATE or DELETE ever)
CREATE POLICY "audit_select_own_visible" ON public.audit_log
  FOR SELECT USING (
    visible_to_employee = true
    AND EXISTS (
      SELECT 1 FROM public.timesheets t
      WHERE t.id = timesheet_id
        AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "audit_select_admin" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "audit_insert_admin" ON public.audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'super_admin')
    )
  );
