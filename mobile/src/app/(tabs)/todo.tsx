import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import SafeAreaView from '../../komponen/SafeAreaView';
import { Button, ButtonText } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input, InputField, InputSlot } from '../../components/ui/input';
import { DialogKonfirmasi } from '../../komponen/DialogKonfirmasi';
import { Ikon } from '../../komponen/Ikon';
import { LampuRealtime } from '../../komponen/LampuRealtime';
import { PilihTanggal } from '../../komponen/PilihTanggal';
import { useSesi } from '../../lib/session';
import { showToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';
import { namaKanalUnik } from '../../lib/useJadwal';
import { formatTanggalPanjang } from '../../shared/formatWaktu';
import {
  TAB_TUGAS,
  kelompokTugas,
  normalkanTanggal,
  tanggalHariIni,
  visibleTugas,
  type TabTugas,
  type Tugas,
} from '../../shared/tugas';

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

// Bentuk barisnya dipakai bersama dengan modul tanggal, jadi didefinisikan satu
// kali di sana.
type Todo = Tugas;

const KOLOM = 'id, teks, tanggal, selesai, created_at';

export default function LayarTugas() {
  const { session } = useSesi();
  const userId = session?.user.id ?? null;

  const [daftar, setDaftar] = useState<Todo[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [terhubung, setTerhubung] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [teks, setTeks] = useState('');
  const [menambah, setMenambah] = useState(false);
  const [galat, setGalat] = useState('');

  // Daftar tugas punya tanggal, dan tanggal yang sedang dilihat bisa diubah
  // lewat tab. Sama seperti web, layar dibuka pada tab tanggal hari ini.
  const [tab, setTab] = useState<TabTugas>('tanggal');
  const [tanggal, setTanggal] = useState<string>(() => tanggalHariIni());

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
      setDaftar(
        ((data ?? []) as Todo[]).map((item) => ({
          ...item,
          tanggal: normalkanTanggal(item.tanggal),
        }))
      );
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
      .subscribe((status) => {
        if (!mounted.current) return;
        setTerhubung(status === 'SUBSCRIBED');
      });

    return () => {
      setTerhubung(false);
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
      // Tanggal dikirim eksplisit, bukan diserahkan ke default kolom. Kalau
      // pengguna sedang melihat tanggal lain lalu menambah tugas, tugas itu
      // harus masuk ke tanggal yang sedang dilihat, bukan ke hari ini.
      const { error } = await supabase
        .from('todos')
        .insert({
          pemilik_id: userId,
          teks: isi,
          tanggal,
          selesai: false,
        });

      if (error) {
        showToast(`Gagal menambah: ${error.message}`, 'galat');
        return;
      }

      setTeks('');
      await muat();
    } finally {
      setMenambah(false);
    }
  }, [teks, userId, tanggal, muat]);

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


  // Id tugas yang sedang diedit, kosong berarti tidak ada edit yang berjalan.
  const [editId, setEditId] = useState('');
  const [editDraf, setEditDraf] = useState('');

  // Tugas yang sedang menunggu persetujuan hapus.
  const [hapusTarget, setHapusTarget] = useState<Todo | null>(null);
  const [hapusSibuk, setHapusSibuk] = useState(false);

  const mulaiEdit = useCallback((todo: Todo) => {
    setEditId(todo.id);
    setEditDraf(todo.teks);
  }, []);

  const batalEdit = useCallback(() => {
    setEditId('');
    setEditDraf('');
  }, []);

  const simpanEdit = useCallback(async () => {
    const isi = editDraf.trim();
    if (!editId || !isi) return;

    const id = editId;
    const sebelum = daftar.find((item) => item.id === id);

    // Terapkan di layar lebih dulu supaya terasa cepat, lalu cocokkan dengan
    // jawaban server. Kalau gagal, kembalikan seperti semula.
    setDaftar((lama) =>
      lama.map((item) => (item.id === id ? { ...item, teks: isi } : item))
    );
    batalEdit();

    const { error } = await supabase
      .from('todos')
      .update({ teks: isi })
      .eq('id', id);

    if (error) {
      if (sebelum) {
        setDaftar((lama) =>
          lama.map((item) => (item.id === id ? sebelum : item))
        );
      }
      showToast('Gagal menyimpan perubahan: ' + error.message, 'galat');
      return;
    }

    showToast('Tugas diperbarui.', 'sukses');
  }, [editId, editDraf, daftar, batalEdit]);

  const hapus = useCallback(async () => {
    if (!hapusTarget) return;

    const target = hapusTarget;
    setHapusSibuk(true);

    try {
      const { data, error } = await supabase
        .from('todos')
        .delete()
        .eq('id', target.id)
        .select('id');

      if (error) {
        showToast('Gagal menghapus: ' + error.message, 'galat');
        return;
      }

      // RLS membuat delete diam-diam tidak menghapus apa pun kalau policy-nya
      // tidak cocok. Tanpa pemeriksaan ini, layar akan menampilkan tugas hilang
      // padahal di server masih ada, lalu muncul lagi saat dimuat ulang.
      if (!data?.length) {
        showToast('Tugas tidak terhapus. Periksa aturan RLS di schema.sql.', 'galat');
        return;
      }

      setDaftar((lama) => lama.filter((item) => item.id !== target.id));
      showToast('Tugas dihapus.', 'sukses');
      setHapusTarget(null);
    } finally {
      setHapusSibuk(false);
    }
  }, [hapusTarget]);

  // Semua angka di layar memakai daftar yang sedang terlihat, bukan seluruh
  // data. Kalau tidak, ringkasan progres akan menghitung tugas yang tidak
  // terlihat dan langsung bertentangan dengan daftarnya. Di-memo supaya bagian
  // ini tidak dihitung ulang tiap huruf yang diketik di kolom input.
  const terlihat = useMemo(
    () => visibleTugas(daftar, tab, tanggal),
    [daftar, tab, tanggal]
  );
  const { belum, sudah, persen } = useMemo(
    () => kelompokTugas(terlihat),
    [terlihat]
  );
  const bisaTambah = teks.trim().length > 0 && !menambah;
  const jumlahHariIni = tanggal === tanggalHariIni();
  // Kosong mencakup dua keadaan: belum punya tugas sama sekali, dan punya
  // tugas tapi tidak ada yang cocok dengan tanggal yang sedang dilihat.
  const kosong = !memuat && terlihat.length === 0 && !galat;

  // Callback yang dipakai semua baris. Identitasnya stabil supaya BarisTugas
  // yang di-memo tidak di-render ulang tiap ganti menit/ketikan.
  const hapusTugas = useCallback((todo: Todo) => {
    setHapusTarget(todo);
  }, []);
  const tidakApa = useCallback(() => {}, []);

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
          {terlihat.length === 0
            ? 'Tidak ada tugas di daftar ini.'
            : belum.length === 0
              ? 'Semua tugas sudah selesai.'
              : `${belum.length} belum selesai`}
        </Text>

        <LampuRealtime terhubung={terhubung} />

        {/* Tab tanggal */}
        <View className="mt-5 flex-row gap-2">
          {TAB_TUGAS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              aktif={tab === item.id}
              onPress={() => setTab(item.id)}
            />
          ))}
        </View>

        {/* Tanggal yang sedang dilihat */}
        {tab === 'tanggal' ? (
          <PilihTanggal nilai={tanggal} onUbah={setTanggal} />
        ) : null}

        {/* Ringkasan progres */}
        {terlihat.length > 0 ? (
          <Card size="sm" className="mt-5 overflow-hidden rounded-[28px] border-bw-line bg-bw-card p-5 gap-0">
            <View className="flex-row items-end justify-between">
              <View className="flex-1">
                <Text className="text-xs font-bold uppercase tracking-widest text-bw-muted">
                  Progres
                </Text>
                <Text className="mt-1 text-2xl font-extrabold text-bw-ink">
                  {sudah.length}
                  <Text className="text-base font-semibold text-bw-muted">
                    {' '}
                    / {terlihat.length} selesai
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
          </Card>
        ) : null}

        {/* Input tugas baru */}
        <View className="mt-5 flex-row gap-2.5">
          <Input
            className="h-14 flex-1 border-2 border-bw-line bg-bw-card px-4 data-[focus=true]:border-bw-blue data-[focus=true]:web:ring-0"
          >
            <InputSlot>
              <Ikon nama="create-outline" token="bw-muted" ukuran={18} />
            </InputSlot>
            <InputField
              value={teks}
              onChangeText={setTeks}
              placeholder="Tulis tugas baru..."
              placeholderTextColor="#9a9aa0"
              accessibilityLabel="Tulis tugas baru"
              onSubmitEditing={tambah}
              returnKeyType="done"
              className="flex-1 text-base text-bw-ink"
              inputMode="text"
            />
          </Input>
          <Button
            accessibilityLabel="Tambah tugas"
            onPress={tambah}
            isDisabled={!bisaTambah}
            className={`h-14 w-14 flex-row items-center justify-center rounded-2xl ${
              bisaTambah
                ? 'bg-bw-blue data-[hover=true]:bg-bw-blue-hi data-[active=true]:bg-bw-blue-hi'
                : 'bg-bw-line data-[hover=true]:bg-bw-line'
            }`}
          >
            <Ikon
              nama="add"
              ukuran={26}
              token={bisaTambah ? 'bw-blue-50' : 'bw-muted'}
            />
          </Button>
        </View>

        {/* Galat */}
        {galat ? (
          <Card
            size="sm"
            accessibilityRole="alert"
            className="mt-5 overflow-hidden rounded-3xl border-bw-red-100 bg-bw-red-50 p-4 gap-0"
          >
            <View className="flex-row items-center gap-2">
              <Ikon nama="alert-circle-outline" token="bw-red" ukuran={18} />
              <Text className="flex-1 text-sm font-bold text-bw-red">
                Tugas tidak bisa dimuat.
              </Text>
            </View>
            <Text className="mt-1.5 text-xs leading-relaxed text-bw-red">{galat}</Text>
            <Button
              onPress={muat}
              accessibilityLabel="Coba lagi muat tugas"
              className="mt-3 h-12 rounded-2xl bg-bw-red-solid data-[hover=true]:bg-bw-red data-[active=true]:bg-bw-red"
            >
              <ButtonText className="text-sm font-bold text-white">Coba lagi</ButtonText>
            </Button>
          </Card>
        ) : null}

        {/* Memuat */}
        {memuat && daftar.length === 0 ? (
          <Text className="mt-10 text-center text-sm text-bw-muted">Memuat...</Text>
        ) : null}

        {/* Kosong */}
        {kosong ? (
          <Card
            size="sm"
            className="mt-8 items-center overflow-hidden rounded-[28px] border-dashed border-bw-line bg-bw-card px-6 py-12 gap-0"
          >
            <View className="h-16 w-16 items-center justify-center rounded-full bg-bw-surface">
              <Ikon
                nama={jumlahHariIni ? 'calendar-outline' : 'checkmark-done-outline'}
                token="bw-muted"
                ukuran={30}
              />
            </View>
            <Text className="mt-4 text-base font-bold text-bw-ink">
              {jumlahHariIni ? 'Belum ada tugas hari ini' : 'Belum ada tugas'}
            </Text>
            <Text className="mt-1.5 text-center text-xs leading-relaxed text-bw-muted">
              {tab === 'tanggal'
                ? jumlahHariIni
                  ? 'Tulis di kolom di atas untuk menambah tugas hari ini.'
                  : `Belum ada tugas pada ${formatTanggalPanjang(tanggal)}.`
                : 'Daftar tugas masih kosong.'}
            </Text>
          </Card>
        ) : null}

        {/* Belum selesai */}
        {belum.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-2.5 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
              Belum selesai ({belum.length})
            </Text>
            <View className="gap-2.5">
              {belum.map((todo) => (
                <BarisTugas
                  key={todo.id}
                  todo={todo}
                  tampilkanTanggal={tab === 'semua'}
                  onAlih={alihkan}
                  sedangEdit={editId === todo.id}
                  draf={editId === todo.id ? editDraf : ''}
                  onUbahDraf={setEditDraf}
                  onMulaiEdit={mulaiEdit}
                  onBatalEdit={batalEdit}
                  onSimpanEdit={editId === todo.id ? simpanEdit : tidakApa}
                  onHapus={hapusTugas}
                />
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
                <BarisTugas
                  key={todo.id}
                  todo={todo}
                  tampilkanTanggal={tab === 'semua'}
                  onAlih={alihkan}
                  sedangEdit={editId === todo.id}
                  draf={editId === todo.id ? editDraf : ''}
                  onUbahDraf={setEditDraf}
                  onMulaiEdit={mulaiEdit}
                  onBatalEdit={batalEdit}
                  onSimpanEdit={editId === todo.id ? simpanEdit : tidakApa}
                  onHapus={hapusTugas}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

        <DialogKonfirmasi
          terbuka={Boolean(hapusTarget)}
          judul="Hapus tugas?"
          pesan={
            hapusTarget
              ? '"' + hapusTarget.teks + '" akan dihapus. Tindakan ini tidak bisa dibatalkan.'
              : ''
          }
          sibuk={hapusSibuk}
          onBatal={() => setHapusTarget(null)}
          onSetuju={hapus}
        />
    </SafeAreaView>
  );
}

// Baris tugas di-memo: pada layar yang me-render ulang tiap huruf diketik,
// baris yang tidak berubah tidak perlu membangun kembali pohonnya lagi.
const BarisTugas = memo(function BarisTugas({
  todo,
  tampilkanTanggal,
  onAlih,
  sedangEdit,
  draf,
  onUbahDraf,
  onMulaiEdit,
  onBatalEdit,
  onSimpanEdit,
  onHapus,
}: {
  todo: Todo;
  tampilkanTanggal: boolean;
  onAlih: (todo: Todo) => void;
  sedangEdit: boolean;
  draf: string;
  onUbahDraf: (nilai: string) => void;
  onMulaiEdit: (todo: Todo) => void;
  onBatalEdit: () => void;
  onSimpanEdit: () => void;
  onHapus: (todo: Todo) => void;
}) {
  const [menuTerbuka, setMenuTerbuka] = useState(false);

  // Mode edit mengganti seluruh isi baris dengan kolom teks. Menu sebaris membuat
  // satu langkah lebih sedikit daripada dialog kedua: tugas ini milik satu
  // orang, teksnya pendek, dan tidak ada yang perlu diisi selain teks.
  if (sedangEdit) {
    return (
      <Card
        size="sm"
        className="flex-col overflow-hidden rounded-3xl border-bw-blue bg-bw-card p-3.5 gap-0"
      >
        <TextInput
          value={draf}
          onChangeText={onUbahDraf}
          autoFocus
          multiline
          accessibilityLabel="Ubah teks tugas"
          placeholder="Ubah teks tugas"
          placeholderTextColor="#8e8e93"
          className="min-h-20 rounded-2xl border border-bw-line bg-bw-surface px-3.5 py-3 text-[15px] text-bw-ink"
        />

        <View className="mt-2.5 flex-row gap-2">
          <TombolAksi
            label="Batal"
            ikon="close"
            onPress={onBatalEdit}
            className="flex-1 border border-bw-line bg-bw-surface"
          />
          <TombolAksi
            label="Simpan"
            ikon="checkmark"
            onPress={onSimpanEdit}
            nonaktif={draf.trim().length === 0}
            className="flex-1 bg-bw-blue"
            teksPutih
          />
        </View>
      </Card>
    );
  }

  return (
    <Card
      size="sm"
      className={`min-h-16 flex-row items-center gap-3.5 overflow-hidden rounded-3xl border-bw-line bg-bw-card px-4 py-3.5 gap-0 ${
        todo.selesai ? 'opacity-70' : ''
      }`}
    >
      <Pressable
        onPress={() => onAlih(todo)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: todo.selesai }}
        accessibilityLabel={todo.teks}
        android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
        className="min-w-0 flex-1 flex-row items-center gap-3.5"
      >
        <View
          className={`h-8 w-8 items-center justify-center rounded-full border-2 ${
            todo.selesai
              ? 'border-bw-green bg-bw-green'
              : 'border-bw-line bg-transparent'
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
          {/* Tanggal per baris hanya perlu tampil di tab semua. Di tab
              tanggal dipilih semua baris sudah jelas tanggalnya dari header. */}
          {tampilkanTanggal && todo.tanggal ? (
            <View className="mt-1 flex-row items-center gap-1">
              <Ikon nama="calendar-outline" token="bw-muted" ukuran={12} />
              <Text className="text-xs text-bw-muted">
                {formatTanggalPanjang(todo.tanggal)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {menuTerbuka ? (
        <View className="flex-row gap-2">
          <TombolAksi
            label="Ubah"
            ikon="create-outline"
            onPress={() => {
              setMenuTerbuka(false);
              onMulaiEdit(todo);
            }}
            className="border border-bw-line bg-bw-surface"
          />
          <TombolAksi
            label="Hapus"
            ikon="trash-outline"
            onPress={() => {
              setMenuTerbuka(false);
              onHapus(todo);
            }}
            className="border border-bw-red-100 bg-bw-red-50"
          />
        </View>
      ) : (
        <Pressable
          onPress={() => setMenuTerbuka(true)}
          accessibilityRole="button"
          accessibilityLabel={`Ubah atau hapus tugas ${todo.teks}`}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center rounded-full active:opacity-70"
        >
          <Ikon nama="ellipsis-horizontal" token="bw-muted" ukuran={20} />
        </Pressable>
      )}
    </Card>
  );
});

function TombolAksi({
  label,
  ikon,
  onPress,
  className,
  nonaktif = false,
  teksPutih = false,
}: {
  label: string;
  ikon: Parameters<typeof Ikon>[0]['nama'];
  onPress: () => void;
  className: string;
  nonaktif?: boolean;
  teksPutih?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={nonaktif}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 flex-row items-center justify-center gap-1.5 rounded-2xl px-3.5 active:opacity-80 ${
        className
      } ${nonaktif ? 'opacity-50' : ''}`}
    >
      <Ikon nama={ikon} ukuran={15} token={teksPutih ? 'bw-blue-50' : 'bw-ink-2'} />
      <Text
        className={`text-sm font-bold ${teksPutih ? 'text-white' : 'text-bw-ink-2'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  aktif,
  onPress,
}: {
  label: string;
  aktif: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: aktif }}
      className={`h-10 flex-1 items-center justify-center rounded-full border px-4 active:opacity-70 ${
        aktif ? 'border-bw-blue bg-bw-blue' : 'border-bw-line bg-bw-card'
      }`}
    >
      <Text
        numberOfLines={1}
        className={`text-xs font-bold ${aktif ? 'text-white' : 'text-bw-ink-2'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
