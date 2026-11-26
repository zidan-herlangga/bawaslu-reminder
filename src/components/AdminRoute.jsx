import { Link, Navigate } from 'react-router-dom';
import useSession from '../hooks/useSession';
import useProfile from '../hooks/useProfile';

export default function AdminRoute({ children }) {
  const { session, loading: sessionLoading } = useSession({ redirect: false });
  const { profile, loading: profileLoading } = useProfile(session);

  if (sessionLoading || profileLoading) {
    return <p className="py-10 text-center text-sm text-bw-muted">Memuat...</p>;
  }

  if (!session) return <Navigate to="/login" replace />;

  const isAdmin = profile?.role_akses === 'Admin' && profile?.status_akun === 'Aktif';
  if (!isAdmin) {
    return (
      <div className="space-y-3 rounded-3xl border border-bw-line bg-bw-card p-5 shadow-card">
        <h1 className="font-display text-lg font-bold text-bw-ink">Akses ditolak</h1>
        <p className="text-sm leading-relaxed text-bw-muted">
          Halaman ini hanya untuk admin aktif.
        </p>
        <div className="rounded-xl bg-bw-surface px-3 py-2 text-xs text-bw-muted">
          <p>Role: <span className="font-semibold text-bw-ink">{profile?.role_akses || '-'}</span></p>
          <p>Status: <span className="font-semibold text-bw-ink">{profile?.status_akun || '-'}</span></p>
        </div>
        <p className="text-xs leading-relaxed text-bw-muted">
          Pastikan migrasi <code>supabase/migrasi-admin-user.sql</code> sudah dijalankan dan akun kamu diset sebagai Admin di Supabase.
        </p>
        <Link
          to="/akun"
          className="inline-flex rounded-xl bg-bw-blue px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi"
        >
          Kembali ke Akun
        </Link>
      </div>
    );
  }

  return children;
}