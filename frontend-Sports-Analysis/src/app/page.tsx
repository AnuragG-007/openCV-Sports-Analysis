'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Zap, Shield, Activity } from 'lucide-react'

const stats = [
  { label: 'mAP50 Football', value: '94.7%' },
  { label: 'mAP50 F1', value: '93.5%' },
  { label: 'Inference Speed', value: '19.6ms' },
  { label: 'Model Parameters', value: '62M' },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <main className="min-h-screen bg-[#080808] relative overflow-hidden">
      <div className="scanline" />

      {/* Background radial glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(22,163,74,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 70%)' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #16a34a, #f97316)' }}>
            <Activity size={16} className="text-white" />
          </div>
          <span className="font-display text-xl tracking-widest text-white">SPORTVISION</span>
          <span className="text-xs font-mono text-white/30 mt-1">AI</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-white/50">
          <Link href="/football" className="hover:text-white transition-colors">Football</Link>
          <Link href="/f1" className="hover:text-white transition-colors">Formula 1</Link>
          <a href="https://github.com" target="_blank" rel="noreferrer"
            className="px-4 py-2 rounded-lg border border-white/10 hover:border-white/25 transition-all text-white/70 hover:text-white">
            GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-8 text-center">
        <motion.div initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 text-xs font-mono text-white/50 mb-8 bg-white/3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Models loaded · Ready for inference
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1 }}
          className="font-display text-[clamp(64px,12vw,140px)] leading-none text-white mb-6"
          style={{ letterSpacing: '0.01em' }}>
          SPORT<br />
          <span style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)', color: 'transparent' }}>VISION</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 }}
          className="text-white/50 text-lg max-w-xl mb-12 leading-relaxed">
          Real-time computer vision analytics for football and Formula 1.
          Instance segmentation, object detection, and live overlay — powered by YOLOv11.
        </motion.p>

        {/* CTA Cards */}
        <motion.div
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 mb-20">

          <Link href="/football">
            <div className="group relative px-8 py-5 rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.15), rgba(22,163,74,0.05))', border: '1px solid rgba(22,163,74,0.3)' }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(135deg, rgba(22,163,74,0.25), rgba(22,163,74,0.08))' }} />
              <div className="relative flex items-center gap-4">
                <div className="text-4xl">⚽</div>
                <div className="text-left">
                  <div className="font-display text-xl text-green-400 tracking-wider">FOOTBALL</div>
                  <div className="text-sm text-white/50">Instance Segmentation</div>
                </div>
                <ArrowRight size={18} className="text-green-400/60 group-hover:translate-x-1 transition-transform ml-4" />
              </div>
            </div>
          </Link>

          <Link href="/f1">
            <div className="group relative px-8 py-5 rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))', border: '1px solid rgba(249,115,22,0.3)' }}>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.25), rgba(249,115,22,0.08))' }} />
              <div className="relative flex items-center gap-4">
                <div className="text-4xl">🏎️</div>
                <div className="text-left">
                  <div className="font-display text-xl text-orange-400 tracking-wider">FORMULA 1</div>
                  <div className="text-sm text-white/50">Object Detection</div>
                </div>
                <ArrowRight size={18} className="text-orange-400/60 group-hover:translate-x-1 transition-transform ml-4" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.6 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5 w-full max-w-2xl">
          {stats.map((s) => (
            <div key={s.label} className="bg-[#080808] px-6 py-4 text-center">
              <div className="font-display text-2xl text-white tracking-wider">{s.value}</div>
              <div className="text-xs text-white/35 font-mono mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features strip */}
      <section className="relative z-10 border-t border-white/5 px-8 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { icon: <Zap size={20} />, title: 'Sub-20ms Inference', desc: 'YOLOv11x-seg optimised ONNX runtime. Real-time processing on GPU.' },
            { icon: <Shield size={20} />, title: 'Dual Model Pipeline', desc: 'Separate fine-tuned models per sport. Football masks + F1 bounding boxes.' },
            { icon: <Activity size={20} />, title: 'Live Confidence Scores', desc: 'Per-detection confidence, class labels, and mask overlay visualisation.' },
          ].map((f, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.1 }}
              className="p-6 rounded-2xl border border-white/5 bg-white/2">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-4 text-white/60">{f.icon}</div>
              <div className="font-display text-lg text-white tracking-wider mb-2">{f.title}</div>
              <div className="text-sm text-white/40 leading-relaxed">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  )
}
