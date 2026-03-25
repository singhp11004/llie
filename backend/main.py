from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import uvicorn
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
import shutil
import json
import hashlib
import secrets
import asyncio
from PIL import Image

try:
    from skimage.metrics import peak_signal_noise_ratio as psnr
    from skimage.metrics import structural_similarity as ssim
    import numpy as np
    HAS_SKIMAGE = True
except ImportError:
    HAS_SKIMAGE = False

from models.image_processor import ImageProcessor
from models.model_manager import ModelManager
from models.auth_manager import AuthManager

app = FastAPI(title="ChandraGrahan Low Light Enhancement API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize managers
model_manager = ModelManager()
image_processor = ImageProcessor(model_manager)
auth_manager = AuthManager()

from typing import Optional

# Security
security = HTTPBearer(auto_error=False)

# Pydantic models
class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

# Create directories
UPLOAD_DIR = Path("uploads")
OUTPUT_DIR = Path("outputs")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)


async def cleanup_old_files_task():
    """Background task to run cleanup every hour"""
    while True:
        try:
            threshold = datetime.now() - timedelta(hours=24)
            for path in UPLOAD_DIR.glob("*"):
                if datetime.fromtimestamp(path.stat().st_mtime) < threshold:
                    path.unlink()
            for path in OUTPUT_DIR.glob("*"):
                if datetime.fromtimestamp(path.stat().st_mtime) < threshold:
                    path.unlink()
        except Exception as e:
            print(f"Cleanup error: {e}")
        await asyncio.sleep(3600)  # Sleep for 1 hour

@app.on_event("startup")
async def startup_event():
    """Initialize models on startup"""
    try:
        await model_manager.load_models()
        print("All models loaded successfully!")
    except Exception as e:
        print(f"Error loading models: {e}")
    
    # Start background cleanup task
    asyncio.create_task(cleanup_old_files_task())

# Authentication dependency
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        return None
    token = credentials.credentials
    user = auth_manager.verify_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

@app.get("/")
async def root():
    return {"message": "ChandraGrahan Low Light Enhancement API", "status": "running"}

# Authentication endpoints
@app.post("/auth/register")
async def register(user_data: UserRegister):
    """Register a new user"""
    try:
        result = auth_manager.register_user(user_data.email, user_data.password, user_data.name)
        if result["success"]:
            return {
                "success": True,
                "message": "User registered successfully",
                "user": result["user"]
            }
        else:
            raise HTTPException(status_code=400, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/login")
async def login(user_data: UserLogin):
    """Login user"""
    try:
        result = auth_manager.login_user(user_data.email, user_data.password)
        if result["success"]:
            return {
                "success": True,
                "message": "Login successful",
                "token": result["token"],
                "user": result["user"]
            }
        else:
            raise HTTPException(status_code=401, detail=result["error"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/auth/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Get current user information"""
    return {
        "success": True,
        "user": current_user
    }

@app.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout user"""
    # In a real implementation, you might want to blacklist the token
    return {"success": True, "message": "Logged out successfully"}

@app.get("/models")
async def get_available_models():
    """Get list of available models"""
    models_list = []
    # Real models dynamic listing
    for m in model_manager.get_available_models():
        models_list.append({
            "id": m,
            "name": m.replace("_", " ").title(),
            "description": "Auto-detected model"
        })
    if not models_list:
        models_list = [{"id": "lol_real", "name": "LOL Real Dataset", "description": "Fallback model"}]
        
    return {"models": models_list}

def compute_metrics(original_path, enhanced_path):
    if not HAS_SKIMAGE:
        return None
    try:
        orig = np.array(Image.open(original_path).convert('RGB'))
        enhanced = np.array(Image.open(enhanced_path).convert('RGB'))
        
        if orig.shape != enhanced.shape:
            return None
            
        psnr_val = psnr(orig, enhanced, data_range=255)
        ssim_val = ssim(orig, enhanced, channel_axis=2)
        
        return {
            "psnr": round(float(psnr_val), 2),
            "ssim": round(float(ssim_val), 4),
            "improvement": f"+{psnr_val:.1f} dB"
        }
    except Exception as e:
        print(f"Metrics error: {e}")
        return None

@app.post("/enhance")
async def enhance_image(
    file: UploadFile = File(...),
    model_id: str = Form("lol_real"),
    current_user: Optional[dict] = Depends(get_current_user)
):
    """
    Enhance a low light image using the LOL Real model
    """
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Generate unique filename
        file_id = str(uuid.uuid4())
        original_filename = file.filename
        file_extension = Path(original_filename).suffix
        
        # Save uploaded file
        upload_path = UPLOAD_DIR / f"{file_id}{file_extension}"
        with open(upload_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process image
        output_path = OUTPUT_DIR / f"{file_id}_enhanced{file_extension}"
        await image_processor.enhance_image(
            input_path=str(upload_path),
            output_path=str(output_path),
            model_id=model_id if model_manager.is_model_loaded(model_id) else "lol_real"
        )
        
        metrics = compute_metrics(str(upload_path), str(output_path))
        
        # Return file info
        return {
            "success": True,
            "file_id": file_id,
            "original_filename": original_filename,
            "download_url": f"/download/{file_id}",
            "model_used": model_id if model_manager.is_model_loaded(model_id) else "lol_real",
            "metrics": metrics
        }
        
    except Exception as e:
        # Clean up files on error
        if upload_path.exists():
            upload_path.unlink()
        if output_path.exists():
            output_path.unlink()
        
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/download/{file_id}")
async def download_enhanced_image(file_id: str):
    """Download the enhanced image"""
    # Find the enhanced file
    output_files = list(OUTPUT_DIR.glob(f"{file_id}_enhanced.*"))
    if not output_files:
        raise HTTPException(status_code=404, detail="Enhanced image not found")
    
    return FileResponse(
        path=output_files[0],
        filename=f"enhanced_{file_id}{output_files[0].suffix}",
        media_type="image/jpeg"
    )

@app.delete("/cleanup/{file_id}")
async def cleanup_files(file_id: str):
    """Clean up uploaded and processed files"""
    try:
        # Remove uploaded file
        upload_files = list(UPLOAD_DIR.glob(f"{file_id}.*"))
        for file in upload_files:
            file.unlink()
        
        # Remove output file
        output_files = list(OUTPUT_DIR.glob(f"{file_id}_enhanced.*"))
        for file in output_files:
            file.unlink()
        
        return {"success": True, "message": "Files cleaned up"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
