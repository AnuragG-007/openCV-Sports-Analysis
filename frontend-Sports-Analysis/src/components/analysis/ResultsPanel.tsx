'use client'
import { useState, useEffect } from 'react'
import { AnalysisResult, F1_TEAM_COLORS, FOOTBALL_CLASS_COLORS } from '@/types'
import { Clock, Target, Layers, ChevronRight, Video } from 'lucide-react'

interface Props { result: AnalysisResult }

export default function ResultsPanel({ result }: Props) {
  const isFootball = result.mode === 'football'
  const accent = isFootball ? '#4ade80' : '#fb923c'
  const classColors = isFootball ? FOOTBALL_CLASS_COLORS : F1_TEAM_COLORS
  
  const [mediaSrc, setMediaSrc] = useState<string | null>(null)
  const isVideo = result.media_type === 'video' || !!result.processed_video_url

  useEffect(() => {
    const rawString = isVideo ? result.processed_video_url : result.processed_image_b64
    if (!rawString) return

    let objectUrl = ''

    try {
      // If the string is already a structured Data URI, extract the raw base64 part
      const base64Data = rawString.includes(',') ? rawString.split(',')[1] : rawString
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg'
      
      // Convert base64 to binary data safe for HTML5 media players
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: mimeType })
      
      // Create a lightweight DOM string pointing to the data block
      objectUrl = URL.createObjectURL(blob)
      setMediaSrc(objectUrl)
    } catch (error) {
      console.error("Failed to parse incoming streaming base64 payload:", error)
    }

    // Clean up to prevent client-side browser memory leaks
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [result, isVideo])

  const topDetections = result.detections
    ? [...result.detections].sort((a, b) => b.confidence - a.confidence).slice(0, 8)
    : []

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Clock size={14} />, label: 'Inference', value: `${result.inference_time_ms.toFixed(1)}ms` },
          { icon: <Target size={14} />, label: 'Detections', value: result.total_detections },
          { icon: <Layers size={14} />, label: 'Classes', value: result.class_counts ? Object.keys(result.class_counts).length : 0 },
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

      {/* Media Content Display Block */}
      {mediaSrc && (
        <div className="rounded-2xl overflow-hidden border border-white/5 bg-zinc-950/40">
          <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isVideo ? (
                <Video size={12} style={{ color: accent }} />
              ) : (
                <Layers size={12} style={{ color: accent }} />
              )}
              <span className="text-xs font-mono text-white/40">
                {isVideo ? 'Processed tracking clip' : 'Processed canvas output'}
              </span>
            </div>
            <a 
              href={mediaSrc} 
              download={isVideo ? "sportvision-tracking.mp4" : "sportvision-result.jpg"}
              className="text-xs font-mono px-3 py-1.5 rounded-lg transition-all hover:bg-white/8"
              style={{ color: accent }}
            >
              Download ↓
            </a>
          </div>

          <div className="relative w-full flex items-center justify-center bg-black overflow-hidden max-h-[480px]">
            {isVideo ? (
              <video
                src={mediaSrc}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain max-h-[480px]"
              />
            ) : (
              <img 
                src={mediaSrc} 
                alt="Analysis result canvas" 
                className="w-full object-contain max-h-[480px]" 
              />
            )}
          </div>
        </div>
      )}

      {/* Class breakdown */}
      {result.class_counts && Object.keys(result.class_counts).length > 0 && (
        <div className="rounded-2xl border border-white/5 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-5 py-4 border-b border-white/5">
            <span className="text-sm font-medium text-white/70">Detection metrics distribution</span>
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
      )}

      {/* Top detections list */}
      {topDetections.length > 0 && (
        <div className="rounded-2xl border border-white/5 overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="px-5 py-4 border-b border-white/5">
            <span className="text-sm font-medium text-white/70">Top analytics targets by threshold</span>
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
      )}

      {/* Model info footer */}
      {result.model_info && (
        <div className="rounded-xl px-5 py-4 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <div className="text-xs font-mono text-white/30">Target Model Registry</div>
            <div className="text-sm text-white/60 mt-0.5">{result.model_info.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono text-white/30">mAP50 Accuracy</div>
            <div className="font-display text-xl tracking-wider" style={{ color: accent }}>
              {(result.model_info.map50 * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
