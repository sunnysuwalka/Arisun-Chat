/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        primary: { 50: '#f0f4ff', 100: '#e0e9ff', 400: '#7B8FF7', 500: '#4F6EF7', 600: '#3A57E8', 700: '#2940CC' },
        surface: { 0: '#08080F', 50: '#0F0F1A', 100: '#14141F', 200: '#1C1C2E', 300: '#242438', 400: '#2E2E48', 500: '#3A3A58' },
        accent: { cyan: '#00D4FF', green: '#00E5A0', amber: '#FFB020', red: '#FF4A6B', purple: '#A855F7' },
      },
      animation: {
        'fade-up': 'fadeUp 0.3s ease forwards',
        'slide-in': 'slideIn 0.25s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease infinite',
        'bounce-dot': 'bounceDot 1.2s infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        pulseGlow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(79,110,247,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(79,110,247,0)' } },
        bounceDot: { '0%,80%,100%': { transform: 'translateY(0)' }, '40%': { transform: 'translateY(-6px)' } },
      },
    },
  },
  plugins: [],
};
