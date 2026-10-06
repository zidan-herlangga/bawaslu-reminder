import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { Ikon } from './Ikon';
import { formatTanggalPanjang } from '../shared/formatWaktu';
import {
  geserTanggal,
  keTanggalLokal,
  tanggalDariDate,
  tanggalHariIni,
} from '../shared/tugas';

// Pemilih tanggal untuk daftar tugas.
//
// Web pakai <input type="date">. Di Android dan iOS padanannya adalah
// DateTimePicker dengan mode date, dan polanya sudah benar dipakai BarisSlot
// untuk jadwal: Android menutup dialognya sendiri setiap kali ada hasil,
// sedangkan iOS harus punya tombol "Selesai" karena onChange dipanggil di
// setiap putaran spinner.
//
// Tombol sehari sebelum dan sesudahnya sengaja disediakan. Berpindah tanggal di
// ponsel jauh lebih lambat daripada mengetik tanggal di web, jadi pilihan cepat
// itu yang paling sering dipakai justru sehari mundur atau maju.

export function PilihTanggal({
  nilai,
  onUbah,
}: {
  nilai: string;
  onUbah: (tanggal: string) => void;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const diIos = Platform.OS === 'ios';

  // Nilai picker harus berupa Date. Kalau teks tanggalnya rusak, pakai hari ini
  // supaya picker tetap terbuka di tanggal yang masuk akal.
  const tanggalPicker = keTanggalLokal(nilai) ?? keTanggalLokal(tanggalHariIni())!;

  const terapkan = (peristiwa: DateTimePickerEvent, terpilih?: Date) => {
    // Lihat catatan di atas: hanya iOS yang perlu tombol tutup sendiri.
    if (!diIos) setTerbuka(false);

    if (peristiwa.type !== 'set' || !terpilih) return;
    onUbah(tanggalDariDate(terpilih));
  };

  return (
    <View className="mt-3 rounded-2xl border border-bw-line bg-bw-card p-3">
      <View className="flex-row items-center gap-2">
        <TombolGeser
          ikon="chevron-back"
          label="Sehari sebelumnya"
          onPress={() => onUbah(geserTanggal(nilai, -1))}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ubah tanggal, sekarang ${formatTanggalPanjang(nilai)}`}
          onPress={() => setTerbuka((v) => !v)}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-bw-surface active:opacity-70"
        >
          <Ikon nama="calendar-outline" token="bw-blue" ukuran={17} />
          <Text
            numberOfLines={1}
            className="flex-1 text-sm font-bold text-bw-ink"
          >
            {formatTanggalPanjang(nilai)}
          </Text>
          <Ikon
            nama={terbuka ? 'chevron-up' : 'chevron-down'}
            token="bw-muted"
            ukuran={16}
          />
        </Pressable>

        <TombolGeser
          ikon="chevron-forward"
          label="Sehari sesudahnya"
          onPress={() => onUbah(geserTanggal(nilai, 1))}
        />
      </View>

      {nilai !== tanggalHariIni() ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onUbah(tanggalHariIni())}
          className="mt-2 h-10 items-center justify-center rounded-xl active:opacity-70"
        >
          <Text className="text-xs font-bold text-bw-blue">Kembali ke hari ini</Text>
        </Pressable>
      ) : null}

      {terbuka ? (
        diIos ? (
          <View className="mt-3 rounded-2xl bg-bw-surface p-2">
            <DateTimePicker
              value={tanggalPicker}
              mode="date"
              display="spinner"
              locale="id-ID"
              onChange={terapkan}
              accentColor="#0071e3"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Selesai memilih tanggal"
              onPress={() => setTerbuka(false)}
              className="mt-1 h-12 items-center justify-center rounded-xl bg-bw-blue active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">Selesai</Text>
            </Pressable>
          </View>
        ) : (
          <DateTimePicker
            value={tanggalPicker}
            mode="date"
            display="default"
            onChange={terapkan}
          />
        )
      ) : null}
    </View>
  );
}

function TombolGeser({
  ikon,
  label,
  onPress,
}: {
  ikon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      className="h-12 w-12 items-center justify-center rounded-xl border border-bw-line active:opacity-70"
    >
      <Ikon nama={ikon} token="bw-ink-2" ukuran={18} />
    </Pressable>
  );
}