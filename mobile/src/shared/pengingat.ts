// Logika pengingat: sesi mana yang perlu didelegasikan ke pengguna.
//
// Dipisah dari komponen supaya bisa diuji tanpa perangkat dan tanpa React.
// Ini satu-satunya mekanisme pengingat yang jalan di Expo Go Android, jadi
// aturannya perlu benar dan perlu dibuktikan benar.
//
// Berkas ini sengaja tidak mengimpor apa pun. Bentuk datanya dibuat
// sekecil mungkin supaya lapisan runtime cukup menyusun sesi lalu
// menyerahkan pemeriksaannya ke sini.
//
// Ironisnya, ini lebih andal dari notifikasi sistem di Expo Go Android:
// pengingat ini memakai waktu milik aplikasi sendiri, bukan dari sistem.

export interface SlotSederhana {
  mulai: string;
  selesai?: string | null;
}

/** Satu jadwal beserta sesi-sesinya, setelah sesi diekstrak di lapisan atas. */
export interface SumberPengingat {
  id: string;
  judul: string;
  status?: string | null;
  slots: readonly SlotSederhana[];
}

/** Seberapa awal pengingat muncul sebelum sesi dimulai. */
export const JENDELA_AWAL_MS = 15 * 60 * 1000;

/**
 * Seberapa lewat masih layak diingatkan. Tanpa ini, membuka aplikasi tiga jam
 * setelah sesi dimulai akan memunculkan pengingat untuk yang sudah selesai.
 */
export const AMBANG_TELAT_MS = 15 * 60 * 1000;

export type NadaPengingat = 'mendatang' | 'berlangsung';

export interface KandidatPengingat {
  /** Kunci stabil untuk menandai pengingat ini sudah pernah ditampilkan. */
  kunci: string;
  jadwalId: string;
  judul: string;
  mulai: number;
  jarakMs: number;
  nada: NadaPengingat;
}

/**
 * Kandidat pengingat dari sekumpulan jadwal.
 *
 * Aturannya:
 * - Hanya status Aktif. Jadwal Dibatalkan tidak pernah diingatkan, dan jadwal
 *   Selesai tidak perlu karena waktunya sudah lewat.
 * - Satu pengingat per sesi, bukan per jadwal. Jadwal berlapis beberapa hari
 *   harus diingatkan tiap sesinya.
 * - Kalau beberapa sesi dari jadwal sama-sama masuk jendela, yang paling awal
 *   saja. Mengingatkan dua kali untuk jadwal yang sama di menit yang sama
 *   hanya membingungkan.
 * - Sesi dengan waktu tidak valid dilewati, bukan membuat galat.
 */
export function kandidatPengingat(
  sumber: readonly (SumberPengingat | null | undefined)[],
  now: number,
  jendelaMs: number = JENDELA_AWAL_MS,
  ambangTelatMs: number = AMBANG_TELAT_MS
): KandidatPengingat[] {
  const hasil: KandidatPengingat[] = [];

  for (const item of sumber) {
    if (!item?.id) continue;
    if (item.status && item.status !== 'Aktif') continue;

    const sesi = (item.slots ?? [])
      .map((slot) => new Date(slot.mulai).getTime())
      .filter((mulai) => !Number.isNaN(mulai))
      .sort((a, b) => a - b);

    // Sesi pertama yang masuk jendela. Karena sudah terurut, sisa sesi milik
    // jadwal ini tidak perlu diperiksa lagi.
    const terpilih = sesi.find((mulai) => {
      const jarak = mulai - now;
      return jarak <= jendelaMs && jarak >= -ambangTelatMs;
    });

    if (terpilih === undefined) continue;

    const jarakMs = terpilih - now;

    hasil.push({
      kunci: `${item.id}@${terpilih}`,
      jadwalId: item.id,
      judul: item.judul?.trim() || '(tanpa judul)',
      mulai: terpilih,
      jarakMs,
      nada: jarakMs <= 0 ? 'berlangsung' : 'mendatang',
    });
  }

  return hasil.sort((a, b) => a.mulai - b.mulai);
}

