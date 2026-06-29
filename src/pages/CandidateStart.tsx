import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import { api, type CompanyListItem } from '../api/client'
import type { PostingExtractResponse, CompanyRealityInput } from '../api/types'

const AXES = ['仕事内容', '働き方', '条件・制度', '文化・価値観', '成長・キャリア', '不安・未確認点']
const MAX_COMPARE = 3

type Mode = 'single' | 'compare' | 'recommend' | 'posting'

const MODES: { key: Mode; label: string; desc: string }[] = [
  { key: 'single', label: '1社を診断', desc: '選んだ1社とのミスマッチを詳しく診断' },
  { key: 'compare', label: '複数社を比較', desc: `最大${MAX_COMPARE}社を横並びで比較` },
  { key: 'recommend', label: '企業を選ばずおすすめ', desc: '診断結果から合う企業を提案' },
  { key: 'posting', label: '求人票を貼り付けて診断', desc: '気になる求人のテキストを貼るだけで診断' },
]

const RISK_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  high: { bg: '#fdeceb', color: '#d12e33', label: '要注意' },
  medium: { bg: '#fdf3e3', color: '#b8740a', label: 'やや曖昧' },
  low: { bg: '#eef1f4', color: '#626b78', label: '明確' },
}

function newGuestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && 'randomUUID' in c) return c.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function CandidateStart() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('single')
  const [selected, setSelected] = useState<Set<string>>(new Set(AXES.slice(0, 3)))

  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [industry, setIndustry] = useState('すべて')
  const [jobId, setJobId] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set()) // compare用

  const [postingText, setPostingText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extraction, setExtraction] = useState<PostingExtractResponse | null>(null)
  const [extractError, setExtractError] = useState('')
  const [postingCompanyName, setPostingCompanyName] = useState('')
  const [creatingFromPosting, setCreatingFromPosting] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    api.listCompanies()
      .then(res => {
        setCompanies(res.items)
        if (res.items.length) setJobId(res.items[0].job_id)
      })
      .catch(() => setCompanies([]))
  }, [])

  const industries = useMemo(
    () => ['すべて', ...Array.from(new Set(companies.map(c => c.industry).filter(Boolean) as string[]))],
    [companies]
  )
  const filtered = useMemo(
    () => companies.filter(c => industry === 'すべて' || c.industry === industry),
    [companies, industry]
  )
  const effectiveJobId = filtered.some(c => c.job_id === jobId) ? jobId : (filtered[0]?.job_id ?? '')
  const company = companies.find(c => c.job_id === effectiveJobId) || null
  const pickedCompanies = companies.filter(c => picked.has(c.job_id))

  const toggleAxis = (axis: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(axis)) { if (next.size > 1) next.delete(axis) } else next.add(axis)
    return next
  })

  const togglePick = (jid: string) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(jid)) next.delete(jid)
    else if (next.size < MAX_COMPARE) next.add(jid)
    return next
  })

  const start = () => {
    localStorage.setItem('mm_priority_axes', JSON.stringify([...selected]))
    localStorage.setItem('mm_mode', mode)
    localStorage.removeItem('mm_session_id')
    localStorage.removeItem('mm_report')
    localStorage.removeItem('mm_job_ids')
    localStorage.removeItem('mm_company_names')

    if (mode === 'compare') {
      const ids = [...picked]
      localStorage.setItem('mm_job_ids', JSON.stringify(ids))
      localStorage.setItem('mm_company_names', JSON.stringify(pickedCompanies.map(c => c.name)))
      localStorage.setItem('mm_job_id', ids[0] || 'job-001') // セッション生成用（任意）
    } else if (mode === 'recommend') {
      localStorage.setItem('mm_job_id', 'none')
      localStorage.removeItem('mm_company_name')
    } else {
      localStorage.setItem('mm_job_id', effectiveJobId || 'job-001')
      if (company?.name) localStorage.setItem('mm_company_name', company.name)
    }
    navigate('/candidate/chat')
  }

  const canStart = mode === 'single' ? true : mode === 'recommend' ? true : mode === 'compare' ? picked.size >= 1 : false
  const startLabel = mode === 'compare' ? `${picked.size}社を比較診断` : mode === 'recommend' ? 'おすすめを見る' : '診断を開始'

  const extractPosting = async () => {
    if (!postingText.trim()) return
    setExtracting(true)
    setExtractError('')
    try {
      const res = await api.extractFromPosting(postingText)
      setExtraction(res)
    } catch {
      setExtractError('解析に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setExtracting(false)
    }
  }

  const startFromPosting = async () => {
    if (!extraction) return
    setCreatingFromPosting(true)
    setCreateError('')
    try {
      const id = newGuestId()
      const ff = extraction.form_fields
      const input: CompanyRealityInput = {
        company_id: `guest-${id}`,
        job_id: `guest-${id}`,
        job_title: ff.job_title || '未設定の職種',
        daily_tasks: ff.daily_tasks || '（求人票に記載なし）',
        ojt_structure: ff.ojt_structure || '（求人票に記載なし）',
        leave_reality: ff.leave_reality || '（求人票に記載なし）',
        culture_values: ff.culture_values || '（求人票に記載なし）',
        evaluation_criteria: ff.evaluation_criteria || undefined,
        workstyle: ff.workstyle || undefined,
      }
      await api.createCompanyProfile(input)

      localStorage.setItem('mm_priority_axes', JSON.stringify([...selected]))
      localStorage.setItem('mm_mode', 'posting')
      localStorage.removeItem('mm_session_id')
      localStorage.removeItem('mm_report')
      localStorage.removeItem('mm_job_ids')
      localStorage.removeItem('mm_company_names')
      localStorage.setItem('mm_job_id', input.job_id)
      localStorage.setItem('mm_company_name', postingCompanyName.trim() || ff.job_title || '貼り付けた求人')
      navigate('/candidate/chat')
    } catch {
      setCreateError('診断の開始に失敗しました。時間を置いて再度お試しください。')
    } finally {
      setCreatingFromPosting(false)
    }
  }

  const fieldLabel = (key: string) => extraction?.extracted_fields.find(f => f.field_key === key)?.axis_label ?? key

  return (
    <AppShell activeStep="候補者診断">
      <div style={{ padding: '40px 48px', maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#141922', marginBottom: 8 }}>相性診断を開始</h1>
        <p style={{ fontSize: 15, color: '#626b78', marginBottom: 28 }}>
          チャットで希望を入力すると、企業の「実際の働き方」とのズレをAIが可視化します。
        </p>

        {/* Mode selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
          {MODES.map(m => {
            const on = mode === m.key
            return (
              <button key={m.key} onClick={() => setMode(m.key)} style={{
                padding: '14px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: on ? '#ddf7f4' : '#fff', border: `2px solid ${on ? '#00847f' : '#d2dae5'}`,
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: on ? '#00847f' : '#141922', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: '#626b78', lineHeight: 1.4 }}>{m.desc}</div>
              </button>
            )
          })}
        </div>

        {/* Company selection (single / compare) */}
        {mode !== 'recommend' && mode !== 'posting' && (
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 4 }}>
              {mode === 'compare' ? '比較する企業を選ぶ' : '診断する企業を選ぶ'}
              {companies.length > 0 && <span style={{ fontSize: 12, color: '#00847f', fontWeight: 700 }}>（全{companies.length}社）</span>}
            </div>
            <div style={{ fontSize: 13, color: '#626b78', marginBottom: 16 }}>
              {mode === 'compare' ? `最大${MAX_COMPARE}社まで選べます（選択中 ${picked.size}/${MAX_COMPARE}）` : '選んだ企業の実態に対してミスマッチを診断します'}
            </div>

            {companies.length === 0 ? (
              <div style={{ fontSize: 13, color: '#9aa3af' }}>企業リストを読み込み中...（未接続時はデフォルト企業で診断します）</div>
            ) : (
              <>
                <div style={{ flex: '0 0 200px', marginBottom: 12, maxWidth: 240 }}>
                  <label style={labelStyle}>業界で絞り込み</label>
                  <select value={industry} onChange={e => setIndustry(e.target.value)} style={selectStyle}>
                    {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>

                {mode === 'single' ? (
                  <div>
                    <label style={labelStyle}>企業（{filtered.length}社）</label>
                    <select value={effectiveJobId} onChange={e => setJobId(e.target.value)} style={selectStyle}>
                      {filtered.map(c => <option key={c.job_id} value={c.job_id}>{c.name}（{c.job_title}）</option>)}
                    </select>
                  </div>
                ) : (
                  <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #e7ebf2', borderRadius: 8 }}>
                    {filtered.map(c => {
                      const on = picked.has(c.job_id)
                      const disabled = !on && picked.size >= MAX_COMPARE
                      return (
                        <label key={c.job_id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          borderBottom: '1px solid #f0f2f5', cursor: disabled ? 'default' : 'pointer',
                          opacity: disabled ? 0.4 : 1, background: on ? '#f0faf9' : '#fff',
                        }}>
                          <input type="checkbox" checked={on} disabled={disabled} onChange={() => togglePick(c.job_id)} />
                          <span style={{ fontSize: 13, color: '#141922' }}>{c.name}</span>
                          <span style={{ fontSize: 11, color: '#9aa3af' }}>{c.industry}・{c.job_title}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* single: selected company facts */}
            {mode === 'single' && company && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f7f9fc', borderRadius: 10, border: '1px solid #e7ebf2' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 4 }}>{company.name}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[company.industry, company.size_band, company.region, `職種: ${company.job_title}`].filter(Boolean).map((t, i) => (
                    <span key={i} style={{ padding: '2px 8px', background: '#eef1f4', borderRadius: 6, fontSize: 11, color: '#626b78' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* compare: chips of picked */}
            {mode === 'compare' && pickedCompanies.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pickedCompanies.map(c => (
                  <span key={c.job_id} style={{ padding: '4px 10px', background: '#ddf7f4', borderRadius: 14, fontSize: 12, color: '#00847f', fontWeight: 700 }}>
                    {c.name} ✕
                    <button onClick={() => togglePick(c.job_id)} style={{ marginLeft: 6, background: 'none', border: 'none', color: '#00847f', cursor: 'pointer', fontSize: 12 }} aria-label="remove">×</button>
                  </span>
                ))}
              </div>
            )}
          </Card>
        )}

        {mode === 'recommend' && (
          <Card style={{ padding: 24, marginBottom: 24, background: '#f7f9fc' }}>
            <div style={{ fontSize: 14, color: '#141922', fontWeight: 700, marginBottom: 4 }}>企業は選ばなくてOK</div>
            <div style={{ fontSize: 13, color: '#626b78' }}>チャットで希望を答えると、全{companies.length || 100}社からあなたに合う企業をランキングで提案します。</div>
          </Card>
        )}

        {mode === 'posting' && (
          <Card style={{ padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 4 }}>気になる求人票を貼り付ける</div>
            <div style={{ fontSize: 13, color: '#626b78', marginBottom: 16 }}>
              登録企業リストにない求人でも、テキストを貼るだけでAIが曖昧な表現を検出し、ミスマッチを診断します。
            </div>

            <textarea
              value={postingText}
              onChange={e => { setPostingText(e.target.value); setExtraction(null); setExtractError('') }}
              placeholder="求人票の本文をそのまま貼り付けてください（仕事内容・働き方・休暇などの記載があると精度が上がります）"
              rows={8}
              style={{
                width: '100%', padding: '12px 14px', border: '1px solid #d2dae5', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', color: '#141922', boxSizing: 'border-box', resize: 'vertical',
              }}
            />

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
              <Button onClick={extractPosting} disabled={!postingText.trim() || extracting} style={{ padding: '10px 20px' }}>
                {extracting ? '解析中...' : '求人票を解析する'}
              </Button>
              {extractError && <span style={{ fontSize: 12, color: '#d12e33' }}>{extractError}</span>}
            </div>

            {extraction && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 10 }}>抽出結果</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {extraction.extracted_fields.map(f => {
                    const risk = RISK_STYLE[f.divergence_risk] ?? RISK_STYLE.low
                    return (
                      <div key={f.field_key} style={{ padding: '10px 12px', background: '#f7f9fc', borderRadius: 8, border: '1px solid #e7ebf2' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#141922' }}>{f.axis_label}</span>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: risk.bg, color: risk.color }}>{risk.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#626b78', marginTop: 4 }}>{f.value || '（記載なし）'}</div>
                        {f.divergence_note && (
                          <div style={{ fontSize: 11, color: '#b8740a', marginTop: 4 }}>⚠ {f.divergence_note}</div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {extraction.missing_axes.length > 0 && (
                  <div style={{ fontSize: 12, color: '#9aa3af', marginTop: 10 }}>
                    求人票に記載がなかった項目: {extraction.missing_axes.map(fieldLabel).join('、')}
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>会社名（任意・表示用）</label>
                  <input
                    value={postingCompanyName}
                    onChange={e => setPostingCompanyName(e.target.value)}
                    placeholder="例: 株式会社サンプル"
                    style={selectStyle}
                  />
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <Button onClick={startFromPosting} disabled={creatingFromPosting} style={{ padding: '12px 28px' }}>
                    {creatingFromPosting ? '準備中...' : 'この内容で診断を開始'}
                  </Button>
                  {createError && <span style={{ fontSize: 12, color: '#d12e33' }}>{createError}</span>}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Priority axes */}
        <Card style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 16 }}>あなたの重視条件</div>
          <div style={{ fontSize: 13, color: '#626b78', marginBottom: 12 }}>重要と思う項目を選んでください（1つ以上）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AXES.map(axis => {
              const on = selected.has(axis)
              return (
                <button key={axis} onClick={() => toggleAxis(axis)} style={{
                  padding: '6px 16px', borderRadius: 15, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: on ? '#ddf7f4' : '#f7f9fc', color: on ? '#00847f' : '#626b78',
                  border: `1px solid ${on ? '#00847f' : '#d2dae5'}`,
                }}>{axis}</button>
              )
            })}
          </div>
        </Card>

        {mode !== 'posting' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button onClick={start} disabled={!canStart} style={{ padding: '12px 28px' }}>{startLabel}</Button>
            {mode === 'compare' && picked.size === 0 && <span style={{ fontSize: 12, color: '#9aa3af' }}>比較する企業を1社以上選んでください</span>}
          </div>
        )}
      </div>
    </AppShell>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#141922', marginBottom: 5 }
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d2dae5', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#141922', background: '#fff', boxSizing: 'border-box',
}
