import type { ReactNode, CSSProperties } from 'react'

interface Props {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}

export default function Card({ children, style, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #d2dae5',
        borderRadius: 12,
        ...style,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {children}
    </div>
  )
}
