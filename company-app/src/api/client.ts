import type {
  SessionCreateResponse,
  MessageResponse,
  ReportGenerateResponse,
  CompanyProfileResponse,
  CompanyRealityInput,
  FollowUpPlanResponse,
  CompanyDashboard,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  createSession: (userId: string, jobId: string) =>
    request<SessionCreateResponse>('/api/diagnosis/sessions', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, job_id: jobId }),
    }),

  sendMessage: (sessionId: string, text: string) =>
    request<MessageResponse>(`/api/diagnosis/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  generateReport: (sessionId: string) =>
    request<ReportGenerateResponse>(`/api/diagnosis/sessions/${sessionId}/report`, {
      method: 'POST',
    }),

  createCompanyProfile: (data: CompanyRealityInput) =>
    request<CompanyProfileResponse>('/api/company-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateFollowUpPlan: (reportId: string) =>
    request<FollowUpPlanResponse>(`/api/reports/${reportId}/follow-up-plan`, {
      method: 'POST',
    }),

  approveFollowUpPlan: (planId: string) =>
    request<{ message: string }>(`/api/follow-up-plans/${planId}/approve`, {
      method: 'PATCH',
    }),

  getCompanyDashboard: (jobId: string) =>
    request<CompanyDashboard>(`/api/company-dashboard/jobs/${jobId}`),
}
