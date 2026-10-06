// Menguji pemilihan sesi yang dijadwalkan sebagai notifikasi sistem.
//
// Ini lapisan yang paling mudah rusak tanpa disadari. Kalau sesi tidak pernah
// dijadwalkan, tidak ada galat, tidak ada log, dan aplikasi tetap "jalan".
// Hanya bunyi yang tidak pernah keluar, dan itu sulit dilaporkan sebagai bug.
//
// Fungsi yang diuji, sesiMasukJendela dari shared/pengingat.ts, dipakai dua
// hal sekaligus:
//
//   - banner dalam aplikasi (lib/pengingat.ts)
//   - notifikasi sistem yang dijadwalkan ke OS (lib/notifikasi.ts)
//
// Karena keduanya memakai fungsi yang sama, kesalahan di sini hilang di dua
// tempat sekaligus. Notifikasi sistem memakai jendela 24 jam, bukan 15 menit
// seperti banner, dan bagian 4 mengujibedanya.
//
// Jalankan:
//   node --experimental-strip-types scripts/test-jadwal-sistem.mjs

import {
  sesiMasukJendela,
  normalisasiSlot,
} from '../src/shared/pengingat.ts';

let lulus = 0;
let gagal = 0;

const cek = (nama, ok, info = '') => {
  if (ok) {
    lulus += 1;
  } else {
    gagal += 1;
    console.log(`  [FAIL] ${nama}${info ? ' -> ' + info : ''}`);
  }
};

// Waktu dasar tetap supaya hasil tidak bergantung jam mesin.
const DASAR = Date.parse('2026-03-10T08:00:00.000Z');
const menit = (n) => n * 60 * 1000;
const jam = (n) => n * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

/** Jendela 24 jam, sama dengan yang dipakai lib/notifikasi.ts. */
const JENDELA_SISTEM_MS = 24 * jam(1);

const baris = (id, mulaiIso) => ({
  id,
  judul: `Jadwal ${id}`,
  status: 'Aktif',
  waktu_mulai: mulaiIso,
  waktu_selesai: null,
  slots: [],
});

console.log('1. sesi di masa depan masuk kandidat');
{
  const hasil = sesiMasukJendela([baris('a', iso(DASAR + jam(2)))], DASAR, JENDELA_SISTEM_MS);
  cek('sesi 2 jam lagi terpilih', hasil.length === 1, `panjang ${hasil.length}`);
  cek('judul ikut terbawa', hasil[0]?.judul === 'Jadwal a');
  cek('nadareedama datang', hasil[0]?.nada === 'mendatang');
  cek('jarak terhitung dalam milidetik', hasil[0]?.jarakMs === jam(2));
  cek('kunci memuat id dan waktu', hasil[0]?.kunci === `a@${DASAR + jam(2)}`);
}

console.log('\n2. sesi yang lewat dibiarkan lewat, bukan dipilih');
{
  cek(
    '2 jam lalu tidak terpilih',
    sesiMasukJendela([baris('a', iso(DASAR - jam(2)))], DASAR, JENDELA_SISTEM_MS).length === 0
  );
}

console.log('\n3. hanya status Aktif');
{
  const batal = { ...baris('a', iso(DASAR + jam(2))), status: 'Dibatalkan' };
  cek(
    'Dibatalkan tidak dijadwalkan',
    sesiMasukJendela([batal], DASAR, JENDELA_SISTEM_MS).length === 0
  );

  const selesai = { ...baris('a', iso(DASAR + jam(2))), status: 'Selesai' };
  cek(
    'Selesai tidak dijadwalkan',
    sesiMasukJendela([selesai], DASAR, JENDELA_SISTEM_MS).length === 0
  );
}

console.log('\n4. jendela 24 jam lebih luas dari jendela banner');
{
  // Sesi 8 jam ke depan: di luar jendela banner 15 menit, tapi di dalam
  // jendela notifikasi sistem. Inilah yang membuat notifikasi sistem berguna:
  // pengingat bisa dibuat jauh-jauh hari sebelum waktunya.
  const delapanJam = baris('a', iso(DASAR + jam(8)));

  cek(
    'tidak masuk jendela banner 15 menit',
    sesiMasukJendela([delapanJam], DASAR, 15 * menit(1)).length === 0
  );
  cek(
    'masuk jendela sistem 24 jam',
    sesiMasukJendela([delapanJam], DASAR, JENDELA_SISTEM_MS).length === 1
  );
}

