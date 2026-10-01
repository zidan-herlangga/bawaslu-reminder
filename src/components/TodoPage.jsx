import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import useSession from '../hooks/useSession';

const COLUMNS = 'id, teks, tanggal, selesai, created_at';

const TABS = [
  { id: 'tanggal', label: 'Tanggal dipilih' },
  { id: 'semua', label: 'Semua todo' },
];

const FIELD_CLASS =
  'block w-full rounded-xl border border-bw-line bg-bw-card px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25';

const TAB_ACTIVE =
  'rounded-lg bg-bw-card px-2 py-1.5 text-[12px] font-bold text-bw-blue shadow-sm ring-1 ring-bw-line';
const TAB_IDLE = 'rounded-lg px-2 py-1.5 text-[12px] font-bold text-bw-muted hover:text-bw-ink';

function ymd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTanggalPanjang(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function messageOf(error) {
  const raw = error?.message ?? '';

  if (error?.code === '42P01') {
    return 'Tabel todos belum dibuat. Jalankan supabase/schema.sql (bagian 6) di SQL Editor Supabase.';
  }
  if (error?.code === '42501') {
    return 'Anda tidak punya akses ke data ini.';
  }

  const lower = raw.toLowerCase();

  if (lower.includes('violates check constraint')) {
    return 'Teks todo harus 1 sampai 300 karakter.';
  }
  if (lower.includes('row-level security')) {
    return 'Aturan RLS menolak operasi ini. Jalankan supabase/schema.sql di SQL Editor Supabase.';
  }
  if (lower.includes('fetch') || lower.includes('network')) {
    return 'Gagal terhubung ke Supabase. Periksa koneksi internet Anda.';
  }

  return raw || 'Terjadi kesalahan. Silakan coba lagi.';
}

export default function TodoPage() {
  const { session, loading } = useSession();

  const today = useMemo(() => ymd(new Date()), []);

  const [todos, setTodos] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [tab, setTab] = useState('tanggal');
  const [tanggal, setTanggal] = useState(today);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState('');

  const loadTodos = useCallback(async () => {
    if (!session) return;

    setListLoading(true);

    const { data, error: loadError } = await supabase
      .from('todos')
      .select(COLUMNS)
      .order('created_at', { ascending: false });

    if (loadError) {
      console.error('[Todo] gagal memuat:', loadError.message);
      setListError(messageOf(loadError));
      setTodos([]);
    } else {
      setListError('');
      setTodos(data ?? []);
    }

    setListLoading(false);
  }, [session]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  const visible = useMemo(() => {
    const list = tab === 'tanggal' ? todos.filter((item) => item.tanggal === tanggal) : todos;
    return [...list].sort((a, b) => Number(a.selesai) - Number(b.selesai));
  }, [todos, tab, tanggal]);

  const doneCount = visible.filter((item) => item.selesai).length;

  const addTodo = async (event) => {
    event.preventDefault();

    const teks = draft.trim();
    if (!teks || saving) return;

    setSaving(true);

    const { data, error: insertError } = await supabase
      .from('todos')
      .insert({ pemilik_id: session.user.id, teks, tanggal })
      .select(COLUMNS);

    setSaving(false);

    if (insertError) {
      console.error('[Todo] gagal menambah:', insertError.message);
      setListError(messageOf(insertError));
      return;
    }

    setListError('');
    setDraft('');
    if (data?.[0]) setTodos((previous) => [data[0], ...previous]);
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditDraft(todo.teks);
    setListError('');
  };

  const cancelEdit = () => {
    setEditingId('');
    setEditDraft('');
  };

  const saveEdit = async (event) => {
    event.preventDefault();

    const teks = editDraft.trim();
    if (!teks) {
      setListError('Teks todo tidak boleh kosong.');
      return;
    }

    const id = editingId;
    const snapshot = todos;

    setTodos((previous) =>
      previous.map((item) => (item.id === id ? { ...item, teks } : item)),
    );
    cancelEdit();

    const { data, error: updateError } = await supabase
      .from('todos')
      .update({ teks })
      .eq('id', id)
      .select(COLUMNS);

    if (updateError || !data?.length) {
      setTodos(snapshot);
      setListError(messageOf(updateError));
      return;
    }

    setListError('');
  };

  const toggleTodo = async (todo) => {
    const next = !todo.selesai;
    setTodos((previous) =>
      previous.map((item) => (item.id === todo.id ? { ...item, selesai: next } : item)),
    );

    const { data, error: updateError } = await supabase
      .from('todos')
      .update({ selesai: next })
      .eq('id', todo.id)
      .select(COLUMNS);

    if (updateError || !data?.length) {
      setTodos((previous) =>
        previous.map((item) => (item.id === todo.id ? { ...item, selesai: !next } : item)),
      );
      setListError(messageOf(updateError));
      return;
    }

    setListError('');
  };

  const removeTodo = async (todo) => {
    setTodos((previous) => previous.filter((item) => item.id !== todo.id));

    const { data, error: deleteError } = await supabase
      .from('todos')
      .delete()
      .eq('id', todo.id)
      .select('id');

    if (deleteError || !data?.length) {
      setListError(messageOf(deleteError));
      loadTodos();
      return;
    }

    setListError('');
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-bw-muted">Memuat sesi...</p>;
  }

  if (!session) {
    return (
      <p className="py-10 text-center text-sm text-bw-muted">
        Mengalihkan ke halaman masuk...
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card">
        <div className="flex items-start justify-between gap-3 border-b border-bw-line pb-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bw-red">
              Daftar Tugas
            </p>
            <h1 className="mt-0.5 font-display text-xl font-bold leading-snug text-bw-ink">Todo</h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Catatan tugas pribadi Anda, terpisah dari jadwal bersama.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-bw-blue-50 px-2.5 py-1 text-xs font-bold text-bw-blue-700 ring-1 ring-bw-blue-200">
            {listLoading ? '-' : `${doneCount}/${visible.length}`}
          </span>
        </div>

        <div className="mt-3">
          <label htmlFor="todo-tanggal" className="mb-1.5 block text-[12px] font-semibold text-bw-ink">
            Tanggal
          </label>
          <input
            id="todo-tanggal"
            type="date"
            value={tanggal}
            onChange={(event) => setTanggal(event.target.value || today)}
            className={FIELD_CLASS}
          />
          <p className="mt-1.5 text-xs text-bw-muted">{formatTanggalPanjang(tanggal)}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-bw-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={`${tab === item.id ? TAB_ACTIVE : TAB_IDLE} focus:outline-none focus:ring-2 focus:ring-bw-blue/40`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={addTodo} className="mt-3 flex gap-2">
          <label htmlFor="todo-draft" className="sr-only">
            Todo baru
          </label>
          <input
            id="todo-draft"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={300}
            placeholder="Tulis tugas baru..."
            className={`${FIELD_CLASS} min-w-0 flex-1`}
          />
          <button
            type="submit"
            disabled={saving || !draft.trim()}
            className="shrink-0 rounded-xl bg-bw-blue px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-bw-line disabled:shadow-none"
          >
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
        </form>

        {listError && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-bw-red-100 bg-bw-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-bw-red"
          >
            {listError}
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[13px] font-bold capitalize text-bw-ink">
            {tab === 'tanggal' ? formatTanggalPanjang(tanggal) : 'Semua todo'}
          </h2>
          <span className="shrink-0 text-xs text-bw-muted">
            {visible.length} tugas
          </span>
        </div>

        {listLoading && (
          <p className="py-8 text-center text-sm text-bw-muted">Memuat todo...</p>
        )}

        {!listLoading && visible.length === 0 && (
          <div className="rounded-3xl border border-dashed border-bw-line bg-bw-card px-5 py-8 text-center">
            <p className="text-sm font-semibold text-bw-ink">Belum ada todo</p>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              {tab === 'tanggal'
                ? 'Belum ada tugas pada tanggal yang dipilih.'
                : 'Daftar tugas masih kosong.'}
            </p>
          </div>
        )}

        {!listLoading && visible.length > 0 && (
          <ul className="space-y-2">
            {visible.map((todo) => {
              const isEditing = editingId === todo.id;

              return (
                <li
                  key={todo.id}
                  className="flex items-start gap-3 rounded-3xl border border-bw-line bg-bw-card p-3.5 shadow-card"
                >
                  <input
                    id={`todo-${todo.id}`}
                    type="checkbox"
                    checked={todo.selesai}
                    onChange={() => toggleTodo(todo)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-bw-blue"
                  />

                  {isEditing ? (
                    <form onSubmit={saveEdit} className="min-w-0 flex-1">
                      <label htmlFor={`todo-edit-${todo.id}`} className="sr-only">
                        Ubah todo
                      </label>
                      <input
                        id={`todo-edit-${todo.id}`}
                        type="text"
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') cancelEdit();
                        }}
                        maxLength={300}
                        autoFocus
                        className="block w-full rounded-xl border border-bw-blue bg-bw-card px-2.5 py-1.5 text-sm text-bw-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-bw-blue/30"
                      />
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="submit"
                          className="rounded-xl bg-bw-blue px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-xl border border-bw-line bg-bw-card px-3 py-1.5 text-xs font-bold text-bw-muted transition-colors hover:text-bw-ink focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`todo-${todo.id}`}
                        className={`block cursor-pointer break-words text-sm leading-snug ${
                          todo.selesai ? 'text-bw-muted line-through' : 'font-semibold text-bw-ink'
                        }`}
                      >
                        {todo.teks}
                      </label>
                      {tab === 'semua' && (
                        <p className="mt-1 text-xs text-bw-muted">
                          {formatTanggalPanjang(todo.tanggal)}
                        </p>
                      )}
                    </div>
                  )}

                  {!isEditing && (
                    <div className="-m-1 flex shrink-0 gap-0.5">
                      <button
                        type="button"
                        onClick={() => startEdit(todo)}
                        aria-label={`Ubah todo ${todo.teks}`}
                        className="grid h-7 w-7 place-items-center rounded-xl text-bw-muted transition-colors hover:bg-bw-blue-50 hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTodo(todo)}
                        aria-label={`Hapus todo ${todo.teks}`}
                        className="grid h-7 w-7 place-items-center rounded-xl text-bw-muted transition-colors hover:bg-bw-red-50 hover:text-bw-red focus:outline-none focus:ring-2 focus:ring-bw-red/40"
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
