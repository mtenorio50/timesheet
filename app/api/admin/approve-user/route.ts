export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from('users')
    .select('role, is_approved')
    .eq('id', user.id)
    .single();

  if (!adminProfile?.is_approved || !['admin', 'super_admin'].includes(adminProfile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  // Prevent self-approval
  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot approve your own account' }, { status: 400 });
  }

  const serviceSupabase = createServiceClient();

  const { data: target } = await serviceSupabase
    .from('users')
    .select('id, email, is_approved')
    .eq('id', userId)
    .single();

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (target.is_approved) return NextResponse.json({ error: 'User already approved' }, { status: 409 });

  const { error } = await serviceSupabase
    .from('users')
    .update({ is_approved: true })
    .eq('id', userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await serviceSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'user_approved',
    notes: `Approved user ${target.email}`,
    visible_to_employee: false,
  });

  return NextResponse.json({ success: true });
}
