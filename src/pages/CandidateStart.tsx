import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import { api, type CompanyListItem } from '../api/client'

const AXES = ['仕事内容', '働き方', '条件・制度', '文化・価値観', '成長・キャリア', '不安・未確認点']

export default function CandidateStart() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<string>>(new Set(AXES.slice(0, 3)))

  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [industry, setIndustry] = useState('すべて')
  const [jobId, setJobId] = useState('')

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
  // 業界フィルタ変更で選択中の会社が範囲外になったら先頭にフォールバック（effectを使わず派生）
  const effectiveJobId = filtered.some(c => c.job_id === jobId) ? jobId : (filtered[0]?.job_id ?? '')
  const company = companies.find(c => c.job_id === effectiveJobId) || null

  const toggle = (axis: string) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(axis)) { if (next.size > 1) next.delete(axis) } else next.add(axis)
    return next
  })

  const start = () => {
    localStorage.setItem('mm_priority_axes', JSON.stringify([...selected]))
    localStorage.setItem('mm_job_id', effectiveJobId || 'job-001')
    if (company?.name) localStorage.setItem('mm_company_name', company.name)
    localStorage.removeItem('mm_session_id')
    localStorage.removeItem('mm_report')
    navigate('/candidate/chat')
  }

  return (
    <AppShell activeStep="候補者診断">
      <div style={{ padding: '40px 48px', maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#141922', marginBottom: 8 }}>相性診断を開始</h1>
        <p style={{ fontSize: 15, color: '#626b78', marginBottom: 32 }}>
          診断する企業を選び、チャットで希望を入力すると、企業の「実際の働き方」とのズレをAIが可視化します。
        </p>

        {/* Company selection */}
        <Card style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 4 }}>
            診断する企業を選ぶ {companies.length > 0 && <span style={{ fontSize: 12, color: '#00847f', fontWeight: 700 }}>（{companies.length}社）</span>}
          </div>
          <div style={{ fontSize: 13, color: '#626b78', marginBottom: 16 }}>
            選んだ企業の実態に対してミスマッチを診断します
          </div>

          {companies.length === 0 ? (
            <div style={{ fontSize: 13, color: '#9aa3af' }}>企業リストを読み込み中...（未接続時はデフォルト企業で診断します）</div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 200px' }}>
                <label style={labelStyle}>業界で絞り込み</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)} style={selectStyle}>
                  {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 240 }}>
                <label style={labelStyle}>企業（{filtered.length}社）</label>
                <select value={effectiveJobId} onChange={e => setJobId(e.target.value)} style={selectStyle}>
                  {filtered.map(c => <option key={c.job_id} value={c.job_id}>{c.name}（{c.job_title}）</option>)}
                </select>
              </div>
            </div>
          )}

          {company && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: '#f7f9fc', borderRadius: 10, border: '1px solid #e7ebf2' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 4 }}>{company.name}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[company.industry, company.size_band, company.region, `職種: ${company.job_title}`].filter(Boolean).map((t, i) => (
                  <span key={i} style={{ padding: '2px 8px', background: '#eef1f4', borderRadius: 6, fontSize: 11, color: '#626b78' }}>{t}</span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Priority axes */}
        <Card style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 16 }}>あなたの重視条件</div>
          <div style={{ fontSize: 13, color: '#626b78', marginBottom: 12 }}>重要と思う項目を選んでください（1つ以上）</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AXES.map(axis => {
              const on = selected.has(axis)
              return (
                <button key={axis} onClick={() => toggle(axis)} style={{
                  padding: '6px 16px', borderRadius: 15, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: on ? '#ddf7f4' : '#f7f9fc', color: on ? '#00847f' : '#626b78',
                  border: `1px solid ${on ? '#00847f' : '#d2dae5'}`,
                }}>{axis}</button>
              )
            })}
          </div>
        </Card>

        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={start} style={{ padding: '12px 28px' }}>診断を開始</Button>
        </div>
      </div>
    </AppShell>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#141922', marginBottom: 5 }
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d2dae5', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#141922', background: '#fff', boxSizing: 'border-box',
}
