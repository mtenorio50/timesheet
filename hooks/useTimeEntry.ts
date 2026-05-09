'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import type { TimeEntry } from '@/lib/types';

interface UseTimeEntryReturn {
  activeEntry: TimeEntry | null;
  todayEntries: TimeEntry[];
  todayTotalHours: number;
  elapsedSeconds: number;
  isLoading: boolean;
  clockIn: (timesheetId: string, userId: string) => Promise<void>;
  clockOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTimeEntry(): UseTimeEntryReturn {
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const [todayTotalHours, setTodayTotalHours] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: entries } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('clock_in', todayStart.toISOString())
      .order('clock_in', { ascending: false });

    const list = (entries ?? []) as TimeEntry[];
    setTodayEntries(list);

    const open = list.find((e) => e.clock_out === null) ?? null;
    setActiveEntry(open);

    const total = list.reduce((sum, e) => sum + (e.total_hours ?? 0), 0);
    setTodayTotalHours(Math.round(total * 100) / 100);

    if (open) {
      const elapsed = Math.floor(
        (Date.now() - new Date(open.clock_in).getTime()) / 1000,
      );
      setElapsedSeconds(elapsed);
    } else {
      setElapsedSeconds(0);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live elapsed ticker — only runs when clocked in
  useEffect(() => {
    if (!activeEntry) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.id]);

  async function clockIn(timesheetId: string, userId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from('time_entries')
      .insert({ timesheet_id: timesheetId, user_id: userId, clock_in: new Date().toISOString() })
      .select()
      .single();
    if (data) {
      setActiveEntry(data as TimeEntry);
      setElapsedSeconds(0);
    }
  }

  async function clockOut() {
    if (!activeEntry) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('time_entries')
      .update({ clock_out: new Date().toISOString() })
      .eq('id', activeEntry.id)
      .select()
      .single();
    if (data) {
      await load();
    }
  }

  return {
    activeEntry,
    todayEntries,
    todayTotalHours,
    elapsedSeconds,
    isLoading,
    clockIn,
    clockOut,
    refresh: load,
  };
}
