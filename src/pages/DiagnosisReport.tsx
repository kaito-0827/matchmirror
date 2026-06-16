import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import ScoreBar from '../components/ScoreBar'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { ReportGenerateResponse } from '../api/types'
import { useAuth } from '../auth/AuthContext'

type Tab = 'overview' | 'matches' | 'gaps'

export default function DiagnosisReport() {
  const navigate = useNavigate()
  const { signedIn, firebaseEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [report, setReport] = useState<ReportGenerateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const generate = async () => {
      // キャッシュがあれば即時表示
      const cached = localStorage.getItem('mm_report')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.overall_score !== undefined) {
            setReport(parsed)
            setLoading(false)
            return
          }
        } catch { /* ignore */ }
      }

      const sessionId = localStorage.getItem('mm_session_id')
      if (!sessionId) {
        setError('診断セッションが見つかりません。チャットから開始してください。')
        setLoading(false)
        return
      }
      try {
        const res = await api.generateReport(sessionId)
        setReport(res)
        localStorage.setItem('mm_report_id', res.report_id)
        localStorage.setItem('mm_report', JSON.stringify(res))
      } catch (e) {
        setError('レポート生成に失敗しました。')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [])

  if (loading) {
    return (
      <AppShell activeStep="レポート">
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#141922', marginBottom: 8 }}>
            MismatchAgentが分析中...
          </div>
          <div style={{ fontSize: 14, color: '#626b78' }}>
            企業実態と候補者の期待を照合しています
          </div>
        </div>
      </AppShell>
    )
  }

  if (error || !report) {
    return (
      <AppShell activeStep="レポート">
        <div style={{ padding: '48px', maxWidth: 600 }}>
          <div style={{ fontSize: 15, color: '#d12e33', marginBottom: 16 }}>
            {error || 'レポートを読み込めませんでした。'}
          </div>
          <Button onClick={() => navigate('/candidate/chat')} variant="secondary">
            ← 診断チャットへ戻る
          </Button>
        </div>
      </AppShell>
    )
  }

  const { overall_score, axis_scores, gaps, matches } = report

  return (
    <AppShell activeStep="レポート">
      <div style={{ padding: '32px 48px', maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: 0, whiteSpace: 'nowrap' }}>ミスマッチ診断レポート</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip variant="teal">MismatchAgent</Chip>
            {report.guardrail_passed && <Chip variant="gray">GuardrailAgent ✓</Chip>}
          </div>
        </div>

        {/* Score summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, marginBottom: 32 }}>
          <Card style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#626b78', marginBottom: 8 }}>総合一致度</div>
            <div style={{
              fontSize: 52,
              fontWeight: 800,
              color: overall_score >= 70 ? '#00847f' : overall_score >= 50 ? '#dc8a14' : '#d12e33',
              lineHeight: 1,
              marginBottom: 8,
            }}>
              {overall_score}
              <span style={{ fontSize: 20 }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: '#626b78' }}>
              スコアは合否ではなく<br />確認論点として解釈
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 16 }}>6軸スコア</div>
            {axis_scores.map(({ axis, score }) => (
              <ScoreBar key={axis} label={axis} score={score} />
            ))}
          </Card>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #d2dae5', marginBottom: 24 }}>
          {([
            { key: 'overview', label: '概要' },
            { key: 'matches', label: `合う点 (${matches.length})` },
            { key: 'gaps', label: `確認すべきズレ (${gaps.length})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === key ? '2px solid #00847f' : '2px solid transparent',
                fontSize: 14,
                fontWeight: activeTab === key ? 700 : 500,
                color: activeTab === key ? '#00847f' : '#626b78',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              background: '#ffe8e8',
              borderRadius: 10,
              padding: '20px 24px',
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#d12e33', marginBottom: 10 }}>確認すべきズレ</div>
              {gaps.map((g) => (
                <div key={g.title} style={{ marginBottom: 10, fontSize: 14, color: '#141922' }}>
                  <span style={{ fontWeight: 600 }}>{g.axis}：</span>{g.title}
                </div>
              ))}
            </div>

            <div style={{
              background: '#ddf7f4',
              borderRadius: 10,
              padding: '20px 24px',
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#00847f', marginBottom: 10 }}>合う点</div>
              {matches.map((m) => (
                <div key={m.title} style={{ marginBottom: 8, fontSize: 14, color: '#141922' }}>
                  <span style={{ fontWeight: 600 }}>✓ </span>{m.title}
                </div>
              ))}
            </div>

            {report.candidate_summary && (
              <div style={{
                background: '#f7f9fc',
                borderRadius: 10,
                padding: '20px 24px',
                border: '1px solid #d2dae5',
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>AI診断サマリー</div>
                <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>{report.candidate_summary}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {matches.map((m) => (
              <Card key={m.title} style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#ddf7f4',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: '#00847f', fontWeight: 700,
                  }}>✓</div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>{m.title}</span>
                </div>
                <p style={{ fontSize: 14, color: '#626b78', lineHeight: 1.6, margin: 0 }}>{m.detail}</p>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'gaps' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {gaps.map((g) => (
              <Card key={g.title} style={{ padding: 20, borderLeft: `4px solid ${g.severity === 'high' ? '#d12e33' : '#dc8a14'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Chip variant={g.severity === 'high' ? 'danger' : 'amber'}>
                    {g.severity === 'high' ? '確認推奨' : '要確認'}
                  </Chip>
                  <Chip variant="gray">{g.axis}</Chip>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 8 }}>{g.title}</div>
                <p style={{ fontSize: 14, color: '#626b78', lineHeight: 1.6, margin: 0 }}>{g.detail}</p>
              </Card>
            ))}
          </div>
        )}

        {/* Save banner */}
        {firebaseEnabled && (
          <div style={{
            marginTop: 28, padding: '16px 20px', borderRadius: 10,
            background: signedIn ? '#ddf7f4' : '#fff7e6',
            border: `1px solid ${signedIn ? '#a9e5df' : '#f0d9a8'}`,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 2 }}>
                {signedIn ? 'このレポートはマイレポートに保存されています' : '後で見返すには保存しましょう'}
              </div>
              <div style={{ fontSize: 12, color: '#626b78' }}>
                {signedIn ? 'いつでもマイレポートから確認できます。' : 'アカウント登録すると、ゲストで出した結果も自動で引き継がれます。'}
              </div>
            </div>
            {signedIn ? (
              <Button onClick={() => navigate('/my')} style={{ padding: '10px 22px' }}>マイレポートを見る</Button>
            ) : (
              <Button onClick={() => navigate('/login?next=/my&mode=signup')} style={{ padding: '10px 22px' }}>保存する（登録/ログイン）</Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
          <Button onClick={() => navigate('/candidate/questions')} style={{ padding: '12px 28px' }}>
            質問を生成
          </Button>
          <Button variant="secondary" onClick={() => navigate('/candidate/chat')} style={{ padding: '12px 28px' }}>
            ← 診断に戻る
          </Button>
        </div>
      </div>
    </AppShell>
  )
}
