// Memeriksa kolom yang benar-benar dipakai aplikasi.
//
// Tabel bisa sudah ada sementara kolomnya belum: PostgREST balas 404 dengan
// kode PGRST204 kalau nama kolom tidak dikenal, jadi setiap kolom bisa dicek
// sendiri tanpa perlu password database.
//
// Jalankan: node --experimental-strip-types scripts/probe-kolom.mjs

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

// Kolom yang dibutuhkan fitur yang baru dikerjakan, plus kolom lama yang
// dipakai form jadwal.
const yangDicek = {
  profiles: [
    'id',
    'nama_lengkap',
    'email',
    'divisi',
    'jabatan',
    'role_akses',
    'status_akun',
  ],
  schedules: ['id', 'judul', 'slots', 'target_divisi', 'status'],
  todos: ['id', 'pemilik_id', 'teks', 'tanggal', 'selesai', 'created_at'],
  notifications: [
    'id',
    'jadwal_id',
    'pengirim_id',
    'penerima_id',
    'judul',
    'pesan',
    'target_divisi',
    'dibaca',
    'created_at',
  ],
};

console.log(`project : ${url}\n`);

let hilang = 0;

for (const [tabel, kolom] of Object.entries(yangDicek)) {
  console.log(tabel);

  for (const nama of kolom) {
    const alamat =
      `${url}/rest/v1/${tabel}` +
      `?select=${nama}&limit=1` +
      `&order=${nama}.asc`;

    const balasan = await fetch(alamat, {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
    });
    const badan = await balasan.text();

    let kode = '';
    try {
      kode = JSON.parse(badan).code ?? '';
    } catch {
      kode = '';
    }

    if (balasan.status === 200) {
      console.log(`  ${nama.padEnd(16)} ada`);
    } else {
      hilang += 1;
      console.log(`  ${nama.padEnd(16)} HILANG   HTTP ${balasan.status}  ${kode}`);
    }
  }
}

console.log(
  `\n${hilang === 0 ? 'Semua kolom yang dibutuhkan sudah ada.' : `${hilang} kolom masih hilang.`}`
);
process.exit(hilang === 0 ? 0 : 1);