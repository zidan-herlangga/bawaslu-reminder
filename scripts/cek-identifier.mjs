// Memeriksa identifier yang dipakai tapi tidak pernah dideklarasi.
//
// Build Vite tidak menangkap ini. Variabel yang tidak ada baru meledak saat
// kode dijalankan, dan kasus yang paling sulit ada di dalam closure
// onClick: saat render fungsi itu tidak pernah dipanggil, jadi tidak ada yang
// salah sampai pengguna menekan tombolnya.
//
// Versi pertama tool ini menghasilkan 68 laporan, hampir semuanya keyword
// JavaScript, isi komentar, dan method milik objek. Dua perbaikan penting di
// sini: komentar dan literal string dibuang lebih dulu, dan keyword diberi
// daftar putih. Tanpa itu, tool ini hanya menghasilkan ruffut yang tidak
// pernah dibaca.

import { readFileSync } from 'node:fs';

const KEYWORD = new Set([
  'if', 'else', 'return', 'for', 'while', 'do', 'switch', 'case', 'break',
  'continue', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'this',
  'super', 'class', 'extends', 'function', 'try', 'catch', 'finally', 'throw',
  'async', 'await', 'yield', 'void', 'not', 'and', 'or', 'var', 'let', 'const',
  'import', 'export', 'from', 'default', 'as', 'with', 'debugger',
]);

const GLOBAL = new Set([
  'Array', 'ArrayBuffer', 'Boolean', 'BigInt', 'Blob', 'CSS', 'CustomEvent',
  'Date', 'DOMException', 'Element', 'Error', 'Event', 'File', 'FileReader',
  'FormData', 'Headers', 'Infinity', 'Intl', 'JSON', 'Map', 'Math',
  'MutationObserver', 'NaN', 'Node', 'Number', 'Object', 'Promise', 'Proxy',
  'RangeError', 'ReadableStream', 'RegExp', 'Response', 'Set', 'String',
  'Symbol', 'SyntaxError', 'TextDecoder', 'TextEncoder', 'TypeError', 'URL',
  'URLSearchParams', 'Uint8Array', 'WeakMap', 'WeakSet', 'WebSocket', 'Worker',
  'clearInterval', 'clearTimeout', 'console', 'crypto', 'decodeURIComponent',
  'document', 'encodeURIComponent', 'fetch', 'globalThis', 'isFinite', 'isNaN',
  'localStorage', 'location', 'navigator', 'parseFloat', 'parseInt',
  'queueMicrotask', 'requestAnimationFrame', 'sessionStorage', 'setInterval',
  'setTimeout', 'structuredClone', 'undefined', 'window', 'alert', 'confirm',
  'prompt', 'Notification', 'Audio', 'MediaMetadata', 'MediaSession',
  'AbortController', 'IntersectionObserver', 'matchMedia', 'getComputedStyle',
  'requestIdleCallback', 'performance', 'Image', 'FormData', 'WeakRef',
]);

/** Buang literal string dan template literal, sisakan ekspresi ${}. */
function buangLiteral(kode) {
  return (
    kode
      // template literal: sisakan bagian ${...}
      .replace(/`([^`\\]|\\.)*`/g, (m) => {
        let hasil = '``';
        for (const cocok of m.matchAll(/\$\{([^}]*)\}/g)) hasil += '${' + cocok[1] + '}';
        return hasil;
      })
      .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  );
}

/** Buang komentar baris dan blok. */
function buangKomentar(kode) {
  return kode.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function bersihkan(kode) {
  return buangKomentar(buangLiteral(kode));
}

function kumpulkanDeklarasi(kode) {
  const nama = new Set();

  const tambahDariDaftar = (teks) => {
    for (const item of teks.split(',')) {
      const bersih = item.trim().replace(/^\.\.\./, '');
      if (!bersih) continue;
      const ambil = bersih.split('=')[0].split(':').pop().trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(ambil)) nama.add(ambil);
    }
  };

  // import ... from
  for (const m of kode.matchAll(/import\s+([^;]+?)\s+from/g)) {
    const bagian = m[1];
    const kurung = bagian.match(/\{([\s\S]*?)\}/);
    if (kurung) tambahDariDaftar(kurung[1]);
    tambahDariDaftar(bagian.split('{')[0].replace(/,$/, ''));
  }

  for (const m of kode.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)) nama.add(m[1]);

  // const|let|var, termasuk destructure multiline
  for (const m of kode.matchAll(/(?:const|let|var)\s+([\s\S]*?)=/g)) {
    const bagian = m[1].trim();
    const kurung = bagian.match(/\{([\s\S]*?)\}/);
    if (kurung) tambahDariDaftar(kurung[1]);
    const kurungSiku = bagian.match(/\[([\s\S]*?)\]/);
    if (kurungSiku) tambahDariDaftar(kurungSiku[1]);
    tambahDariDaftar(bagian.replace(/\{[\s\S]*?\}/g, '').replace(/\[[\s\S]*?\]/g, ''));
  }

  // Parameter fungsi. Pola lama \(([\s\S]*?)\) ikut melintasi baris, sehingga
  // Promise((resolve, reject) => capturing-nya ikut jadi sampah dan resolve
  // dilaporkan sebagai identifier asing. Pola di bawah hanya mengizinkan satu
  // tingkat nesting dan harus diikuti tanda panah.
  for (const m of kode.matchAll(/\(((?:[^()]|\([^()]*\))*)\)\s*=>/g)) {
    tambahDariDaftar(m[1]);
  }

  for (const m of kode.matchAll(/function\s*[^(]*\(([^()]*)\)\s*\{/g)) {
    tambahDariDaftar(m[1]);
  }

  return nama;
}

function kumpulkanPemakaian(kode) {
  const pakai = new Map();

  for (const m of kode.matchAll(/<([A-Z][\w$.]*)/g)) {
    const nama = m[1].split('.')[0];
    if (!pakai.has(nama)) pakai.set(nama, 'JSX');
  }

  for (const m of kode.matchAll(/(^|[^\w$.?!])([a-zA-Z_$][\w$]*)\s*\(/g)) {
    const nama = m[2];
    if (!pakai.has(nama)) pakai.set(nama, 'panggilan');
  }

  return pakai;
}

export function periksaFile(path) {
  const kode = bersihkan(readFileSync(path, 'utf8'));
  const dideklarasi = kumpulkanDeklarasi(kode);
  const dipakai = kumpulkanPemakaian(kode);

  const masalah = [];
  for (const [nama, konteks] of dipakai) {
    if (KEYWORD.has(nama)) continue;
    if (GLOBAL.has(nama)) continue;
    if (dideklarasi.has(nama)) continue;
    masalah.push({ nama, konteks });
  }

  return masalah;
}
