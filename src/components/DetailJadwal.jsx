import { useEffect, useRef } from 'react';
import { DIVISI_SHORT } from '../constants/options';
import { formatJam, formatTanggalPendek, formatWaktuLengkap } from '../lib/formatWaktu';
import { getSlots, sesiSelesai, sortSlots } from '../lib/slots';
import AddToCalendar from './AddToCalendar';

// Modal detail jadwal.
//
// Sebelumnya rincian tampil sebagai kartu yang melebar di Kalender, dan di
// Dashboard tidak ada sama sekali: judul, waktu, dan keterangan harus dibaca dari
// kartu yang sama dengan tombolnya. Isinya jadi sulit dipindai, terutama di
// layar sempit. Sekarang detail punya tempat sendiri yang bisa dibaca tanpa
// menekan apa pun.
//
// Sifat penting:
// - Escape, klik di luar, dan tombol Tutup semuanya menutup
// - Fokus dikurung di dalam modal selama terbuka
// - Gulir halaman di belakang dikunci
// - Sesi yang dibuka ditandai, kalau yang diklik bukan sesi pertama
// - Semua tombol minimal 44px untuk jari

const KATEGORI_STYLE = {
  Rapat: 'bg-bw-blue-50 text-bw-blue-700 ring-bw-blue-200',
  Tugas: 'bg-bw-amber-50 text-bw-amber ring-bw-amber-200',
  Pengawasan: 'bg-bw-green-50 text-bw-green-700 ring-bw-green-200',
  Lainnya: 'bg-bw-surface text-bw-muted ring-bw-line',
};

const TOMBOL = 'inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40';

function Label({ children }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-bw-muted">
      {children}
    </p>
  );
}

function Blok({ label, children }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 text-sm leading-relaxed text-bw-ink">{children}</div>
    </div>
  );
}

