import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import StudentPage from './pages/StudentPage';
import SecurityDashboard from './pages/SecurityDashboard';
import DemoPage from './pages/DemoPage';
export default function App(){return <BrowserRouter><Routes><Route path="/" element={<StudentPage/>}/><Route path="/security" element={<SecurityDashboard/>}/><Route path="/demo" element={<DemoPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter>}
