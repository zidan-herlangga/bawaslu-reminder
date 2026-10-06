// Menguji logika tanggal tugas.
//
// Jalankan: node --experimental-strip-types scripts/test-tugas.mjs

import {
  TAB_TUGAS,
  geserTanggal,
  kelompokTugas,
  keTanggalLokal,
  normalkanTanggal,
  tanggalDariDate,
  tanggalHariIni,
  visibleTugas,
} from '../src/shared/tugas.ts';

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

const tugas = (id, tanggal, selesai = false) => ({
  id,
  teks: `Tugas ${id}`,
  tanggal,
  selesai,
});

console.log('1. pemecahan tanggal');

cek('teks tanggal jadi tengah malam lokal', (() => {
  const d = keTanggalLokal('2026-03-10');
  return (
    d !== null &&
    d.getFullYear() === 2026 &&
    d.getMonth() === 2 &&
    d.getDate() === 10 &&
    d.getHours() === 0
  );
})());

cek('tanggal tidak sah ditolak', keTanggalLokal('2026-02-31') === null);
cek('tanggal tidak sah ditolak (bulan 13)', keTanggalLokal('2026-13-01') === null);
cek('bukan tanggal ditolak', keTanggalLokal('nanti') === null);
cek('kosong ditolak', keTanggalLokal('   ') === null);
cek('gagal di tahun kabisat', keTanggalLokal('2026-02-29') === null);
cek('lolos di tahun kabisat', keTanggalLokal('2024-02-29') !== null);
cek('tahun empat digit tidak dipetakan ke 1900-an', keTanggalLokal('0007-01-02') !== null);

console.log('2. tanggal dari Date');

// Semua Date di bawah dibuat dengan jam lokal. Kalau helpers-nya diam-diam
// memakai UTC, tanggal 23:30 akan bergeser ke hari lain dan nilai ini akan
// berbeda dari tanggal yang dimaksud.
cek('tanggal lokal dipertahankan', tanggalDariDate(new Date(2026, 9, 9, 23, 30)) === '2026-10-09');
cek('jam lokal dinormalkan ke tanggal yang sama', tanggalDariDate(new Date(2026, 0, 1, 0, 5)) === '2026-01-01');
cek('bulan selalu dua digit', tanggalDariDate(new Date(2026, 8, 5)) === '2026-09-05');
cek('tanggal hari ini dari now', tanggalHariIni(new Date(2026, 4, 17, 8, 0)) === '2026-05-17');

console.log('3. normalisasi nilai dari database');

cek('nilai sah dipertahankan', normalkanTanggal('2026-03-10') === '2026-03-10');
cek('spasi dibuang', normalkanTanggal('  2026-03-10 ') === '2026-03-10');
cek('kosong jadi null', normalkanTanggal('') === null);
cek('hanya spasi jadi null', normalkanTanggal('   ') === null);
cek('null jadi null', normalkanTanggal(null) === null);
cek('undefined jadi null', normalkanTanggal(undefined) === null);
cek('teks asing ditolak', normalkanTanggal('besok') === null);

console.log('4. geser tanggal');

cek('naik satu hari', geserTanggal('2026-03-10', 1) === '2026-03-11');
cek('turun satu hari', geserTanggal('2026-03-10', -1) === '2026-03-09');
cek('lompat bulan', geserTanggal('2026-01-31', 1) === '2026-02-01');
cek('lompat tahun', geserTanggal('2026-12-31', 1) === '2027-01-01');
cek('mundur tahun', geserTanggal('2026-01-01', -1) === '2025-12-31');
cek('kabisat dihitung benar', geserTanggal('2024-02-28', 1) === '2024-02-29');
cek('tahun non-kabisat', geserTanggal('2026-02-28', 1) === '2026-03-01');
cek('nilai rusak jatuh ke hari ini', geserTanggal('rusak', 3) === tanggalHariIni());

console.log('5. penyaring daftar');

const daftar = [
  tugas('a', '2026-03-10'),
  tugas('b', '2026-03-10', true),
  tugas('c', '2026-03-11'),
  tugas('d', null),
  tugas('e', '2026-03-10'),
];

const hariIni = visibleTugas(daftar, 'tanggal', '2026-03-10');
cek('tab tanggal hanya baris yang cocok', hariIni.length === 3);
cek('isi tab tanggal benar', hariIni.every((item) => item.tanggal === '2026-03-10'));
cek('tab semua mengembalikan semua', visibleTugas(daftar, 'semua', '2026-03-10').length === 5);
cek('tugas tanpa tanggal tidak muncul di tab tanggal', !hariIni.some((item) => item.id === 'd'));
cek('tab tanggal kosong untuk hari lain', visibleTugas(daftar, 'tanggal', '2026-04-01').length === 0);
cek('hasil filter bukan salinan daftar', visibleTugas(daftar, 'semua', '2026-03-10') !== daftar);

console.log('6. pembagian selesai dan belum');

const kelompok = kelompokTugas(daftar);
cek('belum selesai empat', kelompok.belum.length === 4);
cek('sudah selesai satu', kelompok.sudah.length === 1);
cek('persen dihitung dari yang terlihat', kelompok.persen === 20);
cek('daftar kosong tidak membagi nol', kelompokTugas([]).persen === 0);
cek('semua selesai seratus', kelompokTugas([tugas('x', '2026-03-10', true)]).persen === 100);
cek('setiap baris masuk salah satu kelompok', kelompok.belum.length + kelompok.sudah.length === daftar.length);
cek(
  'tugas tanpa tanggal tetap dihitung sebagai belum selesai',
  kelompok.belum.some((item) => item.id === 'd')
);

console.log('7. daftar tab');

cek('dua tab tersedia', TAB_TUGAS.length === 2);
cek('tab pertama tanggal', TAB_TUGAS[0].id === 'tanggal');
cek('tab kedua semua', TAB_TUGAS[1].id === 'semua');
cek('setiap tab punya label', TAB_TUGAS.every((tab) => tab.label.length > 0));

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);