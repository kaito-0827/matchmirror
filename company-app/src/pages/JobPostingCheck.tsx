import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CompanyShell from '../components/CompanyShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { JobPostingCheckResponse, JobPostingWarning } from '../api/types'

const RISK_COLORS: Record<string, { bg: string; border: string; chip: 'danger' | 'amber' | 'teal' }> = {
  high: { bg: '#ffe8e8', border: '#f4b8b8', chip: 'danger' },
  medium: { bg: '#fff4db', border: '#f0d9a8', chip: 'amber' },
  low: { bg: '#ddf7f4', border: '#a9e5df', chip: 'teal' },
}

export default function JobPostingCheck() {
  const navigate = useNavigate()
  const [profileId, setProfileId] = useState<string | null>(null)
  const [postingText, setPostingText] = useState('')
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<JobPostingCheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // 企業プロファイルIDはlocal storageかURLから取得
    const pid = localStorage.getItem('mm_company_profile_id') || localStorage.getItem('mm_company_id')
    setProfileId(pid)
  }, [])

  const handleCheck = async () => {
    if (!postingText.trim()) { setError('求人票のテキストを入力してください。'); return }
    if (!profileId) { setError('企業実態プロファイルIDが見つかりません。先に企業実態を登録してください。'); return }

    setChecking(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.checkJobPosting(profileId, postingText)
      setResult(res)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.includes('404')) {
        setError('企業実態プロファイルが見つかりません。プロファイルを先に登録してください。')
      } else {
        setError('診断に失敗しました。もう一度お試しください。')
      }
    } finally {
      setChecking(false)
    }
  }

  const overallStyle = result ? RISK_COLORS[result.overall_risk] ?? RISK_COLORS.medium : null

  return (
    <CompanyShell activeStep="企業実態">
      <div style={{ padding: '32px 48px', maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#141922', margin: '0 0 4px' }}>求人票 ⇄ 実態ギャップ診断</h1>
            <p style={{ fontSize: 14, color: '#626b78', margin: 0 }}>
              求人票のテキストを貼り付けると、登録済みの実態プロファイルとの乖離をAIが検出します
            </p>
          </div>
          <Chip variant="teal">CompanyAgent</Chip>
        </div>

        {!profileId && (
          <div style={{ padding: '16px 20px', background: '#fff4db', border: '1px solid #f0d9a8', borderRadius: 10, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#dc8a14', marginBottom: 4 }}>企業実態プロファイルが必要です</div>
            <div style={{ fontSize: 13, color: '#141922' }}>
              先に企業実態を登録してください。登録後にこのページで求人票をチェックできます。
            </div>
          </div>
        )}

        <Card style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 12 }}>求人票テキストを貼り付け</div>
          <textarea
            value={postingText}
            onChange={e => setPostingText(e.target.value)}
            placeholder="求人票全文をここに貼り付けてください。&#10;仕事内容・募集要件・会社の雰囲気・条件など含めると精度が上がります。"
            rows={12}
            style={{
              width: '100%', padding: '12px 14px', border: '1px solid #d2dae5',
              borderRadius: 8, fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              outline: 'none', color: '#141922', lineHeight: 1.6, boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#626b78' }}>
              {postingText.length} 文字
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="secondary"
                onClick={() => { setPostingText(''); setResult(null); setError(null) }}
                style={{ padding: '10px 16px' }}
              >
                クリア
              </Button>
              <Button
                onClick={handleCheck}
                disabled={checking || !postingText.trim() || !profileId}
                style={{ padding: '10px 24px' }}
              >
                {checking ? 'AI診断中...' : '診断開始'}
              </Button>
            </div>
          </div>
        </Card>

        {error && (
          <div style={{ padding: '12px 16px', background: '#ffe8e8', borderRadius: 8, fontSize: 13, color: '#d12e33', marginBottom: 20 }}>
            {error}
          </div>
        )}

        {result && (
          <div>
            {/* Overall risk */}
            <div style={{
              padding: '20px 24px',
              background: overallStyle?.bg,
              border: `1px solid ${overallStyle?.border}`,
              borderRadius: 10,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Chip variant={overallStyle?.chip ?? 'gray'}>
                    {result.overall_risk === 'high' ? '高リスク' : result.overall_risk === 'medium' ? '中リスク' : '低リスク'}
                  </Chip>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>
                    {result.warning_count}件の表現に改善余地あり
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>{result.summary}</div>
              </div>
            </div>

            {/* Warnings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.warnings.map((w: JobPostingWarning, i) => {
                const style = RISK_COLORS[w.risk_level] ?? RISK_COLORS.medium
                return (
                  <Card key={i} style={{ padding: 20, borderLeft: `4px solid ${style.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <Chip variant={style.chip}>
                            {w.risk_level === 'high' ? '要注意' : w.risk_level === 'medium' ? '要確認' : '軽微'}
                          </Chip>
                          <span style={{
                            fontSize: 13, fontWeight: 700, color: '#141922',
                            background: style.bg, padding: '2px 8px', borderRadius: 4,
                          }}>
                            「{w.phrase}」
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: '#141922', marginBottom: 8, lineHeight: 1.5 }}>
                          {w.issue}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#00847f', flexShrink: 0 }}>改善案：</span>
                          <span style={{ fontSize: 13, color: '#626b78', lineHeight: 1.5 }}>{w.suggestion}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <Button variant="secondary" onClick={() => setResult(null)} style={{ padding: '10px 20px' }}>
                別の求人票を診断する
              </Button>
              <Button variant="secondary" onClick={() => navigate('/company/dashboard')} style={{ padding: '10px 20px' }}>
                ← ダッシュボードへ戻る
              </Button>
            </div>
          </div>
        )}

        {!result && !checking && (
          <div style={{ marginTop: 8 }}>
            <Button variant="secondary" onClick={() => navigate('/company/dashboard')} style={{ padding: '10px 20px' }}>
              ← ダッシュボードへ戻る
            </Button>
          </div>
        )}
      </div>
    </CompanyShell>
  )
}
