/** @type {import('tailwindcss').Config} */
// Colors come from CSS variables in src/index.css (RGB channels so opacity modifiers like bg-swarm/15 work).
const v = name => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        raise: v('raise'),
        lift: v('lift'),
        line: v('line'),
        edge: v('edge'),
        ink: v('ink'),
        mute: v('mute'),
        dim: v('dim'),
        brand: v('brand'),
        swarm: v('swarm'),
        coral: v('base'),
        naive: v('naive'),
        good: v('good'),
        bad: v('bad'),
        warn: v('warn'),
        info: v('info'),
        jam: v('jam'),
        plum: v('plum'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        sans: ['Geist', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', '"Cascadia Mono"', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        slidein: { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        pulse2: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.35' } },
      },
      animation: {
        rise: 'rise 260ms cubic-bezier(.2,.7,.2,1) both',
        slidein: 'slidein 280ms cubic-bezier(.2,.7,.2,1) both',
        fade: 'fade 200ms ease-out both',
        pulse2: 'pulse2 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
