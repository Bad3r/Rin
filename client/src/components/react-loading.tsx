import type { CSSProperties } from 'react'

interface ReactLoadingProps {
  type?: string
  color?: string
  width?: number | string
  height?: number | string
}

function toSize(value: number | string | undefined, fallback: string): string {
  if (typeof value === 'number') {
    return `${value}px`
  }

  if (typeof value === 'string' && value.length > 0) {
    return value
  }

  return fallback
}

export default function ReactLoading({ type = 'spin', color = '#FC466B', width, height }: ReactLoadingProps) {
  const resolvedWidth = toSize(width, '2rem')
  const resolvedHeight = toSize(height, resolvedWidth)

  if (type === 'cylon') {
    const containerStyle: CSSProperties = {
      width: resolvedWidth,
      height: resolvedHeight,
    }

    const dotStyle: CSSProperties = {
      backgroundColor: color,
    }

    return (
      <div className='inline-flex items-center justify-center gap-1' style={containerStyle} aria-hidden='true'>
        <span className='h-2 w-2 rounded-full animate-pulse' style={dotStyle} />
        <span className='h-2 w-2 rounded-full animate-pulse [animation-delay:150ms]' style={dotStyle} />
        <span className='h-2 w-2 rounded-full animate-pulse [animation-delay:300ms]' style={dotStyle} />
      </div>
    )
  }

  const spinnerStyle: CSSProperties = {
    color,
    width: resolvedWidth,
    height: resolvedHeight,
    borderWidth: '2px',
  }

  return (
    <span
      className='inline-block animate-spin rounded-full border-current border-solid border-r-transparent'
      style={spinnerStyle}
      aria-hidden='true'
    />
  )
}
