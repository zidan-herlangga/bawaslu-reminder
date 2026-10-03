// Validasi dan pemetaan galat untuk pendaftaran dan atur ulang password.
//
// Dipisah dari komponen supaya bisa diuji tanpa perangkat, tanpa React, dan
// tanpa Supabase. Aturan dan kalimatnya mengikuti web (src/components/
// Register.jsx), supaya kedua sisi memakai aturan yang sama dan pengguna
// yang sudah terbiasa tidak menemukan aturan baru di aplikasi.
//
// Berkas ini sengaja tidak mengimpor apa pun.

// Panjang minimum yang sama dengan web.
export const PANJANG_MIN_SANDI = 6;

export interface NilaiPendaftaran {
  namaLengkap: string;
  email: string;
  divisi: string;
  jabatan: string;
  sandi: string;
  ulangSandi: string;
}

export const PENDAFTARAN_KOSONG: NilaiPendaftaran = {
  namaLengkap: '',
  email: '',
  divisi: '',
  jabatan: '',
  sandi: '',
  ulangSandi: '',
};

/**
 * Bentuk yang diteruskan ke lapisan auth: kata sandi ikut disertakan, tapi
 * ulangSandi tidak karena sudah dipakai validasi dan tidak perlu disimpan.
 */
export type NilaiPendaftaranTanpaSandi = NilaiPendaftaran;

/**
 * Hasil pendaftaran, dibedakan dari galat yang dilempar.
 *
 * Kegagalan yang bisa diperbaiki sendiri oleh pengguna dikembalikan sebagai
 * nilai, karena layar perlu menampilkan petunjuknya. Galat tak terduga tetap
 * dilempar supaya tidak swallowed tanpa jejak.
 */
export type HasilDaftar =
  | { ok: true }
  | {
      ok: false;
      sebab: 'butuh-konfirmasi-email' | 'profil-gagal' | 'tidak-ada-pengguna';
    };

export type GalatPendaftaran =
  | 'namaLengkapKosong'
  | 'emailKosong'
  | 'emailTidakValid'
  | 'sandiPendek'
  | 'sandiTidakSama';

/** Email dicek bentuknya saja. Kebenarannya hanya bisa dibuktikan Supabase. */
function emailLooksValid(nilai: string): boolean {
  const bersih = nilai.trim();
  if (!bersih || bersih.includes(' ')) return false;

  const bagian = bersih.split('@');
  if (bagian.length !== 2) return false;

  const sebelum = bagian[0] ?? '';
  const sesudah = bagian[1] ?? '';

  // Domain harus punya label sebelum titik pertama dan masih ada isi setelahnya.
  // Tanpa ini, "a@.id" lolos karena mengandung titik dan tidak berakhir dengan
  // titik, padahal domain yang dimulai dengan titik tidak pernah valid.
  const titikPertama = sesudah.indexOf('.');
  const label = sesudah.slice(0, titikPertama);

  return (
    sebelum.length > 0 &&
    /^[^@\s]+$/.test(sebelum) &&
    titikPertama > 0 &&
    label.length > 0 &&
    sesudah.length > titikPertama + 1 &&
    !sesudah.endsWith('.')
  );
}

export function validasiPendaftaran(
  nilai: NilaiPendaftaran
): GalatPendaftaran[] {
  const galat: GalatPendaftaran[] = [];

  if (!nilai.namaLengkap.trim()) galat.push('namaLengkapKosong');
  if (!nilai.email.trim()) {
    galat.push('emailKosong');
  } else if (!emailLooksValid(nilai.email)) {
    galat.push('emailTidakValid');
  }
  if (nilai.sandi.length < PANJANG_MIN_SANDI) galat.push('sandiPendek');
  if (nilai.sandi !== nilai.ulangSandi) galat.push('sandiTidakSama');

  return galat;
}

/**
 * Kalimat pertama, karena UI hanya punya ruang untuk satu.
 *
 * Dua kasus yang sengaja dibedakan:
 * - daftar kosong berarti tidak ada masalah, jadi kalimatnya kosong
 * - kode yang tidak dikenal tetap dapat kalimat umum, bukan string kosong.
 *   Kalau nanti ada kode baru yang ditambahkan ke validasiPendaftaran tanpa
 *   ditambahkan di sini, string kosong akan membuat validasi gagal tanpa
 *   menampilkan apa pun, dan itu lebih sulit dilaporkan daripada pesan yang
 *   kurang tepat.
 */
