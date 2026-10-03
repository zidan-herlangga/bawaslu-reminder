import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Klien Supabase untuk aplikasi native.
//
// EXPO_PUBLIC_* dibaca saat bundel dibuat, bukan saat aplikasi berjalan, dan
// harus diakses langsung sebagai process.env.NAMA agar Expo bisa
// menggantinya. Setelah mengubah .env, jalankan ulang dengan:
//
//   npx expo start -c

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Galat yang dilempar saat modul dimuat tidak tertangkap BatasGalat, jadi di
// build rilis aplikasi akan langsung tertutup. Itu disengaja: klien tanpa
// alamat atau kunci tidak bisa bekerja sama sekali, dan lebih baik ketahuan
// saat pengembangan daripada tampak berjalan tapi semua permintaannya gagal.
if (!url || !anonKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL atau EXPO_PUBLIC_SUPABASE_ANON_KEY belum diisi. ' +
      'Salin .env.example menjadi .env lalu isi nilainya, lalu restart dev server.'
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    // Tanpa ini, sesi tidak bertahan setelah aplikasi ditutup. Web menyimpan
    // sesi di localStorage yang otomatis ada; di native tidak, jadi harus
    // ditunjuk secara eksplisit.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Di web, Supabase membaca token dari alamat halaman (tautan konfirmasi,
    // OAuth). Di native tidak ada alamat halaman seperti itu, jadi dimatikan
    // supaya tidak mencoba membaca sesuatu yang tidak ada.
    detectSessionInUrl: false,
  },
});

// Penyegaran token hanya berjalan selama aplikasi terlihat.
//
// Timer penyegaran di React Native tetap hidup saat aplikasi di latar, tempat
// permintaan jaringan sering ditunda atau gagal. Akibatnya token bisa kedaluwarsa
// diam-diam dan baru ketahuan saat aplikasi dibuka lagi (layar jadi galat
// "JWT expired"). Dengan memulai dan menghentikan penyegaran mengikuti status
// aplikasi, token disegarkan segera begitu aplikasi kembali ke depan.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    if (status === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}