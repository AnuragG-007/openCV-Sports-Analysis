import time
import base64
import logging
import os
import tempfile
from collections import Counter
from typing import List, Dict, Optional, Tuple
import cv2
import numpy as np
import onnxruntime as ort
from app.core.config import settings
from app.models.schemas import Detection, BoundingBox, ModelInfo

log = logging.getLogger(__name__)

# ── Class / colour registries ──────────────────────────────────────────────────
FOOTBALL_CLASSES: Dict[int, str] = {
    0: "ball",
    1: "goalkeeper",
    2: "player",
    3: "referee",
}
F1_CLASSES: Dict[int, str] = {
    0: "alpine",
    1: "astonmartin",
    2: "ferrari",
    3: "haas",
    4: "mclaren",
    5: "mercedes",
    6: "racingbulls",
    7: "redbull",
    8: "sauber",
    9: "williams",
}

# BGR tuples
FOOTBALL_COLORS: Dict[str, Tuple[int, int, int]] = {
    "ball":        (36,  191, 251),
    "goalkeeper":  (248, 140, 129),
    "player":      (128, 222,  74),
    "referee":     (113, 113, 248),
}
F1_COLORS: Dict[str, Tuple[int, int, int]] = {
    "alpine":      (188, 135, 255),
    "astonmartin": ( 94, 101,   0),
    "ferrari":     ( 45,   0, 232),
    "haas":        (189, 186, 182),
    "mclaren":     (  0, 128, 255),
    "mercedes":    (210, 244,  39),
    "racingbulls": (203,  52,  20),
    "redbull":     (198, 113,  54),
    "sauber":      ( 82, 226,  82),
    "williams":    (255, 196, 100),
}

MODEL_INFO: Dict[str, ModelInfo] = {
    "football": ModelInfo(name="YOLOv11x-seg Football", map50=0.947, parameters="62M"),
    "f1":       ModelInfo(name="YOLOv11l F1 Detection",  map50=0.935, parameters="25M"),
}

# ── Colour helpers ─────────────────────────────────────────────────────────────
def _to_hex(bgr: Tuple[int, int, int]) -> str:
    b, g, r = bgr
    return f"#{r:02x}{g:02x}{b:02x}"

def _hex_to_bgr(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    if len(h) != 6:
        return (255, 255, 255)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)

# ── Letterbox ──────────────────────────────────────────────────────────────────
def _letterbox(
    img: np.ndarray, size: int = 640) -> Tuple[np.ndarray, float, int, int]:
    h, w = img.shape[:2]
    scale = min(size / h, size / w)
    nw, nh = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    pad_x, pad_y = (size - nw) // 2, (size - nh) // 2
    canvas[pad_y:pad_y + nh, pad_x:pad_x + nw] = resized
    return canvas, scale, pad_x, pad_y

# ── Preprocess ─────────────────────────────────────────────────────────────────
def preprocess(
    img: np.ndarray, size: int = 640) -> Tuple[np.ndarray, float, int, int]:
    """BGR → RGB → letterbox → normalise → NCHW float32."""
    if img is None or img.size == 0:
        raise ValueError("Empty input image")
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    canvas, scale, pad_x, pad_y = _letterbox(rgb, size)
    blob = canvas.astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))[np.newaxis]   # 1,3,H,W
    return blob, scale, pad_x, pad_y

# ── Output tensor orientation fix ─────────────────────────────────────────────
def _fix_orientation(preds: np.ndarray, nc: int) -> np.ndarray:
    rows, cols = preds.shape
    attr_counts = {4 + nc, 5 + nc, 4 + nc + 32, 5 + nc + 32}
    if rows in attr_counts and cols > rows:
        return preds.T
    return preds

