'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useTimeEntry } from '@/hooks/useTimeEntry';
import { useTimesheet } from '@/hooks/useTimesheet';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { formatHours } from '@/lib/constants';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function EmployeePage() {
  const router = useRouter();
  const { profile, loading: authLoading, signOut } = useAuth();
  const { timesheet } = useTimesheet(profile);
  const { activeEntry, todayTotalHours, elapsedSeconds, isLoading, clockIn, clockOut } =
    useTimeEntry();
  const { supported, permission, subscribed, subscribe } = usePushNotifications();

  useEffect(() => {
    if (!authLoading && profile && (profile.role === 'admin' || profile.role === 'super_admin')) {
      router.replace('/admin');
    }
  }, [authLoading, profile, router]);

  async function handleClockToggle() {
    if (!profile || !timesheet) return;
    if (activeEntry) {
      await clockOut();
    } else {
      await clockIn(timesheet.id, profile.id);
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const clocked = !!activeEntry;

  return (
    <div className="mx-auto max-w-md px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{getGreeting()},</p>
          <h1 className="text-xl font-bold text-gray-900">
            {profile?.full_name ?? profile?.email ?? 'Employee'}
          </h1>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>

      {/* Push notification prompt */}
      {supported && permission === 'default' && !subscribed && (
        <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-medium text-blue-900">Enable reminders</p>
          <p className="mt-0.5 text-xs text-blue-700">
            Get notified before your timesheet is due.
          </p>
          <button
            onClick={subscribe}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            Allow notifications
          </button>
        </div>
      )}

      {/* Clock in/out card */}
      <div className="mb-4 rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-4 text-center">
          {clocked ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                Currently clocked in
              </p>
              <p className="mt-2 font-mono text-4xl font-bold text-gray-900">
                {formatElapsed(elapsedSeconds)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              {timesheet?.status === 'submitted'
                ? 'Timesheet submitted — no new entries allowed'
                : 'Not clocked in'}
            </p>
          )}
        </div>

        <button
          onClick={handleClockToggle}
          disabled={timesheet?.status !== 'draft'}
          className={`w-full rounded-xl py-4 text-base font-semibold transition-colors disabled:opacity-40 ${
            clocked
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
          }`}
        >
          {clocked ? 'Clock Out' : 'Clock In'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Today</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatHours(todayTotalHours)}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">This period</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatHours(timesheet?.total_hours ?? 0)}
          </p>
        </div>
      </div>

      {/* Timesheet status + link */}
      <Link
        href="/employee/timesheet"
        className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:bg-gray-50"
      >
        <div>
          <p className="text-sm font-medium text-gray-900">View timesheet</p>
          <p className="mt-0.5 text-xs text-gray-500 capitalize">
            Status:{' '}
            <span
              className={
                timesheet?.status === 'submitted'
                  ? 'text-amber-600'
                  : timesheet?.status === 'approved'
                    ? 'text-green-600'
                    : 'text-gray-600'
              }
            >
              {timesheet?.status ?? 'loading'}
            </span>
          </p>
        </div>
        <span className="text-gray-400">›</span>
      </Link>
    </div>
  );
}
