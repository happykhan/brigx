import type { Metadata } from 'next'
import './globals.css'
import ThemeToggle from '@/components/ThemeToggle'

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
    <html lang="en" className="h-full">
      <body className="h-full">
        <ThemeToggle />
        {children}
      </body>
    </html>
  )
}
