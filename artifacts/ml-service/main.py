"""
Food Classification ML Service
================================
This service runs a Vision Transformer (ViT-B/16) model to classify
food images as pizza, steak, or sushi.

HOW TO SWAP IN YOUR TRAINED MODEL:
-----------------------------------
1. Copy your trained model weights file (e.g. vit_food_classifier.pth)
   into this directory: artifacts/ml-service/
2. Set the environment variable MODEL_PATH to the filename:
      export MODEL_PATH=vit_food_classifier.pth
   Or just hardcode the path in the MODEL_PATH variable below.
3. Restart the ML Service workflow.

Your model must have the same ViT-B/16 architecture with a 3-class head.
The class order must be: ["pizza", "steak", "sushi"]
"""

import io
import time
import os
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision.models import vit_b_16, ViT_B_16_Weights

app = FastAPI(title="Food Classification Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Class names — must match the order your model was trained with
CLASS_NAMES = ["pizza", "steak", "sushi"]

# ---------------------------------------------------------------
# MODEL LOADING
# ---------------------------------------------------------------
# To use your own trained weights, set MODEL_PATH to the .pth file path.
# Example: MODEL_PATH = "vit_food_classifier.pth"
#
# Leave as None to use torchvision pretrained weights (default demo mode).
MODEL_PATH = os.environ.get("MODEL_PATH", None)

print("[INFO] Building ViT-B/16 model architecture...")

model = vit_b_16(weights=None if MODEL_PATH else ViT_B_16_Weights.DEFAULT)

# Replace the classification head with a 3-class head
# (This matches the architecture from your GitHub project)
in_features = model.heads.head.in_features
model.heads.head = torch.nn.Linear(in_features, len(CLASS_NAMES))

if MODEL_PATH:
    # Load your custom trained weights
    model_file = os.path.join(os.path.dirname(__file__), MODEL_PATH)
    if not os.path.exists(model_file):
        raise RuntimeError(
            f"Model file not found: {model_file}\n"
            "Please place your .pth file in artifacts/ml-service/ "
            "and set MODEL_PATH accordingly."
        )
    print(f"[INFO] Loading trained weights from: {model_file}")
    state_dict = torch.load(model_file, map_location="cpu")
    # Handle if saved as full model or just state_dict
    if isinstance(state_dict, dict) and "model_state_dict" in state_dict:
        state_dict = state_dict["model_state_dict"]
    model.load_state_dict(state_dict)
    print("[INFO] Custom model weights loaded successfully!")
else:
    print("[INFO] No MODEL_PATH set — using ImageNet pretrained weights (demo mode)")
    print("[INFO] Set MODEL_PATH env var to your .pth file to use your trained model")

model.eval()

# Image preprocessing (matches ViT-B/16 training requirements)
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

print("[INFO] ML Service ready!")


@app.get("/")
def health():
    return {
        "status": "ok",
        "model": "ViT-B/16",
        "classes": CLASS_NAMES,
        "using_custom_weights": MODEL_PATH is not None,
    }


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

    processing_time_ms = (time.time() - start_time) * 1000

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
