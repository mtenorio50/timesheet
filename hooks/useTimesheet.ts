'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { getCurrentPeriod, toDateString } from '@/lib/constants';
import type { TimeEntry, Timesheet, User } from '@/lib/types';

interface UseTimesheetReturn {
  timesheet: Timesheet | null;
  entries: TimeEntry[];
  isLoading: boolean;
  canSubmit: boolean;
  submitTimesheet: () => Promise<{ error?: string }>;
  refresh: () => Promise<void>;
}

export function useTimesheet(profile: User | null): UseTimesheetReturn {
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();

    const { start, end } = getCurrentPeriod(
      profile.pay_period_anchor_date,
      profile.pay_period_type,
    );
    const periodStart = toDateString(start);
    const periodEnd = toDateString(end);

    // Try to find existing timesheet for this period
    const { data: existing } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', profile.id)
      .eq('period_start', periodStart)
      .maybeSingle();

    let ts: Timesheet | null = existing as Timesheet | null;

    if (!ts) {
      // Insert; if a concurrent tab wins the race, the unique constraint fires
      // and we fall back to a re-fetch of the winning row.
      const { data: created, error: insertErr } = await supabase
        .from('timesheets')
        .insert({ user_id: profile.id, period_start: periodStart, period_end: periodEnd })
        .select()
        .single();

      if (insertErr) {
        // Unique constraint violation (23505) — another tab inserted first
        const { data: winner } = await supabase
          .from('timesheets')
          .select('*')
          .eq('user_id', profile.id)
          .eq('period_start', periodStart)
          .single();
        ts = winner as Timesheet | null;
      } else {
        ts = created as Timesheet | null;
      }
    }

    setTimesheet(ts);

    if (ts) {
      const { data: entryRows } = await supabase
        .from('time_entries')
        .select('*')
        .eq('timesheet_id', ts.id)
        .order('clock_in', { ascending: true });
      setEntries((entryRows ?? []) as TimeEntry[]);
    }

    setIsLoading(false);
  }, [profile?.id, profile?.pay_period_type, profile?.pay_period_anchor_date]);

  useEffect(() => {
    load();
  }, [load]);

  // canSubmit: draft, has entries, no open clock-ins
  const canSubmit =
    !!timesheet &&
    timesheet.status === 'draft' &&
    entries.length > 0 &&
    !entries.some((e) => e.clock_out === null);

  async function submitTimesheet(): Promise<{ error?: string }> {
    if (!timesheet) return { error: 'No timesheet found' };
    const res = await fetch('/api/timesheet/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timesheetId: timesheet.id }),
    });
    if (!res.ok) {
      const body = await res.json();
      return { error: body.error ?? 'Submission failed' };
    }
    await load();
    return {};
  }

  return { timesheet, entries, isLoading, canSubmit, submitTimesheet, refresh: load };
}
