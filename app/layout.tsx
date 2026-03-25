import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BRIGX - Browser-Based Ring Image Generator',
  description: 'Circular comparative genome visualization tool running entirely in your browser',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var theme = localStorage.getItem('gx-theme');
            if (!theme) {
              theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
            }
            document.documentElement.setAttribute('data-theme', theme);
          })();
        `}} />
      </head>
      <body className="h-full">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
