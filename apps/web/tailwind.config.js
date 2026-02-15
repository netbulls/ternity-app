/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Oxanium', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        bannerSlideIn: {
          from: { transform: 'translateY(-100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        bannerShimmer: {
          '0%': { left: '-50%' },
          '100%': { left: '150%' },
        },
        eyePulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(35 100% 50% / 0.2)' },
          '50%': { boxShadow: '0 0 0 8px hsl(35 100% 50% / 0)' },
        },
        identityShift: {
          '0%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        identityContent: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '15%': { transform: 'scale(1)', opacity: '1' },
          '70%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.05)', opacity: '0' },
        },
        shiftPulse: {
          '0%': { boxShadow: '0 0 0 0 hsl(35 100% 50% / 0.3)' },
          '50%': { boxShadow: '0 0 0 24px hsl(35 100% 50% / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(35 100% 50% / 0)' },
        },
        scanLine: {
          '0%': { top: '0', opacity: '1' },
          '100%': { top: '100%', opacity: '0.3' },
        },
      },
      animation: {
        'banner-slide-in': 'bannerSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'banner-shimmer': 'bannerShimmer 4s ease-in-out infinite',
        'eye-pulse': 'eyePulse 3s ease-in-out infinite',
        'identity-shift': 'identityShift 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'identity-content': 'identityContent 2.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shift-pulse': 'shiftPulse 1s ease-in-out 0.3s',
        'scan-line': 'scanLine 1s ease-in-out 0.2s',
      },
    },
  },
  plugins: [],
};
