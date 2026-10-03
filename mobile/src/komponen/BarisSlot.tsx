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
//   padanannya, jadi tanggal dan jam dipilih terpisah lewat dialogue bawaan
//   sistem
// - Android menampilkan dialogue sendiri lalu menutup sendiri. iOS menampilkan
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

  const terapkan = (peristiwa: DateTimePickerEvent, terpilih?: Date) => {
    // Diambil ke variabel lokal karena setPemilih(null) di baris berikutnya
    // membuat compiler tidak bisa memastikan nilainya masih ada.
    const aktif = pemilih;

    setPemilih(null);
    if (peristiwa.type !== 'set' || !terpilih || !aktif) return;

    if (aktif.bidang === 'mulai') {
      onUbah(indeks, 'mulai', gabungTanggal(nilaiMulai, terpilih));
      return;
    }

    // Selesai hanya jamnya yang diganti, tanggalnya ikut tanggal mulai. Kalau
    // tanggal mulai belum diisi, pakai tanggal yang baru dipilih supaya tidak
    // muncul di hari yang salah.
    onUbah(indeks, 'selesai', gabungTanggal(nilaiMulai ?? terpilih, terpilih));
  };

  const diIos = Platform.OS === 'ios';

  return (
    <View className="rounded-2xl border border-bw-line bg-bw-card p-3.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold uppercase tracking-wide text-bw-muted">
          {jumlahSlot > 1 ? `Sesi ${indeks + 1}` : 'Tanggal dan jam'}
        </Text>

        {jumlahSlot > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Hapus sesi ${indeks + 1}`}
            onPress={() => onHapus(indeks)}
            className="h-11 w-11 items-center justify-center rounded-full active:bg-bw-surface"
          >
            <Ikon nama="trash-outline" token="bw-red" ukuran={17} />
          </Pressable>
        ) : null}
      </View>

      <Text className="mt-1.5 text-xs font-semibold text-bw-ink-2">Mulai</Text>
      <View className="mt-1.5 flex-row gap-2">
        <TombolPilih
          label={nilaiMulai ? formatTanggalPendek(nilaiMulai) : 'Tanggal'}
          aktif={Boolean(nilaiMulai)}
onTekan={() => setPemilih({ indeks, bidang: 'mulai', mode: 'date' })}
          accessibilityLabel="Ubah tanggal mulai"
        />
        <TombolPilih
          label={nilaiMulai ? formatJamPendek(nilaiMulai) : 'Jam'}
          aktif={Boolean(nilaiMulai)}
          onTekan={() => setPemilih({ indeks, bidang: 'mulai', mode: 'time' })}
          accessibilityLabel="Ubah jam mulai"
        />
      </View>

      <Text className="mt-3 text-xs font-semibold text-bw-ink-2">
        Selesai (opsional)
      </Text>
      <View className="mt-1.5 flex-row gap-2">
        <TombolPilih
          label={nilaiSelesai ? formatJamPendek(nilaiSelesai) : 'Jam'}
          aktif={Boolean(nilaiSelesai)}
          onTekan={() => setPemilih({ indeks, bidang: 'selesai', mode: 'time' })}
          hollow
          lebar="flex-1"
          accessibilityLabel="Ubah jam selesai"
        />
        {nilaiSelesai ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Hapus waktu selesai"
            onPress={() => onUbah(indeks, 'selesai', null)}
            className="h-14 w-14 items-center justify-center rounded-xl border border-bw-line bg-bw-surface active:opacity-70"
          >
            <Ikon nama="close" token="bw-muted" ukuran={18} />
          </Pressable>
        ) : null}
      </View>

      {galat ? (
        <Text accessibilityRole="alert" className="mt-2 text-xs text-bw-red">
          {galat}
        </Text>
      ) : null}

      {pemilih ? (
        diIos ? (
          <View className="mt-3 rounded-xl bg-bw-surface p-2">
            <DateTimePicker
              value={pemilih.bidang === 'mulai' ? nilaiMulai ?? new Date() : nilaiSelesai ?? nilaiMulai ?? new Date()}
              mode={pemilih.mode}
              display="spinner"
              onChange={terapkan}
              accentColor="#0071e3"
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setPemilih(null)}
              className="mt-1 h-11 items-center justify-center rounded-xl bg-bw-blue active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">Selesai</Text>
            </Pressable>
          </View>
        ) : (
          <DateTimePicker
            value={pemilih.bidang === 'mulai' ? nilaiMulai ?? new Date() : nilaiSelesai ?? nilaiMulai ?? new Date()}
            mode={pemilih.mode}
            display="default"
            onChange={terapkan}
            accentColor="#0071e3"
          />
        )
      ) : null}

      <View className="mt-3 flex-row gap-2">
        <TombolPilih
          label="Tambah sesi lain"
          onTekan={() => onTambah(indeks)}
          lebar="flex-1"
          hollow
          accessibilityLabel="Tambah sesi lain setelah sesi ini"
        />
      </View>
    </View>
  );
}

function TombolPilih({
  label,
  onTekan,
  aktif = false,
  hollow = false,
  lebar = 'flex-1',
  accessibilityLabel,
}: {
  label: string;
  onTekan: () => void;
  aktif?: boolean;
  hollow?: boolean;
  lebar?: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onTekan}
      className={`h-14 items-center justify-center rounded-xl border px-3 active:opacity-70 ${lebar} ${
        hollow
          ? 'border-bw-line bg-bw-surface'
          : aktif
            ? 'border-bw-blue-200 bg-bw-blue-50'
            : 'border-dashed border-bw-line bg-bw-card'
      }`}
    >
      <Text
        className={`text-sm font-bold ${
          aktif ? 'text-bw-blue-700' : 'text-bw-muted'
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
