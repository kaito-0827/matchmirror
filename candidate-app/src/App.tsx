import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CandidateHome from './pages/CandidateHome'
import CandidateChat from './pages/CandidateChat'
import DiagnosisReport from './pages/DiagnosisReport'
import InterviewQuestions from './pages/InterviewQuestions'
import CompanyMatches from './pages/CompanyMatches'
import CompareReports from './pages/CompareReports'
import MyReports from './pages/MyReports'
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
        <Route path="/" element={<CandidateHome />} />
        <Route path="/chat" element={<CandidateChat />} />
        <Route path="/report" element={<DiagnosisReport />} />
        <Route path="/questions" element={<InterviewQuestions />} />
        <Route path="/matches" element={<CompanyMatches />} />
        <Route path="/compare" element={<CompareReports />} />
        <Route path="/my" element={<MyReports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
