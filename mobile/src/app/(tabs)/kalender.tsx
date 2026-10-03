import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../komponen/Ikon';
import { Lencana, LencanaSelesai } from '../../komponen/Lencana';
import { useSesi } from '../../lib/session';
import { useJadwal } from '../../lib/useJadwal';
import {
  formatJam,
  formatTanggalPanjang,
} from '../../shared/formatWaktu';
import {
  sesiSelesai,
  slotDayKey,
  type Jadwal,
  type Slot,
} from '../../shared/slots';
import { gayaKategori } from '../../komponen/gaya';

// Agenda: daftar jadwal per tanggal.
//
// Kenapa agenda, bukan grid bulan seperti di web:
//
// Di layar HP, grid bulan membuat setiap sel hanya beberapa sentimeter. Orang
// harus mengecar angka yang tepat untuk tahu ada jadwal atau tidak, dan nama
// jadwal tidak pernah muat di sana. Agenda menjawab pertanyaan yang sama
// ("hari ini ada apa") dengan jauh lebih cepat, dan navigasi tetap tersedia
// lewat pemilih tanggal yang_native.
//
// Jadwal yang waktunya sudah lewat tetap ditampilkan, dengan lencana Selesai
// dan waktu yang dip strikes. Menyingkirkannya membuat orang mengira agenda
// salah tanggal.

const KELIP_MS = 30 * 1000;

interface Baris {
  jadwal: Jadwal;
  sesi: Slot;
}

