// Memastikan realtime benar-benar siap, bukan hanya--- benar di kode.
//
// dua masalah yang sama persis sudah terjadi di repo ini:
//
// 1. Kode berlangganan postgres_changes di beberapa tabel, tapi tabel itu tidak
//    pernah masuk publication supabase_realtime. Channel tetap SUBSCRIBED,
// Tidak ada yang bisa memberi tahu kalau realtime-nya mati.
//    kalau realtime-nya mati.
//
// 2. sebuah tabel ditambahkan ke kode, lalu dilupakan di SQL. atau sebaliknya.
//
// Test ini menutup keduanya dengan mencocokkan dua sumber:
//   - tabel yang disubscribe di kode
//   - tabel yang didaftarkan ke publication di schema.sql
//
// Kalau hanya salah satu yang punya, test ini gagal dengan menyebut keduanya.
//
// Jalankan: node scripts/test-realtime.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

let lulus = 0;
let gagal = 0;

const cek = (nama, ok, info = '') => {
  if (ok) {
    lulus += 1;
  } else {
    gagal += 1;
    console.log(`  [FAIL] ${nama}${info ? '\n         ' + info : ''}`);
  }
};

/** Semua berkas sumber di dalam direktori, rekursif. */
function kumpulkan(dir, ekstensi, hasil = []) {
  for (const nama of readdirSync(dir)) {
    if (['node_modules', '.expo', 'dist', '.git'].includes(nama)) continue;

    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) {
      kumpulkan(penuh, ekstensi, hasil);
    } else if (ekstensi.includes(extname(nama))) {
      hasil.push(penuh);
    }
  }
  return hasil;
}

/** Tabel yang disubscribe lewat postgres_changes di sebuah berkas. */
function tabelDisubscribe(kode) {
  const hasil = new Set();

  // Bentuk yang dipakai supabase-js: { event: '*', schema: 'public', table: 'x' }
  for (const m of kode.matchAll(/table:\s*'([a-z_]+)'/g)) {
    hasil.add(m[1]);
  }

  // Bentuk konfigurasi yang disederhanakan: ['schedules'] atau ['schedules', 'todos']
  for (const m of kode.matchAll(/postgres_changes'\s*,\s*\[([^\]]+)\]/g)) {
    for (const nama of m[1].matchAll(/'([a-z_]+)'/g)) hasil.add(nama[1]);
  }

  return hasil;
}

const sql = readFileSync('supabase/schema.sql', 'utf8');

console.log('1. kode yang berlangganan');
const berkasKode = [
  ...kumpulkan('mobile/src', ['.ts', '.tsx']),
  ...kumpulanWeb(),
];
const disubscribe = new Map();
for (const berkas of berkasKode) {
  for (const tabel of tabelDisubscribe(readFileSync(berkas, 'utf8'))) {
    if (!disubscribe.has(tabel)) disubscribe.set(tabel, []);
    disubscribe.get(tabel).push(berkas.replace(/\\/g, '/'));
  }
}
for (const [tabel, pemakai] of [...disubscribe].sort()) {
  console.log(`   ${tabel} <- ${pemakai.length} berkas`);
}
cek('ada tabel yang berlangganan', disubscribe.size > 0);

console.log('\n2. tabel yang terdaftar di publication');
// Nama tabel diambil dari array di dalam DO block, bukan dari kata "add table",
// supaya perubahan nama di kode tidak bisa lolos tanpa ikut mengganti SQL.
const blok = sql.match(/foreach\s+nama_tabel\s+in\s+array\s+array\[([^\]]+)\]/);
cek(
  'schema.sql punya blok pendaftaran publication',
  Boolean(blok),
  blok ? '' : 'Tidak ditemukan pola foreach nama_tabel in array array[...]'
);

const terdaftar = new Set(
  blok ? [...blok[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : []
);
for (const tabel of [...terdaftar].sort()) console.log(`   ${tabel}`);

console.log('\n3. setiap tabel yang berlangganan harus terdaftar');
for (const tabel of [...disubscribe.keys()].sort()) {
  cek(
    `${tabel} ada di publication`,
    terdaftar.has(tabel),
    `terdaftar: ${[...terdaftar].join(', ') || '(tidak ada)'}\n         disubscribe di: ${disubscribe
      .get(tabel)
      .join(', ')}`
  );
}

console.log('\n4. tidak ada pendaftaran yang tidak dipakai kode');
for (const tabel of [...terdaftar].sort()) {
  cek(
    `${tabel} benar-benar ada yang berlangganan`,
    disubscribe.has(tabel),
    'hanya terdaftar di SQL, tidak ada kode yang masonok-- ini'
  );
}

console.log('\n5. nama publication dan sifat idempotennya');
cek(
  'nama publication persis supabase_realtime',
  /alter publication supabase_realtime add table/i.test(sql)
);
cek(
  'penambahan dijaga supaya bisa dijalankan berulang',
  /pg_publication_tables/.test(sql),
  'alter publication ... add table akan gagal kalau tabelnya sudah ada, jadi harus ada pengecekan'
);

console.log('\n6. replica identity untuk RLS di DELETE');
for (const tabel of [...terdaftar].sort()) {
  cek(
    `${tabel} punya replica identity`,
    new RegExp(`alter table public\\.${tabel} replica identity`, 'i').test(sql)
  );
}

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);

function kumpulanWeb() {
  return kumpulkan('src', ['.js', '.jsx']);
}