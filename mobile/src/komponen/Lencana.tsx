import { Text, View } from 'react-native';
import { Ikon } from './Ikon';

// Lencana kecil untuk kategori, status, dan penanda selesai.
//
// Lencana "Selesai" memakai centang, bukan teks saja. Di daftar yang panjang,
// bentuk centang lebih cepat dibaca daripada kata yang sama berulang, dan
// centang jelas berarti "sudah lewat" tanpa perlu membaca.

export function Lencana({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <View className={`self-start rounded-full border px-2.5 py-1 ${className}`}>
      <Text className="text-xs font-bold">{children}</Text>
    </View>
  );
}

export function LencanaSelesai() {
  return (
    <View className="flex-row items-center gap-1 self-start rounded-full bg-bw-surface px-2.5 py-1">
      <Ikon nama="checkmark" token="bw-muted" ukuran={14} />
      <Text className="text-xs font-bold text-bw-muted">Selesai</Text>
    </View>
  );
}

/** Lencana untuk status manual dari database: Selesai atau Dibatalkan. */
export function LencanaStatus({ children }: { children: React.ReactNode }) {
  return (
    <View className="self-start rounded-full bg-bw-surface px-2.5 py-1">
      <Text className="text-xs font-bold text-bw-muted">{children}</Text>
    </View>
  );
}
