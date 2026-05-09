import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_approved')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');
  if (!profile.is_approved) redirect('/pending');

  if (profile.role === 'admin' || profile.role === 'super_admin') {
    redirect('/admin');
  }

  redirect('/employee');
}
