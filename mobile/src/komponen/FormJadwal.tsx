import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarisSlot, type BidangSlot } from './BarisSlot';
import { Ikon } from './Ikon';
import { beriTahuStaf } from '../lib/kabarStaf';
import { showToast } from '../lib/toast';
import { supabase } from '../lib/supabase';
import { DIVISI_OPTIONS, DIVISI_SHORT, KATEGORI_OPTIONS } from '../shared/options';
import {
  SLOT_KOSONG,
  galatPertama,
  susunPayload,
  validasiJadwal,
  type FormJadwal,
  type GalatJadwal,
} from '../shared/validasiJadwal';

// Formulir jadwal, dipakai bersama oleh layar tambah dan layar ubah.
//
// Satu komponen untuk dua mode, bukan dua berkas yang mirip. Aturan validasinya
// berasal dari shared/validasiJadwal, yang sama dengan validate() di
// ScheduleForm.jsx milik web, jadi jadwal yang ditolak di sini pasti ditolak
// juga di sana.
//
// Perbedaan dari web yang perlu diketahui: tanggal dan jam dipilih terpisah
// lewat dialog sistem, karena React Native tidak punya padanan
// <input type="datetime-local">. Detail pilihannya ada di BarisSlot.

export interface ProfilPembuat {
  namaLengkap: string | null;
  divisi: string | null;
}

export type ModeForm = 'buat' | 'ubah';

