import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import StudentPage from './pages/StudentPage';
import SecurityDashboard from './pages/SecurityDashboard';
import DemoPage from './pages/DemoPage';
import WardenPage from './pages/WardenPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentPage />} />
        <Route path="/security" element={<SecurityDashboard />} />
        <Route path="/warden" element={<WardenPage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}