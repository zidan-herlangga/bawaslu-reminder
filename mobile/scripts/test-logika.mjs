// Menguji aturan "waktu sudah lewat" dan pengurutan daftar jadwal di versi
// native.
//
// Versi web punya pengujian yang sama di scripts/urut-agenda (dihapus setelah
// dipakai). Fixtures di sini sengaja disalin apa adanya dari sana: kalau
// aturannya berubah di satu sisi dan tidak di sisi lain, pengujian ini yang
// akan menangkap.
//
// Jalankan: node --experimental-strip-types scripts/test-logika.mjs

import {
  getSlots,
  resolveAgenda,
  sesiSelesai,
  jadwalSelesai,
  kelasAgenda,
  sortByAgenda,
} from '../src/shared/slots.ts';

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

const JAM = 60 * 60 * 1000;
const NOW = Date.parse('2026-03-10T10:00:00.000Z');
const iso = (jamDariNow) => new Date(NOW + jamDariNow * JAM).toISOString();

console.log('1. sesiSelesai');
cek('mulai masih di masa depan', sesiSelesai({ mulai: iso(2), selesai: iso(3) }, NOW) === false);
cek('mulai dan selesai sudah lewat', sesiSelesai({ mulai: iso(-3), selesai: iso(-2) }, NOW) === true);
cek('mulai lewat, selesai nanti', sesiSelesai({ mulai: iso(-1), selesai: iso(1) }, NOW) === false);
cek('tanpa waktu selesai, mulai lewat', sesiSelesai({ mulai: iso(-1), selesai: null }, NOW) === true);
cek('tanpa waktu selesai, mulai nanti', sesiSelesai({ mulai: iso(1), selesai: null }, NOW) === false);
cek('slot rusak tidak dianggap selesai', sesiSelesai({ mulai: 'bukan tanggal', selesai: null }, NOW) === false);
cek('slot kosong tidak dianggap selesai', sesiSelesai({}, NOW) === false);
cek('slot null tidak dianggap selesai', sesiSelesai(null, NOW) === false);

console.log('\n2. jadwalSelesai');
cek('semua sesi lewat', jadwalSelesai({ waktu_mulai: iso(-4), waktu_selesai: iso(-3) }, NOW) === true);
cek(
  'ada sesi yang belum mulai',
  jadwalSelesai(
    {
      slots: [
        { mulai: iso(-2), selesai: iso(-1) },
        { mulai: iso(2), selesai: iso(3) },
      ],
    },
    NOW
  ) === false
);
cek('jadwal tanpa slot bukan selesai', jadwalSelesai({}, NOW) === false);

console.log('\n3. kelasAgenda');
cek('akan datang', kelasAgenda({ waktu_mulai: iso(3), waktu_selesai: iso(4) }, NOW) === 'upcoming');
cek('sedang berlangsung', kelasAgenda({ waktu_mulai: iso(-1), waktu_selesai: iso(2) }, NOW) === 'ongoing');
cek('sudah lewat', kelasAgenda({ waktu_mulai: iso(-4), waktu_selesai: iso(-3) }, NOW) === 'done');
cek(
  'tanpa waktu selesai tidak menggantung',
  kelasAgenda({ waktu_mulai: iso(-1), waktu_selesai: null }, NOW) === 'done'
);

console.log('\n4. masalah nyata: sesi tanpa selesai dulu menggantung');
const tanpaSelesai = { waktu_mulai: iso(-1), waktu_selesai: null };
cek('resolveAgenda lama bilang ongoing', resolveAgenda(getSlots(tanpaSelesai), NOW).state === 'ongoing');
cek('aturan baru bilang done', kelasAgenda(tanpaSelesai, NOW) === 'done');

console.log('\n5. sortByAgenda');
const data = [
  { id: 'lama', judul: 'Sudah lama selesai', waktu_mulai: iso(-30), waktu_selesai: iso(-29) },
  { id: 'akan1', judul: 'Besok pagi', waktu_mulai: iso(5), waktu_selesai: iso(6) },
  { id: 'baruLewat', judul: 'Baru saja selesai', waktu_mulai: iso(-1), waktu_selesai: iso(-0.5) },
  { id: 'jalan', judul: 'Sedang berjalan', waktu_mulai: iso(-1), waktu_selesai: iso(4) },
  { id: 'akan2', judul: 'Besok sore', waktu_mulai: iso(9), waktu_selesai: iso(10) },
];
const urut = sortByAgenda(data, NOW).map((s) => s.id);
cek('urutan lengkap benar', urut.join(',') === 'jalan,akan1,akan2,baruLewat,lama', urut.join(','));

const tetap = data.map((s) => s.id);
cek('array asal tidak berubah', tetap.join(',') === 'lama,akan1,baruLewat,jalan,akan2');

console.log('\n6. stabil ketika waktu berjalan');
const nanti = sortByAgenda(data, NOW + 6 * JAM).map((s) => s.id);
cek(
  'setelah 6 jam, yang berjalan jadi selesai',
  nanti.indexOf('jalan') > nanti.indexOf('akan2'),
  nanti.join(',')
);

console.log('\n7. kasus tepi');
cek('daftar kosong aman', Array.isArray(sortByAgenda([], NOW)));
cek('satu item aman', sortByAgenda([data[0]], NOW).length === 1);
cek('slot rusak tidak membuat melempar', (() => {
  try {
    sortByAgenda([{ id: 'X', slots: [{ mulai: 'ngawur', selesai: null }] }], NOW);
    return true;
  } catch {
    return false;
  }
})());

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
