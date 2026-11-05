import { useState } from 'react';
import { Link } from 'react-router-dom';

const INPUT_CLASS =
  'block w-full rounded-xl border border-bw-line bg-bw-card px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25';

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-semibold text-bw-ink';

export default function LupaPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');
    setSuccess('');

    const emailKonfirmasi = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKonfirmasi)) {
      setError('Gmail terdaftar wajib diisi dengan benar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const res = await fetch('/api/lupa-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailKonfirmasi,
          redirectTo,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Gagal mengirim link reset password.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(data.message || 'Link reset password telah dikirim. Silakan cek Gmail Anda.');
      setEmail('');
    } catch {
      setError('Gagal terhubung ke server. Periksa koneksi lalu coba lagi.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
          <div className="border-b border-bw-line pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bw-red">
              Lupa Kata Sandi
            </p>
            <h1 className="mt-1 font-display text-xl font-bold leading-snug text-bw-ink">
              Reset Password
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Masukkan Gmail yang terdaftar. Kami akan mengirim link untuk mengubah password.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
              >
                {error}
              </div>
            )}
            {success && (
              <div
                role="status"
                className="rounded-xl border border-bw-green-200 bg-bw-green-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-green-700"
              >
                {success}
              </div>
            )}

            <div>
              <label htmlFor="email" className={LABEL_CLASS}>
                Gmail Terdaftar
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="Masukkan Gmail terdaftar"
                className={INPUT_CLASS}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 focus:ring-offset-bw-canvas active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line"
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim Link Reset'}
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

        <p className="mt-4 text-center text-xs leading-relaxed text-bw-muted">
          Aplikasi internal Bawaslu Bekasi Kota dengan akses terbatas.
        </p>
      </div>
    </div>
  );
}
