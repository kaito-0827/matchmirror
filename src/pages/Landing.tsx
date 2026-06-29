import { useNavigate } from 'react-router-dom'
import Card from '../components/Card'
import Chip from '../components/Chip'
import ScoreBar from '../components/ScoreBar'
import { useAuth } from '../auth/AuthContext'

const ghostBtn: React.CSSProperties = {
  padding: '7px 12px', background: 'transparent', color: '#626b78', border: '1px solid #d2dae5',
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
}

export default function Landing() {
  const navigate = useNavigate()
  const { firebaseEnabled, signedIn, email, signOut } = useAuth()

  return (
    <div style={{ minHeight: '100vh', background: '#eef1f4' }}>
      {/* Header */}
      <header style={{
        padding: '16px 48px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#eef1f4',
      }}>
        <div style={{
          width: 28, height: 28, background: '#00847f', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="7" width="12" height="2" rx="1" fill="white"/>
            <rect x="7" y="2" width="2" height="12" rx="1" fill="white"/>
          </svg>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#00847f' }}>MatchMirror</span>

        {firebaseEnabled && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {signedIn ? (
              <>
                <button onClick={() => navigate('/my')} style={ghostBtn}>マイレポート</button>
                <span style={{ fontSize: 12, color: '#626b78', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                <button onClick={() => signOut()} style={ghostBtn}>ログアウト</button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')} style={ghostBtn}>ログイン</button>
                <button onClick={() => navigate('/login?mode=signup')} style={{
                  padding: '7px 16px', background: '#00847f', color: '#fff', border: 'none',
                  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>新規登録</button>
              </>
            )}
          </div>
        )}
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '40px 48px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 520px', gap: 40, alignItems: 'start' }}>
          {/* Left: Hero */}
          <div>
            <h1 style={{
              fontSize: 48,
              fontWeight: 800,
              color: '#141922',
              lineHeight: 1.2,
              margin: '0 0 24px',
            }}>
              「この求人、本当に<br />自分に合ってる？」を<br />入社前に確認する
            </h1>

            <p style={{ fontSize: 16, color: '#626b78', lineHeight: 1.7, marginBottom: 32 }}>
              気になる求人票を貼るだけで、AIが曖昧な表現やズレのリスクを可視化。<br />
              登録企業がなくても、今見ているその求人で診断できます。
            </p>

            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 48 }}>
              <button
                onClick={() => navigate('/candidate')}
                style={{
                  padding: '14px 28px',
                  background: '#00847f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                無料で相性診断を始める
              </button>
              <button
                onClick={() => navigate('/company')}
                style={{
                  padding: 0,
                  background: 'none',
                  color: '#626b78',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                }}
              >
                企業の方はこちら
              </button>
            </div>

            {/* Feature cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 680 }}>
              {[
                { tag: '候補者UX', tagVariant: 'teal' as const, title: 'Candidate-first', desc: '診断ではなく、相性を確認する自己決定の体験。' },
                { tag: 'AI設計', tagVariant: 'purple' as const, title: 'Explainable AI', desc: 'スコア、根拠、確認質問、フォロー提案を同時に提示。' },
                { tag: '人事UX', tagVariant: 'blue' as const, title: 'Recruiter workflow', desc: '個人情報に配慮し、フォロータスクに変換。' },
                { tag: '新機能', tagVariant: 'amber' as const, title: '求人票を貼るだけ', desc: '登録企業以外の求人も、テキストを貼れば曖昧表現を即チェック。' },
              ].map((f) => (
                <Card key={f.title} style={{ padding: 20 }}>
                  <Chip variant={f.tagVariant}>{f.tag}</Chip>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#141922', margin: '10px 0 6px' }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: '#626b78', lineHeight: 1.6 }}>{f.desc}</div>
                </Card>
              ))}
            </div>
          </div>

          {/* Right: Preview card */}
          <Card style={{ padding: '28px 28px 24px' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#141922', marginBottom: 12 }}>
              ミスマッチ診断プレビュー
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <Chip variant="teal">6軸診断</Chip>
              <Chip variant="blue">質問生成</Chip>
              <Chip variant="amber">フォロー計画</Chip>
            </div>

            <ScoreBar label="仕事内容" score={82} />
            <ScoreBar label="働き方" score={58} />
            <ScoreBar label="条件・制度" score={74} />
            <ScoreBar label="文化・価値観" score={41} />
            <ScoreBar label="成長・キャリア" score={65} />
            <ScoreBar label="不安・未確認点" score={48} />

            <div style={{
              background: '#ffe8e8',
              borderRadius: 8,
              padding: '16px 20px',
              marginTop: 8,
            }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#d12e33', marginBottom: 6 }}>確認すべきズレ</div>
              <div style={{ fontSize: 14, color: '#141922', lineHeight: 1.6 }}>
                OJT期待と自走文化に差分。<br />面談で育成体制を確認。
              </div>
            </div>
          </Card>
        </div>

        {/* UX Flow */}
        <div style={{ marginTop: 80 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#141922', marginBottom: 8 }}>UX全体像</h2>
          <p style={{ fontSize: 15, color: '#626b78', marginBottom: 40 }}>
            候補者と企業担当者の2つの入口から、AIエージェントが企業実態・候補者希望・ミスマッチ・フォロー計画を生成する。
          </p>

          {[
            {
              role: '候補者',
              steps: ['診断開始', '希望入力', '診断レポート', '確認質問', '意思決定'],
              color: '#00847f',
            },
            {
              role: '企業担当者',
              steps: ['求人入力', '現場実態', '不安サマリー', 'フォロー承認', '広報改善'],
              color: '#2863db',
            },
            {
              role: 'AIエージェント',
              steps: ['CandidateAgent', 'CompanyAgent', 'MismatchAgent', 'QuestionAgent', 'FollowUpAgent'],
              color: '#7c3aed',
            },
          ].map(({ role, steps, color }) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 100, fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>{role}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
                {steps.map((step, i) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                    <Card style={{ padding: '10px 16px', borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#141922', whiteSpace: 'nowrap' }}>{step}</div>
                    </Card>
                    {i < steps.length - 1 && (
                      <div style={{ width: 32, height: 1, background: '#d2dae5', flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
