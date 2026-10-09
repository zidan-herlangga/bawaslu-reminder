import React from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ikon, type NamaIkon } from './Ikon';
import type { Notifikasi } from '../shared/kotakNotifikasi';
import { formatWaktuLengkap } from '../shared/formatWaktu';
import type { TokenWarna } from '../tema/warna';
import { useGesekTutup } from '../lib/useGesekTutup';

/** Ikon per kategori untuk identifikasi visual cepat */
const IKON_KATEGORI: Record<string, { ikon: NamaIkon; token: TokenWarna }> = {
  Rapat: { ikon: 'people', token: 'bw-blue' },
  Tugas: { ikon: 'checkbox', token: 'bw-green-500' },
  Pengawasan: { ikon: 'shield-checkmark', token: 'bw-amber-800' },
  Lainnya: { ikon: 'notifications', token: 'bw-ink-2' },
};

const gayaKategori = (kategori: string | null) => {
  const gaya = IKON_KATEGORI[kategori ?? ''] ?? IKON_KATEGORI.Lainnya;
  return gaya ?? { ikon: 'notifications', token: 'bw-ink-2' as TokenWarna };
};

export interface KotakNotifikasiProps {
  terbuka: boolean;
  notifikasi: readonly Notifikasi[];
  belumDibaca: number;
  memuat: boolean;
  galat: string;
  onTutup: () => void;
  onBukaJadwal: (jadwalId: string) => void;
  onTandaiDibaca: (id: string) => void;
  onTandaiSemuaDibaca: () => void;
  onHapusSemua: () => void;
  onHapus: (id: string) => void;
  onCobaLagi: () => void;
}

