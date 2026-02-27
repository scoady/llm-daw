import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', active, children, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded transition-all cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        'active:scale-[0.97]',
        {
          // Default — hardware tactile
          [clsx(
            'border text-text-secondary hover:text-text-primary',
            '[background:linear-gradient(180deg,#1e2130_0%,#161921_100%)]',
            'hover:[background:linear-gradient(180deg,#272b3a_0%,#1e2130_100%)]',
            'border-[rgba(255,255,255,0.04)]',
            'hover:border-[rgba(255,255,255,0.06)]',
            'shadow-[0_1px_3px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.04)]',
            'active:shadow-button-inset',
          )]: variant === 'default',

          // Primary — accent glow
          [clsx(
            'text-white border',
            '[background:linear-gradient(180deg,#7c74ff_0%,#6c63ff_100%)]',
            'hover:[background:linear-gradient(180deg,#8c84ff_0%,#7c74ff_100%)]',
            'border-[rgba(108,99,255,0.5)]',
            'shadow-[0_0_16px_rgba(108,99,255,0.25),0_2px_4px_rgba(0,0,0,0.3)]',
            'active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.3),0_0_12px_rgba(108,99,255,0.2)]',
          )]: variant === 'primary',

          // Ghost
          [clsx(
            'bg-transparent hover:bg-surface-3 text-text-secondary hover:text-text-primary',
            'border border-transparent',
          )]: variant === 'ghost',

          // Danger
          [clsx(
            'text-neon-red border',
            '[background:linear-gradient(180deg,rgba(255,46,99,0.15)_0%,rgba(255,46,99,0.06)_100%)]',
            'hover:[background:linear-gradient(180deg,rgba(255,46,99,0.25)_0%,rgba(255,46,99,0.1)_100%)]',
            'border-[rgba(255,46,99,0.3)]',
          )]: variant === 'danger',

          // Sizes
          'text-xs px-2 py-1 gap-1': size === 'sm',
          'text-sm px-3 py-1.5 gap-1.5': size === 'md',
          'text-base px-5 py-2.5 gap-2': size === 'lg',

          // Active state
          'ring-1 ring-accent bg-accent/20 text-accent border-accent': active,
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
)
Button.displayName = 'Button'
