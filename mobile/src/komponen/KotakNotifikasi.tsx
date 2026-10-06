import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Ikon, type NamaIkon } from './Ikon';
import type { Notifikasi } from '../shared/kotakNotifikasi';
import { formatWaktuLengkap } from '../shared/formatWaktu';
import type { TokenWarna } from '../tema/warna';

// Kotak masuk notifikasi.
//
// Port dari panel notifikasi di src/components/AppShell.jsx. Perbedaannya hanya
// pada wadah: web memakai panel yang mengambang di bawah tombol lonceng, karena
// tidak ada tempat di bawah itu. Di layar sempit, panel setinggi hampir seluruh
// layar justru menutupi isi yang seharusnya masih terlihat di atasnya.
// Di sini jadi bottom sheet: muncul dari bawah, menutupi separuh layar, dan
// bagian atasnya tetap kelihatan sebagai konteks.
//
// Keputusan soal interaksi:
// - Ketuk satu baris untuk menandai sudah dibaca dan membuka jadwalnya, kalau
//   baris itu memang punya jadwal. Dua hal dalam satu ketukan terasa wajar
//   di layar sentuh; di web tidak begitu karena hover sudah memberi komentar
// - Baris tanpa jadwal tetap bisa diketuk untuk ditandai sudah dibaca, karena
//   minimal itu membuat badge berkurang

/** Ikon per kategori, supaya staf bisa mengenali notifikasi tanpa membaca. */
const IKON_KATEGORI: Record<string, { ikon: NamaIkon; token: TokenWarna }> = {
  Rapat: { ikon: 'people', token: 'bw-blue' },
  Tugas: { ikon: 'checkbox', token: 'bw-green-500' },
  Pengawasan: { ikon: 'shield-checkmark', token: 'bw-amber-800' },
  Lainnya: { ikon: 'notifications', token: 'bw-ink-2' },
};

const gayaKategori = (kategori: string | null) => {
  const gaya = IKON_KATEGORI[kategori ?? ''] ?? IKON_KATEGORI.Lainnya;
  // noUncheckedIndexedAccess menganggap akses larik bisa undefined. Di sini
  // kuncinya sudah dipastikan salah satu kunci statis di atas, jadi pengaman
  // hanya untuk memuaskan tipe, bukan untuk menutup kasus nyata.
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
  onCobaLagi,
}: KotakNotifikasiProps) {
  return (
    <Modal
      visible={terbuka}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onTutup}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable accessible={false} className="flex-1" onPress={onTutup} />

        <View className="max-h-[88%] rounded-t-[32px] border border-bw-line bg-bw-card">
          {/* Pegangan */}
          <View className="items-center pt-2.5">
            <View className="h-1.5 w-10 rounded-full bg-bw-line" />
          </View>

          {/* Kepala */}
          <View className="flex-row items-center gap-3 px-5 pb-3 pt-3">
            <View className="min-w-0 flex-1">
              <Text className="text-xl font-extrabold tracking-tight text-bw-ink">
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
                className="rounded-full bg-bw-blue-50 px-3 py-2 active:opacity-70"
              >
                <Text className="text-xs font-bold text-bw-blue">Tandai semua</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Galat ditampilkan apa adanya, lalu diberi jalan keluar. Pola yang sama
              dipakai layar Jadwal dan Tugas, supaya galat di aplikasi ini selalu
              kelihatan dengan cara yang sama. */}
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
            <FlatList
              data={notifikasi}
              keyExtractor={(item) => item.id}
              className="grow-0"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
              ItemSeparatorComponent={() => (
                <View className="h-px bg-bw-line" />
              )}
              renderItem={({ item }) => {
                const gaya = gayaKategori(item.kategori);

                return (
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
                    className="flex-row gap-3 py-3.5 active:opacity-60"
                  >
                    {/* Titik belum dibaca */}
                    <View className="w-2.5 items-center pt-1.5">
                      <View
                        className={`h-2 w-2 rounded-full ${
                          item.dibaca ? 'bg-transparent' : 'bg-bw-blue'
                        }`}
                      />
                    </View>

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

                    <View className="min-w-0 flex-1">
                      <Text
                        numberOfLines={2}
                        className={
                          item.dibaca
                            ? 'text-sm leading-snug text-bw-muted'
                            : 'text-sm font-bold leading-snug text-bw-ink'
                        }
                      >
                        {item.judul}
                      </Text>

                      {item.pesan ? (
                        <Text
                          numberOfLines={2}
                          className="mt-0.5 text-xs leading-relaxed text-bw-muted"
                        >
                          {item.pesan}
                        </Text>
                      ) : null}

                      {item.dibuatPada ? (
                        <Text className="mt-1 text-[11px] text-bw-muted">
                          {formatWaktuLengkap(item.dibuatPada)}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}