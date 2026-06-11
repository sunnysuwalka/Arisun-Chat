/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        arisun: {
          base: '#0B1120',      // Deepest background
          surface: '#111827',   // Main UI panels
          elevated: '#1F2937',  // Floating elements/modals
          primary: '#007AFF',   // Signature Blue
          'primary-subtle': 'rgba(0, 122, 255, 0.1)',
          danger: '#FF3B30',    // System Red
          success: '#10B981',   // Online Emerald
          title: '#F9FAFB',     // Pure white headers
          body: '#E5E7EB',      // Off-white message text
          muted: '#9CA3AF',     // Subtitles & timestamps
          border: '#374151',    // Subtle dividers
        }
      },
      
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
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
