import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { ExtractedField } from '../api/types'

interface FormData {
  jobTitle: string
  dailyTasks: string
  ojtStructure: string
  leaveReality: string
  cultureValues: string
  evaluationCriteria: string
  workstyle: string
}

const INITIAL: FormData = {
  jobTitle: 'AIソリューション企画',
  dailyTasks: '企画40%、顧客ヒアリング30%、資料作成20%',
  ojtStructure: '初月は週1メンター面談。相談はSlack中心。',
  leaveReality: '平均残業18時間。繁忙期以外は取得推奨。',
  cultureValues: '自走と透明な共有を重視。早めに相談。',
  evaluationCriteria: '',
  workstyle: '',
}

// バックエンドのスネークケースキー ⇄ フォームstateのキー対応
const FIELD_KEY_MAP: Record<string, keyof FormData> = {
  job_title: 'jobTitle',
  daily_tasks: 'dailyTasks',
  ojt_structure: 'ojtStructure',
  leave_reality: 'leaveReality',
  culture_values: 'cultureValues',
  evaluation_criteria: 'evaluationCriteria',
  workstyle: 'workstyle',
}

const RISK_CHIP: Record<string, { variant: 'danger' | 'amber' | 'teal'; label: string }> = {
  high: { variant: 'danger', label: '要修正' },
  medium: { variant: 'amber', label: '要確認' },
  low: { variant: 'teal', label: '問題なし' },
}

