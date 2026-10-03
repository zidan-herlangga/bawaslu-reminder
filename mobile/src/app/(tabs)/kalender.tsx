import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../komponen/Ikon';
import { Lencana, LencanaSelesai } from '../../komponen/Lencana';
import { LampuRealtime } from '../../komponen/LampuRealtime';
import { useSesi } from '../../lib/session';
import { useJadwal } from '../../lib/useJadwal';
import { formatJam, formatTanggalPanjang } from '../../shared/formatWaktu';
import {
  sesiSelesai,
  slotDayKey,
  type Jadwal,
  type Slot,
} from '../../shared/slots';
import { gayaKategori } from '../../komponen/gaya';

// Agenda: kalender bulanan + daftar jadwal per tanggal.
//
// Kalender dibuat sendiri (tanpa library tambahan) supaya tidak menambah
// dependensi native. Setiap sel hanya menampilkan tanggal dan satu titik
// penanda jika ada jadwal. Nama jadwal tidak dipaksakan muat di sel; detailnya
// ada di daftar di bawah kalender, yang menjawab "hari ini ada apa" lebih cepat.
//
// Jadwal yang waktunya sudah lewat tetap ditampilkan, dengan lencana Selesai
// dan warna redup. Menyingkirkannya membuat orang mengira agenda salah tanggal.

const KELIP_MS = 30 * 1000;

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
// Pekan dimulai Senin, sesuai kebiasaan di Indonesia.
const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

interface Baris {
  jadwal: Jadwal;
  sesi: Slot;
}

function awalBulan(tanggal: Date): Date {
  return new Date(tanggal.getFullYear(), tanggal.getMonth(), 1);
}

function kunciTanggal(tanggal: Date): string {
  return slotDayKey(tanggal.toISOString());
}

/** Menyusun sel kalender: null untuk kotak kosong sebelum tanggal 1. */
function susunSel(bulan: Date): (Date | null)[] {
  const tahun = bulan.getFullYear();
  const bln = bulan.getMonth();
  const jumlahHari = new Date(tahun, bln + 1, 0).getDate();
  // getDay(): 0 = Minggu. Diubah supaya Senin = 0.
  const geser = (new Date(tahun, bln, 1).getDay() + 6) % 7;

  const sel: (Date | null)[] = Array.from({ length: geser }, () => null);
  for (let hari = 1; hari <= jumlahHari; hari++) {
    sel.push(new Date(tahun, bln, hari, 12));
  }
  while (sel.length % 7 !== 0) sel.push(null);
  return sel;
}

