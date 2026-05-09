'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase-client';
import EditEntryModal from '@/components/EditEntryModal';
import { formatDate, formatHours, formatTime } from '@/lib/constants';
import type { TimeEntry, Timesheet, User } from '@/lib/types';

export default function AdminEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const { profile: adminProfile, loading: authLoading } = useAuth();
  const [employee, setEmployee] = useState<User | null>(null);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (!authLoading && adminProfile) {
      if (adminProfile.role === 'employee') router.replace('/employee');
      else load();
    }
  }, [authLoading, adminProfile]);

  async function load() {
    const supabase = createClient();

    const { data: emp } = await supabase
      .from('users')
      .select('*')
      .eq('id', employeeId)
      .single();
    setEmployee(emp as User | null);

    const { data: ts } = await supabase
      .from('timesheets')
      .select('*')
      .eq('user_id', employeeId)
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    setTimesheet(ts as Timesheet | null);

    if (ts) {
      const { data: entryRows } = await supabase
        .from('time_entries')
        .select('*')
        .eq('timesheet_id', ts.id)
        .order('clock_in', { ascending: true });
      setEntries((entryRows ?? []) as TimeEntry[]);
    }

    setLoading(false);
  }

  async function handleApprove() {
    if (!timesheet) return;
    setApproving(true);
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timesheetId: timesheet.id }),
    });
    setApproving(false);
    if (res.ok) {
      setTimesheet((prev) => prev ? { ...prev, status: 'approved' } : prev);
    }
  }

  function handleEntrySaved(updated: TimeEntry) {
    setEntries((prev) => prev.map((e) => e.id === updated.id ? updated : e));
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          ‹ Back
        </button>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">
            {employee?.full_name ?? employee?.email ?? 'Employee'}
          </h1>
          <p className="text-xs text-gray-500">{employee?.email}</p>
        </div>
      </div>

      {/* Employee info */}
      {employee && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500">Pay period</p>
              <p className="font-medium capitalize">{employee.pay_period_type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Anchor date</p>
              <p className="font-medium">{employee.pay_period_anchor_date ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Current timesheet */}
      {timesheet ? (
        <>
          <div className="mb-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Period</p>
                <p className="text-sm font-medium">
                  {formatDate(timesheet.period_start)} – {formatDate(timesheet.period_end)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold">{formatHours(timesheet.total_hours)}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                  timesheet.status === 'submitted'
                    ? 'bg-amber-100 text-amber-700'
                    : timesheet.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {timesheet.status}
              </span>
              {timesheet.status === 'submitted' && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {approving ? 'Approving…' : 'Approve'}
                </button>
              )}
            </div>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {entries.length === 0 ? (
              <div className="rounded-xl bg-white p-6 text-center border border-gray-100">
                <p className="text-sm text-gray-400">No entries this period</p>
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl bg-white p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        {formatDate(entry.clock_in)}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-900">
                        {formatTime(entry.clock_in)} – {formatTime(entry.clock_out)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatHours(entry.total_hours)}</span>
                      <button
                        onClick={() => setEditingEntry(entry)}
                        className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                  {entry.is_locked && (
                    <p className="mt-1 text-xs text-gray-400">🔒 Locked</p>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl bg-white p-6 text-center border border-gray-100">
          <p className="text-sm text-gray-400">No timesheet found for this employee</p>
        </div>
      )}

      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={handleEntrySaved}
        />
      )}
    </div>
  );
}
