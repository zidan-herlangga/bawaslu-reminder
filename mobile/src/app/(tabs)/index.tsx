import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import SafeAreaView from '../../komponen/SafeAreaView';
import { Button, ButtonText } from '../../components/ui/button';
import { DialogKonfirmasi } from '../../komponen/DialogKonfirmasi';
import { Ikon } from '../../komponen/Ikon';
import { KartuJadwal } from '../../komponen/KartuJadwal';
import { KotakNotifikasi } from '../../komponen/KotakNotifikasi';
import { LampuRealtime } from '../../komponen/LampuRealtime';
import { ModalDetail } from '../../komponen/ModalDetail';
import { TombolNotifikasi } from '../../komponen/TombolNotifikasi';
import { beriTahuStaf } from '../../lib/kabarStaf';
import { useSesi } from '../../lib/session';
import { showToast } from '../../lib/toast';
import { supabase } from '../../lib/supabase';
import { useJadwal } from '../../lib/useJadwal';
import { useKotakNotifikasi } from '../../lib/useKotakNotifikasi';
import { formatJam, formatSisa } from '../../shared/formatWaktu';
import { DIVISI_OPTIONS, DIVISI_SHORT } from '../../shared/options';
import { sortByAgenda, type Jadwal, type Slot } from '../../shared/slots';
import { dapatkanLiburPerTanggal } from '../../shared/hariLibur';

const KELIP_MS = 30 * 1000;

