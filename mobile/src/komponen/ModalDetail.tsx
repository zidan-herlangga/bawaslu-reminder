import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatJam, formatTanggalPendek, formatWaktuLengkap } from '../shared/formatWaktu';
import { namaDivisi } from '../shared/options';
import { sesiSelesai, sortSlots, type Jadwal, type Slot } from '../shared/slots';
import type { TokenWarna } from '../tema/warna';
import { Ikon, type NamaIkon } from './Ikon';
import { Lencana, LencanaSelesai, LencanaStatus } from './Lencana';
import { gayaKategori } from './gaya';

// Modal detail jadwal.
//
// Di web rincian ini melebar di dalam kartu. Di layar HP itu tidak baik: kartu
// yang melebar membuat posisi isi di halaman terus bergeser, dan yang tampil
// pertama tetap tombol, bukan keterangan. Modal memberi ruang baca sendiri
// tanpa mengubah tinggi halaman di belakang.
//
// Sesi yang sedang dibuka ditandai, supaya tidak tertukar dengan sesi lain di
// hari yang sama. Memilih sesi lain mengubah tampilan di modal ini sendiri,
// jadi pemanggil tidak wajib menyediakan onPilihSesi.
//
// Footer memakai inset bawah perangkat supaya tombol tidak mepet atau tertutup
// tombol navigasi Android.

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

  // Pilihan lokal dibuang tiap kali modal dibuka untuk jadwal atau sesi lain.
  useEffect(() => {
    setPilihan(null);
  }, [jadwal?.id, sesi?.mulai, terbuka]);

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
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onTutup}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable
          accessible={false}
          className="flex-1"
          onPress={onTutup}
        />

        <View className="max-h-[88%] rounded-t-[32px] border border-bw-line bg-bw-card">
          {/* Pegangan */}
          <View className="items-center pt-2.5">
            <View className="h-1.5 w-10 rounded-full bg-bw-line" />
          </View>

          {/* Kepala */}
          <View className="flex-row items-start gap-3 px-5 pb-4 pt-3">
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
              onPress={onTutup}
              android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
              className="h-11 w-11 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
            >
              <Ikon nama="close" token="bw-ink-2" ukuran={20} />
            </Pressable>
          </View>

          <View className="h-px bg-bw-line" />

          <ScrollView
            showsVerticalScrollIndicator={false}
            className="px-5"
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 20 }}
          >
            {tampil ? (
              <Blok ikon="time-outline" label="Waktu">
                <Text className="text-[15px] font-bold text-bw-ink">
                  {formatWaktuLengkap(tampil.mulai)}
                </Text>
                <Text className="mt-0.5 text-sm text-bw-muted">
                  {tampil.selesai
                    ? `sampai ${formatJam(tampil.selesai)}`
                    : 'tanpa waktu selesai'}
                </Text>
              </Blok>
            ) : null}

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

            <Blok ikon="document-text-outline" label="Keterangan">
              {jadwal.deskripsi ? (
                <Text className="text-sm leading-relaxed text-bw-ink">
                  {jadwal.deskripsi}
                </Text>
              ) : (
                <Text className="text-sm text-bw-muted">Tidak ada keterangan.</Text>
              )}
            </Blok>

            <Blok ikon="person-outline" label="Dibuat oleh">
              <Text className="text-sm text-bw-ink">
                {jadwal.pembuat_nama} · {namaDivisi(jadwal.pembuat_divisi)}
              </Text>
            </Blok>

            <Blok ikon="people-outline" label="Ditujukan untuk">
              <Text className="text-sm text-bw-ink">
                {jadwal.target_divisi
                  ? `Divisi ${namaDivisi(jadwal.target_divisi)}`
                  : 'Semua staf'}
              </Text>
            </Blok>
          </ScrollView>

          {/* Aksi */}
          <View
            className="gap-2 border-t border-bw-line bg-bw-surface px-5 pt-3"
            style={{ paddingBottom: Math.max(insets.bottom, 12) }}
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
              <TombolAksi label="Tutup" onPress={onTutup} />
            )}
          </View>
        </View>
      </View>
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
  children: React.ReactNode;
}) {
  return (
    <View className="mt-5">
      <View className="flex-row items-center gap-1.5">
        <Ikon nama={ikon} token="bw-muted" ukuran={14} />
        <Text className="text-xs font-bold uppercase tracking-widest text-bw-muted">
          {label}
        </Text>
      </View>
      <View className="mt-2">{children}</View>
    </View>
  );
}

// Peta statis, bukan kelas yang dirangkai: NativeWind membaca kelas saat build.
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
      className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${gaya.wadah} ${lebar}`}
    >
      {ikon ? <Ikon nama={ikon} token={gaya.token} ukuran={18} /> : null}
      <Text className={`text-base font-bold ${gaya.teks}`}>{label}</Text>
    </Pressable>
  );
}