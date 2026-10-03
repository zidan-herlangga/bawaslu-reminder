import { useCallback, useMemo, useState } from 'react';
import {
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
// lewat dialogue sistem, karena React Native tidak punya padanan
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
    setGalat((sebelumnya) =>
      sebelumnya.filter(
        (item) =>
          !(item.jenis === kunci || (kunci === 'slots' && item.jenis === 'slot'))
      )
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

        showToast('Jadwal baru tersimpan dan staf sudah diberi tahu.', 'sukses');
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
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Bidang label="Judul" galat={galatJudul?.pesan} wajib>
            <TextInput
              value={form.judul}
              onChangeText={(nilai) => ubah('judul', nilai)}
              placeholder="Rapat Koordinasi Anggaran"
              placeholderTextColor="#9a9aa0"
              accessibilityLabel="Judul jadwal"
              className="h-14 rounded-2xl border border-bw-line bg-bw-card px-4 text-base text-bw-ink"
            />
          </Bidang>

          <Bagian label="Kategori">
            <PilihanChip
              opsi={KATEGORI_OPTIONS.map((nama) => ({ nilai: nama, label: nama }))}
              nilai={form.kategori}
              onPilih={(nilai) => ubah('kategori', nilai)}
            />
          </Bagian>

          <Bagian label="Penerima pengingat">
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
            <TextInput
              value={form.deskripsi}
              onChangeText={(nilai) => ubah('deskripsi', nilai)}
              placeholder="Opsional: agenda, lokasi, apa yang perlu disiapkan"
              placeholderTextColor="#9a9aa0"
              multiline
              accessibilityLabel="Keterangan jadwal"
              className="min-h-24 rounded-2xl border border-bw-line bg-bw-card px-4 py-3 text-base leading-relaxed text-bw-ink"
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
              className="mt-4 rounded-2xl border border-bw-red-100 bg-bw-red-50 px-4 py-3"
            >
              <Text className="text-sm leading-relaxed text-bw-red">
                {galatUmum}
              </Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Simpan jadwal"
            onPress={simpan}
            disabled={!bisaSimpan}
            className={`mt-6 h-14 items-center justify-center rounded-2xl active:opacity-80 ${
              bisaSimpan ? 'bg-bw-blue' : 'bg-bw-line'
            }`}
          >
            <Text
              className={`text-base font-bold ${
                bisaSimpan ? 'text-white' : 'text-bw-muted'
              }`}
            >
              {menyimpan
                ? 'Menyimpan...'
                : mode === 'buat'
                  ? 'Simpan jadwal'
                  : 'Simpan perubahan'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BilahAtas({ judul, onTutup }: { judul: string; onTutup: () => void }) {
  return (
    <View className="flex-row items-center gap-2 border-b border-bw-line bg-bw-card px-2 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Batal"
        onPress={onTutup}
        className="h-12 w-12 items-center justify-center rounded-full active:bg-bw-surface"
      >
        <Ikon nama="close" token="bw-ink-2" ukuran={22} />
      </Pressable>
      <Text className="flex-1 text-center text-base font-bold text-bw-ink">
        {judul}
      </Text>
      <View className="h-12 w-12" />
    </View>
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
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-bw-muted">
        {label}
        {wajib ? ' *' : ''}
      </Text>
      {children}
      {galat ? (
        <Text accessibilityRole="alert" className="mt-1.5 text-xs text-bw-red">
          {galat}
        </Text>
      ) : null}
    </View>
  );
}

function Bagian({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide text-bw-muted">
        {label}
      </Text>
      {children}
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
    <View className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        {opsi.map((item) => {
          const aktif = item.nilai === nilai;
          return (
            <Pressable
              key={item.nilai || 'kosong'}
              accessibilityRole="radio"
              accessibilityState={{ selected: aktif }}
              onPress={() => onPilih(item.nilai)}
              className={`min-h-11 justify-center rounded-full border px-4 py-2 active:opacity-70 ${
                aktif ? 'border-bw-blue bg-bw-blue' : 'border-bw-line bg-bw-card'
              }`}
            >
              <Text
                className={`text-xs font-bold ${aktif ? 'text-white' : 'text-bw-ink-2'}`}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {galat ? (
        <Text accessibilityRole="alert" className="text-xs text-bw-red">
          {galat}
        </Text>
      ) : null}
    </View>
  );
}
