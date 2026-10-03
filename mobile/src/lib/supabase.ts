import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

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
    // Menormalkan deteksi sesi di layar lebih cepat. Tanpa ini, perpindahan dari
    // latar ke depan bisa terasa lambat.
    detectSessionInUrl: false,
  },
});
