import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Keyboard,
  LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../tema/TemaProvider';
import { useWarna } from '../tema/warna';

// Bilah tab terapung bergaya modern, ringkas, dan pas di semua lebar layar.
//
// - Dock berbentuk kapsul melayang dengan bayangan lembut dan garis tipis
//   (hairline) di terang maupun gelap, supaya tepinya tetap tegas.
// - Setiap tab sama lebar (flex) dan susunannya vertikal: ikon di atas, label
//   di bawah. Dengan begitu 4-5 tab tetap muat di layar sempit tanpa label
//   terpotong atau saling dorong.
// - Tab aktif memakai pil aksen yang menyelinap antar tab dengan pegas. Pil
//   dibuat sedikit lebih sempit dari tab supaya ada napas di kiri-kanan.
// - Ikon tab aktif "menyentak" sekali dengan pegas.
// - Haptics ringan saat berpindah tab.
// - Label selalu terlihat: ikon saja tidak bisa dibaca staf yang baru pertama
//   kali memakai aplikasi.
// - Dock menyembunyikan diri saat keyboard terbuka, lalu kembali saat ditutup.
// - Semua animasi menghormati pengaturan "kurangi gerakan" sistem.
// - Warna diambil dari token tema, bukan hex yang ditulis di sini.

const TINGGI_DASAR = 64;
const INSET_PIL = 4;
const TINGGI_PIL = TINGGI_DASAR - INSET_PIL * 2 - 2;
const UKURAN_IKON = 22;

