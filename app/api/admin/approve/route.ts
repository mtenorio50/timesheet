export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { timesheetId } = await request.json();
  if (!timesheetId) return NextResponse.json({ error: 'timesheetId required' }, { status: 400 });

  const { data: updated, error } = await supabase
    .from('timesheets')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq('id', timesheetId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('audit_log').insert({
    timesheet_id: timesheetId,
    admin_id: user.id,
    action: 'approved',
    visible_to_employee: true,
  });

  return NextResponse.json({ timesheet: updated });
}
