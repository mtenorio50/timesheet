import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Royal Glass Timesheet',
    short_name: 'RG Timesheet',
    description: 'Royal Glass employee timesheet management',
    start_url: '/',
    display: 'standalone',
    background_color: '#1e3a5f',
    theme_color: '#1e3a5f',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
