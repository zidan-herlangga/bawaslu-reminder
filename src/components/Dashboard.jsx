import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import fetchProfile from '../lib/fetchProfile';
import useSession from '../hooks/useSession';
import useDueReminder from '../hooks/useDueReminder';
import ClockWidget from './ClockWidget';
import AddToCalendar from './AddToCalendar';
import { notifyNow, sendRemind } from '../lib/push';
import { isSoundBusy, playReminderSound, subscribeSoundBusy } from '../lib/sound';
import { showToast } from '../lib/toast';
import { getSlots, resolveAgenda, sortSlots } from '../lib/slots';
import { DIVISI_FILTER_OPTIONS, DIVISI_SHORT } from '../constants/options';

const TICK_MS = 30 * 1000;

const KATEGORI_STYLE = {
  Rapat: 'bg-bw-blue-50 text-bw-blue-700 ring-bw-blue-200',
  Tugas: 'bg-amber-50 text-amber-700 ring-amber-200',
  Pengawasan: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Lainnya: 'bg-bw-surface text-bw-muted ring-bw-line',
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
  const [schedules, setSchedules] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [divisiFilter, setDivisiFilter] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [remind, setRemind] = useState({ id: '', status: '', message: '' });
  const [soundBusy, setSoundBusy] = useState(() => isSoundBusy());

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

  const loadSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('waktu_mulai', { ascending: true });

    if (error) {
      console.error('[Dashboard] gagal memuat jadwal:', error.message);
      setListError(
        `Gagal memuat jadwal. Detail: ${error.message}. ` +
          'Jalankan supabase/schema.sql di SQL Editor Supabase untuk membuat tabel beserta aturan RLS-nya.'
      );
      setSchedules([]);
    } else {
      setListError('');
      setSchedules(data ?? []);
    }

    setListLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;

    setListLoading(true);
    loadSchedules();
    fetchProfile(session).then(setProfile);
  }, [session, loadSchedules]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const visibleSchedules = useMemo(() => {
    if (!divisiFilter) return schedules;
    return schedules.filter((item) => item.pembuat_divisi === divisiFilter);
  }, [schedules, divisiFilter]);

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
        <section className="rounded-xl border border-bw-blue-200 bg-white p-5 shadow-sm ring-1 ring-bw-blue-100/70">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-bw-blue">
                Berikutnya
              </p>
              <h2 className="mt-1.5 font-display text-lg font-bold leading-snug text-bw-ink">
                {nextItem.schedule.judul}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-bw-muted">
                {formatWaktu(nextItem.slot.mulai)}
                {nextItem.slot.selesai && ` sampai ${formatJam(nextItem.slot.selesai)}`}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide ring-1 ${
                    KATEGORI_STYLE[nextItem.schedule.kategori] ?? KATEGORI_STYLE['Lainnya']
                  }`}
                >
                  {nextItem.schedule.kategori}
                </span>
                <span className="rounded-full bg-bw-surface px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-bw-muted ring-1 ring-bw-line">
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

      <section className="rounded-xl border border-bw-line bg-white p-4 shadow-sm">
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
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-bw-blue px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 active:scale-[0.98]"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            Buat
          </Link>
        </div>
      </section>

      {reminder.supported && reminder.permission !== 'granted' && (
        <div className="flex items-start gap-3 rounded-xl border border-bw-blue-200 bg-bw-blue-50 px-4 py-3">
          <p className="flex-1 text-xs leading-relaxed text-bw-blue-900">
            Aktifkan notifikasi agar pengingat muncul {reminder.leadMinutes} menit
            sebelum jadwal dimulai.
          </p>
          <button
            type="button"
            onClick={reminder.requestPermission}
            disabled={reminder.permission === 'denied'}
            className="shrink-0 rounded-lg bg-bw-blue px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted"
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
                      : 'border-bw-line bg-white text-bw-muted hover:border-bw-blue-200 hover:text-bw-blue'
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
          className="rounded-xl border border-bw-red-100 bg-bw-red-50 px-4 py-3 text-xs leading-relaxed text-bw-red"
        >
          {listError}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {listLoading && (
          <p className="py-8 text-center text-sm text-bw-muted md:col-span-2">
            Memuat jadwal...
          </p>
        )}

        {!listLoading && schedules.length === 0 && !listError && (
          <div className="rounded-xl border border-dashed border-bw-line bg-white px-5 py-10 text-center md:col-span-2">
            <p className="text-sm font-semibold text-bw-ink">Belum ada jadwal</p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Tekan tombol Buat untuk menambahkan pengingat pertama.
            </p>
          </div>
        )}

        {!listLoading && schedules.length > 0 && visibleSchedules.length === 0 && (
          <div className="rounded-xl border border-dashed border-bw-line bg-white px-5 py-10 text-center md:col-span-2">
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
            const sudahLewat = agenda.state === 'done';
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
                className={`rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow ${
                  sudahLewat ? 'border-bw-line opacity-70' : 'border-bw-line'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${style}`}
                      >
                        {schedule.kategori}
                      </span>
                      <span className="rounded-full bg-bw-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bw-blue-700 ring-1 ring-bw-blue-200">
                        {schedule.target_divisi
                          ? `Khusus ${
                              DIVISI_SHORT[schedule.target_divisi] ?? schedule.target_divisi
                            }`
                          : 'Semua staf'}
                      </span>
                      {schedule.status !== 'Aktif' && (
                        <span className="rounded-full bg-bw-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bw-red ring-1 ring-bw-red-100">
                          {schedule.status}
                        </span>
                      )}
                      {slots.length > 1 && (
                        <span className="rounded-full bg-bw-surface px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bw-muted ring-1 ring-bw-line">
                          {slots.length} sesi
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 font-display text-[15px] font-bold leading-snug text-bw-ink">
                      {schedule.judul}
                    </h3>

                    <ul className="mt-1.5 space-y-1">
                      {slots.map((slot) => (
                        <li
                          key={slot.mulai}
                          className="flex items-start gap-2 text-xs leading-relaxed text-bw-muted"
                        >
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-bw-blue" />
                          <span>
                            {formatWaktu(slot.mulai)}
                            {slot.selesai && ` sampai ${formatJam(slot.selesai)}`}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {schedule.deskripsi && (
                      <p className="mt-2 whitespace-pre-line break-words text-xs leading-relaxed text-bw-muted">
                        {schedule.deskripsi}
                      </p>
                    )}

                    <p className="mt-3 border-t border-bw-line pt-2 text-xs text-bw-muted">
                      {schedule.pembuat_nama} -{' '}
                      {DIVISI_SHORT[schedule.pembuat_divisi] ?? schedule.pembuat_divisi}
                    </p>

                    {remind.id === schedule.id && remind.message && (
                      <p
                        role="status"
                        className={`mt-2 rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                          remind.status === 'error'
                            ? 'bg-bw-red-50 text-bw-red'
                            : 'bg-bw-blue-50 text-bw-blue-900'
                        }`}
                      >
                        {remind.message}
                      </p>
                    )}

                    <AddToCalendar schedule={schedule} />
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`max-w-[6.5rem] text-xs font-bold ${
                        sudahLewat ? 'text-bw-muted' : 'text-bw-blue'
                      }`}
                    >
                      {schedule.status === 'Aktif' ? sisa : schedule.status}
                    </p>
                    {schedule.pembuat_id === session.user.id && (
                      <div className="mt-2.5 flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemind(schedule)}
                          disabled={
                            soundBusy ||
                            (remind.id === schedule.id && remind.status === 'busy')
                          }
                          className="rounded-lg bg-bw-blue px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted disabled:shadow-none"
                        >
                          {remind.id === schedule.id && remind.status === 'busy'
                            ? 'Mengirim...'
                            : 'Ingatkan'}
                        </button>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <Link
                            to={`/jadwal/${schedule.id}/edit`}
                            className="text-bw-muted transition-colors hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40 rounded-sm"
                          >
                            Edit
                          </Link>
                          <span aria-hidden="true" className="text-bw-line">
                            /
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('Hapus jadwal ini?')) return;
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
                            }}
                            className="rounded-sm text-bw-red transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-bw-red/40"
                          >
                            Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
