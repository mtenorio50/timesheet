'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useTimesheet } from '@/hooks/useTimesheet';
import { formatDate, formatHours, formatTime } from '@/lib/constants';

export default function TimesheetPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const { timesheet, entries, isLoading, canSubmit, submitTimesheet } = useTimesheet(profile);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    const { error: err } = await submitTimesheet();
    setSubmitting(false);
    setConfirming(false);
    if (err) setError(err);
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
          ‹ Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Timesheet</h1>
      </div>

      {/* Period info */}
      {timesheet && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Pay period</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">
                {formatDate(timesheet.period_start)} – {formatDate(timesheet.period_end)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="mt-0.5 text-lg font-bold text-gray-900">
                {formatHours(timesheet.total_hours)}
              </p>
            </div>
          </div>
          <div className="mt-2">
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
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="mb-4 space-y-2">
        {entries.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm border border-gray-100">
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
                  {entry.is_locked && (
                    <span className="text-xs text-gray-400" title="Locked by admin">
                      🔒
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900">
                    {formatHours(entry.total_hours)}
                  </span>
                </div>
              </div>
              {entry.notes && (
                <p className="mt-1 text-xs text-gray-400">{entry.notes}</p>
              )}
            </div>
          ))
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {/* Submit */}
      {timesheet?.status === 'draft' && (
        <>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={!canSubmit}
              className="w-full rounded-xl bg-[#1e3a5f] py-3.5 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-40"
            >
              {canSubmit ? 'Submit Timesheet' : 'Cannot submit yet'}
            </button>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="mb-3 text-sm font-medium text-amber-900">
                Submit this timesheet for approval? You won&apos;t be able to make changes after submitting.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#1e3a5f] py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}
          {!canSubmit && entries.length > 0 && (
            <p className="mt-2 text-center text-xs text-gray-400">
              {entries.some((e) => e.clock_out === null)
                ? 'Clock out before submitting'
                : 'Add entries before submitting'}
            </p>
          )}
        </>
      )}

      {timesheet?.status === 'submitted' && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-sm font-medium text-amber-800">Submitted — awaiting admin approval</p>
        </div>
      )}

      {timesheet?.status === 'approved' && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-sm font-medium text-green-800">Approved by admin</p>
        </div>
      )}
    </div>
  );
}
