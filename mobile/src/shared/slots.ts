// Logika jadwal yang dipakai bersama dengan aplikasi web.
//
// Port dari src/lib/slots.js. Perbedaannya hanya tipe: di sini bentuk datanya
// dinyatakan eksplisit supaya salah nama kolom ketahuan saat typecheck, bukan
// saat pengguna mengetuk layar.
//
// Yang sengaja TIDAK ikut: resolveAgenda. Fungsi itu masih dipakai web untuk
// menghitung pengingat, dan bentuk "sedang berlangsung tanpa batas"-nya sudah
// ditangani oleh sesiSelesai di bawah.

export interface Slot {
  mulai: string;
  selesai: string | null;
}

export type StatusJadwal = 'Aktif' | 'Selesai' | 'Dibatalkan';

export interface Jadwal {
  id: string;
  judul: string;
  deskripsi: string;
  kategori: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  slots: Slot[] | null;
  status: StatusJadwal;
  pembuat_id: string;
  pembuat_nama: string;
  pembuat_divisi: string;
  target_divisi: string | null;
}

export type StatusAgenda = 'ongoing' | 'upcoming' | 'done';

export interface Agenda {
  state: StatusAgenda;
  nextStart: number | null;
}

export interface RingkasanAgenda extends Agenda {
  mulai: number;
  akhir: number;
}

/** Urutan tampil: sedang berlangsung, akan datang, lalu sudah lewat. */
export const URUTAN_AGENDA: Record<StatusAgenda, number> = {
  ongoing: 0,
  upcoming: 1,
  done: 2,
};

export function getSlots(schedule: Partial<Jadwal> | null | undefined): Slot[] {
  const raw = schedule?.slots;

  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((slot): slot is Slot => Boolean(slot?.mulai));
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

export function slotDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sortSlots(slots: readonly Slot[]): Slot[] {
  return [...slots].sort(
    (a, b) => new Date(a.mulai).getTime() - new Date(b.mulai).getTime()
  );
}

/**
 * Status agenda versi lama: sesi tanpa waktu selesai dianggap sedang
 * berlangsung tanpa batas. Dipakai web, jadi tidak diubah di sini.
 */
export function resolveAgenda(
  slots: readonly Slot[],
  now: number = Date.now()
): Agenda {
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

/**
 * Apakah satu sesi sudah lewat waktunya.
 *
 * resolveAgenda tidak bisa dipakai untuk ini karena sesi tanpa waktu selesai
 * dianggap sedang berlangsung tanpa batas: begitu mulai lewat, sesinya
 * menggantung selamanya di bagian atas daftar. Aturannya dibuat eksplisit:
 * sesi dianggap selesai begitu waktu mulinya lewat, baik itu sudah punya waktu
 * selesai yang juga lewat atau tidak punya waktu selesai sama sekali.
 */
export function sesiSelesai(
  slot: Partial<Slot> | null | undefined,
  now: number = Date.now()
): boolean {
  if (!slot?.mulai) return false;

  const mulai = new Date(slot.mulai).getTime();
  if (Number.isNaN(mulai) || mulai > now) return false;

  if (!slot.selesai) return true;

  const selesai = new Date(slot.selesai).getTime();
  if (Number.isNaN(selesai)) return true;

  return selesai <= now;
}

/** Semua sesi pada sebuah jadwal sudah lewat waktunya. */
export function jadwalSelesai(
  schedule: Partial<Jadwal> | null | undefined,
  now: number = Date.now()
): boolean {
  const slots = getSlots(schedule);
  if (slots.length === 0) return false;
  return slots.every((slot) => sesiSelesai(slot, now));
}

/** Kelompok urutan: sedang berlangsung, akan datang, atau sudah lewat. */
export function kelasAgenda(
  schedule: Partial<Jadwal> | null | undefined,
  now: number = Date.now()
): StatusAgenda {
  const slots = sortSlots(getSlots(schedule));
  if (slots.length === 0) return 'done';
  if (slots.every((slot) => sesiSelesai(slot, now))) return 'done';

  const sedangBerlangsung = slots.some(
    (slot) => new Date(slot.mulai).getTime() <= now
  );

  return sedangBerlangsung ? 'ongoing' : 'upcoming';
}

export function agendaOf(
  schedule: Partial<Jadwal>,
  now: number = Date.now()
): RingkasanAgenda {
  const slots = sortSlots(getSlots(schedule));
  const mulai = slots.length
    ? new Date(slots[0]!.mulai).getTime()
    : Number.POSITIVE_INFINITY;

  const akhir = slots.reduce((terbesar, slot) => {
    if (!slot.selesai) return terbesar;
    const nilai = new Date(slot.selesai).getTime();
    if (Number.isNaN(nilai)) return terbesar;
    return Math.max(terbesar, nilai);
  }, Number.NEGATIVE_INFINITY);

  return {
    state: kelasAgenda(schedule, now),
    nextStart: null,
    mulai,
    // Jadwal tanpa waktu selesai memakai waktu mulai sebagai patokan akhir,
    // supaya tetap punya nilai urut.
    akhir: akhir === Number.NEGATIVE_INFINITY ? mulai : akhir,
  };
}

/**
 * Mengurutkan jadwal tanpa mengubah isi aslinya: yang sedang berlangsung dulu,
 * lalu yang akan datang, lalu yang sudah lewat di paling bawah.
 */
export function sortByAgenda<T extends Partial<Jadwal>>(
  schedules: readonly T[],
  now: number = Date.now()
): T[] {
  return [...schedules]
    .map((schedule) => ({ schedule, info: agendaOf(schedule, now) }))
    .sort((a, b) => {
      if (a.info.state !== b.info.state) {
        return URUTAN_AGENDA[a.info.state] - URUTAN_AGENDA[b.info.state];
      }

      // Yang sudah lewat: yang baru saja berakhir dianggap lebih berguna,
      // jadi yang terakhir diurutkan paling depan di bagian bawah.
      if (a.info.state === 'done') return b.info.akhir - a.info.akhir;

      return a.info.mulai - b.info.mulai;
    })
    .map((item) => item.schedule);
}
