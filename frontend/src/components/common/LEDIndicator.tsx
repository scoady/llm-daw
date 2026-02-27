import { clsx } from 'clsx'

interface LEDIndicatorProps {
  on: boolean
  color?: 'green' | 'red' | 'amber' | 'blue' | 'cyan' | 'accent'
  size?: 'xs' | 'sm' | 'md'
  pulse?: boolean
  className?: string
}

export function LEDIndicator({
  on,
  color = 'green',
  size = 'sm',
  pulse = false,
  className,
}: LEDIndicatorProps) {
  return (
    <div
      className={clsx(
        'led',
        `led-${size}`,
        `led-${color}`,
        on ? 'led-on' : 'led-off',
        on && pulse && 'led-pulse',
        className
      )}
    />
  )
}
