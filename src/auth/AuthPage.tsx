import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, type Role } from './AuthContext'

export default function AuthPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { signInEmail, signUpEmail, signInGoogle, completeRole, signedIn, role, needsRole, firebaseEnabled } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>(params.get('mode') === 'signup' ? 'signup' : 'login')
  const [pickedRole, setPickedRole] = useState<Role>((params.get('role') as Role) || 'candidate')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const next = params.get('next')

  // サインイン完了（ロール確定済み）したら遷移
  useEffect(() => {
    if (signedIn && !needsRole && role) {
      navigate(next || (role === 'company' ? '/company' : '/my'), { replace: true })
    }
  }, [signedIn, needsRole, role, next, navigate])

  if (!firebaseEnabled) {
    return (
      <Centered>
        <div style={{ fontSize: 15, color: '#141922', fontWeight: 700, marginBottom: 8 }}>ログインは現在無効です</div>
        <div style={{ fontSize: 13, color: '#626b78', marginBottom: 20 }}>
          Firebase未設定のため、診断はゲストのままご利用ください（保存機能はログイン有効時のみ）。
        </div>
        <PrimaryButton onClick={() => navigate('/')}>トップへ戻る</PrimaryButton>
      </Centered>
    )
  }

  // Google初回などロール未確定 → ロール選択
  if (needsRole) {
    const submitRole = async () => {
      setError(null); setBusy(true)
      try {
        await completeRole(pickedRole, { displayName, companyName })
      } catch (e) { setError(translateError(e)) } finally { setBusy(false) }
    }
    return (
      <Centered>
        <Brand />
        <h1 style={h1Style}>アカウントの種類を選択</h1>
        <p style={pStyle}>利用目的に合わせて選んでください。</p>
        <RoleToggle role={pickedRole} setRole={setPickedRole} />
        {pickedRole === 'company' && (
          <Field label="会社名">
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="株式会社サンプル" style={inputStyle} />
          </Field>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
        <PrimaryButton onClick={submitRole} disabled={busy}>{busy ? '処理中...' : 'この種類で続ける'}</PrimaryButton>
      </Centered>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true)
    try {
      if (mode === 'login') await signInEmail(email, password)
      else await signUpEmail(email, password, pickedRole, { displayName, companyName })
    } catch (err) { setError(translateError(err)) } finally { setBusy(false) }
  }

  const google = async () => {
    setError(null); setBusy(true)
    try { await signInGoogle() } catch (err) { setError(translateError(err)) } finally { setBusy(false) }
  }

  return (
    <Centered>
      <Brand />
      <h1 style={h1Style}>{mode === 'login' ? 'ログイン' : '新規登録'}</h1>
      <p style={pStyle}>診断結果を保存して、いつでも見返せます。</p>

      {mode === 'signup' && <RoleToggle role={pickedRole} setRole={setPickedRole} />}

      <form onSubmit={submit}>
        {mode === 'signup' && pickedRole === 'company' && (
          <Field label="会社名">
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="株式会社サンプル" style={inputStyle} />
          </Field>
        )}
        {mode === 'signup' && (
          <Field label={pickedRole === 'company' ? '担当者名' : '表示名'}>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="山田 太郎" style={inputStyle} />
          </Field>
        )}
        <Field label="メールアドレス">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
        </Field>
        <Field label="パスワード">
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="6文字以上" style={inputStyle} />
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <PrimaryButton type="submit" disabled={busy}>
          {busy ? '処理中...' : mode === 'login' ? 'ログイン' : '登録する'}
        </PrimaryButton>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#e7ebf2' }} />
        <span style={{ fontSize: 12, color: '#9aa3af' }}>または</span>
        <div style={{ flex: 1, height: 1, background: '#e7ebf2' }} />
      </div>

      <button onClick={google} disabled={busy} style={googleBtn}>
        <GoogleIcon />Googleで{mode === 'login' ? 'ログイン' : '登録'}
      </button>

      <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#626b78' }}>
        {mode === 'login' ? 'アカウントをお持ちでない方は' : 'すでにアカウントをお持ちの方は'}
        <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
          style={{ background: 'none', border: 'none', color: '#00847f', fontWeight: 700, cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>
          {mode === 'login' ? '新規登録' : 'ログイン'}
        </button>
      </div>
    </Centered>
  )
}

function RoleToggle({ role, setRole }: { role: Role; setRole: (r: Role) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {([['candidate', '就活者'], ['company', '企業']] as const).map(([val, label]) => (
        <button key={val} type="button" onClick={() => setRole(val)}
          style={{
            flex: 1, padding: '10px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            border: `2px solid ${role === val ? '#00847f' : '#d2dae5'}`,
            background: role === val ? '#ddf7f4' : '#fff',
            color: role === val ? '#00847f' : '#626b78',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#eef1f4', fontFamily: "'Inter', 'Noto Sans JP', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, border: '1px solid #d2dae5', padding: 32, boxShadow: '0 4px 24px rgba(20,25,34,0.06)' }}>
        {children}
      </div>
    </div>
  )
}

function Brand() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 28, height: 28, background: '#00847f', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="2" />
          <path d="M4 7h6M7 4v6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <span style={{ fontSize: 17, fontWeight: 800, color: '#141922' }}>MatchMirror</span>
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

function ErrorBox({ children }: { children: ReactNode }) {
  return <div style={{ background: '#ffe8e8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#d12e33', marginBottom: 16 }}>{children}</div>
}

function PrimaryButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} style={{
      width: '100%', padding: '12px', background: rest.disabled ? '#7fc0bd' : '#00847f', color: '#fff',
      border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: rest.disabled ? 'default' : 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  )
}

const h1Style: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: '#141922', margin: '12px 0 4px' }
const pStyle: React.CSSProperties = { fontSize: 13, color: '#626b78', marginBottom: 20 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #d2dae5', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#141922', boxSizing: 'border-box',
}
const googleBtn: React.CSSProperties = {
  width: '100%', padding: '11px', background: '#fff', color: '#141922', border: '1px solid #d2dae5',
  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
    'auth/operation-not-allowed': 'このログイン方法は管理画面で有効化されていません。',
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
