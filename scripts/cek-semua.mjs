// Menjalankan pemeriksa identifier atas seluruh komponen dan pustaka.
//
// Dipisah dari test-detail-ssr.mjs supaya laporan yang muncul hanya berisi
// masalah, bukan angka-angka dari test lain.
import { periksaFile } from './cek-identifier.mjs';

const file = [
  'src/components/AddToCalendar.jsx',
  'src/components/Akun.jsx',
  'src/components/AppShell.jsx',
  'src/components/ClockWidget.jsx',
  'src/components/ConfirmDialog.jsx',
  'src/components/Dashboard.jsx',
  'src/components/DetailJadwal.jsx',
  'src/components/Kalender.jsx',
  'src/components/ScheduleForm.jsx',
  'src/components/TodoPage.jsx',
  'src/lib/formatWaktu.js',
  'src/lib/push.js',
  'src/lib/slots.js',
  'src/lib/sound.js',
];

const masalah = [];
for (const f of file) {
  for (const m of periksaFile(f)) masalah.push(`${f}: ${m.nama} (${m.konteks})`);
}

if (masalah.length === 0) {
  console.log(`identifier: ${file.length} berkas bersih`);
} else {
  for (const m of masalah) console.log(`  [FAIL] ${m}`);
  console.log(`\nHASIL: ${masalah.length} identifier tidak dikenal`);
  process.exit(1);
}