console.log('\n5. jadwal berlapis: satu sesi yang paling awal');
{
  const berlapis = {
    id: 'b',
    judul: 'Jadwal berlapis',
    status: 'Aktif',
    waktu_mulai: iso(DASAR + jam(5)),
    waktu_selesai: null,
    slots: [
      { mulai: iso(DASAR + jam(5)), selesai: null },
      { mulai: iso(DASAR + jam(1)), selesai: null },
      { mulai: iso(DASAR - jam(3)), selesai: null },
    ],
  };

  const hasil = sesiMasukJendela([berlapis], DASAR, JENDELA_SISTEM_MS);
  cek('satu jadwal menghasilkan satu pengingat', hasil.length === 1, `panjang ${hasil.length}`);
  cek(
    'sesi yang dipilih adalah yang paling awal di masa depan',
    hasil[0]?.mulai === DASAR + jam(1),
    `dipilih ${hasil[0]?.mulai}`
  );
}

console.log('\n6. beberapa jadwal diurutkan dari yang paling dekat');
{
  const hasil = sesiMasukJendela(
    [
      baris('jauh', iso(DASAR + jam(10))),
      baris('dekat', iso(DASAR + jam(1))),
      baris('tengah', iso(DASAR + jam(5))),
    ],
    DASAR,
    JENDELA_SISTEM_MS
  );

  cek('ketiganya terpilih', hasil.length === 3, `panjang ${hasil.length}`);
  cek(
    'terurut dari yang paling dekat',
    hasil[0]?.kunci.startsWith('dekat') === true,
    `pertama ${hasil[0]?.kunci}`
  );
  cek(
    'yang terakhir adalah yang terjauh',
    hasil[2]?.kunci.startsWith('jauh') === true,
    `terakhir ${hasil[2]?.kunci}`
  );
}

console.log('\n7. waktu tidak valid dilewati, bukan membuat galat');
{
  const rusak = baris('a', 'bukan-tanggal');
  cek('tidak melempar galat', (() => {
    try {
      sesiMasukJendela([rusak], DASAR, JENDELA_SISTEM_MS);
      return true;
    } catch {
      return false;
    }
  })());
  cek('hasil kosong', sesiMasukJendela([rusak], DASAR, JENDELA_SISTEM_MS).length === 0);
}

console.log('\n8. baris tanpa waktu sama sekali');
{
  const kosong = { ...baris('a', iso(DASAR + jam(2))), waktu_mulai: null, slots: [] };
  cek('tidak dipilih', sesiMasukJendela([kosong], DASAR, JENDELA_SISTEM_MS).length === 0);
}

console.log('\n9. slot tanpa id dilewati');
{
  const tanpaId = [{ ...baris('a', iso(DASAR + jam(2))), id: '' }];
  cek('tidak dipilih', sesiMasukJendela(tanpaId, DASAR, JENDELA_SISTEM_MS).length === 0);
}

console.log('\n10. slot dipakai kalau waktu_mulai kosong');
{
  const hanyaSlot = {
    id: 'c',
    judul: 'Hanya slot',
    status: 'Aktif',
    waktu_mulai: null,
    waktu_selesai: null,
    slots: [{ mulai: iso(DASAR + jam(3)), selesai: null }],
  };

  cek(
    'slot terbaca sebagai sumber waktu',
    sesiMasukJendela([hanyaSlot], DASAR, JENDELA_SISTEM_MS).length === 1
  );
  cek(
    'normalisasiSlot mengembalikan slot itu',
    normalisasiSlot(hanyaSlot).length === 1
  );
}

console.log('\n11. slot kosong diabaikan dan kolom utama jadi cadangan');
{
  const campur = {
    id: 'd',
    judul: 'Campuran',
    status: 'Aktif',
    waktu_mulai: iso(DASAR + jam(4)),
    waktu_selesai: null,
    slots: [{ mulai: null, selesai: null }],
  };

  cek('slot null diabaikan', normalisasiSlot(campur).length === 1);
  cek('waktu_mulai dipakai', sesiMasukJendela([campur], DASAR, JENDELA_SISTEM_MS).length === 1);
}

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);