'use client';

import { useEffect, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import type { User } from '@/lib/types';

interface AuthState {
  supabaseUser: SupabaseUser | null;
  profile: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    supabaseUser: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    const supabase = createClient();

    async function loadProfile(supabaseUser: SupabaseUser | null) {
      if (!supabaseUser) {
        setState({ supabaseUser: null, profile: null, loading: false });
        return;
      }
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      setState({ supabaseUser, profile: profile as User | null, loading: false });
    }

    supabase.auth.getUser().then(({ data: { user } }) => loadProfile(user));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        loadProfile(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  return { ...state, signOut };
}
