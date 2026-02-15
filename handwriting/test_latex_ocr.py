"""TrOCR handwritten math → LaTeX inference script.

Uses tjoab/latex_finetuned (fine-tuned TrOCR-base-handwritten, ~334M params).
Model downloads automatically on first run (~1.3 GB).

Usage:
    python test_latex_ocr.py --image_path ./test_strokes.png
    python test_latex_ocr.py --image_path img1.png img2.png img3.png
"""

import argparse
import sys
import time
from pathlib import Path

import PIL.Image
import torch
from PIL import Image
from transformers import TrOCRProcessor, VisionEncoderDecoderModel

MODEL_ID = "tjoab/latex_finetuned"
MAX_LENGTH = 128


def open_PIL_image(image_path: str) -> Image.Image:
    image = Image.open(image_path)
    if image.mode == "RGBA":
        background = PIL.Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.split()[3])
        return background
    return image.convert("RGB")


def load_model() -> tuple[VisionEncoderDecoderModel, TrOCRProcessor, torch.device]:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    print(f"Loading model {MODEL_ID}...")

    processor = TrOCRProcessor.from_pretrained(MODEL_ID)
    model = VisionEncoderDecoderModel.from_pretrained(MODEL_ID).to(device)
    model.eval()

    print("Model loaded.")
    return model, processor, device


def predict(model: VisionEncoderDecoderModel, processor: TrOCRProcessor, device: torch.device, image: Image.Image) -> str:
    pixel_values = processor(images=image, return_tensors="pt").pixel_values.to(device)

    with torch.no_grad():
        generated_ids = model.generate(pixel_values, max_length=MAX_LENGTH)

    return processor.batch_decode(generated_ids, skip_special_tokens=True)[0]


def main() -> None:
    parser = argparse.ArgumentParser(description="Handwritten math → LaTeX via TrOCR")
    parser.add_argument("--image_path", nargs="+", required=True, help="Path(s) to PNG image(s)")
    args = parser.parse_args()

    paths = [Path(p) for p in args.image_path]
    missing = [p for p in paths if not p.exists()]
    if missing:
        print(f"Error: file(s) not found: {', '.join(str(m) for m in missing)}", file=sys.stderr)
        sys.exit(1)

    model, processor, device = load_model()

    for path in paths:
        image = open_PIL_image(str(path))
        start = time.perf_counter()
        latex = predict(model, processor, device, image)
        elapsed = time.perf_counter() - start
        print(f"\n[{path.name}] ({elapsed:.2f}s)")
        print(f"  LaTeX: {latex}")


if __name__ == "__main__":
    main()
