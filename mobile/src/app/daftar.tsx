import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
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
import {
  DIVISI_OPTIONS,
  DIVISI_SHORT,
  JABATAN_OPTIONS,
} from '../shared/options';
import {
  KODE_BUATAN,
  PENDAFTARAN_KOSONG,
  kalimatGalat,
  normalkanEmail,
  pesanGalatAuth,
  validasiPendaftaran,
  type GalatPendaftaran,
  type NilaiPendaftaran,
} from '../shared/daftar';

// Layar pendaftaran akun.
//
// Alurnya sama dengan web (src/components/Register.jsx): signUp dulu, baru
// menulis baris profiles. Urutan itu tidak boleh dibalik, karena menulis profil
// lebih dulu bisa menghasilkan baris untuk orang yang tidak punya akun.
//
// Dua hal yang tidak ada di sini:
//
// - Tidak ada pemilih jabatan yang panjang. Jabatan diambil dari daftar tetap,
//   bukan diketik bebas, supaya profil rapi tanpa perlu kolom tambahan
// - Confirm email yang masih aktif bukan kegagalan yang disembunyikan. Akunnya
//   jadi, tapi belum bisa dipakai, jadi layar mengatakannya terus terang
//   beserta cara memperbaikinya

export default function LayarDaftar() {
  const { session, loading, daftar: buatAkun } = useSesi();

  const [nilai, setNilai] = useState<NilaiPendaftaran>(PENDAFTARAN_KOSONG);
  const [galatValidasi, setGalatValidasi] = useState<GalatPendaftaran[]>([]);
  const [galatUmum, setGalatUmum] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const refEmail = useRef(null);
  const refSandi = useRef(null);
  const refUlang = useRef(null);

  if (!loading && session) {
    return <Redirect href="/(tabs)" />;
  }

  const ubah = <K extends keyof NilaiPendaftaran>(
    kunci: K,
    nilaiBaru: NilaiPendaftaran[K]
  ) => {
    setNilai((sebelumnya) => ({ ...sebelumnya, [kunci]: nilaiBaru }));
    if (galatValidasi.length) setGalatValidasi([]);
    if (galatUmum) setGalatUmum('');
  };

  const kirim = async () => {
    if (sibuk) return;

    // Email dinormalkan sebelum divalidasi, supaya spasi atau huruf besar yang
    // tidak sengaja diketik tidak membuat email ditolak sebagai tidak valid.
    const siap = { ...nilai, email: normalkanEmail(nilai.email) };

    const hasilValidasi = validasiPendaftaran(siap);
    setGalatValidasi(hasilValidasi);
    if (hasilValidasi.length > 0) {
      setNilai(siap);
      return;
    }

    setSibuk(true);
    setGalatUmum('');

    try {
      const hasil = await buatAkun(siap);

      if (hasil.ok) {
        router.replace('/masuk');
        return;
      }

      if (hasil.sebab === 'butuh-konfirmasi-email') {
        setGalatUmum(
          pesanGalatAuth({ message: KODE_BUATAN.emailBelumDikonfirmasi })
        );
        return;
      }

      if (hasil.sebab === 'profil-gagal') {
        setGalatUmum(pesanGalatAuth({ message: KODE_BUATAN.profilGagal }));
        return;
      }

      setGalatUmum('Pendaftaran gagal tanpa alasan yang jelas. Coba lagi.');
    } catch (galat) {
      setGalatUmum(pesanGalatAuth(galat));
    } finally {
      setSibuk(false);
    }
  };

  const bisaKirim =
    nilai.namaLengkap.trim().length > 0 &&
    nilai.email.trim().length > 0 &&
    nilai.sandi.length > 0 &&
    !sibuk;

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-6 pt-6">
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Kembali ke halaman masuk"
              hitSlop={10}
              className="-ml-2 h-11 w-11 items-center justify-center rounded-full active:opacity-70"
            >
              <Ikon nama="chevron-back" token="bw-ink-2" ukuran={22} />
            </Pressable>

            <Text className="mt-2 text-3xl font-extrabold tracking-tight text-bw-ink">
              Daftar Akun
            </Text>
            <Text className="mt-1.5 text-sm text-bw-muted">
              Gunakan email kantor yang sama dengan yang dipakai di web.
            </Text>

            <View className="mt-6 rounded-[28px] border border-bw-line bg-bw-card p-5">
              <BidangAuth
                label="Nama lengkap"
                nilai={nilai.namaLengkap}
                onUbah={(v) => ubah('namaLengkap', v)}
                placeholder="Nama lengkap sesuai KTP"
                autoComplete="name"
                returnKeyType="next"
              />

              <View className="mt-4">
                <BidangAuth
                  label="Email"
                  nilai={nilai.email}
                  onUbah={(v) => ubah('email', v)}
                  jenis="email"
                  placeholder="nama@bawaslu.go.id"
                  autoComplete="email"
                  keyboardType="email-address"
                  returnKeyType="next"
                  refInput={refEmail}
                />
              </View>

              <View className="mt-4">
                <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
                  Divisi
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {DIVISI_OPTIONS.map((nama) => {
                    const aktif = nilai.divisi === nama;
                    return (
                      <Pressable
                        key={nama}
                        onPress={() => ubah('divisi', aktif ? '' : nama)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: aktif }}
                        className={`h-11 justify-center rounded-full border px-4 active:opacity-80 ${
                          aktif
                            ? 'border-bw-blue bg-bw-blue'
                            : 'border-bw-line bg-bw-surface'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            aktif ? 'text-white' : 'text-bw-ink-2'
                          }`}
                        >
                          {DIVISI_SHORT[nama] ?? nama}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="mt-4">
                <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
                  Jabatan
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {JABATAN_OPTIONS.map((nama) => {
                    const aktif = nilai.jabatan === nama;
                    return (
                      <Pressable
                        key={nama}
                        onPress={() => ubah('jabatan', aktif ? '' : nama)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: aktif }}
                        className={`h-11 justify-center rounded-full border px-4 active:opacity-80 ${
                          aktif
                            ? 'border-bw-blue bg-bw-blue'
                            : 'border-bw-line bg-bw-surface'
                        }`}
                      >
                        <Text
                          className={`text-sm font-semibold ${
                            aktif ? 'text-white' : 'text-bw-ink-2'
                          }`}
                        >
                          {nama}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View className="mt-4">
                <BidangAuth
                  label="Kata sandi"
                  nilai={nilai.sandi}
                  onUbah={(v) => ubah('sandi', v)}
                  jenis="sandi"
                  placeholder="Minimal 6 karakter"
                  autoComplete="password"
                  returnKeyType="next"
                  refInput={refSandi}
                />
              </View>

              <View className="mt-4">
                <BidangAuth
                  label="Ulangi kata sandi"
                  nilai={nilai.ulangSandi}
                  onUbah={(v) => ubah('ulangSandi', v)}
                  jenis="sandi"
                  placeholder="Ketik sekali lagi"
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmit={kirim}
                  refInput={refUlang}
                />
              </View>

              {galatValidasi.length > 0 ? (
                <KotakPesan nada="galat">{kalimatGalat(galatValidasi)}</KotakPesan>
              ) : null}

              {galatUmum ? <KotakPesan nada="galat">{galatUmum}</KotakPesan> : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Daftar akun"
                accessibilityState={{ disabled: !bisaKirim, busy: sibuk }}
                onPress={kirim}
                disabled={!bisaKirim}
                className={`mt-5 h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
                  bisaKirim || sibuk ? 'bg-bw-blue' : 'bg-bw-line'
                }`}
              >
                {sibuk ? <ActivityIndicator size="small" color="#ffffff" /> : null}
                <Text
                  className={`text-base font-bold ${
                    bisaKirim || sibuk ? 'text-white' : 'text-bw-muted'
                  }`}
                >
                  {sibuk ? 'Mendaftarkan...' : 'Daftar'}
                </Text>
              </Pressable>
            </View>

            <View className="mt-5 items-center">
              <Text className="text-sm text-bw-muted">Sudah punya akun?</Text>
              <Pressable
                onPress={() => router.replace('/masuk')}
                accessibilityRole="button"
                accessibilityLabel="Ke halaman masuk"
                hitSlop={8}
                className="mt-1 h-11 justify-center px-4 active:opacity-70"
              >
                <Text className="text-base font-bold text-bw-blue">Masuk</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}