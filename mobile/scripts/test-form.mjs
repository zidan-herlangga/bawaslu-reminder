// Menguji validasi formulir jadwal dan penyusunan payload.
//
// Aturan di sini harus sama persis dengan validate() di ScheduleForm.jsx milik
// web. Kalau aturannya berubah di satu sisi dan tidak di sisi lain, orang bisa
// menyimpan jadwal yang ditolak aplikasi lain.
//
// Berkas ini sengaja .mjs tanpa anotasi tipe: Node hanya menghapus tipe dari
// berkas .ts, bukan dari .mjs. Bentuk form di bawah dibuat sebagai objek biasa.
//
// Jalankan: node --experimental-strip-types scripts/test-form.mjs

import {
  BATAS_DESKRIPSI,
  BATAS_JUDUL,
  formDariJadwal,
  formKosong,
  susunPayload,
  validasiJadwal,
} from '../src/shared/validasiJadwal.ts';

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

const JAM = 3600 * 1000;
const DASAR = new Date('2026-04-01T09:00:00.000Z');

const jam = (n) => new Date(DASAR.getTime() + n * JAM);

function form(ubah = {}) {
  return { ...formKosong(), ...ubah };
}

function valid(ubah = {}) {
  return form({
    judul: 'Rapat Koordinasi',
    slots: [{ mulai: jam(0), selesai: jam(2) }],
    ...ubah,
  });
}

console.log('1. field wajib');
cek('judul kosong ditolak', validasiJadwal(form()).some((g) => g.jenis === 'judul'));
cek(
  'judul kosong pesannya sama dengan web',
  validasiJadwal(form()).find((g) => g.jenis === 'judul')?.pesan ===
    'Judul jadwal wajib diisi.'
);
cek('judul diisi lolos', validasiJadwal(valid()).length === 0);
cek(
  'judul hanya spasi dianggap kosong',
  validasiJadwal(form({ judul: '   ' })).some((g) => g.jenis === 'judul')
);

console.log('\n2. batas panjang');
cek(
  'judul melebihi batas ditolak',
  validasiJadwal(valid({ judul: 'a'.repeat(BATAS_JUDUL + 1) })).some(
    (g) => g.jenis === 'judul'
  )
);
cek(
  'judul tepat di batas diterima',
  validasiJadwal(valid({ judul: 'a'.repeat(BATAS_JUDUL) })).length === 0
);
cek(
  'deskripsi melebihi batas ditolak',
  validasiJadwal(valid({ deskripsi: 'a'.repeat(BATAS_DESKRIPSI + 1) })).some(
    (g) => g.jenis === 'deskripsi'
  )
);

console.log('\n3. sesi');
cek(
  'tanpa sesi ditolak',
  validasiJadwal(valid({ slots: [] })).some((g) => g.jenis === 'slots')
);
cek(
  'sesi tanpa mulai ditolak',
  validasiJadwal(valid({ slots: [{ mulai: null, selesai: null }] })).some(
    (g) => g.jenis === 'slot'
  )
);
cek(
  'mulai tidak valid ditolak',
  validasiJadwal(
    valid({ slots: [{ mulai: new Date('ngawur'), selesai: null }] })
  ).some((g) => g.jenis === 'slot')
);
cek(
  'selesai sebelum mulai ditolak',
  validasiJadwal(valid({ slots: [{ mulai: jam(3), selesai: jam(1) }] })).some(
    (g) => g.jenis === 'slot'
  )
);
cek(
  'selesai boleh sama dengan mulai',
  validasiJadwal(valid({ slots: [{ mulai: jam(1), selesai: jam(1) }] })).length === 0
);
cek(
  'sesi tanpa waktu selesai sah',
  validasiJadwal(valid({ slots: [{ mulai: jam(1), selesai: null }] })).length === 0
);
cek(
  'indeks sesi dilaporkan agar pesan muncul di baris yang benar',
  validasiJadwal(
    valid({
      slots: [
        { mulai: jam(0), selesai: null },
        { mulai: null, selesai: null },
      ],
    })
  ).find((g) => g.jenis === 'slot')?.indeksSlot === 1
);

