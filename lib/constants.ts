export const ADMIN_EDIT_REASONS = [
  'Forgot to clock out',
  'Incorrect time recorded',
  'System error',
  'Public holiday adjustment',
  'Manager approved correction',
  'Other (see notes)',
] as const;

export type AdminEditReason = (typeof ADMIN_EDIT_REASONS)[number];

export function formatHours(hours: number | null | undefined): string {
  if (hours == null) return '—';
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-NZ', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentPeriod(
  anchorDate: string | null,
  periodType: 'weekly' | 'fortnightly' | 'monthly',
): { start: Date; end: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (periodType === 'monthly') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { start, end };
  }

  // Fallback anchor: most recent Monday
  const fallbackAnchor = new Date(today);
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  fallbackAnchor.setDate(today.getDate() - daysToMonday);

  const anchor = anchorDate ? new Date(anchorDate) : fallbackAnchor;
  anchor.setHours(0, 0, 0, 0);

  const periodDays = periodType === 'weekly' ? 7 : 14;
  const diffMs = today.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Clamp to 0 so a future anchor date doesn't produce a period in the past
  const periodsElapsed = Math.max(0, Math.floor(diffDays / periodDays));

  const start = new Date(anchor);
  start.setDate(anchor.getDate() + periodsElapsed * periodDays);
  const end = new Date(start);
  end.setDate(start.getDate() + periodDays - 1);

  return { start, end };
}
