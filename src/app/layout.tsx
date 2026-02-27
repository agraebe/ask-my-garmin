import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';
import './globals.css';

const roboto = Roboto({ subsets: ['latin'], weight: ['300', '400', '500', '700'] });

export const metadata: Metadata = {
  title: 'Ask My Garmin',
  description: 'Chat with your Garmin health and fitness data using AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${roboto.className} bg-garmin-bg text-garmin-text antialiased`}>
        {children}
      </body>
    </html>
  );
}
