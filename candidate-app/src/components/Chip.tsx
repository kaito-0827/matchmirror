import type { ReactNode } from 'react'

type Variant = 'teal' | 'blue' | 'amber' | 'purple' | 'gray' | 'danger'

const variantStyles: Record<Variant, { bg: string; color: string }> = {
  teal:   { bg: '#ddf7f4', color: '#00847f' },
  blue:   { bg: '#e9f0ff', color: '#2863db' },
  amber:  { bg: '#fff4db', color: '#dc8a14' },
  purple: { bg: '#f1eaff', color: '#7c3aed' },
  gray:   { bg: '#f7f9fc', color: '#626b78' },
  danger: { bg: '#ffe8e8', color: '#d12e33' },
}

interface Props {
  children: ReactNode
  variant?: Variant
  className?: string
}

export default function Chip({ children, variant = 'gray' }: Props) {
  const { bg, color } = variantStyles[variant]
  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 12px',
      borderRadius: 15,
      fontSize: 13,
      fontWeight: 600,
      background: bg,
      color,
    }}>
      {children}
    </span>
  )
}
