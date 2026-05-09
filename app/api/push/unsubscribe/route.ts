import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export async function DELETE() {
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

  const { error } = await supabase
    .from('users')
    .update({ push_subscription: null })
    .eq('id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
