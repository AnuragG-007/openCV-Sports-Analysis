import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import onnxruntime as ort

from app.core.config import settings
from app.routers.analyze import router as analyze_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger(__name__)

def load_session(path: str, label: str) -> ort.InferenceSession | None:
    if not os.path.exists(path):
        log.warning(f"{label} model not found at {path}")
        return None
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    try:
        sess = ort.InferenceSession(path, providers=providers)
        active = sess.get_providers()[0]
        log.info(f"{label} model loaded on {active}  [{path}]")
        return sess
    except Exception as e:
        log.error(f"Failed to load {label} model: {e}")
        return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Loading ONNX models...")
    app.state.football_session = load_session(settings.football_model_path, "Football")
    app.state.f1_session = load_session(settings.f1_model_path, "F1")
    log.info("Models ready. Starting server.")
    yield
    log.info("Shutting down.")

app = FastAPI(
    title="SportVision AI API",
    description="Real-time sports analysis using YOLOv11 instance segmentation and object detection.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router, tags=["Analysis"])

@app.get("/health", tags=["System"])
async def health():
    return JSONResponse({
        "status": "ok",
        "football_model_loaded": app.state.football_session is not None,
        "f1_model_loaded": app.state.f1_session is not None,
        "version": "1.0.0",
    })

@app.get("/", tags=["System"])
async def root():
    return {"message": "SportVision AI API", "docs": "/docs"}
