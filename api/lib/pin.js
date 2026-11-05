import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

const PIN_PATTERN = /^\d{6}$/;
const SCRYPT_KEYLEN = 32;

// PIN disimpan sebagai hash scrypt di user_metadata, bukan di tabel profiles.
// Dua alasan: tidak perlu migrasi kolom baru, dan hash tidak ikut terbaca lewat
// REST API profiles yang bisa diakses semua pengguna login.
export function isPinValid(pin) {
  return typeof pin === 'string' && PIN_PATTERN.test(pin.trim());
}

export async function hashPin(pin) {
  const salt = randomBytes(16);
  const derived = await scrypt(pin.trim(), salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPin(pin, stored) {
  if (!isPinValid(pin) || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) return false;

  const derived = await scrypt(pin.trim(), salt, SCRYPT_KEYLEN);
  return timingSafeEqual(derived, expected);
}

export function emailDariNip(nip) {
  return `${String(nip).trim()}@bawaslu.local`;
}

// Pembatas percobaan sederhana, disimpan di memori proses. Di Vercel tiap
// instance punya hitungannya sendiri, jadi ini bukan pengaman mutlak - hanya
// memperlambat tebakan PIN 6 digit yang dilakukan berulang.
const percobaan = new Map();
const MAKS_GAGAL = 5;
const JEDA_MS = 15 * 60 * 1000;

export function nipTerkunci(nip) {
  const catatan = percobaan.get(nip);
  if (!catatan) return 0;
  const sisa = catatan.blockedUntil - Date.now();
  return sisa > 0 ? sisa : 0;
}

export function catatGagal(nip) {
  const sekarang = Date.now();
  const catatan = percobaan.get(nip) ?? { gagal: 0, blockedUntil: 0 };

  // Jendela percobaan lama (lebih dari 15 menit) dimulai ulang.
  if (sekarang - (catatan.mulai ?? 0) > JEDA_MS) {
    catatan.gagal = 0;
    catatan.mulai = sekarang;
  }

  catatan.gagal += 1;
  if (catatan.gagal >= MAKS_GAGAL) {
    catatan.blockedUntil = sekarang + JEDA_MS;
    catatan.gagal = 0;
  }
  percobaan.set(nip, catatan);
}

export function catatBerhasil(nip) {
  percobaan.delete(nip);
}
