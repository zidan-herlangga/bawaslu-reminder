import { useEffect, useRef } from 'react';

// Dialog konfirmasi yang mengikuti tema aplikasi.
//
// Sebelumnya pemanggilan hapus memakai window.confirm. Dialog bawaan browser
// tidak bisa mengikuti tema gelap, terlihat asing di antara kartu yang sudah
// rapi, dan tombolnya terlalu kecil untuk ditekuk di layar sentuh.
//
// Sifat penting:
// - Fokus langsung ke tombol paling aman (Batal), supaya tidak salah tekan
// - Escape dan klik di luar menutup dialog
// - Fokus dikurung di dalam dialog selama terbuka
// - Semua tombol punya tinggi minimal 44px untuk jari

const TOMBOL_BATAL = 'h-11 rounded-xl border border-bw-line bg-bw-card px-4 text-sm font-semibold text-bw-ink transition-colors hover:bg-bw-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40';

export default function ConfirmDialog({
  open,
  judul,
  pesan,
  labelBatal = 'Batal',
  labelSetuju = 'Hapus',
  sibuk = false,
  onBatal,
  onSetuju,
}) {
  const dialogRef = useRef(null);
  const batalRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    // Fokus ke Batal, bukan ke tombol destruktif. Salah tekan di dialog hapus
    // jauh lebih merusak daripada satu klik tambahan.
    batalRef.current?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onBatal();
        return;
      }

      if (event.key !== 'Tab') return;

      // Kurung fokus di dalam dialog.
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
  }, [open, onBatal]);

  useEffect(() => {
    if (!open) return undefined;

    const overflowLama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflowLama;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bw-ink/45 p-4 backdrop-blur-[2px] sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onBatal();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="konfirmasi-judul"
        aria-describedby="konfirmasi-pesan"
        className="w-full max-w-sm rounded-3xl border border-bw-line bg-bw-card p-5 shadow-lift"
      >
        <div className="flex items-start gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bw-red-50 text-bw-red"
            aria-hidden="true"
          >
            <svg
              className="h-[18px] w-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4.5m0 3.5h.01M10.3 4.3 2.9 17.1A1.9 1.9 0 0 0 4.6 20h14.8a1.9 1.9 0 0 0 1.7-2.9L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="konfirmasi-judul"
              className="font-display text-base font-bold leading-snug text-bw-ink"
            >
              {judul}
            </h2>
            <p id="konfirmasi-pesan" className="mt-1 text-sm leading-relaxed text-bw-muted">
              {pesan}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            ref={batalRef}
            type="button"
            onClick={onBatal}
            className={TOMBOL_BATAL}
          >
            {labelBatal}
          </button>
          <button
            type="button"
            onClick={onSetuju}
            disabled={sibuk}
            className="h-11 rounded-xl bg-bw-red-solid px-4 text-sm font-bold text-white shadow-sm transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-red/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sibuk ? 'Memproses...' : labelSetuju}
          </button>
        </div>
      </div>
    </div>
  );
}