console.log('\n4. target divisi');
cek(
  'divisi kosong ditolak',
  validasiJadwal(valid({ targetDivisi: '' })).some((g) => g.jenis === 'target')
);
cek(
  'null berarti semua staf dan sah',
  validasiJadwal(valid({ targetDivisi: null })).length === 0
);
cek(
  'divisi terpilih sah',
  validasiJadwal(valid({ targetDivisi: 'Hukum dan Penyelesaian Sengketa' })).length === 0
);

console.log('\n5. susun payload');
const payload = susunPayload(
  valid({
    judul: '  Rapat  ',
    deskripsi: ' --  ',
    slots: [
      { mulai: jam(0), selesai: jam(2) },
      { mulai: jam(5), selesai: null },
      { mulai: jam(3), selesai: jam(4) },
    ],
  })
);

cek('judul dipangkas', payload.judul === 'Rapat', payload.judul);
cek('deskripsi dipangkas', payload.deskripsi === '--', payload.deskripsi);
cek('tiga sesi tersimpan', payload.slots.length === 3);
cek(
  'waktu_mulai mengambil sesi paling awal',
  payload.waktu_mulai === jam(0).toISOString(),
  payload.waktu_mulai
);
cek(
  'waktu_selesai mengambil sesi yang paling akhir yang punya akhir',
  payload.waktu_selesai === jam(4).toISOString(),
  payload.waktu_selesai
);
cek('sesi tanpa akhir jadi null', payload.slots[1].selesai === null);
cek('target null diteruskan', payload.target_divisi === null);

const tanpaAkhir = susunPayload(
  valid({ slots: [{ mulai: jam(1), selesai: null }] })
);
cek('waktu_selesai null bila tidak ada sesi berakhir', tanpaAkhir.waktu_selesai === null);

let melempar = '';
try {
  susunPayload(form());
} catch (galat) {
  melempar = String(galat.message ?? galat);
}
cek('menyusun payload dari form tak valid melempar', melempar.includes('Judul jadwal wajib diisi'));

console.log('\n6. form dari jadwal tersimpan');
const dariSlots = formDariJadwal({
  judul: 'Rapat lama',
  kategori: 'Tugas',
  deskripsi: 'Catatan',
  target_divisi: null,
  slots: [
    { mulai: '2026-04-01T09:00:00.000Z', selesai: '2026-04-01T11:00:00.000Z' },
    { mulai: '2026-04-02T09:00:00.000Z', selesai: null },
  ],
});
cek('dua sesi terbaca', dariSlots.slots.length === 2);
cek('sesi jadi Date', dariSlots.slots[0].mulai instanceof Date);
cek('kategori ikut', dariSlots.kategori === 'Tugas');
cek('target null jadi null', dariSlots.targetDivisi === null);

const tanpaSlots = formDariJadwal({
  judul: 'Jadwal lama',
  waktu_mulai: '2026-04-01T09:00:00.000Z',
  waktu_selesai: '2026-04-01T10:00:00.000Z',
  slots: [],
});
cek('jadwal tanpa slots dibentuk dari waktu_mulai', tanpaSlots.slots.length === 1);
cek('waktu_selesai dipakai sebagai akhir', tanpaSlots.slots[0].selesai instanceof Date);

const rusak = formDariJadwal({ judul: 'X', slots: 'bukan array' });
cek('slots rusak tidak membuat form hangus', rusak.slots.length === 1);

console.log('\n7. bolak-balik tanpa kehilangan data');
const asli = valid({
  kategori: 'Pengawasan',
  targetDivisi: 'Hukum dan Penyelesaian Sengketa',
  deskripsi: 'Catatan penting',
});
const pulih = formDariJadwal(susunPayload(asli));
cek('judul pulih', pulih.judul === asli.judul);
cek('kategori pulih', pulih.kategori === asli.kategori);
cek('target pulih', pulih.targetDivisi === asli.targetDivisi);
cek('deskripsi pulih', pulih.deskripsi === asli.deskripsi);
cek('sesi pulih', pulih.slots.length === asli.slots.length);
cek(
  'waktu mulai pulih',
  pulih.slots[0].mulai?.toISOString() === asli.slots[0].mulai?.toISOString()
);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
