import io
from collections import Counter
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse

from app.models.schemas import AnalysisResult, SportMode, MediaType, ModelInfo
from app.utils.inference import (
    run_image_inference, encode_image_b64,
    FOOTBALL_COLORS, F1_COLORS, MODEL_INFO
)
from app.core.config import settings

router = APIRouter()

MAX_SIZES = {
    'image': settings.max_image_size_mb * 1024 * 1024,
    'video': settings.max_video_size_mb * 1024 * 1024,
}

@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    mode: SportMode = Form(...),
):
    # ── Determine media type ──────────────────────────────────────────────────
    ct = file.content_type or ''
    if ct.startswith('video/'):
        media_type = MediaType.video
    elif ct.startswith('image/'):
        media_type = MediaType.image
    else:
        raise HTTPException(400, "Unsupported file type. Upload an image or video.")

    # ── Read & size-check ─────────────────────────────────────────────────────
    raw = await file.read()
    limit = MAX_SIZES[media_type.value]
    if len(raw) > limit:
        mb = limit // (1024 * 1024)
        raise HTTPException(413, f"File too large. Max {mb}MB for {media_type.value}.")

    # ── Pick session ──────────────────────────────────────────────────────────
    state = request.app.state
    if mode == SportMode.football:
        session = state.football_session
    else:
        session = state.f1_session

    if session is None:
        raise HTTPException(503, f"Model for '{mode}' is not loaded. Check server logs.")

    # ── Inference ─────────────────────────────────────────────────────────────
    if media_type == MediaType.image:
        try:
            detections, annotated_img, ms = run_image_inference(session, raw, mode.value)
        except Exception as e:
            raise HTTPException(500, f"Inference failed: {str(e)}")

        img_b64 = encode_image_b64(annotated_img)
        class_counts = dict(Counter(d.class_name for d in detections))

        return AnalysisResult(
            mode=mode,
            media_type=media_type,
            original_filename=file.filename or "upload",
            processed_image_b64=img_b64,
            detections=detections,
            inference_time_ms=ms,
            total_detections=len(detections),
            class_counts=class_counts,
            model_info=MODEL_INFO[mode.value],
        )

    # Video: return placeholder (full video processing requires background task)
    raise HTTPException(501, "Video processing coming soon. Please upload an image frame for now.")
