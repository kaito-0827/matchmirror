import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Card from '../components/Card'
import ScoreBar from '../components/ScoreBar'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { ReportGenerateResponse } from '../api/types'

export default function SharedReport() {
  const { reportId } = useParams<{ reportId: string }>()
  const [report, setReport] = useState<ReportGenerateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) { setError('レポートIDが無効です。'); setLoading(false); return }
    api.getReport(reportId)
      .then(r => setReport(r))
      .catch(() => setError('レポートが見つかりません。URLを確認してください。'))
      .finally(() => setLoading(false))
  }, [reportId])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef1f4' }}>
        <div style={{ fontSize: 14, color: '#626b78' }}>読み込み中...</div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef1f4' }}>
        <div style={{ fontSize: 15, color: '#d12e33' }}>{error || 'レポートを読み込めませんでした。'}</div>
      </div>
    )
  }

  const { overall_score, axis_scores, gaps, matches, candidate_summary } = report

  return (
    <div style={{ minHeight: '100vh', background: '#eef1f4', padding: '32px 24px', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#626b78', marginBottom: 4 }}>MatchMirror</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#141922', margin: 0 }}>ミスマッチ診断レポート</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip variant="teal">MismatchAgent</Chip>
            {report.guardrail_passed && <Chip variant="gray">GuardrailAgent ✓</Chip>}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, marginBottom: 24 }}>
          <Card style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#626b78', marginBottom: 6 }}>総合一致度</div>
            <div style={{
              fontSize: 44, fontWeight: 800, lineHeight: 1,
              color: overall_score >= 70 ? '#00847f' : overall_score >= 50 ? '#dc8a14' : '#d12e33',
            }}>
              {overall_score}<span style={{ fontSize: 16 }}>%</span>
            </div>
            <div style={{ fontSize: 11, color: '#626b78', marginTop: 6 }}>採用合否ではなく確認論点の目安</div>
          </Card>
          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 12 }}>6軸スコア</div>
            {axis_scores.map(({ axis, score }) => (
              <ScoreBar key={axis} label={axis} score={score} />
            ))}
          </Card>
        </div>

        {/* Summary */}
        {candidate_summary && (
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>AI診断サマリー</div>
            <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>{candidate_summary}</div>
          </Card>
        )}

        {/* Gaps */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#d12e33', marginBottom: 10 }}>確認すべきズレ ({gaps.length}件)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {gaps.map(g => (
              <Card key={g.title} style={{ padding: 16, borderLeft: `4px solid ${g.severity === 'high' ? '#d12e33' : '#dc8a14'}` }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <Chip variant={g.severity === 'high' ? 'danger' : 'amber'}>
                    {g.severity === 'high' ? '確認推奨' : '要確認'}
                  </Chip>
                  <Chip variant="gray">{g.axis}</Chip>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 4 }}>{g.title}</div>
                <div style={{ fontSize: 13, color: '#626b78', lineHeight: 1.5 }}>{g.detail}</div>
                {g.evidence && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                    <div style={{ fontSize: 12, background: '#f7f9fc', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontWeight: 700, color: '#626b78', marginBottom: 2 }}>📋 企業の記述</div>
                      {g.evidence.company_quote}
                    </div>
                    <div style={{ fontSize: 12, background: '#f7f9fc', padding: '8px 10px', borderRadius: 6 }}>
                      <div style={{ fontWeight: 700, color: '#626b78', marginBottom: 2 }}>💬 あなたの発言</div>
                      {g.evidence.candidate_quote}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Matches */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#00847f', marginBottom: 10 }}>合う点 ({matches.length}件)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {matches.map(m => (
              <Card key={m.title} style={{ padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 4 }}>✓ {m.title}</div>
                <div style={{ fontSize: 13, color: '#626b78', lineHeight: 1.5 }}>{m.detail}</div>
              </Card>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24, padding: '14px 20px', background: '#f7f9fc', borderRadius: 10, fontSize: 12, color: '#626b78', textAlign: 'center' }}>
          このレポートはMatchMirrorが生成したAI診断結果です。採用の合否判定ではなく、面談での確認論点の参考としてご利用ください。
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; }
        }
      `}</style>
    </div>
  )
}
