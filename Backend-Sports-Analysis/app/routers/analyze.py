import os
import uuid
import asyncio
import logging
import tempfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, UploadFile, HTTPException, Request

from app.models.schemas import AnalysisResult, SportMode, MediaType
from app.utils.inference import (
    run_image_inference,
    encode_image_b64,
    MODEL_INFO,
    preprocess,
    postprocess_detections,
    draw_detections,
    FOOTBALL_CLASSES, F1_CLASSES,
    FOOTBALL_COLORS,  F1_COLORS,
)
from app.core.config import settings

log = logging.getLogger("uvicorn.error")
router = APIRouter()

# One thread pool shared across requests — inference is CPU/GPU bound
_executor = ThreadPoolExecutor(max_workers=2)

MAX_SIZES = {
    "image": settings.max_image_size_mb * 1024 * 1024,
    "video": settings.max_video_size_mb * 1024 * 1024,
}

# ── Video tuning knobs ─────────────────────────────────────────────────────────
PROCESS_EVERY_N   = 2      # run inference every N frames; skipped frames reuse last result
MAX_FRAMES_CAP    = 3000   # safety cap — stops processing after this many source frames


# ── Media type detection ───────────────────────────────────────────────────────
def _get_media_type(content_type: str, filename: str) -> MediaType:
    ct = (content_type or "").lower()
    fn = (filename    or "").lower()
    if ct.startswith("video/") or any(fn.endswith(e) for e in (".mp4",".mov",".avi",".mkv",".webm")):
        return MediaType.video
    if ct.startswith("image/") or any(fn.endswith(e) for e in (".jpg",".jpeg",".png",".bmp",".webp")):
        return MediaType.image
    raise HTTPException(400, "Unsupported file type. Upload an image (JPG/PNG) or video (MP4/MOV/AVI/MKV/WEBM).")


# ── Video worker (runs in thread pool) ────────────────────────────────────────
def _process_video_sync(raw_bytes: bytes, mode: str, session) -> tuple:
    """
    Annotates every frame of the video and returns:
      (video_data_uri, all_detections, class_counts, avg_latency_ms, frames_processed)
    """
    import time, base64

    is_seg      = (mode == "football")
    class_names = FOOTBALL_CLASSES if is_seg else F1_CLASSES
    colors      = FOOTBALL_COLORS  if is_seg else F1_COLORS
    inp         = settings.input_size
    input_name  = session.get_inputs()[0].name

    # Dump bytes to a temp file — OpenCV needs a seekable file path
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_in:
        tmp_in.write(raw_bytes)
        in_path = tmp_in.name
    out_path = in_path.replace(".mp4", "_annotated.mp4")

    try:
        cap = cv2.VideoCapture(in_path)
        if not cap.isOpened():
            raise ValueError("OpenCV could not open the video — unsupported codec or corrupted file.")

        src_fps   = cap.get(cv2.CAP_PROP_FPS) or 30.0
        src_w     = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        src_h     = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        src_total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        log.info(f"[video:{mode}] {src_w}x{src_h} @ {src_fps:.1f}fps  frames={src_total}")

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(out_path, fourcc, src_fps, (src_w, src_h))

        all_detections   = []
        latencies        = []
        frame_idx        = 0
        last_annotated   = None   # last fully-annotated frame; reused for skipped frames

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx >= MAX_FRAMES_CAP:
                log.warning(f"[video:{mode}] Reached frame cap {MAX_FRAMES_CAP}, stopping early.")
                break

            if frame_idx % PROCESS_EVERY_N == 0:
                blob, scale, pad_x, pad_y = preprocess(frame, inp)

                t0      = time.perf_counter()
                outputs = session.run(None, {input_name: blob})
                latencies.append((time.perf_counter() - t0) * 1000.0)

                dets = postprocess_detections(
                    outputs=outputs,
                    orig_h=src_h, orig_w=src_w,
                    scale=scale, pad_x=pad_x, pad_y=pad_y,
                    class_names=class_names, colors=colors,
                    conf_thres=settings.conf_threshold,
                    iou_thres=settings.iou_threshold,
                    is_seg=is_seg,
                )
                all_detections.extend(dets)
                last_annotated = draw_detections(frame.copy(), dets, is_seg=is_seg)
            
            # Write the last annotated frame (smooth output even on skipped frames)
            writer.write(last_annotated if last_annotated is not None else frame)
            frame_idx += 1

        cap.release()
        writer.release()

        # Read output file → base64 data URI (frontend uses it directly as <video src>)
        with open(out_path, "rb") as f:
            video_b64 = "data:video/mp4;base64," + base64.b64encode(f.read()).decode()

        avg_lat      = float(np.mean(latencies)) if latencies else 0.0
        class_counts = dict(Counter(d.class_name for d in all_detections))

        return video_b64, all_detections, class_counts, avg_lat, frame_idx

    finally:
        for p in (in_path, out_path):
            try:
                os.unlink(p)
            except OSError:
                pass


# ── Router ─────────────────────────────────────────────────────────────────────
@router.post("/analyze", response_model=AnalysisResult)
async def analyze(
    request: Request,
    file: UploadFile = File(...),
    mode: SportMode  = Form(...),
):
    # 1. Detect media type
    media_type = _get_media_type(file.content_type or "", file.filename or "")

    # 2. Read & size-check
    raw = await file.read()
    limit = MAX_SIZES[media_type.value]
    if len(raw) > limit:
        mb = limit // (1024 * 1024)
        raise HTTPException(413, f"File too large. Max {mb} MB for {media_type.value}.")

    # 3. Pick ONNX session
    state   = request.app.state
    session = state.football_session if mode == SportMode.football else state.f1_session
    if session is None:
        raise HTTPException(503, f"Model for '{mode}' is not loaded. Check server logs.")

    # ── Image ──────────────────────────────────────────────────────────────────
    if media_type == MediaType.image:
        try:
            detections, annotated_img, ms, class_counts = run_image_inference(
                session, raw, mode.value
            )
        except Exception as exc:
            log.error("Image inference error", exc_info=True)
            raise HTTPException(500, f"Inference failed: {exc}")

        return AnalysisResult(
            mode                = mode,
            media_type          = media_type,
            original_filename   = file.filename or "upload",
            processed_image_b64 = encode_image_b64(annotated_img),
            processed_video_url = None,
            detections          = detections,
            inference_time_ms   = ms,
            total_detections    = len(detections),
            class_counts        = class_counts,
            model_info          = MODEL_INFO[mode.value],
        )

    # ── Video ──────────────────────────────────────────────────────────────────
    try:
        loop = asyncio.get_event_loop()
        video_b64, detections, class_counts, avg_lat, frame_count = await loop.run_in_executor(
            _executor, _process_video_sync, raw, mode.value, session
        )
    except Exception as exc:
        log.error("Video inference error", exc_info=True)
        raise HTTPException(500, f"Video processing failed: {exc}")

    log.info(f"[video:{mode}] complete — {frame_count} frames, {len(detections)} detections")

    return AnalysisResult(
        mode                = mode,
        media_type          = media_type,
        original_filename   = file.filename or "upload",
        processed_image_b64 = None,
        processed_video_url = video_b64,
        detections          = detections,
        inference_time_ms   = avg_lat,
        total_detections    = len(detections),
        class_counts        = class_counts,
        model_info          = MODEL_INFO[mode.value],
    )