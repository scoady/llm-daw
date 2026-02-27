import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface VUMeterProps {
  level: number
  peak?: number
  segments?: number
  orientation?: 'vertical' | 'horizontal'
  width?: number
  height?: number
  className?: string
}

function getSegmentColor(index: number, total: number): string {
  const ratio = index / total
  if (ratio < 0.6) return 'vu-green'
  if (ratio < 0.85) return 'vu-yellow'
  if (ratio < 0.95) return 'vu-orange'
  return 'vu-red'
}

export function VUMeter({
  level,
  peak,
  segments = 12,
  orientation = 'vertical',
  width,
  height,
  className,
}: VUMeterProps) {
  const [peakHold, setPeakHold] = useState(0)
  const peakDecayRef = useRef<number>(0)

  // Peak hold with decay
  useEffect(() => {
    const effectivePeak = peak ?? level
    if (effectivePeak > peakHold) {
      setPeakHold(effectivePeak)
      peakDecayRef.current = Date.now()
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - peakDecayRef.current
      if (elapsed > 1200) {
        setPeakHold((prev) => Math.max(0, prev - 0.02))
      }
    }, 50)

    return () => clearInterval(interval)
  }, [level, peak, peakHold])

  const isVertical = orientation === 'vertical'
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isVertical ? 'column-reverse' : 'row',
    gap: '1px',
    width: width ?? (isVertical ? 4 : undefined),
    height: height ?? (isVertical ? 80 : 4),
  }

  const activeSegments = Math.round(level * segments)
  const peakSegment = Math.min(segments - 1, Math.round(peakHold * segments))

  return (
    <div className={clsx('flex-shrink-0', className)} style={containerStyle}>
      {Array.from({ length: segments }).map((_, i) => {
        const isOn = i < activeSegments
        const isPeak = i === peakSegment && peakHold > 0 && !isOn
        const colorClass = getSegmentColor(i, segments)

        return (
          <div
            key={i}
            className={clsx(
              'vu-segment',
              colorClass,
              isOn ? 'vu-segment-on' : isPeak ? 'vu-segment-on vu-peak' : 'vu-segment-off'
            )}
            style={{
              height: isVertical ? `${100 / segments}%` : '100%',
              width: isVertical ? '100%' : `${100 / segments}%`,
            }}
          />
        )
      })}
    </div>
  )
}

// Simulated idle meter — provides a gently bouncing level value
export function useSimulatedLevel(baseLevel = 0.15, variance = 0.1): number {
  const [level, setLevel] = useState(baseLevel)

  useEffect(() => {
    let frame: number
    const update = () => {
      setLevel(
        Math.max(0, Math.min(1,
          baseLevel + (Math.random() - 0.5) * variance + Math.sin(Date.now() / 800) * variance * 0.3
        ))
      )
      frame = requestAnimationFrame(update)
    }
    // Throttle to ~15fps for idle animation
    const interval = setInterval(() => {
      frame = requestAnimationFrame(update)
    }, 66)
    return () => {
      clearInterval(interval)
      cancelAnimationFrame(frame)
    }
  }, [baseLevel, variance])

  return level
}
