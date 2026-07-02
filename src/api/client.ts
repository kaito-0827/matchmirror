import type {
  SessionCreateResponse,
  MessageResponse,
  ReportGenerateResponse,
  CompanyProfileResponse,
  CompanyRealityInput,
  FollowUpPlanResponse,
  AutopilotResponse,
  CompanyDashboard,
  PostInterviewFeedbackItem,
  PostInterviewResponse,
  GuardrailLogResponse,
  DashboardTrends,
  JobPostingCheckResponse,
  PostingExtractResponse,
  DeepDiveResponse,
  QuestionBankResponse,
  QuestionnaireResponse,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

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

export interface CompanyAccountInfo {
  id: string
  name: string
  industry: string | null
  size_band: string | null
  region: string | null
  contact_email: string | null
}

export interface MeResponse {
  account: { uid: string; email: string | null; role: string; user_id: string | null; company_id: string | null }
  user: Record<string, unknown> | null
  company: CompanyAccountInfo | null
}

export interface MyCompanyProfileItem {
  profile_id: string | null
  job_id: string
  job_title: string | null
  completeness: number | null
  created_at: string | null
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
  revision: number
  parent_report_id: string | null
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

export interface CompanyMatchItem {
  id: string
  candidate_name: string
  job_id?: string
  overall_score: number
  main_concerns: string[]
  notification: string
  company_prep: string[]
  read: boolean
  created_at: string
}

export const api = {
  // --- 診断セッション ---
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

  deepDive: (sessionId: string) =>
    request<DeepDiveResponse>(`/api/diagnosis/sessions/${sessionId}/deep-dive`, {
      method: 'POST',
    }),

  reopenSession: (sessionId: string) =>
    request<{ session_id: string; first_question: string; message: string }>(
      `/api/diagnosis/sessions/${sessionId}/reopen`,
      { method: 'POST' },
    ),

  // --- レポート ---
  generateReport: (sessionId: string) =>
    request<ReportGenerateResponse>(`/api/diagnosis/sessions/${sessionId}/report`, {
      method: 'POST',
    }),

  getReport: (reportId: string) =>
    request<ReportGenerateResponse & { id: string }>(`/api/reports/${reportId}`),

  submitPostInterview: (reportId: string, feedbacks: PostInterviewFeedbackItem[]) =>
    request<PostInterviewResponse>(`/api/reports/${reportId}/post-interview`, {
      method: 'POST',
      body: JSON.stringify({ feedbacks }),
    }),

  getGuardrailLog: (reportId: string) =>
    request<GuardrailLogResponse>(`/api/reports/${reportId}/guardrail-log`),

  // --- 企業プロファイル ---
  createCompanyProfile: (data: CompanyRealityInput) =>
    request<CompanyProfileResponse>('/api/company-profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listCompanies: () => request<{ items: CompanyListItem[]; total: number }>('/api/company-profiles'),

  checkJobPosting: (profileId: string, postingText: string) =>
    request<JobPostingCheckResponse>(`/api/company-profiles/${profileId}/posting-check`, {
      method: 'POST',
      body: JSON.stringify({ posting_text: postingText }),
    }),

  extractFromPosting: (postingText: string) =>
    request<PostingExtractResponse>('/api/company-profiles/extract-from-posting', {
      method: 'POST',
      body: JSON.stringify({ posting_text: postingText }),
    }),

  getQuestionBank: () =>
    request<QuestionBankResponse>('/api/company-profiles/question-bank'),

  generateFromAnswers: (answers: { question_id: string; value: string }[]) =>
    request<QuestionnaireResponse>('/api/company-profiles/generate-from-answers', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  // --- フォロー計画 ---
  generateFollowUpPlan: (reportId: string) =>
    request<FollowUpPlanResponse>(`/api/reports/${reportId}/follow-up-plan`, {
      method: 'POST',
    }),

  approveFollowUpPlan: (planId: string) =>
    request<{ message: string }>(`/api/follow-up-plans/${planId}/approve`, {
      method: 'PATCH',
    }),

  runAutopilot: (reportId: string) =>
    request<AutopilotResponse>(`/api/reports/${reportId}/autopilot`, {
      method: 'POST',
    }),

  // --- ダッシュボード ---
  getCompanyDashboard: (jobId: string) =>
    request<CompanyDashboard>(`/api/company-dashboard/jobs/${jobId}`),

  getDashboardTrends: (jobId: string) =>
    request<DashboardTrends>(`/api/company-dashboard/jobs/${jobId}/trends`),

  // --- レコメンド・比較 ---
  getRecommendations: (body: { session_id?: string; signals?: string[]; priority_axes?: string[]; limit?: number }) =>
    request<RecommendationResponse>('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  compareReports: (sessionId: string, jobIds: string[]) =>
    request<CompareResponse>(`/api/diagnosis/sessions/${sessionId}/compare`, {
      method: 'POST',
      body: JSON.stringify({ job_ids: jobIds }),
    }),

  // --- 認証・アカウント ---
  getMe: () => request<MeResponse>('/api/auth/me'),

  registerCandidate: (body: { display_name: string; career_stage?: string }) =>
    request<MeResponse>('/api/auth/register/candidate', {
      method: 'POST',
      body: JSON.stringify({ career_stage: 'new_grad', ...body }),
    }),

  registerCompany: (body: { name: string; industry?: string; size_band?: string; region?: string; contact_email?: string }) =>
    request<MeResponse>('/api/auth/register/company', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCompany: (companyId: string, body: { name?: string; industry?: string; size_band?: string; region?: string; contact_email?: string }) =>
    request<CompanyAccountInfo>(`/api/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  getMyCompanyProfiles: () =>
    request<{ items: MyCompanyProfileItem[]; total: number; company_id: string | null }>('/api/company-profiles/mine'),

  getMyCompanyMatches: () =>
    request<{ items: CompanyMatchItem[]; total: number; unread: number }>('/api/company-matches/mine'),

  // --- マイレポート / ゲスト引き継ぎ ---
  getMyReports: () => request<{ items: MyReportItem[]; total: number }>('/api/my/reports'),

  claimGuest: (guestId: string) =>
    request<{ claimed: number }>('/api/my/claim', {
      method: 'POST',
      body: JSON.stringify({ guest_id: guestId }),
    }),

  // --- マッチング ---
  createMatch: (reportId: string) =>
    request<MatchRecord>('/api/matches', {
      method: 'POST',
      body: JSON.stringify({ report_id: reportId }),
    }),

  getMyMatches: () => request<{ items: MatchRecord[]; total: number }>('/api/my/matches'),

  getCompanyMatches: (jobId: string) =>
    request<{ items: CompanyMatchItem[]; total: number; unread: number }>(`/api/company-matches/jobs/${jobId}`),

  markMatchRead: (matchId: string) =>
    request<{ id: string; read: boolean }>(`/api/company-matches/${matchId}/read`, { method: 'POST' }),
}
