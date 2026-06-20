import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import Landing from './pages/Landing'
import CandidateStart from './pages/CandidateStart'
import CandidateChat from './pages/CandidateChat'
import DiagnosisReport from './pages/DiagnosisReport'
import InterviewQuestions from './pages/InterviewQuestions'
import CompanyMatches from './pages/CompanyMatches'
import CompareReports from './pages/CompareReports'
import CompanyForm from './pages/CompanyForm'
import CompanyDashboard from './pages/CompanyDashboard'
import FollowUpPlan from './pages/FollowUpPlan'
import MyReports from './pages/MyReports'
import PostInterviewCheck from './pages/PostInterviewCheck'
import JobPostingCheck from './pages/JobPostingCheck'
import SharedReport from './pages/SharedReport'
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

function RequireCompany({ children }: { children: ReactNode }) {
  const { ready, firebaseEnabled, signedIn, role } = useAuth()
  const location = useLocation()
  if (!ready) return <LoadingScreen />
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
        <Route path="/candidate/compare" element={<CompareReports />} />
        <Route path="/candidate/post-interview" element={<PostInterviewCheck />} />

        {/* 企業: ログイン必須 */}
        <Route path="/company" element={<RequireCompany><CompanyForm /></RequireCompany>} />
        <Route path="/company/dashboard" element={<RequireCompany><CompanyDashboard /></RequireCompany>} />
        <Route path="/company/followup" element={<RequireCompany><FollowUpPlan /></RequireCompany>} />
        <Route path="/company/posting-check" element={<RequireCompany><JobPostingCheck /></RequireCompany>} />

        {/* 共有レポート（無認証で閲覧可能） */}
        <Route path="/r/:reportId" element={<SharedReport />} />

        {/* アカウント */}
        <Route path="/login" element={<AuthPage />} />
        <Route path="/my" element={<MyReports />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
