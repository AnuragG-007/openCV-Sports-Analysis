export type SportMode = 'football' | 'f1'
export type MediaType = 'image' | 'video'

export interface BoundingBox {
  x1: number; y1: number; x2: number; y2: number
}

export interface Detection {
  class_id: number
  class_name: string
  confidence: number
  bbox: BoundingBox
  mask_points?: number[][]
  color?: string
}

export interface AnalysisResult {
  mode: SportMode
  media_type: MediaType
  original_filename: string
  processed_image_b64?: string
  processed_video_url?: string
  detections: Detection[]
  inference_time_ms: number
  total_detections: number
  class_counts: Record<string, number>
  model_info: {
    name: string
    map50: number
    parameters: string
  }
}

export interface UploadState {
  file: File | null
  preview: string | null
  mediaType: MediaType | null
  uploading: boolean
  error: string | null
}

export const F1_TEAM_COLORS: Record<string, string> = {
  alpine: '#FF87BC',
  astonmartin: '#00665E',
  ferrari: '#E8002D',
  haas: '#B6BABD',
  mclaren: '#FF8000',
  mercedes: '#27F4D2',
  racingbulls: '#1434CB',
  redbull: '#3671C6',
  sauber: '#52E252',
  williams: '#64C4FF',
}

export const FOOTBALL_CLASS_COLORS: Record<string, string> = {
  ball: '#FBBF24',
  goalkeeper: '#818CF8',
  player: '#4ADE80',
  referee: '#F87171',
}
