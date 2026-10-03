import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToast, type NadaToast, type PesanToast } from '../lib/toast';

/**
 * Apakah animasi boleh memakai driver native.
 *
 * Di web modul animasi native tidak ada sama sekali. Dengan useNativeDriver
 * selalu true, React Native mencetak peringatan lalu jatuh ke driver JS.
 * Bertanya Platform.OS menghapus peringatan itu tanpa mengubah hasil:
 * animasi tetap berjalan, dan di native tetap berjalan di thread UI.
 */
const PAKAI_DRIVER_NATIVE = Platform.OS !== 'web';

import type { TokenWarna } from '../tema/warna';
import { Ikon, type NamaIkon } from './Ikon';

// Penampil toast. Dipasang satu kali di layout akar.
//
// Toast baru menggantikan yang sedang tampil, bukan antre: pesan lama yang
// sudah tidak relevan (mis. "Menyimpan...") tidak perlu dibaca lagi. Galat
// bertahan lebih lama karena isinya perlu dibaca sampai habis.
//
// Catatan: toast digambar di dalam pohon aplikasi, jadi tertutup oleh Modal
// bawaan React Native (ModalDetail, DialogKonfirmasi) selama modal itu terbuka.

const DURASI: Record<NadaToast, number> = {
  sukses: 3000,
  info: 3000,
  galat: 4500,
};

// Peta statis, bukan kelas yang dirangkai: NativeWind membaca kelas saat build.
const GAYA: Record<
  NadaToast,
  { wadah: string; ikon: NamaIkon; token: TokenWarna }
> = {
  sukses: {
    wadah: 'border-bw-green-200 bg-bw-green-50',
    ikon: 'checkmark-circle',
    token: 'bw-green-500',
  },
  galat: {
    wadah: 'border-bw-red-100 bg-bw-red-50',
    ikon: 'alert-circle',
    token: 'bw-red',
  },
  info: {
    wadah: 'border-bw-blue-200 bg-bw-blue-50',
    ikon: 'information-circle',
    token: 'bw-blue',
  },
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<PesanToast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bersihkanTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const tutup = useCallback(() => {
    bersihkanTimer();
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: PAKAI_DRIVER_NATIVE,
    }).start(({ finished }) => {
      // Tidak selesai berarti ada toast baru yang menyela, jangan dikosongkan.
      if (finished) setItem(null);
    });
  }, [anim, bersihkanTimer]);

  useEffect(() => {
    const berhenti = subscribeToast((baru) => {
      bersihkanTimer();
      setItem(baru);
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: PAKAI_DRIVER_NATIVE,
      }).start();
      timer.current = setTimeout(tutup, DURASI[baru.nada]);
    });

    return () => {
      berhenti();
      bersihkanTimer();
    };
  }, [anim, tutup, bersihkanTimer]);

  if (!item) return null;

  const gaya = GAYA[item.nada];

  return (
    <View
      // pointerEvents lewat style, bukan prop terpisah: React Native 0.86 sudah
      // meng deprecated prop pointerEvents.
      className="absolute inset-x-0 top-0 px-4"
      style={{ pointerEvents: 'box-none', paddingTop: insets.top + 8 }}
    >
      <Animated.View
        style={{
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [-16, 0],
              }),
            },
          ],
        }}
      >
        <Pressable
          onPress={tutup}
          accessibilityRole={item.nada === 'galat' ? 'alert' : 'text'}
          accessibilityLiveRegion="polite"
          accessibilityHint="Ketuk untuk menutup"
          className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 ${gaya.wadah}`}
          style={{
            elevation: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.12,
            shadowRadius: 10,
          }}
        >
          <Ikon nama={gaya.ikon} token={gaya.token} ukuran={22} />
          <Text className="flex-1 text-sm font-semibold leading-snug text-bw-ink">
            {item.pesan}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}