export default function LayarAgenda() {
  const { session } = useSesi();
  const userId = session?.user.id ?? null;

  const { jadwal, memuat, muatUlang } = useJadwal(userId);

  const [terpilih, setTerpilih] = useState(() => new Date());
  const [bukaPemilih, setBukaPemilih] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), KELIP_MS);
    return () => clearInterval(timer);
  }, []);

  const hariIni = slotDayKey(new Date(now).toISOString());

  const baris = useMemo(() => {
    const hasil: Baris[] = [];
    const kunci = slotDayKey(terpilih.toISOString());

    for (const item of jadwal) {
      const sesi = Array.isArray(item.slots) ? item.slots : [];
      for (const slot of sesi) {
        if (!slot?.mulai) continue;
        if (slotDayKey(slot.mulai) === kunci) hasil.push({ jadwal: item, sesi: slot });
      }

      // Jadwal tanpa daftar sesi tetap punya waktu_mulai sendiri.
      if (sesi.length === 0 && item.waktu_mulai) {
        if (slotDayKey(item.waktu_mulai) === kunci) {
          hasil.push({
            jadwal: item,
            sesi: { mulai: item.waktu_mulai, selesai: item.waktu_selesai },
          });
        }
      }
    }

    // Sesi yang sudah lewat diturunkan ke bawah, terbaru lebih dulu di dalam
    // kelompoknya. Aturan yang sama dipakai kartu di Beranda.
    return hasil.sort((a, b) => {
      const lewatA = sesiSelesai(a.sesi, now);
      const lewatB = sesiSelesai(b.sesi, now);
      if (lewatA !== lewatB) return lewatA ? 1 : -1;

      const mulaiA = new Date(a.sesi.mulai).getTime();
      const mulaiB = new Date(b.sesi.mulai).getTime();
      return lewatA ? mulaiB - mulaiA : mulaiA - mulaiB;
    });
  }, [jadwal, terpilih, now]);

  const gantiTanggal = useCallback((peristiwa: DateTimePickerEvent, tanggal?: Date) => {
    setBukaPemilih(false);
    if (tanggal) setTerpilih(tanggal);
  }, []);

  const geserHari = useCallback((nilai: number) => {
    setTerpilih((sebelumnya) => {
      const berikut = new Date(sebelumnya);
      berikut.setDate(sebelumnya.getDate() + nilai);
      return berikut;
    });
  }, []);

  const keHariSebelumnya = useCallback(() => geserHari(-1), [geserHari]);

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top']}>
      <View className="border-b border-bw-line bg-bw-card px-4 pb-3 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-bw-ink">Agenda</Text>
          <Pressable
            onPress={() => setTerpilih(new Date())}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke hari ini"
            disabled={slotDayKey(terpilih.toISOString()) === hariIni}
            className="h-11 justify-center rounded-full border border-bw-line px-4 active:opacity-70 disabled:opacity-40"
          >
            <Text className="text-xs font-bold text-bw-ink-2">Hari ini</Text>
          </Pressable>
        </View>

        <View className="mt-3 flex-row items-center justify-between gap-2">
          <Pressable
            onPress={keHariSebelumnya}
            accessibilityRole="button"
            accessibilityLabel="Hari sebelumnya"
            className="h-12 w-12 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
          >
            <Ikon nama="chevron-back" token="bw-ink-2" ukuran={20} />
          </Pressable>

          <Pressable
            onPress={() => setBukaPemilih(true)}
            accessibilityRole="button"
            className="flex-1 items-center py-2"
          >
            <Text className="text-center text-sm font-bold text-bw-ink">
              {formatTanggalPanjang(terpilih.toISOString())}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <Ikon nama="calendar-outline" token="bw-muted" ukuran={13} />
              <Text className="text-xs text-bw-muted">Ubah tanggal</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => geserHari(1)}
            accessibilityRole="button"
            accessibilityLabel="Hari berikutnya"
            className="h-12 w-12 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
          >
            <Ikon nama="chevron-forward" token="bw-ink-2" ukuran={20} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {bukaPemilih ? (
          <DateTimePicker
            value={terpilih}
            mode="date"
            onChange={gantiTanggal}
            maximumDate={new Date(2100, 0, 1)}
          />
        ) : null}

        {memuat && baris.length === 0 ? (
          <Text className="mt-8 text-center text-sm text-bw-muted">
            Memuat jadwal...
          </Text>
        ) : null}

        {!memuat && baris.length === 0 ? (
          <View className="mt-8 items-center rounded-3xl border border-dashed border-bw-line bg-bw-card px-5 py-10">
            <Ikon nama="calendar-clear-outline" token="bw-muted" ukuran={32} />
            <Text className="mt-3 text-sm font-bold text-bw-ink">
              Tidak ada jadwal
            </Text>
            <Text className="mt-1 text-center text-xs leading-relaxed text-bw-muted">
              Tanggal ini masih kosong.
            </Text>
          </View>
        ) : null}

        <View className="gap-2.5">
          {baris.map(({ jadwal: item, sesi }) => (
            <BarisAgenda
              key={`${item.id}-${sesi.mulai}`}
              item={item}
              sesi={sesi}
              now={now}
              onTekan={() => undefined}
            />
          ))}
        </View>

        <Pressable
          onPress={() => muatUlang({ senyap: true })}
          accessibilityRole="button"
          className="mt-6 h-12 items-center justify-center rounded-xl bg-bw-card active:opacity-70"
        >
          <Text className="text-sm font-bold text-bw-ink-2">Muat ulang</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function BarisAgenda({
  item,
  sesi,
  now,
  onTekan,
}: {
  item: Jadwal;
  sesi: Slot;
  now: number;
  onTekan: () => void;
}) {
  const gaya = gayaKategori(item.kategori);
  const lewat = sesiSelesai(sesi, now);

  return (
    <Pressable
      onPress={onTekan}
      accessibilityRole="button"
      className={`overflow-hidden rounded-2xl border border-bw-line bg-bw-card p-3.5 active:opacity-70 ${
        lewat ? 'opacity-70' : ''
      }`}
    >
      <View className="flex-row items-center gap-3">
        <View className="min-w-16 items-center">
          <Text
            className={`text-base font-bold ${
              lewat ? 'text-bw-muted' : 'text-bw-ink'
            }`}
          >
            {formatJam(sesi.mulai)}
          </Text>
          {sesi.selesai ? (
            <Text className="text-xs text-bw-muted">{formatJam(sesi.selesai)}</Text>
          ) : null}
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Lencana className={gaya.lencana}>{item.kategori}</Lencana>
            {lewat ? <LencanaSelesai /> : null}
          </View>
          <Text
            className={`mt-1 text-sm font-bold leading-snug ${
              lewat ? 'text-bw-muted' : 'text-bw-ink'
            }`}
          >
            {item.judul}
          </Text>
          {item.deskripsi ? (
            <Text numberOfLines={2} className="mt-0.5 text-xs text-bw-muted">
              {item.deskripsi}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
