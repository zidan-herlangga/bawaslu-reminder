// Asal server API.
//
// Aplikasi native tidak punya asal tetap seperti situs web. Endpoint /api/notify
// ada di deployment Vercel, jadi asalnya harus diberikan lewat environment.
//
// Nilai ada di .env sebagai EXPO_PUBLIC_API_ORIGIN. Jangan ditulis langsung di
// sini: alamat deployment bisa berubah, dan menuliskannya di beberapa berkas
// berarti harus dicari di beberapa tempat saat berubah.

const asal = process.env.EXPO_PUBLIC_API_ORIGIN;

if (!asal) {
  console.warn(
    '[api] EXPO_PUBLIC_API_ORIGIN belum diisi. Fitur Ingatkan dan Hapus akan ' +
      'gagal. Salin .env.example menjadi .env lalu isi nilainya.'
  );
}

export const API_ORIGIN = (asal ?? '').replace(/\/+$/, '');

export function apiUrl(jalur: string): string {
  return `${API_ORIGIN}${jalur.startsWith('/') ? jalur : `/${jalur}`}`;
}
