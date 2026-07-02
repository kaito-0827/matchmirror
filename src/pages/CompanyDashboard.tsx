import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api, type CompanyMatchItem, type CompanyAccountInfo, type MyCompanyProfileItem } from '../api/client'
import { INDUSTRY_OPTIONS, SIZE_BAND_OPTIONS, REGION_OPTIONS } from '../auth/companyOptions'
import type { CompanyDashboard as DashboardData, DashboardCandidate, DashboardTrends } from '../api/types'

type ChipVariant = 'danger' | 'amber' | 'teal' | 'blue' | 'gray'

const RISK_VARIANTS: Record<string, ChipVariant> = {
  high: 'danger',
  medium: 'amber',
  low: 'teal',
}

const CATEGORY_VARIANTS: ChipVariant[] = ['danger', 'amber', 'teal', 'blue', 'gray']

interface CompanyEditForm {
  name: string
  industry: string
  size_band: string
  region: string
  contact_email: string
}

const toEditForm = (c: CompanyAccountInfo): CompanyEditForm => ({
  name: c.name || '',
  industry: c.industry || '',
  size_band: c.size_band || '',
  region: c.region || '',
  contact_email: c.contact_email || '',
})

export default function CompanyDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [matches, setMatches] = useState<CompanyMatchItem[]>([])
  const [trends, setTrends] = useState<DashboardTrends | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [showTrends, setShowTrends] = useState(false)

  // 会社アカウント情報・自社求人
  const [company, setCompany] = useState<CompanyAccountInfo | null>(null)
  const [profiles, setProfiles] = useState<MyCompanyProfileItem[]>([])
  const [jobId, setJobId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<CompanyEditForm>({ name: '', industry: '', size_band: '', region: '', contact_email: '' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const loadJobData = async (jid: string) => {
    try {
      const [dash, trendRes] = await Promise.all([
        api.getCompanyDashboard(jid),
        api.getDashboardTrends(jid).catch(() => null),
      ])
      setData(dash)
      setTrends(trendRes)
    } catch {
      setFetchError(true)
    }
  }

  useEffect(() => {
    const load = async () => {
      // 1) 会社アカウントを起点に自社求人・マッチを解決する
      //    （従来はlocalStorageのmm_job_id頼みで、別端末や候補者操作後は自社データが引けなかった）
      let companyScoped = false
      let selectedJob: string | null = null
      try {
        const me = await api.getMe()
        if (me.company) {
          companyScoped = true
          setCompany(me.company)
          setEditForm(toEditForm(me.company))
          const mine = await api.getMyCompanyProfiles().catch(() => ({ items: [] as MyCompanyProfileItem[], total: 0, company_id: null }))
          setProfiles(mine.items)
          selectedJob = mine.items[0]?.job_id ?? null
        }
      } catch { /* 未ログイン/ゲスト → 従来のフォールバックへ */ }

      if (!companyScoped) selectedJob = localStorage.getItem('mm_job_id') || 'job-001'
      setJobId(selectedJob)

      try {
        const matchRes = companyScoped
          ? await api.getMyCompanyMatches()
          : selectedJob
            ? await api.getCompanyMatches(selectedJob)
            : { items: [] as CompanyMatchItem[], total: 0, unread: 0 }
        setMatches(matchRes.items)
      } catch {
        setMatches([])
      }

      if (selectedJob) {
        await loadJobData(selectedJob)
      } else if (!companyScoped) {
        setFetchError(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  const switchJob = (jid: string) => {
    setJobId(jid)
    setData(null)
    setTrends(null)
    loadJobData(jid)
  }

  const saveCompany = async () => {
    if (!company) return
    if (!editForm.name.trim()) { setSaveError('会社名は必須です。'); return }
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await api.updateCompany(company.id, {
        name: editForm.name.trim(),
        industry: editForm.industry || undefined,
        size_band: editForm.size_band || undefined,
        region: editForm.region || undefined,
        contact_email: editForm.contact_email.trim() || undefined,
      })
      setCompany(updated)
      setEditForm(toEditForm(updated))
      setEditing(false)
    } catch {
      setSaveError('保存に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const markRead = (id: string) => {
    api.markMatchRead(id)
      .then(() => setMatches(prev => prev.map(m => m.id === id ? { ...m, read: true } : m)))
      .catch(() => {})
  }

  if (loading) {
    return (
      <AppShell activeStep="企業実態">
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#626b78' }}>ダッシュボードを読み込み中...</div>
        </div>
      </AppShell>
    )
  }

  if (fetchError) {
    return (
      <AppShell activeStep="企業実態">
        <div style={{ padding: '48px' }}>
          <div style={{ background: '#ffe8e8', borderRadius: 10, padding: '20px 24px', maxWidth: 520, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#d12e33', marginBottom: 6 }}>バックエンドに接続できません</div>
            <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>
              APIサーバーが起動していないか、接続できません。<br />
              バックエンドを起動してからページを更新してください。
            </div>
          </div>
          <Button variant="secondary" onClick={() => window.location.reload()}>ページを更新</Button>
        </div>
      </AppShell>
    )
  }

  const stats = data ? [
    { label: '候補者総数', value: String(data.total_count), color: '#d12e33', bg: '#ffe8e8' },
    { label: '高リスク', value: String(data.high_risk_count), color: '#dc8a14', bg: '#fff4db' },
    { label: 'フォロー未完了', value: String(data.pending_followup_count), color: '#626b78', bg: '#f7f9fc' },
    { label: '面談後も懸念あり', value: String(data.pending_concern_count ?? 0), color: '#d12e33', bg: '#ffe8e8' },
  ] : []

  const riskCategories = data ? Object.entries(data.risk_categories) : []
  const candidates: DashboardCandidate[] = data?.candidates ?? []
  const pendingConcernCandidates = candidates.filter(c => (c.unresolved_count ?? 0) > 0)

  return (
    <AppShell activeStep="企業実態">
      <div style={{ padding: '32px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#141922', margin: '0 0 4px' }}>候補者フォロー・ダッシュボード</h1>
            <p style={{ fontSize: 14, color: '#626b78', margin: 0 }}>
              候補者個人の不安を抽象化し、フォロータスクに変換した一覧
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {profiles.length > 1 && jobId && (
              <select
                value={jobId}
                onChange={e => switchJob(e.target.value)}
                style={{
                  padding: '9px 12px', border: '1px solid #d2dae5', borderRadius: 8,
                  fontSize: 13, fontFamily: 'inherit', color: '#141922', background: '#fff',
                }}
              >
                {profiles.map(p => (
                  <option key={p.job_id} value={p.job_id}>{p.job_title || p.job_id}</option>
                ))}
              </select>
            )}
            <Button variant="secondary" onClick={() => navigate('/company/posting-check')} style={{ padding: '10px 16px' }}>
              求人票チェック
            </Button>
            <Button onClick={() => navigate('/company/followup')} style={{ padding: '10px 20px' }}>
              フォロー計画を見る
            </Button>
          </div>
        </div>

        {/* 会社情報（登録内容の確認・編集） */}
        {company && (
          <Card style={{ padding: 22, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 16 : 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>会社情報</div>
                <Chip variant="gray">登録内容はいつでも編集できます</Chip>
              </div>
              {!editing && (
                <Button variant="secondary" onClick={() => { setEditing(true); setSaveError(null) }} style={{ padding: '7px 16px' }}>
                  編集
                </Button>
              )}
            </div>

            {!editing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#141922' }}>{company.name}</div>
                {company.industry && <Chip variant="blue">{company.industry}</Chip>}
                {company.size_band && <Chip variant="gray">{company.size_band}</Chip>}
                {company.region && <Chip variant="gray">{company.region}</Chip>}
                {company.contact_email && (
                  <span style={{ fontSize: 13, color: '#626b78' }}>採用担当: {company.contact_email}</span>
                )}
                {!company.industry && !company.size_band && !company.region && (
                  <span style={{ fontSize: 13, color: '#dc8a14' }}>業界・規模・所在地が未設定です。「編集」から入力してください。</span>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <EditField label="会社名">
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={editInputStyle} />
                  </EditField>
                  <EditField label="業界">
                    <select value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} style={editInputStyle}>
                      <option value="">未設定</option>
                      {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </EditField>
                  <EditField label="企業規模">
                    <select value={editForm.size_band} onChange={e => setEditForm(f => ({ ...f, size_band: e.target.value }))} style={editInputStyle}>
                      <option value="">未設定</option>
                      {SIZE_BAND_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </EditField>
                  <EditField label="所在地">
                    <select value={editForm.region} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))} style={editInputStyle}>
                      <option value="">未設定</option>
                      {REGION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </EditField>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 12, marginBottom: 14 }}>
                  <EditField label="採用担当メール">
                    <input type="email" value={editForm.contact_email} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))} style={editInputStyle} />
                  </EditField>
                </div>
                {saveError && <div style={{ fontSize: 13, color: '#d12e33', marginBottom: 10 }}>{saveError}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={saveCompany} disabled={saving} style={{ padding: '9px 22px' }}>
                    {saving ? '保存中...' : '保存する'}
                  </Button>
                  <Button variant="secondary" disabled={saving} onClick={() => { setEditing(false); setSaveError(null); setEditForm(toEditForm(company)) }} style={{ padding: '9px 18px' }}>
                    キャンセル
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* 企業実態が未登録の場合の案内 */}
        {company && profiles.length === 0 && (
          <div style={{ marginBottom: 24, padding: '18px 22px', background: '#fff4db', border: '1px solid #f0d9a8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 4 }}>求人の実態プロファイルが未登録です</div>
              <div style={{ fontSize: 13, color: '#626b78', lineHeight: 1.6 }}>
                業務内容・OJT・休暇実態などを登録すると、候補者があなたの会社と相性診断できるようになり、マッチングがここに届きます。
              </div>
            </div>
            <Button onClick={() => navigate('/company')} style={{ padding: '10px 20px', flexShrink: 0 }}>
              企業実態を登録する
            </Button>
          </div>
        )}

        {/* マッチした候補者 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>マッチした候補者</div>
            <Chip variant="teal">{matches.length}件</Chip>
            {matches.some(m => !m.read) && <Chip variant="danger">未読 {matches.filter(m => !m.read).length}</Chip>}
          </div>
          {matches.length === 0 ? (
            <Card style={{ padding: 20 }}>
              <div style={{ fontSize: 13, color: '#626b78', lineHeight: 1.6 }}>
                まだマッチした候補者はいません。候補者が診断レポートから「この企業にマッチング」すると、候補者名・面接で確認すべきポイントつきでここに表示されます。
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {matches.map(m => (
                <Card key={m.id} style={{ padding: 18, borderLeft: `4px solid ${m.read ? '#d2dae5' : '#00847f'}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#141922', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span>♥ {m.candidate_name} さんがマッチングしました</span>
                      <span style={{ fontSize: 12, color: '#00847f', fontWeight: 700 }}>合う度 {m.overall_score}%</span>
                      {profiles.length > 1 && m.job_id && (
                        <Chip variant="gray">{profiles.find(p => p.job_id === m.job_id)?.job_title || m.job_id}</Chip>
                      )}
                    </div>
                    {!m.read && (
                      <button onClick={() => markRead(m.id)} style={{
                        padding: '3px 10px', background: '#fff', border: '1px solid #d2dae5', borderRadius: 6,
                        fontSize: 11, color: '#626b78', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                      }}>既読にする</button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#141922', background: '#f0faf9', borderRadius: 8, padding: '10px 12px', marginBottom: 10, lineHeight: 1.6 }}>
                    {m.notification}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 6 }}>面接でお話しすべきこと</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {m.company_prep.map((p, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#141922', lineHeight: 1.7 }}>{p}</li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 面談後も懸念が残る候補者（あれば上部に強調表示） */}
        {pendingConcernCandidates.length > 0 && (
          <div style={{ marginBottom: 24, padding: '16px 20px', background: '#ffe8e8', border: '1px solid #f4b8b8', borderRadius: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#d12e33', marginBottom: 8 }}>
              ⚠️ 面談後も懸念が残る候補者 ({pendingConcernCandidates.length}名)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingConcernCandidates.map((c, ci) => (
                <div key={c.report_id ?? `${c.user_id}-${ci}`} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>{c.display_name}</div>
                  <Chip variant="danger">未解決 {c.unresolved_count}件</Chip>
                  <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                    {c.main_concerns.map((concern, idx) => (
                      <Chip key={`${concern}-${idx}`} variant="amber">{concern}</Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: '#626b78' }}>→ {c.recommended_action}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats（求人未選択時は診断データが無いため非表示） */}
        {data && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {stats.map(({ label, value, color, bg }) => (
            <Card key={label} style={{ padding: 20 }}>
              <div style={{ fontSize: 12, color: '#626b78', marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color }}>{value}</span>
                <span style={{ fontSize: 13, color: '#626b78' }}>件</span>
              </div>
              <div style={{ marginTop: 10, height: 4, background: bg, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(parseInt(value) / 15 * 100, 100)}%`,
                  height: '100%', background: color, borderRadius: 2,
                }} />
              </div>
            </Card>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Candidate table */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>候補者ごとのフォロー状況</div>
            <Card style={{ overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px',
                padding: '10px 20px', background: '#f7f9fc', borderBottom: '1px solid #d2dae5',
                fontSize: 12, fontWeight: 600, color: '#626b78',
              }}>
                <div>候補者</div>
                <div>主な不安カテゴリ</div>
                <div>推奨フォロー</div>
                <div>アクション</div>
              </div>
              {candidates.map((c, i) => (
                <div key={c.report_id ?? `${c.user_id}-${i}`} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 1fr 80px',
                  padding: '16px 20px',
                  borderBottom: i < candidates.length - 1 ? '1px solid #d2dae5' : 'none',
                  alignItems: 'center',
                  background: (c.unresolved_count ?? 0) > 0 ? '#fff8f8' : 'transparent',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#141922' }}>
                    {c.display_name}
                    {(c.unresolved_count ?? 0) > 0 && (
                      <div style={{ fontSize: 10, color: '#d12e33', fontWeight: 600 }}>懸念残{c.unresolved_count}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.main_concerns.map((concern, idx) => (
                      <Chip key={`${concern}-${idx}`} variant={RISK_VARIANTS[c.risk_level] ?? 'gray'}>{concern}</Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: '#626b78' }}>{c.recommended_action}</div>
                  <div>
                    <button
                      onClick={() => navigate(c.report_id
                        ? `/company/followup?reportId=${encodeURIComponent(c.report_id)}&label=${encodeURIComponent(c.display_name)}`
                        : '/company/followup')}
                      style={{
                        padding: '4px 10px', background: '#e9f0ff', border: 'none', borderRadius: 6,
                        fontSize: 12, fontWeight: 600, color: '#2863db', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      計画
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Common concerns */}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#141922', marginBottom: 12 }}>よくある不安カテゴリ</div>
              <Card style={{ padding: 20 }}>
                {riskCategories.map(([label, count], idx) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Chip variant={CATEGORY_VARIANTS[idx % CATEGORY_VARIANTS.length]}>{label}</Chip>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#141922' }}>
                      {count}<span style={{ fontSize: 12, fontWeight: 500, color: '#626b78' }}>件</span>
                    </div>
                  </div>
                ))}
                {data?.common_questions && data.common_questions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>よくある質問</div>
                    {data.common_questions.map((q, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', background: '#f7f9fc', borderRadius: 6,
                        fontSize: 12, color: '#141922', marginBottom: 6, lineHeight: 1.4,
                      }}>
                        {q}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{
                  marginTop: 16, padding: '10px 14px', background: '#f7f9fc',
                  borderRadius: 8, fontSize: 12, color: '#626b78', lineHeight: 1.5,
                }}>
                  候補者ごとの個人情報ではなく、集計されたカテゴリのみを表示しています。
                </div>
              </Card>
            </div>

            {/* Trend section */}
            {trends && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>不安カテゴリの傾向</div>
                  <button
                    onClick={() => setShowTrends(p => !p)}
                    style={{
                      padding: '4px 10px', background: 'none', border: '1px solid #d2dae5',
                      borderRadius: 6, fontSize: 12, color: '#626b78', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {showTrends ? '閉じる' : '月次推移'}
                  </button>
                </div>
                <Card style={{ padding: 20 }}>
                  {/* Deltas */}
                  <div style={{ marginBottom: showTrends ? 16 : 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>先月比</div>
                    {Object.entries(trends.deltas).map(([axis, delta]) => (
                      <div key={axis} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, color: '#141922' }}>{axis}</span>
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: delta > 0 ? '#d12e33' : delta < 0 ? '#00847f' : '#626b78',
                        }}>
                          {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '→ 変化なし'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Monthly breakdown */}
                  {showTrends && trends.points.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 8 }}>月次内訳</div>
                      {trends.points.slice(-3).map(point => (
                        <div key={point.period} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: '#626b78', marginBottom: 4 }}>{point.period}</div>
                          {Object.entries(point.axis_counts).map(([axis, count]) => (
                            <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 12, color: '#141922', flex: 1 }}>{axis}</div>
                              <div style={{
                                height: 8, width: `${Math.min(count * 20, 80)}px`, minWidth: 20,
                                background: '#00847f', borderRadius: 4,
                              }} />
                              <div style={{ fontSize: 12, color: '#626b78', minWidth: 16 }}>{count}</div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </AppShell>
  )
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#626b78', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const editInputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d2dae5', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#141922', boxSizing: 'border-box', background: '#fff',
}
