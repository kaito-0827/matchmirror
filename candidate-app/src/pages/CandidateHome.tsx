import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import CandidateShell from '../components/CandidateShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { CompanyListItem } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const AXES = [
  { key: '仕事内容', desc: '日次業務・裁量・責任範囲' },
  { key: '働き方', desc: '出社・残業・繁忙期' },
  { key: '条件・制度', desc: '給与・有休・福利厚生' },
  { key: '文化・価値観', desc: 'チーム文化・意思決定スタイル' },
  { key: '成長・キャリア', desc: '評価・研修・キャリアパス' },
  { key: '不安・未確認点', desc: '気になること・確認したいリスク' },
]

const FEATURES = [
  { emoji: '💬', title: 'AIが本音を引き出す', desc: '5〜8問の質問に答えるだけ。不安・希望・価値観を自然な会話で整理します。' },
  { emoji: '📊', title: '6軸で可視化', desc: '仕事内容・働き方・文化・OJTなど6つの軸で企業実態とのズレをスコア化。' },
  { emoji: '❓', title: '確認質問を生成', desc: '面談で聞くべき質問をAIが生成。入社後の後悔をゼロに近づけます。' },
]

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #d2dae5', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#141922',
  background: '#fff', boxSizing: 'border-box',
}
const tagStyle: React.CSSProperties = {
  padding: '2px 8px', background: '#eef1f4', borderRadius: 6, fontSize: 11, color: '#626b78',
}

