// Menambah blok push native ke .env.example.
//
// Ditulis lewat skrip supaya nama bundle id yang dipakai di mobile/app.json
// dan yang tertulis di sini tidak akan berbeda. Nilai yang sudah ada di berkas
// tidak ditimpa, jadi aman dijalankan berulang.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DI_SINI = dirname(fileURLToPath(import.meta.url));
// Skrip ini diletakkan di mobile/scripts, sedangkan berkas yang diubah ada di
// akar repository. Naik satu tingkat dari folder mobile.
const AKAR = join(DI_SINI, '..', '..');
const BERKAS = join(AKAR, '.env.example');

const app = JSON.parse(readFileSync(join(AKAR, 'mobile', 'app.json'), 'utf8'));
const bundleId = app.expo.ios.bundleIdentifier;

const AWAL = '\n\n# =====================================================================\n' +
  '# Push untuk aplikasi native (folder mobile/)\n' +
  '# =====================================================================\n';

function isiBlok() {
  return [
    AWAL.trimStart(),
    '#',
    '# OPSIONAL. Kalau kosong, fitur "Ingatkan" tetap berfungsi untuk pengguna web',
    '# dan hanya perangkat native yang tidak menerima notifikasi. Tidak ada galat,',
    '# hanya catatan di respons endpoint.',
    '#',
    '# Kunci WAJIB disimpan di server saja. Jangan memakai awalan VITE_ atau',
    '# EXPO_PUBLIC_ untuk nilai di bawah, karena keduanya membuat kunci ikut',
    '# terkirim ke perangkat pengguna.',
    '#',
    '# --- Android: Firebase Cloud Messaging ---',
    '#',
    '# 1. console.firebase.google.com, buat project, lalu tambahkan aplikasi Android',
    `#    dengan package id yang sama dengan mobile/app.json: ${bundleId}`,
    '# 2. Project Settings > Service accounts > Generate new private key',
    '# 3. Isi di bawah. Untuk FCM_PRIVATE_KEY, ganti baris baru dengan \\n',
    '# 4. Salin google-services.json ke mobile/ (tidak di-commit)',
    'FCM_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID',
    'FCM_CLIENT_EMAIL=firebase-adminsdk-xxxxx@YOUR_PROJECT.iam.gserviceaccount.com',
    'FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"',
    '',
    '# --- iOS: Apple Push Notification service ---',
    '#',
    '# WAJIB punya Apple Developer Program ($99/tahun). Tanpa itu APNs tidak bisa',
    '# dipakai sama sekali.',
    '#',
    '# 1. Apple Developer > Keys > register APNs Auth Key',
    '# 2. Unduh file .p8 (hanya bisa diunduh sekali)',
    '# 3. Isi Key ID dan Team ID di bawah',
    'APNS_KEY_ID=YOUR_APNS_KEY_ID',
    'APNS_TEAM_ID=YOUR_APPLE_TEAM_ID',
    `APNS_BUNDLE_ID=${bundleId}`,
    '# Untuk APNS_PRIVATE_KEY, ganti baris baru dengan \\n',
    'APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"',
    '',
  ].join('\n');
}

const isi = readFileSync(BERKAS, 'utf8');

if (isi.includes('FCM_PROJECT_ID')) {
  console.log('  blok push native sudah ada, tidak diubah');
  process.exit(0);
}

writeFileSync(BERKAS, isi.replace(/\s*$/, '\n') + isiBlok(), 'utf8');
console.log(`  blok push native ditambahkan, bundle id: ${bundleId}`);
