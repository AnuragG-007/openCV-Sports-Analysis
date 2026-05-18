from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    football_model_path: str = "./models/football_best.onnx"
    f1_model_path: str = "./models/f1_best.onnx"
    allowed_origins: str = "https://open-cv-sports-analysis.vercel.app/"
    max_image_size_mb: int = 20
    max_video_size_mb: int = 200
    conf_threshold: float = 0.25
    iou_threshold: float = 0.45
    input_size: int = 640

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