export default function CompanyForm() {
  const navigate = useNavigate()
  const { companyId } = useAuth()
  const [form, setForm] = useState<FormData>(INITIAL)
  const [structuring, setStructuring] = useState(false)
  const [structured, setStructured] = useState(false)
  const [completeness, setCompleteness] = useState(0)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const [postingText, setPostingText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([])
  const [extractError, setExtractError] = useState<string | null>(null)

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const fieldByKey = (fieldKey: string) => extractedFields.find(f => f.field_key === fieldKey)

  const handleExtract = async () => {
    if (!postingText.trim()) { setExtractError('求人票のテキストを入力してください。'); return }
    setExtracting(true)
    setExtractError(null)
    try {
      const res = await api.extractFromPosting(postingText)
      setForm(prev => {
        const next = { ...prev }
        for (const [snakeKey, value] of Object.entries(res.form_fields)) {
          const formKey = FIELD_KEY_MAP[snakeKey]
          if (formKey && value) next[formKey] = value
        }
        return next
      })
      setExtractedFields(res.extracted_fields)
    } catch (e) {
      setExtractError('求人票の読み取りに失敗しました。もう一度お試しください。')
      console.error(e)
    } finally {
      setExtracting(false)
    }
  }

  const handleStructure = async () => {
    setStructuring(true)
    setError(null)
    // ログイン中の会社アカウントに紐づける（未ログイン/デモ時は company-001 にフォールバック）
    const cid = companyId || 'company-001'
    const jid = companyId ? `job-${companyId}` : 'job-001'
    try {
      const res = await api.createCompanyProfile({
        company_id: cid,
        job_id: jid,
        job_title: form.jobTitle,
        daily_tasks: form.dailyTasks,
        ojt_structure: form.ojtStructure,
        leave_reality: form.leaveReality,
        culture_values: form.cultureValues,
        evaluation_criteria: form.evaluationCriteria || undefined,
        workstyle: form.workstyle || undefined,
      })
      setCompleteness(res.completeness)
      setMissingFields(res.missing_fields)
      setStructured(true)
      localStorage.setItem('mm_job_id', jid)
    } catch (e) {
      setError('構造化に失敗しました。バックエンドが起動しているか確認してください。')
      console.error(e)
    } finally {
      setStructuring(false)
    }
  }

  const filled = Object.values(form).filter(v => v.trim()).length

  return (
    <AppShell activeStep="企業実態">
      <div style={{ padding: '32px 48px', maxWidth: 880 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: 0 }}>企業実態を登録</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip variant="blue">CompanyAgent</Chip>
          </div>
        </div>
        <p style={{ fontSize: 14, color: '#626b78', marginBottom: 8 }}>
          企業側には候補者個人の詳細ではなく、ズレのカテゴリ、根拠資料、次のフォロータスクを中心に表示する。
        </p>

        {/* 求人票から自動入力 */}
        <Card style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>📋 求人票から自動入力</div>
            <Chip variant="purple">CompanyAgent</Chip>
          </div>
          <div style={{ fontSize: 12, color: '#626b78', marginBottom: 12 }}>
            求人票のテキストを貼り付けると、AIが7項目を読み取って自動入力します。同時に表現の誇張・曖昧・情報不足も検出します。
          </div>
          <textarea
            value={postingText}
            onChange={e => setPostingText(e.target.value)}
            placeholder="求人票全文をここに貼り付けてください。"
            rows={6}
            style={{
              width: '100%', padding: '10px 14px', border: '1px solid #d2dae5',
              borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', color: '#141922', lineHeight: 1.5, boxSizing: 'border-box', marginBottom: 12,
            }}
          />
          {extractError && (
            <div style={{ fontSize: 13, color: '#d12e33', marginBottom: 12 }}>{extractError}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleExtract} disabled={extracting || !postingText.trim()} style={{ padding: '10px 20px' }}>
              {extracting ? 'AIが読み取り中...' : 'AIで読み取り、フォームに自動入力'}
            </Button>
          </div>

          {extractedFields.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e7ebf2' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 10 }}>軸別チェック結果</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {extractedFields.map(f => {
                  const risk = RISK_CHIP[f.divergence_risk] ?? RISK_CHIP.low
                  return (
                    <div key={f.field_key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13 }}>
                      <Chip variant={risk.variant}>{risk.label}</Chip>
                      <div>
                        <span style={{ fontWeight: 700, color: '#141922' }}>{f.axis_label}</span>
                        {!f.in_posting && <span style={{ color: '#dc8a14', marginLeft: 6 }}>（求人票に記載なし）</span>}
                        {f.divergence_note && (
                          <div style={{ color: '#626b78', marginTop: 2 }}>{f.divergence_note}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: '#626b78' }}>入力完了：{filled} / 7項目</div>
          <div style={{ flex: 1, maxWidth: 200, height: 6, background: '#e7ebf2', borderRadius: 3 }}>
            <div style={{
              width: `${(filled / 7) * 100}%`,
              height: '100%',
              background: '#00847f',
              borderRadius: 3,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>

        <Card style={{ padding: 32 }}>
          {/* Job title */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 6 }}>
              職種・ポジション
            </label>
            <input
              value={form.jobTitle}
              onChange={set('jobTitle')}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #d2dae5',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                color: '#141922',
                boxSizing: 'border-box',
              }}
            />
            {fieldByKey('job_title') && (
              <DivergencePanel field={fieldByKey('job_title')!} />
            )}
          </div>

          {/* Reality fields */}
          {[
            { key: 'dailyTasks' as const, fieldKey: 'daily_tasks', label: '仕事内容の実態', placeholder: '例: 企画40%、顧客ヒアリング30%、資料作成20%', hint: '求人票ではなく実際の業務構成を記載してください' },
            { key: 'ojtStructure' as const, fieldKey: 'ojt_structure', label: 'OJT / 育成体制', placeholder: '例: 初月は週1メンター面談。相談はSlack中心。', hint: '入社後の具体的なサポート体制' },
            { key: 'leaveReality' as const, fieldKey: 'leave_reality', label: '有休・残業の運用実態', placeholder: '例: 平均残業18時間。繁忙期以外は取得推奨。', hint: '制度だけでなく実際の取得しやすさも記載' },
            { key: 'cultureValues' as const, fieldKey: 'culture_values', label: '文化・価値観', placeholder: '例: 自走と透明な共有を重視。早めに相談。', hint: 'チームの雰囲気・意思決定スタイル' },
            { key: 'evaluationCriteria' as const, fieldKey: 'evaluation_criteria', label: '評価基準', placeholder: '例: 四半期ごとにOKRで目標設定。定量・定性50%ずつ。', hint: '入社1年目の評価の仕組み' },
            { key: 'workstyle' as const, fieldKey: 'workstyle', label: '働き方', placeholder: '例: 週2リモート可。フレックス制。', hint: '出社・リモート・残業の実態' },
          ].map(({ key, fieldKey, label, placeholder, hint }) => (
            <div key={key} style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 4 }}>
                {label}
              </label>
              <div style={{ fontSize: 12, color: '#626b78', marginBottom: 6 }}>{hint}</div>
              <textarea
                value={form[key]}
                onChange={set(key)}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #d2dae5',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  color: '#141922',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
              {fieldByKey(fieldKey) && (
                <DivergencePanel field={fieldByKey(fieldKey)!} />
              )}
            </div>
          ))}

          {error && (
            <div style={{
              background: '#ffe8e8',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
              fontSize: 14,
              color: '#d12e33',
            }}>
              {error}
            </div>
          )}

          {structured && (
            <div style={{
              background: '#ddf7f4',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
              fontSize: 14,
              color: '#00847f',
              fontWeight: 600,
            }}>
              ✓ CompanyAgentによる構造化が完了しました（充足率 {completeness}%）。
              {missingFields.length > 0 && (
                <div style={{ fontWeight: 400, marginTop: 4, fontSize: 13 }}>
                  未入力: {missingFields.join('、')}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              onClick={handleStructure}
              disabled={structuring || filled < 3}
              style={{ padding: '12px 28px' }}
            >
              {structuring ? 'CompanyAgentが構造化中...' : 'CompanyAgentで構造化'}
            </Button>
            {structured && (
              <Button
                variant="secondary"
                onClick={() => navigate('/company/dashboard')}
                style={{ padding: '12px 28px' }}
              >
                ダッシュボードへ →
              </Button>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

function DivergencePanel({ field }: { field: ExtractedField }) {
  const risk = RISK_CHIP[field.divergence_risk] ?? RISK_CHIP.low
  if (field.divergence_risk === 'low' && !field.divergence_note && field.in_posting) return null
  return (
    <div style={{
      marginTop: 8, padding: '10px 12px', background: '#f7f9fc', borderRadius: 8,
      fontSize: 12, color: '#626b78', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Chip variant={risk.variant}>{risk.label}</Chip>
        {field.in_posting && field.source_quote && (
          <span>求人票の記述: 「{field.source_quote}」</span>
        )}
        {!field.in_posting && <span style={{ color: '#dc8a14' }}>求人票に記載なし</span>}
      </div>
      {field.divergence_note && <div>{field.divergence_note}</div>}
    </div>
  )
}