export default function TabDock({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps) {
  const { dipakai } = useTema();
  const { warna } = useWarna();

  const jarakBawah = Math.max(
    insets.bottom,
    Platform.OS === 'android' ? 0 : 0
  );
  const gelap = dipakai === 'gelap';
  const kurangiGerak = useReducedMotion();

  // Posisi tiap tab di dalam dock (sumbu X dan lebar), diukur dari onLayout.
  const posisiTab = useRef<Record<number, { x: number; lebar: number }>>({});

  // Pil aksen yang menyelinap di belakang item yang aktif.
  const pilX = useSharedValue(0);
  const pilLebar = useSharedValue(0);

  // Tinggi nyata dock, dipakai untuk menyembunyikan saat keyboard terbuka.
  const tinggiNyata = useSharedValue(TINGGI_DASAR + jarakBawah);
  const keyboardTerbuka = useSharedValue(0);

  useEffect(() => {
    const namaAktif =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const namaMati =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const tampil = Keyboard.addListener(namaAktif, () => {
      keyboardTerbuka.value = 1;
    });
    const sembunyi = Keyboard.addListener(namaMati, () => {
      keyboardTerbuka.value = 0;
    });
    return () => {
      tampil.remove();
      sembunyi.remove();
    };
  }, [keyboardTerbuka]);

  // Geser pil ke tab yang aktif setiap kali tab berubah.
  useEffect(() => {
    const tujuan = posisiTab.current[state.index];
    if (!tujuan) return;
    const pegas = (nilai: number) => {
      if (kurangiGerak) return nilai;
      return withSpring(nilai, {
        damping: 22,
        stiffness: 220,
        mass: 0.8,
        reduceMotion: ReduceMotion.System,
      });
    };
    pilX.value = pegas(tujuan.x + INSET_PIL);
    pilLebar.value = pegas(tujuan.lebar - INSET_PIL * 2);
  }, [state.index, pilLebar, pilX, kurangiGerak]);

  // Saat keyboard terbuka, dock dikempiskan supaya layar konten kembali luas.
  const gayaKontainer = useAnimatedStyle(() => ({
    height: withTiming(keyboardTerbuka.value === 1 ? 0 : tinggiNyata.value, {
      duration: 220,
      reduceMotion: ReduceMotion.System,
    }),
    opacity: withTiming(keyboardTerbuka.value === 1 ? 0 : 1, {
      duration: 150,
      reduceMotion: ReduceMotion.System,
    }),
  }));

  const gayaPil = useAnimatedStyle(() => ({
    transform: [{ translateX: pilX.value }],
    width: pilLebar.value,
    opacity: pilLebar.value > 0 ? 1 : 0,
  }));

  return (
    <Animated.View style={[styles.pembungkus, gayaKontainer]}>
      <View
        onLayout={(e) => {
          tinggiNyata.value = e.nativeEvent.layout.height;
        }}
        style={{ paddingBottom: jarakBawah, paddingTop: 6 }}
      >
        <View
          style={[
            styles.dock,
            {
              backgroundColor: warna('bw-card'),
              borderColor: warna('bw-line'),
              elevation: gelap ? 0 : 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: gelap ? 0 : 0.14,
              shadowRadius: 16,
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pil,
              {
                backgroundColor: warna('bw-blue'),
                height: TINGGI_PIL,
                borderRadius: TINGGI_PIL / 2,
              },
              gayaPil,
            ]}
          />
          {state.routes.map((route, indeks) => {
            const opsi = descriptors[route.key]!.options;
            const fokus = state.index === indeks;
            const label =
              opsi.title ??
              route.name.charAt(0).toUpperCase() + route.name.slice(1);
            const ikon = opsi.tabBarIcon ?? (() => null);

            const tekan = () => {
              const kejadian = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!fokus && !kejadian.defaultPrevented) {
                sentuhTab(true);
                navigation.navigate(route.name, route.params);
              }
            };
            const tekanLama = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key });
            };

            return (
              <TombolTab
                key={route.key}
                indeks={indeks}
                jumlah={state.routes.length}
                label={label}
                fokus={fokus}
                ikon={ikon}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  posisiTab.current[indeks] = { x, lebar: width };
                  // Tab aktif selalu ditempeli pil langsung (tanpa animasi)
                  // setiap kali layout berubah: pertama kali tampil, rotasi,
                  // ukuran font sistem, atau split screen.
                  if (indeks === state.index) {
                    pilX.value = x + INSET_PIL;
                    pilLebar.value = width - INSET_PIL * 2;
                  }
                }}
                onPress={tekan}
                onLongPress={tekanLama}
              />
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

// Satu tombol tab. Dipisah supaya tiap tombol punya status animasinya sendiri
// (dilarang memanggil hook di dalam perulangan).
function TombolTab({
  indeks,
  jumlah,
  label,
  fokus,
  ikon,
  onPress,
  onLongPress,
  onLayout,
}: {
  indeks: number;
  jumlah: number;
  label: string;
  fokus: boolean;
  ikon: (props: {
    focused: boolean;
    color: string;
    size: number;
  }) => ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const { dipakai } = useTema();
  const { warna } = useWarna();
  const gelap = dipakai === 'gelap';
  const kurangiGerak = useReducedMotion();

  const aktifTeks = gelap ? warna('bw-canvas') : '#FFFFFF';
  const nonaktif = warna('bw-muted');

  // "Sentakkan" ikon saat tab jadi aktif: turun sedikit lalu kembali.
  const skala = useSharedValue(1);
  useEffect(() => {
    if (!fokus || kurangiGerak) {
      skala.value = 1;
      return;
    }
    skala.value = withSequence(
      withSpring(0.84, {
        damping: 18,
        stiffness: 260,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, {
        damping: 14,
        stiffness: 300,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [fokus, kurangiGerak, skala]);

  const gayaIsi = useAnimatedStyle(() => ({
    transform: [{ scale: skala.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: fokus }}
      accessibilityLabel={`${label}, tab, ${indeks + 1} dari ${jumlah}`}
      onPress={onPress}
      onLongPress={onLongPress}
      onLayout={onLayout}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.item,
        pressed && !kurangiGerak ? { opacity: 0.7 } : null,
      ]}
    >
      <Animated.View style={[styles.itemIsi, gayaIsi]}>
        {ikon({
          focused: fokus,
          color: fokus ? aktifTeks : nonaktif,
          size: UKURAN_IKON,
        })}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
          style={[
            styles.label,
            {
              color: fokus ? aktifTeks : nonaktif,
              fontWeight: fokus ? '700' : '500',
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// Umpan balik sentuh singkat saat berpindah tab. Dipanggil di luar render,
// dipisah ke sini supaya kebiasaan haptics ada di satu tempat.
export function sentuhTab(berpindah: boolean) {
  if (!berpindah) return;
  if (Platform.OS === 'android') {
    Haptics.selectionAsync().catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

const styles = StyleSheet.create({
  pembungkus: {
    overflow: 'hidden',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TINGGI_DASAR,
    marginHorizontal: 16,
    paddingHorizontal: 4,
    borderRadius: TINGGI_DASAR / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pil: {
    position: 'absolute',
    left: 0,
    top: INSET_PIL,
  },
  item: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
  },
  itemIsi: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
});