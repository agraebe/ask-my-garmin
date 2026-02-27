import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        garmin: {
          blue: '#007DC3',
          'blue-hover': '#0090DB',
          dark: '#1D2F3F',
          bg: '#0F1923',
          surface: '#1C2B3A',
          'surface-2': '#243447',
          border: '#2A3F55',
          text: '#F2F7FB',
          'text-muted': '#8FA8BF',
          green: '#4BC56D',
        },
      },
    },
  },
  plugins: [],
};

export default config;
