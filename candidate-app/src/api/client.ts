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
// Firebase有効時は Bearer トークン、開発時は X-Dev-* ヘッダを返す。
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

  // --- 認証・アカウント ---
  getMe: () => request<MeResponse>('/api/auth/me'),

  registerCandidate: (body: { display_name: string; career_stage?: string }) =>
    request<MeResponse>('/api/auth/register/candidate', {
      method: 'POST',
      body: JSON.stringify({ career_stage: 'new_grad', ...body }),
    }),

  // --- 会社一覧（診断対象の選択用） ---
  listCompanies: () => request<CompanyListResponse>('/api/company-profiles'),

  // --- 合う企業の推薦（診断結果から） ---
  getRecommendations: (body: { session_id?: string; signals?: string[]; priority_axes?: string[]; limit?: number }) =>
    request<RecommendationResponse>('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // --- 複数社の比較（1セッションのシグナルを複数社に照合） ---
  compareReports: (sessionId: string, jobIds: string[]) =>
    request<CompareResponse>(`/api/diagnosis/sessions/${sessionId}/compare`, {
      method: 'POST',
      body: JSON.stringify({ job_ids: jobIds }),
    }),

  // --- マイレポート ---
  getMyReports: () => request<{ items: MyReportItem[]; total: number }>('/api/my/reports'),

  getReport: (reportId: string) =>
    request<import('./types').ReportGenerateResponse & { id: string }>(`/api/reports/${reportId}`),

  // --- マッチング ---
  getMyMatches: () => request<{ items: MatchRecord[]; total: number }>('/api/my/matches'),
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

export interface CompanyListResponse {
  items: CompanyListItem[]
  total: number
}

export interface MyReportItem {
  id: string
  job_id: string
  overall_score: number
  candidate_summary: string
  created_at: string
  gap_count: number
}

export interface RecommendationItem {
  job_id: string
  company_id: string
  name: string | null
  industry: string | null
  region: string | null
  size_band: string | null
  job_title: string
  score: number
  reasons: string[]
}

export interface RecommendationResponse {
  items: RecommendationItem[]
  based_on: { signals: string[]; priority_axes: string[] }
  total_candidates: number
}

export interface CompareItem {
  job_id: string
  company_name: string | null
  industry: string | null
  region: string | null
  size_band: string | null
  job_title: string
  overall_score: number
  axis_scores: { axis: string; score: number; color?: string; summary?: string }[]
  gaps: { axis: string; title: string; severity: string }[]
  matches: { axis: string; title: string }[]
}

export interface CompareResponse {
  items: CompareItem[]
}

export interface MatchRecord {
  id: string
  user_id: string
  candidate_name: string
  job_id: string
  company_id: string | null
  company_name: string
  report_id: string
  overall_score: number
  main_concerns: string[]
  candidate_prep: string[]
  company_prep: string[]
  notification: string
  read: boolean
  created_at: string
}
