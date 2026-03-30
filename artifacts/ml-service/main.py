import io
import time
import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision.models import vit_b_16, ViT_B_16_Weights
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLASS_NAMES = ["pizza", "steak", "sushi"]

print("[INFO] Loading ViT model...")
weights = ViT_B_16_Weights.DEFAULT
pretrained_transforms = weights.transforms()

model = vit_b_16(weights=weights)

num_classes = 3
in_features = model.heads.head.in_features
model.heads.head = torch.nn.Linear(in_features, num_classes)

model.eval()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

print("[INFO] Model loaded successfully!")


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/classify")
async def classify_image(image: UploadFile = File(...)):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await image.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read image: {str(e)}")

    start_time = time.time()

    img_tensor = transform(img).unsqueeze(0)

    with torch.no_grad():
        logits = model(img_tensor)
        probs = torch.softmax(logits, dim=1)[0]

    end_time = time.time()
    processing_time_ms = (end_time - start_time) * 1000

    predicted_idx = int(probs.argmax().item())
    predicted_class = CLASS_NAMES[predicted_idx]
    confidence = float(probs[predicted_idx].item())

    all_predictions = [
        {"label": CLASS_NAMES[i], "confidence": float(probs[i].item())}
        for i in range(len(CLASS_NAMES))
    ]
    all_predictions.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "all_predictions": all_predictions,
        "processing_time_ms": round(processing_time_ms, 2),
    }
