import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import CandidateShell from '../components/CandidateShell'
import Card from '../components/Card'
import ScoreBar from '../components/ScoreBar'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api, type MatchRecord } from '../api/client'
import type { ReportGenerateResponse, GuardrailLogResponse } from '../api/types'
import { useAuth } from '../auth/AuthContext'

type Tab = 'overview' | 'matches' | 'gaps' | 'guardrail'

export default function DiagnosisReport() {
  const navigate = useNavigate()
  const { signedIn, firebaseEnabled } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [report, setReport] = useState<ReportGenerateResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [matched, setMatched] = useState<MatchRecord | null>(null)
  const [matching, setMatching] = useState(false)
  const [matchErr, setMatchErr] = useState<string | null>(null)
  const [guardrailLog, setGuardrailLog] = useState<GuardrailLogResponse | null>(null)
  const [showEvidence, setShowEvidence] = useState<Record<string, boolean>>({})
  const generatedRef = useRef(false)

  useEffect(() => {
    if (firebaseEnabled && !signedIn) return
    const jobId = localStorage.getItem('mm_job_id')
    api.getMyMatches()
      .then(res => { const m = res.items.find(x => x.job_id === jobId); if (m) setMatched(m) })
      .catch(() => {})
  }, [signedIn, firebaseEnabled])

  const doMatch = async () => {
    if (firebaseEnabled && !signedIn) { navigate('/login?next=/candidate/report'); return }
    const reportId = report?.report_id || localStorage.getItem('mm_report_id')
    if (!reportId) { setMatchErr('レポートIDが見つかりません。'); return }
    setMatching(true); setMatchErr(null)
    try {
      const res = await api.createMatch(reportId)
      setMatched(res)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setMatchErr(msg.startsWith('403') ? '自分の診断結果のみマッチングできます。' : 'マッチングに失敗しました。')
    } finally { setMatching(false) }
  }

  const loadGuardrailLog = async (reportId: string) => {
    try {
      const log = await api.getGuardrailLog(reportId)
      setGuardrailLog(log)
    } catch { /* 無視 */ }
  }

  const copyShareLink = () => {
    const reportId = report?.report_id || localStorage.getItem('mm_report_id')
    if (!reportId) return
    const url = `${window.location.origin}/r/${reportId}`
    navigator.clipboard.writeText(url).catch(() => {})
    alert('共有リンクをコピーしました')
  }

  useEffect(() => {
    if (generatedRef.current) return
    generatedRef.current = true
    const generate = async () => {
      const cached = localStorage.getItem('mm_report')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (parsed.overall_score !== undefined) {
            setReport(parsed)
            setLoading(false)
            if (parsed.report_id) loadGuardrailLog(parsed.report_id)
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
        loadGuardrailLog(res.report_id)
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
      <CandidateShell activeStep="レポート">
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#141922', marginBottom: 8 }}>
            MismatchAgentが分析中...
          </div>
          <div style={{ fontSize: 14, color: '#626b78' }}>
            企業実態と候補者の期待を照合しています
          </div>
        </div>
      </CandidateShell>
    )
  }

  if (error || !report) {
    return (
      <CandidateShell activeStep="レポート">
        <div style={{ padding: '48px', maxWidth: 600 }}>
          <div style={{ fontSize: 15, color: '#d12e33', marginBottom: 16 }}>
            {error || 'レポートを読み込めませんでした。'}
          </div>
          <Button onClick={() => navigate('/candidate/chat')} variant="secondary">
            ← 診断チャットへ戻る
          </Button>
        </div>
      </CandidateShell>
    )
  }

  const { overall_score, axis_scores, gaps, matches } = report
  const hasGuardrailIssues = (report.guardrail_issues?.length ?? 0) > 0 || (guardrailLog?.total ?? 0) > 0

  return (
    <CandidateShell activeStep="レポート">
      <div style={{ padding: '32px 48px', maxWidth: 960 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: 0, whiteSpace: 'nowrap' }}>ミスマッチ診断レポート</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Chip variant="teal">MismatchAgent</Chip>
            {report.guardrail_passed && <Chip variant="gray">GuardrailAgent ✓</Chip>}
            <button
              onClick={copyShareLink}
              style={{
                padding: '6px 14px', background: '#f7f9fc', border: '1px solid #d2dae5',
                borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#626b78',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              🔗 共有
            </button>
            <button
              onClick={() => window.print()}
              style={{
                padding: '6px 14px', background: '#f7f9fc', border: '1px solid #d2dae5',
                borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#626b78',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              📄 PDF
            </button>
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
            ...(hasGuardrailIssues ? [{ key: 'guardrail', label: '🛡️ AI調整ログ' }] : []),
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as Tab)}
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
            <div style={{ background: '#ffe8e8', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#d12e33', marginBottom: 10 }}>確認すべきズレ</div>
              {gaps.map((g) => (
                <div key={g.title} style={{ marginBottom: 10, fontSize: 14, color: '#141922' }}>
                  <span style={{ fontWeight: 600 }}>{g.axis}：</span>{g.title}
                </div>
              ))}
            </div>

            <div style={{ background: '#ddf7f4', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#00847f', marginBottom: 10 }}>合う点</div>
              {matches.map((m) => (
                <div key={m.title} style={{ marginBottom: 8, fontSize: 14, color: '#141922' }}>
                  <span style={{ fontWeight: 600 }}>✓ </span>{m.title}
                </div>
              ))}
            </div>

            {report.candidate_summary && (
              <div style={{ background: '#f7f9fc', borderRadius: 10, padding: '20px 24px', border: '1px solid #d2dae5' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Chip variant={g.severity === 'high' ? 'danger' : 'amber'}>
                    {g.severity === 'high' ? '確認推奨' : '要確認'}
                  </Chip>
                  <Chip variant="gray">{g.axis}</Chip>
                  {g.resolution === 'confirmed' && <Chip variant="teal">✓ 確認済み</Chip>}
                  {g.resolution === 'unresolved' && <Chip variant="danger">未解決</Chip>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 8 }}>{g.title}</div>
                <p style={{ fontSize: 14, color: '#626b78', lineHeight: 1.6, margin: '0 0 12px' }}>{g.detail}</p>

                {/* evidence（ズレの根拠） */}
                {g.evidence && (
                  <div>
                    <button
                      onClick={() => setShowEvidence(prev => ({ ...prev, [g.title]: !prev[g.title] }))}
                      style={{
                        background: 'none', border: 'none', fontSize: 12, color: '#626b78',
                        cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 8,
                        textDecoration: 'underline',
                      }}
                    >
                      {showEvidence[g.title] ? '▲ 根拠を閉じる' : '▼ ズレの根拠を見る'}
                    </button>
                    {showEvidence[g.title] && (
                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                        background: '#f7f9fc', borderRadius: 8, padding: '12px 16px',
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#626b78', marginBottom: 4 }}>📋 企業の記述</div>
                          <div style={{ fontSize: 13, color: '#141922', background: '#fff', borderRadius: 6, padding: '8px 10px', border: '1px solid #d2dae5' }}>
                            {g.evidence.company_quote}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#626b78', marginBottom: 4 }}>💬 あなたの発言</div>
                          <div style={{ fontSize: 13, color: '#141922', background: '#fff', borderRadius: 6, padding: '8px 10px', border: '1px solid #d2dae5' }}>
                            {g.evidence.candidate_quote}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}

            {/* 面談後フィードバックへの導線 */}
            <div style={{
              marginTop: 8, padding: '16px 20px', background: '#f0faf9',
              border: '1px solid #a9e5df', borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 2 }}>面談を受けましたか？</div>
                <div style={{ fontSize: 12, color: '#626b78' }}>「確認できた / モヤモヤが残った」を記録するとスコアが再計算されます</div>
              </div>
              <Button onClick={() => navigate('/candidate/post-interview')} style={{ padding: '10px 20px', flexShrink: 0 }}>
                面談後フィードバックを記録
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'guardrail' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '16px 20px', background: '#f7f9fc', borderRadius: 10, border: '1px solid #d2dae5' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 4 }}>🛡️ GuardrailAgent ログ</div>
              <div style={{ fontSize: 13, color: '#626b78', lineHeight: 1.5 }}>
                AIが生成したテキストのうち、差別的表現・断定表現・個人情報に該当する可能性があると判断した箇所を自動修正しました。
              </div>
            </div>
            {guardrailLog && guardrailLog.logs.length > 0 ? (
              guardrailLog.logs.map((log, i) => (
                <Card key={i} style={{ padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>
                    検出された問題 ({log.issues.length}件)
                  </div>
                  <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
                    {log.issues.map((issue, j) => (
                      <li key={j} style={{ fontSize: 13, color: '#d12e33', marginBottom: 4 }}>{issue}</li>
                    ))}
                  </ul>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#626b78', marginBottom: 4 }}>修正前</div>
                      <div style={{ fontSize: 13, color: '#141922', background: '#ffe8e8', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>
                        {log.original}
                      </div>
                    </div>
                    {log.safe_version && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#626b78', marginBottom: 4 }}>修正後</div>
                        <div style={{ fontSize: 13, color: '#141922', background: '#ddf7f4', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>
                          {log.safe_version}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ padding: '16px 20px', fontSize: 14, color: '#626b78' }}>
                このレポートではGuardrailAgentによる修正は行われませんでした。
              </div>
            )}
          </div>
        )}

        {/* Match */}
        <div style={{ marginTop: 28 }}>
          {matched ? (
            <Card style={{ padding: 20, border: '2px solid #00847f', background: '#f0faf9' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#00847f', marginBottom: 4 }}>♥ {matched.company_name} にマッチングしました</div>
              <div style={{ fontSize: 12, color: '#626b78', marginBottom: 14 }}>企業の担当者に通知が届きました。</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 8 }}>面接での確認事項（あなた向け）</div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {matched.candidate_prep.map((p, i) => (
                  <li key={i} style={{ fontSize: 14, color: '#141922', lineHeight: 1.7 }}>{p}</li>
                ))}
              </ul>
            </Card>
          ) : (
            <Card style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 2 }}>この企業に興味がありますか？</div>
                <div style={{ fontSize: 12, color: '#626b78' }}>マッチングすると企業に通知が届き、双方に面接での確認事項が用意されます。</div>
                {matchErr && <div style={{ fontSize: 12, color: '#d12e33', marginTop: 6 }}>{matchErr}</div>}
              </div>
              <Button onClick={doMatch} disabled={matching} style={{ padding: '12px 28px' }}>
                {matching ? '送信中...' : (firebaseEnabled && !signedIn) ? 'ログインしてマッチング' : 'この企業にマッチング ♥'}
              </Button>
            </Card>
          )}
        </div>

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
        <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Button onClick={() => navigate('/candidate/matches')} style={{ padding: '12px 28px' }}>
            あなたに合う企業を見る →
          </Button>
          <Button variant="secondary" onClick={() => navigate('/candidate/questions')} style={{ padding: '12px 28px' }}>
            質問を生成
          </Button>
          <Button variant="secondary" onClick={() => navigate('/candidate/post-interview')} style={{ padding: '12px 28px' }}>
            面談後フィードバック
          </Button>
          <Button variant="secondary" onClick={() => navigate('/candidate/chat')} style={{ padding: '12px 28px' }}>
            ← 診断に戻る
          </Button>
        </div>
      </div>

      <style>{`
        @media print {
          button, nav, aside { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </CandidateShell>
  )
}
