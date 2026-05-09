export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { ADMIN_EDIT_REASONS } from '@/lib/constants';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Server-side role check — never trust client-side role
  const { data: adminProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!adminProfile || !['admin', 'super_admin'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { entryId, clockIn, clockOut, reason, notes, visibleToEmployee } = await request.json();

  if (!entryId) return NextResponse.json({ error: 'entryId required' }, { status: 400 });
  if (!reason || !(ADMIN_EDIT_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: 'Valid reason required' }, { status: 400 });
  }

  // Fetch current entry for before_data
  const { data: existingEntry } = await supabase
    .from('time_entries')
    .select('*')
    .eq('id', entryId)
    .single();

  if (!existingEntry) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  // Build update payload
  const updates: Record<string, unknown> = {};
  if (clockIn) updates.clock_in = clockIn;
  if (clockOut !== undefined) updates.clock_out = clockOut;

  // Manually recalculate total_hours — the DB trigger only fires on NULL→non-NULL clock_out
  if (updates.clock_in || updates.clock_out) {
    const newClockIn = new Date((updates.clock_in as string) ?? existingEntry.clock_in);
    const newClockOut = updates.clock_out
      ? new Date(updates.clock_out as string)
      : existingEntry.clock_out
        ? new Date(existingEntry.clock_out)
        : null;

    if (newClockOut) {
      const hours = (newClockOut.getTime() - newClockIn.getTime()) / (1000 * 60 * 60);
      if (hours < 0) {
        return NextResponse.json({ error: 'clock_out must be after clock_in' }, { status: 422 });
      }
      updates.total_hours = Math.round(hours * 100) / 100;
    }
  }

  const { data: updatedEntry, error: updateError } = await supabase
    .from('time_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // Write audit log
  await supabase.from('audit_log').insert({
    timesheet_id: existingEntry.timesheet_id,
    entry_id: entryId,
    admin_id: user.id,
    action: 'edited',
    reason,
    notes: notes ?? null,
    before_data: existingEntry,
    after_data: updatedEntry,
    visible_to_employee: visibleToEmployee ?? true,
  });

  return NextResponse.json({ entry: updatedEntry });
}
