interface Props {
  label: string
  score: number
  color?: string
}

function getColor(score: number, override?: string): string {
  if (override) return override
  if (score >= 70) return '#00847f'
  if (score >= 50) return '#dc8a14'
  return '#d12e33'
}

function getTextColor(score: number, override?: string): string {
  if (override) return override
  if (score >= 70) return '#00847f'
  if (score >= 50) return '#dc8a14'
  return '#d12e33'
}

export default function ScoreBar({ label, score, color }: Props) {
  const barColor = getColor(score, color)
  const textColor = getTextColor(score, color)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 96, fontSize: 14, fontWeight: 600, color: '#141922', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 10, background: '#e7ebf2', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`,
          height: '100%',
          background: barColor,
          borderRadius: 5,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <div style={{ width: 44, fontSize: 14, fontWeight: 700, color: textColor, textAlign: 'right', flexShrink: 0 }}>
        {score}%
      </div>
    </div>
  )
}
