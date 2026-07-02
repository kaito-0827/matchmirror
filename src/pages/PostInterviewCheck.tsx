import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { ReportGenerateResponse, PostInterviewFeedbackItem, PostInterviewResponse } from '../api/types'

type Resolution = 'confirmed' | 'unresolved' | 'pending'

interface GapFeedback {
  gap_axis: string
  gap_title: string
  status: Resolution
  note: string
}

function loadCachedReport(): ReportGenerateResponse | null {
  const cached = localStorage.getItem('mm_report')
  if (!cached) return null
  try {
    return JSON.parse(cached) as ReportGenerateResponse
  } catch {
    return null
  }
}

function toPendingFeedbacks(report: ReportGenerateResponse): GapFeedback[] {
  return report.gaps.map(g => ({
    gap_axis: g.axis,
    gap_title: g.title,
    status: 'pending' as Resolution,
    note: '',
  }))
}

export default function PostInterviewCheck() {
  const navigate = useNavigate()
  const [cachedReport] = useState(loadCachedReport)
  const [report, setReport] = useState<ReportGenerateResponse | null>(cachedReport)
  const [feedbacks, setFeedbacks] = useState<GapFeedback[]>(
    () => (cachedReport ? toPendingFeedbacks(cachedReport) : []),
  )
  const [loading, setLoading] = useState(
    () => !cachedReport && !!localStorage.getItem('mm_report_id'),
  )
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<PostInterviewResponse | null>(null)
  const [error, setError] = useState<string | null>(
    () => (!cachedReport && !localStorage.getItem('mm_report_id')
      ? 'レポートが見つかりません。診断から開始してください。'
      : null),
  )

  useEffect(() => {
    if (cachedReport) return
    const reportId = localStorage.getItem('mm_report_id')
    if (!reportId) return
    api.getReport(reportId)
      .then(r => {
        setReport(r)
        setFeedbacks(toPendingFeedbacks(r))
      })
      .catch(() => setError('レポートを読み込めませんでした。'))
      .finally(() => setLoading(false))
  }, [cachedReport])

  const setStatus = (idx: number, status: Resolution) => {
    setFeedbacks(prev => prev.map((f, i) => i === idx ? { ...f, status } : f))
  }

  const setNote = (idx: number, note: string) => {
    setFeedbacks(prev => prev.map((f, i) => i === idx ? { ...f, note } : f))
  }

  const handleSubmit = async () => {
    const reportId = localStorage.getItem('mm_report_id')
    if (!reportId) { setError('レポートIDが見つかりません。'); return }
    const filled = feedbacks.filter(f => f.status !== 'pending')
    if (filled.length === 0) { setError('少なくとも1つの論点について記録してください。'); return }

    setSubmitting(true)
    setError(null)
    try {
      const items: PostInterviewFeedbackItem[] = feedbacks.map(f => ({
        gap_axis: f.gap_axis,
        gap_title: f.gap_title,
        status: f.status,
        note: f.note || undefined,
      }))
      const res = await api.submitPostInterview(reportId, items)
      setResult(res)
      // 新レポートをキャッシュから削除（次回は再生成）
      localStorage.setItem('mm_report_id', res.new_report_id)
      localStorage.removeItem('mm_report')
    } catch {
      setError('送信に失敗しました。もう一度お試しください。')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <AppShell activeStep="レポート">
        <div style={{ padding: '80px 48px', textAlign: 'center', fontSize: 14, color: '#626b78' }}>
          読み込み中...
        </div>
      </AppShell>
    )
  }

  if (error && !report) {
    return (
      <AppShell activeStep="レポート">
        <div style={{ padding: '48px', maxWidth: 600 }}>
          <div style={{ fontSize: 15, color: '#d12e33', marginBottom: 16 }}>{error}</div>
          <Button onClick={() => navigate('/candidate/chat')} variant="secondary">← 診断チャットへ戻る</Button>
        </div>
      </AppShell>
    )
  }

  // 送信完了画面
  if (result) {
    const delta = result.delta
    return (
      <AppShell activeStep="レポート">
        <div style={{ padding: '48px', maxWidth: 680 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#141922', marginBottom: 8 }}>フィードバックを記録しました</h1>
            <div style={{ fontSize: 14, color: '#626b78' }}>スコアが再計算されました</div>
          </div>

          <Card style={{ padding: 32, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, color: '#626b78', marginBottom: 4 }}>面談前スコア</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: '#626b78' }}>{result.before_score}<span style={{ fontSize: 18 }}>%</span></div>
              </div>
              <div style={{ fontSize: 24, color: '#626b78' }}>→</div>
              <div>
                <div style={{ fontSize: 12, color: '#626b78', marginBottom: 4 }}>面談後スコア</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: delta >= 0 ? '#00847f' : '#d12e33' }}>
                  {result.after_score}<span style={{ fontSize: 18 }}>%</span>
                </div>
              </div>
              <div style={{
                padding: '8px 16px', borderRadius: 8,
                background: delta > 0 ? '#ddf7f4' : delta < 0 ? '#ffe8e8' : '#f7f9fc',
                fontSize: 20, fontWeight: 800,
                color: delta > 0 ? '#00847f' : delta < 0 ? '#d12e33' : '#626b78',
              }}>
                {delta > 0 ? `+${delta}` : delta === 0 ? '±0' : `${delta}`}
              </div>
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <Card style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#00847f' }}>{result.resolved_count}</div>
              <div style={{ fontSize: 13, color: '#626b78' }}>確認できた論点</div>
            </Card>
            <Card style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#d12e33' }}>{result.unresolved_count}</div>
              <div style={{ fontSize: 13, color: '#626b78' }}>未解決の論点</div>
            </Card>
          </div>

          {result.unresolved_count > 0 && (
            <div style={{ padding: '16px 20px', background: '#ffe8e8', border: '1px solid #f4b8b8', borderRadius: 10, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d12e33', marginBottom: 4 }}>未解決の論点があります</div>
              <div style={{ fontSize: 13, color: '#141922', lineHeight: 1.5 }}>
                面談で確認できなかった点は、次の機会や追加面談で確認することをお勧めします。
                企業の担当者も「面談後も懸念が残る候補者」として把握し、フォローを検討します。
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={() => navigate('/candidate/report')} style={{ padding: '12px 24px' }}>
              新しいレポートを見る →
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')} style={{ padding: '12px 24px' }}>
              トップへ戻る
            </Button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activeStep="レポート">
      <div style={{ padding: '32px 48px', maxWidth: 720 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#141922', margin: '0 0 8px' }}>面談後フィードバック</h1>
          <p style={{ fontSize: 14, color: '#626b78', margin: 0 }}>
            面談で各論点を確認できたかを記録してください。スコアが再計算されます。
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {feedbacks.map((fb, idx) => {
            const gap = report?.gaps[idx]
            return (
              <Card
                key={idx}
                style={{
                  padding: 20,
                  borderLeft: `4px solid ${
                    fb.status === 'confirmed' ? '#00847f' :
                    fb.status === 'unresolved' ? '#d12e33' : '#d2dae5'
                  }`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <Chip variant={gap?.severity === 'high' ? 'danger' : 'amber'}>
                        {gap?.severity === 'high' ? '確認推奨' : '要確認'}
                      </Chip>
                      <Chip variant="gray">{fb.gap_axis}</Chip>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 4 }}>{fb.gap_title}</div>
                    {gap?.recommended_question && (
                      <div style={{ fontSize: 12, color: '#626b78', fontStyle: 'italic' }}>
                        Q: {gap.recommended_question}
                      </div>
                    )}
                  </div>
                  {/* Status buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {(['confirmed', 'unresolved', 'pending'] as Resolution[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setStatus(idx, s)}
                        style={{
                          padding: '6px 12px',
                          border: `1px solid ${
                            fb.status === s ? (
                              s === 'confirmed' ? '#00847f' :
                              s === 'unresolved' ? '#d12e33' : '#d2dae5'
                            ) : '#d2dae5'
                          }`,
                          borderRadius: 6,
                          background: fb.status === s ? (
                            s === 'confirmed' ? '#ddf7f4' :
                            s === 'unresolved' ? '#ffe8e8' : '#f7f9fc'
                          ) : '#fff',
                          fontSize: 12,
                          fontWeight: fb.status === s ? 700 : 500,
                          color: fb.status === s ? (
                            s === 'confirmed' ? '#00847f' :
                            s === 'unresolved' ? '#d12e33' : '#626b78'
                          ) : '#626b78',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s === 'confirmed' ? '✓ 確認できた' : s === 'unresolved' ? '✗ モヤモヤ残った' : '— 未回答'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note input */}
                {fb.status !== 'pending' && (
                  <input
                    type="text"
                    value={fb.note}
                    onChange={e => setNote(idx, e.target.value)}
                    placeholder={
                      fb.status === 'confirmed'
                        ? '確認内容のメモ（任意）'
                        : 'まだ気になっていること（任意）'
                    }
                    style={{
                      width: '100%', padding: '8px 12px', border: '1px solid #d2dae5',
                      borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
                      color: '#141922', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                )}
              </Card>
            )
          })}
        </div>

        {error && (
          <div style={{ padding: '10px 16px', background: '#ffe8e8', borderRadius: 8, fontSize: 13, color: '#d12e33', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Button
            onClick={handleSubmit}
            disabled={submitting || feedbacks.every(f => f.status === 'pending')}
            style={{ padding: '12px 28px' }}
          >
            {submitting ? '送信中...' : 'フィードバックを送信・スコア再計算'}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/candidate/report')} style={{ padding: '12px 20px' }}>
            ← レポートに戻る
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
