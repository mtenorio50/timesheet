export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('is_approved')
    .eq('id', user.id)
    .single();

  if (!profile?.is_approved) {
    return NextResponse.json({ error: 'Account pending approval' }, { status: 403 });
  }

  const { timesheetId } = await request.json();
  if (!timesheetId) return NextResponse.json({ error: 'timesheetId required' }, { status: 400 });

  // Verify ownership and draft status
  const { data: timesheet } = await supabase
    .from('timesheets')
    .select('id, user_id, status')
    .eq('id', timesheetId)
    .single();

  if (!timesheet) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
  if (timesheet.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (timesheet.status !== 'draft') return NextResponse.json({ error: 'Timesheet already submitted' }, { status: 409 });

  // Lock all entries
  const { error: lockError } = await supabase
    .from('time_entries')
    .update({ is_locked: true })
    .eq('timesheet_id', timesheetId)
    .eq('user_id', user.id);

  if (lockError) return NextResponse.json({ error: lockError.message }, { status: 500 });

  // Submit timesheet
  const { data: updated, error: submitError } = await supabase
    .from('timesheets')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', timesheetId)
    .select()
    .single();

  if (submitError) return NextResponse.json({ error: submitError.message }, { status: 500 });

  // Write audit log using service client — the employee's session is blocked
  // by the audit_insert_admin RLS policy (see migration 003 for the fix)
  const serviceSupabase = createServiceClient();
  await serviceSupabase.from('audit_log').insert({
    timesheet_id: timesheetId,
    admin_id: user.id,
    action: 'submitted',
    visible_to_employee: true,
  });

  return NextResponse.json({ timesheet: updated });
}
