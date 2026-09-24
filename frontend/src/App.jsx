import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DisplayPage from './pages/DisplayPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tampilan Layar TV / Display Ruangan */}
        <Route path="/" element={<DisplayPage />} />
        <Route path="/display" element={<DisplayPage />} />

        {/* Tampilan Dashboard Admin */}
        <Route path="/dashboard/*" element={<DashboardPage />} />
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />

        {/* Fallback ke Display jika URL tidak dikenali */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
