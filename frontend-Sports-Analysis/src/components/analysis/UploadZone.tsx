'use client'
import { useCallback, useState } from 'react'
import { Upload, ImageIcon, Film, X } from 'lucide-react'
import { cn, formatFileSize } from '@/lib/utils'
import { SportMode, MediaType } from '@/types'

interface Props {
  mode: SportMode
  onFileSelect: (file: File, mediaType: MediaType) => void
  selectedFile: File | null
  onClear: () => void
}

const ACCENT = { football: '#4ade80', f1: '#fb923c' }
const MAX_IMAGE = 20 * 1024 * 1024
const MAX_VIDEO = 200 * 1024 * 1024

export default function UploadZone({ mode, onFileSelect, selectedFile, onClear }: Props) {
  const [drag, setDrag] = useState(false)
  const accent = ACCENT[mode]

  const processFile = useCallback((file: File) => {
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) return
    const limit = isVideo ? MAX_VIDEO : MAX_IMAGE
    if (file.size > limit) return
    onFileSelect(file, isVideo ? 'video' : 'image')
  }, [onFileSelect])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  if (selectedFile) {
    return (
      <div className="rounded-2xl border p-6 flex items-center justify-between"
        style={{ borderColor: `${accent}40`, background: `${accent}08` }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${accent}15` }}>
            {selectedFile.type.startsWith('video/') ? (
              <Film size={22} style={{ color: accent }} />
            ) : (
              <ImageIcon size={22} style={{ color: accent }} />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-white/90 truncate max-w-[260px]">{selectedFile.name}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: accent }}>
              {formatFileSize(selectedFile.size)} · {selectedFile.type.startsWith('video/') ? 'Video' : 'Image'}
            </div>
          </div>
        </div>
        <button onClick={onClear}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <label
      className={cn('upload-zone rounded-2xl flex flex-col items-center justify-center py-16 px-8 cursor-pointer text-center', drag && 'drag-active')}
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}>
      <input type="file" className="hidden" accept="image/*,video/*" onChange={onInput} />

      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300"
        style={{ background: drag ? `${accent}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${drag ? accent : 'rgba(255,255,255,0.1)'}` }}>
        <Upload size={26} style={{ color: drag ? accent : 'rgba(255,255,255,0.35)' }} />
      </div>

      <p className="text-white/70 text-base mb-2">Drop your file here, or <span style={{ color: accent }}>browse</span></p>
      <p className="text-xs text-white/30 font-mono">Images up to 20MB · Videos up to 200MB</p>
      <p className="text-xs text-white/20 font-mono mt-1">JPG, PNG, MP4, MOV, AVI</p>
    </label>
  )
}
