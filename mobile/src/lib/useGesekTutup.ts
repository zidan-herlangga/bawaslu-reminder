import { useCallback, useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const TINGGI_LAYAR = Dimensions.get('window').height;
const AMBANG_JARAK = 120;
const AMBANG_KECEPATAN = 800;
const DURASI_MUNCUL = 260;
const DURASI_TUTUP = 200;
/** Geser halus saat muncul (px) — kecil, hanya untuk kesan lembut */
const JARAK_MUNCUL = 28;

/**
 * Sheet muncul dengan fade + geser sangat tipis agar terasa halus.
 * Gesek ke bawah pada handlebar tetap bisa dipakai untuk menutup.
 */
export function useGesekTutup(terbuka: boolean, onTutup: () => void) {
  const geser = useSharedValue(0);
  const progres = useSharedValue(0);

  useEffect(() => {
    geser.value = 0;
    if (terbuka) {
      progres.value = 0;
      progres.value = withTiming(1, {
        duration: DURASI_MUNCUL,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      progres.value = 0;
    }
  }, [terbuka, geser, progres]);

  const tutupDenganAnimasi = useCallback(() => {
    progres.value = withTiming(
      0,
      { duration: DURASI_TUTUP, easing: Easing.in(Easing.quad) },
      (selesai) => {
        if (selesai) runOnJS(onTutup)();
      }
    );
  }, [progres, onTutup]);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      geser.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > AMBANG_JARAK || e.velocityY > AMBANG_KECEPATAN) {
        geser.value = withTiming(
          TINGGI_LAYAR,
          { duration: 220, easing: Easing.out(Easing.quad) },
          (selesai) => {
            if (selesai) runOnJS(onTutup)();
          }
        );
      } else {
        geser.value = withTiming(0, {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        });
      }
    });

  const gayaKartu = useAnimatedStyle(() => ({
    opacity: progres.value,
    transform: [
      { translateY: geser.value + (1 - progres.value) * JARAK_MUNCUL },
    ],
  }));

  const gayaBackdrop = useAnimatedStyle(() => ({
    backgroundColor: 'rgba(0,0,0,0.4)',
    opacity: progres.value * (1 - Math.min(geser.value / TINGGI_LAYAR, 1)),
  }));

  return { panGesture, gayaKartu, gayaBackdrop, tutupDenganAnimasi };
}