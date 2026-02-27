/**
 * LogoIcon — Animated waveform-to-neural-note logo.
 *
 * A stylised audio waveform that pulses with life, surrounded by
 * orbiting neural connection dots and a glowing music note silhouette.
 * The waveform bars animate independently with staggered sine waves.
 * An outer ring pulses like a radar sweep. Pure CSS animation, no JS timers.
 */

interface LogoIconProps {
  size?: number
  className?: string
  color?: string
  glowColor?: string
  glow?: boolean
  animated?: boolean
}

export function LogoIcon({
  size = 24,
  className = '',
  color = 'currentColor',
  glowColor = 'rgba(108, 99, 255, 0.5)',
  glow = false,
  animated = true,
}: LogoIconProps) {
  const id = `logo-${Math.random().toString(36).slice(2, 6)}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 8px ${glowColor}) drop-shadow(0 0 20px ${glowColor})` } : undefined}
    >
      <defs>
        {/* Gradient for the waveform bars */}
        <linearGradient id={`${id}-wave`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>

        {/* Radial glow behind the icon */}
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>

        {/* Gradient for the ring */}
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="50%" stopColor={color} stopOpacity="0.1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <circle cx="32" cy="32" r="28" fill={`url(#${id}-glow)`} />

      {/* Outer ring */}
      <circle
        cx="32" cy="32" r="26"
        stroke={`url(#${id}-ring)`}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
        strokeDasharray="8 4"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 32 32"
            to="360 32 32"
            dur="12s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Inner ring — counter-rotate */}
      <circle
        cx="32" cy="32" r="22"
        stroke={color}
        strokeWidth="0.5"
        fill="none"
        opacity="0.2"
        strokeDasharray="3 6"
      >
        {animated && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="360 32 32"
            to="0 32 32"
            dur="8s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* === Waveform bars (7 bars, center-aligned) === */}
      {[
        { x: 17, h: 8,  delay: '0s' },
        { x: 21, h: 14, delay: '0.15s' },
        { x: 25, h: 22, delay: '0.3s' },
        { x: 29, h: 28, delay: '0.45s' },
        { x: 33, h: 22, delay: '0.6s' },
        { x: 37, h: 14, delay: '0.75s' },
        { x: 41, h: 8,  delay: '0.9s' },
      ].map((bar, i) => {
        const y = 32 - bar.h / 2
        return (
          <rect
            key={i}
            x={bar.x}
            y={y}
            width="2.5"
            height={bar.h}
            rx="1.25"
            fill={`url(#${id}-wave)`}
          >
            {animated && (
              <animate
                attributeName="height"
                values={`${bar.h};${bar.h * 0.3};${bar.h * 1.2};${bar.h * 0.5};${bar.h}`}
                dur="1.4s"
                begin={bar.delay}
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            )}
            {animated && (
              <animate
                attributeName="y"
                values={`${y};${32 - bar.h * 0.15};${32 - bar.h * 0.6};${32 - bar.h * 0.25};${y}`}
                dur="1.4s"
                begin={bar.delay}
                repeatCount="indefinite"
                calcMode="spline"
                keySplines="0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1; 0.4 0 0.2 1"
              />
            )}
          </rect>
        )
      })}

      {/* Eighth note — small, top-right corner as a musical accent */}
      <g opacity="0.7">
        {/* Note head */}
        <ellipse cx="48" cy="14" rx="3.5" ry="2.5" fill={color} transform="rotate(-20 48 14)" />
        {/* Stem */}
        <line x1="51" y1="13" x2="51" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        {/* Flag */}
        <path
          d="M51 5 Q54 7 52 10"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Neural dots — orbiting particles */}
      {[0, 1, 2, 3].map((i) => (
        <circle
          key={`dot-${i}`}
          cx="32"
          cy="32"
          r="1.2"
          fill={color}
          opacity="0.6"
        >
          {animated && (
            <animateMotion
              dur={`${3 + i * 0.7}s`}
              repeatCount="indefinite"
              begin={`${i * 0.8}s`}
            >
              <mpath xlinkHref={`#${id}-orbit-${i}`} />
            </animateMotion>
          )}
        </circle>
      ))}

      {/* Orbital paths (invisible) */}
      <path id={`${id}-orbit-0`} d="M32 8 A24 24 0 1 1 31.99 8" fill="none" />
      <path id={`${id}-orbit-1`} d="M32 10 A22 22 0 1 0 31.99 10" fill="none" />
      <path id={`${id}-orbit-2`} d="M12 32 A20 20 0 1 1 12.01 32" fill="none" />
      <path id={`${id}-orbit-3`} d="M14 32 A18 18 0 1 0 14.01 32" fill="none" />

      {/* Center pulse dot */}
      <circle cx="32" cy="32" r="1.5" fill={color} opacity="0.8">
        {animated && (
          <animate
            attributeName="r"
            values="1.5;3;1.5"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
        {animated && (
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="2s"
            repeatCount="indefinite"
          />
        )}
      </circle>
    </svg>
  )
}
