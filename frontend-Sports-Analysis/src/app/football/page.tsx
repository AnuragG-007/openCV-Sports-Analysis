'use client'
import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import AnalysisEngine from '@/components/analysis/AnalysisEngine'
import { Shield, Eye, Users, Circle } from 'lucide-react'

const classes = [
  { label: 'Players', color: '#4ade80', icon: <Users size={14} />, count: '~12 per frame' },
  { label: 'Goalkeeper', color: '#818cf8', icon: <Shield size={14} />, count: 'Isolated detection' },
  { label: 'Referee', color: '#f87171', icon: <Eye size={14} />, count: 'High recall 0.964' },
  { label: 'Ball', color: '#fbbf24', icon: <Circle size={14} />, count: 'Sub-pixel tracking' },
]

export default function FootballPage() {
  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse at top left, #0a1f0f 0%, #080808 50%)' }}>
      <div className="scanline" style={{ background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.3), transparent)' }} />
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">⚽</span>
            <div>
              <div className="text-xs font-mono text-green-400/60 mb-1">Instance Segmentation · YOLOv11x-seg · 62M params</div>
              <h1 className="font-display text-5xl text-white tracking-wider">FOOTBALL ANALYSIS</h1>
            </div>
          </div>
          <p className="text-white/45 text-base max-w-xl leading-relaxed ml-[52px]">
            Pixel-precise segmentation masks for players, goalkeepers, referees, and the ball. 94.7% mAP50 on real broadcast footage.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="lg:col-span-1 space-y-4">
            <div className="text-xs font-mono text-white/30 uppercase tracking-widest mb-3">Detection classes</div>
            {classes.map(c => (
              <div key={c.label} className="flex items-center gap-3 p-4 rounded-xl"
                style={{ background: `${c.color}08`, border: `1px solid ${c.color}20` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}15`, color: c.color }}>{c.icon}</div>
                <div>
                  <div className="text-sm font-medium text-white/80">{c.label}</div>
                  <div className="text-xs font-mono mt-0.5" style={{ color: `${c.color}80` }}>{c.count}</div>
                </div>
              </div>
            ))}
            <div className="mt-6 rounded-2xl p-5 space-y-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="text-xs font-mono text-white/30 uppercase tracking-widest">Model metrics</div>
              {[
                { label: 'Box mAP50', value: '94.7%', color: '#4ade80' },
                { label: 'Mask mAP50', value: '80.5%', color: '#4ade80' },
                { label: 'Precision', value: '94.7%', color: '#a3e635' },
                { label: 'Recall', value: '92.3%', color: '#a3e635' },
                { label: 'Inference', value: '19.6ms', color: '#86efac' },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between">
                  <span className="text-sm text-white/40">{m.label}</span>
                  <span className="text-sm font-mono font-medium" style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="lg:col-span-2">
            <AnalysisEngine mode="football" />
          </motion.div>
        </div>
      </div>
    </div>
  )
}
