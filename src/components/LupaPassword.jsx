import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const INPUT_CLASS =
  'block w-full rounded-lg border border-bw-line bg-white px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25';

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-semibold text-bw-ink';

function getErrorMessage(error) {
  const raw = error?.message ?? '';
  const message = raw.toLowerCase();

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Terlalu banyak permintaan. Silakan coba lagi beberapa menit lagi.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'Gagal terhubung ke Supabase. Periksa koneksi internet Anda.';
  }

  return raw || 'Gagal mengirim tautan. Silakan coba lagi.';
}

export default function LupaPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');
    setMessage('');

    const value = email.trim().toLowerCase();
    if (!value) {
      setError('Email wajib diisi.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        value,
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) throw resetError;

      setMessage(
        'Tautan atur ulang password telah dikirim. Periksa kotak masuk dan folder spam email Anda.'
      );
    } catch (resetError) {
      console.error('[LupaPassword] gagal:', resetError?.code, resetError?.message);
      setError(getErrorMessage(resetError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-bw-line bg-white p-5 shadow-sm">
          <div className="border-b border-bw-line pb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-bw-red">
              Lupa Kata Sandi
            </p>
            <h1 className="mt-1 text-lg font-bold leading-snug text-bw-ink">
              Atur Ulang Password
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat
              password baru.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            {message && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-700"
              >
                {message}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-lg bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 focus:ring-offset-1 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line"
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim tautan atur ulang'}
            </button>

            <p className="text-center text-xs text-bw-muted">
              Ingat password Anda?{' '}
              <Link
                to="/login"
                className="font-bold text-bw-blue transition-colors hover:text-bw-blue-hi hover:underline"
              >
                Kembali masuk
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-bw-muted">
          Aplikasi internal Bawaslu Kota Bekasi dengan akses terbatas.
        </p>
      </div>
    </div>
  );
}