export default function FormJadwal({
  mode,
  idJadwal,
  nilaiAwal,
  userId,
  email,
  profil,
  onTutup,
  onSelesai,
}: {
  mode: ModeForm;
  /** Wajib saat mode 'ubah'. Bentuk FormJadwal sendiri tidak punya kolom id. */
  idJadwal?: string;
  nilaiAwal: FormJadwal;
  userId: string;
  email: string | null;
  profil: ProfilPembuat;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [form, setForm] = useState<FormJadwal>(nilaiAwal);
  const [galat, setGalat] = useState<GalatJadwal[]>([]);
  const [galatUmum, setGalatUmum] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const galatJudul = galat.find((item) => item.jenis === 'judul');
  const galatTarget = galat.find((item) => item.jenis === 'target');

  const bersihkanGalat = useCallback((kunci: keyof FormJadwal) => {
    // Nama kolom form tidak selalu sama dengan jenis galatnya:
    // targetDivisi -> 'target', slots -> 'slot'. Tanpa pemetaan ini galat
    // penerima pengingat tidak pernah hilang setelah pilihan diganti.
    const jenisGalat =
      kunci === 'targetDivisi' ? 'target' : kunci === 'slots' ? 'slot' : kunci;

    setGalat((sebelumnya) =>
      sebelumnya.filter((item) => item.jenis !== jenisGalat)
    );
    setGalatUmum('');
  }, []);

  const ubah = useCallback(
    <K extends keyof FormJadwal>(kunci: K, nilai: FormJadwal[K]) => {
      setForm((sebelumnya) => ({ ...sebelumnya, [kunci]: nilai }));
      bersihkanGalat(kunci);
    },
    [bersihkanGalat]
  );

  const ubahSlot = useCallback(
    (indeks: number, bidang: BidangSlot, nilai: Date | null) => {
      setForm((sebelumnya) => ({
        ...sebelumnya,
        slots: sebelumnya.slots.map((slot, posisi) =>
          posisi === indeks ? { ...slot, [bidang]: nilai } : slot
        ),
      }));
      setGalat((sebelumnya) =>
        sebelumnya.filter(
          (item) => item.jenis !== 'slot' || item.indeksSlot !== indeks
        )
      );
      setGalatUmum('');
    },
    []
  );

  const tambahSlot = useCallback((setelah: number) => {
    setForm((formLama) => {
      const slots = [...formLama.slots];

      // Sesi baru mengikuti tanggal sesi sebelumnya, bukan hari ini. Kalau tidak,
      // menambah sesi kedua untuk besok berarti tanggalnya harus diisi ulang
      // dari nol.
      const tanggalSebelumnya = slots[setelah]?.mulai ?? null;

      slots.splice(setelah + 1, 0, {
        ...SLOT_KOSONG,
        mulai: tanggalSebelumnya ? new Date(tanggalSebelumnya) : null,
      });

      return { ...formLama, slots };
    });
  }, []);

  const hapusSlot = useCallback((indeks: number) => {
    setForm((formLama) => {
      const slots = formLama.slots.filter((_, posisi) => posisi !== indeks);
      // Minimal satu sesi harus selalu ada. Menghapus sesi terakhir akan
      // membuat form tidak bisa disimpan sama sekali.
      return { ...formLama, slots: slots.length > 0 ? slots : [{ ...SLOT_KOSONG }] };
    });
    setGalat((sebelumnya) =>
      sebelumnya.filter((item) => item.jenis !== 'slot' || item.indeksSlot !== indeks)
    );
  }, []);

  const simpan = useCallback(async () => {
    if (menyimpan) return;

    const hasilValidasi = validasiJadwal(form);
    setGalat(hasilValidasi);
    setGalatUmum('');

    if (hasilValidasi.length > 0) {
      showToast(galatPertama(hasilValidasi), 'galat');
      return;
    }

    setMenyimpan(true);
    try {
      const payload = susunPayload(form);

      if (mode === 'ubah') {
        if (!idJadwal) {
          throw new Error('Jadwal tidak diketahui. Tutup lalu buka kembali.');
        }

        const { data, error } = await supabase
          .from('schedules')
          .update(payload)
          .eq('id', idJadwal)
          .select('id');

        if (error) throw new Error(error.message);
        if (!data?.length) {
          throw new Error(
            'Perubahan tidak tersimpan (0 baris terpengaruh). Jalankan lagi supabase/schema.sql di SQL Editor Supabase.'
          );
        }

        showToast('Perubahan jadwal tersimpan.', 'sukses');
      } else {
        const { data, error } = await supabase
          .from('schedules')
          .insert({
            ...payload,
            pembuat_id: userId,
            pembuat_nama: profil.namaLengkap || email || '',
            pembuat_divisi: profil.divisi || 'Belum diatur',
          })
          .select('id');

        if (error) throw new Error(error.message);
        if (!data?.length) {
          throw new Error(
            'Jadwal tidak tersimpan (0 baris terpengaruh). Jalankan lagi supabase/schema.sql di SQL Editor Supabase.'
          );
        }

        const baru = data[0];

        // Pemberitahuan ke staf dikirim setelah jadwal benar-benar tersimpan,
        // dan kegagalannya tidak membatalkan penyimpanan. Pesan yang ditampilkan
        // ikut menyesuaikan: sebelumnya aplikasi ini selalu menulis
        // "staf sudah diberi tahu" padahal tidak pernah memanggil server sama
        // sekali, jadi penggunanya mengira pengingat sudah terkirim.
        if (baru?.id) {
          const hasil = await beriTahuStaf(baru.id);

          if (hasil.ok) {
            showToast('Jadwal baru tersimpan dan staf sudah diberi tahu.', 'sukses');
          } else {
            showToast(
              `Jadwal tersimpan, tapi staf belum diberi tahu. ${hasil.alasan}`,
              'galat'
            );
          }
        } else {
          showToast('Jadwal baru tersimpan.', 'sukses');
        }
      }

      onSelesai();
    } catch (kesalahan) {
      const pesan =
        kesalahan instanceof Error ? kesalahan.message : String(kesalahan);
      const petunjuk = /target_divisi|schema cache|could not find/i.test(pesan)
        ? ' Jalankan lagi supabase/schema.sql (bagian 7) di SQL Editor Supabase.'
        : '';
      setGalatUmum(pesan + petunjuk);
      showToast('Jadwal gagal disimpan.', 'galat');
    } finally {
      setMenyimpan(false);
    }
  }, [form, mode, idJadwal, onSelesai, profil, email, userId, menyimpan]);

  const bisaSimpan = useMemo(
    () => !menyimpan && form.judul.trim().length > 0,
    [menyimpan, form.judul]
  );

  const labelSimpan = menyimpan
    ? 'Menyimpan...'
    : mode === 'buat'
      ? 'Simpan jadwal'
      : 'Simpan perubahan';

  return (
    <SafeAreaView className="flex-1 bg-bw-canvas" edges={['top', 'bottom']}>
      <BilahAtas
        judul={mode === 'buat' ? 'Buat jadwal' : 'Ubah jadwal'}
        onTutup={onTutup}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <Bidang label="Judul" galat={galatJudul?.pesan} wajib>
            <KolomTeks
              value={form.judul}
              onChangeText={(nilai) => ubah('judul', nilai)}
              placeholder="Rapat Koordinasi Anggaran"
              accessibilityLabel="Judul jadwal"
              adaGalat={Boolean(galatJudul)}
            />
          </Bidang>

          <Bagian label="Kategori">
            <PilihanChip
              opsi={KATEGORI_OPTIONS.map((nama) => ({ nilai: nama, label: nama }))}
              nilai={form.kategori}
              onPilih={(nilai) => ubah('kategori', nilai)}
            />
          </Bagian>

          <Bagian
            label="Penerima pengingat"
            petunjuk="Pilih divisi tertentu, atau biarkan Semua staf."
          >
            <PilihanChip
              opsi={[
                { nilai: '', label: 'Semua staf' },
                ...DIVISI_OPTIONS.map((nama) => ({
                  nilai: nama,
                  label: DIVISI_SHORT[nama] ?? nama,
                })),
              ]}
              nilai={form.targetDivisi ?? ''}
              onPilih={(nilai) => ubah('targetDivisi', nilai || null)}
              galat={galatTarget?.pesan}
            />
          </Bagian>

          <Bagian label="Keterangan">
            <KolomTeks
              value={form.deskripsi}
              onChangeText={(nilai) => ubah('deskripsi', nilai)}
              placeholder="Opsional: agenda, lokasi, apa yang perlu disiapkan"
              accessibilityLabel="Keterangan jadwal"
              multiline
            />
          </Bagian>

          <Bagian label="Tanggal dan jam">
            <View className="gap-3">
              {form.slots.map((slot, indeks) => (
                <BarisSlot
                  key={`slot-${indeks}`}
                  indeks={indeks}
                  jumlahSlot={form.slots.length}
                  nilaiMulai={slot.mulai}
                  nilaiSelesai={slot.selesai}
                  galat={galat.find((g) => g.jenis === 'slot' && g.indeksSlot === indeks)?.pesan}
                  onUbah={ubahSlot}
                  onTambah={tambahSlot}
                  onHapus={hapusSlot}
                />
              ))}
            </View>
          </Bagian>

          {galatUmum ? (
            <View
              accessibilityRole="alert"
              className="flex-row items-start gap-2.5 rounded-3xl border border-bw-red-100 bg-bw-red-50 p-4"
            >
              <Ikon nama="alert-circle-outline" token="bw-red" ukuran={18} />
              <Text className="flex-1 text-sm leading-relaxed text-bw-red">
                {galatUmum}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Tombol simpan menempel di bawah supaya selalu terjangkau jempol. */}
        <View className="border-t border-bw-line bg-bw-card px-5 pb-3 pt-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={labelSimpan}
            accessibilityState={{ disabled: !bisaSimpan, busy: menyimpan }}
            onPress={simpan}
            disabled={!bisaSimpan}
            android_ripple={bisaSimpan ? { color: 'rgba(255,255,255,0.2)' } : undefined}
            className={`h-14 flex-row items-center justify-center gap-2 rounded-2xl active:opacity-80 ${
              bisaSimpan || menyimpan ? 'bg-bw-blue' : 'bg-bw-line'
            }`}
          >
            {menyimpan ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ikon
                nama="checkmark"
                token={bisaSimpan ? 'bw-blue-50' : 'bw-muted'}
                ukuran={20}
              />
            )}
            <Text
              className={`text-base font-bold ${
                bisaSimpan || menyimpan ? 'text-white' : 'text-bw-muted'
              }`}
            >
              {labelSimpan}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BilahAtas({ judul, onTutup }: { judul: string; onTutup: () => void }) {
  return (
    <View className="flex-row items-center gap-2 border-b border-bw-line bg-bw-card px-3 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Batal"
        onPress={onTutup}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true }}
        className="h-12 w-12 items-center justify-center rounded-full bg-bw-surface active:opacity-70"
      >
        <Ikon nama="close" token="bw-ink-2" ukuran={22} />
      </Pressable>
      <Text className="flex-1 text-center text-lg font-extrabold text-bw-ink">
        {judul}
      </Text>
      <View className="h-12 w-12" />
    </View>
  );
}

function KolomTeks({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  multiline = false,
  adaGalat = false,
}: {
  value: string;
  onChangeText: (nilai: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  multiline?: boolean;
  adaGalat?: boolean;
}) {
  const [fokus, setFokus] = useState(false);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFokus(true)}
      onBlur={() => setFokus(false)}
      placeholder={placeholder}
      placeholderTextColor="#9a9aa0"
      accessibilityLabel={accessibilityLabel}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={`rounded-2xl border-2 bg-bw-card px-4 text-base text-bw-ink ${
        multiline ? 'min-h-28 py-3 leading-relaxed' : 'h-14'
      } ${
        adaGalat
          ? 'border-bw-red'
          : fokus
            ? 'border-bw-blue'
            : 'border-bw-line'
      }`}
    />
  );
}

