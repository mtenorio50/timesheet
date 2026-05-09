export const runtime = 'nodejs';

import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { sendPushToMany } from '@/lib/push';
import type { PushSubscriptionJSON } from '@/lib/types';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { days_before?: number } = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — default to 1
  }
  const daysBefore = body.days_before ?? 1;

  const supabase = createServiceClient();

  const { data: targets, error } = await supabase.rpc('get_reminder_targets', {
    days_before: daysBefore,
  });

  if (error) {
    console.error('get_reminder_targets error — check Supabase logs for details');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No targets' });
  }

  const subscriptions = (targets as Array<{ push_subscription: PushSubscriptionJSON; user_id: string }>)
    .map((t) => t.push_subscription)
    .filter(Boolean);

  const title = daysBefore === 0 ? 'Timesheet due today' : 'Timesheet due tomorrow';
  const body2 = daysBefore === 0
    ? 'Submit your timesheet before end of day.'
    : "Don't forget — your timesheet is due tomorrow.";

  const { sent, failed, expiredEndpoints } = await sendPushToMany(subscriptions, {
    title,
    body: body2,
    url: '/employee/timesheet',
  });

  // Clean up expired subscriptions (HTTP 410) — match by user_id for safety
  if (expiredEndpoints.length > 0) {
    const expiredUserIds = (targets as Array<{ push_subscription: PushSubscriptionJSON; user_id: string }>)
      .filter((t) => expiredEndpoints.includes(t.push_subscription?.endpoint))
      .map((t) => t.user_id);

    for (const userId of expiredUserIds) {
      await supabase
        .from('users')
        .update({ push_subscription: null })
        .eq('id', userId);
    }
  }

  // TODO: add Resend email notifications here for users with email_enabled = true

  return NextResponse.json({ sent, failed, expiredCleaned: expiredEndpoints.length });
}
