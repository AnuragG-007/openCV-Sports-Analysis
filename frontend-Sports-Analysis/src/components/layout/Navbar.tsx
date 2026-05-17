'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Activity } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Home' },
  { href: '/football', label: 'Football' },
  { href: '/f1', label: 'Formula 1' },
]

export default function Navbar() {
  const path = usePathname()
  const isFootball = path.startsWith('/football')
  const isF1 = path.startsWith('/f1')

  const accentColor = isFootball ? '#4ade80' : isF1 ? '#fb923c' : '#ffffff'

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', background: 'rgba(8,8,8,0.85)' }}>
      <Link href="/" className="flex items-center gap-3 group">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
          style={{ background: `linear-gradient(135deg, #16a34a, #f97316)`, boxShadow: `0 0 16px ${accentColor}40` }}>
          <Activity size={15} className="text-white" />
        </div>
        <span className="font-display text-lg tracking-widest text-white">SPORTVISION</span>
        <span className="text-xs font-mono text-white/25 mt-0.5">AI</span>
      </Link>

      <div className="flex items-center gap-1">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className={cn(
              'px-4 py-2 rounded-lg text-sm transition-all duration-200',
              path === l.href
                ? 'text-white bg-white/8'
                : 'text-white/40 hover:text-white/80 hover:bg-white/4'
            )}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
