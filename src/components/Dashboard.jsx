import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import fetchProfile from '../lib/fetchProfile';
import useSession from '../hooks/useSession';
import useDueReminder from '../hooks/useDueReminder';
import useSchedules from '../hooks/useSchedules';
import ClockWidget from './ClockWidget';
import ConfirmDialog from './ConfirmDialog';
import AddToCalendar from './AddToCalendar';
import { notifyNow, sendRemind } from '../lib/push';
import { isSoundBusy, playReminderSound, subscribeSoundBusy } from '../lib/sound';
import { showToast } from '../lib/toast';
import {
  getSlots,
  jadwalSelesai,
  resolveAgenda,
  sortByAgenda,
  sortSlots,
} from '../lib/slots';
import { DIVISI_FILTER_OPTIONS, DIVISI_SHORT } from '../constants/options';

const TICK_MS = 30 * 1000;

const KATEGORI_STYLE = {
  Rapat: 'bg-bw-blue-50 text-bw-blue-700 ring-bw-blue-200',
  Tugas: 'bg-bw-amber-50 text-bw-amber ring-bw-amber-200',
  Pengawasan: 'bg-bw-green-50 text-bw-green-700 ring-bw-green-200',
  Lainnya: 'bg-bw-surface text-bw-muted ring-bw-line',
};

const KATEGORI_ACCENT = {
  Rapat: 'bg-bw-blue',
  Tugas: 'bg-bw-amber-500',
  Pengawasan: 'bg-bw-green-500',
  Lainnya: 'bg-bw-line',
};

