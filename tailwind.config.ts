import type { Config } from 'tailwindcss';

export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                apple: {
                    bg: '#F5F5F7',
                    surface: '#FFFFFF',
                    textMain: '#1D1D1F',
                    textMuted: '#86868B',
                    blue: '#0071E3',
                    red: '#FF3B30',
                    green: '#34C759',
                    orange: '#FF9500',
                    border: 'rgba(0, 0, 0, 0.08)',
                }
            },
            boxShadow: {
                'apple-card': '0 4px 24px rgba(0, 0, 0, 0.04)',
                'apple-card-hover': '0 8px 32px rgba(0, 0, 0, 0.08)',
                'apple-btn': '0 2px 8px rgba(0, 113, 227, 0.3)',
            },
            animation: {
                'spin-slow': 'spin 3s linear infinite',
                'fade-in': 'fadeIn 0.4s ease-out',
                'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                }
            }
        },
    },
    plugins: [],
} satisfies Config;
