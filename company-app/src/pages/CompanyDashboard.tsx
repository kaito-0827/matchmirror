import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CompanyShell from '../components/CompanyShell'
import Card from '../components/Card'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { CompanyDashboard as DashboardData, DashboardCandidate } from '../api/types'

type ChipVariant = 'danger' | 'amber' | 'teal' | 'blue' | 'gray'

const RISK_VARIANTS: Record<string, ChipVariant> = {
  high: 'danger',
  medium: 'amber',
  low: 'teal',
}

const RISK_LABELS: Record<string, string> = {
  high: '要注意',
  medium: '要確認',
  low: '良好',
}

const CATEGORY_VARIANTS: ChipVariant[] = ['danger', 'amber', 'teal', 'blue', 'gray']

const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
function anonymousLabel(index: number): string {
  if (index < 26) return `候補者 ${ALPHA[index]}`
  return `候補者 ${ALPHA[Math.floor(index / 26) - 1]}${ALPHA[index % 26]}`
}

export default function CompanyDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    const jobId = localStorage.getItem('mm_job_id') || 'job-001'
    api.getCompanyDashboard(jobId)
      .then(res => setData(res))
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <CompanyShell>
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#626b78' }}>ダッシュボードを読み込み中...</div>
        </div>
      </CompanyShell>
    )
  }

  if (fetchError) {
    return (
      <CompanyShell>
        <div style={{ padding: '48px' }}>
          <div style={{
            background: '#ffe8e8', borderRadius: 10, padding: '20px 24px', maxWidth: 520, marginBottom: 20,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#d12e33', marginBottom: 6 }}>バックエンドに接続できません</div>
            <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>
              APIサーバーが起動していないか、接続できません。<br />
              バックエンドを起動してからページを更新してください。
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 22px', background: '#00847f', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ページを更新
          </button>
        </div>
      </CompanyShell>
    )
  }

  const stats = data ? [
    { label: '候補者総数', value: String(data.total_count), unit: '件', color: '#d12e33', bg: '#ffe8e8' },
    { label: '要注意', value: String(data.high_risk_count), unit: '件', color: '#dc8a14', bg: '#fff4db' },
    { label: 'フォロー未完了', value: String(data.pending_followup_count), unit: '件', color: '#626b78', bg: '#f7f9fc' },
  ] : []

  const riskCategories = data ? Object.entries(data.risk_categories) : []
  const candidates: DashboardCandidate[] = data?.candidates ?? []
  const selected = selectedIndex !== null ? candidates[selectedIndex] : null

  const openPlan = (c: DashboardCandidate, index: number) => {
    if (!c.report_id) return
    const params = new URLSearchParams({ reportId: c.report_id, label: anonymousLabel(index) })
    navigate(`/followup?${params.toString()}`)
  }

  return (
    <CompanyShell>
      <div style={{ padding: '32px 48px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 4px' }}>候補者フォロー・ダッシュボード</h1>
          <p style={{ fontSize: 14, color: '#626b78', margin: 0 }}>
            候補者の不安カテゴリを集計し、フォロー優先度を一覧表示しています。個人情報は表示されません。
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {stats.map(({ label, value, unit, color, bg }) => (
            <Card key={label} style={{ padding: 24 }}>
              <div style={{ fontSize: 13, color: '#626b78', marginBottom: 8 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: 14, color: '#626b78' }}>{unit}</span>
              </div>
              <div style={{ marginTop: 12, height: 4, background: bg, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(parseInt(value) / 15 * 100, 100)}%`,
                  height: '100%', background: color, borderRadius: 2,
                }} />
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
          {/* Candidate table + detail panel */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>候補者一覧</div>
            <Card style={{ overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '100px 60px 1fr 1fr 90px',
                padding: '10px 20px',
                background: '#f7f9fc',
                borderBottom: '1px solid #d2dae5',
                fontSize: 12, fontWeight: 600, color: '#626b78',
              }}>
                <div>候補者</div>
                <div>リスク</div>
                <div>主な不安カテゴリ</div>
                <div>推奨フォロー</div>
                <div>フォロー計画</div>
              </div>

              {candidates.length === 0 && (
                <div style={{ padding: '32px 20px', fontSize: 14, color: '#9aa3af', textAlign: 'center' }}>
                  候補者データがありません
                </div>
              )}

              {candidates.map((c, i) => {
                const label = anonymousLabel(i)
                const isSelected = selectedIndex === i
                return (
                  <div
                    key={c.user_id}
                    onClick={() => setSelectedIndex(isSelected ? null : i)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 60px 1fr 1fr 90px',
                      padding: '14px 20px',
                      borderBottom: i < candidates.length - 1 ? '1px solid #d2dae5' : 'none',
                      alignItems: 'center',
                      cursor: 'pointer',
                      background: isSelected ? '#f0faf9' : '#fff',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Label */}
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#141922' }}>{label}</div>

                    {/* Risk */}
                    <div>
                      <Chip variant={RISK_VARIANTS[c.risk_level] ?? 'gray'}>
                        {RISK_LABELS[c.risk_level] ?? c.risk_level}
                      </Chip>
                    </div>

                    {/* Concerns */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {c.main_concerns.map(concern => (
                        <Chip key={concern} variant="gray">{concern}</Chip>
                      ))}
                    </div>

                    {/* Recommended action */}
                    <div style={{ fontSize: 12, color: '#626b78', lineHeight: 1.4 }}>{c.recommended_action}</div>

                    {/* Action button */}
                    <div onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openPlan(c, i)}
                        disabled={!c.report_id}
                        style={{
                          padding: '5px 12px',
                          background: c.report_id ? '#00847f' : '#f7f9fc',
                          border: 'none',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          color: c.report_id ? '#fff' : '#9aa3af',
                          cursor: c.report_id ? 'pointer' : 'default',
                          fontFamily: 'inherit',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        計画を見る
                      </button>
                    </div>
                  </div>
                )
              })}
            </Card>

            {/* Candidate detail panel (inline, below selected row) */}
            {selected && selectedIndex !== null && (
              <Card style={{ padding: 24, marginTop: 16, borderLeft: '4px solid #00847f' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>
                    {anonymousLabel(selectedIndex)} の詳細
                  </div>
                  <Chip variant={RISK_VARIANTS[selected.risk_level] ?? 'gray'}>
                    {RISK_LABELS[selected.risk_level] ?? selected.risk_level}
                  </Chip>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 6 }}>不安カテゴリ</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.main_concerns.map(c => (
                      <Chip key={c} variant={RISK_VARIANTS[selected.risk_level] ?? 'gray'}>{c}</Chip>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 4 }}>推奨フォローアクション</div>
                  <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>{selected.recommended_action}</div>
                </div>

                <button
                  onClick={() => openPlan(selected, selectedIndex)}
                  disabled={!selected.report_id}
                  style={{
                    padding: '10px 22px',
                    background: selected.report_id ? '#00847f' : '#d2dae5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: selected.report_id ? 'pointer' : 'default',
                    fontFamily: 'inherit',
                  }}
                >
                  {selected.report_id ? 'フォロー計画を表示 →' : '診断レポートなし'}
                </button>
              </Card>
            )}
          </div>

          {/* Right panel: common concerns */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>よくある不安カテゴリ</div>
            <Card style={{ padding: 20 }}>
              {riskCategories.map(([label, count], idx) => (
                <div
                  key={label}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}
                >
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
                marginTop: 16, padding: '10px 14px', background: '#f0faf9',
                borderRadius: 8, fontSize: 12, color: '#00847f', lineHeight: 1.5,
                border: '1px solid #b2e4e2',
              }}>
                候補者の個人情報はすべて匿名化されています。表示されるのはカテゴリのみです。
              </div>
            </Card>
          </div>
        </div>
      </div>
    </CompanyShell>
  )
}
