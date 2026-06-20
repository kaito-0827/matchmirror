import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CompanyDashboard from './pages/CompanyDashboard'
import CompanyRegister from './pages/CompanyRegister'
import FollowUpPlan from './pages/FollowUpPlan'
import JobPostingCheck from './pages/JobPostingCheck'
import LoginPage from './auth/LoginPage'
import { useAuth } from './auth/AuthContext'

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#eef1f4', color: '#626b78', fontSize: 14,
      fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
    }}>
      読み込み中...
    </div>
  )
}

export default function App() {
  const { ready, signedIn } = useAuth()

  if (!ready) return <LoadingScreen />
  if (!signedIn) return <LoginPage />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CompanyDashboard />} />
        <Route path="/register" element={<CompanyRegister />} />
        <Route path="/followup" element={<FollowUpPlan />} />
        <Route path="/posting-check" element={<JobPostingCheck />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
