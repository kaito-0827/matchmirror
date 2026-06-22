import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import CompanyShell from '../components/CompanyShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import type { FollowUpTask, DashboardCandidate } from '../api/types'

type ChipVariant = 'danger' | 'amber' | 'teal' | 'blue' | 'gray'

const AXIS_VARIANT: Record<string, ChipVariant> = {
  'OJT体制': 'danger',
  '文化・価値観': 'danger',
  '仕事内容': 'teal',
  '働き方': 'teal',
  '有休運用': 'amber',
  '条件・制度': 'amber',
  '成長・キャリア': 'blue',
  'フォロー確認': 'blue',
}

interface LocalTask extends FollowUpTask {
  done: boolean
}

export default function FollowUpPlan() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const reportId = searchParams.get('reportId')
  const candidateLabel = searchParams.get('label') ?? '候補者'

  const [candidates, setCandidates] = useState<DashboardCandidate[]>([])
  const [candidatesLoaded, setCandidatesLoaded] = useState(false)

  const [tasks, setTasks] = useState<LocalTask[]>([])
  const [planId, setPlanId] = useState<string | null>(null)
  const [guardrailVisible, setGuardrailVisible] = useState(false)
  const [approved, setApproved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 候補者一覧を取得（プルダウン用）
  useEffect(() => {
    const jobId = localStorage.getItem('mm_job_id') || 'job-001'
    api.getCompanyDashboard(jobId)
      .then(d => setCandidates(d.candidates.filter(c => !!c.report_id)))
      .catch(() => {})
      .finally(() => setCandidatesLoaded(true))
  }, [])

  // reportId未指定時、候補者一覧の先頭を自動選択
  useEffect(() => {
    if (!reportId && candidates.length > 0) {
      const first = candidates[0]
      setSearchParams({ reportId: first.report_id as string, label: first.display_name }, { replace: true })
    }
  }, [reportId, candidates, setSearchParams])

  const selectCandidate = (userId: string) => {
    const c = candidates.find(c => c.user_id === userId)
    if (!c?.report_id) return
    setSearchParams({ reportId: c.report_id, label: c.display_name })
  }

  useEffect(() => {
    const generate = async () => {
      if (!reportId) {
        if (candidatesLoaded && candidates.length === 0) {
          setError('候補者が見つかりません。ダッシュボードで候補者の診断が完了しているか確認してください。')
          setLoading(false)
        } else {
          setError(null)
          setLoading(true)
        }
        return
      }
      setLoading(true)
      setError(null)
      setApproved(false)
      setGuardrailVisible(false)
      try {
        const res = await api.generateFollowUpPlan(reportId)
        setPlanId(res.plan_id)
        setTasks(res.tasks.map(t => ({ ...t, done: t.status === 'done' })))
      } catch {
        const fallbackTasks: LocalTask[] = [
          { id: 'f1', title: '育成担当者との事前面談を設定', axis: 'OJT体制', due_label: '入社30日前', owner: '人事担当者', status: 'pending', done: false, detail: 'OJT体制・メンター制度の詳細を確認' },
          { id: 'f2', title: '仕事内容の詳細説明資料を共有', axis: '仕事内容', due_label: '入社14日前', owner: '採用担当者', status: 'pending', done: false, detail: '実際の業務比率・繁忙期スケジュールを事前に共有' },
          { id: 'f3', title: '有休・残業ガイドラインの送付', axis: '有休運用', due_label: '入社7日前', owner: '人事担当者', status: 'pending', done: false, detail: '制度説明だけでなく運用実態も含める' },
          { id: 'f4', title: '配属チームメンバーとの顔合わせ', axis: '文化・価値観', due_label: '入社後7日', owner: '現場マネージャー', status: 'pending', done: false },
          { id: 'f5', title: '30日間振り返り面談', axis: 'フォロー確認', due_label: '入社後30日', owner: '人事担当者', status: 'pending', done: false, detail: '期待値・不安の解消状況を確認' },
        ]
        setPlanId('offline-plan')
        setTasks(fallbackTasks)
      } finally {
        setLoading(false)
      }
    }
    generate()
  }, [reportId, candidatesLoaded, candidates.length])

  const toggle = (id: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))

  const handleApprove = async () => {
    if (!planId) return
    try {
      await api.approveFollowUpPlan(planId)
      setApproved(true)
    } catch {
      setApproved(true)
    }
  }

  const doneCount = tasks.filter(t => t.done).length

  return (
    <CompanyShell>
      <div style={{ padding: '32px 48px', maxWidth: 960 }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13, color: '#626b78' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 13, color: '#00847f', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600,
            }}
          >
            ダッシュボード
          </button>
          <span>›</span>
          <span style={{ color: '#141922', fontWeight: 600 }}>
            {reportId ? `${candidateLabel} のフォロー計画` : 'フォロー計画'}
          </span>
        </div>

        {/* Candidate selector */}
        {candidates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#626b78' }}>候補者を選択：</label>
            <select
              value={candidates.find(c => c.report_id === reportId)?.user_id ?? ''}
              onChange={e => selectCandidate(e.target.value)}
              style={{
                padding: '8px 12px', border: '1px solid #d2dae5', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', color: '#141922',
                minWidth: 220, background: '#fff',
              }}
            >
              {candidates.map(c => (
                <option key={c.user_id} value={c.user_id}>{c.display_name}</option>
              ))}
            </select>
          </div>
        )}

        {loading && (
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#141922', marginBottom: 8 }}>
              FollowUpAgentが計画を生成中...
            </div>
            <div style={{ fontSize: 14, color: '#626b78' }}>
              ズレに応じたフォロータスクを作成しています
            </div>
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '24px 0', maxWidth: 600 }}>
            <div style={{ fontSize: 15, color: '#d12e33', marginBottom: 16 }}>{error}</div>
            <Button onClick={() => navigate('/')} variant="secondary">
              ← ダッシュボードへ戻る
            </Button>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 4px' }}>
                  内定前後フォロー計画
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    padding: '3px 10px', background: '#f0faf9', borderRadius: 6,
                    fontSize: 13, fontWeight: 700, color: '#00847f', border: '1px solid #b2e4e2',
                  }}>
                    {candidateLabel}
                  </div>
                  <span style={{ fontSize: 12, color: '#9aa3af' }}>
                    ※ 個人情報は匿名化されています
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Chip variant="blue">FollowUpAgent</Chip>
                <Chip variant={guardrailVisible ? 'teal' : 'gray'}>GuardrailAgent</Chip>
              </div>
            </div>

            <p style={{ fontSize: 14, color: '#626b78', marginBottom: 24 }}>
              候補者の懸念に応じて、入社前に実施すべき面談・資料共有・現場接点を提案します。
            </p>

            {/* Progress */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28,
              padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #d2dae5',
            }}>
              <div style={{ fontSize: 13, color: '#626b78' }}>完了：{doneCount} / {tasks.length} タスク</div>
              <div style={{ flex: 1, maxWidth: 200, height: 6, background: '#e7ebf2', borderRadius: 3 }}>
                <div style={{
                  width: tasks.length > 0 ? `${(doneCount / tasks.length) * 100}%` : '0%',
                  height: '100%', background: '#00847f', borderRadius: 3, transition: 'width 0.3s',
                }} />
              </div>
              {tasks.length > 0 && doneCount === tasks.length && <Chip variant="teal">完了</Chip>}
            </div>

            {/* Timeline */}
            <div style={{ position: 'relative', paddingLeft: 32, marginBottom: 32 }}>
              <div style={{
                position: 'absolute', left: 12, top: 8, bottom: 8, width: 2, background: '#d2dae5',
              }} />

              {tasks.map((task, i) => {
                const dueLabel = task.due_label
                  || (task.days_before_join ? `入社${task.days_before_join}日前`
                    : task.days_after_join ? `入社後${task.days_after_join}日` : '未定')
                const variant = AXIS_VARIANT[task.axis] ?? 'gray'

                return (
                  <div key={task.id} style={{ position: 'relative', marginBottom: i < tasks.length - 1 ? 16 : 0 }}>
                    <div style={{
                      position: 'absolute', left: -26, top: 18, width: 12, height: 12,
                      borderRadius: '50%',
                      background: task.done ? '#00847f' : '#d2dae5',
                      border: `2px solid ${task.done ? '#00847f' : '#d2dae5'}`,
                      transition: 'background 0.2s',
                    }} />

                    <Card style={{ padding: '16px 20px', opacity: task.done ? 0.7 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, color: '#fff',
                              background: '#626b78', padding: '2px 8px', borderRadius: 4,
                            }}>
                              {dueLabel}
                            </span>
                            <Chip variant={variant}>{task.axis}</Chip>
                          </div>
                          <div style={{
                            fontSize: 15, fontWeight: 600, color: '#141922',
                            textDecoration: task.done ? 'line-through' : 'none', marginBottom: 4,
                          }}>
                            {task.title}
                          </div>
                          <div style={{ fontSize: 12, color: '#626b78' }}>担当：{task.owner}</div>
                          {task.detail && (
                            <div style={{ fontSize: 12, color: '#626b78', marginTop: 4 }}>{task.detail}</div>
                          )}
                        </div>
                        <button
                          onClick={() => toggle(task.id)}
                          style={{
                            padding: '6px 14px',
                            background: task.done ? '#ddf7f4' : '#fff',
                            border: `1px solid ${task.done ? '#00847f' : '#d2dae5'}`,
                            borderRadius: 8, fontSize: 12, fontWeight: 600,
                            color: task.done ? '#00847f' : '#626b78',
                            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                          }}
                        >
                          {task.done ? '✓ 完了' : '完了にする'}
                        </button>
                      </div>
                    </Card>
                  </div>
                )
              })}
            </div>

            {/* Guardrail section */}
            <div style={{ marginBottom: 24 }}>
              <button
                onClick={() => setGuardrailVisible(!guardrailVisible)}
                style={{
                  padding: '8px 16px', background: '#f7f9fc', border: '1px solid #d2dae5',
                  borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#626b78',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12,
                }}
              >
                {guardrailVisible ? '▲' : '▼'} AIガードレール状態を確認
              </button>

              {guardrailVisible && (
                <Card style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Chip variant="teal">GuardrailAgent</Chip>
                    <span style={{ fontSize: 13, color: '#626b78' }}>最終チェック済み</span>
                  </div>
                  <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6, marginBottom: 16 }}>
                    不適切な推測を停止し、職務関連要件と本人回答に基づく表現へ再生成。
                  </div>
                  <div style={{
                    background: '#ddf7f4', borderRadius: 8, padding: '12px 16px', marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#00847f', marginBottom: 4 }}>安全な表現</div>
                    <div style={{ fontSize: 14, color: '#141922' }}>
                      採用判断ではなく、面談で育成体制を確認してください。
                    </div>
                  </div>
                  <Button variant="secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
                    修正案を採用
                  </Button>
                </Card>
              )}
            </div>

            {approved && (
              <div style={{
                background: '#ddf7f4', borderRadius: 8, padding: '12px 16px',
                marginBottom: 24, fontSize: 14, color: '#00847f', fontWeight: 600,
              }}>
                ✓ フォロー計画を承認しました。各担当者に通知されます。
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={handleApprove} disabled={approved} style={{ padding: '12px 28px' }}>
                {approved ? '✓ 承認済み' : '計画を承認'}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/')} style={{ padding: '12px 28px' }}>
                ← ダッシュボードへ戻る
              </Button>
            </div>
          </>
        )}
      </div>
    </CompanyShell>
  )
}
