// Menguji lapisan runtime pengingat, khususnya normalisasi slot.
//
// Fungsi yang diuji tidak butuh React Native: sesiMasukJendela hanya
// --------- bentuk baris database dan memakai aturan dari shared/pengingat.
// Impor modul penuh akan menarik AppState, jadi hanya fungsi yang diambil.
//
// Jalankan: node --experimental-strip-types scripts/test-pengingat-runtime.mjs

import { sesiMasukJendela } from '../src/shared/pengingat.ts';

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

const T0 = Date.parse('2026-03-10T08:00:00.000Z');
const menit = (n) => n * 60 * 1000;
const iso = (ms) => (Number.isNaN(ms) ? 'bukan-tanggal' : new Date(ms).toISOString());

console.log('1. jadwal dengan kolom slots terisi');
const denganSlots = sesiMasukJendela(
  [
    {
      id: 'a',
      judul: 'Rapat',
      status: 'Aktif',
      waktu_mulai: iso(T0 + menit(5)),
      waktu_selesai: null,
      slots: [{ mulai: iso(T0 + menit(5)), selesai: null }],
    },
  ],
  T0
);
cek('satu kandidat', denganSlots.length === 1);
cek('judul terbaca', denganSlots[0]?.judul === 'Rapat');

console.log('\n2. jadwal tanpa slots, hanya waktu_mulai');
const tanpaSlots = sesiMasukJendela(
  [
    {
      id: 'b',
      judul: 'Sidak',
      status: 'Aktif',
      waktu_mulai: iso(T0 + menit(5)),
      waktu_selesai: null,
      slots: null,
    },
  ],
  T0
);
cek('tidak hilang begitu saja', tanpaSlots.length === 1);

console.log('\n3. slots kosong tapi waktu_mulai ada');
cek(
  'sumber ARRAY kosong tetap pakai waktu_mulai',
  sesiMasukJendela(
    [{ id: 'c', judul: 'x', status: 'Aktif', waktu_mulai: iso(T0 + menit(5)), waktu_selesai: null, slots: [] }],
    T0
  ).length === 1
);

console.log('\n4. jadwal tanpa waktu sama sekali');
cek(
  'tidak membuat kandidat, bukan galat',
  sesiMasukJendela(
    [{ id: 'd', judul: 'x', status: 'Aktif', waktu_mulai: null, waktu_selesai: null, slots: null }],
    T0
  ).length === 0
);

console.log('\n5. slot tanpa waktu mulai');
cek(
  'slot tanpa mulai dilewati',
  sesiMasukJendela(
    [{ id: 'e', judul: 'x', status: 'Aktif', waktu_mulai: null, waktu_selesai: null, slots: [{ mulai: null, selesai: null }] }],
    T0
  ).length === 0
);

console.log('\n6. slot di luar jendela diabaikan, yang di dalam diambil');
cek(
  'ambil slot pertama yang masuk jendela saja',
  sesiMasukJendela(
    [{ id: 'f', judul: 'x', status: 'Aktif', waktu_mulai: iso(T0 + menit(200)), waktu_selesai: null, slots: [{ mulai: iso(T0 + menit(200)), selesai: null }, { mulai: iso(T0 + menit(4)), selesai: null }] }],
    T0
  )[0]?.mulai === T0 + menit(4)
);

console.log('\n7. daftar kosong aman');
cek('tidak galat', sesiMasukJendela([], T0).length === 0);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);