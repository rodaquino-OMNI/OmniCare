/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // OmniCare brand colors
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        secondary: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        // Medical/Healthcare specific colors
        medical: {
          emergency: '#dc2626',    // Red for emergency
          warning: '#d97706',      // Orange for warnings
          success: '#059669',      // Green for success
          info: '#0284c7',         // Blue for info
          neutral: '#6b7280',      // Gray for neutral
        },
        // Status colors for appointments, billing, etc.
        status: {
          scheduled: '#3b82f6',    // Blue
          confirmed: '#10b981',    // Green
          'in-progress': '#8b5cf6', // Purple
          completed: '#6b7280',    // Gray
          cancelled: '#ef4444',    // Red
          'no-show': '#f97316',    // Orange
          pending: '#f59e0b',      // Yellow
          paid: '#059669',         // Green
          denied: '#dc2626',       // Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      minHeight: {
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'strong': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 2px 8px -2px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    // Custom plugin for healthcare-specific utilities
    function({ addUtilities, theme }) {
      addUtilities({
        '.status-badge': {
          '@apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium': {},
        },
        '.card-shadow': {
          'box-shadow': theme('boxShadow.soft'),
        },
        '.medical-border': {
          'border-color': theme('colors.medical.neutral'),
        },
        '.transition-colors-fast': {
          'transition': 'color 150ms ease-in-out, background-color 150ms ease-in-out, border-color 150ms ease-in-out',
        },
        '.glass-effect': {
          'backdrop-filter': 'blur(16px) saturate(180%)',
          'background-color': 'rgba(255, 255, 255, 0.75)',
          'border': '1px solid rgba(255, 255, 255, 0.125)',
        },
        '.dark-glass-effect': {
          'backdrop-filter': 'blur(16px) saturate(180%)',
          'background-color': 'rgba(17, 25, 40, 0.75)',
          'border': '1px solid rgba(255, 255, 255, 0.125)',
        },
      });
    },
  ],
  // Dark mode configuration
  darkMode: 'class',
  // Safelist classes that might be dynamically generated
  safelist: [
    'bg-status-scheduled',
    'bg-status-confirmed',
    'bg-status-in-progress',
    'bg-status-completed',
    'bg-status-cancelled',
    'bg-status-no-show',
    'bg-status-pending',
    'bg-status-paid',
    'bg-status-denied',
    'text-status-scheduled',
    'text-status-confirmed',
    'text-status-in-progress',
    'text-status-completed',
    'text-status-cancelled',
    'text-status-no-show',
    'text-status-pending',
    'text-status-paid',
    'text-status-denied',
  ],
};