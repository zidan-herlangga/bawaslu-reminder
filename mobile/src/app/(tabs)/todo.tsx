import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ikon } from '../../komponen/Ikon';
import { useSesi } from '../../lib/session';
import { showToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';
import { namaKanalUnik } from '../../lib/useJadwal';

// Daftar tugas.
//
// Bentuk datanya sama dengan di web: satu baris teks, tanggal opsional, dan
// tanda selesai. Yang dipindah ke sini adalah cara menandainya selesai, yang
// memakai tombol lingkaran besar di kiri. Tanda centang kecil terlalu sulit
// ditekan dengan benar, dan salah menekan tanda selesai tidak merusak apa pun,
// jadi tidak perlu dialog.
//
// Yang tetap memakai dialog adalah menghapus jadwal di halaman lain, karena
// jadwal itu dibaca banyak orang.

interface Todo {
  id: string;
  teks: string;
  tanggal: string | null;
  selesai: boolean;
}

const KOLOM = 'id, teks, tanggal, selesai, created_at';

export default function LayarTugas() {
  const { session } = useSesi();
  const userId = session?.user.id ?? null;

  const [daftar, setDaftar] = useState<Todo[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [teks, setTeks] = useState('');
  const [menambah, setMenambah] = useState(false);
  const [galat, setGalat] = useState('');
  const [fokus, setFokus] = useState(false);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const muat = useCallback(async () => {
    if (!userId) return;

    setMemuat(true);
    const { data, error } = await supabase
      .from('todos')
      .select(KOLOM)
      .order('created_at', { ascending: false });

    if (!mounted.current) return;

    if (error) {
      setGalat(`Gagal memuat tugas: ${error.message}`);
      setDaftar([]);
    } else {
      setGalat('');
      setDaftar((data ?? []) as Todo[]);
    }

    setMemuat(false);
  }, [userId]);

  // Nama channel unik per pemanggil. Lihat catatan panjang di useJadwal.ts:
  // Supabase mengembalikan channel yang sudah ada kalau topiknya sama, jadi
  // dua layar yang memakai nama sama akan saling menabrak saat subscribe.
  const namaKanal = useRef<string | null>(null);
  if (namaKanal.current === null) {
    namaKanal.current = namaKanalUnik('tugas');
  }

  useEffect(() => {
    void muat();
  }, [muat]);

  // Realtime: tugas ikut berubah di perangkat lain.
  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`${namaKanal.current}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'todos' },
        () => {
          void muat();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, muat]);

  const segarkan = useCallback(async () => {
    setMenyegarkan(true);
    try {
      await muat();
    } finally {
      if (mounted.current) setMenyegarkan(false);
    }
  }, [muat]);

  const tambah = useCallback(async () => {
    const isi = teks.trim();
    if (!isi || !userId) return;

    setMenambah(true);
    try {
      const { error } = await supabase
        .from('todos')
        .insert({ teks: isi, selesai: false, user_id: userId });

      if (error) {
        showToast(`Gagal menambah: ${error.message}`, 'galat');
        return;
      }

      setTeks('');
      await muat();
    } finally {
      setMenambah(false);
    }
  }, [teks, userId, muat]);

  const alihkan = useCallback(
    async (todo: Todo) => {
      if (!userId) return;

      // Terapkan lebih dulu supaya tampilan terasa cepat, lalu cocokkan dengan
      // jawaban server. Kalau gagal, kembalikan seperti semula.
      const berikut = !todo.selesai;
      setDaftar((sebelumnya) =>
        sebelumnya.map((item) =>
          item.id === todo.id ? { ...item, selesai: berikut } : item
        )
      );

      const { error } = await supabase
        .from('todos')
        .update({ selesai: berikut })
        .eq('id', todo.id);

      if (error) {
        setDaftar((sebelumnya) =>
          sebelumnya.map((item) =>
            item.id === todo.id ? { ...item, selesai: todo.selesai } : item
          )
        );
        showToast(`Gagal menyimpan: ${error.message}`, 'galat');
      }
    },
    [userId]
  );

  const belum = daftar.filter((item) => !item.selesai);
  const sudah = daftar.filter((item) => item.selesai);
  const persen = daftar.length > 0 ? Math.round((sudah.length / daftar.length) * 100) : 0;
  const bisaTambah = teks.trim().length > 0 && !menambah;

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={menyegarkan}
            onRefresh={segarkan}
            tintColor="#6b6b70"
          />
        }
      >
        {/* Header */}
        <Text className="text-3xl font-extrabold tracking-tight text-bw-ink">Tugas</Text>
        <Text className="mt-1 text-sm text-bw-muted">
          {belum.length === 0 && daftar.length > 0
            ? 'Semua tugas sudah selesai.'
            : `${belum.length} belum selesai`}
        </Text>

        {/* Ringkasan progres */}
        {daftar.length > 0 ? (
          <View className="mt-5 rounded-[28px] border border-bw-line bg-bw-card p-5">
            <View className="flex-row items-end justify-between">
              <View>
                <Text className="text-xs font-bold uppercase tracking-widest text-bw-muted">
                  Progres
                </Text>
                <Text className="mt-1 text-2xl font-extrabold text-bw-ink">
                  {sudah.length}
                  <Text className="text-base font-semibold text-bw-muted">
                    {' '}
                    / {daftar.length} selesai
                  </Text>
                </Text>
              </View>
              <View className="rounded-full bg-bw-blue-50 px-3 py-1.5">
                <Text className="text-xs font-bold text-bw-blue-700">{persen}%</Text>
              </View>
            </View>

            <View className="mt-4 h-2.5 overflow-hidden rounded-full bg-bw-surface">
              <View
                className="h-full rounded-full bg-bw-blue"
                style={{ width: `${persen}%` }}
              />
            </View>
          </View>
        ) : null}

        {/* Input tugas baru */}
        <View className="mt-5 flex-row gap-2.5">
          <View
            className={`h-14 flex-1 flex-row items-center gap-2 rounded-2xl border-2 bg-bw-card px-4 ${
              fokus ? 'border-bw-blue' : 'border-bw-line'
            }`}
          >
            <Ikon nama="create-outline" token="bw-muted" ukuran={18} />
            <TextInput
              value={teks}
              onChangeText={setTeks}
              onFocus={() => setFokus(true)}
              onBlur={() => setFokus(false)}
              placeholder="Tulis tugas baru..."
              placeholderTextColor="#9a9aa0"
              accessibilityLabel="Tulis tugas baru"
              onSubmitEditing={tambah}
              returnKeyType="done"
              className="flex-1 text-base text-bw-ink"
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tambah tugas"
            onPress={tambah}
            disabled={!bisaTambah}
            className={`h-14 w-14 items-center justify-center rounded-2xl active:opacity-80 ${
              bisaTambah ? 'bg-bw-blue' : 'bg-bw-line'
            }`}
          >
            <Ikon
              nama="add"
              ukuran={26}
              token={bisaTambah ? 'bw-blue-50' : 'bw-muted'}
            />
          </Pressable>
        </View>

        {/* Galat */}
        {galat ? (
          <View
            accessibilityRole="alert"
            className="mt-5 rounded-3xl border border-bw-red-100 bg-bw-red-50 p-4"
          >
            <View className="flex-row items-center gap-2">
              <Ikon nama="alert-circle-outline" token="bw-red" ukuran={18} />
              <Text className="flex-1 text-sm font-bold text-bw-red">
                Tugas tidak bisa dimuat.
              </Text>
            </View>
            <Text className="mt-1.5 text-xs leading-relaxed text-bw-red">{galat}</Text>
            <Pressable
              onPress={muat}
              accessibilityRole="button"
              className="mt-3 h-12 items-center justify-center rounded-2xl bg-bw-red-solid active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">Coba lagi</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Memuat */}
        {memuat && daftar.length === 0 ? (
          <Text className="mt-10 text-center text-sm text-bw-muted">Memuat...</Text>
        ) : null}

        {/* Kosong */}
        {!memuat && daftar.length === 0 && !galat ? (
          <View className="mt-8 items-center rounded-[28px] border border-dashed border-bw-line bg-bw-card px-6 py-12">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-bw-surface">
              <Ikon nama="checkmark-done-outline" token="bw-muted" ukuran={30} />
            </View>
            <Text className="mt-4 text-base font-bold text-bw-ink">Belum ada tugas</Text>
            <Text className="mt-1.5 text-center text-xs leading-relaxed text-bw-muted">
              Tulis di kolom di atas untuk menambah tugas pribadi.
            </Text>
          </View>
        ) : null}

        {/* Belum selesai */}
        {belum.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-2.5 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
              Belum selesai ({belum.length})
            </Text>
            <View className="gap-2.5">
              {belum.map((todo) => (
                <BarisTugas key={todo.id} todo={todo} onAlih={alihkan} />
              ))}
            </View>
          </View>
        ) : null}

        {/* Sudah selesai */}
        {sudah.length > 0 ? (
          <View className="mt-7">
            <Text className="mb-2.5 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
              Sudah selesai ({sudah.length})
            </Text>
            <View className="gap-2.5">
              {sudah.map((todo) => (
                <BarisTugas key={todo.id} todo={todo} onAlih={alihkan} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function BarisTugas({
  todo,
  onAlih,
}: {
  todo: Todo;
  onAlih: (todo: Todo) => void;
}) {
  return (
    <Pressable
      onPress={() => onAlih(todo)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: todo.selesai }}
      accessibilityLabel={todo.teks}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      className={`min-h-16 flex-row items-center gap-3.5 rounded-3xl border border-bw-line bg-bw-card px-4 py-3.5 active:opacity-70 ${
        todo.selesai ? 'opacity-70' : ''
      }`}
    >
      <View
        className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
          todo.selesai ? 'border-bw-green bg-bw-green' : 'border-bw-line bg-transparent'
        }`}
      >
        {todo.selesai ? (
          <Ikon nama="checkmark" ukuran={18} token="bw-green-50" />
        ) : null}
      </View>

      <View className="min-w-0 flex-1">
        <Text
          className={
            todo.selesai
              ? 'text-[15px] text-bw-muted line-through'
              : 'text-[15px] font-semibold text-bw-ink'
          }
        >
          {todo.teks}
        </Text>
        {todo.tanggal ? (
          <View className="mt-1 flex-row items-center gap-1">
            <Ikon nama="calendar-outline" token="bw-muted" ukuran={12} />
            <Text className="text-xs text-bw-muted">{todo.tanggal}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}