/** @type {import('tailwindcss').Config} */
// Moodila — Soft Editorial Design System Tokens
// See design-reference/DESIGN.md for detailed specifications.
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base canvas & surfaces
        background: 'rgb(var(--color-background) / <alpha-value>)',
        'on-background': 'rgb(var(--color-on-background) / <alpha-value>)',

        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-dim': 'rgb(var(--color-surface-dim) / <alpha-value>)',
        'surface-bright': 'rgb(var(--color-surface-bright) / <alpha-value>)',

        'surface-container-lowest': 'rgb(var(--color-surface-container-lowest) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--color-surface-container-low) / <alpha-value>)',
        'surface-container': 'rgb(var(--color-surface-container) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--color-surface-container-high) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--color-surface-container-highest) / <alpha-value>)',

        'surface-variant': 'rgb(var(--color-surface-variant) / <alpha-value>)',
        'surface-tint': 'rgb(var(--color-surface-tint) / <alpha-value>)',

        'on-surface': 'rgb(var(--color-on-surface) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--color-on-surface-variant) / <alpha-value>)',

        outline: 'rgb(var(--color-outline) / <alpha-value>)',
        'outline-variant': 'rgb(var(--color-outline-variant) / <alpha-value>)',

        'inverse-surface': 'rgb(var(--color-inverse-surface) / <alpha-value>)',
        'inverse-on-surface': 'rgb(var(--color-inverse-on-surface) / <alpha-value>)',

        // Brand: Primary
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--color-primary-container) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--color-on-primary-container) / <alpha-value>)',
        'inverse-primary': 'rgb(var(--color-inverse-primary) / <alpha-value>)',
        'primary-fixed': 'rgb(var(--color-primary-fixed) / <alpha-value>)',
        'primary-fixed-dim': 'rgb(var(--color-primary-fixed-dim) / <alpha-value>)',
        'on-primary-fixed': 'rgb(var(--color-on-primary-fixed) / <alpha-value>)',
        'on-primary-fixed-variant': 'rgb(var(--color-on-primary-fixed-variant) / <alpha-value>)',

        // Calm: Secondary
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--color-on-secondary) / <alpha-value>)',
        'secondary-container': 'rgb(var(--color-secondary-container) / <alpha-value>)',
        'on-secondary-container': 'rgb(var(--color-on-secondary-container) / <alpha-value>)',
        'secondary-fixed': 'rgb(var(--color-secondary-fixed) / <alpha-value>)',
        'secondary-fixed-dim': 'rgb(var(--color-secondary-fixed-dim) / <alpha-value>)',
        'on-secondary-fixed': 'rgb(var(--color-on-secondary-fixed) / <alpha-value>)',
        'on-secondary-fixed-variant': 'rgb(var(--color-on-secondary-fixed-variant) / <alpha-value>)',

        // Focus: Tertiary
        tertiary: 'rgb(var(--color-tertiary) / <alpha-value>)',
        'on-tertiary': 'rgb(var(--color-on-tertiary) / <alpha-value>)',
        'tertiary-container': 'rgb(var(--color-tertiary-container) / <alpha-value>)',
        'on-tertiary-container': 'rgb(var(--color-on-tertiary-container) / <alpha-value>)',
        'tertiary-fixed': 'rgb(var(--color-tertiary-fixed) / <alpha-value>)',
        'tertiary-fixed-dim': 'rgb(var(--color-tertiary-fixed-dim) / <alpha-value>)',
        'on-tertiary-fixed': 'rgb(var(--color-on-tertiary-fixed) / <alpha-value>)',
        'on-tertiary-fixed-variant': 'rgb(var(--color-on-tertiary-fixed-variant) / <alpha-value>)',

        // Semantic
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'on-success': 'rgb(var(--color-on-success) / <alpha-value>)',
        'success-container': 'rgb(var(--color-success-container) / <alpha-value>)',
        'on-success-container': 'rgb(var(--color-on-success-container) / <alpha-value>)',

        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'on-warning': 'rgb(var(--color-on-warning) / <alpha-value>)',
        'warning-container': 'rgb(var(--color-warning-container) / <alpha-value>)',
        'on-warning-container': 'rgb(var(--color-on-warning-container) / <alpha-value>)',

        error: 'rgb(var(--color-error) / <alpha-value>)',
        'on-error': 'rgb(var(--color-on-error) / <alpha-value>)',
        'error-container': 'rgb(var(--color-error-container) / <alpha-value>)',
        'on-error-container': 'rgb(var(--color-on-error-container) / <alpha-value>)',

        // Desaturated Emotional Mood Tokens
        'mood-rad': 'rgb(var(--color-mood-rad) / <alpha-value>)',
        'mood-rad-container': 'rgb(var(--color-mood-rad-container) / <alpha-value>)',
        'on-mood-rad-container': 'rgb(var(--color-on-mood-rad-container) / <alpha-value>)',

        'mood-good': 'rgb(var(--color-mood-good) / <alpha-value>)',
        'mood-good-container': 'rgb(var(--color-mood-good-container) / <alpha-value>)',
        'on-mood-good-container': 'rgb(var(--color-on-mood-good-container) / <alpha-value>)',

        'mood-meh': 'rgb(var(--color-mood-meh) / <alpha-value>)',
        'mood-meh-container': 'rgb(var(--color-mood-meh-container) / <alpha-value>)',
        'on-mood-meh-container': 'rgb(var(--color-on-mood-meh-container) / <alpha-value>)',

        'mood-bad': 'rgb(var(--color-mood-bad) / <alpha-value>)',
        'mood-bad-container': 'rgb(var(--color-mood-bad-container) / <alpha-value>)',
        'on-mood-bad-container': 'rgb(var(--color-on-mood-bad-container) / <alpha-value>)',

        'mood-awful': 'rgb(var(--color-mood-awful) / <alpha-value>)',
        'mood-awful-container': 'rgb(var(--color-mood-awful-container) / <alpha-value>)',
        'on-mood-awful-container': 'rgb(var(--color-on-mood-awful-container) / <alpha-value>)',
      },

      borderRadius: {
        xs: '0.5rem',      // 8px
        sm: '0.75rem',     // 12px
        DEFAULT: '1rem',   // 16px
        md: '1.25rem',     // 20px
        lg: '1.5rem',      // 24px
        xl: '1.75rem',     // 28px
        xxl: '2rem',       // 32px
        '2xl': '2rem',     // 32px
        full: '9999px',
      },

      spacing: {
        base: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '40px',
        xxxl: '48px',
        'container-margin-mobile': '16px',
        'container-margin': '24px',
        'container-margin-large': '32px',
        'gutter-mobile': '12px',
        gutter: '16px',
        'gutter-large': '24px',
      },

      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Manrope', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-xl': ['48px', { lineHeight: '52px', letterSpacing: '-0.045em', fontWeight: '700' }],
        'display-lg': ['40px', { lineHeight: '44px', letterSpacing: '-0.04em', fontWeight: '700' }],
        'display-md': ['32px', { lineHeight: '38px', letterSpacing: '-0.035em', fontWeight: '700' }],

        'headline-xl': ['28px', { lineHeight: '34px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-lg': ['24px', { lineHeight: '30px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['20px', { lineHeight: '26px', letterSpacing: '-0.015em', fontWeight: '650' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '650' }],

        'headline-xl-mobile': ['25px', { lineHeight: '31px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-lg-mobile': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '700' }],

        'body-lg': ['17px', { lineHeight: '27px', letterSpacing: '-0.005em', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '23px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '19px', fontWeight: '400' }],

        'label-lg': ['14px', { lineHeight: '18px', letterSpacing: '-0.005em', fontWeight: '650' }],
        'label-md': ['13px', { lineHeight: '16px', letterSpacing: '0em', fontWeight: '650' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.015em', fontWeight: '650' }],
        overline: ['10px', { lineHeight: '13px', letterSpacing: '0.08em', fontWeight: '700' }],
      },

      boxShadow: {
        none: 'none',
        subtle: 'var(--elevation-subtle)',
        card: 'var(--elevation-card)',
        floating: 'var(--elevation-floating)',
        modal: 'var(--elevation-modal)',
        cloud: 'var(--elevation-card)',
      },

      transitionDuration: {
        fast: '140ms',
        normal: '200ms',
        slow: '320ms',
      },

      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0, 0, 1)',
        emphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },

      opacity: {
        disabled: '0.42',
        muted: '0.64',
        subtle: '0.78',
        overlay: '0.56',
      },
    },
  },
  plugins: [],
}
