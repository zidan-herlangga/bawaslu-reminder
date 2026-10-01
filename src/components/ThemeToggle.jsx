import { useEffect, useState } from 'react';
import { getTema, setTema, subscribeTema, TEMA } from '../lib/theme';

function IconSun({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"
      />
    </svg>
  );
}

function IconMoon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 14.15A8.25 8.25 0 0 1 9.85 3.75a8.25 8.25 0 1 0 10.4 10.4Z"
      />
    </svg>
  );
}

function IconAuto({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="2.75" y="4.25" width="18.5" height="12.5" rx="2" />
      <path strokeLinecap="round" d="M8 20.25h8" />
    </svg>
  );
}

// Urutan siklus: Sistem -> Terang -> Gelap -> Sistem. Dimulai dari Sistem
// supaya pengguna baru mendapat perilaku yang mengikuti perangkat, dan baru
// pindah ke pilihan manual setelah satu ketukan.
const URUTAN = [TEMA.SISTEM, TEMA.TERANG, TEMA.GELAP];

const OPSI = {
  [TEMA.TERANG]: { label: 'Terang', Icon: IconSun },
  [TEMA.GELAP]: { label: 'Gelap', Icon: IconMoon },
  [TEMA.SISTEM]: { label: 'Ikuti sistem', Icon: IconAuto },
};

// Satu tombol, bukan segmented control tiga opsi. Segmented control memakan
// sekitar 92px di header yang hanya punya 360px, sehingga judul terpotong.
// Satu tombol memakai 36px seperti tombol lain, jadi muat tanpa mengorbankan
// ruang judul. Ikon yang tampil selalu menunjukkan mode yang sedang aktif,
// sehingga statusnya tetap terbaca sekilas tanpa harus ditekan dulu.
export default function ThemeToggle({ className = '' }) {
  const [pilihan, setPilihan] = useState(() => getTema());

  useEffect(() => subscribeTema((next) => setPilihan(next)), []);

  const { label, Icon } = OPSI[pilihan] ?? OPSI[TEMA.SISTEM];
  const berikutnya = URUTAN[(URUTAN.indexOf(pilihan) + 1) % URUTAN.length];
  const labelBerikutnya = OPSI[berikutnya].label;

  return (
    <button
      type="button"
      onClick={() => setTema(berikutnya)}
      title={`Tema: ${label}`}
      aria-label={`Tema ${label}. Ketuk untuk ${labelBerikutnya}.`}
      className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-transparent bg-transparent text-bw-muted transition-colors hover:bg-bw-blue-50 hover:text-bw-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-bw-blue/40 ${className}`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}