'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase-client';
import type { User } from '@/lib/types';

export default function AdminPage() {
  const router = useRouter();
  const { profile, loading: authLoading, signOut } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role === 'employee') router.replace('/employee');
      else loadUsers();
    }
  }, [authLoading, profile]);

  async function loadUsers() {
    const res = await fetch('/api/admin/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }

  async function approveUser(userId: string) {
    const supabase = createClient();
    await supabase.from('users').update({ is_approved: true }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, is_approved: true } : u));
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Loading…</div>
      </div>
    );
  }

  const pending = users.filter((u) => !u.is_approved);
  const active = users.filter((u) => u.is_approved && u.role === 'employee');
  const admins = users.filter((u) => u.is_approved && u.role !== 'employee');

  return (
    <div className="mx-auto max-w-lg px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-500">Royal Glass Timesheet</p>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-600">
            Pending approval ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-red-100"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={() => approveUser(user.id)}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active employees */}
      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Employees ({active.length})
        </h2>
        <div className="space-y-2">
          {active.length === 0 ? (
            <p className="text-sm text-gray-400">No active employees</p>
          ) : (
            active.map((user) => (
              <Link
                key={user.id}
                href={`/admin/employee/${user.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Admins */}
      {admins.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Admins ({admins.length})
          </h2>
          <div className="space-y-2">
            {admins.map((user) => (
              <Link
                key={user.id}
                href={`/admin/employee/${user.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{user.full_name ?? '—'}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role.replace('_', ' ')}</p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
