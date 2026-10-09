// Menguji logika kotak masuk notifikasi.
//
// Semua aturan di sini murni: tidak ada perangkat, tidak ada jaringan, tidak ada
// komponen. Jalankan: node --experimental-strip-types scripts/test-kotak-notifikasi.mjs

import {
  MAKS_KOTAK_MASUK,
  adaptasiDaftarNotifikasi,
  adaptasiNotifikasi,
  gulungBalikKotak,
  hitungBelumDibaca,
  kotakAwal,
  notifikasiBaru,
  reducerKotak,
  tandaiSemuaDibaca,
  tandaiDibaca,
  hapusSemuaDariDaftar,
} from '../src/shared/kotakNotifikasi.ts';

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

const U = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';

// ---------------------------------------------------------------------------
console.log('\n1. penyesuaian baris dari database');
{
  const penuh = adaptasiNotifikasi({
    id: 'n1',
    judul: '  RapatKoordinasi  ',
    pesan: '  Berlokus di Ruang Melati  ',
    dibaca: false,
    created_at: '2026-03-10T08:00:00.000Z',
    jadwal_id: 'j1',
    schedules: { kategori: 'Rapat' },
  });
  cek('judul dipangkas', penuh.judul === 'RapatKoordinasi', penuh.judul);
  cek('pesan dipangkas', penuh.pesan === 'Berlokus di Ruang Melati');
  cek('kategori ikut terbaca', penuh.kategori === 'Rapat');
  cek('jadwalId ikut terbaca', penuh.jadwalId === 'j1');

  // Baris paling minim yang bisa muncul: kolom nullable, relasi tidak ada.
  const kosong = adaptasiNotifikasi({ id: 'n2', created_at: null });
  cek('judul kosong dapat nama cadangan', kosong.judul === 'Pengingat jadwal');
  cek('pesan kosong tetap kosong', kosong.pesan === '');
  cek('tanggal kosong tidak jadi Epoch', kosong.dibuatPada === '');
  cek('kategori kosong jadi null', kosong.kategori === null);
  cek('jadwalId kosong jadi null', kosong.jadwalId === null);

  // Dibaca null berarti belum dibaca, bukan sudah dibaca. Menguji dua arah ini
  // mencegah notifikasi hilang tanpa pernah terlihat.
  cek('dibaca null berarti belum dibaca', kosong.dibaca === false);
  cek('dibaca false berarti belum dibaca', penuh.dibaca === false);

  const sudahDibaca = adaptasiNotifikasi({ id: 'n4', dibaca: true });
  cek('dibaca true berarti sudah dibaca', sudahDibaca.dibaca === true);

  // Relasi bisa balik sebagai larik satu elemen kalau PostgREST disuruh ambil
  // satu-ke-banyak. Kalau hanya bentuk objek yang ditangani, kategori diam-diam
  // jadi null dan nada penginatannya salah.
  const relasiLarik = adaptasiNotifikasi({
    id: 'n3',
    schedules: [{ kategori: 'Tugas' }],
  });
  cek('relasi berbentuk larik ikut terbaca', relasiLarik.kategori === 'Tugas');
}

console.log('\n2. penyesuaian daftar dan pembuangan baris rusak');
{
  const daftar = adaptasiDaftarNotifikasi([
    { id: 'a', judul: 'Satu' },
    null,
    undefined,
    { judul: 'Tanpa id' },
    { id: 'b', judul: 'Dua' },
  ]);
  cek('baris tanpa id dibuang', daftar.length === 2, `panjang=${daftar.length}`);
  cek('urutan tetap', daftar[0].id === 'a' && daftar[1].id === 'b');
  cek('daftar kosong aman', adaptasiDaftarNotifikasi([]).length === 0);
}

console.log('\n3. hitung belum dibaca');
{
  cek('semua dibaca berarti nol', hitungBelumDibaca([{ dibaca: true }, { dibaca: true }]) === 0);
  cek('semuanya belum dibaca', hitungBelumDibaca([{ dibaca: false }, { dibaca: false }]) === 2);
  cek('campuran', hitungBelumDibaca([{ dibaca: true }, { dibaca: false }]) === 1);
  cek('daftar kosong', hitungBelumDibaca([]) === 0);
}

console.log('\n4. tandai sudah dibaca');
{
  const awal = [
    { id: 'a', judul: 'Satu', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null },
    { id: 'b', judul: 'Dua', pesan: '', dibaca: true, dibuatPada: '', jadwalId: null, kategori: null },
  ];

  const satu = tandaiDibaca(awal, 'a');
  cek('satu baris berubah', satu[0].dibaca === true);
  cek('baris lain tidak ikut berubah', satu[1].dibaca === true);

  // Larik lama harus tetap utuh: kalau diubah diam-diam, React tidak tahu ada yang
  // berubah dan layar tidak pernah bergambar ulang.
  cek('larik lama tidak ikut berubah', awal[0].dibaca === false);
  cek('larik baru berbeda dari yang lama', satu !== awal);

  cek('id yang tidak ada tidak merusak apa pun', tandaiDibaca(awal, 'hilang').length === 2);

  const semua = tandaiSemuaDibaca(awal);
  cek('semua jadi dibaca', semua.every((item) => item.dibaca));
  cek('tandai semua tidak mengubah asal', awal[0].dibaca === false);
}

