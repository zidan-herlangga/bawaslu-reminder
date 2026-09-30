import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DIVISI_OPTIONS, JABATAN_OPTIONS, MIN_PASSWORD_LENGTH } from '../constants/options';

const EMPTY_FORM = {
  nama_lengkap: '',
  email: '',
  password: '',
  divisi: '',
  jabatan: '',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPECIAL_ERRORS = {
  EMAIL_CONFIRMATION_REQUIRED:
    'Konfirmasi email masih aktif di Supabase. Nonaktifkan di ' +
    'Authentication > Settings > "Confirm email" (matikan), lalu daftar ulang ' +
    'agar profil tersimpan otomatis.',
  PROFILE_WRITE_FAILED:
    'Tulis profil ke tabel profiles gagal. Jalankan supabase/schema.sql ' +
    'di SQL Editor Supabase untuk membuat tabel beserta aturan RLS-nya.',
};

const FIELD_BASE_CLASS =
  'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-surface';
const FIELD_OK_CLASS = 'border-bw-line focus:border-bw-blue focus:ring-bw-blue/25';
const FIELD_INVALID_CLASS = 'border-bw-red focus:ring-bw-red/25';

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-semibold text-bw-ink';

const CHEVRON_CLASS =
  'pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bw-muted';
const CHEVRON_PATH =
  'M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z';

function getErrorMessage(error) {
  const raw = error?.message ?? '';
  if (SPECIAL_ERRORS[raw]) return SPECIAL_ERRORS[raw];

  const message = raw.toLowerCase();

  if (message.includes('already registered')) {
    return 'Email ini sudah terdaftar. Silakan masuk.';
  }
  if (message.includes('password')) {
    return `Kata sandi terlalu lemah. Gunakan minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (message.includes('valid email') || message.includes('validate email')) {
    return 'Format email tidak valid.';
  }
  if (message.includes('signups not allowed')) {
    return 'Pendaftaran dinonaktifkan di Supabase > Authentication > Settings.';
  }
  if (message.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Buka tautan konfirmasi di kotak masuk Anda.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Terlalu banyak percobaan. Silakan coba lagi nanti.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'Gagal terhubung ke Supabase. Periksa VITE_SUPABASE_URL, anon key, dan koneksi internet.';
  }

  return raw || 'Terjadi kesalahan. Silakan coba lagi.';
}

function validate(values) {
  const nextErrors = {};

  if (!values.nama_lengkap.trim()) {
    nextErrors.nama_lengkap = 'Nama lengkap wajib diisi.';
  }

  if (!values.email.trim()) {
    nextErrors.email = 'Email wajib diisi.';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    nextErrors.email = 'Format email tidak valid.';
  }

  if (!values.password) {
    nextErrors.password = 'Kata sandi wajib diisi.';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    nextErrors.password = `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }

  if (!values.divisi) {
    nextErrors.divisi = 'Divisi wajib dipilih.';
  }

  if (!values.jabatan) {
    nextErrors.jabatan = 'Jabatan wajib dipilih.';
  }

  return nextErrors;
}

function Chevron() {
  return (
    <svg className={CHEVRON_CLASS} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d={CHEVRON_PATH} clipRule="evenodd" />
    </svg>
  );
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-bw-red">
      {children}
    </p>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      if (!previous[name]) return previous;
      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const validationErrors = validate(form);
    setErrors(validationErrors);
    setFormError('');

    if (Object.keys(validationErrors).length > 0) return;

    const email = form.email.trim().toLowerCase();
    const namaLengkap = form.nama_lengkap.trim();

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: form.password,
        options: { data: { nama_lengkap: namaLengkap, divisi: form.divisi, jabatan: form.jabatan } },
      });

      if (error) throw error;

      if (!data.session) {
        throw new Error('EMAIL_CONFIRMATION_REQUIRED');
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        nama_lengkap: namaLengkap,
        email,
        divisi: form.divisi,
        jabatan: form.jabatan,
        role_akses: 'Staf',
        status_akun: 'Aktif',
      });

      if (profileError) throw new Error('PROFILE_WRITE_FAILED');

      console.info('[Register] sukses, membersihkan form dan navigasi ke /login');
      setForm(EMPTY_FORM);
      setErrors({});
      setIsSubmitting(false);
      navigate('/login', {
        replace: true,
        state: { message: 'Pendaftaran berhasil. Silakan masuk dengan akun Anda.' },
      });
    } catch (error) {
      console.error('[Register] gagal:', error?.code, error?.message);
      setFormError(getErrorMessage(error));
      setIsSubmitting(false);
    }
  };

  const fields = [
    {
      id: 'nama_lengkap',
      label: 'Nama Lengkap',
      type: 'text',
      autoComplete: 'name',
      placeholder: 'Budi Santoso',
    },
    {
      id: 'email',
      label: 'Email',
      type: 'email',
      autoComplete: 'email',
      placeholder: 'nama@contoh.go.id',
    },
    {
      id: 'password',
      label: 'Kata Sandi',
      type: 'password',
      autoComplete: 'new-password',
      placeholder: `Minimal ${MIN_PASSWORD_LENGTH} karakter`,
    },
  ];

  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-bw-line bg-white p-5 shadow-card">
          <div className="border-b border-bw-line pb-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bw-red">
              Pendaftaran
            </p>
            <h1 className="mt-1 font-display text-xl font-bold leading-snug text-bw-ink">Buat Akun Baru</h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Lengkapi data berikut untuk membuat akun internal.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
              <svg
                className="h-3.5 w-3.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
              Perhatian sebelum mengisi
            </p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-900">
              <li className="flex gap-1.5">
                <span aria-hidden="true" className="font-bold">
                  1.
                </span>
                <span>
                  <strong>Email</strong> harus email aktif milik Anda sendiri. Setelah
                  terdaftar, email <strong>tidak bisa diubah</strong>, dan dipakai untuk
                  masuk serta tautan &quot;Lupa sandi&quot;.
                </span>
              </li>
              <li className="flex gap-1.5">
                <span aria-hidden="true" className="font-bold">
                  2.
                </span>
                <span>
                  <strong>Nama lengkap</strong> ditulis sesuai nama sehari-hari, karena
                  nama ini tampil di setiap jadwal yang Anda buat.
                </span>
              </li>
              <li className="flex gap-1.5">
                <span aria-hidden="true" className="font-bold">
                  3.
                </span>
                <span>
                  <strong>Divisi &amp; Jabatan</strong> dipilih sesuai data sebenarnya.
                  Masih bisa diperbaiki nanti di halaman <strong>Akun</strong>.
                </span>
              </li>
              <li className="flex gap-1.5">
                <span aria-hidden="true" className="font-bold">
                  4.
                </span>
                <span>
                  <strong>Kata sandi</strong> minimal {MIN_PASSWORD_LENGTH} karakter dan
                  wajib Anda simpan sendiri; satu-satunya cara menggantinya lewat
                  &quot;Lupa sandi&quot;.
                </span>
              </li>
              <li className="flex gap-1.5">
                <span aria-hidden="true" className="font-bold">
                  5.
                </span>
                <span>
                  Satu orang cukup <strong>satu akun</strong>. Email yang sudah terdaftar
                  akan ditolak.
                </span>
              </li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
              >
                {formError}
              </div>
            )}

            {fields.map((field) => (
              <div key={field.id}>
                <label htmlFor={field.id} className={LABEL_CLASS}>
                  {field.label}
                </label>
                <input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  value={form[field.id]}
                  onChange={handleChange}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  aria-invalid={Boolean(errors[field.id])}
                  aria-describedby={
                    errors[field.id] ? `${field.id}-error` : `${field.id}-hint`
                  }
                  className={`${FIELD_BASE_CLASS} ${
                    errors[field.id] ? FIELD_INVALID_CLASS : FIELD_OK_CLASS
                  }`}
                />
                <FieldError id={`${field.id}-error`}>{errors[field.id]}</FieldError>
                {!errors[field.id] && field.id === 'password' && (
                  <p id="password-hint" className="mt-1.5 text-xs text-bw-muted">
                    Gunakan minimal {MIN_PASSWORD_LENGTH} karakter.
                  </p>
                )}
              </div>
            ))}

            <div>
              <label htmlFor="divisi" className={LABEL_CLASS}>
                Divisi
              </label>
              <div className="relative">
                <select
                  id="divisi"
                  name="divisi"
                  value={form.divisi}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.divisi)}
                  aria-describedby={errors.divisi ? 'divisi-error' : undefined}
                  className={`${FIELD_BASE_CLASS} appearance-none pr-10 ${
                    errors.divisi ? FIELD_INVALID_CLASS : FIELD_OK_CLASS
                  } ${form.divisi ? '' : 'text-bw-muted'}`}
                >
                  <option value="">-- Pilih Divisi --</option>
                  {DIVISI_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-bw-ink">
                      {option}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
              <FieldError id="divisi-error">{errors.divisi}</FieldError>
            </div>

            <div>
              <label htmlFor="jabatan" className={LABEL_CLASS}>
                Jabatan
              </label>
              <div className="relative">
                <select
                  id="jabatan"
                  name="jabatan"
                  value={form.jabatan}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.jabatan)}
                  aria-describedby={errors.jabatan ? 'jabatan-error' : undefined}
                  className={`${FIELD_BASE_CLASS} appearance-none pr-10 ${
                    errors.jabatan ? FIELD_INVALID_CLASS : FIELD_OK_CLASS
                  } ${form.jabatan ? '' : 'text-bw-muted'}`}
                >
                  <option value="">-- Pilih Jabatan --</option>
                  {JABATAN_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-bw-ink">
                      {option}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
              <FieldError id="jabatan-error">{errors.jabatan}</FieldError>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 focus:ring-offset-1 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line disabled:shadow-none"
            >
              {isSubmitting && (
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              )}
              {isSubmitting ? 'Mendaftarkan...' : 'Daftar Akun'}
            </button>

            <p className="text-center text-xs text-bw-muted">
              Sudah punya akun?{' '}
              <Link
                to="/login"
                className="font-bold text-bw-blue transition-colors hover:text-bw-blue-hi hover:underline"
              >
                Masuk di sini
              </Link>
            </p>
          </form>
        </div>

        <p className="mt-4 text-center text-xs leading-relaxed text-bw-muted">
          Aplikasi internal Bawaslu Kota Bekasi dengan akses terbatas.
        </p>
      </div>
    </div>
  );
}
