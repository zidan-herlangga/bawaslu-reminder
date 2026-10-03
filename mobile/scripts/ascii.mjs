// Membersihkan karakter non-ASCII dari berkas konfigurasi dan sumber.
//
// Gangguan ini berulang muncul ketika teks ditulis lewat tool penulisan: tanda
// hubung kadang berubah menjadi em-dash. Untuk berkas JSON dan TypeScript hal
// itu merusak build, jadi ini dijalankan sebagai penjaga terakhir.
//
// Nama berkas yang sudah ASCII tapi isinya belum dicek akan ikut dibersihkan,
// jadi pemanggil harus menyebut hanya berkas yang memang boleh diubah.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const LEWATI = new Set([
  'node_modules',
  '.expo',
  'dist',
  'ios',
  'android',
  '.git',
  'assets',
]);

const EKSTENSI = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.md',
]);

function kumpulkan(target) {
  const stat = statSync(target);

  if (stat.isFile()) return EKSTENSI.has(extname(target)) ? [target] : [];

  if (!stat.isDirectory()) return [];

  const hasil = [];
  for (const nama of readdirSync(target)) {
    if (LEWATI.has(nama)) continue;
    hasil.push(...kumpulkan(join(target, nama)));
  }
  return hasil;
}

let total = 0;

for (const target of process.argv.slice(2)) {
  for (const berkas of kumpulkan(target)) {
    const asli = readFileSync(berkas, 'utf8');
    const bersih = asli.replace(/[^\x00-\x7F]/g, '-');

    if (bersih !== asli) {
      const jumlah = (asli.match(/[^\x00-\x7F]/g) ?? []).length;
      writeFileSync(berkas, bersih, 'utf8');
      console.log(`  ${berkas}: ${jumlah} karakter diganti`);
      total += jumlah;
    }
  }
}

console.log(total === 0 ? '  semua berkas sudah ASCII' : `  total ${total} karakter`);
