import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CandidateHome from './pages/CandidateHome'
import CandidateChat from './pages/CandidateChat'
import DiagnosisReport from './pages/DiagnosisReport'
import InterviewQuestions from './pages/InterviewQuestions'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CandidateHome />} />
        <Route path="/chat" element={<CandidateChat />} />
        <Route path="/report" element={<DiagnosisReport />} />
        <Route path="/questions" element={<InterviewQuestions />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
