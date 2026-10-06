// Memeriksa bahwa device_tokens menerima token dengan bentuk yang sama
// persis seperti yang dikirim aplikasi.
//
// Ini penting karena kesalahan bentuk di sini tidak pernah terlihat di
// aplikasi: upsert yang ditolak hanya menghasilkan satu console.warn, lalu
// digagalkan begitu saja. Kalau tidak diuji, tabelnya diam-diam tetap kosong
// dan tidak ada yang tahu kenapa push tidak pernah sampai.
//
// Baris uji yang dibuat di sini selalu dihapus lagi, jadi tidak menyisakan
// token palsu yang nanti ikut dikirimi push.
//
// Jalankan: node --experimental-strip-types scripts/probe-token-push.mjs

import { readFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const BERKAS = [new URL('.env', root), new URL('mobile/.env', root)];

function ambilKunci(nama) {
  for (const berkas of BERKAS) {
    let isi;
    try {
      isi = readFileSync(berkas, 'utf8');
    } catch {
      continue;
    }
    for (const baris of isi.split(/\r?\n/)) {
      const cocok = baris.match(new RegExp(`^${nama}=(.*)$`));
      if (cocok && cocok[1].trim()) return cocok[1].trim();
    }
  }
  return null;
}

const url = ambilKunci('EXPO_PUBLIC_SUPABASE_URL');
const service = ambilKunci('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !service) {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ditemukan');
}

function admin() {
  return {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

// supabase-js menambah Prefer: resolution=merge-duplicates setiap kali memanggil
// upsert. Tanpa header itu, PostgREST melakukan INSERT biasa dan unique(token)
// akan menolak baris kedua dengan 409, bukan memperbarui. Probe wajib memakai
// header yang sama supaya hasilnya sama dengan yang diterima aplikasi.
function adminUpsert() {
  return { ...admin(), Prefer: 'return=representation,resolution=merge-duplicates' };
}

// Token palsu yang jelas tidak mungkin/device asli.
const TOKEN_UJI = `uji-token-${Date.now()}`;

let gagal = 0;

// Bentuk yang sama seperti daftarTokenPush(): hanya kolom yang benar-benar ada
// di device_tokens, dengan onConflict ke unique(token).
async function cobaUpsertBentukAplikasi() {
  const profil = await (
    await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, { headers: admin() })
  ).json();

  if (!profil.length) {
    console.log('  Lewati: tidak ada profil untuk dijadikan pemilik token uji.');
    return;
  }

  const balasan = await fetch(`${url}/rest/v1/device_tokens?on_conflict=token`, {
    method: 'POST',
    headers: adminUpsert(),
    body: JSON.stringify({
    user_id: profil[0].id,
    token: TOKEN_UJI,
      platform: 'android',
    }),
  });

  console.log(`  upsert dengan onConflict=token      : HTTP ${balasan.status}`);
  if (!balasan.ok) {
    gagal += 1;
    const badan = await balasan.text();
    console.log(`    ${badan}`);
    return;
  }

  // Upsert kedua dengan token sama harus memperbarui, bukan menggandakan.
const kedua = await fetch(`${url}/rest/v1/device_tokens?on_conflict=token`, {
    method: 'POST',
    headers: adminUpsert(),
    body: JSON.stringify({
      user_id: profil[0].id,
      platform: 'android',
      token: TOKEN_UJI,
    }),
  });
  console.log(`  upsert ulang token yang sama        : HTTP ${kedua.status}`);
  if (!kedua.ok) {
    gagal += 1;
    console.log(`    ${await kedua.text()}`);
  }

  const jumlah = await (
    await fetch(`${url}/rest/v1/device_tokens?token=eq.${encodeURIComponent(TOKEN_UJI)}&select=id`, {
      headers: admin(),
    })
  ).json();

  console.log(`  baris untuk token uji               : ${jumlah.length} (harus 1)`);
  if (jumlah.length !== 1) gagal += 1;

  await fetch(
    `${url}/rest/v1/device_tokens?token=eq.${encodeURIComponent(TOKEN_UJI)}`,
    { method: 'DELETE', headers: admin() }
  );
  console.log('  token uji sudah dibersihkan.');
}

// Bentuk lama yang dulu dipakai, supaya regresinya terdeteksi kalau perbaikan
// ini dibatalkan tanpa sadar.
async function cobaUpsertBentukLama() {
  const profil = await (
    await fetch(`${url}/rest/v1/profiles?select=id&limit=1`, { headers: admin() })
  ).json();
  if (!profil.length) return;

  const balasan = await fetch(`${url}/rest/v1/device_tokens?on_conflict=user_id,token`, {
    method: 'POST',
    headers: admin(),
    body: JSON.stringify({
      user_id: profil[0].id,
      token: `${TOKEN_UJI}-lama`,
      platform: 'android',
      diperbarui_pada: new Date().toISOString(),
    }),
  });

  const ditolak = !balasan.ok;
  console.log(
    `  bentuk lama (diperbarui_pada)       : HTTP ${balasan.status}` +
      (ditolak ? '  (ditolak, seperti seharusnya)' : '  (LUMIAN masuk database!)')
  );

  if (!ditolak) {
    gagal += 1;
    await fetch(
      `${url}/rest/v1/device_tokens?token=eq.${encodeURIComponent(`${TOKEN_UJI}-lama`)}`,
      { method: 'DELETE', headers: admin() }
    );
  }
}

async function cekKredensialServer() {
  const ada = (nama) => Boolean(ambilKunci(nama));
  const fcm = ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'];
  const apns = ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_PRIVATE_KEY'];

  const punyaFcm = fcm.every(ada);
  const punyaApns = apns.every(ada);

  console.log(`  kredensial FCM di .env              : ${punyaFcm ? 'lengkap' : 'BELUM LENGKAP'}`);
  console.log(`  kredensial APNs di .env             : ${punyaApns ? 'lengkap' : 'BELUM LENGKAP (iOS saja)'}`);
}

console.log(`project : ${url}\n`);
console.log('=== device_tokens ===');
await cobaUpsertBentukAplikasi();
console.log('');
await cobaUpsertBentukLama();
console.log('');
console.log('=== kesiapan push ===');
await cekKredensialServer();

console.log(
  `\n${gagal === 0 ? 'Bentuk data sudah benar.' : `${gagal} pemeriksaan gagal.`}`
);
process.exit(gagal === 0 ? 0 : 1);