function formatWaktu(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSisa(targetMs, now) {
  const diff = targetMs - now;

  if (diff <= 0) return 'Sudah dimulai';

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} hari lagi`;
  if (hours > 0) return `${hours} jam ${minutes} menit lagi`;
  if (minutes > 0) return `${minutes} menit lagi`;
  return 'Kurang dari 1 menit';
}

function formatJam(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatTanggalPendek(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function splitCountdown(targetMs, now) {
  const diff = targetMs - now;
  if (diff <= 0) return { angka: '0', satuan: 'sekarang' };

  const totalMinutes = Math.floor(diff / 60000);
  if (totalMinutes >= 1440) return { angka: String(Math.floor(totalMinutes / 1440)), satuan: 'hari lagi' };
  if (totalMinutes >= 60) return { angka: String(Math.floor(totalMinutes / 60)), satuan: 'jam lagi' };
  if (totalMinutes >= 1) return { angka: String(totalMinutes), satuan: 'menit lagi' };
  return { angka: '<1', satuan: 'menit lagi' };
}

export default function Dashboard() {
  const { session, loading } = useSession();

  const [profile, setProfile] = useState(null);
  const { schedules, loading: listLoading, error: listError, reload: loadSchedules } =
    useSchedules(session);
  const [divisiFilter, setDivisiFilter] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [remind, setRemind] = useState({ id: '', status: '', message: '' });
  const [soundBusy, setSoundBusy] = useState(() => isSoundBusy());
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(null);
  const [hapusBusy, setHapusBusy] = useState(false);

  const handleHapus = async (schedule) => {
    setHapusBusy(true);

    try {
      const { data, error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', schedule.id)
        .select('id');

      if (error || !data?.length) {
        showToast(
          error?.message ??
            'Jadwal tidak terhapus (0 baris terpengaruh). Periksa aturan RLS di schema.sql.',
          'error'
        );
        return;
      }

      showToast('Jadwal dihapus.', 'success');
      loadSchedules();
    } finally {
      setHapusBusy(false);
      setKonfirmasiHapus(null);
    }
  };

  useEffect(() => subscribeSoundBusy(setSoundBusy), []);

  const reminder = useDueReminder(schedules, profile?.divisi);

  const handleRemind = async (schedule) => {
    setRemind({ id: schedule.id, status: 'busy', message: '' });

    // Minta izin di detik klik, saat gesture user masih berlaku, lalu tunggu
    // hasilnya supaya notifyNow tidak jalan saat izinnya masih default.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }

    try {
      const result = await sendRemind(schedule.id, session);
      const catatan = result.catatan ? ` ${result.catatan}` : '';
      const message = `Pengingat terkirim ke ${result.terkirim} penerima, ${result.push} notifikasi browser.${catatan}`;
      setRemind({ id: schedule.id, status: 'ok', message });

      const slots = sortSlots(getSlots(schedule));
      const waktu = slots.length ? formatWaktu(slots[0].mulai) : '';

      await playReminderSound(schedule.kategori);
      await notifyNow({
        title: 'Pengingat jadwal',
        body: waktu ? `${schedule.judul} - ${waktu}` : schedule.judul,
        tag: `remind-${schedule.id}-${Date.now()}`,
      });

      showToast(
        result.terkirim > 0
          ? `Pengingat dikirim ke ${result.terkirim} penerima.`
          : 'Pengingat diproses.',
        'success'
      );
    } catch (error) {
      console.error('[Dashboard] kirim pengingat gagal:', error?.message);
      const message = error?.message ?? 'Gagal mengirim pengingat.';
      setRemind({ id: schedule.id, status: 'error', message });
      showToast(message, 'error');
    }
  };

  useEffect(() => {
    if (!session) return;

    fetchProfile(session).then(setProfile);
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const visibleSchedules = useMemo(() => {
    const dasar = divisiFilter
      ? schedules.filter((item) => item.pembuat_divisi === divisiFilter)
      : schedules;
    return sortByAgenda(dasar, now);
  }, [schedules, divisiFilter, now]);

  const nextItem = useMemo(() => {
    let best = null;
    for (const schedule of visibleSchedules) {
      if (schedule.status !== 'Aktif') continue;
      const slots = sortSlots(getSlots(schedule));
      const agenda = resolveAgenda(slots, now);
      if (agenda.state !== 'upcoming') continue;
      if (!best || agenda.nextStart < best.nextStart) {
        const slot = slots.find((item) => item.mulai === agenda.nextStart) || slots[0];
        best = { schedule, nextStart: agenda.nextStart, slot };
      }
    }
    return best;
  }, [visibleSchedules, now]);

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

  const displayName = profile?.nama_lengkap || session.user.email;
  const sapaan = new Date().getHours() < 11 ? 'Selamat pagi' : new Date().getHours() < 15 ? 'Selamat siang' : new Date().getHours() < 18 ? 'Selamat sore' : 'Selamat malam';

  return (
    <div className="space-y-5">
      <ClockWidget />

      {nextItem && (
        <section className="relative overflow-hidden rounded-3xl border border-bw-blue-200 bg-gradient-to-br from-white via-white to-bw-blue-50 p-5 shadow-card ring-1 ring-bw-blue-100/70 sm:p-6">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-bw-blue" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-bw-blue">
                Berikutnya
              </p>
              <h2 className="mt-1.5 font-display text-lg font-bold leading-snug text-bw-ink">
                {nextItem.schedule.judul}
              </h2>
              <p className="mt-2 font-display text-[15px] font-bold leading-none tabular-nums text-bw-ink">
                {formatJam(nextItem.slot.mulai)}
                {nextItem.slot.selesai && (
                  <span className="text-bw-muted"> - {formatJam(nextItem.slot.selesai)}</span>
                )}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-bw-muted">
                {formatTanggalPendek(nextItem.slot.mulai)}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ${
                    KATEGORI_STYLE[nextItem.schedule.kategori] ?? KATEGORI_STYLE['Lainnya']
                  }`}
                >
                  {nextItem.schedule.kategori}
                </span>
                <span className="rounded-full bg-bw-card px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-bw-muted ring-1 ring-bw-line">
                  {nextItem.schedule.target_divisi
                    ? `Khusus ${
                        DIVISI_SHORT[nextItem.schedule.target_divisi] ??
                        nextItem.schedule.target_divisi
                      }`
                    : 'Semua staf'}
                </span>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-display text-[36px] font-bold leading-none tabular-nums text-bw-blue sm:text-[44px] md:text-[48px]">
                {splitCountdown(nextItem.nextStart, now).angka}
              </p>
              <p className="mt-1 font-display text-xs font-semibold uppercase tracking-wide text-bw-muted">
                {splitCountdown(nextItem.nextStart, now).satuan}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-bw-muted">
          {sapaan}
        </p>
        <h1 className="mt-1 font-display text-xl font-bold leading-snug text-bw-ink">{displayName}</h1>
        {profile && (
          <p className="mt-0.5 text-xs leading-relaxed text-bw-muted">
            {profile.jabatan} - {DIVISI_SHORT[profile.divisi] ?? profile.divisi}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-bw-line pt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-bw-blue-50 px-2.5 py-1 text-xs font-semibold text-bw-blue-700">
            <span className="h-1.5 w-1.5 rounded-full bg-bw-blue" />
            {schedules.length} jadwal aktif
          </span>
          <Link
            to="/jadwal/baru"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-bw-blue px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 active:scale-[0.98]"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Buat
          </Link>
        </div>
      </section>

      {reminder.supported && reminder.permission !== 'granted' && (
        <div className="flex items-start gap-3 rounded-3xl border border-bw-blue-200 bg-bw-blue-50 px-4 py-3">
          <p className="flex-1 text-xs leading-relaxed text-bw-blue-900">
            Aktifkan notifikasi agar pengingat muncul {reminder.leadMinutes} menit
            sebelum jadwal dimulai.
          </p>
          <button
            type="button"
            onClick={reminder.requestPermission}
            disabled={reminder.permission === 'denied'}
            className="shrink-0 rounded-xl bg-bw-blue px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted"
          >
            {reminder.permission === 'denied' ? 'Diblokir' : 'Izinkan'}
          </button>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[13px] font-bold uppercase tracking-wide text-bw-ink">
            Jadwal per Divisi
          </h2>
          <span className="text-xs text-bw-muted">
            {visibleSchedules.length} ditampilkan
          </span>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <div className="flex w-max gap-2">
            {DIVISI_FILTER_OPTIONS.map((option) => {
              const active = divisiFilter === option.value;
              return (
                <button
                  key={option.value || 'semua'}
                  type="button"
                  onClick={() => setDivisiFilter(option.value)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-bw-blue/40 ${
                    active
                      ? 'border-bw-blue bg-bw-blue text-white shadow-sm'
                      : 'border-bw-line bg-bw-card text-bw-muted hover:border-bw-blue-200 hover:text-bw-blue'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {listError && (
        <div
          role="alert"
          className="rounded-3xl border border-bw-red-100 bg-bw-red-50 px-4 py-3.5 text-xs leading-relaxed text-bw-red"
        >
          <p className="font-semibold">Jadwal tidak bisa dimuat.</p>
          <p className="mt-1 opacity-90">{listError}</p>
          <button
            type="button"
            onClick={() => loadSchedules()}
            disabled={listLoading}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-bw-red-solid px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-red/40 disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 4v5h-5" />
            </svg>
            {listLoading ? 'Mencoba lagi...' : 'Coba lagi'}
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {listLoading && (
          <p className="py-8 text-center text-sm text-bw-muted md:col-span-2">
            Memuat jadwal...
          </p>
        )}

        {!listLoading && schedules.length === 0 && !listError && (
          <div className="rounded-3xl border border-dashed border-bw-line bg-bw-card px-5 py-10 text-center md:col-span-2">
            <svg
              className="mx-auto mb-3 h-9 w-9 text-bw-blue-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="16" rx="3" />
              <path d="M8 3v4M16 3v4M3 10h18" />
              <path d="M12 13.5v5M9.5 16h5" />
            </svg>
            <p className="text-sm font-semibold text-bw-ink">Belum ada jadwal</p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Belum ada pengingat yang perlu dipantau. Buat yang pertama agar
              semua staf tahu waktunya.
            </p>
            <Link
              to="/jadwal/baru"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-bw-blue px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40 active:scale-[0.98]"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
              </svg>
              Buat pengingat pertama
            </Link>
          </div>
        )}

        {!listLoading && schedules.length > 0 && visibleSchedules.length === 0 && (
          <div className="rounded-3xl border border-dashed border-bw-line bg-bw-card px-5 py-10 text-center md:col-span-2">
            <svg
              className="mx-auto mb-3 h-9 w-9 text-bw-blue-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            <p className="text-sm font-semibold text-bw-ink">Tidak ada jadwal</p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Belum ada jadwal dari divisi yang dipilih.
            </p>
            <button
              type="button"
              onClick={() => setDivisiFilter('')}
              className="mt-3 text-xs font-semibold text-bw-blue underline underline-offset-2 hover:text-bw-blue-hi"
            >
              Tampilkan semua divisi
            </button>
          </div>
        )}

        {!listLoading &&
          visibleSchedules.map((schedule) => {
            const slots = sortSlots(getSlots(schedule));
            const agenda = resolveAgenda(slots, now);
            const sudahLewat = jadwalSelesai(schedule, now);
            const sisa =
              agenda.state === 'ongoing'
                ? 'Sedang berlangsung'
                : agenda.state === 'upcoming'
                  ? formatSisa(agenda.nextStart, now)
                  : 'Selesai';
            const style = KATEGORI_STYLE[schedule.kategori] ?? KATEGORI_STYLE['Lainnya'];

            return (
              <article
                key={schedule.id}
                className={`group relative overflow-hidden rounded-3xl border border-bw-line bg-bw-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lift ${
                  sudahLewat ? 'opacity-70' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${
                    KATEGORI_ACCENT[schedule.kategori] ?? KATEGORI_ACCENT['Lainnya']
                  }`}
                />

                <div className="flex items-start gap-3 p-4 pl-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${style}`}
                      >
                        {schedule.kategori}
                      </span>
                      <span className="rounded-full bg-bw-blue-50 px-2 py-0.5 text-xs font-bold text-bw-blue-700 ring-1 ring-bw-blue-200">
                        {schedule.target_divisi
                          ? `Khusus ${
                              DIVISI_SHORT[schedule.target_divisi] ?? schedule.target_divisi
                            }`
                          : 'Semua staf'}
                      </span>
                      {schedule.status !== 'Aktif' && (
                        <span className="rounded-full bg-bw-red-50 px-2 py-0.5 text-xs font-bold text-bw-red ring-1 ring-bw-red-100">
                          {schedule.status}
                        </span>
                      )}
                      {slots.length > 1 && (
                        <span className="rounded-full bg-bw-surface px-2 py-0.5 text-xs font-bold text-bw-muted ring-1 ring-bw-line">
                          {slots.length} sesi
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 font-display text-[15px] font-bold leading-snug text-bw-ink">
                      {schedule.judul}
                    </h3>

                    {slots.length > 0 && (
                      <ul className="mt-2.5 divide-y divide-bw-line/70 rounded-xl bg-bw-surface px-3 py-0.5">
                        {slots.map((slot) => (
                          <li
                            key={slot.mulai}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2"
                          >
                            <span className="font-display text-[15px] font-bold leading-none tabular-nums text-bw-ink">
                              {formatJam(slot.mulai)}
                              {slot.selesai && (
                                <span className="text-bw-muted"> - {formatJam(slot.selesai)}</span>
                              )}
                            </span>
                            <span className="ml-auto text-xs text-bw-muted">
                              {formatTanggalPendek(slot.mulai)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {schedule.deskripsi && (
                      <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-bw-muted">
                        {schedule.deskripsi}
                      </p>
                    )}

                    {remind.id === schedule.id && remind.message && (
                      <p
                        role="status"
                        className={`mt-2 rounded-xl px-2.5 py-1.5 text-xs leading-relaxed ${
                          remind.status === 'error'
                            ? 'bg-bw-red-50 text-bw-red'
                            : 'bg-bw-blue-50 text-bw-blue-900'
                        }`}
                      >
                        {remind.message}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    {sudahLewat ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-bw-surface px-2.5 py-1 text-xs font-bold text-bw-muted">
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M4.5 12.5l5 5 10-11" />
                        </svg>
                        Selesai
                      </span>
                    ) : (
                      <p
                        className={`text-xs font-bold ${
                          sudahLewat ? 'text-bw-muted' : 'text-bw-blue'
                        }`}
                      >
                        {schedule.status === 'Aktif' ? sisa : schedule.status}
                      </p>
                    )}
                    {schedule.pembuat_id === session.user.id && (
                      <div className="mt-2.5 flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemind(schedule)}
                          disabled={
                            soundBusy ||
                            (remind.id === schedule.id && remind.status === 'busy')
                          }
                          className="h-11 rounded-xl bg-bw-blue px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40 disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted disabled:shadow-none"
                        >
                          {remind.id === schedule.id && remind.status === 'busy'
                            ? 'Mengirim...'
                            : 'Ingatkan'}
                        </button>

                        {/* Edit dan Hapus dulunya hanya teks kecil dengan pemisah
                            slash. Keduanya jadi tombol sungguhan supaya target
                            sentuhnya cukup besar dan tidak salah-tekan. */}
                        <div className="flex items-center gap-1.5">
                          <Link
                            to={`/jadwal/${schedule.id}/edit`}
                            aria-label={`Ubah jadwal ${schedule.judul}`}
                            className="grid h-9 min-w-16 place-items-center rounded-lg px-2 text-xs font-semibold text-bw-muted transition-colors hover:bg-bw-blue-50 hover:text-bw-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40"
                          >
                            Ubah
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setKonfirmasiHapus({
                                id: schedule.id,
                                judul: schedule.judul,
                              })
                            }
                            aria-label={`Hapus jadwal ${schedule.judul}`}
                            className="grid h-9 min-w-16 place-items-center rounded-lg px-2 text-xs font-semibold text-bw-red transition-colors hover:bg-bw-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-red/40"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-bw-line bg-bw-surface/70 px-4 py-2.5 pl-5">
                  <p className="min-w-0 truncate text-xs text-bw-muted">
                    {schedule.pembuat_nama} -{' '}
                    {DIVISI_SHORT[schedule.pembuat_divisi] ?? schedule.pembuat_divisi}
                  </p>
                  <AddToCalendar schedule={schedule} />
                </footer>
              </article>
            );
          })}
      </div>

      <ConfirmDialog
        open={Boolean(konfirmasiHapus)}
        judul="Hapus jadwal?"
        pesan={
          konfirmasiHapus
            ? `"${konfirmasiHapus.judul}" akan dihapus untuk semua staf. Tindakan ini tidak bisa dibatalkan.`
            : ''
        }
        labelSetuju="Hapus"
        sibuk={hapusBusy}
        onBatal={() => setKonfirmasiHapus(null)}
        onSetuju={() => konfirmasiHapus && handleHapus(konfirmasiHapus)}
      />
    </div>
  );
}
