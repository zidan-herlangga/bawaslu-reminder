// Validasi formulir jadwal.
//
// Aturan ini disalin dari validate() di src/components/ScheduleForm.jsx milik
// aplikasi web, dengan pesan yang sama. Logikanya murni dan tidak menyentuh
// database, jadi diletakkan di shared: bisa dipakai form native dan diuji
// tanpa perangkat.
//
// Berkas ini sengaja tanpa import apa pun. Node hanya menghapus tipe dari
// berkas .ts dan tetap memerlukan ekstensi eksplisit saat mengimpor, jadi
// modul yang tidak punya dependensi bisa langsung diuji tanpa penyesuaian
// resolver. Daftar kategori dan divisi diambil di komponen form.

export interface SlotForm {
  mulai: Date | null;
  selesai: Date | null;
}

export interface FormJadwal {
  judul: string;
  kategori: string;
  deskripsi: string;
  /** null berarti semua staf, sama seperti kolom target_divisi yang null. */
  targetDivisi: string | null;
  slots: SlotForm[];
}

export type GalatJadwal =
  | { jenis: 'judul' | 'deskripsi' | 'target' | 'slots' | 'slot'; pesan: string; indeksSlot?: number };

export const BATAS_JUDUL = 150;
export const BATAS_DESKRIPSI = 1000;

export const SLOT_KOSONG: SlotForm = { mulai: null, selesai: null };

export function formKosong(): FormJadwal {
  return {
    judul: '',
    kategori: 'Rapat',
    deskripsi: '',
    targetDivisi: null,
    slots: [{ ...SLOT_KOSONG }],
  };
}

/** Bentuk yang disimpan di kolom slots: ISO string, selesai boleh null. */
export interface SlotTersimpan {
  mulai: string;
  selesai: string | null;
}

export interface PayloadJadwal {
  judul: string;
  deskripsi: string;
  kategori: string;
  target_divisi: string | null;
  waktu_mulai: string;
  waktu_selesai: string | null;
  slots: SlotTersimpan[];
}

/**
 * Memeriksa form dan mengembalikan daftar galat. Kembalikan daftar, bukan
 * objek per-field: di native galat ditampilkan per sesi dan itu lebih mudah
 * dibaca daripada peta dengan kunci gabungan seperti di web.
 */
export function validasiJadwal(values: FormJadwal): GalatJadwal[] {
  const galat: GalatJadwal[] = [];

  const judul = values.judul.trim();
  if (!judul) {
    galat.push({ jenis: 'judul', pesan: 'Judul jadwal wajib diisi.' });
  } else if (judul.length > BATAS_JUDUL) {
    galat.push({ jenis: 'judul', pesan: `Judul maksimal ${BATAS_JUDUL} karakter.` });
  }

  if (values.deskripsi.length > BATAS_DESKRIPSI) {
    galat.push({
      jenis: 'deskripsi',
      pesan: `Deskripsi maksimal ${BATAS_DESKRIPSI} karakter.`,
    });
  }

  if (values.targetDivisi !== null && !values.targetDivisi) {
    galat.push({
      jenis: 'target',
      pesan: 'Pilih divisi penerima pengingat.',
    });
  }

  if (values.slots.length === 0) {
    galat.push({ jenis: 'slots', pesan: 'Tambahkan minimal satu tanggal dan jam.' });
    return galat;
  }

  values.slots.forEach((slot, index) => {
    if (!slot.mulai) {
      galat.push({
        jenis: 'slot',
        indeksSlot: index,
        pesan: 'Tanggal dan jam mulai wajib diisi.',
      });
      return;
    }

    if (Number.isNaN(slot.mulai.getTime())) {
      galat.push({
        jenis: 'slot',
        indeksSlot: index,
        pesan: 'Tanggal dan jam tidak valid.',
      });
      return;
    }

    if (slot.selesai) {
      if (Number.isNaN(slot.selesai.getTime())) {
        galat.push({
          jenis: 'slot',
          indeksSlot: index,
          pesan: 'Waktu selesai tidak valid.',
        });
        return;
      }

      if (slot.selesai.getTime() < slot.mulai.getTime()) {
        galat.push({
          jenis: 'slot',
          indeksSlot: index,
          pesan: 'Waktu selesai tidak boleh sebelum waktu mulai.',
        });
      }
    }
  });

  return galat;
}

