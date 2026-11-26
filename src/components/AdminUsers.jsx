import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useSession from '../hooks/useSession';
import ConfirmDialog from './ConfirmDialog';
import { DIVISI_OPTIONS, JABATAN_OPTIONS, MIN_PASSWORD_LENGTH, ROLE_AKSES_OPTIONS, STATUS_AKUN_OPTIONS } from '../constants/options';

const INPUT_CLASS =
  'block w-full rounded-xl border border-bw-line bg-bw-card px-3.5 py-2.5 text-sm text-bw-ink shadow-sm transition-colors placeholder:text-bw-muted/70 focus:border-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/25';
const LABEL_CLASS = 'mb-1.5 block text-[12px] font-semibold text-bw-ink';
const BTN_PRIMARY =
  'rounded-xl bg-bw-blue px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:bg-bw-line disabled:text-bw-muted';
const BTN_SECONDARY =
  'rounded-xl border border-bw-line bg-bw-card px-4 py-2.5 text-sm font-semibold text-bw-ink transition-colors hover:bg-bw-surface focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:opacity-60';

const EMPTY_FORM = {
  nama_lengkap: '',
  email: '',
  password: '',
  divisi: DIVISI_OPTIONS[0],
  jabatan: JABATAN_OPTIONS[0],
  role_akses: 'User',
  status_akun: 'Aktif',
};

