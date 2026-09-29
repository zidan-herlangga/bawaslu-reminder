import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import useSession from '../hooks/useSession';
import useDueReminder from '../hooks/useDueReminder';
import fetchProfile from '../lib/fetchProfile';
import { isSoundEnabled, playChime, setSoundEnabled, subscribeSound } from '../lib/sound';
import { DIVISI_OPTIONS, JABATAN_OPTIONS, MIN_PASSWORD_LENGTH } from '../constants/options';

const ROW_CLASS = 'flex items-start justify-between gap-4 py-3';
const LABEL_CLASS = 'text-[13px] text-bw-muted';
const VALUE_CLASS = 'text-right text-[13px] font-semibold text-bw-ink break-words';

const FIELD_CLASS =
  'block w-full rounded-lg border border-bw-line bg-white px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25';
const INPUT_LABEL = 'mb-1.5 block text-[12px] font-semibold text-bw-ink';
const PRIMARY_BTN =
  'w-full rounded-lg bg-bw-blue px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:bg-bw-line disabled:shadow-none';

const PROFILE_COLUMNS = 'nama_lengkap, divisi, jabatan, role_akses, status_akun';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export default function Akun() {
  const { session, loading, signOut } = useSession();
  const [profile, setProfile] = useState(null);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

  const [editOpen, setEditOpen] = useState(false);
  const [profForm, setProfForm] = useState({
    nama_lengkap: '',
    divisi: DIVISI_OPTIONS[0],
    jabatan: JABATAN_OPTIONS[0],
  });
  const [profSaving, setProfSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState(null);

  const [pwForm, setPwForm] = useState({ password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const reminder = useDueReminder([]);

  useEffect(() => subscribeSound(setSoundOn), []);

  useEffect(() => {
    if (!session) return;
    let active = true;

    fetchProfile(session).then((data) => {
      if (active) setProfile(data);
    });

    return () => {
      active = false;
    };
  }, [session]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-bw-muted">Memuat sesi...</p>;
  }

  if (!session) {
    return (
      <p className="py-10 text-center text-sm text-bw-muted">
        Mengalihkan ke halaman masuk...
      </p>
    );
  }

  const nama = profile?.nama_lengkap || session.user.email;
  const divisi = profile?.divisi || 'Belum diatur';
  const jabatan = profile?.jabatan || 'Belum diatur';

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) playChime();
  };

  const toggleEditProfile = () => {
    if (!editOpen) {
      setProfForm({
        nama_lengkap: profile?.nama_lengkap ?? '',
        divisi: profile?.divisi ?? DIVISI_OPTIONS[0],
        jabatan: profile?.jabatan ?? JABATAN_OPTIONS[0],
      });
      setProfileNotice(null);
    }
    setEditOpen(!editOpen);
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    const nama = profForm.nama_lengkap.trim();
    if (!nama || nama.length > 200) {
      setProfileNotice({ type: 'error', text: 'Nama lengkap wajib diisi, maksimal 200 karakter.' });
      return;
    }

    setProfSaving(true);
    setProfileNotice(null);

    const changes = { nama_lengkap: nama, divisi: profForm.divisi, jabatan: profForm.jabatan };
    let saved = null;

    try {
      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update(changes)
        .eq('id', session.user.id)
        .select(PROFILE_COLUMNS);

      if (updateError) throw new Error(updateError.message);
      saved = updated?.[0] ?? null;

      if (!saved) {
        const { data: existing, error: checkError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (checkError) throw new Error(checkError.message);

        if (existing) {
          throw new Error(
            'baris profil ada tetapi tidak bisa diubah. Kebijakan RLS ' +
              '"update own profile" kemungkinan menolaknya - jalankan supabase/schema.sql ' +
              'di SQL Editor Supabase.',
          );
        }

        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email,
            ...changes,
            role_akses: 'Staf',
            status_akun: 'Aktif',
          })
          .select(PROFILE_COLUMNS);

        if (insertError) throw new Error(insertError.message);
        saved = inserted?.[0] ?? null;
      }
    } catch (error) {
      setProfSaving(false);
      setProfileNotice({ type: 'error', text: `Gagal menyimpan profil. Detail: ${error.message}` });
      return;
    }

    setProfSaving(false);

    if (!saved) {
      setProfileNotice({ type: 'error', text: 'Profil tidak tersimpan. Periksa tabel profiles di SQL Editor.' });
      return;
    }

    setProfile(saved);
    setEditOpen(false);
    setProfileNotice({ type: 'ok', text: 'Profil berhasil diperbarui.' });
  };

  const savePassword = async (event) => {
    event.preventDefault();

    if (pwForm.password.length < MIN_PASSWORD_LENGTH) {
      setPwMsg({ type: 'error', text: `Password minimal ${MIN_PASSWORD_LENGTH} karakter.` });
      return;
    }
    if (pwForm.password !== pwForm.confirm) {
      setPwMsg({ type: 'error', text: 'Konfirmasi password tidak sama.' });
      return;
    }

    setPwSaving(true);
    setPwMsg(null);

    const { error } = await supabase.auth.updateUser({ password: pwForm.password });

    setPwSaving(false);

    if (error) {
      setPwMsg({ type: 'error', text: `Gagal mengubah password. Detail: ${error.message}` });
      return;
    }

    setPwForm({ password: '', confirm: '' });
    setPwMsg({ type: 'ok', text: 'Password berhasil diubah.' });
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-bw-line bg-white shadow-sm">
        <div className="flex items-center gap-3.5 border-b border-bw-line bg-bw-blue-50 px-4 py-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-bw-blue text-lg font-bold text-white ring-4 ring-white">
            {initialsOf(nama)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-bw-ink">{nama}</p>
            <p className="truncate text-xs text-bw-muted">{session.user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-bw-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {profile?.role_akses || 'Staf'}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleEditProfile}
            className="shrink-0 rounded-lg border border-bw-blue-200 bg-white px-3 py-2 text-[11px] font-bold text-bw-blue transition-colors hover:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
          >
            {editOpen ? 'Batal' : 'Ubah'}
          </button>
        </div>

        {profileNotice && (
          <p
            role="status"
            className={`border-b px-4 py-2.5 text-xs leading-relaxed ${
              profileNotice.type === 'error'
                ? 'border-bw-red-100 bg-bw-red-50 text-bw-red'
                : 'border-bw-blue-200 bg-bw-blue-50 text-bw-blue-900'
            }`}
          >
            {profileNotice.text}
          </p>
        )}

        {editOpen ? (
          <form onSubmit={saveProfile} className="space-y-3 px-4 py-4">
            <div>
              <label htmlFor="nama_lengkap" className={INPUT_LABEL}>
                Nama Lengkap
              </label>
              <input
                id="nama_lengkap"
                type="text"
                value={profForm.nama_lengkap}
                onChange={(event) =>
                  setProfForm((previous) => ({ ...previous, nama_lengkap: event.target.value }))
                }
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label htmlFor="divisi" className={INPUT_LABEL}>
                Divisi
              </label>
              <select
                id="divisi"
                value={profForm.divisi}
                onChange={(event) =>
                  setProfForm((previous) => ({ ...previous, divisi: event.target.value }))
                }
                className={FIELD_CLASS}
              >
                {DIVISI_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="jabatan" className={INPUT_LABEL}>
                Jabatan
              </label>
              <select
                id="jabatan"
                value={profForm.jabatan}
                onChange={(event) =>
                  setProfForm((previous) => ({ ...previous, jabatan: event.target.value }))
                }
                className={FIELD_CLASS}
              >
                {JABATAN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" disabled={profSaving} className={PRIMARY_BTN}>
              {profSaving ? 'Menyimpan...' : 'Simpan profil'}
            </button>
          </form>
        ) : (
          <dl className="divide-y divide-bw-line px-4">
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>Divisi</dt>
              <dd className={VALUE_CLASS}>{divisi}</dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>Jabatan</dt>
              <dd className={VALUE_CLASS}>{jabatan}</dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>Status akun</dt>
              <dd className={VALUE_CLASS}>{profile?.status_akun || 'Aktif'}</dd>
            </div>
            <div className={ROW_CLASS}>
              <dt className={LABEL_CLASS}>Bergabung</dt>
              <dd className={VALUE_CLASS}>
                {new Date(session.user.created_at).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-xl border border-bw-line bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-bw-ink">
          Pengaturan Pengingat
        </h2>

        <button
          type="button"
          onClick={toggleSound}
          role="switch"
          aria-checked={soundOn}
          className="mt-3 flex w-full items-center justify-between gap-4 rounded-lg border border-bw-line bg-bw-surface px-3.5 py-3 text-left transition-colors hover:border-bw-blue-200 focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
        >
          <span>
            <span className="block text-[13px] font-semibold text-bw-ink">
              Suara notifikasi
            </span>
            <span className="block text-xs text-bw-muted">
              Bunyi chime saat jadwal mendekat
            </span>
          </span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              soundOn ? 'bg-bw-blue' : 'bg-bw-line'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                soundOn ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </span>
        </button>

        {reminder.supported && reminder.permission !== 'granted' && (
          <div className="mt-3 rounded-lg border border-bw-blue-200 bg-bw-blue-50 px-3.5 py-3">
            <p className="text-xs leading-relaxed text-bw-blue-900">
              Aktifkan izin browser agar notifikasi muncul walau tab tidak sedang
              dibuka. Pengingat {reminder.leadMinutes} menit sebelum jadwal dimulai.
            </p>
            <button
              type="button"
              onClick={reminder.requestPermission}
              disabled={reminder.permission === 'denied'}
              className="mt-2 rounded-lg bg-bw-blue px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted"
            >
              {reminder.permission === 'denied'
                ? 'Diblokir browser'
                : 'Aktifkan notifikasi'}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-bw-line bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-bw-ink">
          Keamanan Akun
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-bw-muted">
          Email tidak bisa diubah di sini karena butuh verifikasi. Gunakan email yang sama
          untuk masuk.
        </p>

        <form onSubmit={savePassword} className="mt-3 space-y-3">
          <div>
            <label htmlFor="password_baru" className={INPUT_LABEL}>
              Password Baru
            </label>
            <input
              id="password_baru"
              type="password"
              autoComplete="new-password"
              value={pwForm.password}
              onChange={(event) =>
                setPwForm((previous) => ({ ...previous, password: event.target.value }))
              }
              placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label htmlFor="password_ulang" className={INPUT_LABEL}>
              Ulangi Password Baru
            </label>
            <input
              id="password_ulang"
              type="password"
              autoComplete="new-password"
              value={pwForm.confirm}
              onChange={(event) =>
                setPwForm((previous) => ({ ...previous, confirm: event.target.value }))
              }
              className={FIELD_CLASS}
            />
          </div>

          {pwMsg && (
            <p
              role={pwMsg.type === 'error' ? 'alert' : 'status'}
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                pwMsg.type === 'error'
                  ? 'bg-bw-red-50 text-bw-red'
                  : 'bg-bw-blue-50 text-bw-blue-900'
              }`}
            >
              {pwMsg.text}
            </p>
          )}

          <button type="submit" disabled={pwSaving} className={PRIMARY_BTN}>
            {pwSaving ? 'Menyimpan...' : 'Ubah password'}
          </button>
        </form>
      </section>

      <button
        type="button"
        onClick={signOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-bw-red-100 bg-white px-4 py-3 text-sm font-semibold text-bw-red transition-colors hover:bg-bw-red-50 focus:outline-none focus:ring-2 focus:ring-bw-red/40"
      >
        Keluar dari akun
      </button>

      <p className="pb-2 text-center text-[11px] leading-relaxed text-bw-muted">
        Aplikasi internal Bawaslu Kota Bekasi dengan akses terbatas.
      </p>
    </div>
  );
}
