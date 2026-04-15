import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up':   { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-in':        { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out':       { from: { opacity: '1' }, to: { opacity: '0' } },
        'zoom-in-95':     { from: { opacity: '0', transform: 'scale(0.95)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'zoom-out-95':    { from: { opacity: '1', transform: 'scale(1)' }, to: { opacity: '0', transform: 'scale(0.95)' } },
        'slide-in-from-top-2':    { from: { transform: 'translateY(-8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'slide-in-from-bottom-2': { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'slide-in-from-left-1/2': { from: { transform: 'translateX(-50%) translateY(-48%) scale(0.95)', opacity: '0' }, to: { transform: 'translateX(-50%) translateY(-50%) scale(1)', opacity: '1' } },
        'slide-out-to-left-1/2':  { from: { transform: 'translateX(-50%) translateY(-50%) scale(1)', opacity: '1' }, to: { transform: 'translateX(-50%) translateY(-48%) scale(0.95)', opacity: '0' } },
        'slide-in-from-top-48':   { from: { transform: 'translateX(-50%) translateY(-46%)', opacity: '0' }, to: { transform: 'translateX(-50%) translateY(-50%)', opacity: '1' } },
        'slide-out-to-top-48':    { from: { transform: 'translateX(-50%) translateY(-50%)', opacity: '1' }, to: { transform: 'translateX(-50%) translateY(-46%)', opacity: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
        'in':             'fade-in 150ms ease',
        'out':            'fade-out 150ms ease',
      },
    },
  },
  plugins: [],
}

export default config