function Badge({ children, tone = 'muted' }) {
  const tones = {
    muted: 'bg-bw-surface text-bw-muted',
    blue: 'bg-bw-blue-50 text-bw-blue-700',
    green: 'bg-bw-green-50 text-bw-green-700',
    red: 'bg-bw-red-50 text-bw-red',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${tones[tone] || tones.muted}`}>
      {children}
    </span>
  );
}

function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bw-ink/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-3xl border border-bw-line bg-bw-card p-5 shadow-lift"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-base font-bold text-bw-ink">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-bw-muted hover:bg-bw-surface">
            Tutup
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

async function apiAdmin(session, action, payload = {}, method = 'POST') {
  const res = await fetch(`/api/admin/users?action=${encodeURIComponent(action)}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: method === 'GET' ? undefined : JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}

export default function AdminUsers() {
  const { session, loading: sessionLoading } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [query, setQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [modal, setModal] = useState(null); // { mode: 'create'|'edit', user? }
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirm, setConfirm] = useState(null); // { type, user }
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiAdmin(session, 'list', {}, 'GET');
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      setError(err.message || 'Gagal memuat pengguna.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) loadUsers();
  }, [session, loadUsers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filterRole && u.role_akses !== filterRole) return false;
      if (filterStatus && u.status_akun !== filterStatus) return false;
      if (!q) return true;
      return (
        String(u.nama_lengkap || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q) ||
        String(u.divisi || '').toLowerCase().includes(q)
      );
    });
  }, [users, query, filterRole, filterStatus]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal({ mode: 'create' });
  };

  const openEdit = (user) => {
    setForm({
      nama_lengkap: user.nama_lengkap || '',
      email: user.email || '',
      password: '',
      divisi: user.divisi || DIVISI_OPTIONS[0],
      jabatan: user.jabatan || JABATAN_OPTIONS[0],
      role_akses: user.role_akses || 'User',
      status_akun: user.status_akun || 'Aktif',
    });
    setFormError('');
    setModal({ mode: 'edit', user });
  };

  const closeModal = () => {
    if (saving) return;
    setModal(null);
    setFormError('');
  };

  const submitForm = async (e) => {
    e.preventDefault();
    if (saving || !session || !modal) return;
    setFormError('');
    setNotice('');

    const nama_lengkap = form.nama_lengkap.trim();
    const email = form.email.trim().toLowerCase();
    if (!nama_lengkap) return setFormError('Nama lengkap wajib diisi.');
    if (!form.divisi) return setFormError('Divisi wajib dipilih.');
    if (!form.jabatan) return setFormError('Jabatan wajib dipilih.');

    if (modal.mode === 'create') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError('Email tidak valid.');
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        return setFormError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
      }
    }

    setSaving(true);
    try {
      if (modal.mode === 'create') {
        await apiAdmin(session, 'create', {
          nama_lengkap,
          email,
          password: form.password,
          divisi: form.divisi,
          jabatan: form.jabatan,
          role_akses: form.role_akses,
        });
        setNotice('Pengguna baru berhasil dibuat.');
      } else {
        await apiAdmin(session, 'update', {
          id: modal.user.id,
          nama_lengkap,
          divisi: form.divisi,
          jabatan: form.jabatan,
          role_akses: form.role_akses,
          status_akun: form.status_akun,
        });
        setNotice('Data pengguna berhasil diperbarui.');
      }
      setModal(null);
      await loadUsers();
    } catch (err) {
      setFormError(err.message || 'Gagal menyimpan.');
    } finally {
      setSaving(false);
    }
  };

  const doConfirm = async () => {
    if (!confirm || !session || confirmBusy) return;
    setConfirmBusy(true);
    setNotice('');
    try {
      if (confirm.type === 'reset-password') {
        const redirectTo = `${window.location.origin}/reset-password`;
        const data = await apiAdmin(session, 'reset-password', { id: confirm.user.id, redirectTo });
        setNotice(data.message || 'Link reset password dikirim.');
      } else if (confirm.type === 'toggle-status') {
        const nextStatus = confirm.user.status_akun === 'Aktif' ? 'Nonaktif' : 'Aktif';
        await apiAdmin(session, 'update', { id: confirm.user.id, status_akun: nextStatus });
        setNotice(`Status pengguna diubah menjadi ${nextStatus}.`);
      }
      setConfirm(null);
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Aksi gagal.');
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (sessionLoading) {
    return <p className="py-10 text-center text-sm text-bw-muted">Memuat sesi...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-bw-line bg-bw-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-bw-red">Admin</p>
            <h1 className="mt-1 font-display text-xl font-bold text-bw-ink">Kelola Pengguna</h1>
            <p className="mt-1 text-xs leading-relaxed text-bw-muted">
              Buat akun, ubah role/status, dan kirim reset password.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/akun" className={BTN_SECONDARY}>Kembali</Link>
            <button type="button" onClick={openCreate} className={BTN_PRIMARY}>Tambah Pengguna</button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, email, divisi..."
            className={INPUT_CLASS}
            aria-label="Cari pengguna"
          />
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className={INPUT_CLASS} aria-label="Filter role">
            <option value="">Semua Role</option>
            {ROLE_AKSES_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={INPUT_CLASS} aria-label="Filter status">
            <option value="">Semua Status</option>
            {STATUS_AKUN_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {notice && (
          <p role="status" className="mt-3 rounded-xl border border-bw-green-200 bg-bw-green-50 px-3 py-2 text-xs text-bw-green-700">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl border border-bw-red-100 bg-bw-red-50 px-3 py-2 text-xs text-bw-red">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-bw-line bg-bw-card shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-bw-line px-4 py-3">
          <p className="text-xs font-semibold text-bw-muted">
            Menampilkan {filtered.length} dari {users.length} pengguna
          </p>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-bw-muted">Memuat pengguna...</p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-bw-muted">Tidak ada pengguna yang cocok.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[80rem] table-fixed text-left text-sm">
              <thead className="bg-bw-surface text-xs uppercase tracking-wide text-bw-muted">
                <tr>
                  <th className="sticky left-0 z-20 w-[7rem] border-r border-bw-line bg-bw-surface px-3 py-3 font-semibold lg:px-4">Nama</th>
                  <th className="w-[16rem] px-3 py-3 font-semibold lg:px-4">Email</th>
                  <th className="w-[16rem] px-3 py-3 font-semibold lg:px-4">Divisi</th>
                  <th className="w-[12rem] px-3 py-3 font-semibold lg:px-4">Jabatan</th>
                  <th className="w-[7rem] px-3 py-3 font-semibold lg:px-4">Role</th>
                  <th className="w-[8rem] px-3 py-3 font-semibold lg:px-4">Status</th>
                  <th className="w-[9rem] px-3 py-3 font-semibold lg:px-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bw-line">
                {filtered.map((u) => {
                  const isSelf = u.id === session?.user?.id;
                  return (
                    <tr key={u.id} className="align-top">
                      <td className="sticky left-0 z-10 w-[7rem] border-r border-bw-line bg-bw-card px-3 py-3 lg:px-4">
                        <div className="break-words font-semibold text-bw-ink">{u.nama_lengkap || '(Tanpa nama)'}</div>
                        {isSelf && <div className="mt-1"><Badge tone="blue">Anda</Badge></div>}
                      </td>
                      <td className="w-[16rem] whitespace-nowrap px-3 py-3 text-bw-muted lg:px-4">{u.email || '-'}</td>
                      <td className="w-[16rem] break-words px-3 py-3 text-bw-muted lg:px-4">{u.divisi || '-'}</td>
                      <td className="w-[12rem] break-words px-3 py-3 text-bw-muted lg:px-4">{u.jabatan || '-'}</td>
                      <td className="w-[7rem] px-3 py-3 lg:px-4">
                        <Badge tone={u.role_akses === 'Admin' ? 'blue' : 'muted'}>{u.role_akses || '-'}</Badge>
                      </td>
                      <td className="w-[8rem] px-3 py-3 lg:px-4">
                        <Badge tone={u.status_akun === 'Aktif' ? 'green' : 'red'}>{u.status_akun || '-'}</Badge>
                      </td>
                      <td className="w-[9rem] px-3 py-3 lg:px-4">
                        <div className="flex w-full min-w-[7rem] flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-bw-line bg-bw-card px-2 py-1.5 text-xs font-semibold text-bw-ink transition-colors hover:bg-bw-surface focus:outline-none focus:ring-2 focus:ring-bw-blue/40 lg:px-3"
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm({ type: 'reset-password', user: u })}
                            className="inline-flex w-full items-center justify-center rounded-lg border border-bw-line bg-bw-card px-2 py-1.5 text-xs font-semibold text-bw-ink transition-colors hover:bg-bw-surface focus:outline-none focus:ring-2 focus:ring-bw-blue/40 lg:px-3"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirm({ type: 'toggle-status', user: u })}
                            disabled={isSelf}
                            className={`inline-flex w-full items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-bw-blue/40 disabled:cursor-not-allowed disabled:opacity-50 lg:px-3 ${
                              u.status_akun === 'Aktif'
                                ? 'border-bw-red-100 bg-bw-card text-bw-red hover:bg-bw-red-50'
                                : 'border-bw-line bg-bw-card text-bw-ink hover:bg-bw-surface'
                            }`}
                          >
                            {u.status_akun === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(modal)}
        title={modal?.mode === 'create' ? 'Tambah Pengguna' : 'Ubah Pengguna'}
        onClose={closeModal}
      >
        <form onSubmit={submitForm} className="space-y-3">
          <div>
            <label htmlFor="adm-nama" className={LABEL_CLASS}>Nama Lengkap</label>
            <input id="adm-nama" className={INPUT_CLASS} value={form.nama_lengkap} onChange={(e) => setForm((p) => ({ ...p, nama_lengkap: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="adm-email" className={LABEL_CLASS}>Email</label>
            <input
              id="adm-email"
              type="email"
              className={INPUT_CLASS}
              value={form.email}
              disabled={modal?.mode === 'edit'}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          {modal?.mode === 'create' && (
            <div>
              <label htmlFor="adm-pass" className={LABEL_CLASS}>Password Awal</label>
              <input
                id="adm-pass"
                type="password"
                className={INPUT_CLASS}
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                placeholder={`Minimal ${MIN_PASSWORD_LENGTH} karakter`}
              />
            </div>
          )}
          <div>
            <label htmlFor="adm-divisi" className={LABEL_CLASS}>Divisi</label>
            <select id="adm-divisi" className={INPUT_CLASS} value={form.divisi} onChange={(e) => setForm((p) => ({ ...p, divisi: e.target.value }))}>
              {DIVISI_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="adm-jabatan" className={LABEL_CLASS}>Jabatan</label>
            <select id="adm-jabatan" className={INPUT_CLASS} value={form.jabatan} onChange={(e) => setForm((p) => ({ ...p, jabatan: e.target.value }))}>
              {JABATAN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="adm-role" className={LABEL_CLASS}>Role</label>
              <select id="adm-role" className={INPUT_CLASS} value={form.role_akses} onChange={(e) => setForm((p) => ({ ...p, role_akses: e.target.value }))}>
                {ROLE_AKSES_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {modal?.mode === 'edit' && (
              <div>
                <label htmlFor="adm-status" className={LABEL_CLASS}>Status</label>
                <select id="adm-status" className={INPUT_CLASS} value={form.status_akun} onChange={(e) => setForm((p) => ({ ...p, status_akun: e.target.value }))}>
                  {STATUS_AKUN_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
          </div>

          {formError && <p role="alert" className="rounded-xl bg-bw-red-50 px-3 py-2 text-xs text-bw-red">{formError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className={BTN_SECONDARY} disabled={saving}>Batal</button>
            <button type="submit" className={BTN_PRIMARY} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        judul={confirm?.type === 'reset-password' ? 'Kirim Reset Password?' : confirm?.user?.status_akun === 'Aktif' ? 'Nonaktifkan Pengguna?' : 'Aktifkan Pengguna?'}
        pesan={
          confirm?.type === 'reset-password'
            ? `Kirim link reset password ke ${confirm?.user?.email}?`
            : confirm?.user?.status_akun === 'Aktif'
              ? `Akun ${confirm?.user?.nama_lengkap || confirm?.user?.email} akan dinonaktifkan dan tidak bisa masuk.`
              : `Akun ${confirm?.user?.nama_lengkap || confirm?.user?.email} akan diaktifkan kembali.`
        }
        labelBatal="Batal"
        labelSetuju={confirm?.type === 'reset-password' ? 'Kirim' : confirm?.user?.status_akun === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
        sibuk={confirmBusy}
        onBatal={() => !confirmBusy && setConfirm(null)}
        onSetuju={doConfirm}
      />
    </div>
  );
}