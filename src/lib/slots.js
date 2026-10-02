export function getSlots(schedule) {
  const raw = schedule?.slots;

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((slot) => slot && slot.mulai);
  }

  if (schedule?.waktu_mulai) {
    return [
      {
        mulai: schedule.waktu_mulai,
        selesai: schedule.waktu_selesai ?? null,
      },
    ];
  }

  return [];
}

export function slotDayKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sortSlots(slots) {
  return [...slots].sort(
    (a, b) => new Date(a.mulai).getTime() - new Date(b.mulai).getTime()
  );
}

export function resolveAgenda(slots, now = Date.now()) {
  const items = sortSlots(slots)
    .map((slot) => ({
      start: new Date(slot.mulai).getTime(),
      end: slot.selesai ? new Date(slot.selesai).getTime() : null,
    }))
    .filter((item) => !Number.isNaN(item.start));

  const ongoing = items.find(
    (item) => item.start <= now && (item.end === null || item.end >= now)
  );
  if (ongoing) return { state: 'ongoing', nextStart: null };

  const upcoming = items.find((item) => item.start > now);
  if (upcoming) return { state: 'upcoming', nextStart: upcoming.start };

  return { state: 'done', nextStart: null };
}

// Urutan tampil daftar jadwal: yang sedang berlangsung dulu, lalu yang akan
// datang, baru yang sudah lewat. Tanpa ini, query yang mengurutkan dari
// waktu_mulai paling awal membuat jadwal lama memenuhi layar paling atas,
// padahal yang perlu dipantau justru yang akan datang.
export const URUTAN_AGENDA = { ongoing: 0, upcoming: 1, done: 2 };

/**
 * Apakah satu sesi sudah lewat waktunya.
 *
 * `resolveAgenda` tidak bisa dipakai untuk ini karena sesi tanpa waktu selesai
 * dianggap "sedang berlangsung" tanpa batas: begitu mulai lewat, sesinya
 * menggantung selamanya di bagian atas daftar. Aturannya dibuat eksplisit di
 * sini: sesi dianggap selesai begitu waktu mulinya lewat, baik itu sudah
 * punya waktu selesai yang juga lewat atau tidak punya waktu selesai sama
 * sekali.
 */
export function sesiSelesai(slot, now = Date.now()) {
  const mulai = new Date(slot?.mulai).getTime();
  if (Number.isNaN(mulai) || mulai > now) return false;

  if (!slot?.selesai) return true;

  const selesai = new Date(slot.selesai).getTime();
  if (Number.isNaN(selesai)) return true;

  return selesai <= now;
}

/** Semua sesi pada sebuah jadwal sudah lewat waktunya. */
export function jadwalSelesai(schedule, now = Date.now()) {
  const slots = getSlots(schedule);
  if (slots.length === 0) return false;
  return slots.every((slot) => sesiSelesai(slot, now));
}

/** Kelompok urutan: sedang berlangsung, akan datang, atau sudah lewat. */
export function kelasAgenda(schedule, now = Date.now()) {
  const slots = sortSlots(getSlots(schedule));
  if (slots.length === 0) return 'done';
  if (slots.every((slot) => sesiSelesai(slot, now))) return 'done';

  const sedangBerlangsung = slots.some(
    (slot) => new Date(slot.mulai).getTime() <= now
  );

  return sedangBerlangsung ? 'ongoing' : 'upcoming';
}

/**
 * Ringkasan satu jadwal untuk pengurutan. `resolveAgenda` sengaja tidak
 * disentuh supaya perhitungan pengingat yang sudah berjalan tidak ikut berubah.
 */
export function agendaOf(schedule, now = Date.now()) {
  const slots = sortSlots(getSlots(schedule));
  const mulai = slots.length
    ? new Date(slots[0].mulai).getTime()
    : Number.POSITIVE_INFINITY;

  const akhir = slots.reduce((terbesar, slot) => {
    if (!slot.selesai) return terbesar;
    const nilai = new Date(slot.selesai).getTime();
    if (Number.isNaN(nilai)) return terbesar;
    return Math.max(terbesar, nilai);
  }, Number.NEGATIVE_INFINITY);

  return {
    state: kelasAgenda(schedule, now),
    mulai,
    // Jadwal tanpa waktu selesai memakai waktu mulai sebagai patokan akhir,
    // supaya tetap punya nilai urut.
    akhir: akhir === Number.NEGATIVE_INFINITY ? mulai : akhir,
  };
}

/**
 * Mengurutkan jadwal tanpa mengubah isi aslinya: yang sedang berlangsung
 * dulu, lalu yang akan datang, lalu yang sudah lewat di paling bawah.
 */
export function sortByAgenda(schedules, now = Date.now()) {
  return [...schedules]
    .map((schedule) => ({ schedule, info: agendaOf(schedule, now) }))
    .sort((a, b) => {
      if (a.info.state !== b.info.state) {
        return URUTAN_AGENDA[a.info.state] - URUTAN_AGENDA[b.info.state];
      }

      // Yang sudah lewat: yang baru saja berakhir dianggap lebih berguna,
      // jadi yang terakhir diurutkan paling depan di bagian bawah.
      if (a.info.state === 'done') return b.info.akhir - a.info.akhir;

      const waktu = (info) => info.mulai;
      return waktu(a.info) - waktu(b.info);
    })
    .map((item) => item.schedule);
}
