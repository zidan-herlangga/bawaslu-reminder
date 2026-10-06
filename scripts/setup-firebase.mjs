/**
 * Menyiapkan Firebase untuk push Android, dari akun yang belum login sampai
 * file google-services.json ada di tempat yang benar.
 *
 * Urutan langkah di sini disengaja. Ada jebakan urutan: mengisi
 * android.googleServicesFile sebelum filenya ada akan membuat build berhenti
 * dengan pesan yang tidak menyinggung push sama sekali. Karena itu skrip ini
 * mengunduh file lebih dulu, memverifikasinya, dan baru menyentuh app.json.
 *
 * Jalankan:
 *   firebase login          (sekali saja, membuka peramban)
 *   node scripts/setup-firebase.mjs
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_JSON = path.join(ROOT, 'mobile', 'app.json');
const TARGET = path.join(ROOT, 'mobile', 'google-services.json');

// Package dibaca dari app.json supaya tidak pernah diketik ulang dengan tangan.
// Salin-tempel package adalah tempat kesalahan satu karakter yang paling mahal
// di seluruh alur ini: Firebase tetap menerimanya, build tetap lolos, tapi
// google-services.json tidak punya entri untuk aplikasi kita dan push gagal
// saat runtime dengan pesan yang tidak menyinggung ketikan sama sekali.
const ANDROID_ID = JSON.parse(readFileSync(APP_JSON, 'utf8')).expo?.android?.package;
if (!ANDROID_ID) {
  console.log('expo.android.package tidak ada di mobile/app.json. Berhenti.');
  process.exit(1);
}

/**
 * Menjalankan firebase CLI, mengembalikan teks keluarannya.
 *
 * Di Windows executable-nya bernama firebase.cmd, dan execFileSync tanpa shell
 * tidak mencarinya, jadi shell dipakai. Tapi shell berarti argument dipisah
 * spasi, dan path kita mengandung spasi: "React Native". Path yang tidak
 * di-quote pecah jadi beberapa argument dan CLI menjawab "Too many arguments",
 * yang sama sekali tidak menyinggung path-nya.
 *
 * Karena itu semua argument dibungkus tanda kutip.
 */
const JALAN = { shell: true };

