import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ikon } from './Ikon';

// Formulir jadwal untuk aplikasi native.
//
// Bentuk dan validasinya sama dengan ScheduleForm.jsx milik web, tetapi cara
// memasukkan tanggal dan jamnya berbeda, dan itu yang perlu diperhatikan:
//
// - Web memakai <input type="datetime-local">. React Native tidak punya
//   padanannya, jadi tanggal dan jam dipilih terpisah lewat dialog bawaan
//   sistem
// - Android menampilkan dialog sendiri lalu menutup sendiri. iOS menampilkan
//   roda angka (spinner), jadi picker di sana tidak ditutup otomatis: setiap
//   perubahan roda akan memicu onChange, dan menutupnya seketika membuat
//   orang tidak bisa menyempurnakan pilihan. Karena itu di iOS ada tombol
//   "Selesai" sendiri
// - Waktu selesai tidak wajib diisi, jadi ada tombol untuk menghapusnya.
//   Menghapus lewat picker akan ikut menghapus tanggal, padahal biasanya orang
//   hanya ingin memperpendek durasi

export type BidangSlot = 'mulai' | 'selesai';

interface Pemilihan {
  indeks: number;
  bidang: BidangSlot;
  mode: 'date' | 'time';
}

type NamaIkon = Parameters<typeof Ikon>[0]['nama'];

