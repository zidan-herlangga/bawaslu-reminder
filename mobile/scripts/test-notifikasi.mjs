// Menguji aturan dukungan notifikasi per lingkungan.
//
// Aturan ini menentukan apakah aplikasi boleh menyentuh expo-notifications sama
// sekali. Salah di sini berarti aplikasi crash tepat saat modul itu dimuat, jadi
// setiap cabang diuji.
//
// Jalankan: node --experimental-strip-types scripts/test-notifikasi.mjs

import {
  alasanTidakDidukung,
  notifikasiDidukung,
} from '../src/shared/dukunganNotifikasi.ts';

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

console.log('1. development build (bukan Expo Go)');
cek('android didukung', notifikasiDidukung('android', false) === true);
cek('ios didukung', notifikasiDidukung('ios', false) === true);
cek('tidak ada alasan', alasanTidakDidukung('android', false) === null);

console.log('\n2. Expo Go Android: tidak didukung sama sekali');
cek('android tidak didukung', notifikasiDidukung('android', true) === false);
cek('ada alasan', typeof alasanTidakDidukung('android', true) === 'string');
cek(
  'alasannya menyebut development build',
  alasanTidakDidukung('android', true)?.includes('development build') === true
);
cek(
  'alasannya jujur soal notifikasi lokal',
  alasanTidakDidukung('android', true)?.includes('lokal') === true
);

console.log('\n3. Expo Go iOS: hanya peringatan, jadi masih jalan');
cek('ios tetap didukung', notifikasiDidukung('ios', true) === true);
cek('tidak ada alasan di iOS', alasanTidakDidukung('ios', true) === null);

console.log('\n4. platform lain');
cek(
  'platform asing dianggap perlu development build',
  notifikasiDidukung('web', true) === false
);
cek(
  'platform asing tanpa Expo Go dianggap bisa',
  notifikasiDidukung('web', false) === true
);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
