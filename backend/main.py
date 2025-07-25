from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Prediction(BaseModel):
    class_: int
    confidence: float
    box: List[float]

class DetectResponse(BaseModel):
    predictions: List[Prediction]

@app.post("/detect", response_model=DetectResponse)
async def detect_uang(file: UploadFile = File(...)):
    # TODO: Ganti dengan deteksi asli
    hasil = []
    if "20k" in file.filename:
        hasil.append(Prediction(class_=4, confidence=0.88, box=[10, 10, 200, 100]))
    return DetectResponse(predictions=hasil)