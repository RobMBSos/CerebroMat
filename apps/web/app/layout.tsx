import type { Metadata } from 'next';
import { Baloo_2, Nunito } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import './globals.css';

const baloo = Baloo_2({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'CerebroMat School',
  description: 'Panel web escolar para matematicas y progreso adaptativo',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [{ rel: 'icon', url: '/favicon.png', type: 'image/png' }],
  },
};

const themeBootstrapScript = `
(() => {
  try {
    const key = 'cerebromat_theme';
    const stored = window.localStorage.getItem(key);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  } catch {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className={`${baloo.variable} ${nunito.variable}`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
