import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import CandidateStart from './pages/CandidateStart'
import CandidateChat from './pages/CandidateChat'
import DiagnosisReport from './pages/DiagnosisReport'
import InterviewQuestions from './pages/InterviewQuestions'
import CompanyForm from './pages/CompanyForm'
import CompanyDashboard from './pages/CompanyDashboard'
import FollowUpPlan from './pages/FollowUpPlan'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/candidate" element={<CandidateStart />} />
        <Route path="/candidate/chat" element={<CandidateChat />} />
        <Route path="/candidate/report" element={<DiagnosisReport />} />
        <Route path="/candidate/questions" element={<InterviewQuestions />} />
        <Route path="/company" element={<CompanyForm />} />
        <Route path="/company/dashboard" element={<CompanyDashboard />} />
        <Route path="/company/followup" element={<FollowUpPlan />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