export default function LayarBeranda() {
  const router = useRouter();
  const { session } = useSesi();
  const userId = session?.user.id ?? null;

  const { jadwal, memuat, galat, terhubung, muatUlang } = useJadwal(userId);

  const {
    notifikasi,
    belumDibaca,
    memuat: notifikasiMemuat,
    galat: notifikasiGalat,
    tandaiDibaca,
    tandaiSemuaDibaca,
    hapus: hapusNotifikasi,
    hapusSemua: hapusSemuaNotifikasi,
    muatUlang: muatNotifikasi,
  } = useKotakNotifikasi(userId);
  const [kotakTerbuka, setKotakTerbuka] = useState(false);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const [divisi, setDivisi] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ jadwal: Jadwal; sesi: Slot | null } | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<Jadwal | null>(null);
  const [hapusSibuk, setHapusSibuk] = useState(false);
  const [menyegarkan, setMenyegarkan] = useState(false);

  useEffect(() => {
    // Dibulatkan ke menit: jam/sisa waktu ditampilkan dengan presisi menit,
    // jadi setNow dengan nilai jamak dalam satu menit yang sama membuat React
    // membatalkan re-render (nilainya sama), hanya menit baru yang me-render.
    const timer = setInterval(
      () => setNow(Math.floor(Date.now() / 60000) * 60000),
      KELIP_MS
    );
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

      // Urutkan slot berdasarkan waktu mulai agar selalu mendapatkan slot terdekat
      const sortedSlots = (
        Array.isArray(item.slots) ? item.slots : []
      )
        .filter((s): s is Slot => Boolean(s?.mulai))
        .sort((a, b) => new Date(a.mulai).getTime() - new Date(b.mulai).getTime());

      const sesi = sortedSlots.find((s) => new Date(s.mulai).getTime() > now);

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

  const ingatkan = useCallback(async (item: Jadwal) => {
    const hasil = await beriTahuStaf(item.id);
    showToast(
      hasil.ok ? 'Pengingat dikirim ke staf.' : `Gagal mengirim. ${hasil.alasan}`,
      hasil.ok ? 'sukses' : 'galat'
    );
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
      setKonfirmasi(null);
      await muatUlang({ senyap: true });
    } catch (e) {
      showToast('Terjadi kesalahan yang tidak terduga.', 'galat');
    } finally {
      setHapusSibuk(false);
    }
  }, [konfirmasi, muatUlang]);

  // Callback stabil per jadwal: berlapis saat panggil via WadahKartuJadwal
  // supaya prop kartu tidak berganti identitas tiap render layar.
  const bukaDetail = useCallback((item: Jadwal) => {
    setDetail({ jadwal: item, sesi: null });
  }, []);

  const ubahJadwal = useCallback(
    (item: Jadwal) => router.push(`/jadwal/${item.id}`),
    [router]
  );

  const hapusJadwal = useCallback((item: Jadwal) => {
    setKonfirmasi(item);
  }, []);

  const liburHariIni = useMemo(() => {
    const hariIniDate = new Date(now);
    return dapatkanLiburPerTanggal(
      hariIniDate.getFullYear(),
      hariIniDate.getMonth(),
      hariIniDate.getDate()
    );
  }, [now]);

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

            <LampuRealtime terhubung={terhubung} />
          </View>

          <View className="flex-row items-center gap-2">
            <Button
              variant="outline"
              size="lg"
              onPress={segarkan}
              accessibilityLabel="Segarkan jadwal"
              className="h-12 w-12 rounded-full border-bw-line bg-bw-card px-0"
            >
              <Ikon nama="refresh" token="bw-ink-2" ukuran={20} />
            </Button>

            <TombolNotifikasi
              belumDibaca={belumDibaca}
              onPress={() => setKotakTerbuka(true)}
            />

            <Button
              variant="default"
              size="lg"
              onPress={() => router.push('/jadwal/baru')}
              accessibilityLabel="Buat jadwal baru"
              className="h-12 flex-row gap-1 rounded-full px-5 bg-bw-blue data-[hover=true]:bg-bw-blue-hi data-[active=true]:bg-bw-blue-hi"
            >
              <Ikon nama="add" token="bw-blue-50" ukuran={20} />
              <ButtonText className="text-sm font-bold text-white">Buat</ButtonText>
            </Button>
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
        {(() => {
          if (!berikutnya && liburHariIni.length === 0) return null;
          return (
            <View className={`mt-5 overflow-hidden rounded-[28px] ${berikutnya ? 'bg-bw-blue' : 'bg-bw-card border border-bw-line'}`}>
              <View className="p-5">
                {berikutnya ? (
                  <>
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
                        {formatJam(berikutnya.sesi.mulai)} -{' '}
                        {formatSisa(new Date(berikutnya.sesi.mulai).getTime(), now)}
                      </Text>
                    </View>
                  </>
                ) : null}
                {liburHariIni.length > 0 && (
                  <View className={berikutnya ? 'mt-4 border-t border-white/20 pt-4' : ''}>
                    <View className="flex-row items-center gap-2">
                      <View className={`h-8 w-8 items-center justify-center rounded-full ${berikutnya ? 'bg-white/20' : 'bg-bw-red-50'}`}>
                        <Ikon nama="calendar" token={berikutnya ? 'bw-blue-50' : 'bw-red'} ukuran={16} />
                      </View>
                      <Text className={`text-xs font-bold uppercase tracking-widest ${berikutnya ? 'text-white/80' : 'text-bw-muted'}`}>
                        Hari Ini
                      </Text>
                    </View>
                    <View className="mt-2.5 flex-col gap-1.5">
                      {liburHariIni.map((l, idx) => (
                        <Text key={idx} className={`text-sm font-semibold ${berikutnya ? 'text-white' : 'text-bw-ink'}`} numberOfLines={2}>
                          {l.tipe === 'libur_nasional' ? 'Libur Nasional' : l.tipe === 'cuti_bersama' ? 'Cuti Bersama' : 'Acara'}: {l.nama}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

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
            <Button
              variant="default"
              onPress={() => muatUlang()}
              accessibilityLabel="Coba lagi muat jadwal"
              className="mt-3 h-12 rounded-2xl bg-bw-red-solid data-[hover=true]:bg-bw-red-solid data-[active=true]:bg-bw-red-solid"
            >
              <ButtonText className="text-sm font-bold text-white">Coba lagi</ButtonText>
            </Button>
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
              Belum ada pengingat yang perlu dipantau. Ketuk tombol &quot;Buat&quot; di atas untuk menambahkan jadwal baru.
            </Text>
          </View>
        ) : null}

        {/* Daftar */}
        <View className="mt-5 gap-3">
          {terlihat.map((item) => (
            <WadahKartuJadwal
              key={item.id}
              item={item}
              now={now}
              milikSaya={item.pembuat_id === userId}
              onDetail={bukaDetail}
              onIngatkan={ingatkan}
              onUbah={ubahJadwal}
              onHapus={hapusJadwal}
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

      <KotakNotifikasi
        terbuka={kotakTerbuka}
        notifikasi={notifikasi}
        belumDibaca={belumDibaca}
        memuat={notifikasiMemuat}
        galat={notifikasiGalat}
        onTutup={() => setKotakTerbuka(false)}
        onBukaJadwal={(jadwalId) => {
          setKotakTerbuka(false);
          router.push(`/jadwal/${jadwalId}`);
        }}
        onTandaiDibaca={(id) => {
          void tandaiDibaca(id);
        }}
        onTandaiSemuaDibaca={() => {
          void tandaiSemuaDibaca();
        }}
        onHapusSemua={() => {
          void hapusSemuaNotifikasi();
        }}
        onHapus={(id) => {
          void hapusNotifikasi(id);
        }}
        onCobaLagi={() => {
          void muatNotifikasi();
        }}
      />
    </SafeAreaView>
  );
}

// Pembungkus memo untuk satu KartuJadwal. Callback-nya dibuat stabil per item,
// jadi kartu hanya di-render ulang kalau datanya benar-benar berubah (misalnya
// saat daftar jadwal dimuat ulang), bukan untuk tiap re-render layar.
const WadahKartuJadwal = memo(function WadahKartuJadwal({
  item,
  now,
  milikSaya,
  onDetail,
  onIngatkan,
  onUbah,
  onHapus,
}: {
  item: Jadwal;
  now: number;
  milikSaya: boolean;
  onDetail: (item: Jadwal) => void;
  onIngatkan: (item: Jadwal) => void;
  onUbah: (item: Jadwal) => void;
  onHapus: (item: Jadwal) => void;
}) {
  const detail = useCallback(() => onDetail(item), [onDetail, item]);
  const ingatkan = useCallback(() => onIngatkan(item), [onIngatkan, item]);
  const ubah = useCallback(() => onUbah(item), [onUbah, item]);
  const hapus = useCallback(() => onHapus(item), [onHapus, item]);

  return (
    <KartuJadwal
      jadwal={item}
      now={now}
      milikSaya={milikSaya}
      onDetail={detail}
      onIngatkan={ingatkan}
      onUbah={ubah}
      onHapus={hapus}
    />
  );
});

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