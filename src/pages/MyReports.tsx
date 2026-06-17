import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import { api, type MyReportItem } from '../api/client'
import { useAuth } from '../auth/AuthContext'

export default function MyReports() {
  const navigate = useNavigate()
  const { signedIn, ready, firebaseEnabled } = useAuth()
  const needsLogin = firebaseEnabled && !signedIn // 派生値（renderで先に分岐）
  const [items, setItems] = useState<MyReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || needsLogin) return // 未ログインはfetchしない（renderで案内）
    api.getMyReports()
      .then(res => setItems(res.items))
      .catch(() => setError('レポートの取得に失敗しました。'))
      .finally(() => setLoading(false))
  }, [ready, needsLogin])

  const openReport = async (id: string) => {
    try {
      const full = await api.getReport(id)
      localStorage.setItem('mm_report', JSON.stringify(full))
      localStorage.setItem('mm_report_id', id)
      navigate('/candidate/report')
    } catch {
      setError('レポートを開けませんでした。')
    }
  }

  return (
    <AppShell activeStep="マイレポート">
      <div style={{ padding: '32px 48px', maxWidth: 820 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 6px' }}>マイレポート</h1>
        <p style={{ fontSize: 14, color: '#626b78', marginBottom: 24 }}>保存した診断レポートをいつでも見返せます。</p>

        {needsLogin ? (
          <Card style={{ padding: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 8 }}>ログインが必要です</div>
            <div style={{ fontSize: 13, color: '#626b78', marginBottom: 18 }}>
              診断結果を保存・閲覧するにはログインしてください。ゲストで出した結果はログイン時に自動で引き継がれます。
            </div>
            <Button onClick={() => navigate('/login?next=/my')} style={{ padding: '10px 24px' }}>ログイン / 新規登録</Button>
          </Card>
        ) : loading ? (
          <div style={{ fontSize: 14, color: '#626b78' }}>読み込み中...</div>
        ) : error ? (
          <div style={{ fontSize: 14, color: '#d12e33' }}>{error}</div>
        ) : items.length === 0 ? (
          <Card style={{ padding: 28 }}>
            <div style={{ fontSize: 14, color: '#626b78', marginBottom: 16 }}>まだ保存されたレポートはありません。</div>
            <Button onClick={() => navigate('/candidate')} style={{ padding: '10px 24px' }}>診断を始める</Button>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(r => (
              <Card key={r.id} style={{ padding: 20, cursor: 'pointer' }}>
                <div onClick={() => openReport(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{
                    fontSize: 30, fontWeight: 800, lineHeight: 1, minWidth: 64, textAlign: 'center',
                    color: r.overall_score >= 70 ? '#00847f' : r.overall_score >= 50 ? '#dc8a14' : '#d12e33',
                  }}>
                    {r.overall_score}<span style={{ fontSize: 14 }}>%</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#626b78', marginBottom: 4 }}>
                      {r.created_at ? new Date(r.created_at).toLocaleString('ja-JP') : ''}・確認すべきズレ {r.gap_count}件
                    </div>
                    <div style={{ fontSize: 14, color: '#141922', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.candidate_summary || 'ミスマッチ診断レポート'}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#00847f', fontWeight: 700, flexShrink: 0 }}>開く →</div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
