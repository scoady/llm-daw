import { useCallback, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface KnobProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  color?: string
  bipolar?: boolean
  className?: string
}

const SIZES = { sm: 24, md: 32, lg: 40 }
const ARC_START = 225   // degrees, 7 o'clock
const ARC_END = -45     // degrees, 5 o'clock
const ARC_RANGE = 270   // total sweep

function polarToCartesian(cx: number, cy: number, r: number, degrees: number) {
  const rad = ((degrees - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

export function Knob({
  value,
  onChange,
  min = 0,
  max = 1,
  size = 'md',
  label,
  color = '#6c63ff',
  bipolar = false,
  className,
}: KnobProps) {
  const px = SIZES[size]
  const half = px / 2
  const arcRadius = half - 3
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ y: 0, value: 0 })

  // Normalize value to 0-1 range
  const normalized = (value - min) / (max - min)

  // Value angle in degrees
  const valueAngle = ARC_START - normalized * ARC_RANGE

  // Indicator rotation (CSS transform)
  const indicatorRotation = -ARC_START + normalized * ARC_RANGE

  // Build SVG arc path for the value indicator
  const buildValueArc = () => {
    if (bipolar) {
      const centerNorm = 0.5
      const centerAngle = ARC_START - centerNorm * ARC_RANGE
      if (normalized >= centerNorm) {
        return describeArc(half, half, arcRadius, valueAngle, centerAngle)
      } else {
        return describeArc(half, half, arcRadius, centerAngle, valueAngle)
      }
    }
    return describeArc(half, half, arcRadius, valueAngle, ARC_START)
  }

  // Background arc (full sweep, dim)
  const bgArc = describeArc(half, half, arcRadius, ARC_END, ARC_START)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { y: e.clientY, value }

    const handleMouseMove = (e: MouseEvent) => {
      const delta = (dragStartRef.current.y - e.clientY) / 150
      const range = max - min
      const newValue = Math.max(min, Math.min(max, dragStartRef.current.value + delta * range))
      onChange(Math.round(newValue * 100) / 100)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }, [value, min, max, onChange])

  const handleDoubleClick = useCallback(() => {
    onChange(bipolar ? (min + max) / 2 : min)
  }, [bipolar, min, max, onChange])

  return (
    <div className={clsx('flex flex-col items-center gap-0.5', className)}>
      <div
        className="relative cursor-pointer"
        style={{ width: px, height: px }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* SVG arc indicator */}
        <svg
          viewBox={`0 0 ${px} ${px}`}
          className="absolute inset-0"
          style={{ width: px, height: px }}
        >
          {/* Background arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Value arc */}
          {normalized !== (bipolar ? 0.5 : 0) && (
            <path
              d={buildValueArc()}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 3px ${color})`,
              }}
            />
          )}
          {/* Center dot for bipolar */}
          {bipolar && (
            <circle
              cx={polarToCartesian(half, half, arcRadius, ARC_START - 0.5 * ARC_RANGE).x}
              cy={polarToCartesian(half, half, arcRadius, ARC_START - 0.5 * ARC_RANGE).y}
              r={1.5}
              fill="rgba(255,255,255,0.3)"
            />
          )}
        </svg>

        {/* Knob body */}
        <div
          className="knob-body absolute"
          style={{
            top: 4,
            left: 4,
            width: px - 8,
            height: px - 8,
            borderColor: isDragging ? 'rgba(255,255,255,0.12)' : undefined,
          }}
        >
          {/* Indicator line */}
          <div
            className="knob-indicator"
            style={{
              transformOrigin: `center ${(px - 8) / 2 - 3}px`,
              transform: `rotate(${indicatorRotation}deg)`,
            }}
          />
        </div>
      </div>

      {label && (
        <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">
          {label}
        </span>
      )}
    </div>
  )
}
