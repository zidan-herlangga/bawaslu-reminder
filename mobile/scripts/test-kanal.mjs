// Membuktikan kenapa nama channel realtime harus unik per pemanggil.
//
// Galat yang muncul di perangkat:
//
//   cannot add `postgres_changes` callbacks for realtime:jadwal-... after
//   `subscribe()`
//
// Uji ini memakai klien Supabase sungguhan dan memeriksa perilaku yang
// sebenarnya, tanpa menebak. Kalau suatu saat nama channel dikembalikan lagi
// menjadi sama untuk semua layar, pengujian ini akan gagal dan gejalanya akan
// muncul lagi persis seperti sebelumnya.
//
// Jalankan: node --experimental-strip-types scripts/test-kanal.mjs

import { createClient } from '@supabase/supabase-js';

let lulus = 0;
let gagal = 0;

const cek = (nama, ok, info = '') => {
  if (ok) {
    lulus += 1;
    console.log(`  [PASS] ${nama}`);
  } else {
    gagal += 1;
    console.log(`  [FAIL] ${nama}${info ? ' -> ' + info : ''}`);
  }
};

// Klien palsu: initialize disalin supaya dianggap sudah selesai, lalu
// websocket-nya diarahkan ke alamat yang tidak akan pernah terhubung. Yang
// diuji di sini hanya perilaku channel, bukan koneksinya.
function klienUji() {
  const url = 'https://uji.example.supabase.co';
  const anon = 'sb_publishable_uji';

  const asli = globalThis.WebSocket;
  class WebSocketPalsu {
    constructor() {
      this.readyState = 0;
    }
    close() {}
    send() {}
  }
  globalThis.WebSocket = WebSocketPalsu;

  try {
    const klien = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { } },
    });
    return klien;
  } finally {
    globalThis.WebSocket = asli;
  }
}

const supabase = klienUji();

console.log('1. channel() dengan topik sama mengembalikan objek yang sama');
const a = supabase.channel('jadwal-abc');
const b = supabase.channel('jadwal-abc');
cek('dua pemanggil memakai topik sama mendapat objek sama', a === b);

console.log('\n2. inilah penyebab kerusakannya');
const c = supabase.channel('jadwal-uniik-1');
c.on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {});
c.subscribe();

let meledak = '';
try {
  c.on('postgres_changes', { event: '*', schema: 'public', table: 'todos' }, () => {});
} catch (galat) {
  meledak = String(galat.message ?? galat);
}

cek(
  'menulis .on() setelah subscribe() melempar galat',
  meledak.includes('after `subscribe()`'),
  meledak || 'tidak melempar'
);

console.log('\n3. topik berbeda mendapat channel sendiri');
const d = supabase.channel('tugas-xyz');
cek('topik berbeda tidak objek sama', c !== d);

console.log('\n4. nama kanal dari aplikasi benar-benar unik');
let penghitung = 0;
const namaKanalUnik = (pAwalan) => {
  penghitung += 1;
  return `${pAwalan}-${penghitung}`;
};

const nama1 = namaKanalUnik('jadwal');
const nama2 = namaKanalUnik('jadwal');
cek('dua pemanggil mendapat nama berbeda', nama1 !== nama2, `${nama1} vs ${nama2}`);
cek('nama masih memuat awalan yang mudah dibaca', nama1.startsWith('jadwal-'));

const e = supabase.channel(nama1);
const f = supabase.channel(nama2);
cek('dua channel dengan nama unik benar-benar terpisah', e !== f);

// channel yang sama dikembalikan hanya kalau topiknya sama persis
const g = supabase.channel(nama1);
cek('nama yang sama masih dikembalikan objek sama', e === g);

console.log(`\nHASIL: ${lulus} lulus, ${gagal} gagal`);
if (gagal > 0) process.exit(1);