export default function DetailJadwal({
  open,
  jadwal,
  sesi,
  now,
  userId,
  onTutup,
  onIngatkan,
  onUbah,
  onHapus,
  kirimBusy = false,
  kirimLabel = 'Ingatkan',
  pesanKirim = '',
  onBukaTanggal,
}) {
  const dialogRef = useRef(null);
  const tutupRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Fokus ke tombol Tutup: modal ini baca, tidak ada tombol yang
    // berbahaya, jadi tidak perlu fokus ke aksi apa pun.
    tutupRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onTutup();
        return;
      }

      if (event.key !== 'Tab') return;

      const bisaFokus = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!bisaFokus?.length) return;

      const pertama = bisaFokus[0];
      const terakhir = bisaFokus[bisaFokus.length - 1];

      if (event.shiftKey && document.activeElement === pertama) {
        event.preventDefault();
        terakhir.focus();
      } else if (!event.shiftKey && document.activeElement === terakhir) {
        event.preventDefault();
        pertama.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onTutup]);

  useEffect(() => {
    if (!open) return undefined;

    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowLama;
    };
  }, [open]);

  if (!open || !jadwal) return null;

  const slots = sortSlots(getSlots(jadwal));
  const sesiTampil = sesi ?? slots[0] ?? null;
  const pemilik = jadwal.pembuat_id === userId;
  const lewat = sesiTampil ? sesiSelesai(sesiTampil, now) : false;
  const gayaKategori = KATEGORI_STYLE[jadwal.kategori] ?? KATEGORI_STYLE.Lainnya;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bw-ink/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onTutup();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-judul"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-bw-line bg-bw-card shadow-lift sm:rounded-3xl"
      >
        <header className="flex items-start gap-3 border-b border-bw-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${gayaKategori}`}
              >
                {jadwal.kategori}
              </span>
              {lewat ? (
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
                jadwal.status !== 'Aktif' && (
                  <span className="rounded-full bg-bw-surface px-2.5 py-1 text-xs font-bold text-bw-muted">
                    {jadwal.status}
                  </span>
                )
              )}
            </div>
            <h2
              id="detail-judul"
              className="mt-2 font-display text-lg font-bold leading-snug text-bw-ink"
            >
              {jadwal.judul}
            </h2>
          </div>

          <button
            ref={tutupRef}
            type="button"
            onClick={onTutup}
            aria-label="Tutup detail jadwal"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-bw-muted transition-colors hover:bg-bw-surface hover:text-bw-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {sesiTampil && (
            <Blok label="Waktu">
              <p className="font-semibold">
                {formatWaktuLengkap(sesiTampil.mulai)}
              </p>
              {sesiTampil.selesai && (
                <p className="mt-0.5 text-bw-muted">
                  sampai {formatJam(sesiTampil.selesai)}
                </p>
              )}
              {!sesiTampil.selesai && (
                <p className="mt-0.5 text-bw-muted">
                  tanpa waktu selesai
                </p>
              )}
            </Blok>
          )}

          {slots.length > 1 && (
            <Blok label={`Seluruh sesi (${slots.length})`}>
              <ul className="space-y-1.5">
                {slots.map((row) => {
                  const dipilih = sesiTampil && row.mulai === sesiTampil.mulai;
                  return (
                    <li key={row.mulai}>
                      <button
                        type="button"
                        onClick={() => onBukaTanggal?.(row.mulai)}
                        aria-current={dipilih ? 'true' : undefined}
                        className={`flex w-full items-baseline justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40 ${
                          dipilih
                            ? 'border-bw-blue-200 bg-bw-blue-50'
                            : 'border-bw-line bg-bw-surface hover:border-bw-blue-200'
                        }`}
                      >
                        <span className="font-semibold text-bw-ink">
                          {formatJam(row.mulai)}
                          {row.selesai && ` - ${formatJam(row.selesai)}`}
                        </span>
                        <span className="text-xs text-bw-muted">
                          {formatTanggalPendek(row.mulai)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Blok>
          )}

          {jadwal.deskripsi ? (
            <Blok label="Keterangan">
              <p className="whitespace-pre-line break-words">{jadwal.deskripsi}</p>
            </Blok>
          ) : (
            <Blok label="Keterangan">
              <p className="text-bw-muted">Tidak ada keterangan.</p>
            </Blok>
          )}

          <Blok label="Dibuat oleh">
            {jadwal.pembuat_nama} -{' '}
            {DIVISI_SHORT[jadwal.pembuat_divisi] ?? jadwal.pembuat_divisi}
          </Blok>

          <Blok label="Ditujukan untuk">
            {jadwal.target_divisi
              ? `Divisi ${DIVISI_SHORT[jadwal.target_divisi] ?? jadwal.target_divisi}`
              : 'Semua staf'}
          </Blok>

          {pesanKirim && (
            <p
              role="status"
              className="rounded-xl bg-bw-surface px-3 py-2.5 text-xs leading-relaxed text-bw-ink"
            >
              {pesanKirim}
            </p>
          )}
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-bw-line bg-bw-surface/70 px-5 py-3">
          {pemilik && onIngatkan && (
            <button
              type="button"
              onClick={onIngatkan}
              disabled={kirimBusy}
              className={`${TOMBOL} bg-bw-blue text-white shadow-sm hover:bg-bw-blue-hi disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted disabled:shadow-none`}
            >
              {kirimLabel}
            </button>
          )}

          <AddToCalendar schedule={jadwal} />

          {pemilik && onUbah && (
            <button type="button" onClick={onUbah} className={`${TOMBOL} border border-bw-line bg-bw-card text-bw-ink hover:bg-bw-surface`}>
              Ubah
            </button>
          )}

          {pemilik && onHapus && (
            <button
              type="button"
              onClick={onHapus}
              className={`${TOMBOL} border border-bw-red-100 bg-bw-red-50 text-bw-red hover:bg-bw-red-100`}
            >
              Hapus
            </button>
          )}

          <button
            type="button"
            onClick={onTutup}
            className={`${TOMBOL} ml-auto border border-bw-line bg-bw-card text-bw-muted hover:bg-bw-surface`}
          >
            Tutup
          </button>
        </footer>
      </div>
    </div>
  );
}
