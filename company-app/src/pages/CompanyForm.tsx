import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CompanyShell from '../components/CompanyShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'

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

export default function CompanyForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState<FormData>(INITIAL)
  const [structuring, setStructuring] = useState(false)
  const [structured, setStructured] = useState(false)
  const [completeness, setCompleteness] = useState(0)
  const [missingFields, setMissingFields] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof FormData) => (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const handleStructure = async () => {
    setStructuring(true)
    setError(null)
    try {
      const res = await api.createCompanyProfile({
        company_id: 'company-001',
        job_id: 'job-001',
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
      localStorage.setItem('mm_job_id', 'job-001')
    } catch (e) {
      setError('構造化に失敗しました。バックエンドが起動しているか確認してください。')
      console.error(e)
    } finally {
      setStructuring(false)
    }
  }

  const filled = Object.values(form).filter(v => v.trim()).length

  return (
    <CompanyShell>
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
          </div>

          {/* Reality fields */}
          {[
            { key: 'dailyTasks' as const, label: '仕事内容の実態', placeholder: '例: 企画40%、顧客ヒアリング30%、資料作成20%', hint: '求人票ではなく実際の業務構成を記載してください' },
            { key: 'ojtStructure' as const, label: 'OJT / 育成体制', placeholder: '例: 初月は週1メンター面談。相談はSlack中心。', hint: '入社後の具体的なサポート体制' },
            { key: 'leaveReality' as const, label: '有休・残業の運用実態', placeholder: '例: 平均残業18時間。繁忙期以外は取得推奨。', hint: '制度だけでなく実際の取得しやすさも記載' },
            { key: 'cultureValues' as const, label: '文化・価値観', placeholder: '例: 自走と透明な共有を重視。早めに相談。', hint: 'チームの雰囲気・意思決定スタイル' },
            { key: 'evaluationCriteria' as const, label: '評価基準', placeholder: '例: 四半期ごとにOKRで目標設定。定量・定性50%ずつ。', hint: '入社1年目の評価の仕組み' },
            { key: 'workstyle' as const, label: '働き方', placeholder: '例: 週2リモート可。フレックス制。', hint: '出社・リモート・残業の実態' },
          ].map(({ key, label, placeholder, hint }) => (
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
                onClick={() => navigate('/')}
                style={{ padding: '12px 28px' }}
              >
                ダッシュボードへ →
              </Button>
            )}
          </div>
        </Card>
      </div>
    </CompanyShell>
  )
}