export default function CandidateHome() {
  const navigate = useNavigate()
  const { uid } = useAuth()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['仕事内容', '文化・価値観', '不安・未確認点'])
  )
  const [starting, setStarting] = useState(false)

  // 会社選択
  const [companies, setCompanies] = useState<CompanyListItem[]>([])
  const [industry, setIndustry] = useState<string>('すべて')
  const [jobId, setJobId] = useState<string>('')

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
  // 業界フィルタ変更時、選択中の会社が範囲外なら先頭に合わせる
  useEffect(() => {
    if (filtered.length && !filtered.some(c => c.job_id === jobId)) {
      setJobId(filtered[0].job_id)
    }
  }, [filtered, jobId])

  const selectedCompany = companies.find(c => c.job_id === jobId) || null

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) return prev
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleStart = async () => {
    setStarting(true)
    localStorage.setItem('mm_priority_axes', JSON.stringify([...selected]))
    const targetJobId = jobId || 'job-001'
    localStorage.setItem('mm_job_id', targetJobId)
    if (selectedCompany?.name) localStorage.setItem('mm_company_name', selectedCompany.name)
    try {
      const res = await api.createSession(uid || 'demo-user', targetJobId)
      localStorage.setItem('mm_session_id', res.session_id)
      localStorage.setItem('mm_first_question', res.first_question)
    } catch {
      localStorage.setItem('mm_session_id', 'offline')
    }
    navigate('/chat')
  }

  return (
    <CandidateShell>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-block',
          padding: '5px 14px',
          background: '#ddf7f4',
          borderRadius: 20,
          fontSize: 12,
          fontWeight: 700,
          color: '#00847f',
          marginBottom: 14,
        }}>
          就活者向け無料診断
        </div>
        <h1 style={{
          fontSize: 34,
          fontWeight: 800,
          color: '#141922',
          margin: '0 0 12px',
          lineHeight: 1.3,
        }}>
          入社前に、ミスマッチを知る。
        </h1>
        <p style={{
          fontSize: 15,
          color: '#626b78',
          lineHeight: 1.7,
          maxWidth: 520,
          margin: '0 auto 28px',
        }}>
          企業の「求人票の言葉」と「実際の働き方」のズレを、AIが可視化します。<br />
          スコアは合否ではなく、面談で確認すべき論点です。
        </p>
      </div>

      {/* Company selection */}
      <Card style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>診断する企業を選ぶ</div>
          {companies.length > 0 && <Chip variant="blue">{companies.length}社から選択</Chip>}
        </div>
        <div style={{ fontSize: 12, color: '#626b78', marginBottom: 16 }}>
          選んだ企業の「実際の働き方」に対して、あなたの希望とのズレを診断します
        </div>

        {companies.length === 0 ? (
          <div style={{ fontSize: 13, color: '#9aa3af' }}>企業リストを読み込み中...（バックエンド未接続の場合はデフォルト企業で診断します）</div>
        ) : (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {/* Industry filter */}
            <div style={{ flex: '0 0 200px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#141922', marginBottom: 5 }}>業界で絞り込み</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)} style={selectStyle}>
                {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            {/* Company select */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#141922', marginBottom: 5 }}>企業（{filtered.length}社）</label>
              <select value={jobId} onChange={e => setJobId(e.target.value)} style={selectStyle}>
                {filtered.map(c => (
                  <option key={c.job_id} value={c.job_id}>
                    {c.name}（{c.job_title}）
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedCompany && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: '#f7f9fc', borderRadius: 10, border: '1px solid #e7ebf2' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 4 }}>{selectedCompany.name}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#626b78' }}>
              {selectedCompany.industry && <span style={tagStyle}>{selectedCompany.industry}</span>}
              {selectedCompany.size_band && <span style={tagStyle}>{selectedCompany.size_band}</span>}
              {selectedCompany.region && <span style={tagStyle}>{selectedCompany.region}</span>}
              <span style={tagStyle}>職種: {selectedCompany.job_title}</span>
            </div>
          </div>
        )}
      </Card>

      {/* Axis selection */}
      <Card style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 4 }}>
          重視する条件を選択
        </div>
        <div style={{ fontSize: 12, color: '#626b78', marginBottom: 16 }}>
          選んだ軸を優先して診断します（1つ以上必須）
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {AXES.map(({ key, desc }) => {
            const isSelected = selected.has(key)
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                style={{
                  padding: '12px 14px',
                  background: isSelected ? '#ddf7f4' : '#f7f9fc',
                  border: `2px solid ${isSelected ? '#00847f' : '#d2dae5'}`,
                  borderRadius: 10,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: 4,
                    background: isSelected ? '#00847f' : '#d2dae5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isSelected && (
                      <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                        <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#00847f' : '#141922' }}>
                    {key}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#626b78', paddingLeft: 20 }}>{desc}</div>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 14, fontSize: 12, color: '#00847f' }}>
          選択中: {[...selected].join('・')}（{selected.size}軸）
        </div>
      </Card>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <Button
            onClick={handleStart}
            disabled={starting}
            style={{ padding: '14px 44px', fontSize: 16, borderRadius: 12, marginBottom: 10 }}
          >
            {starting ? '診断を準備中...' : '診断を始める（約5分）'}
          </Button>
          <div style={{ fontSize: 12, color: '#9aa3af' }}>
            登録不要・無料・個人情報は最小限
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {FEATURES.map(f => (
          <Card key={f.title} style={{ padding: 22 }}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>{f.emoji}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: '#626b78', lineHeight: 1.6 }}>{f.desc}</div>
          </Card>
        ))}
      </div>

      {/* Flow */}
      <Card style={{ padding: 24, background: '#f7f9fc' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 20, textAlign: 'center' }}>
          診断の流れ
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
          {[
            { n: 1, label: 'AIチャット', sub: '5〜8問に回答', chip: 'CandidateAgent', variant: 'teal' as const },
            { n: 2, label: 'レポート', sub: '6軸スコア', chip: 'MismatchAgent', variant: 'blue' as const },
            { n: 3, label: '面談準備', sub: '確認質問生成', chip: 'QuestionAgent', variant: 'amber' as const },
          ].map((step, i) => (
            <div key={step.n} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: 100 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: '#00847f', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800,
                  margin: '0 auto 6px',
                }}>
                  {step.n}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#141922', marginBottom: 4 }}>{step.label}</div>
                <div style={{ fontSize: 11, color: '#626b78', marginBottom: 6 }}>{step.sub}</div>
                <Chip variant={step.variant}>{step.chip}</Chip>
              </div>
              {i < 2 && (
                <div style={{ width: 40, height: 2, background: '#d2dae5', margin: '0 4px', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </Card>
    </CandidateShell>
  )
}