function firebase(args, opts = {}) {
  return execFileSync('firebase', args.map((a) => `"${a}"`), {
    cwd: ROOT,
    encoding: 'utf8',
    ...JALAN,
    stdio: opts.diam ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
}

/**
 * Menjalankan perintah dan mengembalikan teks keluarannya, atau null kalau
 * perintahnya gagal jalan.
 *
 * Penting hasilnya null, bukan pesan galat. Sebelumnya galat ikut dikembalikan
 * sebagai teks, sehingga pemeriksaan "sudah login atau belum" tidak pernah
 * kena dan skrip tetap melanjutkan ke pembuatan project padahal belum login.
 */
function coba(args) {
  try {
    return execFileSync('firebase', args.map((a) => `"${a}"`), {
      cwd: ROOT,
      encoding: 'utf8',
      ...JALAN,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/**
 * Membaca keluaran JSON dari Firebase CLI.
 *
 * Dua hal membuat keluaran ini tidak bisa langsung di-parse. Ada baris status
 * seperti "- Preparing the list of your projects" sebelum JSON-nya, dan isinya
 * dibungkus objek { status, result } dan bukan array biasa. Mengabaikannya
 * membuat pemanggilan berikutnya menerima null tanpa error yang jelas, lalu
 * perintah dijalankan dengan argumen project yang kosong.
 */
function bacaJson(teks) {
  const mulai = teks.search(/[[{]/);
  if (mulai < 0) return null;
  let isi;
  try {
    isi = JSON.parse(teks.slice(mulai));
  } catch {
    return null;
  }
  return isi?.result ?? isi;
}

/** Menjalankan perintah CLI dan membaca keluarannya sebagai JSON. */
function jsonFb(args) {
  const teks = coba(args);
  return teks === null ? null : bacaJson(teks);
}

function lalu(rentang, ketik) {
  console.log(`\n${ketik}`);
  for (const baris of rentang.split('\n')) if (baris.trim()) console.log(`  ${baris.trim()}`);
}

// 1. CLI harus ada, dan harus sudah login. Ini satu-satunya langkah yang
//    benar-benar tidak bisa dikerjakan tanpa orangnya di depan layar, karena
//    butuh persetujuan Google di peramban.
const keluar = coba(['login:list']);
if (keluar === null) {
  lalu(
    [
      'Firebase CLI tidak bisa dijalankan.',
      '',
      'Pasang dulu secara global:',
      '',
      '    npm install -g firebase-tools',
    ].join('\n'),
    'BERHENTI di sini'
  );
  process.exit(1);
}
if (/No authorized accounts/.test(keluar)) {
  lalu(
    [
      'Belum login ke Firebase.',
      '',
      'Jalankan ini sekali, di terminal yang sama:',
      '',
      '    firebase login',
      '',
      'Peramban akan terbuka. Pilih akun Google yang akan memegang project ini.',
      'Setelah selesai, jalankan ulang skrip ini.',
    ].join('\n'),
    'BERHENTI di sini'
  );
  process.exit(1);
}
lalu(keluar.trim(), 'Akun Firebase');

// 2. Project. Pakai yang pertama kalau sudah ada, kalau tidak buat baru.
const daftarProject = jsonFb(['projects:list', '--json']) ?? [];
const adaProject = Array.isArray(daftarProject) ? daftarProject[0] : null;
const project = adaProject ? adaProject.projectId : null;

if (project) {
  lalu(`Menggunakan project yang sudah ada: ${project}`, 'Project');
} else {
  const nama = process.argv[2] ?? 'biskinan-reminder';
  console.log(`\nMembuat project Firebase: ${nama}`);
  firebase(['projects:create', nama, '--json']);
  lalu(nama, 'Project dibuat');
}

// 2b. Tulis .firebaserc supaya project default diketahui perintah berikutnya.
//     .firebaserc hanya berisi nama project, tidak ada rahasia, jadi aman ikut
//     git. Tanpa file ini apps:sdkconfig tidak tahu project mana yang dipakai.
const FIREBASERC = path.join(ROOT, '.firebaserc');
if (!existsSync(FIREBASERC)) {
  writeFileSync(
    FIREBASERC,
    JSON.stringify({ projects: { default: project } }, null, 2) + '\n'
  );
  lalu('default project dicatat', '.firebaserc');
}

// 3. Daftarkan aplikasi Android, kalau belum ada dengan package yang persis sama.
//
//    Package diambil dari app.json, bukan ditulis ulang di sini. Menyalinnya
//    dengan tangan adalah sumber kesalahan yang mahal: package yang beda satu
//    karakter tetap diterima Firebase, build tetap lolos, tapi
//    google-services.json tidak punya entri untuk aplikasi kita. Push gagal
//    saat runtime dengan alasan yang tidak menyinggung ketikan sama sekali.
const apps = jsonFb(['apps:list', 'ANDROID', '--project', project, '--json']) ?? [];
const semua = Array.isArray(apps) ? apps : [];
const terdaftar = semua.find((a) => a.packageName === ANDROID_ID);

let appId;
if (terdaftar) {
  appId = terdaftar.appId;
  lalu(`${ANDROID_ID} sudah terdaftar, dilewati`, 'Aplikasi Android');
} else {
  console.log(`\nMendaftarkan aplikasi Android: ${ANDROID_ID}`);
  const dibuat = jsonFb([
    'apps:create',
    'ANDROID',
    'pengingat',
    '--package-name',
    ANDROID_ID,
    '--project',
    project,
    '--json',
  ]);
  appId = dibuat?.appId;
  if (!appId) {
    console.log('Pendaftaran gagal, tidak ada appId yang kembali. Berhenti.');
    process.exit(1);
  }
  lalu(appId, 'Aplikasi Android didaftarkan');
}

const lain = semua.filter((a) => a.packageName !== ANDROID_ID);
if (lain.length > 0) {
  lalu(
    [
      `Ada ${lain.length} aplikasi Android lain dengan package berbeda:`,
      ...lain.map((a) => `  ${a.packageName}`),
      'Tidak dipakai apa pun. Boleh dibiarkan; kalau mau bersih, hapus dari',
      'Firebase console > Project settings.',
    ].join('\n'),
    'Catatan'
  );
}

// 4. Unduh file.
//
//    apps:sdkconfig tidak menerima --project. Ia membaca project default dari
//    .firebaserc, jadi file itu harus ada lebih dulu. Karena itu skrip menulis
//    .firebaserc di langkah 2b.
firebase(['apps:sdkconfig', 'ANDROID', appId, '--out', TARGET]);
lalu(TARGET, 'google-services.json diunduh');

// 5. Verifikasi dan bersihkan isi file.
//
//    Dua hal harus dibereskan di sini.
//
//    Pertama, "client" di google-services.json SELALU berupa array, bahkan kalau
//    project cuma punya satu aplikasi Android. Kalau project punya lebih dari
//    satu, Firebase menuliskan semua aplikasi ke dalam array itu, dan plugin
//    Gradle memilih sendiri yang cocok dengan package aplikasi kita.
//
//    Jadi yang perlu dilakukan hanya menyaring array itu, bukan mengambil satu
//    elemen. Mengubahnya jadi objek tunggal membuat build gagal dengan:
//      class com.google.gson.JsonObject cannot be cast to class com.google.gson.JsonArray
//    Itu kesalahan yang_RX commit pertama dan tidak terlihat sampai build.
//
//    Kedua, package_name wajib dibaca dari nilainya, bukan dari kunci objeknya.
//    Versi pertama memakai Object.keys() dan selalu melaporkan kosong sehingga
//    skrip menolak file yang sebenarnya benar.
const isi = JSON.parse(readFileSync(TARGET, 'utf8'));
const semuaClient = Array.isArray(isi.client) ? isi.client : [isi.client];
const milikKita = semuaClient.filter(
  (c) => c?.client_info?.android_client_info?.package_name === ANDROID_ID
);

if (milikKita.length === 0) {
  const ada = semuaClient.map(
    (c) => c?.client_info?.android_client_info?.package_name ?? '(tanpa package)'
  );
  console.log(
    `\nPackage di dalam file tidak cocok.\n` +
      `  diharapkan : ${ANDROID_ID}\n` +
      `  ditemukan  : ${ada.join(', ')}\n` +
      'Periksa manual dengan:\n' +
      '  firebase apps:list ANDROID'
  );
  process.exit(1);
}

if (semuaClient.length > 1) {
  isi.client = milikKita;
  writeFileSync(TARGET, JSON.stringify(isi, null, 2) + '\n');
  lalu(
    `${semuaClient.length} client di dalam file, sisanya dibuang`,
    'google-services.json disaring'
  );
}

if (!Array.isArray(isi.client)) {
  console.log(
    '\n"client" harus tetap berupa array. Plugin Gradle membacanya sebagai array\n' +
      'dan build akan gagal kalau diubah jadi objek. Perbaiki skrip ini.\n'
  );
  process.exit(1);
}

const apiKey = milikKita[0]?.api_key?.[0]?.current_key;
if (!apiKey) {
  console.log('\nTidak ada API key di dalam file. Berhenti.\n');
  process.exit(1);
}

lalu(
  [
    `package_name : ${ANDROID_ID}`,
    `project_id   : ${isi.project_info?.project_id ?? '-'}`,
    `project_num  : ${isi.project_info?.project_number ?? '-'}`,
    `api key      : ada`,
  ].join('\n'),
  'Verifikasi file'
);

// 6. Baru sekarang app.json disentuh. Ada file dan sudah terverifikasi, jadi
//    urutan jebakan tadi tidak mungkin terjadi.
const appJson = JSON.parse(readFileSync(APP_JSON, 'utf8'));
if (appJson.expo?.android?.googleServicesFile) {
  lalu('sudah ada, tidak diubah', 'android.googleServicesFile');
} else {
  appJson.expo ??= {};
  appJson.expo.android ??= {};
  appJson.expo.android.googleServicesFile = './google-services.json';
  writeFileSync(APP_JSON, JSON.stringify(appJson, null, 2) + '\n');
  lalu('./google-services.json', 'android.googleServicesFile ditambahkan');
}

// 7. Tinggalkan Enum satu langkah yang benar-benar perlu orang: private key
//    service account. CLI tidak bisa mengunduhnya sendiri.
lalu(
  [
    `project_id     : ${isi.project_info?.project_id ?? '-'}`,
    `project_number : ${isi.project_info?.project_number ?? '-'}`,
    `api key        : ${apiKey}`,
    '',
    'Tinggal satu langkah manual:',
    '',
    '  Firebase console > Project settings > Service accounts >',
    '  Generate new private key. Isi tiga variabel ini di environment Vercel:',
    '',
    `  FCM_PROJECT_ID    = ${isi.project_info?.project_id ?? ''}`,
    '  FCM_CLIENT_EMAIL  = isi kolom Client email',
    '  FCM_PRIVATE_KEY   = isi kolom Private key, tiap baris dipisah \\n',
    '',
    'Lalu bangun ulang:',
    '',
    '  cd mobile && npx expo prebuild --platform android --clean',
    '  cd android && ./gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a',
  ].join('\n'),
  'Selesai, tinggal mengisi kredensial'
);