import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DIVISI_OPTIONS, KATEGORI_OPTIONS } from '../constants/options';
import useSession from '../hooks/useSession';
import fetchProfile from '../lib/fetchProfile';
import { getSlots } from '../lib/slots';

const EMPTY_SLOT = { mulai: '', selesai: '' };

const EMPTY_FORM = {
  judul: '',
  kategori: KATEGORI_OPTIONS[0],
  deskripsi: '',
  target_mode: 'semua',
  target_divisi: '',
  slots: [{ ...EMPTY_SLOT }],
};

const TARGET_MODES = [
  { value: 'semua', label: 'Semua staf', hint: 'Pengingat dikirim ke seluruh staf.' },
  { value: 'divisi', label: 'Khusus divisi', hint: 'Hanya staf pada divisi terpilih.' },
];

const FIELD_BASE_CLASS =
  'block w-full rounded-xl border bg-bw-card px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-bw-surface';
const FIELD_OK_CLASS = 'border-bw-line focus:border-bw-blue focus:ring-bw-blue/25';
const FIELD_INVALID_CLASS = 'border-bw-red focus:ring-bw-red/25';

const LABEL_CLASS = 'mb-1.5 block text-[13px] font-semibold text-bw-ink';
const SUB_LABEL_CLASS = 'mb-1 block text-xs font-semibold text-bw-muted';

const SLOT_ERROR_KEY = /^slot-\d+-(mulai|selesai)$/;

function toLocalInput(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function getErrorMessage(error) {
  const raw = error?.message ?? '';
  const message = raw.toLowerCase();

  if (message.includes('row-level security')) {
    return 'Anda tidak punya izin menulis jadwal. Jalankan supabase/schema.sql di SQL Editor.';
  }
  if (message.includes('violates check constraint')) {
    return 'Isian tidak sesuai aturan database. Periksa kembali form Anda.';
  }
  if (message.includes('fetch') || message.includes('network')) {
    return 'Gagal terhubung ke Supabase. Periksa koneksi internet Anda.';
  }

  return raw || 'Gagal menyimpan jadwal. Silakan coba lagi.';
}

function stripSlotErrors(previous) {
  const next = {};
  let changed = false;

  Object.entries(previous).forEach(([key, value]) => {
    if (SLOT_ERROR_KEY.test(key)) {
      changed = true;
      return;
    }
    next[key] = value;
  });

  return changed ? next : previous;
}

function validate(values) {
  const nextErrors = {};

  if (!values.judul.trim()) {
    nextErrors.judul = 'Judul jadwal wajib diisi.';
  } else if (values.judul.trim().length > 150) {
    nextErrors.judul = 'Judul maksimal 150 karakter.';
  }

  if (values.deskripsi.length > 1000) {
    nextErrors.deskripsi = 'Deskripsi maksimal 1000 karakter.';
  }

  if (values.target_mode === 'divisi' && !values.target_divisi) {
    nextErrors.target_divisi = 'Pilih divisi penerima pengingat.';
  }

  if (values.slots.length === 0) {
    nextErrors.slots = 'Tambahkan minimal satu tanggal dan jam.';
    return nextErrors;
  }

  values.slots.forEach((slot, index) => {
    const mulaiKey = `slot-${index}-mulai`;
    const selesaiKey = `slot-${index}-selesai`;

    if (!slot.mulai) {
      nextErrors[mulaiKey] = 'Tanggal dan jam mulai wajib diisi.';
    } else if (Number.isNaN(new Date(slot.mulai).getTime())) {
      nextErrors[mulaiKey] = 'Tanggal dan jam tidak valid.';
    }

    if (slot.selesai) {
      const selesai = new Date(slot.selesai).getTime();
      const mulai = new Date(slot.mulai).getTime();

      if (Number.isNaN(selesai)) {
        nextErrors[selesaiKey] = 'Waktu selesai tidak valid.';
      } else if (slot.mulai && selesai < mulai) {
        nextErrors[selesaiKey] = 'Waktu selesai tidak boleh sebelum waktu mulai.';
      }
    }
  });

  return nextErrors;
}

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-xs font-medium text-bw-red">
      {children}
    </p>
  );
}

