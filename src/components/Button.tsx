import type { ReactNode, CSSProperties } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props {
  children: ReactNode
  variant?: Variant
  onClick?: () => void
  disabled?: boolean
  style?: CSSProperties
  type?: 'button' | 'submit'
  fullWidth?: boolean
}

const styles: Record<Variant, CSSProperties> = {
  primary: {
    background: '#00847f',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: '#fff',
    color: '#141922',
    border: '1px solid #d2dae5',
  },
  ghost: {
    background: 'transparent',
    color: '#626b78',
    border: 'none',
  },
}

export default function Button({ children, variant = 'primary', onClick, disabled, style, type = 'button', fullWidth }: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '10px 20px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        width: fullWidth ? '100%' : undefined,
        transition: 'opacity 0.15s, background 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
