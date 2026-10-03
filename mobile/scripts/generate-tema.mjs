// Membuat tailwind.config.js dan src/tema/tokens.ts dari src/index.css milik
// aplikasi web.
//
// Kenapa perlu: aplikasi web memakai Tailwind CSS v4, tempat warnanya ditulis
// sebagai CSS variable di dalam @theme. NativeWind v4 yang stabil justru
// memakai konfigurasi Tailwind v3 lewat tailwind.config.js. Kalau warnanya
// ditulis dua kali, pasti akan menyimpang diam-diam: orang mengubah
// --bw-card di web, aplikasi native diam-diam masih memakai warna lama.
//
// Jadi file CSS web tetap jadi satu-satunya sumber kebenaran. Jalankan ulang
// skrip ini setiap kali ada perubahan warna.
//
// Warna diekspos sebagai CSS variable, bukan nilai hex. Dengan begitu
// pergantian tema cukup mengganti variabelnya; tidak perlu kelas dark: di mana
// mana. Nama warna memakai awalan "bw-" supaya nama kelasnya sama persis
// dengan web: bg-bw-card, text-bw-ink, border-bw-line.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DI_SINI = dirname(fileURLToPath(import.meta.url));
const AKAR_MOBILE = join(DI_SINI, '..');
const CSS_WEB = join(AKAR_MOBILE, '..', 'src', 'index.css');

const KELUARAN_KONFIG = join(AKAR_MOBILE, 'tailwind.config.js');
const KELUARAN_TOKENS = join(AKAR_MOBILE, 'src', 'tema', 'tokens.ts');

/** Membaca isi satu blok CSS, dari setelah tanda buka sampai kurung penutup. */
function bacaBlok(css, pembuka) {
  const mulai = css.indexOf(pembuka);
  if (mulai === -1) return null;

  const dariIsi = mulai + pembuka.length;
  const akhir = css.indexOf('}', dariIsi);
  if (akhir === -1) return null;

  return css.slice(dariIsi, akhir);
}

/** Mengambil pasangan --nama: nilai dari satu blok CSS. */
function bacaToken(blok) {
  const hasil = {};
  if (!blok) return hasil;

  for (const baris of blok.split('\n')) {
    const cocok = baris.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*;\s*$/i);
    if (!cocok) continue;
    if (!cocok[1].startsWith('--bw-')) continue;
    hasil[cocok[1].slice(2)] = cocok[2];
  }

  return hasil;
}

const css = readFileSync(CSS_WEB, 'utf8');

const terang = bacaToken(bacaBlok(css, ':root {'));
const gelap = bacaToken(bacaBlok(css, ":root[data-tema='gelap'] {"));
const themeBlok = bacaBlok(css, '@theme inline {');

// Hanya warna yang benar-benar dipetakan lewat @theme yang boleh dipakai,
// supaya class yang tersedia di native sama persis dengan yang ada di web.
const namaWarna = [];
for (const cocok of (themeBlok ?? '').matchAll(/--color-([a-z0-9-]+)\s*:/gi)) {
  namaWarna.push(cocok[1]);
}

const bayangan = [];
for (const cocok of (themeBlok ?? '').matchAll(
  /--shadow-([a-z0-9-]+)\s*:\s*var\(--([a-z0-9-]+)\)/gi
)) {
  bayangan.push({ nama: cocok[1], sumber: cocok[2] });
}

/**
 * Font tidak perlu ditiru.
 *
 * Web memakai stack font sistem, dan React Native juga memakai font sistem
 * sebagai bawaan: SF Pro di iOS, Roboto di Android. Menyalin nama seperti
 * "-apple-system" atau "BlinkMacSystemFont" justru merusak, karena itu bukan
 * nama font yang dipahami React Native dan akan jatuh ke font acak.
 *
 * Daftar nama yang|Publication di web hanya dicatat di sini supaya mudah
 * dibandingkan, bukan dipakai.
 */
const fontSansWeb = bacaFont('sans');
const fontDisplayWeb = bacaFont('display');

