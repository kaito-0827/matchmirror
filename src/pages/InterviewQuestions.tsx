import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import type { RecommendedQuestion } from '../api/types'

type ChipVariant = 'teal' | 'amber' | 'blue' | 'danger' | 'gray'

const AXIS_VARIANT: Record<string, ChipVariant> = {
  'OJT体制': 'danger',
  '文化・価値観': 'danger',
  '仕事内容': 'teal',
  '働き方': 'teal',
  '有休運用': 'amber',
  '条件・制度': 'amber',
  '成長・キャリア': 'blue',
  '評価制度': 'blue',
}

interface SavedQuestion extends RecommendedQuestion {
  saved: boolean
}

const FALLBACK_QUESTIONS: RecommendedQuestion[] = [
  { id: '1', axis: 'OJT体制', text: '入社後1カ月は誰にどの頻度で相談できますか？', priority: 'high' },
  { id: '2', axis: '仕事内容', text: '企画業務と運用業務の比率はどれくらいですか？', priority: 'high' },
  { id: '3', axis: '有休運用', text: 'チーム内で有休を取る時の調整方法は？', priority: 'medium' },
  { id: '4', axis: '評価制度', text: '入社1年目の評価基準と目標設定のプロセスを教えてください。', priority: 'medium' },
]

export default function InterviewQuestions() {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<SavedQuestion[]>([])
  const [allSaved, setAllSaved] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem('mm_report')
    let qs: RecommendedQuestion[] = FALLBACK_QUESTIONS
    if (raw) {
      try {
        const report = JSON.parse(raw)
        if (report.questions?.length > 0) qs = report.questions
      } catch { /* ignore */ }
    }
    setQuestions(qs.map(q => ({ ...q, saved: false })))
  }, [])

  const toggleSave = (id: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, saved: !q.saved } : q))
  }

  const saveAll = () => {
    setQuestions(prev => prev.map(q => ({ ...q, saved: true })))
    setAllSaved(true)
  }

  const highPriority = questions.filter(q => q.priority === 'high')
  const mediumPriority = questions.filter(q => q.priority !== 'high')

  return (
    <AppShell activeStep="候補者診断">
      <div style={{ padding: '32px 48px', maxWidth: 880 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: 0 }}>面談で確認する質問</h1>
          <Chip variant="blue">QuestionAgent</Chip>
        </div>
        <p style={{ fontSize: 14, color: '#626b78', marginBottom: 32 }}>
          診断結果から生成された確認質問です。面談・面接で聞いてみましょう。
        </p>

        {highPriority.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>優先度：高</div>
              <Chip variant="danger">確認推奨</Chip>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {highPriority.map(q => (
                <QuestionCard key={q.id} question={q} axisVariant={AXIS_VARIANT[q.axis] ?? 'gray'} onToggle={toggleSave} />
              ))}
            </div>
          </div>
        )}

        {mediumPriority.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', marginBottom: 12 }}>優先度：中</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mediumPriority.map(q => (
                <QuestionCard key={q.id} question={q} axisVariant={AXIS_VARIANT[q.axis] ?? 'gray'} onToggle={toggleSave} />
              ))}
            </div>
          </div>
        )}

        {allSaved && (
          <div style={{
            background: '#ddf7f4',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 24,
            fontSize: 14,
            color: '#00847f',
            fontWeight: 600,
          }}>
            ✓ 質問を保存しました。面談前に見直してください。
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={saveAll} style={{ padding: '12px 28px' }}>
            質問を保存
          </Button>
          <Button variant="secondary" onClick={() => navigate('/company/followup')} style={{ padding: '12px 28px' }}>
            フォロー計画へ共有 →
          </Button>
          <Button variant="ghost" onClick={() => navigate('/candidate/report')}>
            ← レポートへ
          </Button>
        </div>
      </div>
    </AppShell>
  )
}

function QuestionCard({
  question,
  axisVariant,
  onToggle,
}: {
  question: SavedQuestion
  axisVariant: ChipVariant
  onToggle: (id: string) => void
}) {
  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 10 }}>
            <Chip variant={axisVariant}>{question.axis}</Chip>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#141922', lineHeight: 1.5 }}>
            {question.text}
          </div>
          {question.background && (
            <div style={{ fontSize: 12, color: '#626b78', marginTop: 6 }}>{question.background}</div>
          )}
        </div>
        <button
          onClick={() => onToggle(question.id)}
          style={{
            padding: '6px 14px',
            background: question.saved ? '#ddf7f4' : '#fff',
            border: `1px solid ${question.saved ? '#00847f' : '#d2dae5'}`,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: question.saved ? '#00847f' : '#626b78',
            cursor: 'pointer',
            fontFamily: 'inherit',
            flexShrink: 0,
          }}
        >
          {question.saved ? '✓ 保存済み' : '保存'}
        </button>
      </div>
    </Card>
  )
}
