import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User as FbUser,
} from 'firebase/auth'
import { auth, googleProvider, firebaseEnabled } from '../firebase'
import { api, setAuthHeaderProvider } from '../api/client'

const ROLE = 'company'
const DEV_COMPANY_ID = 'company-001'

export interface AuthState {
  ready: boolean
  signedIn: boolean
  firebaseEnabled: boolean
  uid: string
  email: string | null
  displayName: string | null
  companyId: string
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string, displayName: string, companyName: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// メール新規登録時、フォームの会社名を登録処理へ橋渡しする
let pendingCompanyName: string | null = null

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [uid, setUid] = useState<string>(firebaseEnabled ? '' : 'company-demo')
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string>(firebaseEnabled ? '' : DEV_COMPANY_ID)

  async function ensureAccount(u: FbUser) {
    try {
      const me = await api.getMe()
      if (me.account.company_id) setCompanyId(me.account.company_id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg.startsWith('404')) {
        const name = pendingCompanyName || u.displayName || u.email?.split('@')[0] || '新しい会社'
        const res = await api.registerCompany({ name, contact_email: u.email || undefined })
        if (res.account.company_id) setCompanyId(res.account.company_id)
        pendingCompanyName = null
      }
    }
  }

  // 認証ヘッダプロバイダを登録
  useEffect(() => {
    if (firebaseEnabled && auth) {
      setAuthHeaderProvider(async (): Promise<Record<string, string>> => {
        const u = auth!.currentUser
        if (!u) return {}
        const token = await u.getIdToken()
        return { Authorization: `Bearer ${token}` }
      })
    } else {
      setAuthHeaderProvider(async (): Promise<Record<string, string>> => ({ 'X-Dev-Uid': 'company-demo', 'X-Dev-Role': ROLE }))
    }
    return () => setAuthHeaderProvider(null)
  }, [])

  // 認証状態の監視
  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setReady(true)
      return
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid)
        setEmail(u.email)
        setDisplayName(u.displayName)
        await ensureAccount(u)
      } else {
        setUid('')
        setEmail(null)
        setDisplayName(null)
        setCompanyId('')
      }
      setReady(true)
    })
    return unsub
  }, [])

  const signInEmail = async (em: string, pw: string) => {
    await signInWithEmailAndPassword(auth!, em, pw)
  }
  const signUpEmail = async (em: string, pw: string, dn: string, companyName: string) => {
    pendingCompanyName = companyName || dn || em.split('@')[0]
    const cred = await createUserWithEmailAndPassword(auth!, em, pw)
    if (dn) await updateProfile(cred.user, { displayName: dn })
    await ensureAccount(cred.user)
  }
  const signInGoogle = async () => {
    await signInWithPopup(auth!, googleProvider)
  }
  const signOut = async () => {
    if (auth) await fbSignOut(auth)
  }

  const signedIn = firebaseEnabled ? Boolean(uid) : true

  const value: AuthState = {
    ready,
    signedIn,
    firebaseEnabled,
    uid,
    email,
    displayName,
    companyId,
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