export default function ScheduleForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { session, loading } = useSession();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [detailLoading, setDetailLoading] = useState(() => isEdit);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError('');
    setDetailError('');
    setDetailLoading(Boolean(id));
  }, [id]);

  useEffect(() => {
    if (!session) return;
    let active = true;

    fetchProfile(session).then((data) => {
      if (active) setProfile(data);
    });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !id) return;
    let active = true;

    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError('');

      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!active) return;

      if (error) {
        setDetailError(`Gagal memuat jadwal. Detail: ${error.message}.`);
      } else if (!data) {
        setDetailError('Jadwal tidak ditemukan atau sudah dihapus.');
      } else if (data.pembuat_id !== session.user.id) {
        setDetailError('Anda bukan pembuat jadwal ini, jadi tidak bisa mengubahnya.');
      } else {
        const slots = getSlots(data);
        setForm({
          judul: data.judul ?? '',
          kategori: data.kategori ?? KATEGORI_OPTIONS[0],
          deskripsi: data.deskripsi ?? '',
          target_mode: data.target_divisi ? 'divisi' : 'semua',
          target_divisi: data.target_divisi ?? '',
          slots:
            slots.length > 0
              ? slots.map((slot) => ({
                  mulai: toLocalInput(slot.mulai),
                  selesai: slot.selesai ? toLocalInput(slot.selesai) : '',
                }))
              : [{ ...EMPTY_SLOT }],
        });
      }

      setDetailLoading(false);
    };

    loadDetail();

    return () => {
      active = false;
    };
  }, [session, id]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => {
      if (!previous[name]) return previous;
      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const handleSlotChange = (index, field, value) => {
    setForm((previous) => ({
      ...previous,
      slots: previous.slots.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [field]: value } : slot
      ),
    }));

    setErrors((previous) => {
      const key = `slot-${index}-${field}`;
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const addSlot = () => {
    setForm((previous) => ({
      ...previous,
      slots: [...previous.slots, { ...EMPTY_SLOT }],
    }));
    setErrors(stripSlotErrors);
  };

  const removeSlot = (index) => {
    setForm((previous) => ({
      ...previous,
      slots: previous.slots.filter((_, slotIndex) => slotIndex !== index),
    }));
    setErrors(stripSlotErrors);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !session) return;

    const validationErrors = validate(form);
    setErrors(validationErrors);
    setFormError('');

    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      const slots = form.slots.map((slot) => ({
        mulai: new Date(slot.mulai).toISOString(),
        selesai: slot.selesai ? new Date(slot.selesai).toISOString() : null,
      }));

      const startTimes = slots.map((slot) => new Date(slot.mulai).getTime());
      const endTimes = slots
        .filter((slot) => slot.selesai)
        .map((slot) => new Date(slot.selesai).getTime());

      const payload = {
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim(),
        kategori: form.kategori,
        target_divisi: form.target_mode === 'divisi' ? form.target_divisi : null,
        waktu_mulai: new Date(Math.min(...startTimes)).toISOString(),
        waktu_selesai: endTimes.length
          ? new Date(Math.max(...endTimes)).toISOString()
          : null,
        slots,
      };

      const query = isEdit
        ? supabase.from('schedules').update(payload).eq('id', id).select('id')
        : supabase.from('schedules')
            .insert({
              ...payload,
              pembuat_id: session.user.id,
              pembuat_nama: profile?.nama_lengkap || session.user.email,
              pembuat_divisi: profile?.divisi || 'Belum diatur',
            })
            .select('id');

      const { data, error } = await query;

      if (error) throw error;
      if (!data?.length) {
        throw new Error(
          isEdit
            ? 'Perubahan tidak tersimpan (0 baris terpengaruh). Jalankan lagi supabase/schema.sql di SQL Editor Supabase.'
            : 'Jadwal tidak tersimpan (0 baris terpengaruh). Jalankan lagi supabase/schema.sql di SQL Editor Supabase.'
        );
      }

      console.info(`[Schedule] jadwal ${isEdit ? 'diperbarui' : 'tersimpan'}, kembali ke /`);
      navigate('/', { replace: true });
    } catch (error) {
      console.error('[Schedule] gagal:', error?.code, error?.message);
      const hint = /target_divisi|schema cache|could not find/i.test(error?.message ?? '')
        ? ' Jalankan lagi supabase/schema.sql (bagian 7 target_divisi & notifikasi) di SQL Editor Supabase.'
        : '';
      setFormError(getErrorMessage(error) + hint);
      setIsSubmitting(false);
    }
  };

  if (loading || detailLoading) {
    return <p className="py-10 text-center text-sm text-bw-muted">Memuat sesi...</p>;
  }

  if (!session) {
    return (
      <p className="py-10 text-center text-sm text-bw-muted">
        Mengalihkan ke halaman masuk...
      </p>
    );
  }

  if (detailError) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3">
        <div
          role="alert"
          className="rounded-xl border border-bw-red-100 bg-bw-red-50 px-4 py-3 text-xs leading-relaxed text-bw-red"
        >
          {detailError}
        </div>
        <Link
          to="/"
          className="flex items-center justify-center rounded-xl border border-bw-line bg-bw-card px-4 py-3 text-sm font-semibold text-bw-muted transition-colors hover:border-bw-blue-200 hover:text-bw-blue"
        >
          Kembali ke beranda
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
        <div className="border-b border-bw-line pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-bw-red">
            {isEdit ? 'Ubah Jadwal' : 'Jadwal Baru'}
          </p>
          <h1 className="mt-1 font-display text-xl font-bold leading-snug text-bw-ink">
            {isEdit ? 'Edit Jadwal' : 'Buat Jadwal'}
          </h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Satu jadwal boleh punya banyak tanggal &amp; jam. Seluruh pengguna dapat melihat
              jadwal ini, tetapi pengingat bisa dibatasi hanya untuk satu divisi.
            </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
            >
              {formError}
            </div>
          )}

          <div>
            <label htmlFor="judul" className={LABEL_CLASS}>
              Judul Jadwal
            </label>
            <input
              id="judul"
              name="judul"
              type="text"
              value={form.judul}
              onChange={handleChange}
              placeholder="Rapat koordinasi mingguan"
              aria-invalid={Boolean(errors.judul)}
              aria-describedby={errors.judul ? 'judul-error' : undefined}
              className={`${FIELD_BASE_CLASS} ${
                errors.judul ? FIELD_INVALID_CLASS : FIELD_OK_CLASS
              }`}
            />
            <FieldError id="judul-error">{errors.judul}</FieldError>
          </div>

          <div>
            <label htmlFor="kategori" className={LABEL_CLASS}>
              Kategori
            </label>
            <select
              id="kategori"
              name="kategori"
              value={form.kategori}
              onChange={handleChange}
              className={`${FIELD_BASE_CLASS} ${FIELD_OK_CLASS}`}
            >
              {KATEGORI_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={LABEL_CLASS}>Penerima Pengingat</span>
            <div className="grid grid-cols-2 gap-2">
              {TARGET_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors focus-within:ring-2 focus-within:ring-bw-blue/40 ${
                    form.target_mode === mode.value
                      ? 'border-bw-blue bg-bw-blue-50'
                      : 'border-bw-line bg-bw-card hover:border-bw-blue-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="target_mode"
                    value={mode.value}
                    checked={form.target_mode === mode.value}
                    onChange={handleChange}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-bw-blue"
                  />
                  <span className="min-w-0">
                    <span className="block text-[12px] font-bold text-bw-ink">{mode.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-bw-muted">
                      {mode.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            {form.target_mode === 'divisi' && (
              <div className="mt-2.5">
                <label htmlFor="target_divisi" className={SUB_LABEL_CLASS}>
                  Divisi Penerima
                </label>
                <select
                  id="target_divisi"
                  name="target_divisi"
                  value={form.target_divisi}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.target_divisi)}
                  aria-describedby={errors.target_divisi ? 'target_divisi-error' : undefined}
                  className={`${FIELD_BASE_CLASS} ${
                    errors.target_divisi ? FIELD_INVALID_CLASS : FIELD_OK_CLASS
                  } ${form.target_divisi ? '' : 'text-bw-muted'}`}
                >
                  <option value="">-- Pilih Divisi --</option>
                  {DIVISI_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-bw-ink">
                      {option}
                    </option>
                  ))}
                </select>
                <FieldError id="target_divisi-error">{errors.target_divisi}</FieldError>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className={LABEL_CLASS}>Tanggal &amp; Jam</span>
              <span className="text-xs font-semibold text-bw-muted">
                {form.slots.length} sesi
              </span>
            </div>

            <FieldError>{errors.slots}</FieldError>

            <div className="space-y-3">
              {form.slots.map((slot, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-bw-line bg-bw-surface p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-bw-muted">
                      Sesi {index + 1}
                    </span>
                    {form.slots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="text-xs font-bold text-bw-red transition-colors hover:underline focus:outline-none focus:ring-2 focus:ring-bw-red/40"
                      >
                        Hapus sesi
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 space-y-2.5">
                    <div>
                      <label
                        htmlFor={`slot-${index}-mulai`}
                        className={SUB_LABEL_CLASS}
                      >
                        Tanggal &amp; Jam Mulai
                      </label>
                      <input
                        id={`slot-${index}-mulai`}
                        type="datetime-local"
                        value={slot.mulai}
                        onChange={(event) =>
                          handleSlotChange(index, 'mulai', event.target.value)
                        }
                        aria-invalid={Boolean(errors[`slot-${index}-mulai`])}
                        aria-describedby={
                          errors[`slot-${index}-mulai`]
                            ? `slot-${index}-mulai-error`
                            : undefined
                        }
                        className={`${FIELD_BASE_CLASS} ${
                          errors[`slot-${index}-mulai`]
                            ? FIELD_INVALID_CLASS
                            : FIELD_OK_CLASS
                        }`}
                      />
                      <FieldError id={`slot-${index}-mulai-error`}>
                        {errors[`slot-${index}-mulai`]}
                      </FieldError>
                    </div>

                    <div>
                      <label
                        htmlFor={`slot-${index}-selesai`}
                        className={SUB_LABEL_CLASS}
                      >
                        Selesai <span className="font-normal">(opsional)</span>
                      </label>
                      <input
                        id={`slot-${index}-selesai`}
                        type="datetime-local"
                        value={slot.selesai}
                        onChange={(event) =>
                          handleSlotChange(index, 'selesai', event.target.value)
                        }
                        aria-invalid={Boolean(errors[`slot-${index}-selesai`])}
                        aria-describedby={
                          errors[`slot-${index}-selesai`]
                            ? `slot-${index}-selesai-error`
                            : undefined
                        }
                        className={`${FIELD_BASE_CLASS} ${
                          errors[`slot-${index}-selesai`]
                            ? FIELD_INVALID_CLASS
                            : FIELD_OK_CLASS
                        }`}
                      />
                      <FieldError id={`slot-${index}-selesai-error`}>
                        {errors[`slot-${index}-selesai`]}
                      </FieldError>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSlot}
              className="mt-3 w-full rounded-xl border border-dashed border-bw-blue-200 bg-bw-blue-50 px-4 py-2.5 text-xs font-bold text-bw-blue transition-colors hover:border-bw-blue hover:bg-bw-blue-100 focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
            >
              + Tambah tanggal &amp; jam
            </button>
          </div>

          <div>
            <label htmlFor="deskripsi" className={LABEL_CLASS}>
              Deskripsi <span className="font-normal text-bw-muted">(opsional)</span>
            </label>
            <textarea
              id="deskripsi"
              name="deskripsi"
              rows={4}
              value={form.deskripsi}
              onChange={handleChange}
              placeholder="Agenda, tautan rapat, atau catatan lain..."
              aria-invalid={Boolean(errors.deskripsi)}
              aria-describedby={errors.deskripsi ? 'deskripsi-error' : undefined}
              className={`${FIELD_BASE_CLASS} resize-y ${
                errors.deskripsi ? FIELD_INVALID_CLASS : FIELD_OK_CLASS
              }`}
            />
            <FieldError id="deskripsi-error">{errors.deskripsi}</FieldError>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-bw-blue px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 focus:ring-offset-bw-card active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line disabled:shadow-none"
            >
              {isSubmitting ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Jadwal'}
            </button>
            <Link
              to="/"
              className="flex items-center justify-center rounded-xl border border-bw-line bg-bw-card px-4 py-3 text-sm font-semibold text-bw-muted transition-colors hover:border-bw-blue-200 hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
