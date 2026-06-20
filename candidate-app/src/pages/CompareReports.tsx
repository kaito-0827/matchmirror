import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CandidateShell from '../components/CandidateShell'
import Card from '../components/Card'
import Button from '../components/Button'
import ScoreBar from '../components/ScoreBar'
import Chip from '../components/Chip'
import { api, type CompareItem } from '../api/client'

export default function CompareReports() {
  const navigate = useNavigate()
  const [items, setItems] = useState<CompareItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      const sessionId = localStorage.getItem('mm_session_id')
      let jobIds: string[] = []
      try { jobIds = JSON.parse(localStorage.getItem('mm_job_ids') || '[]') } catch { /* ignore */ }
      if (!sessionId || sessionId === 'offline' || jobIds.length === 0) {
        setError('比較対象が見つかりません。診断開始画面で複数社を選んでください。')
        setLoading(false)
        return
      }
      try {
        const res = await api.compareReports(sessionId, jobIds)
        setItems(res.items)
      } catch {
        setError('比較の生成に失敗しました。バックエンドが起動しているか確認してください。')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const openDetail = (it: CompareItem) => {
    localStorage.setItem('mm_job_id', it.job_id)
    if (it.company_name) localStorage.setItem('mm_company_name', it.company_name)
    localStorage.removeItem('mm_report')
    navigate('/report')
  }

  return (
    <CandidateShell>
      <div style={{ padding: '32px 48px', maxWidth: 1100 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 6px' }}>企業の比較診断</h1>
        <p style={{ fontSize: 14, color: '#626b78', marginBottom: 24 }}>
          同じ診断結果を各社の「実際の働き方」に照合し、合う度を横並びで比較しています。
        </p>

        {loading ? (
          <div style={{ fontSize: 14, color: '#626b78' }}>各社のミスマッチを並列で計算中...（数十秒）</div>
        ) : error ? (
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 14, color: '#d12e33', marginBottom: 16 }}>{error}</div>
            <Button onClick={() => navigate('/')} variant="secondary">← 診断開始へ</Button>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)`, gap: 16 }}>
            {items.map((it, i) => (
              <Card key={it.job_id} style={{ padding: 20, border: i === 0 ? '2px solid #00847f' : '1px solid #d2dae5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 22 }}>
                  {i === 0 && <Chip variant="teal">ベストマッチ</Chip>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#141922', marginBottom: 4 }}>{it.company_name}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {[it.industry, it.size_band, it.region, it.job_title].filter(Boolean).map((t, j) => (
                    <span key={j} style={{ padding: '2px 7px', background: '#eef1f4', borderRadius: 6, fontSize: 10, color: '#626b78' }}>{t}</span>
                  ))}
                </div>

                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#626b78' }}>合う度</div>
                  <div style={{
                    fontSize: 40, fontWeight: 800, lineHeight: 1.1,
                    color: it.overall_score >= 70 ? '#00847f' : it.overall_score >= 50 ? '#dc8a14' : '#d12e33',
                  }}>{it.overall_score}<span style={{ fontSize: 16 }}>%</span></div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  {it.axis_scores.map(ax => <ScoreBar key={ax.axis} label={ax.axis} score={ax.score} />)}
                </div>

                {it.gaps.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#d12e33', marginBottom: 4 }}>確認すべきズレ</div>
                    <ul style={{ margin: 0, paddingLeft: 16 }}>
                      {it.gaps.map((g, k) => (
                        <li key={k} style={{ fontSize: 12, color: '#141922', lineHeight: 1.5 }}>
                          <span style={{ color: '#626b78' }}>{g.axis}：</span>{g.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button onClick={() => openDetail(it)} style={{ padding: '8px 14px', fontSize: 13, width: '100%' }}>
                  この企業の詳細レポート →
                </Button>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && (
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <Button variant="secondary" onClick={() => navigate('/matches')} style={{ padding: '10px 22px' }}>
              他のおすすめ企業も見る →
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')} style={{ padding: '10px 22px' }}>
              ← 診断開始へ
            </Button>
          </div>
        )}
      </div>
    </CandidateShell>
  )
}