/**
 * Saring kandidat yang belum pernah ditampilkan.
 *
 * Pemanggil menyimpan kuncinya sendiri supaya pengingat tidak muncul dua kali
 * untuk sesi yang sama. Fungsi ini sengaja tidak menyimpan apa pun supaya
 * tetap murni: keputusan "sudah pernah" milik lapisan runtime.
 */
export function yangBelumDitampilkan(
  kandidat: readonly KandidatPengingat[],
  sudahDitampilkan: ReadonlySet<string>
): KandidatPengingat[] {
  return kandidat.filter((item) => !sudahDitampilkan.has(item.kunci));
}

/** Kunci yang boleh dilupakan: yang sesinya sudah jauh lewat. */
export function kunciBolehDilupakan(
  kandidat: readonly KandidatPengingat[],
  now: number
): string[] {
  return kandidat
    .filter((item) => item.mulai < now - AMBANG_TELAT_MS)
    .map((item) => item.kunci);
}

/** Teks singkat untuk banner pengingat di dalam aplikasi. */
export function kalimatPengingat(item: KandidatPengingat): string {
  return item.nada === 'berlangsung'
    ? `${item.judul} sedang berjalan.`
    : `${item.judul} dimulai ${formatSelisih(item.jarakMs)}.`;
}

/** "5 menit", "2 jam 10 menit", "kurang dari satu menit". */
export function formatSelisih(jarakMs: number): string {
  const totalDetik = Math.max(0, Math.round(jarakMs / 1000));

  if (totalDetik < 60) return 'kurang dari satu menit';

  const menit = Math.round(totalDetik / 60);
  if (menit < 60) return `${menit} menit`;

  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;

  if (jam < 24) {
    return sisaMenit === 0 ? `${jam} jam` : `${jam} jam ${sisaMenit} menit`;
  }

  const hari = Math.floor(jam / 24);
  const sisaJam = jam % 24;
  return sisaJam === 0 ? `${hari} hari` : `${hari} hari ${sisaJam} jam`;
}

// ---------------------------------------------------------------------------
// Membaca baris schedules dari Supabase
//
// Ada dua tempat nyimpan sesi di database, dan keduanya harus ditangani:
//   - kolom slots, untuk jadwal berlapis beberapa hari
//   - kolom waktu_mulai dan waktu_selesai, untuk jadwal sederhana
//
// Kalau hanya salah satu yang dibaca, jadwal yang tidak punya kolom slots akan
// hilang tanpa jejak: tidak error, tidak tampil, tidak pernah diingatkan.

export interface BarisSlot {
  mulai: string | null;
  selesai: string | null;
}

export interface BarisJadwal {
  id: string;
  judul: string | null;
  status: string | null;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  slots: BarisSlot[] | null;
}

/** Sesi-sesi pada satu baris jadwal, selalu dalam bentuk yang bisa dihitung. */
export function normalisasiSlot(baris: BarisJadwal): SlotSederhana[] {
  const mentah = Array.isArray(baris.slots) ? baris.slots : [];

  const dariSlots = mentah
    .filter((slot): slot is BarisSlot => Boolean(slot?.mulai))
    .map((slot) => ({ mulai: String(slot.mulai), selesai: slot.selesai ?? null }));

  if (dariSlots.length > 0) return dariSlots;

  if (baris.waktu_mulai) {
    return [
      { mulai: baris.waktu_mulai, selesai: baris.waktu_selesai ?? null },
    ];
  }

  return [];
}

/**
 * Sesi-sesi yang masuk jendela pengingat dari sekumpulan baris jadwal.
 */
export function sesiMasukJendela(
  jadwal: readonly BarisJadwal[],
  now: number,
  jendelaMs: number = JENDELA_AWAL_MS,
  ambangTelatMs: number = AMBANG_TELAT_MS
): KandidatPengingat[] {
  return kandidatPengingat(
    jadwal.map((baris) => ({
      id: baris.id,
      judul: baris.judul ?? '',
      status: baris.status,
      slots: normalisasiSlot(baris),
    })),
    now,
    jendelaMs,
    ambangTelatMs
  );
}
