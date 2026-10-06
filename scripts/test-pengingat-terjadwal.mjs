// Menguji api/pengingat-terjadwal.js tanpa server dan tanpa database.
//
// Fungsinya handler Vercel, jadi yang diuji adalah dua aturan murni di dalamnya:
// penentuannya kapan sebuah jadwal waktunya, dan klaim pengingat terhadap
// penerima yang sudah diberi tahu.
//
// Aturan kedua ini yang paling mudah rusak dan paling menyebalkan kalau rusak:
// cron berjalan setiap menit, dan kalau pengaman ini hilang, setiap staf
// menerima notifikasi berulang sampai jendela 15 menit habis.
//
// Jalankan: node --test scripts/test-pengingat-terjadwal.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

const { waktuDalamJendela } = await import('../api/pengingat-terjadwal.js');
const { penerimaSudahDiberiTahu, susunPesan, jamWIB } = await import('../api/lib/kirim-pengingat.js');

const AWAL = new Date('2026-10-06T00:00:00.000Z').getTime();

function jadwal(waktuMulai, slots = null) {
  return {
    id: 'a0000000-0000-0000-0000-000000000000',
    judul: 'Rapat Mingguan',
    kategori: 'Rapat',
    waktu_mulai: waktuMulai,
    target_divisi: null,
    pembuat_id: 'b0000000-0000-0000-0000-000000000000',
    slots,
  };
}

// --- jendela pengingat -------------------------------------------------------

test('14 menit lagi sudah masuk jendela', () => {
  assert.equal(
    waktuDalamJendela(jadwal('2026-10-06T00:14:00.000Z'), AWAL),
    new Date('2026-10-06T00:14:00.000Z').getTime()
  );
});

test('tepat di batas 15 menit ke depan masih dihitung', () => {
  assert.equal(
    waktuDalamJendela(jadwal('2026-10-06T00:15:00.000Z'), AWAL),
    new Date('2026-10-06T00:15:00.000Z').getTime()
  );
});

test('16 menit lagi belum waktunya', () => {
  assert.equal(waktuDalamJendela(jadwal('2026-10-06T00:16:00.000Z'), AWAL), null);
});

test('10 menit lalu masih dihitung sebagai telat', () => {
  assert.notEqual(waktuDalamJendela(jadwal('2026-10-05T23:50:00.000Z'), AWAL), null);
});

test('20 menit lalu sudah terlalu lewat', () => {
  assert.equal(waktuDalamJendela(jadwal('2026-10-05T23:40:00.000Z'), AWAL), null);
});

test('jauh di masa depan tidak pernah masuk', () => {
  assert.equal(waktuDalamJendela(jadwal('2026-12-01T00:00:00.000Z'), AWAL), null);
});

// --- slot lebih diprioritaskan daripada waktu_mulai --------------------------

test('slot dipakai, bukan waktu_mulai', () => {
  const denganSlot = jadwal('2026-10-06T00:13:00.000Z', [
    { mulai: '2026-10-06T00:13:00.000Z', selesai: null },
  ]);
  assert.equal(
    waktuDalamJendela(denganSlot, AWAL),
    new Date('2026-10-06T00:13:00.000Z').getTime()
  );
});

test('waktu_mului di jendela tapi slot-nya tidak, tidak dikirim', () => {
  // Slot-nya besok. Kalau waktu_mulai yang dipakai, jadwal ini terkirim salah.
  const denganSlot = jadwal('2026-10-06T00:13:00.000Z', [
    { mulai: '2026-10-07T00:00:00.000Z', selesai: null },
  ]);
  assert.equal(waktuDalamJendela(denganSlot, AWAL), null);
});

test('slot kosong atau rusak tidak membuat jadwal crash', () => {
  for (const slots of [null, [], [{}], [{ mulai: 'bukan tanggal' }]]) {
    assert.equal(waktuDalamJendela(jadwal('2026-10-06T00:14:00.000Z', slots), AWAL), new Date('2026-10-06T00:14:00.000Z').getTime());
  }
});

// --- pengaman duplikat ------------------------------------------------------

const PESAN = susunPesan(jadwal('2026-10-06T00:14:00.000Z'), '2026-10-06T00:14:00.000Z');

test('penerima yang sudah diberi tahu dikenali', () => {
  const rows = [
    { penerima_id: 'p1', pesan: PESAN },
    { penerima_id: 'p2', pesan: PESAN },
  ];
  assert.deepEqual([...penerimaSudahDiberiTahu(rows, PESAN)].sort(), ['p1', 'p2']);
});

test('pesan berbeda tidak dianggap sudah terkirim', () => {
  // Slot berbeda pada jadwal yang sama adalah pengingat yang berbeda dan harus
  // tetap dikirim meski jadwalnya sama.
  const lain = susunPesan(jadwal('2026-10-06T08:00:00.000Z'), '2026-10-06T08:00:00.000Z');
  const rows = [{ penerima_id: 'p1', pesan: lain }];
  assert.equal(penerimaSudahDiberiTahu(rows, PESAN).size, 0);
});

test('daftar kosong berarti tidak ada yang tertahan', () => {
  assert.equal(penerimaSudahDiberiTahu([], PESAN).size, 0);
  assert.equal(penerimaSudahDiberiTahu(null, PESAN).size, 0);
});

test('penerima yang belum ada di daftar tetap dikirim', () => {
  const rows = [{ penerima_id: 'p1', pesan: PESAN }];
  const semua = [{ id: 'p1' }, { id: 'p2' }];
  const sudah = penerimaSudahDiberiTahu(rows, PESAN);
  const terkirim = semua.filter((item) => !sudah.has(item.id)).map((item) => item.id);
  assert.deepEqual(terkirim, ['p2']);
});

// --- format pesan ------------------------------------------------------------

test('waktu pesan ditulis dalam WIB, bukan UTC', () => {
  // 00:14 UTC = 07:14 WIB. Kalau salah, jam di notifikasi meleset tujuh jam
  // dan staf datang ke tempat yang salah.
  assert.match(jamWIB('2026-10-06T00:14:00.000Z'), /Selasa, 6 Oktober 2026, 07\.14 WIB/);
});

test('tanpa target_divisi disebut semua staf', () => {
  assert.match(susunPesan(jadwal('2026-10-06T00:14:00.000Z'), '2026-10-06T00:14:00.000Z'), /semua staf/);
});