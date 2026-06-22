import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api, type CompanyMatchItem } from '../api/client'
import type { CompanyDashboard as DashboardData, DashboardCandidate, DashboardTrends } from '../api/types'

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
  const [trends, setTrends] = useState<DashboardTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [showTrends, setShowTrends] = useState(false)

  useEffect(() => {
    const jobId = localStorage.getItem('mm_job_id') || 'job-001'
    Promise.all([
      api.getCompanyDashboard(jobId),
      api.getCompanyMatches(jobId).catch(() => ({ items: [] as CompanyMatchItem[], total: 0, unread: 0 })),
      api.getDashboardTrends(jobId).catch(() => null),
    ])
      .then(([dash, matchRes, trendRes]) => {
        setData(dash)
        setMatches(matchRes.items)
        setTrends(trendRes)
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [])

  const markRead = (id: string) => {
    api.markMatchRead(id)
      .then(() => setMatches(prev => prev.map(m => m.id === id ? { ...m, read: true } : m)))
      .catch(() => {})
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
          <div style={{ background: '#ffe8e8', borderRadius: 10, padding: '20px 24px', maxWidth: 520, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#d12e33', marginBottom: 6 }}>バックエンドに接続できません</div>
            <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>
              APIサーバーが起動していないか、接続できません。<br />
              バックエンドを起動してからページを更新してください。
            </div>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>ページを更新</Button>
        </div>
      </AppShell>
    )
  }

  const stats = data ? [
    { label: '候補者総数', value: String(data.total_count), color: '#d12e33', bg: '#ffe8e8' },
    { label: '高リスク', value: String(data.high_risk_count), color: '#dc8a14', bg: '#fff4db' },
    { label: 'フォロー未完了', value: String(data.pending_followup_count), color: '#626b78', bg: '#f7f9fc' },
    { label: '面談後も懸念あり', value: String(data.pending_concern_count ?? 0), color: '#d12e33', bg: '#ffe8e8' },
  ] : []

  const riskCategories = data ? Object.entries(data.risk_categories) : []
  const candidates: DashboardCandidate[] = data?.candidates ?? []
  const pendingConcernCandidates = candidates.filter(c => (c.unresolved_count ?? 0) > 0)

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
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" onClick={() => navigate('/company/posting-check')} style={{ padding: '10px 16px' }}>
              求人票チェック
            </Button>
            <Button onClick={() => navigate('/company/followup')} style={{ padding: '10px 20px' }}>
              フォロー計画を見る
            </Button>
          </div>
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

        {/* 面談後も懸念が残る候補者（あれば上部に強調表示） */}
        {pendingConcernCandidates.length > 0 && (
          <div style={{ marginBottom: 24, padding: '16px 20px', background: '#ffe8e8', border: '1px solid #f4b8b8', borderRadius: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#d12e33', marginBottom: 8 }}>
              ⚠️ 面談後も懸念が残る候補者 ({pendingConcernCandidates.length}名)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingConcernCandidates.map((c, ci) => (
                <div key={c.report_id ?? `${c.user_id}-${ci}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>{c.display_name}</div>
                  <Chip variant="danger">未解決 {c.unresolved_count}件</Chip>
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {c.main_concerns.map((concern, idx) => (
                      <Chip key={`${concern}-${idx}`} variant="amber">{concern}</Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: '#626b78' }}>→ {c.recommended_action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {stats.map(({ label, value, color, bg }) => (
            <Card key={label} style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#626b78', marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: 13, color: '#626b78' }}>件</span>
              </div>
              <div style={{ marginTop: 10, height: 4, background: bg, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(parseInt(value) / 15 * 100, 100)}%`,
                  height: '100%', background: color, borderRadius: 2,
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
                display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px',
                padding: '10px 20px', background: '#f7f9fc', borderBottom: '1px solid #d2dae5',
                fontSize: 12, fontWeight: 600, color: '#626b78',
              }}>
                <div>候補者</div>
                <div>主な不安カテゴリ</div>
                <div>推奨フォロー</div>
                <div>アクション</div>
              </div>
              {candidates.map((c, i) => (
                <div key={c.report_id ?? `${c.user_id}-${i}`} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px',
                  padding: '16px 20px',
                  borderBottom: i < candidates.length - 1 ? '1px solid #d2dae5' : 'none',
                  alignItems: 'center',
                  background: (c.unresolved_count ?? 0) > 0 ? '#fff8f8' : 'transparent',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>
                    {c.display_name}
                    {(c.unresolved_count ?? 0) > 0 && (
                      <div style={{ fontSize: 10, color: '#d12e33', fontWeight: 600 }}>懸念残{c.unresolved_count}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.main_concerns.map((concern, idx) => (
                      <Chip key={`${concern}-${idx}`} variant={RISK_VARIANTS[c.risk_level] ?? 'gray'}>{concern}</Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: '#626b78' }}>{c.recommended_action}</div>
                  <div>
                    <button
                      onClick={() => navigate(c.report_id
                        ? `/company/followup?reportId=${encodeURIComponent(c.report_id)}&label=${encodeURIComponent(c.display_name)}`
                        : '/company/followup')}
                      style={{
                        padding: '4px 10px', background: '#e9f0ff', border: 'none', borderRadius: 6,
                        fontSize: 12, fontWeight: 600, color: '#2863db', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      計画
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Common concerns */}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>よくある不安カテゴリ</div>
              <Card style={{ padding: 20 }}>
                {riskCategories.map(([label, count], idx) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Chip variant={CATEGORY_VARIANTS[idx % CATEGORY_VARIANTS.length]}>{label}</Chip>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#141922' }}>
                      {count}<span style={{ fontSize: 12, fontWeight: 500, color: '#626b78' }}>件</span>
                    </div>
                  </div>
                ))}
                {data?.common_questions && data.common_questions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>よくある質問</div>
                    {data.common_questions.map((q, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', background: '#f7f9fc', borderRadius: 6,
                        fontSize: 12, color: '#141922', marginBottom: 6, lineHeight: 1.4,
                      }}>
                        {q}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{
                  marginTop: 16, padding: '10px 14px', background: '#f7f9fc',
                  borderRadius: 8, fontSize: 12, color: '#626b78', lineHeight: 1.5,
                }}>
                  候補者ごとの個人情報ではなく、集計されたカテゴリのみを表示しています。
                </div>
              </Card>
            </div>

            {/* Trend section */}
            {trends && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>不安カテゴリの傾向</div>
                  <button
                    onClick={() => setShowTrends(p => !p)}
                    style={{
                      padding: '4px 10px', background: 'none', border: '1px solid #d2dae5',
                      borderRadius: 6, fontSize: 12, color: '#626b78', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {showTrends ? '閉じる' : '月次推移'}
                  </button>
                </div>
                <Card style={{ padding: 20 }}>
                  {/* Deltas */}
                  <div style={{ marginBottom: showTrends ? 16 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>先月比</div>
                    {Object.entries(trends.deltas).map(([axis, delta]) => (
                      <div key={axis} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#141922' }}>{axis}</span>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: delta > 0 ? '#d12e33' : delta < 0 ? '#00847f' : '#626b78',
                        }}>
                          {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '→ 変化なし'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Monthly breakdown */}
                  {showTrends && trends.points.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>月次内訳</div>
                      {trends.points.slice(-3).map(point => (
                        <div key={point.period} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: '#626b78', marginBottom: 4 }}>{point.period}</div>
                          {Object.entries(point.axis_counts).map(([axis, count]) => (
                            <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 12, color: '#141922', flex: 1 }}>{axis}</div>
                              <div style={{
                                height: 8, width: `${Math.min(count * 20, 80)}px`, minWidth: 20,
                                background: '#00847f', borderRadius: 4,
                              }} />
                              <div style={{ fontSize: 12, color: '#626b78', minWidth: 16 }}>{count}</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
