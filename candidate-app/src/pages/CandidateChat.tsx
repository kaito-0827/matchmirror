import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CandidateShell from '../components/CandidateShell'
import Button from '../components/Button'
import Chip from '../components/Chip'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'

interface Message {
  role: 'ai' | 'user'
  text: string
}

export default function CandidateChat() {
  const navigate = useNavigate()
  const { uid } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [extractedSignals, setExtractedSignals] = useState<string[]>([])
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const existingSession = localStorage.getItem('mm_session_id')
      const firstQuestion = localStorage.getItem('mm_first_question')

      if (existingSession && existingSession !== 'offline' && firstQuestion) {
        setSessionId(existingSession)
        setMessages([{ role: 'ai', text: firstQuestion }])
        localStorage.removeItem('mm_first_question')
        setInitializing(false)
        return
      }

      try {
        const res = await api.createSession(uid || 'demo-user', 'job-001')
        setSessionId(res.session_id)
        localStorage.setItem('mm_session_id', res.session_id)
        setMessages([{ role: 'ai', text: res.first_question }])
      } catch {
        setSessionId('offline')
        setMessages([
          { role: 'ai', text: 'こんにちは！MatchMirrorの相性診断を始めます。' },
          { role: 'ai', text: '入社後に特に不安なことを教えてください。' },
        ])
      } finally {
        setInitializing(false)
      }
    }
    init()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string, overrideSessionId?: string) => {
    const activeSession = overrideSessionId ?? sessionId
    if (!text.trim() || loading || !activeSession) return
    const userMsg: Message = { role: 'user', text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.sendMessage(activeSession, text)
      setMessages(prev => [...prev, { role: 'ai', text: res.next_question }])
      setExtractedSignals(res.extracted_signals)
      setQuickReplies(res.quick_replies)
      setProgress(res.progress)
      if (res.is_complete) setIsComplete(true)
    } catch (err) {
      // セッションが消えていた場合（バックエンド再起動など）は新規セッションを作って再試行
      const is404 = err instanceof Error && err.message.startsWith('404')
      if (is404) {
        try {
          const newSession = await api.createSession(uid || 'demo-user', 'job-001')
          setSessionId(newSession.session_id)
          localStorage.setItem('mm_session_id', newSession.session_id)
          setMessages([{ role: 'ai', text: newSession.first_question }])
          setLoading(false)
          return
        } catch {
          // 再生成も失敗した場合はエラーメッセージ
        }
      }
      setMessages(prev => [...prev, { role: 'ai', text: 'すみません、エラーが発生しました。もう一度お試しください。' }])
    } finally {
      setLoading(false)
    }
  }

  const questionNum = Math.round((progress / 100) * 5) + 1

  return (
    <CandidateShell>
      <div style={{ display: 'flex', height: 'calc(100vh - 120px)', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          padding: '16px 32px',
          borderBottom: '1px solid #d2dae5',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <div style={{
            width: 24, height: 24, background: '#00847f', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2L7 12M2 7L12 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#141922', whiteSpace: 'nowrap' }}>AI診断チャット</span>
          <Chip variant="teal">CandidateAgent</Chip>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#626b78' }}>
            質問 {Math.min(questionNum, 5)} / 5
          </div>
          <div style={{
            width: 120, height: 6, background: '#e7ebf2', borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              width: isComplete ? '100%' : `${Math.min(progress + 20, 100)}%`,
              height: '100%',
              background: '#00847f',
              borderRadius: 3,
              transition: 'width 0.4s',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Left panel: extracted signals */}
          <aside style={{
            width: 200,
            borderRight: '1px solid #d2dae5',
            background: '#f8fafc',
            padding: '16px 12px',
            overflowY: 'auto',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#626b78', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              抽出された観点
            </div>
            {extractedSignals.length === 0 ? (
              <div style={{ fontSize: 12, color: '#d2dae5' }}>回答後に抽出されます</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {extractedSignals.map((s) => (
                  <div key={s} style={{
                    padding: '6px 10px',
                    background: '#ddf7f4',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#00847f',
                  }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </aside>

          {/* Chat area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
              {initializing && (
                <div style={{ fontSize: 14, color: '#626b78', textAlign: 'center', marginTop: 40 }}>
                  診断を準備中...
                </div>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  {msg.role === 'ai' && (
                    <div style={{
                      width: 28, height: 28, background: '#00847f', borderRadius: 6,
                      flexShrink: 0, marginRight: 10, marginTop: 2,
                    }} />
                  )}
                  <div style={{
                    maxWidth: '72%',
                    padding: '12px 16px',
                    borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    background: msg.role === 'user' ? '#00847f' : '#f7f9fc',
                    color: msg.role === 'user' ? '#fff' : '#141922',
                    fontSize: 14,
                    lineHeight: 1.6,
                    border: msg.role === 'ai' ? '1px solid #d2dae5' : 'none',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 28, height: 28, background: '#00847f', borderRadius: 6, flexShrink: 0,
                  }} />
                  <div style={{
                    padding: '12px 16px',
                    background: '#f7f9fc',
                    border: '1px solid #d2dae5',
                    borderRadius: '12px 12px 12px 4px',
                    display: 'flex',
                    gap: 4,
                    alignItems: 'center',
                  }}>
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: '#626b78',
                          animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick replies */}
            {quickReplies.length > 0 && !isComplete && (
              <div style={{ padding: '0 32px 12px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {quickReplies.map((r) => (
                  <button
                    key={r}
                    onClick={() => sendMessage(r)}
                    style={{
                      padding: '6px 14px',
                      background: '#f7f9fc',
                      border: '1px solid #d2dae5',
                      borderRadius: 15,
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#141922',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            {!isComplete && (
              <div style={{
                padding: '12px 32px',
                borderTop: '1px solid #d2dae5',
                background: '#fff',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-end',
                flexShrink: 0,
              }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="回答を入力してください..."
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid #d2dae5',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    color: '#141922',
                  }}
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading || !sessionId}
                  style={{ padding: '10px 20px', flexShrink: 0 }}
                >
                  送信
                </Button>
              </div>
            )}

            {/* Continue to report */}
            {(isComplete || extractedSignals.length > 0) && (
              <div style={{
                padding: '12px 32px',
                borderTop: '1px solid #d2dae5',
                background: '#f7f9fc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                alignItems: 'center',
              }}>
                {isComplete && (
                  <span style={{ fontSize: 13, color: '#00847f', fontWeight: 600 }}>
                    ✓ 診断が完了しました
                  </span>
                )}
                <Button onClick={() => navigate('/report')} style={{ padding: '10px 24px' }}>
                  診断レポートへ →
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </CandidateShell>
  )
}
