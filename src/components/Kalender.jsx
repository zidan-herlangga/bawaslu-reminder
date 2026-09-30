import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import useSession from '../hooks/useSession';
import AddToCalendar from './AddToCalendar';
import { getSlots, resolveAgenda, sortSlots } from '../lib/slots';
import { notifyNow, sendRemind } from '../lib/push';
import { isSoundBusy, playReminderSound, subscribeSoundBusy } from '../lib/sound';
import { showToast } from '../lib/toast';
import { DIVISI_FILTER_OPTIONS, DIVISI_SHORT } from '../constants/options';
import { getHariLibur, labelJenis } from '../data/hariLibur';

const TICK_MS = 30 * 1000;
const BATAS_HASIL = 40;

const FILTER_STATUS = [
  { value: 'semua', label: 'Semua' },
  { value: 'aktif', label: 'Aktif' },
  { value: 'selesai', label: 'Selesai' },
];

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const KATEGORI_STYLE = {
  Rapat: 'bg-bw-blue-50 text-bw-blue-700 ring-bw-blue-200',
  Tugas: 'bg-amber-50 text-amber-700 ring-amber-200',
  Pengawasan: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Lainnya: 'bg-bw-surface text-bw-muted ring-bw-line',
};

const KATEGORI_ACCENT = {
  Rapat: 'bg-bw-blue',
  Tugas: 'bg-amber-500',
  Pengawasan: 'bg-emerald-500',
  Lainnya: 'bg-bw-line',
};

function ymd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMonthGrid(view) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leading = (firstDay.getDay() + 6) % 7;

  const cells = [];
  for (let i = 0; i < leading; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  return cells;
}

