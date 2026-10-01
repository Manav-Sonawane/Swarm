/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#03020a',
          900: '#050507',
          800: '#0a0910',
          700: '#0f0d1a',
          600: '#161228',
        },
        violet: {
          950: '#150b2e',
        },
        swarm: {
          primary: '#10b981',
          accent: '#3b82f6',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        // Glass color tokens
        glass: {
          white: 'rgba(255, 255, 255, 0.07)',
          purple: 'rgba(139, 92, 246, 0.12)',
          border: 'rgba(255, 255, 255, 0.10)',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Cinematic display scale
        'display-hero': 'clamp(4rem, 8vw, 9rem)',
        'display-major': 'clamp(2.8rem, 5vw, 5.5rem)',
        'display-section': 'clamp(1.5rem, 2.5vw, 2.5rem)',
        'body-lg': '1.125rem',     // 18px
        'body': '1rem',            // 16px
        'body-sm': '0.9375rem',    // 15px
        'ui': '0.8125rem',         // 13px
        'ui-sm': '0.75rem',        // 12px
      },
      lineHeight: {
        'display': '0.92',
        'heading': '1.1',
        'tight': '1.25',
      },
      letterSpacing: {
        'display': '-0.04em',
        'heading': '-0.02em',
        'ui': '0.05em',
        'wide-ui': '0.08em',
      },
      backdropBlur: {
        'glass': '16px',
        'glass-heavy': '28px',
        'glass-xl': '40px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'radial-deep': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glass-sm': '0 2px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glass-md': '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg': '0 16px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.10)',
        'glow-purple': '0 0 20px rgba(124,58,237,0.4), 0 0 60px rgba(124,58,237,0.15)',
        'glow-cyan': '0 0 20px rgba(103,232,249,0.4), 0 0 60px rgba(103,232,249,0.1)',
        'glow-violet-sm': '0 0 12px rgba(139,92,246,0.5)',
        'glow-violet-md': '0 0 24px rgba(139,92,246,0.4)',
        'btn-primary': '0 0 20px rgba(124,58,237,0.5), 0 4px 12px rgba(0,0,0,0.3)',
      },
      animation: {
        'float': 'float 8s ease-in-out infinite',
        'float-slow': 'float 14s ease-in-out infinite reverse',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'slide-up': 'slide-up 0.5s cubic-bezier(0.22,0.61,0.36,1) forwards',
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.22, 0.61, 0.36, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
