import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatJam, formatTanggalPendek, formatWaktuLengkap } from '../shared/formatWaktu';
import { namaDivisi } from '../shared/options';
import { sesiSelesai, sortSlots, type Jadwal, type Slot } from '../shared/slots';
import type { TokenWarna } from '../tema/warna';
import { useGesekTutup } from '../lib/useGesekTutup';
import { Ikon, type NamaIkon } from './Ikon';
import { Lencana, LencanaSelesai, LencanaStatus } from './Lencana';
import { gayaKategori } from './gaya';

export function ModalDetail({
  terbuka,
  jadwal,
  sesi,
  now,
  milikSaya,
  onTutup,
  onIngatkan,
  onUbah,
  onHapus,
  onPilihSesi,
}: {
  terbuka: boolean;
  jadwal: Jadwal | null;
  sesi: Slot | null;
  now: number;
  milikSaya: boolean;
  onTutup: () => void;
  onIngatkan?: () => void;
  onUbah?: () => void;
  onHapus?: () => void;
  onPilihSesi?: (slot: Slot) => void;
}) {
  const insets = useSafeAreaInsets();
  const [pilihan, setPilihan] = useState<Slot | null>(null);
  
  const { panGesture, gayaKartu, gayaBackdrop, tutupDenganAnimasi } = useGesekTutup(
    terbuka,
    onTutup
  );

  useEffect(() => {
    if (terbuka) {
      setPilihan(null);
    }
  }, [terbuka, jadwal?.id]);

  if (!jadwal) return null;

  const gaya = gayaKategori(jadwal.kategori);
  const slots = sortSlots(
    Array.isArray(jadwal.slots) && jadwal.slots.length > 0
      ? jadwal.slots
      : jadwal.waktu_mulai
        ? [{ mulai: jadwal.waktu_mulai, selesai: jadwal.waktu_selesai }]
        : []
  );

  const tampil = pilihan ?? sesi ?? slots[0] ?? null;
  const lewat = tampil ? sesiSelesai(tampil, now) : false;

  const pilihSesi = (slot: Slot) => {
    setPilihan(slot);
    onPilihSesi?.(slot);
  };

  const adaAksiPemilik = milikSaya && Boolean(onIngatkan || onUbah || onHapus);

  return (
    <Modal
      visible={terbuka}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={tutupDenganAnimasi}
    >
      <Animated.View className="flex-1 justify-end" style={gayaBackdrop}>
        {/* Backdrop pressable untuk menutup modal */}
        <Pressable
          accessible={false}
          className="flex-1"
          onPress={tutupDenganAnimasi}
        />

        {/* Modal Container yang dapat digesek */}
        <Animated.View
          className="max-h-[90%] rounded-t-[32px] border border-b-0 border-bw-line bg-bw-card shadow-2xl"
          style={gayaKartu}
        >
          {/* Header Pegangan Gesture (Handle Bar) */}
          <GestureDetector gesture={panGesture}>
            <View className="items-center pb-3 pt-3">
              <View className="h-1.5 w-12 rounded-full bg-bw-line/80" />
            </View>
          </GestureDetector>

          {/* Kepala Detail */}
          <View className="flex-row items-start gap-3 px-5 pb-4 pt-1">
            <View
              className={`h-12 w-12 items-center justify-center rounded-2xl border ${gaya.lencana}`}
            >
              <Ikon nama={gaya.ikon} token={gaya.aksen} ukuran={22} />
            </View>

            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap gap-1.5">
                <Lencana className={gaya.lencana} teks={gaya.teks}>
                  {jadwal.kategori}
                </Lencana>
                {lewat ? (
                  <LencanaSelesai />
                ) : jadwal.status !== 'Aktif' ? (
                  <LencanaStatus bahaya={jadwal.status === 'Dibatalkan'}>
                    {jadwal.status}
                  </LencanaStatus>
                ) : null}
              </View>
              <Text className="mt-2 text-xl font-extrabold leading-snug text-bw-ink">
                {jadwal.judul}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup detail jadwal"
              onPress={tutupDenganAnimasi}
              hitSlop={8}
              android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
              className="h-10 w-10 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
            >
              <Ikon nama="close" token="bw-ink-2" ukuran={20} />
            </Pressable>
          </View>

          {/* Isi Modal */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="px-5"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Kartu waktu */}
            {tampil ? (
              <View className="flex-row items-center gap-3 rounded-2xl bg-bw-surface p-4">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-bw-blue-50">
                  <Ikon nama="time-outline" token="bw-blue" ukuran={22} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[15px] font-bold leading-snug text-bw-ink">
                    {formatWaktuLengkap(tampil.mulai)}
                  </Text>
                  <Text className="mt-0.5 text-sm text-bw-muted">
                    {tampil.selesai
                      ? `sampai ${formatJam(tampil.selesai)}`
                      : 'tanpa waktu selesai'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Sesi-sesi */}
            {slots.length > 1 ? (
              <Blok ikon="albums-outline" label={`Seluruh sesi (${slots.length})`}>
                <View className="gap-2">
                  {slots.map((slot) => {
                    const dipilih = tampil?.mulai === slot.mulai;
                    const selesai = sesiSelesai(slot, now);
                    return (
                      <Pressable
                        key={slot.mulai}
                        onPress={() => pilihSesi(slot)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: dipilih }}
                        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                        className={`flex-row items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 active:opacity-70 ${
                          dipilih
                            ? 'border-bw-blue bg-bw-blue-50'
                            : 'border-transparent bg-bw-surface'
                        } ${selesai && !dipilih ? 'opacity-60' : ''}`}
                      >
                        <View className="min-w-0 flex-1 flex-row items-center gap-2">
                          {selesai ? (
                            <Ikon nama="checkmark-circle" token="bw-muted" ukuran={16} />
                          ) : null}
                          <Text
                            className={`text-sm font-bold ${
                              dipilih ? 'text-bw-blue-700' : 'text-bw-ink'
                            }`}
                          >
                            {formatJam(slot.mulai)}
                            {slot.selesai ? ` - ${formatJam(slot.selesai)}` : ''}
                          </Text>
                        </View>
                        <Text className="text-xs text-bw-muted">
                          {formatTanggalPendek(slot.mulai)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Blok>
            ) : null}

            {/* Keterangan */}
            <Blok ikon="document-text-outline" label="Keterangan">
              {jadwal.deskripsi ? (
                <Text className="text-[15px] leading-relaxed text-bw-ink">
                  {jadwal.deskripsi}
                </Text>
              ) : (
                <Text className="text-sm text-bw-muted">Tidak ada keterangan.</Text>
              )}
            </Blok>

            {/* Informasi Pembuat */}
            <View className="mt-6 overflow-hidden rounded-2xl border border-bw-line">
              <BarisInfo ikon="person-outline" label="Dibuat oleh">
                {jadwal.pembuat_nama} - {namaDivisi(jadwal.pembuat_divisi)}
              </BarisInfo>
              <View className="h-px bg-bw-line" />
              <BarisInfo ikon="people-outline" label="Ditujukan untuk">
                {jadwal.target_divisi
                  ? `Divisi ${namaDivisi(jadwal.target_divisi)}`
                  : 'Semua staf'}
              </BarisInfo>
            </View>
          </ScrollView>

          {/* Tombol Aksi Bottom Footer */}
          <View
            className="gap-2 border-t border-bw-line bg-bw-card px-5 pt-3 mb-3"
          >
            {adaAksiPemilik ? (
              <>
                {onIngatkan ? (
                  <TombolAksi
                    ikon="notifications-outline"
                    label="Ingatkan staf"
                    onPress={onIngatkan}
                    tone="utama"
                  />
                ) : null}
                {onUbah || onHapus ? (
                  <View className="flex-row gap-2">
                    {onUbah ? (
                      <TombolAksi
                        ikon="create-outline"
                        label="Ubah"
                        onPress={onUbah}
                        lebar="flex-1"
                      />
                    ) : null}
                    {onHapus ? (
                      <TombolAksi
                        ikon="trash-outline"
                        label="Hapus"
                        onPress={onHapus}
                        tone="bahaya"
                        lebar="flex-1"
                      />
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <TombolAksi label="Tutup" onPress={tutupDenganAnimasi} />
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function Blok({
  ikon,
  label,
  children,
}: {
  ikon: NamaIkon;
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="flex-row items-center gap-1.5">
        <Ikon nama={ikon} token="bw-muted" ukuran={14} />
        <Text className="text-xs font-bold uppercase tracking-widest text-bw-muted">
          {label}
        </Text>
      </View>
      <View className="mt-2.5">{children}</View>
    </View>
  );
}

function BarisInfo({
  ikon,
  label,
  children,
}: {
  ikon: NamaIkon;
  label: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <View className="h-9 w-9 items-center justify-center rounded-xl bg-bw-surface">
        <Ikon nama={ikon} token="bw-ink-2" ukuran={18} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-bw-muted">{label}</Text>
        <Text className="mt-0.5 text-sm font-semibold text-bw-ink">{children}</Text>
      </View>
    </View>
  );
}

const GAYA_AKSI = {
  utama: { wadah: 'bg-bw-blue', teks: 'text-white', token: 'bw-blue-50' },
  netral: {
    wadah: 'border border-bw-line bg-bw-card',
    teks: 'text-bw-ink',
    token: 'bw-ink-2',
  },
  bahaya: {
    wadah: 'border border-bw-red-100 bg-bw-red-50',
    teks: 'text-bw-red',
    token: 'bw-red',
  },
} as const satisfies Record<string, { wadah: string; teks: string; token: TokenWarna }>;

function TombolAksi({
  ikon,
  label,
  onPress,
  tone = 'netral',
  lebar = '',
}: {
  ikon?: NamaIkon;
  label: string;
  onPress: () => void;
  tone?: keyof typeof GAYA_AKSI;
  lebar?: string;
}) {
  const gaya = GAYA_AKSI[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(128,128,128,0.2)' }}
      className={`h-12 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${gaya.wadah} ${lebar}`}
    >
      {ikon ? <Ikon nama={ikon} token={gaya.token} ukuran={18} /> : null}
      <Text className={`text-[15px] font-bold ${gaya.teks}`}>{label}</Text>
    </Pressable>
  );
}