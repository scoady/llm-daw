/**
 * AISparkleIcon — A custom animated AI sparkle/starburst icon.
 * Three asymmetric diamond sparkles with a rotating glow ring —
 * distinctly different from the standard lucide-react Sparkles.
 */
export function AISparkleIcon({
  size = 16,
  color = '#6c63ff',
  className = '',
  animated = true,
}: {
  size?: number
  color?: string
  className?: string
  animated?: boolean
}) {
  const id = `ai-sparkle-${Math.random().toString(36).slice(2, 6)}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Ambient glow ring */}
      <circle
        cx="12"
        cy="12"
        r="9"
        fill={`url(#${id}-glow)`}
        opacity="0.3"
      >
        {animated && (
          <animate
            attributeName="r"
            values="8;10;8"
            dur="2.5s"
            repeatCount="indefinite"
          />
        )}
      </circle>

      {/* Main sparkle — 4-point star, tall and sharp */}
      <path
        d="M12 3 L13.2 9.5 L19 12 L13.2 14.5 L12 21 L10.8 14.5 L5 12 L10.8 9.5 Z"
        fill={color}
        opacity="0.9"
      >
        {animated && (
          <animate
            attributeName="opacity"
            values="0.9;1;0.9"
            dur="1.8s"
            repeatCount="indefinite"
          />
        )}
      </path>

      {/* White core highlight */}
      <path
        d="M12 7 L12.6 10.8 L15.5 12 L12.6 13.2 L12 17 L11.4 13.2 L8.5 12 L11.4 10.8 Z"
        fill="white"
        opacity="0.7"
      />

      {/* Secondary sparkle — top-right, smaller, rotated 45deg */}
      <g transform="translate(17.5, 5.5) rotate(15)">
        <path
          d="M0 -3 L0.8 -0.6 L3 0 L0.8 0.6 L0 3 L-0.8 0.6 L-3 0 L-0.8 -0.6 Z"
          fill={color}
          opacity="0.7"
        >
          {animated && (
            <animate
              attributeName="opacity"
              values="0.7;0.3;0.7"
              dur="1.4s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </g>

      {/* Tertiary sparkle — bottom-left, tiny accent */}
      <g transform="translate(6, 18.5)">
        <path
          d="M0 -2 L0.5 -0.4 L2 0 L0.5 0.4 L0 2 L-0.5 0.4 L-2 0 L-0.5 -0.4 Z"
          fill={color}
          opacity="0.5"
        >
          {animated && (
            <animate
              attributeName="opacity"
              values="0.5;0.9;0.5"
              dur="2s"
              repeatCount="indefinite"
            />
          )}
        </path>
      </g>
    </svg>
  )
}
