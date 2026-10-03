// Memeriksa nama kolom yang dipakai kode terhadap kolom yang benar-benar ada.
//
// Bug yang ditemukan oleh berkas ini nyata dan sudah terjadi: mobile menulis
// .insert({ user_id: ... }) ke tabel todos, padahal kolomnya bernama
// pemilik_id. PostgREST menjawab HTTP 400 dan kode tidak pernah memperingatkan
// apa-apa di compile time, karena TypeScript tidak tahu bentuk tabel di
// database.
//
// Akibatnya menambah tugas dari aplikasi tidak pernah berhasil, dan penyebabnya
// tidak terlihat dari kode: select-nya benar, insert-nya salah, dan keduanya
// satu file.
//
// Test ini membandingkan dua sumber:
//   - nama kolom yang dipakai kode saat select, insert, update, delete
//   - kolom yang benar-benar ada di supabase/schema.sql
//
// Kalau kode memakai nama yang tidak ada di SQL, test gagal dan menyebut
// tabel, nama kolom, dan berkasnya.
//
// Batasnya, dan ini perlu disebut terang: nama kolom yang ditulis bebas di
// dalam filter atau .rpc tidak diperiksa. Yang diperiksa hanya nama yang
// muncul sebagai kunci objek pada select, insert, update, atau sebagai
// adalah nama yang muncul sebagai kunci objek pada select, insert, update, dan
// sebagai daftar kolom select.
//
// Jalankan: node scripts/test-kolom.mjs

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
    if (['node_modules', '.expo', 'dist', '.git', 'build'].includes(nama)) continue;
    const penuh = join(dir, nama);
    if (statSync(penuh).isDirectory()) kumpulkan(penuh, ekstensi, hasil);
    else if (ekstensi.includes(extname(nama))) hasil.push(penuh);
  }
  return hasil;
}

const sql = readFileSync('supabase/schema.sql', 'utf8');

/** Kolom yang dideklarasikan tiap tabel, dari blok create table. */
function kolomPerTabel(sql) {
  const hasil = new Map();

  for (const m of sql.matchAll(
    /create table(?:\s+if not exists)?\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\s*\);/g
  )) {
    const [, tabel, isi] = m;
    const kolom = new Set();

    for (const baris of isi.split('\n')) {
      const bersih = baris.replace(/--.*$/, '').trim();
      if (!bersih) continue;
      // Baris pertama kata besarnya adalah nama kolomnya. Baris berikutnya
      // adalah kelanjutan tipe atau constraint, jadi dilewati.
      const kata = bersih.split(/\s+/)[0];
      if (!/^[a-z_][a-z0-9_]*$/i.test(kata)) continue;
      if (['primary', 'foreign', 'unique', 'check', 'constraint', 'exclude'].includes(kata.toLowerCase())) continue;
      kolom.add(kata);
    }

    hasil.set(tabel, kolom);
  }

  return hasil;
}

/** Nama tabel yang dibaca kode lewat .from('x'). */
function tabelDipakai(kode) {
  return new Set([...kode.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]));
}

/** Nama kolom yang muncul sebagai kunci objek pada select/insert/update. */
function kolomDipakai(kode) {
  const hasil = [];

  // .insert({ a: 1, b: 2 }) / .update({ a: 1 })
  for (const m of kode.matchAll(/\.(?:insert|update)\(\s*\{([\s\S]*?)\}\s*\)/g)) {
    for (const k of m[1].matchAll(/(?:^|[{,\s])([a-z_][a-z0-9_]*)\s*:/g)) {
      hasil.push({ kolom: k[1], asal: m[1].slice(0, 40).replace(/\s+/g, ' ') });
    }
  }

  // select('id, teks, tanggal') -- daftar kolom eksplisit
  for (const m of kode.matchAll(/\.select\(\s*'([^']+)'\s*\)/g)) {
    for (const k of m[1].split(',')) {
      const bersih = k.trim();
      if (/^[a-z_][a-z0-9_]*$/i.test(bersih)) {
        hasil.push({ kolom: bersih, asal: m[1].slice(0, 40) });
      }
    }
  }

  return hasil;
}

const deklarasi = kolomPerTabel(sql);

console.log('1. tabel yang terbaca dari schema.sql');
for (const tabel of [...deklarasi.keys()].sort()) {
  console.log(`   ${tabel}: ${[...deklarasi.get(tabel)].sort().join(', ')}`);
}
cek('semua tabel aplikasi terdeteksi', deklarasi.size >= 6, `ditemukan ${deklarasi.size}`);

console.log('\n2. nama kolom yang dipakai kode');
const berkas = [
  ...kumpulkan('mobile/src', ['.ts', '.tsx']),
  ...kumpulkan('src', ['.js', '.jsx']),
];

let jumlahPemakaian = 0;
const masalah = [];

for (const path of berkas) {
  const kode = readFileSync(path, 'utf8');
  const tabelDipakaiDi = tabelDipakai(kode);
  if (tabelDipakaiDi.size === 0) continue;

  const adaTabelMilikKita = [...tabelDipakaiDi].some((t) => deklarasi.has(t));
  if (!adaTabelMilikKita) continue;

  // Untuk setiap pemakaian, cari tabel yang sedang-- dipakai di sekitar
  // baris itu, lalu bandingkan dengan kolom tabel tersebut.
  const baris = kode.split('\n');
  for (let i = 0; i < baris.length; i += 1) {
    //indowati window kecil di sekitar baris ini
    const jendela = baris.slice(Math.max(0, i - 4), i + 5).join('\n');
    const tabelDiJendela = [...tabelDipakai(jendela)];
    if (tabelDiJendela.length === 0) continue;

    for (const { kolom } of kolomDipakai(baris[i])) {
      for (const tabel of tabelDiJendela) {
        const boleh = deklarasi.get(tabel);
        if (!boleh) continue;
        jumlahPemakaian += 1;
        if (!boleh.has(kolom)) {
          masalah.push({
            tabel,
            kolom,
            path: path.replace(/\\/g, '/'),
            baris: i + 1,
            isi: baris[i].trim().slice(0, 70),
          });
        }
      }
    }
  }
}

console.log(`   ${jumlahPemakaian} pemakaian kolom diperiksa`);

console.log('\n3. hasil perbandingan');
if (masalah.length === 0) {
  console.log('   semua nama kolom cocok dengan schema.sql');
} else {
  for (const m of masalah) {
    console.log(`   ${m.tabel}.${m.kolom} di ${m.path}:${m.baris}`);
    console.log(`     "${m.isi}"`);
    console.log(`     kolom yang ada: ${[...deklarasi.get(m.tabel)].sort().join(', ')}`);
  }
}

cek('tidak ada nama kolom yang tidak ada di schema.sql', masalah.length === 0);

// Pengaman khusus untuk bug yang ditemukan: user_id bukan kolom todos, dan
// kehadirannya dulu lolos karena tidak ada yang mencocokkannya dengan SQL.
const kodeTodo = readFileSync('mobile/src/app/(tabs)/todo.tsx', 'utf8');
cek(
  "todos memakai pemilik_id, bukan user_id",
  kodeTodo.includes('pemilik_id') && !/\.insert\(\s*\{[^}]*user_id/.test(kodeTodo)
);
cek(
  "todos menyertakan pemilik_id saat menambah",
  /\.insert\(\s*\{[^}]*pemilik_id/.test(kodeTodo),
  'tanpa pemilik_id, policy insert own todo akan menolak barisnya'
);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);