function Bidang({
  label,
  children,
  galat,
  wajib = false,
}: {
  label: string;
  children: React.ReactNode;
  galat?: string;
  wajib?: boolean;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
        {label}
        {wajib ? ' *' : ''}
      </Text>
      {children}
      {galat ? <TeksGalat pesan={galat} /> : null}
    </View>
  );
}

function Bagian({
  label,
  petunjuk,
  children,
}: {
  label: string;
  petunjuk?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-2 ml-1 text-xs font-bold uppercase tracking-widest text-bw-muted">
        {label}
      </Text>
      {petunjuk ? (
        <Text className="-mt-1 mb-2.5 ml-1 text-xs leading-relaxed text-bw-muted">
          {petunjuk}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function TeksGalat({ pesan }: { pesan: string }) {
  return (
    <View
      accessibilityRole="alert"
      className="mt-2 ml-1 flex-row items-center gap-1.5"
    >
      <Ikon nama="alert-circle-outline" token="bw-red" ukuran={14} />
      <Text className="flex-1 text-xs text-bw-red">{pesan}</Text>
    </View>
  );
}

function PilihanChip({
  opsi,
  nilai,
  onPilih,
  galat,
}: {
  opsi: { nilai: string; label: string }[];
  nilai: string;
  onPilih: (nilai: string) => void;
  galat?: string;
}) {
  return (
    <View>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {opsi.map((item) => {
          const aktif = item.nilai === nilai;
          return (
            <Pressable
              key={item.nilai || 'kosong'}
              accessibilityRole="radio"
              accessibilityState={{ selected: aktif }}
              onPress={() => onPilih(item.nilai)}
              className={`min-h-11 flex-row items-center justify-center gap-1.5 rounded-full border px-4 py-2 active:opacity-70 ${
                aktif ? 'border-bw-blue bg-bw-blue' : 'border-bw-line bg-bw-card'
              }`}
            >
              {aktif ? <Ikon nama="checkmark" token="bw-blue-50" ukuran={14} /> : null}
              <Text
                className={`text-xs font-bold ${aktif ? 'text-white' : 'text-bw-ink-2'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {galat ? <TeksGalat pesan={galat} /> : null}
    </View>
  );
}