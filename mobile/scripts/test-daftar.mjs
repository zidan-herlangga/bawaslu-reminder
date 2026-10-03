// Menguji validasi pendaftaran dan pemetaan galat auth.
//
// Isinya dipakai halaman Daftar dan Atur Ulang Password. Kalau salah satu
// kalimat berubah, penggunanya melihat pesan yang tidak sesuai dengan
// kebenarannya, jadi setiap aturan di sini diuji.
//
// Jalankan: node --experimental-strip-types scripts/test-daftar.mjs

import {
  KODE_BUATAN,
  PANJANG_MIN_SANDI,
  kalimatGalat,
  normalkanEmail,
  pesanGalatAuth,
  validasiPendaftaran,
  validasiSandiBaru,
} from '../src/shared/daftar.ts';

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

const SAH = {
  namaLengkap: 'Siti Aminah',
  email: 'siti@bpkp.go.id',
  divisi: 'Hukum',
  jabatan: 'Analis',
  sandi: 'rahasia123',
  ulangSandi: 'rahasia123',
};

console.log('1. data yang sah');
cek('tidak ada galat', validasiPendaftaran(SAH).length === 0);

console.log('\n2. nama lengkap');
cek(
  'kosong ditolak',
  validasiPendaftaran({ ...SAH, namaLengkap: '   ' }).includes('namaLengkapKosong')
);

console.log('\n3. email');
for (const email of ['', '   ']) {
  cek(
    'kosong ditolak',
    validasiPendaftaran({ ...SAH, email }).includes('emailKosong')
  );
}
for (const email of ['bukan-email', 'a@b', 'a b@c.id', '@b.id', 'a@.id', 'a@id.', 'a@@b.id']) {
  cek(
    `tidak sah ditolak: "${email}"`,
    validasiPendaftaran({ ...SAH, email }).includes('emailTidakValid'),
    email
  );
}
for (const email of ['a@b.id', 'siti.nur@bpkp.go.id', 'x@y.co.id']) {
  cek(
    `sah diterima: "${email}"`,
    !validasiPendaftaran({ ...SAH, email }).includes('emailTidakValid')
  );
}

console.log('\n4. kata sandi');
const pendek = 'a'.repeat(PANJANG_MIN_SANDI - 1);
const tepat = 'a'.repeat(PANJANG_MIN_SANDI);
cek(
  'lebih pendek dari minimum ditolak',
  validasiPendaftaran({ ...SAH, sandi: pendek, ulangSandi: pendek }).includes('sandiPendek')
);
cek(
  'tepat minimum diterima',
  !validasiPendaftaran({ ...SAH, sandi: tepat, ulangSandi: tepat }).includes('sandiPendek')
);
cek(
  'konfirmasi berbeda ditolak',
  validasiPendaftaran({ ...SAH, ulangSandi: 'beda' }).includes('sandiTidakSama')
);

console.log('\n5. beberapa galat sekaligus, kalimat pertama yang tampil');
const banyak = validasiPendaftaran({
  namaLengkap: '',
  email: 'rusak',
  sandi: '123',
  ulangSandi: '456',
});
cek('lebih dari satu galat dikembalikan', banyak.length === 4, `dapat ${banyak.length}`);
cek(
  'kalimat yang tampil sesuai galat pertama',
  kalimatGalat(banyak) === 'Nama lengkap wajib diisi.',
  kalimatGalat(banyak)
);
cek('tanpa galat menghasilkan kalimat kosong', kalimatGalat([]) === '');
cek('galat tak dikenal tidak membuat kalimat kosong', kalimatGalat(['entah']).trim().length > 0);

console.log('\n6. validasi sandi baru untuk halaman atur ulang');
cek('pendek ditolak', validasiSandiBaru('123').includes('sandiPendek'));
cek('cukup panjang diterima', validasiSandiBaru('rahasia123').length === 0);

console.log('\n7. normalisasi email');
cek('memangkas spasi', normalkanEmail('  a@b.id  ') === 'a@b.id');
cek('menurunkan huruf besar', normalkanEmail('A@B.ID') === 'a@b.id');

console.log('\n8. galat Supabase jadi kalimat yang bisa dibaca');
const kasus = [
  ['User already registered', 'sudah terdaftar'],
  ['Email rate limit exceeded', 'Terlalu banyak percobaan'],
  ['Signups not allowed for this instance', 'Pendaftaran dinonaktifkan'],
  ['Email not confirmed', 'belum dikonfirmasi'],
  ['Auth session missing', 'Sesi tidak ditemukan'],
  ['Failed to fetch', 'Gagal terhubung'],
  ['Password should be at least 6 characters', 'ditolak'],
  ['Unable to validate email address', 'Format email tidak valid'],
];
for (const [mentah, harusMuncul] of kasus) {
  const hasil = pesanGalatAuth({ message: mentah });
  cek(`"${mentah}" -> memuat "${harusMuncul}"`, hasil.includes(harusMuncul), hasil);
}

console.log('\n9. dua penanda buatan dari lapisan web');
const konfirmasi = pesanGalatAuth({ message: KODE_BUATAN.emailBelumDikonfirmasi });
cek(
  'konfirmasi email menjelaskan cara memperbaiki',
  konfirmasi.includes('Confirm email') && konfirmasi.includes('Authentication'),
  konfirmasi
);
const profil = pesanGalatAuth({ message: KODE_BUATAN.profilGagal });
cek('profil gagal menyuruh jalankan schema.sql', profil.includes('schema.sql'), profil);

console.log('\n10. galat tanpa pesan tidak membuat layar kosong');
cek('pesan kosong dijawab', pesanGalatAuth({}).length > 0);
cek('null dijawab', pesanGalatAuth(null).length > 0);
cek('teks biasa diteruskan', pesanGalatAuth('Sesuatu hal tak terduga') === 'Sesuatu hal tak terduga');

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);