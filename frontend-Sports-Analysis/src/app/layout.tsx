import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SportVision AI — Computer Vision Analytics',
  description: 'Real-time AI-powered sports analysis for football and Formula 1',
  openGraph: {
    title: 'SportVision AI',
    description: 'Real-time AI-powered sports analysis',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
