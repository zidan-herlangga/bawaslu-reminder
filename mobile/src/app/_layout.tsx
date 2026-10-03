import '../../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { vars } from 'nativewind';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BatasGalat from '../komponen/BatasGalat';
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
      <StatusBar style={dipakai === 'gelap' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
