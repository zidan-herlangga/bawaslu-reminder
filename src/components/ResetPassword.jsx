import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MIN_PASSWORD_LENGTH } from '../constants/options';

const INPUT_CLASS =
  'block w-full rounded-lg border border-bw-line bg-white px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25';

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-semibold text-bw-ink';

function hasRecoveryHint() {
  const { hash, search } = window.location;
  return (
    hash.includes('type=recovery') ||
    hash.includes('access_token') ||
    search.includes('type=recovery') ||
    search.includes('code=')
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const [phase, setPhase] = useState(() => (hasRecoveryHint() ? 'form' : 'checking'));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === 'PASSWORD_RECOVERY') setPhase('form');
    });

    if (!hasRecoveryHint()) {
      supabase.auth.getSession().finally(() => {
        if (active) setPhase((current) => (current === 'checking' ? 'invalid' : current));
      });
    }

    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak sama.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setNotice('Password berhasil diubah. Mengalihkan ke halaman utama...');
      setPassword('');
      setConfirm('');
      timerRef.current = window.setTimeout(() => {
        navigate('/', { replace: true });
      }, 1400);
    } catch (updateError) {
      console.error('[ResetPassword] gagal:', updateError?.code, updateError?.message);
      const raw = (updateError?.message ?? '').toLowerCase();

      if (
        raw.includes('session') ||
        raw.includes('expired') ||
        raw.includes('jwt') ||
        raw.includes('not found')
      ) {
        setPhase('invalid');
      } else {
        setError(updateError?.message || 'Gagal mengubah password. Silakan coba lagi.');
      }
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
              Password Baru
            </p>
            <h1 className="mt-1 text-lg font-bold leading-snug text-bw-ink">
              Buat Password Baru
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Pilih password baru untuk akun Anda. Password lama langsung tidak
              berlaku.
            </p>
          </div>

          {phase === 'checking' && (
            <p className="mt-4 text-center text-xs text-bw-muted">
              Memverifikasi tautan...
            </p>
          )}

          {phase === 'invalid' && (
            <div className="mt-4 space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
              >
                Tautan tidak valid, sudah dipakai, atau kedaluwarsa. Minta tautan
                baru melalui halaman lupa password.
              </div>
              <Link
                to="/lupa-password"
                className="flex w-full items-center justify-center rounded-lg bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
              >
                Minta tautan baru
              </Link>
            </div>
          )}

          {phase === 'form' && (
            <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
              {notice && (
                <div
                  role="status"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed text-emerald-700"
                >
                  {notice}
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
                <label htmlFor="password_baru" className={LABEL_CLASS}>
                  Password Baru
                </label>
                <input
                  id="password_baru"
                  name="password_baru"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label htmlFor="password_ulang" className={LABEL_CLASS}>
                  Ulangi Password Baru
                </label>
                <input
                  id="password_ulang"
                  name="password_ulang"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center rounded-lg bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 focus:ring-offset-1 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan password baru'}
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
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-bw-muted">
          Aplikasi internal Bawaslu Kota Bekasi dengan akses terbatas.
        </p>
      </div>
    </div>
  );
}
