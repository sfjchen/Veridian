"""Singleton TrOCR model loader and prediction for handwritten math -> LaTeX."""

import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

MODEL_ID = "tjoab/latex_finetuned"
MAX_LENGTH = 128

_model_cache: tuple[VisionEncoderDecoderModel, TrOCRProcessor, torch.device] | None = None


def load_model() -> tuple[VisionEncoderDecoderModel, TrOCRProcessor, torch.device]:
    global _model_cache
    if _model_cache is not None:
        return _model_cache

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[handwriting-ocr] Loading model {MODEL_ID} on {device}...")
    processor = TrOCRProcessor.from_pretrained(MODEL_ID)
    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID).to(device)
    model.eval()
    print("[handwriting-ocr] Model loaded.")

    _model_cache = (model, processor, device)
    return _model_cache


def predict(image: Image.Image) -> str:
    model, processor, device = load_model()
    pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)
    with torch.no_grad():
        generated_ids = model.generate(pixel_values, max_length=MAX_LENGTH)
    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
