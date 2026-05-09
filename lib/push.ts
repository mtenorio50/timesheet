import webpush from 'web-push';
import type { PushSubscriptionJSON } from './types';

let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidInitialized = true;
}

export async function sendPush(
  subscription: PushSubscriptionJSON,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  ensureVapid();
  await webpush.sendNotification(
    subscription as webpush.PushSubscription,
    JSON.stringify(payload),
  );
}

export async function sendPushToMany(
  subscriptions: PushSubscriptionJSON[],
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number; expiredEndpoints: string[] }> {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPush(sub, payload)),
  );

  const expiredEndpoints: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410) {
        expiredEndpoints.push(subscriptions[i].endpoint);
      }
    }
  });

  return {
    sent: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
    expiredEndpoints,
  };
}
