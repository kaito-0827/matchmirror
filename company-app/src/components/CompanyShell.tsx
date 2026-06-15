import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const NAV = [
  {
    section: '設定',
    items: [{ label: '企業実態を登録', path: '/register', icon: '📋' }],
  },
  {
    section: '候補者管理',
    items: [
      { label: 'ダッシュボード', path: '/', icon: '📊' },
      { label: 'フォロー計画', path: '/followup', icon: '📅' },
    ],
  },
]

function isActive(pathname: string, path: string) {
  if (path === '/') return pathname === '/'
  return pathname.startsWith(path)
}

export default function CompanyShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const { firebaseEnabled, email, signOut } = useAuth()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', 'Noto Sans JP', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: '#1a2233',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
      }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', marginBottom: 8 }}>
            <div style={{
              width: 28, height: 28, background: '#00847f', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2"/>
                <path d="M4 7h6M7 4v6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
              MatchMirror
            </span>
          </Link>
          <div style={{
            padding: '4px 8px',
            background: 'rgba(0,132,127,0.25)',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 700,
            color: '#5ecdca',
            display: 'inline-block',
          }}>
            企業担当者ポータル
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV.map(({ section, items }) => (
            <div key={section} style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 8px',
                marginBottom: 4,
              }}>
                {section}
              </div>
              {items.map(({ label, path, icon }) => {
                const active = isActive(pathname, path)
                return (
                  <Link
                    key={path}
                    to={path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: active ? 'rgba(0,132,127,0.2)' : 'transparent',
                      color: active ? '#5ecdca' : 'rgba(255,255,255,0.6)',
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      textDecoration: 'none',
                      transition: 'background 0.15s',
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{icon}</span>
                    {label}
                    {active && (
                      <div style={{
                        marginLeft: 'auto',
                        width: 4, height: 4,
                        borderRadius: '50%',
                        background: '#5ecdca',
                      }} />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
        }}>
          候補者の個人情報は<br />カテゴリとして抽象化表示
        </div>
      </aside>

      {/* Main content */}
      <div style={{ marginLeft: 220, flex: 1, background: '#eef1f4', minHeight: '100vh' }}>
        {/* Top bar */}
        <div style={{
          background: '#fff',
          borderBottom: '1px solid #d2dae5',
          padding: '0 32px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <div style={{ fontSize: 13, color: '#626b78' }}>求人ID：job-001</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {firebaseEnabled && email && (
              <span style={{ fontSize: 12, color: '#626b78', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </span>
            )}
            <div style={{
              padding: '4px 12px',
              background: '#f7f9fc',
              border: '1px solid #d2dae5',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: '#626b78',
            }}>
              人事担当者
            </div>
            {firebaseEnabled && (
              <button
                onClick={() => signOut()}
                style={{
                  padding: '4px 12px', background: '#fff', border: '1px solid #d2dae5',
                  borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#626b78',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ログアウト
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '32px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
