// Menguji apakah endpoint push yang tersimpan masih bisa dikirimi pesan.
// Memakai kode yang sama dengan api/notify.js supaya hasilnya relevan.
import { readFileSync } from 'node:fs';
import webpush from 'web-push';

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const URL_SB = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const res = await fetch(`${URL_SB}/rest/v1/push_subscriptions?select=endpoint,user_id,p256dh,auth`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const subs = await res.json();

webpush.setVapidDetails(
  env.VAPID_SUBJECT || 'mailto:admin@example.com',
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

console.log(`endpoint tersimpan: ${subs.length}\n`);

let hidup = 0;
let mati = 0;

for (const [i, sub] of subs.entries()) {
  const label = String(i + 1).padStart(2, '0');
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({
        title: 'Uji Push',
        body: 'Notifikasi ini dikirim langsung dari server untuk memeriksa apakah endpoint masih hidup.',
        url: '/',
        id: `uji-${Date.now()}-${i}`,
      })
    );
    hidup += 1;
    console.log(`  [HIDUP ] ${label}  terkirim`);
  } catch (error) {
    const status = error?.statusCode;
    if (status === 404 || status === 410) {
      mati += 1;
      console.log(`  [MATI  ] ${label}  HTTP ${status} - subscription sudah tidak valid, harus dihapus`);
    } else {
      console.log(`  [GAGAL ] ${label}  HTTP ${status ?? '-'} ${error?.message ?? error}`);
    }
  }
}

console.log(`\nRINGKASAN: hidup ${hidup}, mati ${mati}, dari ${subs.length}`);
console.log('Endpoint MATI perlu dihapus dari tabel push_subscriptions.');
