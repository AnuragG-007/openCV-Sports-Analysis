from pydantic import BaseModel
from typing import Dict, List, Optional
from enum import Enum

class SportMode(str, Enum):
    football = "football"
    f1 = "f1"

class MediaType(str, Enum):
    image = "image"
    video = "video"

class BoundingBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float

class Detection(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    bbox: BoundingBox
    mask_points: Optional[List[List[float]]] = None
    color: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    map50: float
    parameters: str

class AnalysisResult(BaseModel):
    model_config = {"protected_namespaces": ()}

    mode: SportMode
    media_type: MediaType
    original_filename: str
    processed_image_b64: Optional[str] = None
    processed_video_url: Optional[str] = None
    detections: List[Detection]
    inference_time_ms: float
    total_detections: int
    class_counts: Dict[str, int]
    model_info: ModelInfo

class HealthResponse(BaseModel):
    status: str
    football_model_loaded: bool
    f1_model_loaded: bool
    version: str = "1.0.0"