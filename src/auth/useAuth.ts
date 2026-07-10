import { createContext, useContext } from 'react'

export type Role = 'candidate' | 'company'

export interface RegisterOpts {
  displayName?: string
  companyName?: string
  companyInfo?: { industry?: string; size_band?: string; region?: string; contact_email?: string }
}

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
  signUpEmail: (email: string, password: string, role: Role, opts: RegisterOpts) => Promise<void>
  signInGoogle: () => Promise<void>
  completeRole: (role: Role, opts: RegisterOpts) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
