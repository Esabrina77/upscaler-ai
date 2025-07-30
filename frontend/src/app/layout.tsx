// src/app/layout.tsx - Layout principal (root) CORRIGÉ
import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Toaster } from 'react-hot-toast';
import './globals.css';

// Police professionnelle rb-freigeist-neue
const freigeist = localFont({
  src: [
    {
      path: './fonts/freigeist-neue-regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: './fonts/freigeist-neue-medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: './fonts/freigeist-neue-bold.woff2',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-freigeist',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji']
});

export const metadata: Metadata = {
  title: 'AI Upscaler - Améliorez vos images avec l\'IA',
  description: 'Transformez vos images basse résolution en haute définition avec notre technologie d\'IA avancée. Gratuit et rapide.',
  keywords: ['IA', 'upscaling', 'amélioration image', 'haute résolution', 'AI'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={freigeist.variable}>
      <body className={`${freigeist.className} font-sans bg-white text-black antialiased`}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#000000',
              color: '#ffffff',
              fontFamily: 'var(--font-freigeist)',
              fontSize: '14px',
              borderRadius: '8px',
            },
            success: {
              style: {
                background: '#000000',
                color: '#ffffff',
              },
            },
            error: {
              style: {
                background: '#dc2626',
                color: '#ffffff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}