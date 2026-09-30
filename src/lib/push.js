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

function arrayBufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer || []);
  let raw = '';
  bytes.forEach((byte) => {
    raw += String.fromCharCode(byte);
  });
  return window.btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Browser menolak mengganti applicationServerKey pada langganan lama, jadi
// langganan dengan kunci VAPID berbeda harus dilepas dulu (baru disubscribe
// ulang), dan baris endpoint lama dihapus agar tidak dikirim push mati.
async function dropSubscription(subscription) {
  if (!subscription) return;
  const oldEndpoint = subscription.toJSON().endpoint;
  await subscription.unsubscribe().catch(() => {});
  if (oldEndpoint) {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', oldEndpoint);
    if (error) console.warn('[push] langganan lama gagal dihapus dari server:', error.message);
  }
}

async function resolveSubscription(registration) {
  const existing = await registration.pushManager.getSubscription();
  if (!existing) return null;

  const currentKey = arrayBufferToBase64Url(existing.options?.applicationServerKey);
  if (currentKey && currentKey === VAPID_PUBLIC_KEY) return existing;

  await dropSubscription(existing);
  return null;
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

async function saveSubscription(session, subscription) {
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

  if (!error) return { ok: true, reason: 'subscribed' };

  const rls = /row-level security/i.test(error.message);
  return {
    ok: false,
    reason: 'save-failed',
    message: rls
      ? 'Endpoint browser ini sudah tercatat untuk akun lain. Keluar lalu masuk kembali, lalu aktifkan ulang.'
      : error.message,
  };
}

async function subscribeFresh(registration) {
  try {
    return await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  } catch (subscribeError) {
    const message = String(subscribeError?.message || subscribeError);
    if (!/applicationServerKey|gcm_sender_id/i.test(message)) throw subscribeError;
    await dropSubscription(await registration.pushManager.getSubscription());
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
}

export async function ensurePushSubscription(session) {
  if (!session?.user) return { ok: false, reason: 'no-session' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (Notification.permission !== 'granted') return { ok: false, reason: 'permission' };

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    let subscription = await resolveSubscription(registration);
    if (subscription) {
      const saved = await saveSubscription(session, subscription);
      if (saved.ok) return saved;
      // Endpoint lama sudah tercatat untuk akun lain -> putar langganan supaya
      // dapat endpoint baru dan baris INSERT baru milik sendiri.
      await dropSubscription(subscription);
      subscription = null;
    }

    subscription = await subscribeFresh(registration);
    return await saveSubscription(session, subscription);
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

export async function notifyNow({ title, body, tag, url = '/' }) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  // Permintaan izin hanya boleh datang dari gesture pengguna (tombol "Izinkan"
  // atau tombol Ingatkan). Memanggil requestPermission() dari pengecekan
  // latar belakang membuat prompt muncul seenaknya dan Chrome bisa
  // menolaknya diam-diam, sehingga hasilnya beda antara lokal dan produksi.
  if (Notification.permission !== 'granted') {
    return { ok: false, reason: Notification.permission };
  }

  const options = {
    body: body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: tag || `bawaslu-${Date.now()}`,
    renotify: true,
    data: { url },
  };

  try {
    // Chrome mobile dan PWA menolak new Notification() dari halaman, jadi
    // utamakan ServiceWorkerRegistration.showNotification(). Kalau service
    // worker belum pernah terpasang (push belum diaktifkan), pasang dulu.
    const existing = await navigator.serviceWorker?.getRegistration?.();
    const registration =
      existing || (await navigator.serviceWorker?.register?.('/sw.js', { scope: '/' }));
    if (registration?.showNotification) {
      await registration.showNotification(title, options);
      return { ok: true, reason: 'sw' };
    }
  } catch {
    /* lanjut ke fallback */
  }

  try {
    new Notification(title, options);
    return { ok: true, reason: 'direct' };
  } catch (error) {
    return { ok: false, reason: 'error', message: error?.message ?? String(error) };
  }
}

export async function sendRemind(scheduleId, session) {
  // Objek session di memori bisa berisi access token yang sudah kedaluwarsa,
  // terutama di PWA yang dibiarkan terbuka lama. Baca sesi terbaru dulu supaya
  // tidak kena 401 sesaat yang hanya muncul di kondisi tertentu.
  let token = session?.access_token;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token ?? token;
  } catch (error) {
    console.warn('[push] gagal memperbarui sesi, pakai token lama:', error?.message);
  }
  if (!token) throw new Error('Sesi berakhir. Silakan keluar lalu masuk kembali.');

  const response = await fetch('/api/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ scheduleId }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        'Endpoint /api/notify tidak ditemukan. Di mode lokal jalankan `vercel dev` ' +
          '(bukan `npm run dev`); di Vercel periksa bahwa deploy terbaru sudah selesai.'
      );
    }
    throw new Error(data.error || `Permintaan gagal (HTTP ${response.status}).`);
  }
  return data;
}
