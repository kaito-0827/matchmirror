import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api, type CompanyMatchItem } from '../api/client'
import type { CompanyDashboard as DashboardData, DashboardCandidate } from '../api/types'

type ChipVariant = 'danger' | 'amber' | 'teal' | 'blue' | 'gray'

const RISK_VARIANTS: Record<string, ChipVariant> = {
  high: 'danger',
  medium: 'amber',
  low: 'teal',
}

const CATEGORY_VARIANTS: ChipVariant[] = ['danger', 'amber', 'teal', 'blue', 'gray']

export default function CompanyDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [matches, setMatches] = useState<CompanyMatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    const jobId = localStorage.getItem('mm_job_id') || 'job-001'
    api.getCompanyDashboard(jobId)
      .then(res => setData(res))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
    api.getCompanyMatches(jobId).then(res => setMatches(res.items)).catch(() => { /* ignore */ })
  }, [])

  const markRead = (id: string) => {
    api.markMatchRead(id).then(() => setMatches(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))).catch(() => { /* ignore */ })
  }

  if (loading) {
    return (
      <AppShell activeStep="企業実態">
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#626b78' }}>ダッシュボードを読み込み中...</div>
        </div>
      </AppShell>
    )
  }

  if (fetchError) {
    return (
      <AppShell activeStep="企業実態">
        <div style={{ padding: '48px' }}>
          <div style={{
            background: '#ffe8e8',
            borderRadius: 10,
            padding: '20px 24px',
            maxWidth: 520,
            marginBottom: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#d12e33', marginBottom: 6 }}>バックエンドに接続できません</div>
            <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>
              APIサーバーが起動していないか、接続できません。<br />
              バックエンドを起動してからページを更新してください。
            </div>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            ページを更新
          </Button>
        </div>
      </AppShell>
    )
  }

  const stats = data ? [
    { label: '候補者総数', value: String(data.total_count), unit: '件', color: '#d12e33', bg: '#ffe8e8' },
    { label: '高リスク', value: String(data.high_risk_count), unit: '件', color: '#dc8a14', bg: '#fff4db' },
    { label: 'フォロー未完了', value: String(data.pending_followup_count), unit: '件', color: '#626b78', bg: '#f7f9fc' },
  ] : []

  const riskCategories = data ? Object.entries(data.risk_categories) : []
  const candidates: DashboardCandidate[] = data?.candidates ?? []

  return (
    <AppShell activeStep="企業実態">
      <div style={{ padding: '32px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 4px' }}>候補者フォロー・ダッシュボード</h1>
            <p style={{ fontSize: 14, color: '#626b78', margin: 0 }}>
              候補者個人の不安を抽象化し、フォロータスクに変換した一覧
            </p>
          </div>
          <Button onClick={() => navigate('/company/followup')} style={{ padding: '10px 20px' }}>
            フォロー計画を見る
          </Button>
        </div>

        {/* Match notifications */}
        {matches.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>マッチング通知</div>
              <Chip variant="teal">{matches.length}件</Chip>
              {matches.some(m => !m.read) && <Chip variant="danger">未読 {matches.filter(m => !m.read).length}</Chip>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matches.map(m => (
                <Card key={m.id} style={{ padding: 18, borderLeft: `4px solid ${m.read ? '#d2dae5' : '#00847f'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>
                      ♥ {m.candidate_name} さんがマッチングしました
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#00847f', fontWeight: 700 }}>合う度 {m.overall_score}%</span>
                    </div>
                    {!m.read && (
                      <button onClick={() => markRead(m.id)} style={{
                        padding: '3px 10px', background: '#fff', border: '1px solid #d2dae5', borderRadius: 6,
                        fontSize: 11, color: '#626b78', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      }}>既読にする</button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#141922', background: '#f0faf9', borderRadius: 8, padding: '10px 12px', marginBottom: 10, lineHeight: 1.6 }}>
                    {m.notification}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 6 }}>面接でお話しすべきこと</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {m.company_prep.map((p, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#141922', lineHeight: 1.7 }}>{p}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {stats.map(({ label, value, unit, color, bg }) => (
            <Card key={label} style={{ padding: 24 }}>
              <div style={{ fontSize: 13, color: '#626b78', marginBottom: 8 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: 14, color: '#626b78' }}>{unit}</span>
              </div>
              <div style={{
                marginTop: 12,
                height: 4,
                background: bg,
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(parseInt(value) / 15 * 100, 100)}%`,
                  height: '100%',
                  background: color,
                  borderRadius: 2,
                }} />
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Candidate table */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>候補者ごとのフォロー状況</div>
            <Card style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 1fr 80px',
                padding: '10px 20px',
                background: '#f7f9fc',
                borderBottom: '1px solid #d2dae5',
                fontSize: 12,
                fontWeight: 600,
                color: '#626b78',
              }}>
                <div>候補者</div>
                <div>主な不安カテゴリ</div>
                <div>推奨フォロー</div>
                <div>アクション</div>
              </div>
              {candidates.map((c, i) => (
                <div
                  key={c.user_id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '80px 1fr 1fr 80px',
                    padding: '16px 20px',
                    borderBottom: i < candidates.length - 1 ? '1px solid #d2dae5' : 'none',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>{c.display_name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.main_concerns.map(concern => (
                      <Chip key={concern} variant={RISK_VARIANTS[c.risk_level] ?? 'gray'}>{concern}</Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: '#626b78' }}>{c.recommended_action}</div>
                  <div>
                    <button
                      onClick={() => navigate('/company/followup')}
                      style={{
                        padding: '4px 10px',
                        background: '#e9f0ff',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        color: '#2863db',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      計画
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Common concerns */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>よくある不安カテゴリ</div>
            <Card style={{ padding: 20 }}>
              {riskCategories.map(([label, count], idx) => (
                <div
                  key={label}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                >
                  <Chip variant={CATEGORY_VARIANTS[idx % CATEGORY_VARIANTS.length]}>{label}</Chip>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#141922',
                  }}>{count}<span style={{ fontSize: 12, fontWeight: 500, color: '#626b78' }}>件</span></div>
                </div>
              ))}
              {data?.common_questions && data.common_questions.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>よくある質問</div>
                  {data.common_questions.map((q, i) => (
                    <div key={i} style={{
                      padding: '8px 12px',
                      background: '#f7f9fc',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#141922',
                      marginBottom: 6,
                      lineHeight: 1.4,
                    }}>
                      {q}
                    </div>
                  ))}
                </div>
              )}
              <div style={{
                marginTop: 16,
                padding: '10px 14px',
                background: '#f7f9fc',
                borderRadius: 8,
                fontSize: 12,
                color: '#626b78',
                lineHeight: 1.5,
              }}>
                候補者ごとの個人情報ではなく、集計されたカテゴリのみを表示しています。
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
