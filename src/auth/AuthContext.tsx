import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider, firebaseEnabled } from '../firebase'
import { api, setAuthHeaderProvider } from '../api/client'

export type Role = 'candidate' | 'company'

export interface AuthState {
  ready: boolean
  firebaseEnabled: boolean
  signedIn: boolean
  uid: string // サインイン時=Firebase uid / ゲスト時=guest-xxxx
  role: Role | null
  companyId: string
  email: string | null
  displayName: string | null
  needsRole: boolean // Google初回などアカウント未作成でロール選択待ち
  authError: string | null // サインイン後のアカウント解決などで起きた非同期エラー
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string, role: Role, opts: { displayName?: string; companyName?: string }) => Promise<void>
  signInGoogle: () => Promise<void>
  completeRole: (role: Role, opts: { displayName?: string; companyName?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// ゲスト識別子（localStorage永続）。診断データを匿名で紐づけるために使う。
function getGuestId(): string {
  let id = localStorage.getItem('mm_guest_id')
  if (!id) {
    id = 'guest-' + (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now())
    localStorage.setItem('mm_guest_id', id)
  }
  return id
}

// signUpEmail中はonAuthStateChangedの自動ensureを抑止する（二重登録/role未確定の競合回避）
let suppressEnsure = false

async function claimGuestData() {
  try {
    await api.claimGuest(getGuestId())
  } catch {
    /* ゲストデータが無ければ何もしない */
  }
}

// 認証ヘッダプロバイダはモジュール読み込み時に登録する。
// （AuthProviderのeffectで登録すると、子ページのmount時fetchが先に走り
//  ヘッダ未設定のままリクエストされて主体がdemo-userになる競合があるため）
setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
  if (firebaseEnabled && auth?.currentUser) {
    const token = await auth.currentUser.getIdToken()
    return { Authorization: `Bearer ${token}` }
  }
  return { 'X-Dev-Uid': getGuestId() }
})

export function AuthProvider({ children }: { children: ReactNode }) {
  // Firebase未設定ならゲストとして即座にready（effect内の同期setStateを避ける）
  const [ready, setReady] = useState(!firebaseEnabled || !auth)
  const [uid, setUid] = useState<string>(getGuestId())
  const [role, setRole] = useState<Role | null>(null)
  const [companyId, setCompanyId] = useState<string>('')
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [signedIn, setSignedIn] = useState(false)
  const [needsRole, setNeedsRole] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // 既存アカウント解決 or ロール選択待ちへ
  async function ensureAccount() {
    setAuthError(null)
    try {
      const me = await api.getMe()
      setRole(me.account.role as Role)
      setCompanyId(me.account.company_id || '')
      setNeedsRole(false)
      await claimGuestData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.startsWith('404')) {
        setNeedsRole(true) // 新規ユーザー → ロール選択UIへ
      } else {
        // 401/500/ネットワーク等。無言で止めずエラーを表示する
        console.error('ensureAccount failed:', msg)
        setAuthError('ログイン情報の確認に失敗しました。サーバーのFirebase認証設定（GOOGLE_CLOUD_PROJECT等）をご確認ください。')
      }
    }
  }

  // 認証状態の監視
  useEffect(() => {
    if (!firebaseEnabled || !auth) return // ready は初期値で true
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setSignedIn(true)
        setUid(u.uid)
        setEmail(u.email)
        setDisplayName(u.displayName)
        if (!suppressEnsure) await ensureAccount()
      } else {
        setSignedIn(false)
        setUid(getGuestId())
        setRole(null)
        setCompanyId('')
        setEmail(null)
        setDisplayName(null)
        setNeedsRole(false)
        setAuthError(null)
      }
      setReady(true)
    })
    return unsub
  }, [])

  async function registerByRole(role: Role, opts: { displayName?: string; companyName?: string }) {
    if (role === 'candidate') {
      const me = await api.registerCandidate({ display_name: opts.displayName || (email?.split('@')[0] ?? 'ユーザー') })
      setRole('candidate')
      setCompanyId(me.account.company_id || '')
    } else {
      const me = await api.registerCompany({ name: opts.companyName || opts.displayName || (email?.split('@')[0] ?? '新しい会社'), contact_email: email || undefined })
      setRole('company')
      setCompanyId(me.account.company_id || '')
    }
    setNeedsRole(false)
    await claimGuestData()
  }

  const signInEmail = async (em: string, pw: string) => {
    await signInWithEmailAndPassword(auth!, em, pw)
  }

  const signUpEmail = async (em: string, pw: string, r: Role, opts: { displayName?: string; companyName?: string }) => {
    suppressEnsure = true
    try {
      const cred = await createUserWithEmailAndPassword(auth!, em, pw)
      if (opts.displayName) await updateProfile(cred.user, { displayName: opts.displayName })
      setEmail(cred.user.email)
      await registerByRole(r, opts)
    } finally {
      suppressEnsure = false
    }
  }

  const signInGoogle = async () => {
    await signInWithPopup(auth!, googleProvider)
  }

  const completeRole = async (r: Role, opts: { displayName?: string; companyName?: string }) => {
    await registerByRole(r, opts)
  }

  const signOut = async () => {
    if (auth) await fbSignOut(auth)
  }

  const value: AuthState = {
    ready,
    firebaseEnabled,
    signedIn,
    uid,
    role,
    companyId,
    email,
    displayName,
    needsRole,
    authError,
    signInEmail,
    signUpEmail,
    signInGoogle,
    completeRole,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
