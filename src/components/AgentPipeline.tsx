import { useEffect, useState } from 'react'
import Card from './Card'
import type { AgentProgressStep } from '../api/types'

interface Props {
  steps: AgentProgressStep[]
  title?: string
}

const ACCENT = '#00847f'
const TEXT = '#141922'
const SUBTEXT = '#626b78'
const BORDER = '#d2dae5'

function useElapsedSeconds(startedAt: string | null, active: boolean): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active || !startedAt) return
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startedAt, active])

  // active/startedAtが無効な間は0を表示する（次にrunningへ遷移した際は
  // 上のエフェクトが新しいstartedAtで即座にelapsedを更新する）。
  return active && startedAt ? elapsed : 0
}

function StepCard({ step, parallel }: { step: AgentProgressStep; parallel: boolean }) {
  const isRunning = step.status === 'running'
  const elapsed = useElapsedSeconds(step.started_at, isRunning)

  const statusStyles: Record<AgentProgressStep['status'], { border: string; bg: string; badge: string; badgeBg: string }> = {
    waiting: { border: '#e7ebf2', bg: '#fafbfc', badge: SUBTEXT, badgeBg: '#eef1f4' },
    running: { border: ACCENT, bg: '#f0faf9', badge: '#fff', badgeBg: ACCENT },
    done: { border: '#a9e5df', bg: '#fff', badge: ACCENT, badgeBg: '#ddf7f4' },
    failed: { border: '#f3b8ba', bg: '#fff5f5', badge: '#fff', badgeBg: '#d12e33' },
  }
  const s = statusStyles[step.status]

  return (
    <Card
      style={{
        padding: '16px 18px',
        border: `1.5px solid ${s.border}`,
        background: s.bg,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s, background 0.3s',
      }}
    >
      {isRunning && (
        <style>{`
          @keyframes agentPulse {
            0% { opacity: 0.35; }
            50% { opacity: 1; }
            100% { opacity: 0.35; }
          }
          @keyframes agentSpin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      )}

      {/* ステータスアイコン */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: s.badgeBg,
          color: s.badge,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {step.status === 'done' && '✓'}
        {step.status === 'failed' && '✕'}
        {step.status === 'waiting' && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: SUBTEXT, opacity: 0.4 }} />
        )}
        {step.status === 'running' && (
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.5)',
              borderTopColor: '#fff',
              animation: 'agentSpin 0.8s linear infinite',
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: step.status === 'waiting' ? SUBTEXT : ACCENT,
              animation: isRunning ? 'agentPulse 1.6s ease-in-out infinite' : undefined,
            }}
          >
            {step.agent}
          </span>
          {parallel && (step.status === 'running') && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#7c3aed',
                background: '#f1eaff',
                borderRadius: 10,
                padding: '2px 8px',
              }}
            >
              並列実行中
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{step.label}</div>
      </div>

      {isRunning && (
        <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {elapsed}秒
        </div>
      )}
      {step.status === 'failed' && (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#d12e33', flexShrink: 0 }}>
          失敗
        </div>
      )}
    </Card>
  )
}

export default function AgentPipeline({ steps, title }: Props) {
  if (steps.length === 0) {
    return (
      <Card style={{ padding: '20px 22px', border: `1px solid ${BORDER}`, background: '#fafbfc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: `2px solid ${BORDER}`,
              borderTopColor: ACCENT,
              animation: 'agentSpin 0.8s linear infinite',
            }}
          />
          <style>{`@keyframes agentSpin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>エージェント起動中...</span>
        </div>
      </Card>
    )
  }

  // running状態のstepが2つ以上あれば並列実行とみなす
  const runningCount = steps.filter((s) => s.status === 'running').length
  const isParallel = runningCount >= 2

  return (
    <div>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, color: SUBTEXT, marginBottom: 10 }}>{title}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {steps.map((step) => (
          <StepCard key={step.id} step={step} parallel={isParallel} />
        ))}
      </div>
    </div>
  )
}
