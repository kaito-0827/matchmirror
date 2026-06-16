import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type Step = { label: string; path: string }

const CANDIDATE_STEPS: Step[] = [
  { label: '候補者診断', path: '/candidate' },
  { label: '企業実態', path: '/company' },
  { label: 'レポート', path: '/candidate/report' },
  { label: 'フォロー計画', path: '/company/followup' },
]

interface Props {
  children: ReactNode
  activeStep?: string
}

const accountLinkStyle: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left', padding: '6px 0',
  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 13, fontWeight: 600, color: '#00847f',
}

export default function AppShell({ children, activeStep }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { firebaseEnabled, signedIn, email, role, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#eef1f4' }}>
      {/* Sidebar */}
      <aside style={{
        width: 200,
        background: '#fff',
        borderRight: '1px solid #d2dae5',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        {/* Logo */}
        <div
          style={{ padding: '20px 24px 16px', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          <div style={{
            display: 'inline-block',
            background: '#00847f',
            borderRadius: 6,
            width: 24,
            height: 24,
            marginBottom: 8,
          }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#141922' }}>MatchMirror</div>
        </div>

        <nav style={{ padding: '8px 0', flex: 1 }}>
          {CANDIDATE_STEPS.map((step) => {
            const isActive = activeStep
              ? step.label === activeStep
              : location.pathname === step.path
            return (
              <button
                key={step.path}
                onClick={() => navigate(step.path)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 24px',
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#141922' : '#626b78',
                  background: isActive ? '#ddf7f4' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 0,
                  transition: 'background 0.15s',
                }}
              >
                {step.label}
              </button>
            )
          })}
        </nav>

        {/* Account */}
        {firebaseEnabled && (
          <div style={{ borderTop: '1px solid #eef1f4', padding: '12px 16px' }}>
            {signedIn ? (
              <>
                <button onClick={() => navigate('/my')} style={accountLinkStyle}>マイレポート</button>
                <div style={{ fontSize: 11, color: '#9aa3af', margin: '8px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {role === 'company' ? '企業' : '就活者'}・{email}
                </div>
                <button onClick={() => signOut()} style={{ ...accountLinkStyle, color: '#626b78' }}>ログアウト</button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} style={{
                width: '100%', padding: '8px', background: '#00847f', color: '#fff', border: 'none',
                borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>ログイン / 新規登録</button>
            )}
          </div>
        )}
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
