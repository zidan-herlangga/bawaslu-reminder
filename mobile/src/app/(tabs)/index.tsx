import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DialogKonfirmasi } from '../../komponen/DialogKonfirmasi';
import { Ikon } from '../../komponen/Ikon';
import { KartuJadwal } from '../../komponen/KartuJadwal';
import { ModalDetail } from '../../komponen/ModalDetail';
import { apiUrl } from '../../lib/api';
import { useSesi } from '../../lib/session';
import { showToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';
import { useJadwal } from '../../lib/useJadwal';
import { formatJam, formatSisa } from '../../shared/formatWaktu';
import { DIVISI_OPTIONS, DIVISI_SHORT } from '../../shared/options';
import { sortByAgenda, type Jadwal, type Slot } from '../../shared/slots';

// Beranda: daftar jadwal.
//
// Dua aturan yang dibawa dari web dan tidak diubah di sini:
//
// - Jadwal yang waktunya sudah lewat tidak disembunyikan, tapi dipindahkan ke
//   bawah dan diberi lencana Selesai. Disembunyikan membuat orang bertanya "kok
//   jadwal kemarin tidak ada", padahal memang sudah tidak perlu dipantau
// - Pengurutan memakai sortByAgenda dari shared/slots, yang sama dipakai web.
//   Kalau aturannya berbeda, orang bisa melihat urutan berbeda untuk data yang
//   sama di dua perangkat

const KELIP_MS = 30 * 1000;

export default function LayarBeranda() {
  const router = useRouter();
  const { session } = useSesi();
  const userId = session?.user.id ?? null;

  const { jadwal, memuat, galat, muatUlang } = useJadwal(userId);

  const [now, setNow] = useState(() => Date.now());
  const [divisi, setDivisi] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ jadwal: Jadwal; sesi: Slot | null } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<Jadwal | null>(null);
  const [hapusSibuk, setHapusSibuk] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);

  // Waktu berjalan diperbarui tiap 30 detik supaya lencana Selesai muncul
  // tanpa pengguna harus membuka ulang layar. Interval harus dibersihkan saat
  // layar ditutup, kalau tidak ia tetap berjalan di latar.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), KELIP_MS);
    return () => clearInterval(timer);
  }, []);

  const terlihat = useMemo(() => {
    const dasar = divisi
      ? jadwal.filter((item) => item.pembuat_divisi === divisi)
      : jadwal;
    return sortByAgenda(dasar, now);
  }, [jadwal, divisi, now]);

  const berikutnya = useMemo(() => {
    for (const item of terlihat) {
      if (item.status !== 'Aktif') continue;

      const sesi = (
        Array.isArray(item.slots) ? item.slots : []
      )
        .filter((s): s is Slot => Boolean(s?.mulai))
        .find((s) => new Date(s.mulai).getTime() > now);

      if (sesi) return { item, sesi };
    }
    return null;
  }, [terlihat, now]);

  const segarkan = useCallback(async () => {
    setMenyegarkan(true);
    try {
      setNow(Date.now());
      await muatUlang({ senyap: true });
    } finally {
      setMenyegarkan(false);
    }
  }, [muatUlang]);

  /**
   * Mengirim pengingat lewat endpoint yang sama dengan web: POST /api/notify
   * dengan scheduleId dan token sesi. Endpoint itu ada di serverless Vercel,
   * jadi tidak perlu backend baru untuk tahap ini.
   */
  const ingatkan = useCallback(async (item: Jadwal) => {
    try {
      const { data, error } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        showToast('Sesi berakhir. Silakan keluar lalu masuk kembali.', 'galat');
        return;
      }

      const respons = await fetch(apiUrl('/api/notify'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scheduleId: item.id }),
      });

      if (!respons.ok) {
        showToast(`Gagal mengirim (HTTP ${respons.status}).`, 'galat');
        return;
      }

      showToast('Pengingat dikirim ke staf.', 'sukses');
    } catch (galatKirim) {
      showToast(`Gagal mengirim: ${String(galatKirim)}`, 'galat');
    }
  }, []);

  const hapus = useCallback(async () => {
    if (!konfirmasi) return;
    setHapusSibuk(true);

    try {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', konfirmasi.id);

      if (error) {
        showToast(`Gagal menghapus: ${error.message}`, 'galat');
        return;
      }

      showToast('Jadwal dihapus.', 'sukses');
      setDetail(null);
      await muatUlang({ senyap: true });
    } finally {
      setHapusSibuk(false);
      setKonfirmasi(null);
    }
  }, [konfirmasi, muatUlang]);

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={menyegarkan}
            onRefresh={segarkan}
            tintColor="#6b6b70"
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View className="min-w-0 flex-1 pr-3">
            <Text className="text-3xl font-extrabold tracking-tight text-bw-ink">
              Jadwal
            </Text>
            <Text className="mt-1 text-sm text-bw-muted">
              {terlihat.length} jadwal ditampilkan
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={segarkan}
              accessibilityRole="button"
              accessibilityLabel="Segarkan jadwal"
              className="h-12 w-12 items-center justify-center rounded-full border border-bw-line bg-bw-card active:opacity-70"
            >
              <Ikon nama="refresh" token="bw-ink-2" ukuran={20} />
            </Pressable>

            <Pressable
              onPress={() => router.push('/jadwal/baru')}
              accessibilityRole="button"
              accessibilityLabel="Buat jadwal baru"
              className="h-12 flex-row items-center justify-center gap-1 rounded-full bg-bw-blue px-5 active:opacity-80"
            >
              <Ikon nama="add" token="bw-blue-50" ukuran={20} />
              <Text className="text-sm font-bold text-white">Buat</Text>
            </Pressable>
          </View>
        </View>

        {/* Filter divisi */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 mt-4 grow-0"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
        >
          <FilterChip
            label="Semua"
            aktif={divisi === null}
            onPress={() => setDivisi(null)}
          />
          {DIVISI_OPTIONS.map((nama) => (
            <FilterChip
              key={nama}
              label={DIVISI_SHORT[nama] ?? nama}
              aktif={divisi === nama}
              onPress={() => setDivisi(divisi === nama ? null : nama)}
            />
          ))}
        </ScrollView>

        {/* Jadwal berikutnya */}
        {berikutnya ? (
          <View className="mt-5 rounded-[28px] bg-bw-blue p-5">
            <View className="flex-row items-center gap-2">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Ikon nama="alarm" token="bw-blue-50" ukuran={16} />
              </View>
              <Text className="text-xs font-bold uppercase tracking-widest text-white/80">
                Berikutnya
              </Text>
            </View>
            <Text className="mt-3 text-xl font-extrabold text-white" numberOfLines={2}>
              {berikutnya.item.judul}
            </Text>
            <View className="mt-3 flex-row items-center self-start rounded-full bg-white/20 px-3 py-1.5">
              <Text className="text-xs font-bold text-white">
                {formatJam(berikutnya.sesi.mulai)} ·{' '}
                {formatSisa(new Date(berikutnya.sesi.mulai).getTime(), now)}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Galat */}
        {galat ? (
          <View
            accessibilityRole="alert"
            className="mt-5 rounded-3xl border border-bw-red-100 bg-bw-red-50 p-4"
          >
            <View className="flex-row items-center gap-2">
              <Ikon nama="alert-circle-outline" token="bw-red" ukuran={18} />
              <Text className="text-sm font-bold text-bw-red">
                Jadwal tidak bisa dimuat.
              </Text>
            </View>
            <Text className="mt-1.5 text-xs leading-relaxed text-bw-red">{galat}</Text>
            <Pressable
              onPress={() => muatUlang()}
              accessibilityRole="button"
              className="mt-3 h-12 items-center justify-center rounded-2xl bg-bw-red-solid active:opacity-80"
            >
              <Text className="text-sm font-bold text-white">Coba lagi</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Memuat */}
        {memuat && terlihat.length === 0 ? (
          <Text className="mt-10 text-center text-sm text-bw-muted">
            Memuat jadwal...
          </Text>
        ) : null}

        {/* Kosong */}
        {!memuat && terlihat.length === 0 && !galat ? (
          <View className="mt-8 items-center rounded-[28px] border border-dashed border-bw-line bg-bw-card px-6 py-12">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-bw-surface">
              <Ikon nama="calendar-outline" token="bw-muted" ukuran={30} />
            </View>
            <Text className="mt-4 text-base font-bold text-bw-ink">
              Belum ada jadwal
            </Text>
            <Text className="mt-1.5 text-center text-xs leading-relaxed text-bw-muted">
              Belum ada pengingat yang perlu dipantau. Jadwal baru dibuat dari
              aplikasi web.
            </Text>
          </View>
        ) : null}

        {/* Daftar */}
        <View className="mt-5 gap-3">
          {terlihat.map((item) => (
            <KartuJadwal
              key={item.id}
              jadwal={item}
              now={now}
              milikSaya={item.pembuat_id === userId}
              onDetail={() => setDetail({ jadwal: item, sesi: null })}
              onIngatkan={() => ingatkan(item)}
              onUbah={() => router.push(`/jadwal/${item.id}`)}
              onHapus={() => setKonfirmasi(item)}
            />
          ))}
        </View>
      </ScrollView>

      <ModalDetail
        terbuka={Boolean(detail)}
        jadwal={detail?.jadwal ?? null}
        sesi={detail?.sesi ?? null}
        now={now}
        milikSaya={detail ? detail.jadwal.pembuat_id === userId : false}
        onTutup={() => setDetail(null)}
        onIngatkan={detail ? () => ingatkan(detail.jadwal) : undefined}
        onUbah={
          detail ? () => router.push(`/jadwal/${detail.jadwal.id}`) : undefined
        }
        onHapus={detail ? () => setKonfirmasi(detail.jadwal) : undefined}
      />

      <DialogKonfirmasi
        terbuka={Boolean(konfirmasi)}
        judul="Hapus jadwal?"
        pesan={
          konfirmasi
            ? `"${konfirmasi.judul}" akan dihapus untuk semua staf. Tindakan ini tidak bisa dibatalkan.`
            : ''
        }
        sibuk={hapusSibuk}
        onBatal={() => setKonfirmasi(null)}
        onSetuju={hapus}
      />
    </SafeAreaView>
  );
}

function FilterChip({
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
      accessibilityRole="button"
      accessibilityState={{ selected: aktif }}
      className={`h-10 justify-center rounded-full border px-4 active:opacity-70 ${
        aktif ? 'border-bw-blue bg-bw-blue' : 'border-bw-line bg-bw-card'
      }`}
    >
      <Text
        className={`text-xs font-bold ${aktif ? 'text-white' : 'text-bw-ink-2'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}