export default function LayarAgenda() {
  const { session } = useSesi();
  const userId = session?.user.id ?? null;

  const { jadwal, memuat, terhubung, muatUlang } = useJadwal(userId);

  const [terpilih, setTerpilih] = useState(() => new Date());
  const [bulanTampil, setBulanTampil] = useState(() => awalBulan(new Date()));
  const [kalenderTerbuka, setKalenderTerbuka] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), KELIP_MS);
    return () => clearInterval(timer);
  }, []);

  // Kalau tanggal terpilih berpindah bulan (lewat tombol hari atau "Hari ini"),
  // kalender ikut berpindah.
  useEffect(() => {
    setBulanTampil(awalBulan(terpilih));
  }, [terpilih]);

  const hariIni = slotDayKey(new Date(now).toISOString());
  const kunciTerpilih = kunciTanggal(terpilih);

  // Jumlah sesi per tanggal, dipakai untuk titik penanda di kalender.
  const jumlahPerHari = useMemo(() => {
    const peta = new Map<string, number>();
    const tambah = (iso: string) => {
      const kunci = slotDayKey(iso);
      peta.set(kunci, (peta.get(kunci) ?? 0) + 1);
    };

    for (const item of jadwal) {
      const sesi = Array.isArray(item.slots) ? item.slots : [];
      for (const slot of sesi) {
        if (slot?.mulai) tambah(slot.mulai);
      }
      if (sesi.length === 0 && item.waktu_mulai) tambah(item.waktu_mulai);
    }
    return peta;
  }, [jadwal]);

  const baris = useMemo(() => {
    const hasil: Baris[] = [];

    for (const item of jadwal) {
      const sesi = Array.isArray(item.slots) ? item.slots : [];
      for (const slot of sesi) {
        if (!slot?.mulai) continue;
        if (slotDayKey(slot.mulai) === kunciTerpilih) {
          hasil.push({ jadwal: item, sesi: slot });
        }
      }

      // Jadwal tanpa daftar sesi tetap punya waktu_mulai sendiri.
      if (sesi.length === 0 && item.waktu_mulai) {
        if (slotDayKey(item.waktu_mulai) === kunciTerpilih) {
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
  }, [jadwal, kunciTerpilih, now]);

  const geserHari = useCallback((nilai: number) => {
    setTerpilih((sebelumnya) => {
      const berikut = new Date(sebelumnya);
      berikut.setDate(sebelumnya.getDate() + nilai);
      return berikut;
    });
  }, []);

  const geserBulan = useCallback((nilai: number) => {
    setBulanTampil((sebelumnya) =>
      new Date(sebelumnya.getFullYear(), sebelumnya.getMonth() + nilai, 1)
    );
  }, []);

  const sel = useMemo(() => susunSel(bulanTampil), [bulanTampil]);
  const pekan = useMemo(() => {
    const hasil: (Date | null)[][] = [];
    for (let i = 0; i < sel.length; i += 7) hasil.push(sel.slice(i, i + 7));
    return hasil;
  }, [sel]);

  const sudahHariIni = kunciTerpilih === hariIni;

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-3xl font-extrabold tracking-tight text-bw-ink">
              Agenda
            </Text>
            <Text className="mt-1 text-sm text-bw-muted">
              Pilih tanggal untuk melihat jadwal.
            </Text>

            <LampuRealtime terhubung={terhubung} />
          </View>

          <Pressable
            onPress={() => setTerpilih(new Date())}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke hari ini"
            disabled={sudahHariIni}
            className={`h-11 justify-center rounded-full border px-4 active:opacity-70 ${
              sudahHariIni
                ? 'border-bw-line bg-bw-card opacity-50'
                : 'border-bw-blue bg-bw-blue-50'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                sudahHariIni ? 'text-bw-ink-2' : 'text-bw-blue-700'
              }`}
            >
              Hari ini
            </Text>
          </Pressable>
        </View>

        {/* Kalender */}
        <View className="mt-5 rounded-[28px] border border-bw-line bg-bw-card p-4">
          <View className="flex-row items-center justify-between">
            <Pressable
              onPress={() => geserBulan(-1)}
              accessibilityRole="button"
              accessibilityLabel="Bulan sebelumnya"
              className="h-11 w-11 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
            >
              <Ikon nama="chevron-back" token="bw-ink-2" ukuran={20} />
            </Pressable>

            <Pressable
              onPress={() => setKalenderTerbuka((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={kalenderTerbuka ? 'Lipat kalender' : 'Buka kalender'}
              className="flex-1 flex-row items-center justify-center gap-1.5 py-2 active:opacity-70"
            >
              <Text className="text-base font-extrabold text-bw-ink">
                {NAMA_BULAN[bulanTampil.getMonth()]} {bulanTampil.getFullYear()}
              </Text>
              <Ikon
                nama={kalenderTerbuka ? 'chevron-up' : 'chevron-down'}
                token="bw-muted"
                ukuran={14}
              />
            </Pressable>

            <Pressable
              onPress={() => geserBulan(1)}
              accessibilityRole="button"
              accessibilityLabel="Bulan berikutnya"
              className="h-11 w-11 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
            >
              <Ikon nama="chevron-forward" token="bw-ink-2" ukuran={20} />
            </Pressable>
          </View>

          {kalenderTerbuka ? (
            <View className="mt-3">
              <View className="flex-row">
                {NAMA_HARI.map((hari, indeks) => (
                  <View key={hari} className="flex-1 items-center py-1.5">
                    <Text
                      className={`text-[11px] font-bold uppercase tracking-wide ${
                        indeks === 6 ? 'text-bw-red' : 'text-bw-muted'
                      }`}
                    >
                      {hari}
                    </Text>
                  </View>
                ))}
              </View>

              {pekan.map((minggu, indeksPekan) => (
                <View key={indeksPekan} className="flex-row">
                  {minggu.map((tanggal, indeksHari) => {
                    if (!tanggal) {
                      return <View key={indeksHari} className="h-12 flex-1" />;
                    }

                    const kunci = kunciTanggal(tanggal);
                    const aktif = kunci === kunciTerpilih;
                    const adalahHariIni = kunci === hariIni;
                    const jumlah = jumlahPerHari.get(kunci) ?? 0;

                    return (
                      <Pressable
                        key={indeksHari}
                        onPress={() => setTerpilih(tanggal)}
                        accessibilityRole="button"
                        accessibilityLabel={`${tanggal.getDate()} ${
                          NAMA_BULAN[tanggal.getMonth()]
                        }${jumlah > 0 ? `, ${jumlah} jadwal` : ''}`}
                        accessibilityState={{ selected: aktif }}
                        className="h-12 flex-1 items-center justify-center"
                      >
                        <View
                          className={`h-10 w-10 items-center justify-center rounded-full ${
                            aktif
                              ? 'bg-bw-blue'
                              : adalahHariIni
                                ? 'border border-bw-blue bg-bw-blue-50'
                                : ''
                          }`}
                        >
                          <Text
                            className={`text-sm ${
                              aktif
                                ? 'font-extrabold text-white'
                                : adalahHariIni
                                  ? 'font-extrabold text-bw-blue-700'
                                  : indeksHari === 6
                                    ? 'font-semibold text-bw-red'
                                    : 'font-semibold text-bw-ink'
                            }`}
                          >
                            {tanggal.getDate()}
                          </Text>
                          {jumlah > 0 ? (
                            <View
                              className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                                aktif ? 'bg-white' : 'bg-bw-blue'
                              }`}
                            />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : (
            <View className="mt-3 flex-row items-center justify-between rounded-2xl bg-bw-surface px-3 py-2">
              <Pressable
                onPress={() => geserHari(-1)}
                accessibilityRole="button"
                accessibilityLabel="Hari sebelumnya"
                className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              >
                <Ikon nama="chevron-back" token="bw-ink-2" ukuran={18} />
              </Pressable>
              <Text className="flex-1 text-center text-sm font-bold text-bw-ink">
                {formatTanggalPanjang(terpilih.toISOString())}
              </Text>
              <Pressable
                onPress={() => geserHari(1)}
                accessibilityRole="button"
                accessibilityLabel="Hari berikutnya"
                className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              >
                <Ikon nama="chevron-forward" token="bw-ink-2" ukuran={18} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Judul daftar */}
        <View className="mt-6 flex-row items-end justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-xs font-bold uppercase tracking-widest text-bw-muted">
              {sudahHariIni ? 'Hari ini' : 'Tanggal dipilih'}
            </Text>
            <Text className="mt-1 text-lg font-extrabold text-bw-ink">
              {formatTanggalPanjang(terpilih.toISOString())}
            </Text>
          </View>
          <View className="rounded-full bg-bw-blue-50 px-3 py-1.5">
            <Text className="text-xs font-bold text-bw-blue-700">
              {baris.length} jadwal
            </Text>
          </View>
        </View>

        {memuat && baris.length === 0 ? (
          <Text className="mt-10 text-center text-sm text-bw-muted">
            Memuat jadwal...
          </Text>
        ) : null}

        {!memuat && baris.length === 0 ? (
          <View className="mt-4 items-center rounded-[28px] border border-dashed border-bw-line bg-bw-card px-6 py-12">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-bw-surface">
              <Ikon nama="calendar-clear-outline" token="bw-muted" ukuran={30} />
            </View>
            <Text className="mt-4 text-base font-bold text-bw-ink">
              Tidak ada jadwal
            </Text>
            <Text className="mt-1.5 text-center text-xs leading-relaxed text-bw-muted">
              Tanggal ini masih kosong.
            </Text>
          </View>
        ) : null}

        <View className="mt-4 gap-3">
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
          className="mt-6 h-12 flex-row items-center justify-center gap-2 rounded-2xl border border-bw-line bg-bw-card active:opacity-70"
        >
          <Ikon nama="refresh" token="bw-ink-2" ukuran={18} />
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
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      className={`flex-row overflow-hidden rounded-3xl border border-bw-line bg-bw-card active:opacity-70 ${
        lewat ? 'opacity-70' : ''
      }`}
    >
      <View className={`w-1.5 ${lewat ? 'bg-bw-line' : 'bg-bw-blue'}`} />

      <View className="flex-1 flex-row items-center gap-3 p-4">
        <View className="min-w-14 items-center">
          <Text
            className={`text-base font-extrabold ${
              lewat ? 'text-bw-muted' : 'text-bw-ink'
            }`}
          >
            {formatJam(sesi.mulai)}
          </Text>
          {sesi.selesai ? (
            <Text className="mt-0.5 text-xs text-bw-muted">
              {formatJam(sesi.selesai)}
            </Text>
          ) : null}
        </View>

        <View className="h-10 w-px bg-bw-line" />

        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Lencana className={gaya.lencana}>{item.kategori}</Lencana>
            {lewat ? <LencanaSelesai /> : null}
          </View>
          <Text
            className={`mt-1.5 text-[15px] font-bold leading-snug ${
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