console.log('\n5. notifikasi baru');
{
  const sekarang = [
    { id: 'baru', judul: '', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null },
    { id: 'lama', judul: '', pesan: '', dibaca: true, dibuatPada: '', jadwalId: null, kategori: null },
  ];

  // Pemuatan pertama tidak boleh membunyikan apa pun: baris lama yang baru dimuat
  // bukan kabar baru. Kalau ini salah, ponsel berbunyi setiap kali aplikasi dibuka.
  cek(
    'pemuatan pertama tidak ada yang baru',
    notifikasiBaru(sekarang, new Set(), true).length === 0
  );
  cek(
    'id yang belum pernah dilihat dianggap baru',
    notifikasiBaru(sekarang, new Set(['lama']), false)
      .map((item) => item.id)
      .join(',') === 'baru'
  );
  cek(
    'semua sudah pernah dilihat berarti tidak ada baru',
    notifikasiBaru(sekarang, new Set(['baru', 'lama']), false).length === 0
  );
  cek('daftar kosong tidak ada yang baru', notifikasiBaru([], new Set(), false).length === 0);

  // Baris lama yang baru ikut masuk jendela 30 teratas - misalnya karena baris
  // di atasnya dihapus - dibuat sebelum maksimum yang pernah dilihat. Menganggapnya
  // baru akan membunyikan suara pengingat untuk kabar lama.
  const berwaktu = [
    { id: 'naik', judul: '', pesan: '', dibaca: false, dibuatPada: '2026-03-10T08:00:00.000Z', jadwalId: null, kategori: null },
  ];
  cek(
    'baris lebih lama dari maksimum tidak dianggap baru',
    notifikasiBaru(berwaktu, new Set(), false, Date.parse('2026-03-11T00:00:00.000Z')).length === 0
  );
  cek(
    'baris lebih baru dari maksimum dianggap baru',
    notifikasiBaru(berwaktu, new Set(), false, Date.parse('2026-03-09T00:00:00.000Z')).length === 1
  );
  cek(
    'baris dengan waktu kosong tidak dianggap baru saat patokan ada',
    notifikasiBaru(berwaktu.map((item) => ({ ...item, dibuatPada: '' })), new Set(), false, 1).length === 0
  );
  // Tanpa patokan waktu, perilaku lama berlaku: id yang belum pernah dilihat
  // dianggap baru (kompatibilitas dengan pemanggil yang tidak tahu waktu).
  cek(
    'tanpa patokan waktu tetap memakai perilaku lama',
    notifikasiBaru(berwaktu, new Set(), false).length === 1
  );
}

console.log('\n6. batas jumlah kotak masuk');
{
  // Web memakai 30. Kalau mobile memakai angka lain, kedua sisi akan menampilkan
  // isi yang berbeda untuk akun yang sama.
  cek('batas 30 sama dengan web', MAKS_KOTAK_MASUK === 30);

  const isi = [{ id: 'a', judul: '', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null }];
  cek('hapus semua mengembalikan daftar kosong', hapusSemuaDariDaftar(isi).length === 0);
  cek('hapus semua tidak mengubah daftar asli', isi.length === 1);
}

console.log('\n7. reducer: muat dan ganti');
{
  const awal = kotakAwal();
  cek('awal kosong', awal.daftar.length === 0 && awal.userId === '');

  const baris = [{ id: 'a', judul: 'Satu', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null }];
  const setelah = reducerKotak(awal, { jenis: 'muat', userId: U, daftar: baris });
  cek('muat mengisi daftar', setelah.daftar.length === 1);
  cek('muat mencatat pemilik', setelah.userId === U);
  cek('muat tidak meninggalkan snapshot', setelah.gulungBalik === null);

  // Hasil muat baru menggantikan daftar sepenuhnya. Kalau status dibaca digabung
  // dengan penandaan optimistis yang belum sempat tersimpan, notifikasi bisa
  // tampil sudah dibaca padahal database bilang belum.
  const lain = [{ id: 'b', judul: 'Dua', pesan: '', dibaca: true, dibuatPada: '', jadwalId: null, kategori: null }];
  const ganti = reducerKotak(setelah, { jenis: 'muat', userId: U, daftar: lain });
  cek('muat baru menggantikan daftar', ganti.daftar.length === 1 && ganti.daftar[0].id === 'b');
}

