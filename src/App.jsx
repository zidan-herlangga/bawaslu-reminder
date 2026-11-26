import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import AdminRoute from './components/AdminRoute';

// AppShell tetap dimuat langsung: ia yang menyimpan navigasi, push, dan suara
// pengingat, dan semua itu dibutuhkan begitu aplikasi dibuka. Halaman-halaman
// di bawahnya hanya dimuat saat benar-benar dibuka, jadi bundel awal tidak lagi
// membawa Kalender, ScheduleForm, dan halaman autentikasi sekaligus.
const Dashboard = lazy(() => import('./components/Dashboard'));
const Kalender = lazy(() => import('./components/Kalender'));
const TodoPage = lazy(() => import('./components/TodoPage'));
const ScheduleForm = lazy(() => import('./components/ScheduleForm'));
const Akun = lazy(() => import('./components/Akun'));
const AdminUsers = lazy(() => import('./components/AdminUsers'));
const Login = lazy(() => import('./components/Login'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const LupaPassword = lazy(() => import('./components/LupaPassword'));

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/tugas" element={<TodoPage />} />
        <Route path="/jadwal/baru" element={<ScheduleForm />} />
        <Route path="/jadwal/:id/edit" element={<ScheduleForm />} />
        <Route path="/akun" element={<Akun />} />
        <Route
          path="/admin/pengguna"
          element={
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/lupa-password" element={<LupaPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}