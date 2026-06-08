export interface SessionCreateResponse {
  session_id: string
  first_question: string
}

export interface MessageResponse {
  next_question: string
  extracted_signals: string[]
  progress: number
  is_complete: boolean
  quick_replies: string[]
}

export interface AxisScore {
  axis: string
  score: number
  color: string
  summary: string
}

export interface GapItem {
  axis: string
  title: string
  detail: string
  severity: 'high' | 'medium' | 'low'
  recommended_question?: string
}

export interface MatchItem {
  axis: string
  title: string
  detail: string
}

export interface RecommendedQuestion {
  id: string
  axis: string
  text: string
  priority: 'high' | 'medium' | 'low'
  background?: string
}

export interface ReportGenerateResponse {
  report_id: string
  overall_score: number
  axis_scores: AxisScore[]
  gaps: GapItem[]
  matches: MatchItem[]
  questions: RecommendedQuestion[]
  candidate_summary: string
  guardrail_passed: boolean
  confidence: number
}

export interface CompanyProfileResponse {
  profile_id: string
  completeness: number
  missing_fields: string[]
  message: string
}

export interface FollowUpTask {
  id: string
  title: string
  axis: string
  due_label: string
  days_before_join?: number
  days_after_join?: number
  owner: string
  status: 'pending' | 'in_progress' | 'done'
  detail?: string
}

export interface FollowUpPlanResponse {
  plan_id: string
  tasks: FollowUpTask[]
  owner_suggestion: string
}

export interface DashboardCandidate {
  user_id: string
  display_name: string
  main_concerns: string[]
  risk_level: string
  recommended_action: string
  report_id?: string
}

export interface CompanyDashboard {
  job_id: string
  risk_categories: Record<string, number>
  common_questions: string[]
  candidates: DashboardCandidate[]
  total_count: number
  high_risk_count: number
  pending_followup_count: number
}

export interface CompanyRealityInput {
  company_id: string
  job_id: string
  job_title: string
  daily_tasks: string
  ojt_structure: string
  leave_reality: string
  culture_values: string
  evaluation_criteria?: string
  workstyle?: string
}
