import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import ScoreBar from '../components/ScoreBar'
import { api, type RecommendationItem } from '../api/client'

export default function CompanyMatches() {
  const navigate = useNavigate()
  const [items, setItems] = useState<RecommendationItem[]>([])
  const [signals, setSignals] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const sessionId = localStorage.getItem('mm_session_id')
      let axes: string[] = []
      try { axes = JSON.parse(localStorage.getItem('mm_priority_axes') || '[]') } catch { /* ignore */ }
      const body: { session_id?: string; priority_axes?: string[]; limit: number } = { priority_axes: axes, limit: 10 }
      if (sessionId && sessionId !== 'offline') body.session_id = sessionId
      try {
        const res = await api.getRecommendations(body)
        setItems(res.items)
        setSignals(res.based_on.signals)
      } catch {
        setError('おすすめの取得に失敗しました。バックエンドが起動しているか確認してください。')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const diagnose = (it: RecommendationItem) => {
    localStorage.setItem('mm_job_id', it.job_id)
    if (it.name) localStorage.setItem('mm_company_name', it.name)
    localStorage.removeItem('mm_session_id')
    localStorage.removeItem('mm_report')
    navigate('/candidate/chat')
  }

  return (
    <AppShell activeStep="合う企業">
      <div style={{ padding: '32px 48px', maxWidth: 900 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 6px' }}>あなたに合う企業</h1>
        <p style={{ fontSize: 14, color: '#626b78', marginBottom: 16 }}>
          診断で抽出されたあなたの希望と、各社の「実際の働き方」を照合してランキングしています。
        </p>

        {signals.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
            <span style={{ fontSize: 12, color: '#626b78', alignSelf: 'center' }}>診断から:</span>
            {signals.slice(0, 6).map((s, i) => (
              <span key={i} style={{ padding: '3px 10px', background: '#ddf7f4', borderRadius: 12, fontSize: 12, color: '#00847f', fontWeight: 600 }}>{s}</span>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ fontSize: 14, color: '#626b78' }}>マッチングを計算中...</div>
        ) : error ? (
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 14, color: '#d12e33', marginBottom: 16 }}>{error}</div>
            <Button onClick={() => navigate('/candidate')} variant="secondary">← 診断へ戻る</Button>
          </Card>
        ) : items.length === 0 ? (
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 14, color: '#626b78', marginBottom: 8 }}>
              まだ診断データがありません。チャット診断を受けると、あなたに合う企業を提案できます。
            </div>
            <Button onClick={() => navigate('/candidate')} style={{ padding: '10px 22px' }}>診断を始める</Button>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map((it, i) => (
              <Card key={it.job_id} style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  {/* Rank + score */}
                  <div style={{ textAlign: 'center', minWidth: 64, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#9aa3af', fontWeight: 700 }}>#{i + 1}</div>
                    <div style={{
                      fontSize: 28, fontWeight: 800, lineHeight: 1.1,
                      color: it.score >= 70 ? '#00847f' : it.score >= 50 ? '#dc8a14' : '#626b78',
                    }}>{it.score}</div>
                    <div style={{ fontSize: 10, color: '#9aa3af' }}>マッチ度</div>
                  </div>
                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 6 }}>{it.name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {[it.industry, it.size_band, it.region, `職種: ${it.job_title}`].filter(Boolean).map((t, j) => (
                        <span key={j} style={{ padding: '2px 8px', background: '#eef1f4', borderRadius: 6, fontSize: 11, color: '#626b78' }}>{t}</span>
                      ))}
                    </div>
                    <div style={{ maxWidth: 420, marginBottom: 12 }}>
                      <ScoreBar label="マッチ度" score={it.score} />
                    </div>
                    <ul style={{ margin: '0 0 14px', paddingLeft: 18 }}>
                      {it.reasons.map((r, k) => (
                        <li key={k} style={{ fontSize: 13, color: '#141922', lineHeight: 1.6 }}>{r}</li>
                      ))}
                    </ul>
                    <Button onClick={() => diagnose(it)} style={{ padding: '8px 18px', fontSize: 13 }}>この企業で診断する →</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
