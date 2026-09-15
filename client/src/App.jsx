import { useEffect, useState } from 'react';
import {
  BrowserRouter, Routes, Route, Navigate
} from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from './services/firebase';
import StudentPage from './pages/StudentPage';
import StudentLogin from './pages/StudentLogin';
import StudentRegister from './pages/StudentRegister';
import SecurityDashboard from './pages/SecurityDashboard';
import DemoPage from './pages/DemoPage';
import WardenPage from './pages/WardenPage';
import WardenLogin from './pages/WardenLogin';

function ProtectedWarden() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);
  if (user === undefined)
    return <div style={{ padding: 30 }}>Loading...</div>;
  if (!user)
    return <Navigate to="/warden-login" replace />;
  return <WardenPage />;
}

function ProtectedStudent() {
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);
  if (user === undefined)
    return <div style={{ padding: 30 }}>Loading...</div>;
  if (!user)
    return <Navigate to="/student-login" replace />;
  return <StudentPage />;  
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProtectedStudent />} />
        <Route path="/student-login" element={<StudentLogin />} />
        <Route path="/student-register" element={<StudentRegister />} />
        <Route path="/security" element={<SecurityDashboard />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/warden-login" element={<WardenLogin />} />
        <Route path="/warden" element={<ProtectedWarden />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}