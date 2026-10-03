import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BatasGalat from '../komponen/BatasGalat';
import { PengingatHost } from '../komponen/PengingatHost';
import { ToastHost } from '../komponen/ToastHost';
import { SesiProvider } from '../lib/session';
import { TemaProvider, useTema } from '../tema/TemaProvider';

// Layout teratas.
//
// Urutan pembungkus di sini penting:
//
//   TemaProvider paling luar, karena tema memengaruhi warna ikon, warna aksen
//   kartu, dan gaya status bar. Semua yang di bawahnya boleh membaca tema.
//
//   SesiProvider di dalam tema. Penjagaan sesi tidak dilakukan di sini, tetapi
//   di tiap layar: masuk mengarahkan yang sudah punya sesi ke tab, dan tab
//   mengarahkan yang belum punya sesi ke layar masuk.
//
// vars() dipasang pada View paling luar. Fungsi NativeWind untuk CSS
// variable mengembalikan objek style yang harus dipasang ke sebuah View, bukan
// fungsi yang boleh dipanggil bebas; itu sebabnya warna tidak bisa dipasang
// dari dalam provider.
//
// BatasGalat membungkus Stack, bukan provider di atasnya. Provider jarang yang
// melempar galat, sedangkan tiap layar bisa. Satu layar yang gagal tidak boleh
// membuat seluruh aplikasi kosong tanpa penjelasan.
//
// ToastHost dipasang setelah PengingatHost supaya toast berada di atas banner
// pengingat. Toast menjawab aksi yang sedang dilakukan pengguna, jadi lebih
// mendesak daripada pengingat yang memang dijadwalkan lebih dulu. Keduanya
// digambar sebagai absolute di dalam View ber-vars() yang sama, dan yang
// belakangan di pohon akan menutupi yang duluan.
//
// contentStyle dibuat transparan supaya latar bg-bw-canvas dari View di atas
// yang tampil. Dengan begitu tidak ada kedipan putih saat pindah layar di mode
// gelap, dan warnanya tetap mengikuti token tema.

export default function LayoutAkar() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TemaProvider>
          <SesiProvider>
            <BatasGalat>
              <Akar />
            </BatasGalat>
          </SesiProvider>
        </TemaProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Akar() {
  const { variabel, dipakai } = useTema();

  return (
    <View style={[vars(variabel), { flex: 1 }]} className="flex-1 bg-bw-canvas">
      <StatusBar style={dipakai === 'gelap' ? 'light' : 'dark'} animated />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 220,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        {/* Formulir jadwal naik dari bawah seperti lembar, bukan pindah halaman. */}
        <Stack.Screen
          name="jadwal/baru"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="jadwal/[id]"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      <PengingatHost />
      <ToastHost />
    </View>
  );
}