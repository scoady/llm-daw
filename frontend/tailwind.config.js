/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Surface system (cool blue undertone) ──────────────────────────
        surface: {
          0: '#08090b',   // app background — deepest black
          1: '#0f1114',   // panel backgrounds
          2: '#161921',   // track rows, inputs
          3: '#1e2130',   // elevated surfaces, hover
          4: '#272b3a',   // strong hover, active
          5: '#313648',   // highest elevation
        },
        border: {
          subtle: '#1f2233',
          default: '#2d3348',
          strong: '#3d4460',
          glow: 'rgba(108,99,255,0.3)',
        },

        // ── Primary accent (AI features, selections) ─────────────────────
        accent: {
          DEFAULT: '#6c63ff',
          hover: '#7c74ff',
          muted: 'rgba(108,99,255,0.15)',
          dim: 'rgba(108,99,255,0.08)',
        },

        // ── Function-specific accents ─────────────────────────────────────
        cyan: {
          DEFAULT: '#00d4ff',
          dim: 'rgba(0,212,255,0.12)',
          glow: 'rgba(0,212,255,0.4)',
        },
        amber: {
          DEFAULT: '#ff9f1c',
          dim: 'rgba(255,159,28,0.12)',
          glow: 'rgba(255,159,28,0.4)',
        },
        neon: {
          green: '#39ff14',
          red: '#ff2e63',
          blue: '#4a90ff',
          pink: '#ff6bd6',
        },

        // ── LED indicator colors ──────────────────────────────────────────
        led: {
          off: '#1a1d2a',
          green: '#00ff41',
          yellow: '#ffff00',
          red: '#ff0040',
          blue: '#0080ff',
        },

        // ── VU meter gradient ─────────────────────────────────────────────
        vu: {
          green: '#00e639',
          yellow: '#e6e600',
          orange: '#ff8c00',
          red: '#ff1a1a',
          peak: '#ff0040',
        },

        // ── Clip colors ──────────────────────────────────────────────────
        clip: {
          audio: '#1a6b4a',
          midi: '#1a3f7a',
          selected: '#4a3d8a',
        },

        // ── Transport ────────────────────────────────────────────────────
        transport: {
          play: '#39ff14',
          record: '#ff2e63',
          stop: '#6b7280',
        },

        // ── Text ─────────────────────────────────────────────────────────
        text: {
          primary: '#e4e6f0',
          secondary: '#8890a8',
          muted: '#4a5068',
          lcd: '#a0f0a0',
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        lcd: ['Share Tech Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },

      // ── Shadows ──────────────────────────────────────────────────────────
      boxShadow: {
        panel: '0 0 0 1px rgba(255,255,255,0.03), 0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.02)',
        'panel-inset': 'inset 0 2px 8px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)',
        'panel-raised': '0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
        accent: '0 0 16px rgba(108,99,255,0.35)',
        'glow-accent': '0 0 24px rgba(108,99,255,0.3), 0 0 6px rgba(108,99,255,0.5)',
        'glow-green': '0 0 20px rgba(57,255,20,0.2), 0 0 6px rgba(57,255,20,0.4)',
        'glow-red': '0 0 20px rgba(255,46,99,0.2), 0 0 6px rgba(255,46,99,0.4)',
        'glow-cyan': '0 0 20px rgba(0,212,255,0.2), 0 0 6px rgba(0,212,255,0.4)',
        'glow-amber': '0 0 20px rgba(255,159,28,0.2), 0 0 6px rgba(255,159,28,0.4)',
        'led-on': '0 0 8px currentColor, 0 0 2px currentColor',
        'button-inset': 'inset 0 2px 4px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.03)',
        'fader-track': 'inset 0 2px 6px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(0,0,0,0.3)',
      },

      // ── Animations ───────────────────────────────────────────────────────
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'led-pulse': 'led-pulse 1.5s ease-in-out infinite',
        'record-pulse': 'record-pulse 1.5s ease-in-out infinite',
        'scan-line': 'scan-line 6s linear infinite',
        'glow-breathe': 'glow-breathe 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'marching-ants': 'marching-ants 0.5s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'led-pulse': {
          '0%, 100%': { opacity: '0.7', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.3)' },
        },
        'record-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(255,46,99,0.3)' },
          '50%': { boxShadow: '0 0 24px rgba(255,46,99,0.6)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'glow-breathe': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.9' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'marching-ants': {
          '0%': { strokeDashoffset: '0' },
          '100%': { strokeDashoffset: '-16' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },

      // ── Background images (textures) ─────────────────────────────────────
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")",
        'scan-lines': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
      },

      transitionDuration: {
        '250': '250ms',
      },
    },
  },
  plugins: [],
}
