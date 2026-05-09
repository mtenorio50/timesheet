export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'employee' | 'admin' | 'super_admin';
  is_approved: boolean;
  pay_period_type: 'weekly' | 'fortnightly' | 'monthly';
  pay_period_anchor_date: string | null; // YYYY-MM-DD
  push_subscription: PushSubscriptionJSON | null;
  created_at: string;
}

export interface NotificationPref {
  id: string;
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
}

export interface Timesheet {
  id: string;
  user_id: string;
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  status: 'draft' | 'submitted' | 'approved';
  total_hours: number;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  timesheet_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  total_hours: number | null;
  notes: string | null;
  is_locked: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  timesheet_id: string | null;
  entry_id: string | null;
  admin_id: string | null;
  action: string;
  reason: string | null;
  notes: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  visible_to_employee: boolean;
  created_at: string;
}
