import { supabase } from '../lib/supabase';

// Permintaan profil yang sedang berjalan, dikunci per pengguna.
let IN_FLIGHT = null;

function getInFlight() {
  if (!IN_FLIGHT) IN_FLIGHT = new Map();
  return IN_FLIGHT;
}

export default async function fetchProfile(session) {
  if (!session?.user) return null;

  // Profil dibaca dari beberapa halaman sekaligus. Tanpa ini, dua halaman yang
  // memuat bersamaan bisa sama-sama mencoba membuat baris profil yang belum
  // ada, lalu salah satunya gagal dengan galat kunci duplikat. Permintaan yang
  // sedang berjalan dikumpulkan satu per pengguna dan dipakai bersama.
  //
  // Hanya permintaan yang sedang berjalan yang digabung, bukan hasilnya, jadi
  // perubahan profil di halaman Akun tetap terbaca di halaman lain.
  const inFlight = getInFlight();
  const userId = session.user.id;

  if (inFlight.has(userId)) return inFlight.get(userId);

  const request = loadProfile(session).finally(() => {
    inFlight.delete(userId);
  });

  inFlight.set(userId, request);
  return request;
}

async function loadProfile(session) {
  const { data, error } = await supabase
    .from('profiles')
    .select('nama_lengkap, divisi, jabatan, role_akses, status_akun')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) {
    console.warn('[profile] gagal membaca tabel profiles:', error.message);
  }

  if (data) return data;

  const meta = session.user.user_metadata ?? {};
  const fallback = {
    nama_lengkap: meta.nama_lengkap ?? session.user.email ?? '',
    divisi: meta.divisi ?? 'Belum diatur',
    jabatan: meta.jabatan ?? 'Belum diatur',
    role_akses: 'Staf',
    status_akun: 'Aktif',
  };

  // Pendaftaran dengan konfirmasi email tidak menyisipkan baris profiles
  // (signUp tidak mengembalikan sesi sehingga insert dibatalkan), jadi
  // barisnya dibuat sekali di sini. Tanpa baris ini nama pengguna tidak
  // muncul sebagai penerima pengingat.
  const { error: insertError } = await supabase.from('profiles').insert({
    id: session.user.id,
    email: session.user.email ?? '',
    ...fallback,
  });

  if (insertError) {
    console.warn('[profile] gagal membuat baris profil:', insertError.message);
  } else {
    console.info('[profile] baris profil dibuat otomatis');
  }

  return fallback;
}