function formatJam(iso) {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTanggalPanjang(date) {
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatWaktuLengkap(iso) {
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTanggalPendek(iso) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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

function ChevronButton({ direction, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-bw-line bg-white text-bw-muted transition-colors hover:border-bw-blue hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
    >
      <svg
        className={`h-4 w-4 ${direction === 'right' ? 'rotate-180' : ''}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M12.29 5.29a1 1 0 010 1.42L8 11l4.29 4.29a1 1 0 11-1.42 1.42l-5-5a1 1 0 010-1.42l5-5a1 1 0 011.42 0z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

export default function Kalender() {
  const { session, loading } = useSession();

  const [schedules, setSchedules] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(() => ymd(today));
  const [now, setNow] = useState(() => Date.now());
  const [remind, setRemind] = useState({ id: '', status: '', message: '' });
  const [soundBusy, setSoundBusy] = useState(() => isSoundBusy());
  const [detailOpen, setDetailOpen] = useState({});
  const [cari, setCari] = useState('');
  const [filterStatus, setFilterStatus] = useState('semua');
  const [filterDivisi, setFilterDivisi] = useState('');
  const [hanyaMilikSaya, setHanyaMilikSaya] = useState(false);

  useEffect(() => subscribeSoundBusy(setSoundBusy), []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const loadSchedules = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('waktu_mulai', { ascending: true });

    if (error) {
      console.error('[Kalender] gagal memuat jadwal:', error.message);
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
  }, [session, loadSchedules]);

  const handleRemind = async (schedule) => {
    // api/notify.js menolak dengan 403 bila pengirim bukan pembuat jadwal,
    // jadi jangan kirim request kalau sudah pasti ditolak.
    if (schedule.pembuat_id !== session.user.id) {
      showToast('Hanya pembuat jadwal yang boleh mengirim pengingat.', 'error');
      return;
    }

    setRemind({ id: schedule.id, status: 'busy', message: '' });

    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission().catch(() => {});
    }

    try {
      const result = await sendRemind(schedule.id, session);
      const catatan = result.catatan ? ` ${result.catatan}` : '';
      setRemind({
        id: schedule.id,
        status: 'ok',
        message: `Pengingat terkirim ke ${result.terkirim} penerima, ${result.push} notifikasi browser.${catatan}`,
      });

      const slots = sortSlots(getSlots(schedule));
      const waktu = slots.length ? formatWaktuLengkap(slots[0].mulai) : '';

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
      console.error('[Kalender] kirim pengingat gagal:', error?.message);
      const message = error?.message ?? 'Gagal mengirim pengingat.';
      setRemind({ id: schedule.id, status: 'error', message });
      showToast(message, 'error');
    }
  };

  const handleDelete = async (schedule) => {
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
  };

  const toggleDetail = (id) => {
    setDetailOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const schedulesByDay = useMemo(() => {
    const map = new Map();
    schedules.forEach((item) => {
      sortSlots(getSlots(item)).forEach((slot) => {
        const key = ymd(new Date(slot.mulai));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push({ schedule: item, slot });
      });
    });
    return map;
  }, [schedules]);

  const monthCount = useMemo(() => {
    const prefix = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, '0')}`;
    const ids = new Set();

    schedules.forEach((item) => {
      getSlots(item).forEach((slot) => {
        if (ymd(new Date(slot.mulai)).startsWith(prefix)) ids.add(item.id);
      });
    });

    return ids.size;
  }, [schedules, view]);

  const cells = useMemo(() => buildMonthGrid(view), [view]);

  const selectedDate = useMemo(() => {
    const [year, month, day] = selected.split('-').map(Number);
    return new Date(year, month - 1, day);
  }, [selected]);

  const selectedItems = schedulesByDay.get(selected) ?? [];
  const liburSelected = getHariLibur(selected);

  const cocokFilter = (item) => {
    const slot = sortSlots(getSlots(item));

    if (filterStatus === 'aktif' && item.status !== 'Aktif') return false;
    if (
      filterStatus === 'selesai' &&
      !slot.every((row) => new Date(row.mulai).getTime() < now)
    ) {
      return false;
    }
    if (hanyaMilikSaya && item.pembuat_id !== session.user.id) return false;
    if (filterDivisi && item.pembuat_divisi !== filterDivisi) return false;

    return true;
  };

  const modeCari = Boolean(cari.trim());

  const hasilCari = useMemo(() => {
    if (!cari.trim()) return [];

    const query = cari.trim().toLowerCase();
    const rows = [];

    schedules.forEach((item) => {
      const haystack = [
        item.judul,
        item.deskripsi,
        item.kategori,
        item.target_divisi,
        item.pembuat_nama,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query)) return;
      if (filterStatus === 'aktif' && item.status !== 'Aktif') return;
      if (
        filterStatus === 'selesai' &&
        !sortSlots(getSlots(item)).every((row) => new Date(row.mulai).getTime() < now)
      ) {
        return;
      }
      if (hanyaMilikSaya && item.pembuat_id !== session.user.id) return;
      if (filterDivisi && item.pembuat_divisi !== filterDivisi) return;

      sortSlots(getSlots(item)).forEach((slot) => rows.push({ schedule: item, slot }));
    });

    return rows.sort((a, b) => new Date(a.slot.mulai) - new Date(b.slot.mulai));
  }, [cari, schedules, filterStatus, hanyaMilikSaya, filterDivisi, now, session]);

  const visibleSelectedItems = selectedItems.filter(({ schedule }) => cocokFilter(schedule));
  const rowsToRender = modeCari ? hasilCari.slice(0, BATAS_HASIL) : visibleSelectedItems;
  const filterAktif =
    modeCari || filterStatus !== 'semua' || hanyaMilikSaya || Boolean(filterDivisi);

  const resetFilter = () => {
    setCari('');
    setFilterStatus('semua');
    setHanyaMilikSaya(false);
    setFilterDivisi('');
  };

  const bukaTanggal = (iso) => {
    const date = new Date(iso);
    setView(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelected(ymd(date));
    setCari('');
  };

  const goMonth = (delta) => {
    const next = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    setView(next);

    const dayNumber = Number(selected.slice(8, 10));
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    setSelected(ymd(new Date(next.getFullYear(), next.getMonth(), Math.min(dayNumber, lastDay))));
  };

  const goToday = () => {
    setView(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(ymd(today));
  };

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

  const monthLabel = view.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
  const todayKey = ymd(today);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-bw-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <ChevronButton direction="left" onClick={() => goMonth(-1)} label="Bulan sebelumnya" />

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-display text-[15px] font-bold capitalize text-bw-ink">
              {monthLabel}
            </p>
            <p className="text-xs text-bw-muted">
              {monthCount} jadwal bulan ini
            </p>
          </div>

          <ChevronButton direction="right" onClick={() => goMonth(1)} label="Bulan berikutnya" />
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className={`pb-1 text-center text-[11px] font-bold uppercase tracking-wide ${
                day === 'Min' ? 'text-bw-red' : 'text-bw-muted'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const key = ymd(cell);
            const count = schedulesByDay.get(key)?.length ?? 0;
            const isToday = key === todayKey;
            const isSelected = key === selected;
            const libur = getHariLibur(key);
            const isMinggu = cell.getDay() === 0;

            let tone =
              'border-transparent text-bw-ink hover:border-bw-line hover:bg-bw-surface';
            if (isMinggu) {
              tone = 'border-transparent text-bw-red/80 hover:border-bw-red-100 hover:bg-bw-red-50';
            }
            if (libur) {
              tone = 'border-transparent bg-bw-red-50 font-bold text-bw-red hover:border-bw-red-100';
            }
            if (isSelected) tone = 'border-bw-blue bg-bw-blue-50 text-bw-blue-700';
            if (isToday) tone = 'border-bw-blue bg-bw-blue text-white';

            const keterangan = [cell.getDate()];
            if (libur) keterangan.push(libur.nama);
            keterangan.push(`${count} jadwal`);

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={keterangan.join(', ')}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[13px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-bw-blue/40 ${tone}`}
              >
                {cell.getDate()}
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    count === 0
                      ? 'bg-transparent'
                      : isToday
                        ? 'bg-white'
                        : 'bg-bw-red'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-bw-line pt-3 text-[11px] text-bw-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bw-red" />
            Ada jadwal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bw-blue" />
            Hari ini
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-bw-red">31</span>
            Tanggal merah
          </span>
          <button
            type="button"
            onClick={goToday}
            className="ml-auto font-bold text-bw-blue transition-colors hover:text-bw-blue-hi hover:underline"
          >
            Hari ini
          </button>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bw-muted"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="5.5" />
              <path d="M13.5 13.5 17 17" />
            </svg>
            <input
              type="search"
              value={cari}
              onChange={(event) => setCari(event.target.value)}
              placeholder="Cari judul, keterangan, atau pembuat"
              aria-label="Cari jadwal"
              className="w-full rounded-xl border border-bw-line bg-white py-2.5 pl-9 pr-9 text-sm text-bw-ink outline-none transition-colors placeholder:text-bw-muted/80 focus:border-bw-blue focus:ring-2 focus:ring-bw-blue/20"
            />
            {cari && (
              <button
                type="button"
                onClick={() => setCari('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-bw-muted transition-colors hover:bg-bw-surface hover:text-bw-ink focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
              >
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
                </svg>
              </button>
            )}
          </div>

          <select
            value={filterDivisi}
            onChange={(event) => setFilterDivisi(event.target.value)}
            aria-label="Filter divisi pembuat"
            className="h-[42px] shrink-0 rounded-xl border border-bw-line bg-white px-2.5 text-xs font-semibold text-bw-ink outline-none transition-colors focus:border-bw-blue focus:ring-2 focus:ring-bw-blue/20"
          >
            {DIVISI_FILTER_OPTIONS.map((option) => (
              <option key={option.value || 'semua'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="-mx-4 mt-2.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
          <div className="flex w-max gap-2">
            {FILTER_STATUS.map((option) => {
              const active = filterStatus === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilterStatus(option.value)}
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

            <span aria-hidden="true" className="my-1 w-px shrink-0 bg-bw-line" />

            <button
              type="button"
              onClick={() => setHanyaMilikSaya((prev) => !prev)}
              aria-pressed={hanyaMilikSaya}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-bw-blue/40 ${
                hanyaMilikSaya
                  ? 'border-bw-blue bg-bw-blue text-white shadow-sm'
                  : 'border-bw-line bg-white text-bw-muted hover:border-bw-blue-200 hover:text-bw-blue'
              }`}
            >
              Jadwal saya
            </button>

            {filterAktif && (
              <button
                type="button"
                onClick={resetFilter}
                className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold text-bw-red transition-colors hover:bg-bw-red-50 focus:outline-none focus:ring-2 focus:ring-bw-red/40"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[13px] font-bold capitalize text-bw-ink">
            {modeCari ? `Hasil pencarian "${cari.trim()}"` : formatTanggalPanjang(selectedDate)}
          </h2>
          <span className="shrink-0 text-xs text-bw-muted">
            {modeCari
              ? `${hasilCari.length} cocok`
              : `${visibleSelectedItems.length} jadwal`}
          </span>
        </div>

        {liburSelected && (
          <div
            role="status"
            className={`mb-3 flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs leading-relaxed ${
              liburSelected.jenis === 'cuti'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-bw-red-100 bg-bw-red-50 text-bw-red'
            }`}
          >
            <svg
              className="mt-px h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
              <path d="M3 8.5h14M7 3v3M13 3v3" />
            </svg>
            <span>
              <strong className="font-bold">{liburSelected.nama}</strong>
              {' - '}
              {labelJenis(liburSelected.jenis)} di Indonesia
            </span>
          </div>
        )}

        {listError && (
          <div
            role="alert"
            className="rounded-2xl border border-bw-red-100 bg-bw-red-50 px-4 py-3 text-xs leading-relaxed text-bw-red"
          >
            {listError}
          </div>
        )}

        {listLoading && (
          <p className="py-8 text-center text-sm text-bw-muted">Memuat jadwal...</p>
        )}

        {!listLoading && !listError && rowsToRender.length === 0 && modeCari && (
          <div className="rounded-2xl border border-dashed border-bw-line bg-white px-5 py-8 text-center">
            <p className="text-sm font-semibold text-bw-ink">Tidak ada hasil</p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Tidak ada jadwal yang cocok dengan pencarian atau filter aktif.
            </p>
            <button
              type="button"
              onClick={resetFilter}
              className="mt-3 text-xs font-bold text-bw-blue underline underline-offset-2 hover:text-bw-blue-hi"
            >
              Reset pencarian dan filter
            </button>
          </div>
        )}

        {!listLoading && !listError && rowsToRender.length === 0 && !modeCari && (
          <div className="rounded-2xl border border-dashed border-bw-line bg-white px-5 py-8 text-center">
            <p className="text-sm font-semibold text-bw-ink">
              {selectedItems.length === 0 ? 'Tidak ada jadwal' : 'Tidak ada yang cocok'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              {selectedItems.length === 0
                ? 'Belum ada jadwal pada tanggal ini.'
                : 'Ada jadwal pada tanggal ini, tapi tersaring oleh filter aktif.'}
            </p>
            {selectedItems.length > 0 && (
              <button
                type="button"
                onClick={resetFilter}
                className="mt-3 text-xs font-bold text-bw-blue underline underline-offset-2 hover:text-bw-blue-hi"
              >
                Reset filter
              </button>
            )}
          </div>
        )}

        {!listLoading && rowsToRender.length > 0 && (
          <ul className="space-y-2.5">
            {rowsToRender.map(({ schedule: item, slot }) => {
              const style = KATEGORI_STYLE[item.kategori] ?? KATEGORI_STYLE['Lainnya'];
              const accent = KATEGORI_ACCENT[item.kategori] ?? KATEGORI_ACCENT['Lainnya'];
              const sudahLewat = new Date(slot.mulai).getTime() < now;
              const slots = sortSlots(getSlots(item));
              const totalSlots = slots.length;
              const isOwner = item.pembuat_id === session.user.id;
              const isOpen = Boolean(detailOpen[item.id]);
              const reminded = remind.id === item.id;
              const sending = reminded && remind.status === 'busy';
              const agenda = resolveAgenda(slots, now);
              const sisa =
                item.status !== 'Aktif'
                  ? item.status
                  : agenda.state === 'done'
                    ? 'Selesai'
                    : agenda.state === 'ongoing'
                      ? 'Sedang berlangsung'
                      : formatSisa(agenda.nextStart, now);

              return (
                <li
                  key={`${item.id}-${slot.mulai}`}
                  className={`relative overflow-hidden rounded-2xl border border-bw-line bg-white p-3.5 pl-5 shadow-card transition-all duration-200 hover:shadow-lift ${
                    sudahLewat ? 'opacity-70' : ''
                  }`}
                >
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${accent}`} />

                  <div className="flex items-start gap-3">
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-bw-blue-50 py-1.5">
                      <span className="font-display text-[13px] font-bold leading-none text-bw-blue-700">
                        {formatJam(slot.mulai)}
                      </span>
                      {slot.selesai && (
                        <span className="mt-1 text-[10px] leading-none text-bw-muted">
                          {formatJam(slot.selesai)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${style}`}
                        >
                          {item.kategori}
                        </span>
                        <span className="rounded-full bg-bw-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bw-blue-700 ring-1 ring-bw-blue-200">
                          {item.target_divisi
                            ? `Khusus ${
                                DIVISI_SHORT[item.target_divisi] ?? item.target_divisi
                              }`
                            : 'Semua staf'}
                        </span>
                        {totalSlots > 1 && (
                          <span className="rounded-full bg-bw-surface px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bw-muted ring-1 ring-bw-line">
                            {totalSlots} sesi
                          </span>
                        )}
                        {item.status !== 'Aktif' && (
                          <span className="rounded-full bg-bw-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-bw-red ring-1 ring-bw-red-100">
                            {item.status}
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-[14px] font-bold leading-snug text-bw-ink">
                        {item.judul}
                      </p>

                      <p
                        className={`mt-0.5 text-xs font-semibold ${
                          sudahLewat ? 'text-bw-muted' : 'text-bw-blue'
                        }`}
                      >
                        {sisa}
                      </p>

                      {modeCari && (
                        <button
                          type="button"
                          onClick={() => bukaTanggal(slot.mulai)}
                          className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-bw-surface px-2 py-0.5 text-[11px] font-semibold text-bw-muted transition-colors hover:bg-bw-blue-50 hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                        >
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            aria-hidden="true"
                          >
                            <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
                            <path d="M3 8.5h14M7 3v3M13 3v3" />
                          </svg>
                          {formatTanggalPendek(slot.mulai)}
                        </button>
                      )}

                      {!isOpen && item.deskripsi && (
                        <p className="mt-1 line-clamp-2 whitespace-pre-line break-words text-xs leading-relaxed text-bw-muted">
                          {item.deskripsi}
                        </p>
                      )}

                      {isOpen && (
                        <div className="mt-2 space-y-2 rounded-xl bg-bw-surface p-3">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-bw-muted">
                              Waktu
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-bw-ink">
                              {formatWaktuLengkap(slot.mulai)}
                              {slot.selesai && ` - ${formatJam(slot.selesai)}`}
                            </p>
                          </div>

                          {totalSlots > 1 && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-bw-muted">
                                Seluruh sesi
                              </p>
                              <ul className="mt-1 space-y-1">
                                {slots.map((row) => (
                                  <li
                                    key={row.mulai}
                                    className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs"
                                  >
                                    <span
                                      className={`font-semibold ${
                                        row.mulai === slot.mulai
                                          ? 'text-bw-blue'
                                          : 'text-bw-ink'
                                      }`}
                                    >
                                      {formatJam(row.mulai)}
                                      {row.selesai && ` - ${formatJam(row.selesai)}`}
                                    </span>
                                    <span className="text-bw-muted">
                                      {formatTanggalPendek(row.mulai)}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {item.deskripsi && (
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-bw-muted">
                                Keterangan
                              </p>
                              <p className="mt-0.5 whitespace-pre-line break-words text-xs leading-relaxed text-bw-ink">
                                {item.deskripsi}
                              </p>
                            </div>
                          )}

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-bw-muted">
                              Dibuat oleh
                            </p>
                            <p className="mt-0.5 text-xs text-bw-ink">
                              {item.pembuat_nama} -{' '}
                              {DIVISI_SHORT[item.pembuat_divisi] ?? item.pembuat_divisi}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-bw-muted">
                              Ditujukan untuk
                            </p>
                            <p className="mt-0.5 text-xs text-bw-ink">
                              {item.target_divisi
                                ? `Divisi ${item.target_divisi}`
                                : 'Semua staf'}
                            </p>
                          </div>
                        </div>
                      )}

                      {reminded && remind.message && (
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
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-bw-line pt-2.5">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={() => handleRemind(item)}
                        disabled={soundBusy || sending}
                        className="rounded-lg bg-bw-blue px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted disabled:shadow-none"
                      >
                        {sending ? 'Mengirim...' : 'Ingatkan'}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-bw-surface px-2.5 py-1 text-[11px] font-semibold text-bw-muted">
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="4.5" y="8.5" width="11" height="7" rx="2" />
                          <path d="M7 8.5V6.8A3 3 0 0110 4h0a3 3 0 013 2.8v1.7" />
                        </svg>
                        Pengingat oleh {item.pembuat_nama}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleDetail(item.id)}
                      aria-expanded={isOpen}
                      className="rounded-lg border border-bw-line bg-white px-3 py-1.5 text-xs font-bold text-bw-muted transition-colors hover:border-bw-blue-200 hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                    >
                      {isOpen ? 'Sembunyikan' : 'Detail'}
                    </button>

                    {isOwner && (
                      <>
                        <Link
                          to={`/jadwal/${item.id}/edit`}
                          className="rounded-lg border border-bw-line bg-white px-3 py-1.5 text-xs font-bold text-bw-muted transition-colors hover:border-bw-blue-200 hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          className="rounded-lg border border-bw-red-100 bg-white px-3 py-1.5 text-xs font-bold text-bw-red transition-colors hover:border-bw-red hover:bg-bw-red-50 focus:outline-none focus:ring-2 focus:ring-bw-red/40"
                        >
                          Hapus
                        </button>
                      </>
                    )}

                    <AddToCalendar schedule={item} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {modeCari && hasilCari.length > rowsToRender.length && (
          <p className="mt-3 text-center text-xs text-bw-muted">
            Menampilkan {rowsToRender.length} dari {hasilCari.length} hasil. Persempit pencarian
            untuk melihat sisanya.
          </p>
        )}
      </section>
    </div>
  );
}
