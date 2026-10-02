// Pemformatan tanggal dan jam dalam bahasa Indonesia.
//
// Helper ini tadinya ditulis terpisah di Dashboard dan Kalender, dan akan
// ditulis lagi untuk modal detail. Keduanya hampir sama, hanya Dashboard yang
// memeriksa tanggal tidak valid. Dipisah ke satu modul supaya formatnya
// tidak pernah berbeda antar halaman: jam 09:05 harus tampil sama di mana pun.

function amanTanggal(nilai) {
  const date = new Date(nilai);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatJam(iso) {
  const date = amanTanggal(iso);
  if (!date) return '';
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function formatTanggalPanjang(nilai) {
  const date = amanTanggal(nilai);
  if (!date) return '';
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatWaktuLengkap(iso) {
  const date = amanTanggal(iso);
  if (!date) return '';
  return date.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTanggalPendek(iso) {
  const date = amanTanggal(iso);
  if (!date) return '';
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** "2 hari lagi", "3 jam 5 menit lagi", atau "Sudah dimulai". */
export function formatSisa(targetMs, now) {
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
