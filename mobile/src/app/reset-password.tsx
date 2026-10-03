import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BidangAuth, KotakPesan } from '../komponen/BidangAuth';
import { Ikon } from '../komponen/Ikon';
import { useSesi } from '../lib/session';
import { supabase } from '../lib/supabase';
import {
  kalimatGalat,
  pesanGalatAuth,
  validasiSandiBaru,
} from '../shared/daftar';

// Layar yang menerima tautan atur ulang kata sandi.
//
// Halaman ini dibuka oleh tautan di dalam email, jadi isinya tidak boleh
// menganggap orang sudah melakukan sesuatu di aplikasi.
//
// Tautan dari email punya bentuk skema://rute. Parameternya tidak dipakai
// karena token pemulihan disimpan sendiri oleh supabase-js dari hash di URL.
//
// Yang paling penting di sini adalah tidak berbohong soal keadaan. Ada tiga
//
// - sedang memeriksa: tautannya sah atau tidak
// - tidak sah: tautannya kedaluwarsa atau dibuka di perangkat lain
// - siap: sesi pemulihan sudah ada, baru boleh menampilkan kolom
//
// Menampilkan kolom terlalu awal membuat orang mengetik kata sandi baru untuk
// sesi yang tidak ada, lalu gagal dengan pesan yang tidak ada artinya.

type Keadaan = 'memeriksa' | 'siap' | 'tidak-sah';

export default function LayarAturUlangSandi() {
  const { aturSandiBaru } = useSesi();
  const [keadaan, setKeadaan] = useState<Keadaan>('memeriksa');
  const [sandi, setSandi] = useState('');
  const [ulang, setUlang] = useState('');
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [selesai, setSelesai] = useState(false);

  useEffect(() => {
    let aktif = true;

    // Dengarkan PASSWORD_RECOVERY supaya tautan yang baru saja dibuka pada
    // sesi berjalan juga dikenali, tidak hanya yang sudah terbuka saat layar
    // ini dimuat.
    const { data: langganan } = supabase.auth.onAuthStateChange((peristiwa) => {
      if (aktif && peristiwa === 'PASSWORD_RECOVERY') setKeadaan('siap');
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!aktif) return;
      if (error || !data.session) {
        setKeadaan('tidak-sah');
        return;
      }
      setKeadaan('siap');
    });

    return () => {
      aktif = false;
      langganan.subscription.unsubscribe();
    };
  }, []);

  const kirim = async () => {
    if (sibuk) return;

    if (validasiSandiBaru(sandi).length > 0) {
      setGalat(kalimatGalat(validasiSandiBaru(sandi)));
      return;
    }
    if (sandi !== ulang) {
      setGalat('Konfirmasi kata sandi tidak sama.');
      return;
    }

    setSibuk(true);
    setGalat('');

    try {
      await aturSandiBaru(sandi);
      setSelesai(true);
    } catch (kesalahan) {
      setGalat(pesanGalatAuth(kesalahan));
    } finally {
      setSibuk(false);
    }
  };

  if (keadaan === 'memeriksa') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bw-canvas" edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color="#0071e3" />
        <Text className="mt-4 text-sm text-bw-muted">Memeriksa tautan...</Text>
      </SafeAreaView>
    );
  }

  if (keadaan === 'tidak-sah') {
    return (
      <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View className="px-6 py-10">
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-bw-amber-50">
                <Ikon nama="link-outline" token="bw-amber-500" ukuran={44} />
              </View>
              <Text className="mt-6 text-center text-2xl font-extrabold tracking-tight text-bw-ink">
                Tautan tidak berlaku
              </Text>
              <Text className="mt-2 text-center text-sm leading-relaxed text-bw-muted">
                Tautan atur ulang hanya bisa dipakai sekali dan punya batas waktu.
                Minta tautan baru dari halaman lupa kata sandi.
              </Text>
            </View>

            <Pressable
              onPress={() => router.replace('/lupa-password')}
              accessibilityRole="button"
              accessibilityLabel="Minta tautan baru"
              className="mt-8 h-14 items-center justify-center rounded-2xl bg-bw-blue active:opacity-80"
            >
              <Text className="text-base font-bold text-white">Minta tautan baru</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace('/masuk')}
              accessibilityRole="button"
              accessibilityLabel="Kembali ke halaman masuk"
              className="mt-3 h-14 items-center justify-center rounded-2xl active:opacity-70"
            >
              <Text className="text-sm font-bold text-bw-blue">Kembali ke masuk</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (selesai) {
    return (
      <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <View className="px-6 py-10">
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-bw-green-50">
                <Ikon nama="checkmark-circle-outline" token="bw-green" ukuran={44} />
              </View>
              <Text className="mt-6 text-center text-2xl font-extrabold tracking-tight text-bw-ink">
                Kata sandi diubah
              </Text>
              <Text className="mt-2 text-center text-sm leading-relaxed text-bw-muted">
                Silakan masuk dengan kata sandi yang baru.
              </Text>
            </View>

            <Pressable
              onPress={() => router.replace('/masuk')}
              accessibilityRole="button"
              accessibilityLabel="Ke halaman masuk"
              className="mt-8 h-14 items-center justify-center rounded-2xl bg-bw-blue active:opacity-80"
            >
              <Text className="text-base font-bold text-white">Masuk</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 py-10">
            <View className="items-center">
              <View className="h-24 w-24 items-center justify-center rounded-[32px] bg-bw-blue-50">
                <Ikon nama="key" token="bw-blue" ukuran={44} />
              </View>
              <Text className="mt-6 text-center text-3xl font-extrabold tracking-tight text-bw-ink">
                Kata Sandi Baru
              </Text>
              <Text className="mt-1.5 text-center text-sm leading-relaxed text-bw-muted">
                Pilih kata sandi yang belum pernah dipakai di sini.
              </Text>
            </View>

            <View className="mt-8 rounded-[28px] border border-bw-line bg-bw-card p-5">
              <BidangAuth
                label="Kata sandi baru"
                nilai={sandi}
                onUbah={(v) => {
                  setSandi(v);
                  if (galat) setGalat('');
                }}
                jenis="sandi"
                placeholder="Minimal 6 karakter"
                autoComplete="password"
                returnKeyType="next"
              />

              <View className="mt-4">
                <BidangAuth
                  label="Ulangi kata sandi baru"
                  nilai={ulang}
                  onUbah={(v) => {
                    setUlang(v);
                    if (galat) setGalat('');
                  }}
                  jenis="sandi"
                  placeholder="Ketik sekali lagi"
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmit={kirim}
                />
              </View>

              {galat ? <KotakPesan nada="galat">{galat}</KotakPesan> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Simpan kata sandi baru"
                accessibilityState={{ disabled: sandi.length === 0 || sibuk, busy: sibuk }}
                onPress={kirim}
                disabled={sandi.length === 0 || sibuk}
                className={`mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
                  sandi.length > 0 || sibuk ? 'bg-bw-blue' : 'bg-bw-line'
                }`}
              >
                {sibuk ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text
                  className={`text-base font-bold ${
                    sandi.length > 0 || sibuk ? 'text-white' : 'text-bw-muted'
                  }`}
                >
                  {sibuk ? 'Menyimpan...' : 'Simpan kata sandi'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}