export function BarisSlot({
  indeks,
  jumlahSlot,
  nilaiMulai,
  nilaiSelesai,
  galat,
  onUbah,
  onTambah,
  onHapus,
}: {
  indeks: number;
  jumlahSlot: number;
  nilaiMulai: Date | null;
  nilaiSelesai: Date | null;
  galat?: string;
  onUbah: (indeks: number, bidang: BidangSlot, nilai: Date | null) => void;
  onTambah: (indeks: number) => void;
  onHapus: (indeks: number) => void;
}) {
  const [pemilih, setPemilih] = useState<Pemilihan | null>(null);
  const diIos = Platform.OS === 'ios';

  const terapkan = (peristiwa: DateTimePickerEvent, terpilih?: Date) => {
    // Android menutup dialognya sendiri setiap kali ada hasil (set atau batal).
    // iOS tidak boleh ditutup di sini, karena onChange dipanggil di setiap
    // putaran roda; iOS ditutup lewat tombol "Selesai".
    if (!diIos) setPemilih(null);

    const aktif = pemilih;
    if (peristiwa.type !== 'set' || !terpilih || !aktif) return;

    if (aktif.bidang === 'mulai') {
      // Mode tanggal: tanggal dari picker, jam dipertahankan dari nilai lama.
      // Mode jam: jam dari picker, tanggal dipertahankan dari nilai lama.
      const hasil =
        aktif.mode === 'date'
          ? gabungTanggal(terpilih, nilaiMulai ?? terpilih)
          : gabungTanggal(nilaiMulai ?? terpilih, terpilih);
      onUbah(indeks, 'mulai', hasil);
      return;
    }

    // Selesai hanya jamnya yang diganti, tanggalnya ikut tanggal mulai. Kalau
    // tanggal mulai belum diisi, pakai tanggal yang baru dipilih supaya tidak
    // muncul di hari yang salah.
    onUbah(indeks, 'selesai', gabungTanggal(nilaiMulai ?? terpilih, terpilih));
  };

  const nilaiPicker = pemilih
    ? pemilih.bidang === 'mulai'
      ? nilaiMulai ?? new Date()
      : nilaiSelesai ?? nilaiMulai ?? new Date()
    : new Date();

  const durasi = nilaiMulai && nilaiSelesai ? formatDurasi(nilaiMulai, nilaiSelesai) : null;

  return (
    <View className="rounded-3xl border border-bw-line bg-bw-card p-4">
      {/* Kepala kartu */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2.5">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-bw-blue-50">
            {jumlahSlot > 1 ? (
              <Text className="text-xs font-extrabold text-bw-blue-700">
                {indeks + 1}
              </Text>
            ) : (
              <Ikon nama="calendar-outline" token="bw-blue" ukuran={16} />
            )}
          </View>
          <Text className="text-xs font-bold uppercase tracking-widest text-bw-muted">
            {jumlahSlot > 1 ? `Sesi ${indeks + 1}` : 'Tanggal dan jam'}
          </Text>
        </View>

        {jumlahSlot > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hapus sesi ${indeks + 1}`}
            onPress={() => onHapus(indeks)}
            hitSlop={6}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-bw-surface"
          >
            <Ikon nama="trash-outline" token="bw-red" ukuran={18} />
          </Pressable>
        ) : null}
      </View>

      {/* Mulai */}
      <Text className="mb-2 ml-1 mt-4 text-xs font-bold text-bw-ink-2">Mulai</Text>
      <View className="flex-row gap-2">
        <TombolPilih
          ikon="calendar-outline"
          label={nilaiMulai ? formatTanggalPendek(nilaiMulai) : 'Tanggal'}
          aktif={Boolean(nilaiMulai)}
          terbuka={pemilih?.bidang === 'mulai' && pemilih.mode === 'date'}
          onTekan={() => setPemilih({ indeks, bidang: 'mulai', mode: 'date' })}
          accessibilityLabel="Ubah tanggal mulai"
        />
        <TombolPilih
          ikon="time-outline"
          label={nilaiMulai ? formatJamPendek(nilaiMulai) : 'Jam'}
          aktif={Boolean(nilaiMulai)}
          terbuka={pemilih?.bidang === 'mulai' && pemilih.mode === 'time'}
          onTekan={() => setPemilih({ indeks, bidang: 'mulai', mode: 'time' })}
          accessibilityLabel="Ubah jam mulai"
        />
      </View>

      {/* Selesai */}
      <View className="mb-2 ml-1 mt-4 flex-row items-center justify-between">
        <Text className="text-xs font-bold text-bw-ink-2">Selesai (opsional)</Text>
        {durasi ? (
          <View className="rounded-full bg-bw-surface px-2.5 py-1">
            <Text className="text-[11px] font-bold text-bw-ink-2">{durasi}</Text>
          </View>
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <TombolPilih
          ikon="time-outline"
          label={nilaiSelesai ? formatJamPendek(nilaiSelesai) : 'Jam selesai'}
          aktif={Boolean(nilaiSelesai)}
          terbuka={pemilih?.bidang === 'selesai'}
          onTekan={() => setPemilih({ indeks, bidang: 'selesai', mode: 'time' })}
          accessibilityLabel="Ubah jam selesai"
        />
        {nilaiSelesai ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hapus waktu selesai"
            onPress={() => onUbah(indeks, 'selesai', null)}
            className="h-14 w-14 items-center justify-center rounded-2xl border border-bw-line bg-bw-surface active:opacity-70"
          >
            <Ikon nama="close" token="bw-muted" ukuran={20} />
          </Pressable>
        ) : null}
      </View>

      {galat ? (
        <View
          accessibilityRole="alert"
          className="mt-3 flex-row items-start gap-2 rounded-2xl border border-bw-red-100 bg-bw-red-50 px-3 py-2.5"
        >
          <Ikon nama="alert-circle-outline" token="bw-red" ukuran={16} />
          <Text className="flex-1 text-xs leading-relaxed text-bw-red">{galat}</Text>
        </View>
      ) : null}

      {/* Picker */}
      {pemilih ? (
        diIos ? (
          <View className="mt-3 rounded-2xl bg-bw-surface p-2">
            <DateTimePicker
              value={nilaiPicker}
              mode={pemilih.mode}
              display="spinner"
              locale="id-ID"
              onChange={terapkan}
              accentColor="#0071e3"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selesai memilih"
              onPress={() => setPemilih(null)}
              className="mt-1 h-12 items-center justify-center rounded-xl bg-bw-blue active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">Selesai</Text>
            </Pressable>
          </View>
        ) : (
          <DateTimePicker
            value={nilaiPicker}
            mode={pemilih.mode}
            display="default"
            is24Hour
            onChange={terapkan}
          />
        )
      ) : null}

      {/* Tambah sesi */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tambah sesi lain setelah sesi ini"
        onPress={() => onTambah(indeks)}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        className="mt-4 h-12 flex-row items-center justify-center gap-1.5 rounded-2xl border border-dashed border-bw-line bg-bw-surface active:opacity-70"
      >
        <Ikon nama="add" token="bw-ink-2" ukuran={18} />
        <Text className="text-sm font-bold text-bw-ink-2">Tambah sesi lain</Text>
      </Pressable>
    </View>
  );
}

function TombolPilih({
  ikon,
  label,
  onTekan,
  aktif = false,
  terbuka = false,
  accessibilityLabel,
}: {
  ikon: NamaIkon;
  label: string;
  onTekan: () => void;
  aktif?: boolean;
  terbuka?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ expanded: terbuka }}
      onPress={onTekan}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      className={`h-14 flex-1 flex-row items-center justify-center gap-2 rounded-2xl border-2 px-3 active:opacity-70 ${
        terbuka
          ? 'border-bw-blue bg-bw-blue-50'
          : aktif
            ? 'border-transparent bg-bw-blue-50'
            : 'border-dashed border-bw-line bg-bw-surface'
      }`}
    >
      <Ikon nama={ikon} token={aktif || terbuka ? 'bw-blue' : 'bw-muted'} ukuran={18} />
      <Text
        numberOfLines={1}
        className={`shrink text-sm font-bold ${
          aktif || terbuka ? 'text-bw-blue-700' : 'text-bw-muted'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Menggabungkan bagian tanggal dari satu Date dengan bagian jam dari Date lain.
 *
 * Dipakai karena tanggal dan jam dipilih terpisah. Kalau picker tanggal ditutup,
 * jam yang sudah dipilih sebelumnya tidak boleh hilang.
 */
export function gabungTanggal(bagianTanggal: Date | null, bagianJam: Date): Date {
  const dasar = bagianTanggal ? new Date(bagianTanggal) : new Date(bagianJam);
  return new Date(
    dasar.getFullYear(),
    dasar.getMonth(),
    dasar.getDate(),
    bagianJam.getHours(),
    bagianJam.getMinutes(),
    0,
    0
  );
}

function formatTanggalPendek(nilai: Date): string {
  return nilai.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatJamPendek(nilai: Date): string {
  return nilai.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Durasi antara mulai dan selesai, mis. "1 j 30 m". Null kalau tidak positif. */
function formatDurasi(mulai: Date, selesai: Date): string | null {
  const menit = Math.round((selesai.getTime() - mulai.getTime()) / 60000);
  if (menit <= 0) return null;

  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam === 0) return `${sisa} m`;
  if (sisa === 0) return `${jam} j`;
  return `${jam} j ${sisa} m`;
}