function bacaFont(namaToken) {
  const cocok = (themeBlok ?? '').match(
    new RegExp(`--font-${namaToken}\\s*:([^;]+);`, 'i')
  );
  if (!cocok) return [];

  return cocok[1]
    .split(',')
    .map((bagian) => bagian.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

// ------------------------------------------------------------- pemeriksaan

// Token yang tidak ditulis ulang di blok gelap sengaja diwarisi dari :root,
// sama seperti perilaku CSS biasa. --bw-red-solid adalah satu-satunya contoh:
// warnanya sengaja dikunci karena teks putih di atasnya harus tetap terbaca di
// kedua tema. Yang dianggap salah hanya token yang hilang di kedua blok.
const nilaiGelap = (nama) => gelap[nama] ?? terang[nama];

const masalah = [];

if (namaWarna.length === 0) {
  masalah.push('tidak ada satu pun --color-* di dalam @theme inline');
}

for (const nama of namaWarna) {
  if (!terang[nama]) masalah.push(`warna terang --${nama} tidak ada di :root`);
  if (!nilaiGelap(nama)) masalah.push(`warna --${nama} tidak ada di blok gelap`);
}

for (const { nama, sumber } of bayangan) {
  if (!terang[sumber]) masalah.push(`bayangan --${sumber} tidak ada di :root`);
  if (!nilaiGelap(sumber)) masalah.push(`bayangan --${sumber} tidak ada di blok gelap`);
}

if (masalah.length > 0) {
  console.error('Gagal membuat tema. Masalah di src/index.css:');
  for (const m of masalah) console.error(`  - ${m}`);
  process.exit(1);
}

// ------------------------------------------------------------ konfigurasi

const garisWarna = namaWarna
  .map((nama) => `        '${nama}': 'var(--${nama})',`)
  .join('\n');

const garisBayangan = bayangan
  .map(({ nama, sumber }) => `        '${nama}': 'var(--${sumber})',`)
  .join('\n');

const fontSans = bacaFont('sans');
const fontDisplay = bacaFont('display');
const CATATAN_FONT = `//
// Font tidak dioverride. Web memakai stack font sistem, dan React Native juga
// memakai font sistem sebagai bawaan: SF Pro di iOS, Roboto di Android.
// Menyalin nama seperti "-apple-system" akan merusak, karena itu bukan nama
// font yang dipahami React Native.
//
// Stack web --font-sans    : ${fontSansWeb.join(', ')}
// Stack web --font-display : ${fontDisplayWeb.join(', ')}`;

const configJs = `// DIBUAT OLEK scripts/generate-tema.mjs. Jangan disunting manual.
//
// Sumber: src/index.css (aplikasi web). Warna diekspos sebagai CSS variable
// supaya pergantian tema cukup mengganti variabelnya, tanpa kelas dark:.
${CATATAN_FONT}

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
${garisWarna}
      },
      boxShadow: {
${garisBayangan}
      },
    },
  },
  plugins: [],
};
`;

// ------------------------------------------------------------------ tokens

const objek = (daftar, ambil) =>
  daftar.map((nama) => `  '${nama}': '${ambil(nama)}',`).join('\n');

const tokensTs = `// DIBUAT OLEH scripts/generate-tema.mjs. Jangan disunting manual.
//
// Sumber: src/index.css (aplikasi web). Jalankan \`npm run tema\` di folder
// mobile setiap kali ada perubahan warna di web.
//
// Nilai ditulis lengkap, bukan sebagai rujukan, karena React Native tidak
// punya CSS variable milik DOM. Nilainya dipasang lewat NativeWind vars(),
// sehingga class seperti bg-bw-card ikut berubah otomatis saat temanya diganti.

export type NamaWarna =
${namaWarna.map((nama) => `  | '${nama}'`).join('\n')};

export const tokensTerang = {
${objek(namaWarna, (nama) => terang[nama])}
} as const satisfies Record<NamaWarna, string>;

export const tokensGelap = {
${objek(namaWarna, (nama) => nilaiGelap(nama))}
} as const satisfies Record<NamaWarna, string>;

export type NamaBayangan =
${bayangan.map(({ nama }) => `  | '${nama}'`).join('\n')};

export const bayanganTerang = {
${objek(
  bayangan.map((b) => b.nama),
  (nama) => {
    const cocok = bayangan.find((b) => b.nama === nama);
    return terang[cocok.sumber];
  }
)}
} as const satisfies Record<NamaBayangan, string>;

export const bayanganGelap = {
${objek(
  bayangan.map((b) => b.nama),
  (nama) => {
    const cocok = bayangan.find((b) => b.nama === nama);
    return nilaiGelap(cocok.sumber);
  }
)}
} as const satisfies Record<NamaBayangan, string>;
`;

mkdirSync(dirname(KELUARAN_TOKENS), { recursive: true });
writeFileSync(KELUARAN_KONFIG, configJs, 'utf8');
writeFileSync(KELUARAN_TOKENS, tokensTs, 'utf8');

console.log(
  `Tema dibuat: ${namaWarna.length} warna, ${bayangan.length} bayangan. ` +
    'Font memakai bawaan sistem.'
);
