'use client'
import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import AnalysisEngine from '@/components/analysis/AnalysisEngine'
import { F1_TEAM_COLORS } from '@/types'

const teamMaps: Record<string, number> = {
  alpine: 84.4, astonmartin: 72.9, ferrari: 78.7, haas: 70.2,
  mclaren: 79.1, mercedes: 79.3, racingbulls: 70.8, redbull: 78.5,
  sauber: 72.6, williams: 86.3,
}

export default function F1Page() {
  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top right, #1a0800 0%, #080808 50%)' }}>
      <div className="scanline" style={{ background: 'linear-gradient(90deg, transparent, rgba(249,115,22,0.3), transparent)' }} />
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">🏎️</span>
            <div>
              <div className="text-xs font-mono text-orange-400/60 mb-1">Object Detection · YOLOv11l · 10 teams · 2025 season</div>
              <h1 className="font-display text-5xl text-white tracking-wider">FORMULA 1 ANALYSIS</h1>
            </div>
          </div>
          <p className="text-white/45 text-base max-w-xl leading-relaxed ml-[52px]">
            Per-team car detection across all 10 constructors. 93.5% mAP50 trained on 2025 season liveries.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-1 space-y-3">
            <div className="text-xs font-mono text-white/30 uppercase tracking-widest mb-3">Team detection accuracy</div>
            {Object.entries(teamMaps)
              .sort((a, b) => b[1] - a[1])
              .map(([team, map]) => {
                const color = F1_TEAM_COLORS[team] || '#fb923c'
                return (
                  <div key={team} className="p-3 rounded-xl" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                        <span className="text-sm text-white/75 capitalize">{team === 'racingbulls' ? 'Racing Bulls' : team}</span>
                      </div>
                      <span className="text-xs font-mono" style={{ color }}>{map.toFixed(1)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5">
                      <div className="h-full rounded-full" style={{ width: `${map}%`, background: color, opacity: 0.6 }} />
                    </div>
                  </div>
                )
              })}

            <div className="mt-4 rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs font-mono text-white/30 uppercase tracking-widest">Overall metrics</div>
              {[
                { label: 'mAP50', value: '93.5%', color: '#fb923c' },
                { label: 'mAP50-95', value: '77.3%', color: '#fb923c' },
                { label: 'Precision', value: '89.2%', color: '#fdba74' },
                { label: 'Recall', value: '88.1%', color: '#fdba74' },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-white/40">{m.label}</span>
                  <span className="text-sm font-mono font-medium" style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="lg:col-span-2">
            <AnalysisEngine mode="f1" />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
