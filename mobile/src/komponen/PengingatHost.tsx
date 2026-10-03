import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePengingat, type Pengingat } from '../lib/pengingat';
import { useSesi } from '../lib/session';
import { Ikon } from './Ikon';

// Banner pengingat di dalam aplikasi.
//
// Dipasang sekali di layout akar supaya pengingat muncul di layar mana pun,
// bukan cuma di Beranda. Ia menumpuk di atas semua layar, seperti ToastHost,
// tapi bedanya: pengingat bertahan sampai ditutup pengguna, karena pengingat
// yang lewat dalam tiga detik tidak berguna untuk jadwal yang dirancang untuk
// diingat.
//
// Batasnya harus jujur: ini hanya jalan selama aplikasi terbuka. Di Expo Go
// Android tidak ada notifikasi sistem sama sekali, jadi inilah satu-satunya
// bentuk pengingat yang bisa muncul di sana.
//
// Urutan gambar di dalam aplikasi ini: semakin bawah di pohon, semakin atas di
// layar. ToastHost dipasang paling akhir supaya toast berada di atas pengingat:
// toast menjawab aksi yang sedang dilakukan pengguna, jadi lebih mendesak
// daripada pengingat yang memang dijadwalkan lebih dulu.

function BarisPengingat({
  item,
  onTutup,
}: {
  item: Pengingat;
  onTutup: (kunci: string) => void;
}) {
  const geser = useRef(new Animated.Value(0)).current;
  const [terlihat, setTerlihat] = useState(true);

  useEffect(() => {
    Animated.timing(geser, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [geser]);

  const tutup = () => {
    setTerlihat(false);
    Animated.timing(geser, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // onTutup hanya dipanggil kalau animasi selesai. Kalau tidak, banner
      // disembunyikan lewat state tapi kuncinya tetap tertahan, sehingga sesi
      // yang sama tidak akan diingatkan lagi sampai aplikasi ditutup.
      if (finished) onTutup(item.kunci);
    });
  };

  if (!terlihat) return null;

  return (
    <Animated.View
      style={{
        opacity: geser,
        transform: [
          {
            translateY: geser.interpolate({
              inputRange: [0, 1],
              outputRange: [16, 0],
            }),
          },
        ],
      }}
      className="mb-2 rounded-xl border border-bw-blue-200 bg-bw-blue-50 p-3"
    >
      <View className="flex-row items-start gap-2">
        <Ikon
          nama={item.nada === 'berlangsung' ? 'play-circle' : 'alarm'}
          token="bw-blue"
          ukuran={18}
        />
        <Text className="flex-1 text-sm font-medium leading-snug text-bw-ink">
          {item.teks}
        </Text>
        <Pressable
          onPress={tutup}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Tutup pengingat"
          className="p-1"
        >
          <Ikon nama="close" token="bw-muted" ukuran={16} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

export function PengingatHost() {
  const { session } = useSesi();
  const { pengingat, tandaiSudahDibaca } = usePengingat(session?.user?.id ?? null);
  const insets = useSafeAreaInsets();

  if (pengingat.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ paddingBottom: insets.bottom + 8 }}
      className="absolute inset-x-0 bottom-0 px-3"
    >
      {pengingat.map((item) => (
        <BarisPengingat
          key={item.kunci}
          item={item}
          onTutup={tandaiSudahDibaca}
        />
      ))}
    </View>
  );
}