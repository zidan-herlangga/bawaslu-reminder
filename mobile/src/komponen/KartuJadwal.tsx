import { Pressable, Text, View } from 'react-native';
import { formatJam, formatSisa } from '../shared/formatWaktu';
import { namaDivisi } from '../shared/options';
import {
  jadwalSelesai,
  kelasAgenda,
  sesiSelesai,
  sortSlots,
  type Jadwal,
} from '../shared/slots';
import { useWarna, type TokenWarna } from '../tema/warna';
import { Ikon, type NamaIkon } from './Ikon';
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
// - Ubah dan Hapus berupa tombol tersendiri, bukan teks kecil dengan pemisah
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

  // Sesi yang sedang berlangsung: sesi pertama yang belum selesai.
  const berlangsung =
    !lewat && status === 'ongoing'
      ? slots.find((slot) => !sesiSelesai(slot, now))
      : undefined;

  const rentang = (mulai: string, selesai?: string | null) =>
    `${formatJam(mulai)}${selesai ? ` - ${formatJam(selesai)}` : ''}`;

  let teksWaktu = 'Waktu belum ditentukan';
  if (berikutnya) {
    teksWaktu = `${rentang(berikutnya.mulai, berikutnya.selesai)} - ${formatSisa(
      new Date(berikutnya.mulai).getTime(),
      now
    )}`;
  } else if (berlangsung) {
    teksWaktu = rentang(berlangsung.mulai, berlangsung.selesai);
  } else if (lewat && (slots[0]?.mulai ?? jadwal.waktu_mulai)) {
    teksWaktu = rentang(
      (slots[0]?.mulai ?? jadwal.waktu_mulai) as string,
      slots[0]?.selesai
    );
  }

  return (
    <View
      className={`overflow-hidden rounded-[28px] border border-bw-line bg-bw-card shadow-card ${
        lewat ? 'opacity-70' : ''
      }`}
    >
      <View
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: warna(gaya.aksen) }}
      />

      <Pressable
        onPress={onDetail}
        accessibilityRole="button"
        accessibilityLabel={`Lihat detail ${jadwal.judul}`}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        className="py-4 pl-6 pr-4 active:opacity-80"
      >
        <View className="flex-row items-start gap-3">
          <View
            className={`h-11 w-11 items-center justify-center rounded-2xl border ${gaya.lencana}`}
          >
            <Ikon nama={gaya.ikon} token={gaya.aksen} ukuran={20} />
          </View>

          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Lencana className={gaya.lencana}>{jadwal.kategori}</Lencana>
              {lewat ? <LencanaSelesai /> : null}
              {berlangsung || (!lewat && status === 'ongoing') ? (
                <Lencana className="border-bw-green-200 bg-bw-green-50">
                  <Text className="text-bw-green-700">Sedang berlangsung</Text>
                </Lencana>
              ) : null}
            </View>

            <Text className="mt-1.5 text-[17px] font-extrabold leading-snug text-bw-ink">
              {jadwal.judul}
            </Text>
          </View>
        </View>

        {/* Waktu */}
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          <View
            className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 ${
              lewat ? 'bg-bw-surface' : 'bg-bw-blue-50'
            }`}
          >
            <Ikon
              nama="time-outline"
              token={lewat ? 'bw-muted' : 'bw-blue'}
              ukuran={14}
            />
            <Text
              className={`text-xs font-bold ${
                lewat ? 'text-bw-muted' : 'text-bw-blue-700'
              }`}
            >
              {teksWaktu}
            </Text>
          </View>

          {slots.length > 1 ? (
            <View className="rounded-full bg-bw-surface px-2.5 py-1.5">
              <Text className="text-xs font-bold text-bw-ink-2">
                {slots.length} sesi
              </Text>
            </View>
          ) : null}
        </View>

        {jadwal.deskripsi ? (
          <Text
            numberOfLines={2}
            className="mt-3 text-[13px] leading-relaxed text-bw-muted"
          >
            {jadwal.deskripsi}
          </Text>
        ) : null}

        <View className="mt-3 flex-row flex-wrap gap-1.5">
          <Lencana className="border-bw-line bg-bw-surface">
            <Text className="text-bw-muted">
              {jadwal.target_divisi ? namaDivisi(jadwal.target_divisi) : 'Semua staf'}
            </Text>
          </Lencana>
        </View>
      </Pressable>

      {milikSaya ? (
        <View className="flex-row items-center gap-2 border-t border-bw-line bg-bw-surface px-4 py-3 pl-6">
          <TombolKartu
            ikon="notifications-outline"
            label="Ingatkan"
            judul={jadwal.judul}
            onPress={onIngatkan}
            tone="utama"
          />
          <TombolKartu
            ikon="create-outline"
            label="Ubah"
            judul={jadwal.judul}
            onPress={onUbah}
          />
          <TombolKartu
            ikon="trash-outline"
            label="Hapus"
            judul={jadwal.judul}
            onPress={onHapus}
            tone="bahaya"
          />
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-2 border-t border-bw-line px-4 py-3 pl-6">
        <View className="min-w-0 flex-1 flex-row items-center gap-2">
          <View className="h-6 w-6 items-center justify-center rounded-full bg-bw-surface">
            <Ikon nama="person-outline" token="bw-muted" ukuran={13} />
          </View>
          <Text numberOfLines={1} className="min-w-0 flex-1 text-xs text-bw-muted">
            {jadwal.pembuat_nama} - {namaDivisi(jadwal.pembuat_divisi)}
          </Text>
        </View>
        {!milikSaya ? (
          <View className="flex-row items-center gap-1">
            <Ikon nama="lock-closed" token="bw-muted" ukuran={11} />
            <Text className="text-xs text-bw-muted">Hanya pembuat</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const GAYA_TOMBOL = {
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

function TombolKartu({
  ikon,
  label,
  judul,
  onPress,
  tone = 'netral',
}: {
  ikon: NamaIkon;
  label: string;
  judul: string;
  onPress: () => void;
  tone?: keyof typeof GAYA_TOMBOL;
}) {
  const gaya = GAYA_TOMBOL[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${judul}`}
      onPress={onPress}
      android_ripple={{ color: 'rgba(128,128,128,0.2)' }}
      className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl active:opacity-80 ${gaya.wadah}`}
    >
      <Ikon nama={ikon} token={gaya.token} ukuran={16} />
      <Text className={`text-[13px] font-bold ${gaya.teks}`}>{label}</Text>
    </Pressable>
  );
}