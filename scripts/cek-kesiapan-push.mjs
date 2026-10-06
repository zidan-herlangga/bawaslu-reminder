// Menunjukkan satu per satu apa yang masih kurang agar pengingat benar-benar
// sampai ke ponsel.
//
// Push punya beberapa lapis yang harus lengkap semua, dan setiap lapis gagal
// dengan gejala yang sama: tidak ada bunyi. Kalau tidak dicek satu per satu,
// hampir selalu ada satu lapis yang terlewat.
//
// Dua jalur yang diperiksa di sini:
//   web    -> service worker + tabel push_subscriptions (VAPID)
//   native -> FCM / APNs + tabel device_tokens
//
// Jalankan: npm run push:siap

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);

function bacaEnv(lokasi) {
  try {
    return readFileSync(new URL(lokasi, root), 'utf8');
  } catch {
    return '';
  }
}

const env = Object.fromEntries(
  (bacaEnv('.env') + '\n' + bacaEnv('mobile/.env'))
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    })
);

const problems = [];
const warn = [];

function cek(nama, sudah, cara) {
  const tanda = sudah ? 'OK     ' : 'BELUM  ';
  console.log(`  ${tanda}${nama}`);
  if (!sudah) {
    problems.push(`  - ${nama}\n      ${cara}`);
  }
}

function cekSebagian(nama, kunci, cara) {
  const hilang = kunci.filter((key) => !env[key]);
  if (hilang.length === 0) {
    console.log(`  OK     ${nama}`);
  } else if (hilang.length === kunci.length) {
    cek(nama, false, cara);
  } else {
    warn.push(`  - ${nama}: belum ada ${hilang.join(', ')}`);
    console.log(`  SETENGAH ${nama}  (belum ada: ${hilang.join(', ')})`);
  }
}

// --- kredensial server -------------------------------------------------------

console.log('=== kredensial server (.env) ===');
cekSebagian(
  'Supabase service role',
  ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  'Salin dari .env proyek, sama seperti yang sudah dipakai web.'
);
cekSebagian(
  'Web push (VAPID)',
  ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'],
  'Buat dengan: npm run vapid'
);
cekSebagian(
  'Push Android (FCM)',
  ['FCM_PROJECT_ID', 'FCM_CLIENT_EMAIL', 'FCM_PRIVATE_KEY'],
  'Dari Firebase console > Project settings > Service accounts > Generate new private key. Private key ditulis dengan \\n untuk baris baru.'
);
cekSebagian(
  'Push iOS (APNs)',
  ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_PRIVATE_KEY', 'APNS_BUNDLE_ID'],
  'Hanya perlu kalau aplikasi iOS ikut dibangun. Tidak dipakai di Android.'
);
cekSebagian(
  'Rahasia cron',
  ['CRON_SECRET'],
  'Buat dengan: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))" lalu pakai nilai yang sama di Vault Supabase.'
);

// --- konfigurasi Firebase di aplikasi ---------------------------------------

console.log('\n=== konfigurasi Firebase di aplikasi ===');

const firebase = [
  ['mobile/google-services.json', 'android/app/google-services.json'],
  ['mobile/android/app/google-services.json', 'android/app/google-services.json'],
];

const adaFirebase = firebase.find(([lokasi]) => existsSync(fileURLToPath(new URL(lokasi, root))));
cek(
  'google-services.json ada di proyek',
  Boolean(adaFirebase),
  'Firebase console > Project settings > General > Google Android > google-services.json, lalu simpan sebagai mobile/google-services.json.'
);

let appJson = {};
try {
  appJson = JSON.parse(bacaEnv('mobile/app.json'));
} catch {
  /* app.json tidak terbaca, dianggap belum ada konfigurasi */
}

const gsf = appJson?.expo?.android?.googleServicesFile ?? null;
cek(
  'android.googleServicesFile terisi di app.json',
  Boolean(gsf),
  'Tambahkan "googleServicesFile": "./google-services.json" ke expo.android di mobile/app.json. Jangan diisi sebelum filenya ada, kalau tidak build akan gagal.'
);

const paket = appJson?.expo?.android?.package ?? '(tidak terbaca)';
console.log(`  info    package Android: ${paket}`);
if (adaFirebase && adaFirebase[1]) {
  console.log(`  info    google-services.json harus berisi package_name yang sama persis.`);
}

// --- data di database --------------------------------------------------------

console.log('\n=== data di database ===');

const url = env.SUPABASE_URL;
const kunci = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !kunci) {
  console.log('  Lewati: SUPABASE_URL atau service role belum ada.');
} else {
  const hitung = async (tabel) => {
    const r = await fetch(`${url}/rest/v1/${tabel}?select=id`, {
      headers: {
        apikey: kunci,
        Authorization: `Bearer ${kunci}`,
        Prefer: 'count=exact',
      },
    });
    const range = r.headers.get('content-range') || '';
    return Number(range.split('/')[1] ?? 0);
  };

  try {
    const web = await hitung('push_subscriptions');
    const native = await hitung('device_tokens');
    console.log(`  info    push_subscriptions (web) : ${web} baris`);
    console.log(`  info    device_tokens (native)   : ${native} baris`);

    if (web === 0) {
      warn.push('  - Belum ada langganan web push. Staf harus menyalakan notifikasi di browser.');
    }
    if (native === 0) {
      warn.push(
        '  - device_tokens kosong. Token FCM hanya muncul kalau aplikasi sudah dibangun ulang DENGAN google-services.json, lalu Staf masuk lewat tab Akun.'
      );
    }
  } catch (galat) {
    console.log(`  Gagal membaca database: ${galat.message}`);
  }
}

// --- ringkasan ---------------------------------------------------------------

console.log('\n=== ringkasan ===');

if (warn.length > 0) {
  console.log('\nPerlu diperhatikan:');
  for (const item of warn) console.log(item);
}

if (problems.length === 0) {
  console.log('\nSemua lapis utuh.');
  console.log('Kalau bunyi tetap tidak keluar, langkah berikutnya ada di README bagian Pengingat.');
} else {
  console.log(`\n${problems.length} hal belum lengkap:`);
  for (const item of problems) console.log(item);
  console.log('\nSetelah semuanya lengkap, aplikasi harus dibangun ulang. APK lama tidak punya Firebase.');
}

process.exit(problems.length === 0 ? 0 : 1);