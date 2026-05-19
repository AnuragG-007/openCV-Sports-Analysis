---
title: SportVision AI Backend
emoji: 🏟️
colorFrom: green
colorTo: red
sdk: docker
pinned: false
---

# SportVision AI — Backend API

FastAPI backend for real-time sports computer vision analysis.

## Models Required

Place your exported ONNX models in the `models/` directory:
- `models/football_best.onnx` — YOLOv11x-seg football segmentation
- `models/f1_best.onnx` — YOLOv11l F1 object detection

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Model load status |
| `POST` | `/analyze` | Run inference on image/video |
| `GET` | `/docs` | Swagger UI |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```
FOOTBALL_MODEL_PATH=./models/football_best.onnx
F1_MODEL_PATH=./models/f1_best.onnx
ALLOWED_ORIGINS=https://your-app.vercel.app
CONF_THRESHOLD=0.25
IOU_THRESHOLD=0.45
```

## Local Development

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
