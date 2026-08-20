// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-dark': '#0b0f19',
        'brand-section': '#111827',
        'brand-card': '#1f2937',
        'brand-card-hover': '#374151',
        'brand-accent': '#3b82f6',  // blue-500
        'brand-accent-hover': '#2563eb', // blue-600
        'brand-success': '#10b981',
        'brand-danger': '#ef4444',
        'brand-warning': '#f59e0b',
        'brand-text-primary': '#f9fafb', // gray-50
        'brand-text-secondary': '#9ca3af', // gray-400
        'brand-text-muted': '#6b7280' // gray-500
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
