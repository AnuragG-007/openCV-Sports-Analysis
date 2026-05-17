import { AnalysisResult, SportMode } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export async function analyzeMedia(
  file: File,
  mode: SportMode,
  onProgress?: (pct: number) => void
): Promise<AnalysisResult> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('mode', mode)

  // Simulate progress ticks while waiting
  let pct = 0
  const ticker = setInterval(() => {
    pct = Math.min(pct + Math.random() * 8, 88)
    onProgress?.(pct)
  }, 400)

  try {
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      body: formData,
    })
    clearInterval(ticker)
    onProgress?.(100)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Unknown error' }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    return res.json()
  } catch (e) {
    clearInterval(ticker)
    throw e
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch {
    return false
  }
}