# ── Cross-class IoU NMS (solves the wing/body split problem) ──────────────────
def _iou(b1: np.ndarray, b2: np.ndarray) -> float:
    ix1 = max(b1[0], b2[0]); iy1 = max(b1[1], b2[1])
    ix2 = min(b1[2], b2[2]); iy2 = min(b1[3], b2[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    a1 = (b1[2] - b1[0]) * (b1[3] - b1[1])
    a2 = (b2[2] - b2[0]) * (b2[3] - b2[1])
    union = a1 + a2 - inter
    return inter / union if union > 0 else 0.0

def _cross_class_nms(
    boxes_xyxy: np.ndarray,
    confidences: np.ndarray,
    class_ids: np.ndarray,
    iou_thres: float,
    containment_thres: float = 0.80,
) -> List[int]:
    order = np.argsort(-confidences).tolist()
    keep: List[int] = []
    while order:
        best = order.pop(0)
        keep.append(best)
        surviving = []
        b_best = boxes_xyxy[best]
        area_best = max(1.0, (b_best[2]-b_best[0]) * (b_best[3]-b_best[1]))
        for idx in order:
            b = boxes_xyxy[idx]
            iou = _iou(b_best, b)
            if class_ids[idx] == class_ids[best]:
                if iou > iou_thres:
                    continue
            else:
                area_b = max(1.0, (b[2]-b[0]) * (b[3]-b[1]))
                ix1 = max(b_best[0], b[0]); iy1 = max(b_best[1], b[1])
                ix2 = min(b_best[2], b[2]); iy2 = min(b_best[3], b[3])
                inter = max(0.0, ix2-ix1) * max(0.0, iy2-iy1)
                smaller_area = min(area_best, area_b)
                containment = inter / smaller_area if smaller_area > 0 else 0.0
                if containment > containment_thres:
                    continue
            surviving.append(idx)
        order = surviving
    return keep

# ── Postprocess ────────────────────────────────────────────────────────────────
def postprocess_detections(
    outputs,
    orig_h: int,
    orig_w: int,
    scale: float,
    pad_x: int,
    pad_y: int,
    class_names: Dict[int, str],
    colors: Dict[str, Tuple[int, int, int]],
    conf_thres: float,
    iou_thres: float,
    is_seg: bool = False,
) -> List[Detection]:
    raw = np.asarray(outputs[0])
    raw = np.squeeze(raw)
    if raw.ndim == 1:
        raw = raw.reshape(1, -1)
    if raw.ndim != 2:
        log.error(f"Unexpected pred shape after squeeze: {raw.shape}")
        return []
    nc = len(class_names)
    preds = _fix_orientation(raw, nc)
    min_attrs = 4 + nc
    if preds.shape[1] < min_attrs:
        log.error(f"Pred width {preds.shape[1]} < minimum {min_attrs}")
        return []

    has_obj = (preds.shape[1] >= 5 + nc) and (preds.shape[1] != 4 + nc + 32)
    score_start = 5 if has_obj else 4
    boxes_raw    = preds[:, :4]
    obj          = preds[:, 4].astype(np.float32) if has_obj else np.ones(len(preds), np.float32)
    class_scores = preds[:, score_start:score_start + nc].astype(np.float32)
    class_ids    = np.argmax(class_scores, axis=1).astype(np.int32)
    class_conf   = class_scores[np.arange(len(class_scores)), class_ids]
    confidences  = (obj * class_conf).astype(np.float32)

    mask = confidences >= conf_thres
    if not np.any(mask):
        return []
    boxes_raw   = boxes_raw[mask]
    confidences = confidences[mask]
    class_ids   = class_ids[mask]
    preds_filt  = preds[mask]

    cx, cy, bw, bh = boxes_raw[:,0], boxes_raw[:,1], boxes_raw[:,2], boxes_raw[:,3]
    lx1 = cx - bw / 2;  lx2 = cx + bw / 2
    ly1 = cy - bh / 2;  ly2 = cy + bh / 2
    boxes_xyxy = np.stack([lx1, ly1, lx2, ly2], axis=1)

    keep = _cross_class_nms(
        boxes_xyxy, confidences, class_ids,
        iou_thres=iou_thres,
        containment_thres=0.78,
    )
    if not keep:
        return []

    mask_coeffs = None
    protos      = None
    if is_seg and len(outputs) > 1:
        mask_start = score_start + nc
        if preds_filt.shape[1] >= mask_start + 32:
            mask_coeffs = preds_filt[np.array(keep), mask_start:mask_start + 32].astype(np.float32)
            proto_raw = np.asarray(outputs[1])
            proto_raw = np.squeeze(proto_raw)
            if proto_raw.ndim == 4:
                proto_raw = proto_raw[0]
            if proto_raw.ndim == 3 and proto_raw.shape[0] != 32:
                proto_transpose = np.transpose(proto_raw, (2, 0, 1))
            protos = proto_raw.astype(np.float32)

    detections: List[Detection] = []
    inp = settings.input_size
    for enum_i, orig_i in enumerate(keep):
        cid   = int(class_ids[orig_i])
        cname = class_names.get(cid, f"class_{cid}")
        color_bgr = colors.get(cname, (255, 255, 255))
        color_hex = _to_hex(color_bgr)

        rx1 = np.clip((lx1[orig_i] - pad_x) / scale, 0, orig_w)
        ry1 = np.clip((ly1[orig_i] - pad_y) / scale, 0, orig_h)
        rx2 = np.clip((lx2[orig_i] - pad_x) / scale, 0, orig_w)
        ry2 = np.clip((ly2[orig_i] - pad_y) / scale, 0, orig_h)

        det_mask_points: Optional[List[List[float]]] = None
        if is_seg and mask_coeffs is not None and protos is not None:
            try:
                coeffs = mask_coeffs[enum_i]
                ph, pw = protos.shape[1], protos.shape[2]
                proto_flat = protos.reshape(32, -1)
                raw_mask   = coeffs @ proto_flat
                raw_mask   = raw_mask.reshape(ph, pw)
                raw_mask = 1.0 / (1.0 + np.exp(-raw_mask))
                factor_x = inp / pw
                factor_y = inp / ph
                box_x1p = int(lx1[orig_i] / factor_x)
                box_y1p = int(ly1[orig_i] / factor_y)
                box_x2p = int(np.ceil(lx2[orig_i] / factor_x))
                box_y2p = int(np.ceil(ly2[orig_i] / factor_y))
                box_x1p = max(0, min(box_x1p, pw))
                box_y1p = max(0, min(box_y1p, ph))
                box_x2p = max(0, min(box_x2p, pw))
                box_y2p = max(0, min(box_y2p, ph))
                cropped_mask = raw_mask.copy()
                cropped_mask[:box_y1p, :] = 0
                cropped_mask[box_y2p:, :] = 0
                cropped_mask[:, :box_x1p] = 0
                cropped_mask[:, box_x2p:] = 0
                mask_inp = cv2.resize(cropped_mask, (inp, inp), interpolation=cv2.INTER_LINEAR)
                x_start = pad_x;  x_end = inp - pad_x
                y_start = pad_y;  y_end = inp - pad_y
                mask_unpad = mask_inp[y_start:y_end, x_start:x_end]
                if mask_unpad.size == 0:
                    raise ValueError("Empty mask after unpad")
                final_mask = cv2.resize(mask_unpad, (orig_w, orig_h), interpolation=cv2.INTER_LINEAR)
                binary     = (final_mask > 0.5).astype(np.uint8) * 255
                contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if contours:
                    best_cnt = max(contours, key=cv2.contourArea)
                    if cv2.contourArea(best_cnt) > 50:
                        det_mask_points = best_cnt.reshape(-1, 2).astype(float).tolist()
            except Exception as exc:
                log.debug(f"Mask generation failed for {cname}: {exc}")
                det_mask_points = None

        detections.append(Detection(
            class_id=cid,
            class_name=cname,
            confidence=float(confidences[orig_i]),
            bbox=BoundingBox(x1=float(rx1), y1=float(ry1), x2=float(rx2), y2=float(ry2)),
            mask_points=det_mask_points,
            color=color_hex,
        ))
    return detections

# ── Draw ───────────────────────────────────────────────────────────────────────
def draw_detections(
    img: np.ndarray,
    detections: List[Detection],
    is_seg: bool = False,
) -> np.ndarray:
    if img is None or img.size == 0:
        return img
    out = img.copy()
    if is_seg:
        mask_layer = np.zeros_like(out, dtype=np.uint8)
        for det in detections:
            if det.mask_points is None or len(det.mask_points) < 3:
                continue
            color_bgr = _hex_to_bgr(det.color or "#ffffff")
            pts = np.array(det.mask_points, dtype=np.int32).reshape(-1, 1, 2)
            cv2.fillPoly(mask_layer, [pts], color_bgr)
        nonzero = np.any(mask_layer > 0, axis=-1)
        blended = cv2.addWeighted(mask_layer, 0.40, out, 0.60, 0)
        out[nonzero] = blended[nonzero]
        for det in detections:
            if det.mask_points is None or len(det.mask_points) < 3:
                continue
            color_bgr = _hex_to_bgr(det.color or "#ffffff")
            pts = np.array(det.mask_points, dtype=np.int32).reshape(-1, 1, 2)
            cv2.polylines(out, [pts], True, color_bgr, 2, cv2.LINE_AA)

    for det in detections:
        color_bgr = _hex_to_bgr(det.color or "#ffffff")
        x1 = int(round(det.bbox.x1));  y1 = int(round(det.bbox.y1))
        x2 = int(round(det.bbox.x2));  y2 = int(round(det.bbox.y2))
        h, w = out.shape[:2]
        x1 = max(0, min(x1, w-1));  y1 = max(0, min(y1, h-1))
        x2 = max(0, min(x2, w));    y2 = max(0, min(y2, h))
        thickness = 2 if is_seg else 3
        cv2.rectangle(out, (x1, y1), (x2, y2), color_bgr, thickness)
        label     = f"{det.class_name.upper()}  {det.confidence:.2f}"
        font      = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.48
        (tw, th), baseline = cv2.getTextSize(label, font, font_scale, 1)
        pad       = 5
        text_y    = max(y1, th + pad * 2)
        cv2.rectangle(
            out,
            (x1, text_y - th - pad * 2),
            (x1 + tw + pad * 2, text_y),
            color_bgr, -1,
        )
        cv2.putText(
            out, label,
            (x1 + pad, text_y - pad),
            font, font_scale,
            (255, 255, 255), 1, cv2.LINE_AA,
        )
    return out

# ── Encode ─────────────────────────────────────────────────────────────────────
def encode_image_b64(img: np.ndarray) -> str:
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buf.tobytes()).decode()

# ── Public Image Inference entrypoint ──────────────────────────────────────────
def run_image_inference(
    session: ort.InferenceSession,
    img_bytes: bytes,
    mode: str,
) -> Tuple[List[Detection], np.ndarray, float, Dict[str, int]]:
    nparr = np.frombuffer(img_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    orig_h, orig_w = img.shape[:2]
    is_seg         = (mode == "football")
    class_names    = FOOTBALL_CLASSES if is_seg else F1_CLASSES
    colors         = FOOTBALL_COLORS  if is_seg else F1_COLORS
    blob, scale, pad_x, pad_y = preprocess(img, settings.input_size)
    input_name = session.get_inputs()[0].name
    t0         = time.perf_counter()
    outputs    = session.run(None, {input_name: blob})
    latency_ms = (time.perf_counter() - t0) * 1000.0

    detections = postprocess_detections(
        outputs     = outputs,
        orig_h      = orig_h,
        orig_w      = orig_w,
        scale       = scale,
        pad_x       = pad_x,
        pad_y       = pad_y,
        class_names = class_names,
        colors      = colors,
        conf_thres  = settings.conf_threshold,
        iou_thres   = settings.iou_threshold,
        is_seg      = is_seg,
    )
    class_counts = dict(Counter(d.class_name for d in detections))
    annotated    = draw_detections(img.copy(), detections, is_seg=is_seg)
    return detections, annotated, latency_ms, class_counts

# ── NEW: Public Video Inference Entrypoint (With Frame Caching) ────────────────
def run_video_inference(
    session: ort.InferenceSession,
    video_bytes: bytes,
    mode: str,
    infer_every_n_frames: int = 6, # Run model on 1 out of 6 frames (~5fps tracking lookups)
) -> bytes:
    """
    Processes an uploaded video byte stream frame-by-frame on CPU.
    Utilizes inference hysteresis to drastically minimize computation times.
    Returns raw binary bytes of the finalized .mp4 video file.
    """
    # Create isolated secure temp files for input/output processing paths
    input_temp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    output_temp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    
    try:
        input_temp.write(video_bytes)
        input_temp.close()
        
        cap = cv2.VideoCapture(input_temp.name)
        if not cap.isOpened():
            raise ValueError("Failed to open video source stream matrix")
            
        # Extract native target meta properties
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Initialize video writer engine using browser-friendly container configurations
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out_writer = cv2.VideoWriter(output_temp.name, fourcc, fps, (width, height))
        
        is_seg = (mode == "football")
        class_names = FOOTBALL_CLASSES if is_seg else F1_CLASSES
        colors = FOOTBALL_COLORS if is_seg else F1_COLORS
        input_name = session.get_inputs()[0].name
        
        frame_idx = 0
        cached_detections: List[Detection] = []
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            # INFERENCE HYSTERESIS STEP: Only fire the heavy ONNX model on designated steps
            if frame_idx % infer_every_n_frames == 0 or len(cached_detections) == 0:
                blob, scale, pad_x, pad_y = preprocess(frame, settings.input_size)
                outputs = session.run(None, {input_name: blob})
                
                cached_detections = postprocess_detections(
                    outputs     = outputs,
                    orig_h      = height,
                    orig_w      = width,
                    scale       = scale,
                    pad_x       = pad_x,
                    pad_y       = pad_y,
                    class_names = class_names,
                    colors      = colors,
                    conf_thres  = settings.conf_threshold,
                    iou_thres   = settings.iou_threshold,
                    is_seg      = is_seg,
                )
            
            # Instantly paint detections (cached or new) directly on the current frame canvas
            annotated_frame = draw_detections(frame, cached_detections, is_seg=is_seg)
            out_writer.write(annotated_frame)
            frame_idx += 1
            
        cap.release()
        out_writer.release()
        
        # Read the generated temp video file back into memory bytes
        with open(output_temp.name, "rb") as f:
            processed_video_bytes = f.read()
            
        return processed_video_bytes

    finally:
        # Clean up files immediately to keep storage clear on Hugging Face
        if os.path.exists(input_temp.name):
            os.unlink(input_temp.name)
        if os.path.exists(output_temp.name):
            os.unlink(output_temp.name)