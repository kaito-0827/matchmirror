import { useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Card from '../components/Card'
import Button from '../components/Button'
import Chip from '../components/Chip'

const AXES = ['仕事内容', '働き方', '条件・制度', '文化・価値観', '成長・キャリア', '不安・未確認点']

export default function CandidateStart() {
  const navigate = useNavigate()

  return (
    <AppShell activeStep="候補者診断">
      <div style={{ padding: '40px 48px', maxWidth: 900 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#141922', marginBottom: 8 }}>相性診断を開始</h1>
        <p style={{ fontSize: 15, color: '#626b78', marginBottom: 32 }}>
          チャット診断、6軸レポート、確認質問を連続した体験にし、入社前に自分で判断できるようにする。
        </p>

        {/* Company info */}
        <Card style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#626b78', marginBottom: 4 }}>診断対象</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#141922' }}>
                株式会社サンプル / AIソリューション企画
              </div>
            </div>
            <Chip variant="amber">未入力</Chip>
          </div>
          <div style={{
            padding: '12px 16px',
            background: '#f7f9fc',
            borderRadius: 8,
            fontSize: 13,
            color: '#626b78',
          }}>
            企業実態がまだ登録されていません。人事担当者に依頼するか、企業実態を先に入力してください。
          </div>
        </Card>

        {/* Priority axes */}
        <Card style={{ padding: 24, marginBottom: 32 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#141922', marginBottom: 16 }}>
            あなたの重視条件
          </div>
          <div style={{ fontSize: 13, color: '#626b78', marginBottom: 12 }}>
            診断で確認する6軸：重要と思う項目を選んでください
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AXES.map((axis, i) => (
              <AxisChip key={axis} label={axis} defaultSelected={i < 3} />
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <Button onClick={() => navigate('/candidate/chat')} style={{ padding: '12px 28px' }}>
            診断を開始
          </Button>
          <Button variant="secondary" onClick={() => navigate('/company')} style={{ padding: '12px 28px' }}>
            企業実態を見る
          </Button>
        </div>
      </div>
    </AppShell>
  )
}

function AxisChip({ label, defaultSelected }: { label: string; defaultSelected: boolean }) {
  return (
    <div style={{
      padding: '6px 16px',
      borderRadius: 15,
      fontSize: 13,
      fontWeight: 600,
      background: defaultSelected ? '#ddf7f4' : '#f7f9fc',
      color: defaultSelected ? '#00847f' : '#626b78',
      border: `1px solid ${defaultSelected ? '#ddf7f4' : '#d2dae5'}`,
      cursor: 'pointer',
    }}>
      {label}
    </div>
  )
}
