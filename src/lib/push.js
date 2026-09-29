import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);

  return output;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function isPushReady() {
  return Boolean(VAPID_PUBLIC_KEY) && isPushSupported() && Notification.permission === 'granted';
}

export async function ensurePushSubscription(session) {
  if (!session?.user) return { ok: false, reason: 'no-session' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' };

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: 'bad-subscription' };
    }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: session.user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      { onConflict: 'endpoint' }
    );

    if (error) return { ok: false, reason: 'save-failed', message: error.message };
    return { ok: true, reason: 'subscribed' };
  } catch (error) {
    return { ok: false, reason: 'error', message: error?.message ?? String(error) };
  }
}

export async function enablePush(session) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  return ensurePushSubscription(session);
}

export async function sendRemind(scheduleId, session) {
  const response = await fetch('/api/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ scheduleId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
  return data;
}