/** Pesan pertama, untuk ditampilkan paling atas. */
export function galatPertama(galat: GalatJadwal[]): string {
  return galat[0]?.pesan ?? '';
}

/**
 * Menyusun payload yang disimpan ke tabel schedules.
 *
 * waktu_mulai dan waktu_selesai selalu diisi ulang dari daftar sesi, karena
 * keduanya dipakai untuk pengurutan dan ringkasan. Kalau tidak, satu sesi yang
 * diubah tanggalnya akan membuat kedua kolom itu tidak sinkron dengan isi
 * slots.
 *
 * Melempar galat kalau form belum valid, supaya tidak mungkin menyimpan jadwal
 * yang tidak punya sesi.
 */
export function susunPayload(values: FormJadwal): PayloadJadwal {
  const galat = validasiJadwal(values);
  if (galat.length > 0) {
    throw new Error(galatPertama(galat));
  }

  const slots: SlotTersimpan[] = values.slots.map((slot) => ({
    mulai: (slot.mulai as Date).toISOString(),
    selesai: slot.selesai ? slot.selesai.toISOString() : null,
  }));

  const mulai = slots.map((slot) => new Date(slot.mulai).getTime());
  const selesai = slots
    .filter((slot) => slot.selesai)
    .map((slot) => new Date(slot.selesai as string).getTime());

  return {
    judul: values.judul.trim(),
    deskripsi: values.deskripsi.trim(),
    kategori: values.kategori,
    target_divisi: values.targetDivisi || null,
    waktu_mulai: new Date(Math.min(...mulai)).toISOString(),
    waktu_selesai: selesai.length ? new Date(Math.max(...selesai)).toISOString() : null,
    slots,
  };
}

/** Membentuk form dari jadwal yang tersimpan, untuk mode ubah. */
export function formDariJadwal(jadwal: {
  judul?: string | null;
  kategori?: string | null;
  deskripsi?: string | null;
  target_divisi?: string | null;
  slots?: unknown;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
}): FormJadwal {
  const raw = Array.isArray(jadwal.slots) ? jadwal.slots : [];

  const sesi = raw
    .filter(
      (slot): slot is { mulai: string; selesai?: string | null } =>
        Boolean(slot && typeof slot === 'object' && 'mulai' in slot && slot.mulai)
    )
    .map((slot) => ({
      mulai: new Date(slot.mulai),
      selesai: slot.selesai ? new Date(slot.selesai) : null,
    }));

  if (sesi.length > 0) {
    return {
      judul: jadwal.judul ?? '',
      kategori: jadwal.kategori ?? 'Rapat',
      deskripsi: jadwal.deskripsi ?? '',
      targetDivisi: jadwal.target_divisi ?? null,
      slots: sesi,
    };
  }

  // Jadwal lama yang belum punya daftar sesi: bentukkan satu dari
  // waktu_mulai dan waktu_selesai, persis seperti getSlots() di sisi web.
  if (jadwal.waktu_mulai) {
    return {
      judul: jadwal.judul ?? '',
      kategori: jadwal.kategori ?? 'Rapat',
      deskripsi: jadwal.deskripsi ?? '',
      targetDivisi: jadwal.target_divisi ?? null,
      slots: [
        {
          mulai: new Date(jadwal.waktu_mulai),
          selesai: jadwal.waktu_selesai ? new Date(jadwal.waktu_selesai) : null,
        },
      ],
    };
  }

  return {
    ...formKosong(),
    judul: jadwal.judul ?? '',
    deskripsi: jadwal.deskripsi ?? '',
    targetDivisi: jadwal.target_divisi ?? null,
  };
}

/** Divisi yang boleh dipilih sebagai penerima. */
// Daftar divisi ada di components/FormJadwal.tsx, bukan di sini.
