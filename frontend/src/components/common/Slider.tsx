import { clsx } from 'clsx'

interface SliderProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  className?: string
  vertical?: boolean
  fillColor?: string
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  label,
  className,
  vertical = false,
  fillColor,
}: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100
  const defaultFill = fillColor ?? 'rgba(108, 99, 255, 0.6)'

  if (vertical) {
    return (
      <div className={clsx('flex flex-col items-center gap-0.5', className)}>
        {label && (
          <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">
            {label}
          </span>
        )}
        <div className="fader-track relative" style={{ width: 8, height: '100%' }}>
          {/* Fill */}
          <div
            className="fader-fill"
            style={{
              height: `${percent}%`,
              background: `linear-gradient(0deg, ${defaultFill} 0%, rgba(108,99,255,0.2) 100%)`,
            }}
          />
          {/* Thumb */}
          <div
            className="fader-thumb"
            style={{ bottom: `calc(${percent}% - 5px)` }}
          />
          {/* Invisible native input for interaction */}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-ns-resize"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
              width: '100%',
              height: '100%',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('flex flex-col gap-0.5', className)}>
      {label && (
        <span className="text-2xs text-text-muted uppercase tracking-wider font-medium">
          {label}
        </span>
      )}
      <div className="fader-track relative" style={{ height: 6, width: '100%', borderRadius: 3 }}>
        {/* Fill */}
        <div
          className="absolute top-0 left-0 bottom-0 rounded-l-[3px]"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${defaultFill} 0%, rgba(108,99,255,0.8) 100%)`,
            boxShadow: `0 0 6px ${defaultFill}`,
          }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left: `calc(${percent}% - 5px)`,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'linear-gradient(180deg, #5a5e70 0%, #3a3e50 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            zIndex: 2,
          }}
        />
        {/* Invisible native input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  )
}
