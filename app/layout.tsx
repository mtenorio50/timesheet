import type { Metadata, Viewport } from 'next';
import './globals.css';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'Royal Glass Timesheet',
  description: 'Royal Glass employee timesheet management',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RG Timesheet',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e3a5f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
