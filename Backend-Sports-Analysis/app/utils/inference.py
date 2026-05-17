import time
import base64
import cv2
import numpy as np
from typing import Optional
import onnxruntime as ort

from app.models.schemas import Detection, BoundingBox, AnalysisResult, ModelInfo, SportMode, MediaType
from app.core.config import settings

# ── Class definitions ──────────────────────────────────────────────────────────
FOOTBALL_CLASSES = {0: 'ball', 1: 'goalkeeper', 2: 'player', 3: 'referee'}
F1_CLASSES = {
    0: 'alpine', 1: 'astonmartin', 2: 'ferrari', 3: 'haas',
    4: 'mclaren', 5: 'mercedes', 6: 'racingbulls', 7: 'redbull',
    8: 'sauber', 9: 'williams'
}
FOOTBALL_COLORS = {
    'ball': (251, 191, 36), 'goalkeeper': (129, 140, 248),
    'player': (74, 222, 128), 'referee': (248, 113, 113)
}
F1_COLORS = {
    'alpine': (255, 135, 188), 'astonmartin': (0, 101, 94),
    'ferrari': (232, 0, 45), 'haas': (182, 186, 189),
    'mclaren': (255, 128, 0), 'mercedes': (39, 244, 210),
    'racingbulls': (20, 52, 203), 'redbull': (54, 113, 198),
    'sauber': (82, 226, 82), 'williams': (100, 196, 255)
}
MODEL_INFO = {
    'football': ModelInfo(name='YOLOv11x-seg Football', map50=0.947, parameters='62M'),
    'f1': ModelInfo(name='YOLOv11l F1 Detection', map50=0.935, parameters='25M'),
}

def preprocess(img: np.ndarray, size: int = 640):
    """Letterbox resize + normalize to [0,1] NCHW float32."""
    h, w = img.shape[:2]
    scale = size / max(h, w)
    nh, nw = int(h * scale), int(w * scale)
    resized = cv2.resize(img, (nw, nh))
    canvas = np.full((size, size, 3), 114, dtype=np.uint8)
    pad_y, pad_x = (size - nh) // 2, (size - nw) // 2
    canvas[pad_y:pad_y+nh, pad_x:pad_x+nw] = resized
    blob = canvas.astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))[np.newaxis]
    return blob, scale, pad_x, pad_y

def postprocess_detections(
    outputs, orig_h: int, orig_w: int,
    scale: float, pad_x: int, pad_y: int,
    class_names: dict, colors: dict,
    conf_thres: float, iou_thres: float,
    is_seg: bool = False
):
    """Parse YOLO outputs into Detection objects."""
    preds = outputs[0][0]  # (num_preds, 4+nc) or (num_preds, 4+nc+32)
    nc = len(class_names)
    boxes_raw = preds[:, :4]
    scores = preds[:, 4:4+nc]
    mask_coeffs = preds[:, 4+nc:] if is_seg and preds.shape[1] > 4+nc else None

    # cx,cy,w,h → x1,y1,x2,y2
    cx, cy, bw, bh = boxes_raw[:,0], boxes_raw[:,1], boxes_raw[:,2], boxes_raw[:,3]
    x1 = cx - bw/2; y1 = cy - bh/2; x2 = cx + bw/2; y2 = cy + bh/2

    class_ids = np.argmax(scores, axis=1)
    confidences = scores[np.arange(len(scores)), class_ids]

    mask = confidences >= conf_thres
    x1, y1, x2, y2 = x1[mask], y1[mask], x2[mask], y2[mask]
    confidences = confidences[mask]
    class_ids = class_ids[mask]
    if mask_coeffs is not None:
        mask_coeffs = mask_coeffs[mask]

    # NMS
    boxes_nms = np.stack([x1, y1, x2-x1, y2-y1], axis=1).tolist()
    idxs = cv2.dnn.NMSBoxes(boxes_nms, confidences.tolist(), conf_thres, iou_thres)
    if len(idxs) == 0:
        return []

    idxs = idxs.flatten()
    detections = []
    size = settings.input_size
    for i in idxs:
        cid = int(class_ids[i])
        cname = class_names.get(cid, f'class_{cid}')
        color_bgr = colors.get(cname, (255, 255, 255))
        color_hex = '#{:02x}{:02x}{:02x}'.format(*color_bgr[::-1])

        # Undo letterbox
        rx1 = max(0, (float(x1[i]) - pad_x) / scale)
        ry1 = max(0, (float(y1[i]) - pad_y) / scale)
        rx2 = min(orig_w, (float(x2[i]) - pad_x) / scale)
        ry2 = min(orig_h, (float(y2[i]) - pad_y) / scale)

        detections.append(Detection(
            class_id=cid,
            class_name=cname,
            confidence=float(confidences[i]),
            bbox=BoundingBox(x1=rx1, y1=ry1, x2=rx2, y2=ry2),
            color=color_hex,
        ))
    return detections

def draw_detections(img: np.ndarray, detections: list, is_seg: bool = False) -> np.ndarray:
    """Draw bounding boxes and labels on image."""
    overlay = img.copy()
    for det in detections:
        color_hex = det.color or '#ffffff'
        r = int(color_hex[1:3], 16)
        g = int(color_hex[3:5], 16)
        b = int(color_hex[5:7], 16)
        color_bgr = (b, g, r)

        x1, y1, x2, y2 = int(det.bbox.x1), int(det.bbox.y1), int(det.bbox.x2), int(det.bbox.y2)

        # Semi-transparent fill
        cv2.rectangle(overlay, (x1, y1), (x2, y2), color_bgr, -1)

        # Solid border
        cv2.rectangle(img, (x1, y1), (x2, y2), color_bgr, 2)

        # Label background
        label = f"{det.class_name} {det.confidence:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(img, (x1, y1 - th - 8), (x1 + tw + 8, y1), color_bgr, -1)
        cv2.putText(img, label, (x1 + 4, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

    # Blend overlay
    cv2.addWeighted(overlay, 0.15, img, 0.85, 0, img)
    return img

def encode_image_b64(img: np.ndarray) -> str:
    _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return base64.b64encode(buf.tobytes()).decode()

def run_image_inference(
    session: ort.InferenceSession,
    img_bytes: bytes,
    mode: str,
) -> tuple:
    """Run inference on a single image. Returns (detections, annotated_img, ms)."""
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")

    orig_h, orig_w = img.shape[:2]
    is_seg = mode == 'football'
    class_names = FOOTBALL_CLASSES if is_seg else F1_CLASSES
    colors = FOOTBALL_COLORS if is_seg else F1_COLORS

    blob, scale, pad_x, pad_y = preprocess(img, settings.input_size)
    input_name = session.get_inputs()[0].name

    t0 = time.perf_counter()
    outputs = session.run(None, {input_name: blob})
    ms = (time.perf_counter() - t0) * 1000

    detections = postprocess_detections(
        outputs, orig_h, orig_w, scale, pad_x, pad_y,
        class_names, colors,
        settings.conf_threshold, settings.iou_threshold,
        is_seg=is_seg,
    )
    annotated = draw_detections(img.copy(), detections, is_seg)
    return detections, annotated, ms
