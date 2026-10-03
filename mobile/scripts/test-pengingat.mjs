// Menguji logika pengingat.
//
// Ini satu-satunya mekanisme pengingat yang jalan di Expo Go Android, jadi
// keputusan kapan harus delegasi ke pengguna diuji satu per satu.
//
// Jalankan: node --experimental-strip-types scripts/test-pengingat.mjs

import {
  AMBANG_TELAT_MS,
  formatSelisih,
  kalimatPengingat,
  kandidatPengingat,
  kunciBolehDilupakan,
  yangBelumDitampilkan,
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

const T0 = Date.parse('2026-03-10T08:00:00.000Z');
const menit = (n) => n * 60 * 1000;
// Sadar diri: kasus "waktu tidak valid" harus bisa lewat tanpa meledak di
// helper dulu, supaya yang diuji benar-benar penanganan di pengingat.ts.
const iso = (ms) =>
  Number.isNaN(ms) ? 'bukan-tanggal' : new Date(ms).toISOString();

const jadwal = (id, mulaiMs, tambahan = {}) => ({
  id,
  judul: `Jadwal ${id}`,
  status: 'Aktif',
  slots: [{ mulai: iso(mulaiMs), selesai: null }],
  ...tambahan,
});

console.log('1. jendela pengingat');
cek(
  'sesi 5 menit lagi masuk',
  kandidatPengingat([jadwal('a', T0 + menit(5))], T0).length === 1
);
cek(
  'nadanya mendatang',
  kandidatPengingat([jadwal('a', T0 + menit(5))], T0)[0]?.nada === 'mendatang'
);
cek(
  'sesi 30 menit lagi tidak masuk',
  kandidatPengingat([jadwal('a', T0 + menit(30))], T0).length === 0
);
cek(
  'tepat di batas 15 menit masih masuk',
  kandidatPengingat([jadwal('a', T0 + menit(15))], T0).length === 1
);

console.log('\n2. sesi yang sudah lewat');
cek(
  'sesi 3 menit lalu masih layak diingatkan',
  kandidatPengingat([jadwal('a', T0 - menit(3))], T0).length === 1
);
cek(
  'nadanya berlangsung',
  kandidatPengingat([jadwal('a', T0 - menit(3))], T0)[0]?.nada === 'berlangsung'
);
cek(
  'sesi 90 menit lalu tidak diingatkan',
  kandidatPengingat([jadwal('a', T0 - menit(90))], T0).length === 0
);
cek(
  'tepat di batas telat masih diingatkan',
  kandidatPengingat([jadwal('a', T0 - AMBANG_TELAT_MS)], T0).length === 1
);

console.log('\n3. status jadwal');
cek(
  'Dibatalkan tidak diingatkan',
  kandidatPengingat([jadwal('a', T0 + menit(5), { status: 'Dibatalkan' })], T0)
    .length === 0
);
cek(
  'Selesai tidak diingatkan',
  kandidatPengingat([jadwal('a', T0 + menit(5), { status: 'Selesai' })], T0)
    .length === 0
);
cek(
  'status null tetap diingatkan, jangan dilewati diam-diam',
  kandidatPengingat([jadwal('a', T0 + menit(5), { status: null })], T0).length ===
    1
);

console.log('\n4. data rusak tidak boleh membuat galat');
cek(
  'waktu tidak valid dilewati',
  kandidatPengingat([jadwal('a', NaN)], T0).length === 0
);
cek(
  'tanpa id dilewati',
  kandidatPengingat([{ judul: 'x', slots: [{ mulai: iso(T0) }] }], T0).length === 0
);
cek('tanpa slot dilewati', kandidatPengingat([{ id: 'a', judul: 'x', slots: [] }], T0).length === 0);
cek('null dan undefined dilewati', kandidatPengingat([null, undefined], T0).length === 0);
cek(
  'judul kosong tidak bikin teks kosong',
  kandidatPengingat([jadwal('a', T0 + menit(5), { judul: '   ' })], T0)[0]
    ?.judul === '(tanpa judul)'
);

console.log('\n5. jadwal berlapis: satu pengingat per sesi, bukan per jadwal');
const berlapis = kandidatPengingat(
  [
    jadwal('a', T0 + menit(3), {
      slots: [
        { mulai: iso(T0 + menit(240)), selesai: null },
        { mulai: iso(T0 + menit(3)), selesai: null },
        { mulai: iso(T0 + menit(120)), selesai: null },
      ],
    }),
  ],
  T0
);
cek('hanya menghasilkan satu kandidat', berlapis.length === 1);
cek('yang dipilih sesi paling awal', berlapis[0]?.mulai === T0 + menit(3));

console.log('\n6. dua jadwal berbeda boleh dua-duanya');
const duaJadwal = kandidatPengingat(
  [jadwal('a', T0 + menit(10)), jadwal('b', T0 + menit(2))],
  T0
);
cek('dua kandidat', duaJadwal.length === 2);
cek('terurut dari yang paling dekat', duaJadwal[0]?.jadwalId === 'b');

console.log('\n7. tidak menampilkan dua kali untuk sesi yang sama');
const sekali = kandidatPengingat([jadwal('a', T0 + menit(5))], T0);
cek('pertama kali lolos', yangBelumDitampilkan(sekali, new Set()).length === 1);
cek(
  'kedua kali ditahan',
  yangBelumDitampilkan(sekali, new Set([sekali[0].kunci])).length === 0
);
cek(
  'sesi lain tidak ikut tertahan',
  yangBelumDitampilkan(sekali, new Set(['lain@123'])).length === 1
);

console.log('\n8. melupakan kunci yang sudah lewat');
cek(
  'kunci lama boleh dilupakan',
  kunciBolehDilupakan(sekali, T0 + menit(60)).length === 1
);
cek(
  'kunci yang baru tampil tidak boleh dilupakan',
  kunciBolehDilupakan(sekali, T0).length === 0
);

console.log('\n9. teks pengingat');
cek(
  'sesi mendatang disebut mulai',
  kalimatPengingat(sekali[0]).includes('dimulai')
);
cek(
  'sesi berjalan disebut sedang berjalan',
  kalimatPengingat({
    kunci: 'k',
    jadwalId: 'a',
    judul: 'Rapat',
    mulai: T0,
    jarakMs: -60_000,
    nada: 'berlangsung',
  }) === 'Rapat sedang berjalan.'
);

console.log('\n10. format selisih');
cek('kurang dari semenit', formatSelisih(5000) === 'kurang dari satu menit');
cek('semenit', formatSelisih(menit(1)) === '1 menit');
cek('sepuluh menit', formatSelisih(menit(10)) === '10 menit');
cek('satu jam', formatSelisih(menit(60)) === '1 jam');
cek('jam dan menit', formatSelisih(menit(130)) === '2 jam 10 menit');
cek('satu hari', formatSelisih(menit(60 * 24)) === '1 hari');
cek('hari dan jam', formatSelisih(menit(60 * 30)) === '1 hari 6 jam');
cek(
  'nilai negatif tidak jadi minus',
  formatSelisih(-60_000) === 'kurang dari satu menit'
);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
