import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'

// Firebase設定は環境変数(VITE_FIREBASE_*)から読む。
// 未設定の場合は firebaseEnabled=false となり、アプリは従来どおり
// デモ識別子(demo-user)で動作する（ログイン画面は出ない）。
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseEnabled = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | undefined
let authInstance: Auth | undefined

if (firebaseEnabled) {
  app = initializeApp(config as Record<string, string>)
  authInstance = getAuth(app)
}

export const auth = authInstance
export const googleProvider = new GoogleAuthProvider()
