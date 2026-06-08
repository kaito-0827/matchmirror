import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CompanyDashboard from './pages/CompanyDashboard'
import CompanyRegister from './pages/CompanyRegister'
import FollowUpPlan from './pages/FollowUpPlan'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CompanyDashboard />} />
        <Route path="/register" element={<CompanyRegister />} />
        <Route path="/followup" element={<FollowUpPlan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
