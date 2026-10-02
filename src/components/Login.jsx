import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const INPUT_CLASS =
  'block w-full rounded-xl border border-bw-line bg-bw-card px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25 disabled:bg-bw-surface';

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-semibold text-bw-ink';

function getErrorMessage(error) {
  const raw = error?.message ?? '';
  const message = raw.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'Email atau kata sandi salah.';
  }
  if (message.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Buka tautan konfirmasi di kotak masuk email Anda.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'Gagal terhubung ke Supabase. Periksa VITE_SUPABASE_URL, anon key, dan koneksi internet.';
  }

  return raw || 'Terjadi kesalahan. Silakan coba lagi.';
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const successMessage = location.state?.message ?? '';

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');

    if (!email.trim() || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) throw signInError;

      console.info('[Login] sukses, navigasi ke /');
      navigate('/', { replace: true });
    } catch (loginError) {
      console.error('[Login] gagal:', loginError?.code, loginError?.message);
      setError(getErrorMessage(loginError));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
          <div className="border-b border-bw-line pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bw-red">
              Masuk
            </p>
            <h1 className="mt-1 font-display text-xl font-bold leading-snug text-bw-ink">
              Sistem Pengingat Jadwal
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Gunakan akun yang telah terdaftar untuk melanjutkan.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            {successMessage && !error && (
              <div
                role="status"
                className="rounded-xl border border-bw-green-200 bg-bw-green-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-green-700"
              >
                {successMessage}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className={LABEL_CLASS}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="nama@contoh.go.id"
                className={INPUT_CLASS}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label htmlFor="password" className="text-[13px] font-semibold text-bw-ink">
                  Kata Sandi
                </label>
                <Link
                  to="/lupa-password"
                  className="text-xs font-semibold text-bw-blue transition-colors hover:text-bw-blue-hi hover:underline"
                >
                  Lupa sandi?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Masukkan kata sandi"
                className={INPUT_CLASS}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 focus:ring-offset-bw-canvas active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line"
            >
              {isSubmitting ? 'Memproses...' : 'Masuk'}
            </button>

            <p className="text-center text-xs text-bw-muted">
              Belum punya akun?{' '}
              <Link
                to="/register"
                className="font-bold text-bw-blue transition-colors hover:text-bw-blue-hi hover:underline"
              >
                Daftar di sini
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-bw-muted">
          Aplikasi internal Bawaslu Bekasi Kota dengan akses terbatas.
        </p>
      </div>
    </div>
  );
}
