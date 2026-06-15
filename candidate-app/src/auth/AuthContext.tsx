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

const ROLE = 'candidate'

export interface AuthState {
  ready: boolean
  signedIn: boolean
  firebaseEnabled: boolean
  uid: string
  email: string | null
  displayName: string | null
  signInEmail: (email: string, password: string) => Promise<void>
  signUpEmail: (email: string, password: string, displayName: string) => Promise<void>
  signInGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// メール新規登録時、フォームの表示名を登録処理へ橋渡しする
let pendingDisplayName: string | null = null

async function ensureAccount(u: FbUser) {
  try {
    await api.getMe()
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.startsWith('404')) {
      const name = pendingDisplayName || u.displayName || u.email?.split('@')[0] || 'ユーザー'
      await api.registerCandidate({ display_name: name })
      pendingDisplayName = null
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [uid, setUid] = useState<string>(firebaseEnabled ? '' : 'demo-user')
  const [email, setEmail] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

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
      setAuthHeaderProvider(async (): Promise<Record<string, string>> => ({ 'X-Dev-Uid': 'demo-user', 'X-Dev-Role': ROLE }))
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
      }
      setReady(true)
    })
    return unsub
  }, [])

  const signInEmail = async (em: string, pw: string) => {
    await signInWithEmailAndPassword(auth!, em, pw)
  }
  const signUpEmail = async (em: string, pw: string, dn: string) => {
    pendingDisplayName = dn || em.split('@')[0]
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
