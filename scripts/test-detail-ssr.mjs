// Render nyata komponen lewat Vite SSR + react-dom/server.
//
// Berbeda dengan cek teks di skrip lain, di sini kode komponen benar-benar
// dijalankan: hooks dipanggil, JSX dievaluasi, semua import di-resolve. Kegagalan
// seperti variabel yang tidak terdefinisi akan melempar galat di sini, bukan
// lolos diam-diam sampai diklik pengguna.
//
// useEffect tidak berjalan di SSR, jadi pengurung fokus dan kunci gulir tidak
// diuji di sini. Itu diperiksa terpisah secara statis.
import { createServer } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

let lulus = 0;
let gagal = 0;
const cek = (n, ok, info = '') => {
  if (ok) lulus += 1;
  else {
    gagal += 1;
    console.log(`  [FAIL] ${n}${info ? ' -> ' + info : ''}`);
  }
};

const muat = async (path) => (await server.ssrLoadModule(path)).default;

const JAM = 3600 * 1000;
const SEKARANG = Date.parse('2026-03-10T10:00:00.000Z');
const iso = (j) => new Date(SEKARANG + j * JAM).toISOString();

function jadwal(overrides = {}) {
  return {
    id: 'jadwal-1',
    judul: 'Rapat Koordinasi Anggaran',
    deskripsi: 'Bahas pagu 2026 bersama seluruhDivision',
    kategori: 'Rapat',
    waktu_mulai: iso(-1),
    waktu_selesai: iso(1),
    slots: [
      { mulai: iso(-1), selesai: iso(1) },
      { mulai: iso(3), selesai: iso(4) },
    ],
    status: 'Aktif',
    pembuat_id: 'user-1',
    pembuat_nama: 'Budi Santoso',
    pembuat_divisi: 'SDM',
    target_divisi: 'SDM',
    ...overrides,
  };
}

const DetailJadwal = await muat('/src/components/DetailJadwal.jsx');
const ConfirmDialog = await muat('/src/components/ConfirmDialog.jsx');

const render = (Component, props) =>
  renderToStaticMarkup(h(Component, props));

console.log('1. Modal render tanpa galat');
let html = '';
try {
  html = render(DetailJadwal, {
    open: true,
    jadwal: jadwal(),
    sesi: { mulai: iso(-1), selesai: iso(1) },
    now: SEKARANG,
    userId: 'user-1',
    onTutup() {},
    onIngatkan() {},
    onUbah() {},
    onHapus() {},
    onBukaTanggal() {},
  });
  cek('tidak melempar galat', true);
} catch (e) {
  cek('tidak melempar galat', false, e.message);
}

console.log('\n2. Isi modal benar-benar ada di HTML');
cek('judul tampil', html.includes('Rapat Koordinasi Anggaran'));
cek('kategori tampil', html.includes('Rapat'));
cek('keterangan tampil', html.includes('Bahas pagu'));
cek('pembuat tampil', html.includes('Budi Santoso'));
cek('label waktu ada', html.includes('Waktu'));
cek('label keterangan ada', html.includes('Keterangan'));
cek('label pembuat ada', html.includes('Dibuat oleh'));
cek('label target ada', html.includes('Ditujukan untuk'));
cek('daftar sesi tampil', html.includes('Seluruh sesi (2)'));
cek('role dialog', html.includes('role="dialog"'));
cek('aria-modal', html.includes('aria-modal="true"'));
cek('tombol Tutup ada', html.includes('Tutup'));
cek('label aria tombol tutup', html.includes('Tutup detail jadwal'));

