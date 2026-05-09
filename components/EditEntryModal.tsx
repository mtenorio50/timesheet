'use client';

import { useState } from 'react';
import { ADMIN_EDIT_REASONS, type AdminEditReason } from '@/lib/constants';
import type { TimeEntry } from '@/lib/types';

function toLocalDatetimeValue(isoString: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  entry: TimeEntry;
  onClose: () => void;
  onSaved: (updated: TimeEntry) => void;
}

export default function EditEntryModal({ entry, onClose, onSaved }: Props) {
  const [clockIn, setClockIn] = useState(toLocalDatetimeValue(entry.clock_in));
  const [clockOut, setClockOut] = useState(toLocalDatetimeValue(entry.clock_out));
  const [reason, setReason] = useState<AdminEditReason | ''>('');
  const [notes, setNotes] = useState('');
  const [visibleToEmployee, setVisibleToEmployee] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!reason) { setError('Please select a reason.'); return; }
    if (clockIn && clockOut && new Date(clockOut) <= new Date(clockIn)) {
      setError('Clock out must be after clock in.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await fetch('/api/admin/edit-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId: entry.id,
        clockIn: clockIn ? new Date(clockIn).toISOString() : undefined,
        clockOut: clockOut ? new Date(clockOut).toISOString() : undefined,
        reason,
        notes,
        visibleToEmployee,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? 'Save failed');
      return;
    }
    const { entry: updated } = await res.json();
    onSaved(updated as TimeEntry);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Time Entry</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Clock In</label>
            <input
              type="datetime-local"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Clock Out</label>
            <input
              type="datetime-local"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as AdminEditReason)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a reason…</option>
              {ADMIN_EDIT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional details…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={visibleToEmployee}
              onChange={(e) => setVisibleToEmployee(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Visible to employee</span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
