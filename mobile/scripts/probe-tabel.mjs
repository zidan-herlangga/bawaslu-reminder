// Memeriksa tabel mana yang benar-benar sudah ada di project Supabase.
//
// PostgREST membalas 404 dengan kode PGRST205 kalau relasi tidak dikenal, dan
// membalas 200 kalau relasi ada. Itu perbedaan yang cukup untuk melihat apakah
// schema.sql sudah pernah dijalankan, tanpa perlu password database.
//
// Kredensial dibaca dari .env di root repo dan .env di mobile, karena keduanya
// dipakai. Nilai kuncinya tidak pernah dicetak.
//
// Jalankan: node --experimental-strip-types scripts/probe-tabel.mjs

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
const anon = ambilKunci('EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (!url) throw new Error('EXPO_PUBLIC_SUPABASE_URL tidak ditemukan');

console.log(`project : ${url}`);
console.log('kunci terbaca:');
console.log(`  service role : ${service ? 'ada' : 'TIDAK ADA'}`);
console.log(`  anon         : ${anon ? 'ada' : 'TIDAK ADA'}`);

const tabel = [
  'profiles',
  'schedules',
  'todos',
  'notifications',
  'push_subscriptions',
  'device_tokens',
];

async function cek(kunci, label) {
  console.log(`\n${label}`);
  const bearer = kunci ?? '';

  for (const nama of tabel) {
    const alamat = `${url}/rest/v1/${nama}?select=*&limit=1`;
    try {
      const balasan = await fetch(alamat, {
        headers: {
          apikey: bearer,
          Authorization: `Bearer ${bearer}`,
        },
      });
      const badan = await balasan.text();

      let catatan = '';
      try {
        const j = JSON.parse(badan);
        catatan = j.code ?? j.hint ?? (Array.isArray(j) ? '[]' : '');
      } catch {
        catatan = badan.slice(0, 60);
      }

      const status = balasan.status === 200 ? 'ADA' : `TIDAK ADA`;
      console.log(`  ${nama.padEnd(20)} ${status.padEnd(9)} HTTP ${balasan.status}  ${catatan}`);
    } catch (galat) {
      console.log(`  ${nama.padEnd(20)} GAGAL JALA   ${galat.message}`);
    }
  }
}

await cek(service, 'dengan service role (melewati RLS)');
await cek(anon, 'dengan anon key (meniru aplikasi)');