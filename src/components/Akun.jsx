import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import useSession from '../hooks/useSession';
import useDueReminder from '../hooks/useDueReminder';
import fetchProfile from '../lib/fetchProfile';
import { isSoundEnabled, playChime, setSoundEnabled, subscribeSound } from '../lib/sound';

const ROW_CLASS = 'flex items-start justify-between gap-4 py-3';
const LABEL_CLASS = 'text-[13px] text-bw-muted';
const VALUE_CLASS = 'text-right text-[13px] font-semibold text-bw-ink break-words';

function initialsOf(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

export default function Akun() {
  const { session, loading, signOut } = useSession();
  const [profile, setProfile] = useState(null);
  const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

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

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-bw-line bg-white shadow-sm">
        <div className="flex items-center gap-3.5 border-b border-bw-line bg-bw-blue-50 px-4 py-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-bw-blue text-lg font-bold text-white ring-4 ring-white">
            {initialsOf(nama)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-bw-ink">{nama}</p>
            <p className="truncate text-xs text-bw-muted">{session.user.email}</p>
            <span className="mt-1 inline-block rounded-full bg-bw-red px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {profile?.role_akses || 'Staf'}
            </span>
          </div>
        </div>

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
