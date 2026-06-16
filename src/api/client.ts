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

// 認証ヘッダの注入。AuthProvider が setAuthHeaderProvider で登録する。
// サインイン時は Bearer トークン、ゲスト/開発時は X-Dev-* ヘッダを返す。
type HeaderMap = Record<string, string>
let authHeaderProvider: (() => Promise<HeaderMap>) | null = null
export function setAuthHeaderProvider(fn: (() => Promise<HeaderMap>) | null) {
  authHeaderProvider = fn
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: optHeaders, ...rest } = options
  const authHeaders = authHeaderProvider ? await authHeaderProvider() : {}
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(optHeaders as HeaderMap | undefined),
    },
    ...rest,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export interface MeResponse {
  account: { uid: string; email: string | null; role: string; user_id: string | null; company_id: string | null }
  user: Record<string, unknown> | null
  company: Record<string, unknown> | null
}

export interface CompanyListItem {
  job_id: string
  company_id: string
  job_title: string
  name: string | null
  industry: string | null
  region: string | null
  size_band: string | null
  workstyle: string | null
}

export interface MyReportItem {
  id: string
  job_id: string
  overall_score: number
  candidate_summary: string
  created_at: string
  gap_count: number
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

  // --- 会社一覧（診断対象の選択用） ---
  listCompanies: () => request<{ items: CompanyListItem[]; total: number }>('/api/company-profiles'),

  // --- 認証・アカウント ---
  getMe: () => request<MeResponse>('/api/auth/me'),

  registerCandidate: (body: { display_name: string; career_stage?: string }) =>
    request<MeResponse>('/api/auth/register/candidate', {
      method: 'POST',
      body: JSON.stringify({ career_stage: 'new_grad', ...body }),
    }),

  registerCompany: (body: { name: string; industry?: string; region?: string; contact_email?: string }) =>
    request<MeResponse>('/api/auth/register/company', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getReport: (reportId: string) =>
    request<ReportGenerateResponse & { id: string }>(`/api/reports/${reportId}`),

  // --- マイレポート / ゲスト引き継ぎ ---
  getMyReports: () => request<{ items: MyReportItem[]; total: number }>('/api/my/reports'),

  claimGuest: (guestId: string) =>
    request<{ claimed: number }>('/api/my/claim', {
      method: 'POST',
      body: JSON.stringify({ guest_id: guestId }),
    }),
}
