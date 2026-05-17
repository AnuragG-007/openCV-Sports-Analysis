'use client'
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, AlertCircle, RotateCcw } from 'lucide-react'
import { SportMode, MediaType, AnalysisResult } from '@/types'
import { analyzeMedia } from '@/lib/api'
import UploadZone from './UploadZone'
import ResultsPanel from './ResultsPanel'

interface Props { mode: SportMode }

const ACCENT = { football: '#4ade80', f1: '#fb923c' }
const ACCENT_DIM = { football: 'rgba(74,222,128,0.15)', f1: 'rgba(251,146,60,0.15)' }

export default function AnalysisEngine({ mode }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<MediaType | null>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const accent = ACCENT[mode]
  const accentDim = ACCENT_DIM[mode]

  const onFileSelect = useCallback((f: File, mt: MediaType) => {
    setFile(f); setMediaType(mt); setResult(null); setError(null)
  }, [])

  const onClear = useCallback(() => {
    setFile(null); setMediaType(null); setResult(null); setError(null); setProgress(0)
  }, [])

  const runAnalysis = useCallback(async () => {
    if (!file || !mediaType) return
    setLoading(true); setError(null); setProgress(0); setResult(null)
    try {
      const res = await analyzeMedia(file, mode, setProgress)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [file, mediaType, mode])

  const statusText = [
    'Preprocessing frames...',
    'Running YOLO inference...',
    'Applying NMS filtering...',
    'Rendering overlays...',
    'Finalizing results...',
  ][Math.floor(progress / 20)] ?? 'Processing...'

  return (
    <div className="space-y-6">
      {/* Upload */}
      <UploadZone mode={mode} onFileSelect={onFileSelect} selectedFile={file} onClear={onClear} />

      {/* Run button */}
      <AnimatePresence>
        {file && !loading && !result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <button onClick={runAnalysis}
              className="w-full py-4 rounded-2xl font-display text-xl tracking-widest flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: `linear-gradient(135deg, ${accentDim}, rgba(255,255,255,0.04))`,
                border: `1px solid ${accent}50`,
                color: accent,
                boxShadow: `0 0 30px ${accent}15`,
              }}>
              <Play size={18} />
              RUN ANALYSIS
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-6 space-y-4"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-white/50">{statusText}</span>
              <span className="text-sm font-mono" style={{ color: accent }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div className="h-full rounded-full relative overflow-hidden"
                style={{ background: accent }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}>
                <div className="absolute inset-0 shimmer" />
              </motion.div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {['Preprocess', 'Infer', 'NMS', 'Overlay', 'Export'].map((s, i) => (
                <div key={s} className="text-center">
                  <div className="w-full h-0.5 rounded-full mb-1.5 transition-all duration-500"
                    style={{ background: progress > i * 20 ? accent : 'rgba(255,255,255,0.08)' }} />
                  <div className="text-[10px] font-mono"
                    style={{ color: progress > i * 20 ? `${accent}90` : 'rgba(255,255,255,0.2)' }}>{s}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5 flex items-start gap-3"
            style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-red-400 mb-1">Analysis Failed</div>
              <div className="text-sm text-white/50">{error}</div>
            </div>
            <button onClick={() => { setError(null); runAnalysis() }}
              className="flex items-center gap-1.5 text-xs font-mono text-red-400/60 hover:text-red-400 transition-colors">
              <RotateCcw size={12} /> Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accent }} />
                <span className="text-sm font-mono text-white/50">Analysis complete</span>
              </div>
              <button onClick={onClear}
                className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5">
                <RotateCcw size={11} /> New analysis
              </button>
            </div>
            <ResultsPanel result={result} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