console.log('\n3. Badge Selesai ikut waktu, bukan status manual');
const sudahLewat = render(DetailJadwal, {
  open: true,
  jadwal: jadwal({
    waktu_mulai: iso(-4),
    waktu_selesai: iso(-3),
    slots: [{ mulai: iso(-4), selesai: iso(-3) }],
  }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
});
cek('badge Selesai muncul', sudahLewat.includes('Selesai'));
cek('status manual Aktif tidak memblokir badge', sudahLewat.includes('Rapat'));

const dibatalkan = render(DetailJadwal, {
  open: true,
  jadwal: jadwal({
    status: 'Dibatalkan',
    waktu_mulai: iso(3),
    waktu_selesai: iso(4),
    slots: [{ mulai: iso(3), selesai: iso(4) }],
  }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
});
cek('status Dibatalkan tampil', dibatalkan.includes('Dibatalkan'));
cek('tidak ada badge Selesai untuk yang masih akan datang', !dibatalkan.includes('Selesai'));

console.log('\n4. Aksi hanya untuk pemilik');
const milikSendiri = render(DetailJadwal, {
  open: true,
  jadwal: jadwal(),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
  onIngatkan() {},
  onUbah() {},
  onHapus() {},
});
cek('pemilik punya Ingatkan', milikSendiri.includes('Ingatkan'));
cek('pemilik punya Ubah', milikSendiri.includes('Ubah'));
cek('pemilik punya Hapus', milikSendiri.includes('Hapus'));

const milikOrangLain = render(DetailJadwal, {
  open: true,
  jadwal: jadwal(),
  now: SEKARANG,
  userId: 'user-99',
  onTutup() {},
  onIngatkan() {},
  onUbah() {},
  onHapus() {},
});
cek('bukan pemilik tidak punya Ingatkan', !milikOrangLain.includes('Ingatkan'));
cek('bukan pemilik tidak punya Ubah', !milikOrangLain.includes('Ubah'));
cek('bukan pemilik tidak punya Hapus', !milikOrangLain.includes('Hapus'));
cek('bukan pemilik tetap bisa baca waktu', milikOrangLain.includes('Waktu'));

console.log('\n5. Kasus tepi tidak melempar galat');
const kosongkan = (nama, props) => {
  try {
    render(DetailJadwal, props);
    cek(nama, true);
  } catch (e) {
    cek(nama, false, e.message);
  }
};
kosongkan('kalau ditutup', { open: false, jadwal: jadwal(), now: SEKARANG, onTutup() {} });
kosongkan('kalau jadwal null', { open: true, jadwal: null, now: SEKARANG, onTutup() {} });
kosongkan('tanpa sesi sama sekali', {
  open: true,
  jadwal: jadwal({ slots: [], waktu_mulai: null, waktu_selesai: null }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
});
kosongkan('tanpa keterangan', {
  open: true,
  jadwal: jadwal({ deskripsi: '' }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
  onIngatkan() {},
});
kosongkan('tanpa target divisi', {
  open: true,
  jadwal: jadwal({ target_divisi: null }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
});
kosongkan('satu sesi tanpa waktu selesai', {
  open: true,
  jadwal: jadwal({
    slots: [{ mulai: iso(-2), selesai: null }],
    waktu_mulai: iso(-2),
    waktu_selesai: null,
  }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
});
kosongkan('kategori di luar daftar', {
  open: true,
  jadwal: jadwal({ kategori: 'Tidak Dikenal' }),
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
  onIngatkan() {},
});

console.log('\n6. ConfirmDialog masih render (regresi)');
try {
  const cd = render(ConfirmDialog, {
    open: true,
    judul: 'Hapus jadwal?',
    pesan: 'Tidak bisa dibatalkan.',
    onBatal() {},
    onSetuju() {},
  });
  cek('render tanpa galat', cd.includes('Hapus jadwal?'));
  cek('ada tombol Hapus', cd.includes('>Hapus<'));
  cek('role alertdialog', cd.includes('role="alertdialog"'));
} catch (e) {
  cek('render tanpa galat', false, e.message);
}

console.log('\n7. Sesi ditandai sesuai yang diklik');
const sesiKedua = render(DetailJadwal, {
  open: true,
  jadwal: jadwal(),
  sesi: { mulai: iso(3), selesai: iso(4) },
  now: SEKARANG,
  userId: 'user-1',
  onTutup() {},
  onBukaTanggal() {},
});
cek('aria-current ada pada sesi aktif', sesiKedua.includes('aria-current="true"'));

await server.close();

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
