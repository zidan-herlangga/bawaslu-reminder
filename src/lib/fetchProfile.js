import { supabase } from '../lib/supabase';

export default async function fetchProfile(session) {
  if (!session?.user) return null;

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
  return {
    nama_lengkap: meta.nama_lengkap ?? session.user.email ?? '',
    divisi: meta.divisi ?? 'Belum diatur',
    jabatan: meta.jabatan ?? 'Belum diatur',
    role_akses: 'Staf',
    status_akun: 'Aktif',
  };
}
