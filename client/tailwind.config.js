/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          primary: '#05050f',
          secondary: '#0a0918',
        },
        neon: {
          blue: '#6366f1', // Vibrant Indigo Accent
          purple: '#5c3beb', // Deep Sleek Purple Accent
          green: '#00ff88',
          red: '#ff3366',
          yellow: '#ffcc00',
        },
        text: {
          primary: '#f1f5f9',
          muted: '#94a3b8', // Steel Slate Blue
        }
      },
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
        dmsans: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(99, 102, 241, 0.35)',
        'glow-purple': '0 0 20px rgba(92, 59, 235, 0.35)',
        'glow-green': '0 0 20px rgba(0, 255, 136, 0.35)',
        'glow-red': '0 0 20px rgba(255, 51, 102, 0.35)',
        'glow-yellow': '0 0 20px rgba(255, 204, 0, 0.35)',
      }
    },
  },
  plugins: [],
}
