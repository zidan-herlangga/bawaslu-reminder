import { Text, View } from 'react-native';
import { Ikon, type NamaIkon } from './Ikon';

// Lencana kecil untuk kategori, status, dan penanda selesai.
//
// Lencana "Selesai" memakai centang, bukan teks saja. Di daftar yang panjang,
// bentuk centang lebih cepat dibaca daripada kata yang sama berulang, dan
// centang jelas berarti "sudah lewat" tanpa perlu membaca.
//
// Warna teks diatur lewat prop `teks` (class statis, mis. gaya.teks dari
// gaya.ts). Tanpa warna eksplisit, teks memakai warna bawaan sistem dan tidak
// terbaca di mode gelap. Teks anak (<Text className="...">) tetap boleh
// menimpa warna ini.

export function Lencana({
  children,
  className = '',
  teks = 'text-bw-ink-2',
}: {
  children: React.ReactNode;
  className?: string;
  /** Class warna teks, mis. 'text-bw-blue-700'. */
  teks?: string;
}) {
  return (
    <View
      className={`self-start rounded-full border px-2.5 py-1 ${className}`}
    >
      <Text className={`text-xs font-bold ${teks}`}>{children}</Text>
    </View>
  );
}

export function LencanaSelesai() {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full border border-bw-line bg-bw-surface px-2.5 py-1">
      <Ikon nama="checkmark-circle" token="bw-muted" ukuran={14} />
      <Text className="text-xs font-bold text-bw-muted">Selesai</Text>
    </View>
  );
}

/** Lencana untuk status manual dari database: Selesai atau Dibatalkan. */
export function LencanaStatus({
  children,
  bahaya = false,
  ikon,
}: {
  children: React.ReactNode;
  /** true untuk status negatif seperti Dibatalkan (merah). */
  bahaya?: boolean;
  ikon?: NamaIkon;
}) {
  return (
    <View
      className={`flex-row items-center gap-1 self-start rounded-full border px-2.5 py-1 ${
        bahaya
          ? 'border-bw-red-100 bg-bw-red-50'
          : 'border-bw-line bg-bw-surface'
      }`}
    >
      {ikon ? (
        <Ikon nama={ikon} token={bahaya ? 'bw-red' : 'bw-muted'} ukuran={14} />
      ) : null}
      <Text
        className={`text-xs font-bold ${
          bahaya ? 'text-bw-red' : 'text-bw-muted'
        }`}
      >
        {children}
      </Text>
    </View>
  );
}