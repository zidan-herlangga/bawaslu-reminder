import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import useSession from '../hooks/useSession';
import { getSlots, sortSlots } from '../lib/slots';
import { DIVISI_SHORT } from '../constants/options';

const WEEKDAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const KATEGORI_STYLE = {
  Rapat: 'bg-bw-blue-50 text-bw-blue-700 ring-bw-blue-200',
  Tugas: 'bg-amber-50 text-amber-700 ring-amber-200',
  Pengawasan: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Lainnya: 'bg-bw-surface text-bw-muted ring-bw-line',
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
    <div className="space-y-4">
      <section className="rounded-xl border border-bw-line bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <ChevronButton direction="left" onClick={() => goMonth(-1)} label="Bulan sebelumnya" />

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[15px] font-bold capitalize text-bw-ink">
              {monthLabel}
            </p>
            <p className="text-[11px] text-bw-muted">
              {monthCount} jadwal bulan ini
            </p>
          </div>

          <ChevronButton direction="right" onClick={() => goMonth(1)} label="Bulan berikutnya" />
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-bw-muted"
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

            let tone =
              'border-transparent text-bw-ink hover:border-bw-line hover:bg-bw-surface';
            if (isSelected) tone = 'border-bw-blue bg-bw-blue-50 text-bw-blue-700';
            if (isToday) tone = 'border-bw-blue bg-bw-blue text-white';

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${cell.getDate()}, ${count} jadwal`}
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

        <div className="mt-3 flex items-center gap-3 border-t border-bw-line pt-3 text-[10px] text-bw-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bw-red" />
            Ada jadwal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-bw-blue" />
            Hari ini
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
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-[13px] font-bold capitalize text-bw-ink">
            {formatTanggalPanjang(selectedDate)}
          </h2>
          <span className="shrink-0 text-[11px] text-bw-muted">
            {selectedItems.length} jadwal
          </span>
        </div>

        {listError && (
          <div
            role="alert"
            className="rounded-xl border border-bw-red-100 bg-bw-red-50 px-4 py-3 text-xs leading-relaxed text-bw-red"
          >
            {listError}
          </div>
        )}

        {listLoading && (
          <p className="py-8 text-center text-sm text-bw-muted">Memuat jadwal...</p>
        )}

        {!listLoading && !listError && selectedItems.length === 0 && (
          <div className="rounded-xl border border-dashed border-bw-line bg-white px-5 py-8 text-center">
            <p className="text-sm font-semibold text-bw-ink">Tidak ada jadwal</p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Belum ada jadwal pada tanggal ini.
            </p>
          </div>
        )}

        {!listLoading && selectedItems.length > 0 && (
          <ul className="space-y-2.5">
            {selectedItems.map(({ schedule: item, slot }) => {
              const style = KATEGORI_STYLE[item.kategori] ?? KATEGORI_STYLE['Lainnya'];
              const sudahLewat = new Date(slot.mulai).getTime() < Date.now();
              const totalSlots = getSlots(item).length;

              return (
                <li
                  key={`${item.id}-${slot.mulai}`}
                  className={`rounded-xl border border-bw-line bg-white p-3.5 shadow-sm ${
                    sudahLewat ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-bw-blue-50 py-1.5">
                      <span className="text-[13px] font-bold leading-none text-bw-blue-700">
                        {formatJam(slot.mulai)}
                      </span>
                      {slot.selesai && (
                        <span className="mt-1 text-[9px] leading-none text-bw-muted">
                          {formatJam(slot.selesai)}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${style}`}
                        >
                          {item.kategori}
                        </span>
                        {totalSlots > 1 && (
                          <span className="rounded-full bg-bw-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bw-muted ring-1 ring-bw-line">
                            {totalSlots} sesi
                          </span>
                        )}
                        {item.status !== 'Aktif' && (
                          <span className="rounded-full bg-bw-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bw-red ring-1 ring-bw-red-100">
                            {item.status}
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-[14px] font-bold leading-snug text-bw-ink">
                        {item.judul}
                      </p>

                      {item.deskripsi && (
                        <p className="mt-1 whitespace-pre-line break-words text-xs leading-relaxed text-bw-muted">
                          {item.deskripsi}
                        </p>
                      )}

                      <p className="mt-2 border-t border-bw-line pt-1.5 text-[10px] text-bw-muted">
                        {item.pembuat_nama} -{' '}
                        {DIVISI_SHORT[item.pembuat_divisi] ?? item.pembuat_divisi}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