export function KotakNotifikasi({
  terbuka,
  notifikasi,
  belumDibaca,
  memuat,
  galat,
  onTutup,
  onBukaJadwal,
  onTandaiDibaca,
  onTandaiSemuaDibaca,
  onHapusSemua,
  onHapus,
  onCobaLagi,
}: KotakNotifikasiProps) {
  const insets = useSafeAreaInsets();
  
  // Menggunakan custom hook gesek berbasis Reanimated & Gesture Handler
  const { panGesture, gayaKartu, gayaBackdrop, tutupDenganAnimasi } = useGesekTutup(
    terbuka,
    onTutup
  );

  return (
    <Modal
      visible={terbuka}
      animationType="none" // None agar tidak bentrok dengan Reanimated
      transparent
      statusBarTranslucent
      onRequestClose={tutupDenganAnimasi}
    >
      <Animated.View className="flex-1 justify-end" style={gayaBackdrop}>
        {/* area luar sheet untuk menutup modal saat diketuk */}
        <Pressable accessible={false} className="flex-1" onPress={tutupDenganAnimasi} />

        {/* Sheet container yang dapat digesek */}
        <Animated.View
          className="max-h-[88%] rounded-t-[32px] border border-b-0 border-bw-line bg-bw-card shadow-2xl"
          style={gayaKartu}
        >
          {/* Handlebar sebagai area utama pemicu gesek */}
          <GestureDetector gesture={panGesture}>
            <View className="items-center pb-2 pt-3 w-full">
              <View className="h-1.5 w-12 rounded-full bg-bw-line/80" />
            </View>
          </GestureDetector>

          {/* Kepala Sheet */}
          <View className="flex-row items-center gap-3 px-5 pb-3 pt-1">
            <View className="min-w-0 flex-1">
              <Text className="text-md font-extrabold tracking-tight text-bw-ink">
                Notifikasi
              </Text>
              <Text className="mt-0.5 text-xs text-bw-muted">
                {belumDibaca > 0
                  ? `${belumDibaca} belum dibaca`
                  : 'Semua sudah dibaca'}
              </Text>
            </View>

            {belumDibaca > 0 ? (
              <Pressable
                onPress={onTandaiSemuaDibaca}
                accessibilityRole="button"
                accessibilityLabel="Tandai semua sudah dibaca"
                android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
                className="rounded-full bg-bw-blue-50 px-3 py-2 active:opacity-70"
              >
                <Text className="text-xs font-bold text-bw-blue">Tandai semua</Text>
              </Pressable>
            ) : null}

            {notifikasi.length > 0 ? (
              <Pressable
                onPress={onHapusSemua}
                accessibilityRole="button"
                accessibilityLabel="Hapus semua notifikasi"
                accessibilityHint="Menghapus seluruh notifikasi secara permanen"
                android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
                className="flex-row items-center gap-1 rounded-full bg-bw-red-50 px-3 py-2 active:opacity-70"
              >
                <Ikon nama="trash-outline" token="bw-red" ukuran={14} />
                <Text className="text-xs font-bold text-bw-red">Hapus semua</Text>
              </Pressable>
            ) : null}

            {/* Tombol Tutup Khusus */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup notifikasi"
              onPress={tutupDenganAnimasi}
              hitSlop={8}
              android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
              className="h-9 w-9 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
            >
              <Ikon nama="close" token="bw-ink-2" ukuran={18} />
            </Pressable>
          </View>

          {/* Alert Galat */}
          {galat ? (
            <View
              accessibilityRole="alert"
              className="mx-5 mb-3 rounded-2xl border border-bw-red-100 bg-bw-red-50 p-3.5"
            >
              <View className="flex-row items-start gap-2">
                <Ikon nama="alert-circle-outline" token="bw-red" ukuran={18} />
                <Text className="flex-1 text-xs leading-relaxed text-bw-red">
                  {galat}
                </Text>
              </View>

              <Pressable
                onPress={onCobaLagi}
                accessibilityRole="button"
                accessibilityLabel="Coba lagi memuat notifikasi"
                className="mt-2.5 self-start rounded-full bg-bw-red px-3 py-1.5 active:opacity-70"
              >
                <Text className="text-xs font-bold text-white">Coba lagi</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Loading & Empty State */}
          {memuat && notifikasi.length === 0 ? (
            <View className="items-center px-5 py-14">
              <Text className="text-sm text-bw-muted">Memuat notifikasi...</Text>
            </View>
          ) : notifikasi.length === 0 ? (
            <View className="items-center px-5 py-14">
              <View className="h-14 w-14 items-center justify-center rounded-full bg-bw-blue-50">
                <Ikon nama="notifications-outline" token="bw-blue" ukuran={26} />
              </View>
              <Text className="mt-4 text-center text-base font-bold text-bw-ink">
                Belum ada notifikasi
              </Text>
              <Text className="mt-1.5 text-center text-sm leading-relaxed text-bw-muted">
                Pengingat muncul di sini setelah ada yang menekan tombol Ingatkan
                pada sebuah jadwal.
              </Text>
            </View>
          ) : (
            /* Daftar Notifikasi */
            <FlatList
              data={notifikasi}
              keyExtractor={(item) => item.id}
              className="grow-0"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 24),
              }}
              ItemSeparatorComponent={() => (
                <View className="h-px bg-bw-line" />
              )}
              renderItem={({ item }) => {
                const gaya = gayaKategori(item.kategori);

                return (
                  <View className="flex-row items-stretch">
                    <Pressable
                      onPress={() => {
                        onTandaiDibaca(item.id);
                        if (item.jadwalId) onBukaJadwal(item.jadwalId);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        item.dibaca ? item.judul : `${item.judul}, belum dibaca`
                      }
                      accessibilityHint={
                        item.jadwalId ? 'Buka jadwalnya' : 'Tandai sudah dibaca'
                      }
                      android_ripple={{ color: 'rgba(0,0,0,0.04)' }}
                      className="min-w-0 flex-1 flex-row gap-3 py-3.5 pr-1 active:opacity-60"
                    >
                      {/* Status Belum Dibaca */}
                      <View className="w-2.5 items-center pt-1.5">
                        <View
                          className={`h-2 w-2 rounded-full ${
                            item.dibaca ? 'bg-transparent' : 'bg-bw-blue'
                          }`}
                        />
                      </View>

                      {/* Ikon Kategori */}
                      <View
                        className={`h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          item.dibaca ? 'bg-bw-surface' : 'bg-bw-blue-50'
                        }`}
                      >
                        <Ikon
                          nama={gaya.ikon}
                          token={item.dibaca ? 'bw-muted' : gaya.token}
                          ukuran={19}
                        />
                      </View>

                      {/* Konten Teks */}
                      <View className="min-w-0 flex-1">
                        <Text
                          className={`text-sm leading-tight text-bw-ink ${
                            item.dibaca ? 'font-normal text-bw-muted' : 'font-semibold'
                          }`}
                          numberOfLines={2}
                        >
                          {item.judul}
                        </Text>
                        <Text className="mt-1 text-xs text-bw-muted">
                          {formatWaktuLengkap(item.dibuatPada)}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Hapus notifikasi */}
                    <Pressable
                      onPress={() => onHapus(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Hapus notifikasi: ${item.judul}`}
                      accessibilityHint="Menghapus notifikasi ini secara permanen"
                      hitSlop={6}
                      android_ripple={{ color: 'rgba(0,0,0,0.05)', borderless: true }}
                      className="w-9 shrink-0 items-center justify-center active:opacity-70"
                    >
                      <Ikon nama="trash-outline" token="bw-muted" ukuran={17} />
                    </Pressable>
                  </View>
                );
              }}
            />
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}