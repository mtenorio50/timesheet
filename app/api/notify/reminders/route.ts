export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';
import { sendPushToMany } from '@/lib/push';
import type { PushSubscriptionJSON } from '@/lib/types';

export async function POST(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization');
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader || authHeader !== expectedSecret) {
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
    console.error('get_reminder_targets error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!targets || targets.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No targets' });
  }

  const subscriptions = (targets as Array<{ push_subscription: PushSubscriptionJSON }>)
    .map((t) => t.push_subscription)
    .filter(Boolean);

  const title = daysBefore === 0
    ? 'Timesheet due today'
    : `Timesheet due tomorrow`;
  const body2 = daysBefore === 0
    ? 'Submit your timesheet before end of day.'
    : 'Don\'t forget — your timesheet is due tomorrow.';

  const { sent, failed, expiredEndpoints } = await sendPushToMany(subscriptions, {
    title,
    body: body2,
    url: '/employee/timesheet',
  });

  // Clean up expired subscriptions (HTTP 410)
  if (expiredEndpoints.length > 0) {
    for (const endpoint of expiredEndpoints) {
      await supabase
        .from('users')
        .update({ push_subscription: null })
        .filter('push_subscription->>endpoint', 'eq', endpoint);
    }
  }

  // TODO: add Resend email notifications here for users with email_enabled = true

  return NextResponse.json({ sent, failed, expiredCleaned: expiredEndpoints.length });
}
