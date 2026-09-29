import { Navigate, Route, Routes } from 'react-router-dom';
import Akun from './components/Akun';
import AppShell from './components/AppShell';
import Dashboard from './components/Dashboard';
import Kalender from './components/Kalender';
import Login from './components/Login';
import Register from './components/Register';
import ScheduleForm from './components/ScheduleForm';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/jadwal/baru" element={<ScheduleForm />} />
        <Route path="/akun" element={<Akun />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
