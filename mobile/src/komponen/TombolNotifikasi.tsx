import { Pressable, Text, View } from 'react-native';
import { Ikon } from './Ikon';

/**
 * Tombol lonceng notifikasi dengan penanda belum dibaca.
 *
 * Letaknya di header Beranda, bukan di tab bar. Tab bar sudah punya empat ikon
 * yang masing-masing berarti sesuatu, dan menambah lonceng di sana membuat orang
 * harus menebak tab kelima itu apa. Lonceng juga bukan tempat berpindah halaman:
 * satu-satunya aksi adalah membuka kotak masuk, jadi cukup satu ketukan dan tidak
 * perlu tab baru.
 *
 * Badge disembunyikan saat nol, bukan ditampilkan sebagai "0". Lingkaran kosong
 * di kanan atas lonceng terlihat seperti tombol yang belum termuat, dan itu
 * membuat orang mengetuk sesuatu yang tidak punya apa-apa.
 */
export interface TombolNotifikasiProps {
  belumDibaca: number;
  onPress: () => void;
}

export function TombolNotifikasi({ belumDibaca, onPress }: TombolNotifikasiProps) {
  // Badge dipotong supaya tidak pernah menutupi lonceng. Angka aslinya tetap
  // dibacakan oleh accessibilityLabel, jadi angka yang sebenarnya tetap sampai
  // ke pembaca layar.
  const teksBadge = belumDibaca > 99 ? '99+' : String(belumDibaca);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        belumDibaca > 0
          ? `Notifikasi, ${belumDibaca} belum dibaca`
          : 'Notifikasi'
      }
      className="h-12 w-12 items-center justify-center rounded-full border border-bw-line bg-bw-card active:opacity-70"
    >
      <Ikon
        nama={belumDibaca > 0 ? 'notifications' : 'notifications-outline'}
        token={belumDibaca > 0 ? 'bw-blue' : 'bw-ink-2'}
        ukuran={20}
      />

      {belumDibaca > 0 ? (
        <View
          className="absolute right-1.5 top-1.5 min-w-[18px] items-center justify-center rounded-full border border-bw-card bg-bw-red px-1"
          style={{ height: 18 }}
        >
          <Text
            numberOfLines={1}
            className="text-[10px] font-extrabold leading-none text-white"
          >
            {teksBadge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}