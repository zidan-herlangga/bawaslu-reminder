// Membuat dan menghapus jadwal uji untuk memeriksa pengingat lokal.
//
// Pengingat dijadwalkan 15 menit sebelum jadwal dimulai (JENDELA_AWAL_MS di
// src/shared/pengingat.ts). Jadwal uji karena itu dibuat 14 menit lagi supaya
// masuk ke jendela itu dan notifikasi seharusnya muncul dalam hitungan detik
// setelah aplikasi dibuka.
//
// Pemakaian:
//   node --experimental-strip-types scripts/jadwal-uji.mjs buat
//   node --experimental-strip-types scripts/jadwal-uji.mjs hapus

import { execFileSync } from 'node:child_process';
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

const PENANDA = 'UJI PENGINGAT';
const MENIT = 14;

function header() {
  return {
    apikey: service,
    Authorization: `Bearer ${service}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

// Jam perangkat adalah acuan, bukan jam komputer, karena pengingat dihitung
// dari Date.now() di dalam aplikasi yang berjalan di perangkat.
function waktuPerangkat() {
  const mentah = execFileSync('adb', ['shell', 'date', '+%Y-%m-%dT%H:%M:%S%z'], {
    encoding: 'utf8',
  }).trim();

  // 2026-10-06T03:10:24+0700 -> 2026-10-06T03:10:24+07:00
  const denganTanda = `${mentah.slice(0, -2)}:${mentah.slice(-2)}`;
  const date = new Date(denganTanda);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Tidak bisa membaca waktu perangkat: ${mentah}`);
  }
  return date;
}

// schedules.pembuat_id tidak boleh null, jadi jadwal uji memakai id profil
// pertama yang ada. Jadwal ini tidak pernah diedit oleh pengguna sungguhan,
// jadi identitas pembuatnya tidak berpengaruh pada apa pun.
async function ambilPembuat() {
  const balasan = await fetch(
    `${url}/rest/v1/profiles?select=id,nama_lengkap,divisi&limit=1`,
    { headers: header() }
  );
  if (!balasan.ok) {
    throw new Error(`Gagal membaca profil: HTTP ${balasan.status}`);
  }
  const baris = await balasan.json();
  if (!baris.length) {
    throw new Error('Tidak ada profil. Buat akun lebih dulu.');
  }
  return baris[0];
}

async function buat() {
  const pembuat = await ambilPembuat();
  const sekarang = waktuPerangkat();
  const mulai = new Date(sekarang.getTime() + MENIT * 60 * 1000);
  const selesai = new Date(mulai.getTime() + 60 * 60 * 1000);

  console.log(`waktu perangkat   : ${sekarang.toString()}`);
  console.log(`pembuat           : ${pembuat.nama_lengkap}`);
  console.log(`slot mulai        : ${mulai.toISOString()} (${mulai.toString()})`);
  console.log(`slot selesai      : ${selesai.toISOString()}`);
  console.log(`jarak dari sekarang: ${MENIT} menit (jendela pengingat 15 menit)`);

  const balasan = await fetch(`${url}/rest/v1/schedules`, {
    method: 'POST',
    headers: header(),
    body: JSON.stringify({
      judul: `${PENANDA} - hapus setelah tes`,
      pembuat_id: pembuat.id,
      pembuat_nama: pembuat.nama_lengkap,
      pembuat_divisi: pembuat.divisi,
      deskripsi: 'Dibuat oleh jadwal-uji.mjs untuk memeriksa notifikasi lokal.',
      kategori: 'Lainnya',
      waktu_mulai: mulai.toISOString(),
      waktu_selesai: selesai.toISOString(),
      status: 'Aktif',
      target_divisi: null,
      slots: [{ mulai: mulai.toISOString(), selesai: selesai.toISOString() }],
    }),
  });

  console.log(`HTTP ${balasan.status}`);
  const data = await balasan.json();

  if (!balasan.ok) {
    console.log(JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`id jadwal uji     : ${data[0].id}`);
  console.log('\nBuka aplikasi sekarang, lalu tunggu sampai waktu slot.');
  console.log('Setelah selesai: node --experimental-strip-types scripts/jadwal-uji.mjs hapus');
}

async function hapus() {
  const balasan = await fetch(
    `${url}/rest/v1/schedules?judul=like.*${encodeURIComponent(PENANDA)}*`,
    {
      method: 'DELETE',
      headers: header(),
      Prefer: 'return=representation',
    }
  );

  console.log(`HTTP ${balasan.status}`);
  const data = await balasan.json();
  const jumlah = Array.isArray(data) ? data.length : 0;
  console.log(`jadwal uji dihapus: ${jumlah}`);

  if (jumlah > 0) {
    // Notifikasi ikut terhapus karena jadwalnya dihapus (kebijakan RLS).
    console.log('notifikasi yang menempel pada jadwal uji juga ikut hilang.');
  }
}

const perintah = process.argv[2];

if (perintah === 'buat') {
  await buat();
} else if (perintah === 'hapus') {
  await hapus();
} else {
  console.log('Pemakaian:');
  console.log('  node --experimental-strip-types scripts/jadwal-uji.mjs buat');
  console.log('  node --experimental-strip-types scripts/jadwal-uji.mjs hapus');
  process.exit(1);
}