console.log('\n8. reducer: tandai dan gulung balik');
{
  const baris = [
    { id: 'a', judul: 'Satu', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null },
    { id: 'b', judul: 'Dua', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null },
  ];
  const termuat = reducerKotak(kotakAwal(), { jenis: 'muat', userId: U, daftar: baris });

  const ditandai = reducerKotak(termuat, { jenis: 'tandai', userId: U, id: 'a' });
  cek('tandai mengubah satu baris', ditandai.daftar[0].dibaca === true);
  cek('baris lain tetap belum dibaca', ditandai.daftar[1].dibaca === false);
  cek('snapshot pembatalan tersimpan', ditandai.gulungBalik !== null);

  // Ini inti dari dua langkah: tampil lebih dulu, simpan, lalu kembalikan kalau
  // gagal. Tanpa snapshot, tampilan akan terus berbohong "sudah dibaca".
  const kembali = gulungBalikKotak(ditandai);
  cek('gulung balik mengembalikan status', kembali.daftar[0].dibaca === false);
  cek('gulung balik membuang snapshot', kembali.gulungBalik === null);

  // Snapshot yang sudah dipakai tidak boleh dipakai lagi, atau pembatalan yang
  // tidak terkait akan mengembalikan daftar ke kondisi usang.
  const dipakaiLangsung = gulungBalikKotak(kembali);
  cek('gulung balik kedua tidak mengubah apa pun', dipakaiLangsung === kembali);

  // Menandai yang sudah dibaca tidak mengubah apa pun dan tidak membuat snapshot.
  const sudah = reducerKotak(termuat, { jenis: 'tandai', userId: U, id: 'a' });
  const kedua = reducerKotak(sudah, { jenis: 'tandai', userId: U, id: 'a' });
  cek('tandai yang sama tidak membuat snapshot baru', kedua.gulungBalik === sudah.gulungBalik);

  const semua = reducerKotak(termuat, { jenis: 'tandaiSemua', userId: U });
  cek('tandai semua mengubah semuanya', semua.daftar.every((item) => item.dibaca));

  const semuaUDA = reducerKotak(semua, { jenis: 'tandaiSemua', userId: U });
  cek('tandai semua saat semuanya sudah dibaca tidak berubah', semuaUDA === semua);

  // Penghapusan seluruh kotak masuk: tampil kosong dulu, snapshot disimpan
  // untuk pengembalian kalau database menolak.
  const berisi = reducerKotak(kotakAwal(), { jenis: 'muat', userId: U, daftar: baris });
  const dikosongkan = reducerKotak(berisi, { jenis: 'hapusSemua', userId: U });
  cek('hapus semua mengosongkan daftar', dikosongkan.daftar.length === 0);
  cek('hapus semua menyimpan snapshot', dikosongkan.gulungBalik !== null);
  cek(
    'hapus semua tidak mengubah daftar asli',
    berisi.daftar.length === 2
  );
  const kembaliSemua = gulungBalikKotak(dikosongkan);
  cek('gulung balik mengembalikan daftar', kembaliSemua.daftar.length === 2);
  cek('gulung balik membuang snapshot', kembaliSemua.gulungBalik === null);

  const sudahKosong = reducerKotak(kotakAwal(), { jenis: 'muat', userId: U, daftar: [] });
  cek(
    'hapus semua saat kosong tidak mengubah apa pun',
    reducerKotak(sudahKosong, { jenis: 'hapusSemua', userId: U }) === sudahKosong
  );
}

console.log('\n9. reducer: pergantian staf');
{
  const baris = [{ id: 'a', judul: 'Satu', pesan: '', dibaca: false, dibuatPada: '', jadwalId: null, kategori: null }];
  const milikU = reducerKotak(kotakAwal(), { jenis: 'muat', userId: U, daftar: baris });

  // Aksi yang mengubah isi daftar harus ditolak untuk staf lain: kalau tidak,
  // menandai satu baris milik A bisa mengubah tampilan milik B.
  cek(
    'tandai untuk staf lain diabaikan',
    reducerKotak(milikU, { jenis: 'tandai', userId: U2, id: 'a' }) === milikU
  );
  cek(
    'tandai semua untuk staf lain diabaikan',
    reducerKotak(milikU, { jenis: 'tandaiSemua', userId: U2 }) === milikU
  );
  cek(
    'gulung balik untuk staf lain diabaikan',
    gulungBalikKotak(milikU) === milikU
  );

  // Tapi muat untuk staf berikutnya harus diterima. Kalau ikut ditolak, staf yang
  // baru masuk di perangkat ini akan melihat kotak kosong selamanya, karena state
  // lama tidak pernah dikosongkan.
  const milikU2 = reducerKotak(milikU, { jenis: 'muat', userId: U2, daftar: baris });
  cek('muat untuk staf berikutnya diterima', milikU2.userId === U2);
  cek('muat staf berikutnya mengisi daftar', milikU2.daftar.length === 1);
  cek('snapshot lama dibuang saat ganti staf', milikU2.gulungBalik === null);
}

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);