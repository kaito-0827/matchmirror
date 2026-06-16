import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import Landing from './pages/Landing'
import CandidateStart from './pages/CandidateStart'
import CandidateChat from './pages/CandidateChat'
import DiagnosisReport from './pages/DiagnosisReport'
import InterviewQuestions from './pages/InterviewQuestions'
import CompanyMatches from './pages/CompanyMatches'
import CompanyForm from './pages/CompanyForm'
import CompanyDashboard from './pages/CompanyDashboard'
import FollowUpPlan from './pages/FollowUpPlan'
import MyReports from './pages/MyReports'
import AuthPage from './auth/AuthPage'
import { useAuth } from './auth/AuthContext'

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#eef1f4', color: '#626b78', fontSize: 14, fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
    }}>読み込み中...</div>
  )
}

// 企業ルートはログイン必須（会社アカウント）。未ログイン/別ロールは /login?role=company へ。
function RequireCompany({ children }: { children: ReactNode }) {
  const { ready, firebaseEnabled, signedIn, role } = useAuth()
  const location = useLocation()
  if (!ready) return <LoadingScreen />
  // Firebase未設定（ゲスト専用環境）では従来通り素通り
  if (!firebaseEnabled) return <>{children}</>
  if (!signedIn || role !== 'company') {
    const next = encodeURIComponent(location.pathname)
    return <Navigate to={`/login?role=company&next=${next}`} replace />
  }
  return <>{children}</>
}

export default function App() {
  const { ready } = useAuth()
  if (!ready) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* 候補者: ゲスト可 */}
        <Route path="/candidate" element={<CandidateStart />} />
        <Route path="/candidate/chat" element={<CandidateChat />} />
        <Route path="/candidate/report" element={<DiagnosisReport />} />
        <Route path="/candidate/questions" element={<InterviewQuestions />} />
        <Route path="/candidate/matches" element={<CompanyMatches />} />

        {/* 企業: ログイン必須 */}
        <Route path="/company" element={<RequireCompany><CompanyForm /></RequireCompany>} />
        <Route path="/company/dashboard" element={<RequireCompany><CompanyDashboard /></RequireCompany>} />
        <Route path="/company/followup" element={<RequireCompany><FollowUpPlan /></RequireCompany>} />

        {/* アカウント */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/my" element={<MyReports />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
