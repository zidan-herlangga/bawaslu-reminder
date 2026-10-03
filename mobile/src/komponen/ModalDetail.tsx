import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { formatJam, formatTanggalPendek, formatWaktuLengkap } from '../shared/formatWaktu';
import { namaDivisi } from '../shared/options';
import { sesiSelesai, sortSlots, type Jadwal, type Slot } from '../shared/slots';
import { Ikon } from './Ikon';
import { Lencana, LencanaSelesai, LencanaStatus } from './Lencana';
import { TombolDialog } from './DialogKonfirmasi';
import { gayaKategori } from './gaya';

// Modal detail jadwal.
//
// Di web rincian ini melebar di dalam kartu. Di layar HP itu tidak baik: kartu
// yang melebar membuat posisi isi di halaman terus bergeser, dan yang tampil
// pertama tetap tombol, bukan keterangan. Modal memberi ruang baca sendiri
// tanpa mengubah tinggi halaman di belakang.
//
// Sesi yang sedang dibuka ditandai, supaya tidak tertukar dengan sesi lain di
// hari yang sama.

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
  if (!jadwal) return null;

  const gaya = gayaKategori(jadwal.kategori);
  const slots = sortSlots(
    Array.isArray(jadwal.slots) && jadwal.slots.length > 0
      ? jadwal.slots
      : jadwal.waktu_mulai
        ? [{ mulai: jadwal.waktu_mulai, selesai: jadwal.waktu_selesai }]
        : []
  );

  const tampil = sesi ?? slots[0] ?? null;
  const lewat = tampil ? sesiSelesai(tampil, now) : false;

  return (
    <Modal
      visible={terbuka}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onTutup}
    >
      <View className="flex-1 justify-end bg-bw-ink/45">
        <Pressable className="flex-1" onPress={onTutup} />

        <View className="max-h-[88%] rounded-t-3xl border border-bw-line bg-bw-card">
          <View className="flex-row items-start gap-3 border-b border-bw-line px-5 py-4">
            <View className="min-w-0 flex-1">
              <View className="flex-row flex-wrap gap-1.5">
                <Lencana className={gaya.lencana}>{jadwal.kategori}</Lencana>
                {lewat ? (
                  <LencanaSelesai />
                ) : jadwal.status !== 'Aktif' ? (
                  <LencanaStatus>{jadwal.status}</LencanaStatus>
                ) : null}
              </View>
              <Text className="mt-2 text-lg font-bold leading-snug text-bw-ink">
                {jadwal.judul}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup detail jadwal"
              onPress={onTutup}
              className="h-12 w-12 items-center justify-center rounded-full active:bg-bw-surface"
            >
              <Ikon nama="close" token="bw-muted" ukuran={22} />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 20 }}>
            {tampil ? (
              <Blok label="Waktu">
                <Text className="font-semibold text-bw-ink">
                  {formatWaktuLengkap(tampil.mulai)}
                </Text>
                <Text className="mt-0.5 text-bw-muted">
                  {tampil.selesai
                    ? `sampai ${formatJam(tampil.selesai)}`
                    : 'tanpa waktu selesai'}
                </Text>
              </Blok>
            ) : null}

            {slots.length > 1 ? (
              <Blok label={`Seluruh sesi (${slots.length})`}>
                <View className="gap-1.5">
                  {slots.map((slot) => {
                    const dipilih = tampil?.mulai === slot.mulai;
                    return (
                      <Pressable
                        key={slot.mulai}
                        onPress={() => onPilihSesi?.(slot)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: dipilih }}
                        className={`flex-row items-baseline justify-between gap-3 rounded-xl border px-3 py-3 ${
                          dipilih
                            ? 'border-bw-blue-200 bg-bw-blue-50'
                            : 'border-bw-line bg-bw-surface'
                        }`}
                      >
                        <Text className="font-semibold text-bw-ink">
                          {formatJam(slot.mulai)}
                          {slot.selesai ? ` - ${formatJam(slot.selesai)}` : ''}
                        </Text>
                        <Text className="text-xs text-bw-muted">
                          {formatTanggalPendek(slot.mulai)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Blok>
            ) : null}

            <Blok label="Keterangan">
              {jadwal.deskripsi ? (
                <Text className="text-bw-ink">{jadwal.deskripsi}</Text>
              ) : (
                <Text className="text-bw-muted">Tidak ada keterangan.</Text>
              )}
            </Blok>

            <Blok label="Dibuat oleh">
              <Text className="text-bw-ink">
                {jadwal.pembuat_nama} - {namaDivisi(jadwal.pembuat_divisi)}
              </Text>
            </Blok>

            <Blok label="Ditujukan untuk">
              <Text className="text-bw-ink">
                {jadwal.target_divisi
                  ? `Divisi ${namaDivisi(jadwal.target_divisi)}`
                  : 'Semua staf'}
              </Text>
            </Blok>
          </ScrollView>

          <View className="flex-row flex-wrap gap-2 border-t border-bw-line bg-bw-surface/70 px-5 py-3">
            {milikSaya && onIngatkan ? (
              <TombolDialog
                label="Ingatkan"
                onPress={onIngatkan}
                className="flex-1 bg-bw-blue"
                tokenTeks="bw-ink"
              />
            ) : null}
            {milikSaya && onUbah ? (
              <TombolDialog label="Ubah" onPress={onUbah} className="flex-1 bg-bw-card" />
            ) : null}
            {milikSaya && onHapus ? (
              <TombolDialog
                label="Hapus"
                onPress={onHapus}
                className="flex-1 bg-bw-red-50"
              />
            ) : null}
            <TombolDialog label="Tutup" onPress={onTutup} className="flex-1 bg-bw-card" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Blok({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-4">
      <Text className="text-xs font-bold uppercase tracking-wide text-bw-muted">
        {label}
      </Text>
      <View className="mt-1 text-sm leading-relaxed">{children}</View>
    </View>
  );
}
