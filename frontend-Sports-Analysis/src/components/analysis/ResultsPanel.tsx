'use client'
import { AnalysisResult, F1_TEAM_COLORS, FOOTBALL_CLASS_COLORS } from '@/types'
import { base64ToUrl } from '@/lib/utils'
import { Clock, Target, Layers, ChevronRight } from 'lucide-react'

interface Props { result: AnalysisResult }

export default function ResultsPanel({ result }: Props) {
  const isFootball = result.mode === 'football'
  const accent = isFootball ? '#4ade80' : '#fb923c'
  const classColors = isFootball ? FOOTBALL_CLASS_COLORS : F1_TEAM_COLORS
  const imgSrc = result.processed_image_b64 ? base64ToUrl(result.processed_image_b64) : null

  const topDetections = result.detections
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8)

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Clock size={14} />, label: 'Inference', value: `${result.inference_time_ms.toFixed(1)}ms` },
          { icon: <Target size={14} />, label: 'Detections', value: result.total_detections },
          { icon: <Layers size={14} />, label: 'Classes', value: Object.keys(result.class_counts).length },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-center gap-1.5 mb-2" style={{ color: `${accent}80` }}>
              {s.icon}
              <span className="text-xs font-mono text-white/30">{s.label}</span>
            </div>
            <div className="font-display text-2xl tracking-wider text-white">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Processed image */}
      {imgSrc && (
        <div className="rounded-2xl overflow-hidden border border-white/5">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <span className="text-xs font-mono text-white/40">Processed output</span>
            <a href={imgSrc} download="sportvision-result.jpg"
              className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all hover:bg-white/8"
              style={{ color: accent }}>
              Download ↓
            </a>
          </div>
          <img src={imgSrc} alt="Analysis result" className="w-full object-contain max-h-[480px] bg-black" />
        </div>
      )}

      {/* Class breakdown */}
      <div className="rounded-2xl border border-white/5 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-5 py-4 border-b border-white/5">
          <span className="text-sm font-medium text-white/70">Detection breakdown</span>
        </div>
        <div className="p-4 space-y-3">
          {Object.entries(result.class_counts).map(([cls, count]) => {
            const color = classColors[cls.toLowerCase()] || accent
            const maxCount = Math.max(...Object.values(result.class_counts))
            const pct = (count / maxCount) * 100
            return (
              <div key={cls} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-sm text-white/70 capitalize">{cls}</span>
                  </div>
                  <span className="text-sm font-mono" style={{ color }}>{count}</span>
                </div>
                <div className="h-1 rounded-full bg-white/5">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color, opacity: 0.7 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top detections list */}
      <div className="rounded-2xl border border-white/5 overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="px-5 py-4 border-b border-white/5">
          <span className="text-sm font-medium text-white/70">Top detections by confidence</span>
        </div>
        <div className="divide-y divide-white/3">
          {topDetections.map((det, i) => {
            const color = classColors[det.class_name.toLowerCase()] || accent
            const confPct = (det.confidence * 100).toFixed(1)
            return (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono flex-shrink-0"
                  style={{ background: `${color}20`, color }}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/80 capitalize">{det.class_name}</span>
                    <span className="text-xs font-mono" style={{ color }}>{confPct}%</span>
                  </div>
                  <div className="h-0.5 rounded-full bg-white/5 mt-1.5">
                    <div className="h-full rounded-full" style={{ width: `${confPct}%`, background: color, opacity: 0.6 }} />
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
              </div>
            )
          })}
        </div>
      </div>

      {/* Model info footer */}
      <div className="rounded-xl px-5 py-4 flex items-center justify-between"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <div className="text-xs font-mono text-white/30">Model</div>
          <div className="text-sm text-white/60 mt-0.5">{result.model_info.name}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-white/30">mAP50</div>
          <div className="font-display text-xl tracking-wider" style={{ color: accent }}>
            {(result.model_info.map50 * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}
