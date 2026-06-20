import { useLocation, Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const STEPS = [
  { label: '診断開始', path: '/' },
  { label: 'AIチャット', path: '/chat' },
  { label: 'レポート', path: '/report' },
  { label: '面談準備', path: '/questions' },
]

function getStepIndex(pathname: string) {
  if (pathname.startsWith('/questions')) return 3
  if (pathname.startsWith('/report')) return 2
  if (pathname.startsWith('/chat')) return 1
  return 0
}

export default function CandidateShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const activeIndex = getStepIndex(pathname)
  const { firebaseEnabled, email, signOut } = useAuth()

  return (
    <div style={{ minHeight: '100vh', background: '#eef1f4', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}>
      {/* Top nav */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #d2dae5',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: 32,
        }}>
          {/* Brand */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, background: '#00847f', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2"/>
                <path d="M4 7h6M7 4v6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#141922', letterSpacing: '-0.02em' }}>
              MatchMirror
            </span>
          </Link>

          {/* Step progress */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0 }}>
            {STEPS.map((step, i) => {
              const isActive = i === activeIndex
              const isDone = i < activeIndex
              const isLast = i === STEPS.length - 1

              return (
                <div key={step.path} style={{ display: 'flex', alignItems: 'center', flex: isLast ? 0 : 1 }}>
                  {/* Step */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: isDone ? '#00847f' : isActive ? '#00847f' : '#e7ebf2',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isDone ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fff' : '#626b78' }}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#00847f' : isDone ? '#626b78' : '#9aa3af',
                      whiteSpace: 'nowrap',
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {/* Connector */}
                  {!isLast && (
                    <div style={{
                      flex: 1,
                      height: 2,
                      background: isDone ? '#00847f' : '#e7ebf2',
                      margin: '0 8px',
                      minWidth: 16,
                    }} />
                  )}
                </div>
              )
            })}
          </div>

          {/* Secondary nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {[
              { to: '/matches', label: '合う企業' },
              { to: '/my', label: 'マイレポート' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#00847f' : '#626b78',
                  background: isActive ? '#ddf7f4' : 'transparent',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap' as const,
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Role badge + account */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              padding: '4px 10px',
              background: '#ddf7f4',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              color: '#00847f',
            }}>
              就活者
            </div>
            {firebaseEnabled && email && (
              <>
                <span style={{ fontSize: 12, color: '#626b78', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {email}
                </span>
                <button
                  onClick={() => signOut()}
                  style={{
                    padding: '4px 10px', background: '#fff', border: '1px solid #d2dae5',
                    borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#626b78',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  ログアウト
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>
    </div>
  )
}
