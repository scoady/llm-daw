/**
 * LogoIcon — A modern treble-clef-meets-fork-and-spoon icon.
 *
 * The upper tines evoke a fork / tuning fork, the flowing S-curve
 * reads as a stylised treble clef, and the bottom bowl nods to a spoon.
 * Clean geometric lines, hipster-bistro energy, musical DNA.
 */

interface LogoIconProps {
  size?: number
  className?: string
  color?: string
  glowColor?: string
  glow?: boolean
}

export function LogoIcon({
  size = 24,
  className = '',
  color = 'currentColor',
  glowColor = 'rgba(108, 99, 255, 0.5)',
  glow = false,
}: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={glow ? { filter: `drop-shadow(0 0 6px ${glowColor})` } : undefined}
    >
      {/* Fork tines — three prongs at top */}
      <line x1="24" y1="6" x2="24" y2="20" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="32" y1="4" x2="32" y2="22" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="6" x2="40" y2="20" stroke={color} strokeWidth="2.5" strokeLinecap="round" />

      {/* Bridge connecting tines */}
      <path
        d="M24 20 Q28 24 32 22 Q36 24 40 20"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Treble clef S-curve stem flowing from bridge */}
      <path
        d="M32 22
           C38 28, 44 32, 42 38
           C40 44, 34 44, 32 42
           C30 40, 28 36, 30 32
           C32 28, 36 30, 34 34"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Spoon bowl at bottom */}
      <ellipse
        cx="32"
        cy="52"
        rx="9"
        ry="6"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
      />

      {/* Connecting stem — clef to spoon */}
      <line x1="32" y1="42" x2="32" y2="46" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
