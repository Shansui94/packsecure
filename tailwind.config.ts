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
                    bg: '#050505',
                    surface: '#121215',
                    textMain: '#FFFFFF',
                    textMuted: '#8E8E8E',
                    blue: '#E97132',
                    red: '#FF3B30',
                    green: '#5ACC5A',
                    orange: '#FE4B13',
                    border: 'rgba(255, 255, 255, 0.08)',
                },
                blue: {
                    50: '#fff7ed',
                    100: '#ffedd5',
                    200: '#fed7aa',
                    300: '#fdbb74',
                    400: '#f97316',
                    500: '#E97132',
                    600: '#FE4B13',
                    700: '#d94b06',
                    800: '#b23907',
                    900: '#7c2d12',
                    950: '#431407',
                },
                indigo: {
                    50: '#fff5f5',
                    100: '#fed7d7',
                    200: '#feb2b2',
                    300: '#f98080',
                    400: '#f55050',
                    500: '#FF5E36',
                    600: '#E03D16',
                    700: '#c53030',
                    800: '#9b2c2c',
                    900: '#742a2a',
                    950: '#3c0d0d',
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
