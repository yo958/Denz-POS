import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AuthShell } from '@/components/auth/AuthShell';
import { ToastViewport } from '@/components/ui/toast';
import { ConfirmHost } from '@/components/ui/confirm-dialog';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Denz POS',
  description: 'Point of sale for Denz Coworking Cafe',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="h-full flex bg-background text-foreground">
        <ThemeProvider>
          <AuthShell>
            <ErrorBoundary>{children}</ErrorBoundary>
          </AuthShell>
          <ToastViewport />
          <ConfirmHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
