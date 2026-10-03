import { Pressable, Text, View } from 'react-native';
import { formatJam, formatSisa } from '../shared/formatWaktu';
import { namaDivisi } from '../shared/options';
import {
  jadwalSelesai,
  kelasAgenda,
  sortSlots,
  type Jadwal,
} from '../shared/slots';
import { useWarna } from '../tema/warna';
import { Ikon } from './Ikon';
import { Lencana, LencanaSelesai } from './Lencana';
import { gayaKategori } from './gaya';

// Kartu jadwal untuk daftar di Beranda.
//
// Urutan dan aturan "waktu sudah lewat" datang dari shared/slots, sama dengan
// web. Jadi kartu ini tidak pernah memutuskan sendiri apakah sebuah jadwal
// sudah lewat; itu keputusan satu tempat supaya tidak berbeda antar layar.
//
// Tiga hal yang dipertahankan dari versi web karena alasan kegunaan:
// - Target sentuh semua tombol minimal 48px, bukan 32px
// - Edit dan Hapus berupa tombol tersendiri, bukan teks kecil dengan pemisah
//   slash. Salah tekan di sini menghapus jadwal orang lain
// - Jadwal yang sudah lewat diberi lencana Selesai dan diredupkan, bukan
//   disembunyikan, karena masih perlu dibaca: hari ini berlangsung apa

export function KartuJadwal({
  jadwal,
  now,
  milikSaya,
  onDetail,
  onIngatkan,
  onUbah,
  onHapus,
}: {
  jadwal: Jadwal;
  now: number;
  milikSaya: boolean;
  onDetail: () => void;
  onIngatkan: () => void;
  onUbah: () => void;
  onHapus: () => void;
}) {
  const gaya = gayaKategori(jadwal.kategori);
  const { warna } = useWarna();
  const lewat = jadwalSelesai(jadwal, now);
  const status = kelasAgenda(jadwal, now);

  const slots = sortSlots(
    Array.isArray(jadwal.slots) && jadwal.slots.length > 0
      ? jadwal.slots
      : jadwal.waktu_mulai
        ? [{ mulai: jadwal.waktu_mulai, selesai: jadwal.waktu_selesai }]
        : []
  );

  const berikutnya =
    status === 'upcoming'
      ? slots.find((slot) => new Date(slot.mulai).getTime() > now)
      : undefined;

  return (
    <View
      className={`overflow-hidden rounded-3xl border border-bw-line bg-bw-card shadow-card ${
        lewat ? 'opacity-70' : ''
      }`}
    >
      <View
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: warna(gaya.aksen) }}
      />

      <Pressable
        onPress={onDetail}
        accessibilityRole="button"
        accessibilityLabel={`Lihat detail ${jadwal.judul}`}
        className="pl-5 pr-4 py-4 active:opacity-80"
      >
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Lencana className={gaya.lencana}>{jadwal.kategori}</Lencana>
          {lewat ? <LencanaSelesai /> : null}
          {!lewat && status === 'ongoing' ? (
            <Lencana className="border-bw-green-200 bg-bw-green-50">
              <Text className="text-bw-green-700">Sedang berlangsung</Text>
            </Lencana>
          ) : null}
        </View>

        <Text className="mt-2 text-base font-bold leading-snug text-bw-ink">
          {jadwal.judul}
        </Text>

        <Text
          className={`mt-1 text-sm font-semibold ${
            lewat ? 'text-bw-muted' : 'text-bw-blue'
          }`}
        >
          {berikutnya
            ? `${formatJam(berikutnya.mulai)}${berikutnya.selesai ? ` - ${formatJam(berikutnya.selesai)}` : ''} - ${formatSisa(new Date(berikutnya.mulai).getTime(), now)}`
            : lewat
              ? `${formatJam(slots[0]?.mulai ?? jadwal.waktu_mulai)}${slots[0]?.selesai ? ` - ${formatJam(slots[0].selesai)}` : ''}`
              : 'Waktu belum ditentukan'}
        </Text>

        {slots.length > 1 && (
          <Text className="mt-1 text-xs text-bw-muted">
            {slots.length} sesi
          </Text>
        )}

        {jadwal.deskripsi ? (
          <Text
            numberOfLines={2}
            className="mt-1.5 text-xs leading-relaxed text-bw-muted"
          >
            {jadwal.deskripsi}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-1.5">
          {jadwal.target_divisi ? (
            <Lencana className="border-bw-line bg-bw-surface">
              <Text className="text-bw-muted">
                {namaDivisi(jadwal.target_divisi)}
              </Text>
            </Lencana>
          ) : (
            <Lencana className="border-bw-line bg-bw-surface">
              <Text className="text-bw-muted">Semua staf</Text>
            </Lencana>
          )}
        </View>
      </Pressable>

      {milikSaya && (
        <View className="flex-row flex-wrap items-center gap-2 border-t border-bw-line bg-bw-surface/70 px-4 py-2.5 pl-5">
          <TombolKartu label="Ingatkan" onPress={onIngatkan} tone="utama" />
          <TombolKartu label="Ubah" onPress={onUbah} />
          <TombolKartu label="Hapus" onPress={onHapus} tone="bahaya" />
        </View>
      )}

      <View className="flex-row items-center justify-between border-t border-bw-line px-4 py-2.5 pl-5">
        <Text className="min-w-0 flex-1 text-xs text-bw-muted">
          {jadwal.pembuat_nama} - {namaDivisi(jadwal.pembuat_divisi)}
        </Text>
        {!milikSaya && (
          <View className="flex-row items-center gap-1">
            <Ikon nama="lock-closed" token="bw-muted" ukuran={11} />
            <Text className="text-xs text-bw-muted">Pengingat oleh dia</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function TombolKartu({
  label,
  onPress,
  tone = 'netral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'utama' | 'netral' | 'bahaya';
}) {
  const gaya = {
    utama: 'bg-bw-blue',
    netral: 'border border-bw-line bg-bw-card',
    bahaya: 'border border-bw-red-100 bg-bw-red-50',
  }[tone];

  const warnaTeks = {
    utama: 'text-white',
    netral: 'text-bw-ink',
    bahaya: 'text-bw-red',
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`h-12 items-center justify-center rounded-xl px-4 active:opacity-80 ${gaya}`}
    >
      <Text className={`text-sm font-bold ${warnaTeks}`}>{label}</Text>
    </Pressable>
  );
}
