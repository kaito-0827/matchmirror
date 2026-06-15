import { useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

export default function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await signInEmail(email, password)
      } else {
        await signUpEmail(email, password, displayName, companyName)
      }
    } catch (err) {
      setError(translateError(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError(null)
    setBusy(true)
    try {
      await signInGoogle()
    } catch (err) {
      setError(translateError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#eef1f4',
      fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #d2dae5',
        padding: 32,
        boxShadow: '0 4px 24px rgba(20,25,34,0.06)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{
            width: 28, height: 28, background: '#00847f', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2" />
              <path d="M4 7h6M7 4v6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#141922' }}>MatchMirror</span>
          <span style={{
            marginLeft: 'auto', padding: '3px 10px', background: 'rgba(0,132,127,0.12)',
            borderRadius: 20, fontSize: 11, fontWeight: 700, color: '#00847f',
          }}>企業担当者</span>
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#141922', margin: '12px 0 4px' }}>
          {mode === 'login' ? 'ログイン' : '会社アカウント登録'}
        </h1>
        <p style={{ fontSize: 13, color: '#626b78', marginBottom: 20 }}>
          企業実態を登録し、候補者とのズレを可視化します。
        </p>

        <form onSubmit={submit}>
          {mode === 'signup' && (
            <>
              <Field label="会社名">
                <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                  required placeholder="株式会社サンプル" style={inputStyle} />
              </Field>
              <Field label="担当者名">
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="山田 太郎" style={inputStyle} />
              </Field>
            </>
          )}
          <Field label="メールアドレス">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="hr@example.com" style={inputStyle} />
          </Field>
          <Field label="パスワード">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="6文字以上" style={inputStyle} />
          </Field>

          {error && (
            <div style={{
              background: '#ffe8e8', borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#d12e33', marginBottom: 16,
            }}>{error}</div>
          )}

          <button type="submit" disabled={busy} style={primaryBtn(busy)}>
            {busy ? '処理中...' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e7ebf2' }} />
          <span style={{ fontSize: 12, color: '#9aa3af' }}>または</span>
          <div style={{ flex: 1, height: 1, background: '#e7ebf2' }} />
        </div>

        <button onClick={google} disabled={busy} style={googleBtn}>
          <GoogleIcon />
          Googleで{mode === 'login' ? 'ログイン' : '登録'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#626b78' }}>
          {mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
            style={{ background: 'none', border: 'none', color: '#00847f', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginLeft: 4 }}
          >
            {mode === 'login' ? '新規登録' : 'ログイン'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#141922', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #d2dae5', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#141922', boxSizing: 'border-box',
}
function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px', background: busy ? '#7fc0bd' : '#00847f', color: '#fff',
    border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
    fontFamily: 'inherit',
  }
}
const googleBtn: React.CSSProperties = {
  width: '100%', padding: '11px', background: '#fff', color: '#141922',
  border: '1px solid #d2dae5', borderRadius: 8, fontSize: 14, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

function translateError(err: unknown): string {
  const code = (err as { code?: string })?.code || ''
  const map: Record<string, string> = {
    'auth/invalid-email': 'メールアドレスの形式が正しくありません。',
    'auth/user-not-found': 'アカウントが見つかりません。',
    'auth/wrong-password': 'パスワードが正しくありません。',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません。',
    'auth/email-already-in-use': 'このメールアドレスは既に登録されています。',
    'auth/weak-password': 'パスワードは6文字以上にしてください。',
    'auth/popup-closed-by-user': 'ログインがキャンセルされました。',
    'auth/too-many-requests': '試行回数が多すぎます。しばらくしてからお試しください。',
  }
  if (code && map[code]) return map[code]
  return err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。'
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  )
}