export function kalimatGalat(galat: GalatPendaftaran[]): string {
  if (galat.length === 0) return '';

  switch (galat[0]) {
    case 'namaLengkapKosong':
      return 'Nama lengkap wajib diisi.';
    case 'emailKosong':
      return 'Email wajib diisi.';
    case 'emailTidakValid':
      return 'Format email tidak valid.';
    case 'sandiPendek':
      return `Kata sandi minimal ${PANJANG_MIN_SANDI} karakter.`;
    case 'sandiTidakSama':
      return 'Konfirmasi kata sandi tidak sama.';
    default:
      return 'Periksa kembali isian Anda.';
  }
}

/**
 * Menyesuaikan kata sandi baru, untuk halaman atur ulang.
 *
 * Tidak menerima ulang konfirmasi, karena di halaman itu tidak ada akun yang
 * diketik ulang dari awal: orang datang dari tautan di dalam email.
 */
export function validasiSandiBaru(sandi: string): GalatPendaftaran[] {
  return sandi.length < PANJANG_MIN_SANDI ? ['sandiPendek'] : [];
}

// Kode galat yang datang dari lapisan web, bukan dari Supabase. Dipakai
// sebagai penanda supaya tidakterydu ke pesan teknis apa pun.
export const KODE_BUATAN = {
  emailBelumDikonfirmasi: 'EMAIL_CONFIRMATION_REQUIRED',
  profilGagal: 'PROFILE_WRITE_FAILED',
} as const;

/**
 * Mengubah galat Supabase menjadi kalimat yang bisa dibaca staf.
 *
 * Menyalin pesan mentah dari server hampir selalu tidak berguna: isinya
 * "User already registered" atau "Email rate limit exceeded", dan keduanya
 * tidak memberi tahu apa yang harus dilakukan.
 */
export function pesanGalatAuth(galat: unknown): string {
  const kode = (galat as { code?: string } | null)?.code;
  const mentah =
    (galat as { message?: string } | null)?.message ??
    (typeof galat === 'string' ? galat : '');

  if (mentah === KODE_BUATAN.emailBelumDikonfirmasi) {
    return (
      'Konfirmasi email masih aktif di Supabase, jadi pendaftaran berhenti di ' +
      'tengah jalan dan profil tidak tersimpan. Nonaktifkan "Confirm email" di ' +
      'Authentication > Settings, lalu daftar ulang.'
    );
  }

  if (mentah === KODE_BUATAN.profilGagal) {
    return (
      'Akun berhasil dibuat, tetapi profilnya gagal ditulis. Jalankan ' +
      'supabase/schema.sql di SQL Editor Supabase, lalu masuk lagi.'
    );
  }

  const pesan = mentah.toLowerCase();

  if (pesan.includes('already registered') || pesan.includes('already been registered')) {
    return 'Email ini sudah terdaftar. Silakan masuk.';
  }
  if (pesan.includes('password')) {
    return `Kata sandi ditolak. Gunakan minimal ${PANJANG_MIN_SANDI} karakter.`;
  }
  if (pesan.includes('valid email') || pesan.includes('validate email')) {
    return 'Format email tidak valid.';
  }
  if (pesan.includes('signups not allowed')) {
    return 'Pendaftaran dinonaktifkan di Supabase > Authentication > Settings.';
  }
  if (pesan.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Buka tautan konfirmasi di kotak masuk Anda.';
  }
  if (pesan.includes('rate limit') || pesan.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
  }
  if (pesan.includes('fetch') || pesan.includes('network')) {
    return 'Gagal terhubung ke Supabase. Periksa koneksi internet Anda.';
  }
  if (pesan.includes('auth') && pesan.includes('missing')) {
    return 'Sesi tidak ditemukan. Buka tautan dari email sekali lagi.';
  }

  return mentah || 'Terjadi kesalahan. Silakan coba lagi.';
}

/** Email dinormalkan agar tidak ada spasi atau huruf besar yang menggagalkan. */
export function normalkanEmail(nilai: string): string {
  return nilai.trim().toLowerCase();
}