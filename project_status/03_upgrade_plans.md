# ChandraGrahan LLIE — Upgrade & Feature Enhancement Plans

**Document Type:** Feature Roadmap & Detailed Implementation Plans  
**Sections:** Camera Integration, Model Upgrades, Performance, UX, Architecture

---

## Upgrade 1: Live Camera Capture (Browser Camera Integration)

### Overview

Add the ability for users to capture images directly from their laptop, webcam, or any connected camera through the browser using the `getUserMedia` Web API. The captured frame is then sent through the existing enhance pipeline.

### Why This Adds Value

- Eliminates the need to save a photo, find it in the file system, and upload it
- Enables real-time demo mode: capture in low light, enhance instantly
- Works with USB cameras, phone cameras via browser, and built-in laptop cameras
- No additional hardware or OS-level integrations required — pure browser APIs

### Technical Architecture

```
Browser (getUserMedia API)
  ↓
<video> element (live preview)
  ↓
<canvas> captureFrame()
  ↓
canvas.toBlob('image/jpeg') → File object
  ↓
Existing enhanceImage(file) API call
  ↓
Backend /enhance endpoint (unchanged)
```

### Implementation Plan — Frontend

**Step 1: Create `CameraCapture.jsx` component**

```jsx
// frontend/src/components/CameraCapture.jsx
import { useState, useRef, useCallback, useEffect } from 'react';

const CameraCapture = ({ onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const [devices, setDevices] = useState([]);
    const [selectedDevice, setSelectedDevice] = useState('');
    const [error, setError] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);

    // Enumerate all video input devices on component mount
    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(allDevices => {
            const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
            setDevices(videoInputs);
            if (videoInputs.length > 0) {
                setSelectedDevice(videoInputs[0].deviceId);
            }
        });
    }, []);

    const startCamera = useCallback(async () => {
        setError(null);
        try {
            const constraints = {
                video: {
                    deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setIsActive(true);
        } catch (err) {
            if (err.name === 'NotAllowedError') {
                setError('Camera access denied. Please allow camera permission in browser settings.');
            } else if (err.name === 'NotFoundError') {
                setError('No camera found. Please connect a camera and try again.');
            } else {
                setError(`Camera error: ${err.message}`);
            }
        }
    }, [selectedDevice]);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setIsActive(false);
    }, []);

    // Stop camera when component unmounts
    useEffect(() => () => stopCamera(), [stopCamera]);

    const captureFrame = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            setCapturedImage({ file, previewUrl });
            stopCamera();
            onCapture(file);  // ← Send to parent (ImageUploader or similar)
        }, 'image/jpeg', 0.95);
    }, [onCapture, stopCamera]);

    const retake = () => {
        if (capturedImage) URL.revokeObjectURL(capturedImage.previewUrl);
        setCapturedImage(null);
        startCamera();
    };

    return (
        <div className="camera-capture">
            {/* Device Selector */}
            {devices.length > 1 && !isActive && !capturedImage && (
                <select
                    value={selectedDevice}
                    onChange={e => setSelectedDevice(e.target.value)}
                    className="camera-device-selector"
                >
                    {devices.map(d => (
                        <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${devices.indexOf(d) + 1}`}
                        </option>
                    ))}
                </select>
            )}

            {/* Error Display */}
            {error && <div className="camera-error">{error}</div>}

            {/* Video Preview */}
            <video
                ref={videoRef}
                className={`camera-video ${isActive ? 'active' : 'hidden'}`}
                playsInline
                muted
                autoPlay
            />

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Captured Image Preview */}
            {capturedImage && (
                <img
                    src={capturedImage.previewUrl}
                    alt="Captured"
                    className="camera-preview"
                />
            )}

            {/* Action Buttons */}
            <div className="camera-actions">
                {!isActive && !capturedImage && (
                    <button onClick={startCamera} className="btn-primary">
                        Open Camera
                    </button>
                )}
                {isActive && (
                    <>
                        <button onClick={captureFrame} className="btn-primary">
                            📸 Capture
                        </button>
                        <button onClick={stopCamera} className="btn-secondary">
                            Cancel
                        </button>
                    </>
                )}
                {capturedImage && (
                    <button onClick={retake} className="btn-secondary">
                        Retake
                    </button>
                )}
            </div>
        </div>
    );
};

export default CameraCapture;
```

**Step 2: Add camera tab to `ImageUploader.jsx`**

Replace the single upload zone with a tabbed interface:
```jsx
const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'camera'

// Tabs:
<div className="input-mode-tabs">
    <button
        className={`tab ${inputMode === 'upload' ? 'active' : ''}`}
        onClick={() => setInputMode('upload')}
    >
        📁 Upload File
    </button>
    <button
        className={`tab ${inputMode === 'camera' ? 'active' : ''}`}
        onClick={() => setInputMode('camera')}
    >
        📷 Use Camera
    </button>
</div>

{inputMode === 'upload' && <DropZone ... />}
{inputMode === 'camera' && <CameraCapture onCapture={handleFile} />}
```

**Step 3: Handle HTTPS requirement**

`getUserMedia` requires a **secure context (HTTPS)** in production. On localhost it works over HTTP. Ensure your production deployment serves over HTTPS (handled in Deployment Plan document).

**Step 4: Handle mobile browsers**

Add `facingMode` support for mobile:
```js
// For rear camera on mobile:
video: { facingMode: { exact: 'environment' } }
// For front-facing:
video: { facingMode: 'user' }
```

Add a front/rear toggle button when running on mobile (detect with `navigator.mediaDevices.getSupportedConstraints().facingMode`).

### Implementation Effort

- Estimated effort: **2–3 days** (frontend only)
- Backend changes required: **None** — camera output is a JPEG blob, identical to file upload
- Browser support: Chrome, Firefox, Safari (iOS 11+), Edge — all modern browsers

---

## Upgrade 2: Real Neural Network Integration

### Overview

Replace the placeholder `simple_enhancement()` with actual model inference. This requires knowing (or reconstructing) the model architecture.

### Option A: Zero-DCE++ (Recommended — Open Source, State-of-the-Art)

Zero-DCE (Zero-Reference Deep Curve Estimation) is lightweight, has no paired training requirement, and its architecture is publicly available.

**Architecture implementation:**
```python
# backend/models/architecture/zero_dce.py
import torch
import torch.nn as nn

class ZeroDCE(nn.Module):
    def __init__(self):
        super(ZeroDCE, self).__init__()
        self.conv1 = nn.Conv2d(3, 32, 3, 1, 1, bias=True)
        self.conv2 = nn.Conv2d(32, 32, 3, 1, 1, bias=True)
        self.conv3 = nn.Conv2d(32, 32, 3, 1, 1, bias=True)
        self.conv4 = nn.Conv2d(32, 32, 3, 1, 1, bias=True)
        self.conv5 = nn.Conv2d(64, 32, 3, 1, 1, bias=True)
        self.conv6 = nn.Conv2d(64, 32, 3, 1, 1, bias=True)
        self.conv7 = nn.Conv2d(64, 24, 3, 1, 1, bias=True)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        x1 = self.relu(self.conv1(x))
        x2 = self.relu(self.conv2(x1))
        x3 = self.relu(self.conv3(x2))
        x4 = self.relu(self.conv4(x3))
        x5 = self.relu(self.conv5(torch.cat([x3, x4], 1)))
        x6 = self.relu(self.conv6(torch.cat([x2, x5], 1)))
        x7 = torch.tanh(self.conv7(torch.cat([x1, x6], 1)))

        # Apply 8 curve parameter maps (A_i)
        x = x + x7[:,:3,:,:] * (torch.pow(x, 2) - x)
        x = x + x7[:,3:6,:,:] * (torch.pow(x, 2) - x)
        x = x + x7[:,6:9,:,:] * (torch.pow(x, 2) - x)
        x = x + x7[:,9:12,:,:] * (torch.pow(x, 2) - x)
        x = x + x7[:,12:15,:,:] * (torch.pow(x, 2) - x)
        x = x + x7[:,15:18,:,:] * (torch.pow(x, 2) - x)
        x = x + x7[:,18:21,:,:] * (torch.pow(x, 2) - x)
        enhance_image = x + x7[:,21:24,:,:] * (torch.pow(x, 2) - x)
        return torch.clamp(enhance_image, 0, 1)
```

**Model loading with this architecture:**
```python
from models.architecture.zero_dce import ZeroDCE

arch = ZeroDCE()
state_dict = torch.load('path/to/model.pt', map_location=device)
arch.load_state_dict(state_dict)
arch.eval()
```

**Preprocessing for Zero-DCE (important — input must be [0,1], NOT [-1,1]):**
```python
self.transform = transforms.Compose([
    transforms.ToTensor(),  # Converts to [0,1] — NO Normalize
])
# Output is already in [0,1], save directly:
output_image = transforms.ToPILImage()(enhanced_tensor.squeeze(0).cpu())
```

### Option B: MIRNet (Higher Quality, Heavier)

If the existing model file was trained with MIRNet (Multi-Scale Residual Net), the architecture is more complex but delivers higher PSNR on LOL dataset. Implement from the official repository at `swz30/MIRNet`.

### Option C: Identify the Existing Model's Architecture

If you have access to the original training script that produced `model.pt`:

```python
# Inspect the state dict to identify architecture
state_dict = torch.load('model.pt', map_location='cpu')
for key, tensor in state_dict.items():
    print(f"{key}: {tensor.shape}")
```

Match the layer names and shapes to the architecture you used during training.

### Implementation Effort

- Effort: **3–5 days** (architecture identification + testing)
- Risk: High if original architecture is unknown

---

## Upgrade 3: Multiple Model Support with Model Selection UI

### Overview

Expose multiple LLIE models (e.g., Zero-DCE for speed, MIRNet for quality) and let users choose.

### Backend Changes

Add entries to `model_paths` in `ModelManager`:
```python
self.model_paths = {
    "zero_dce": "models/weights/zero_dce.pt",
    "mirnet": "models/weights/mirnet.pt",
    "lol_real": "models/weights/lol_real.pt"
}
```

Update `/models` endpoint to return metadata including quality/speed tradeoffs:
```python
@app.get("/models")
async def get_available_models():
    return {
        "models": [
            {
                "id": "zero_dce",
                "name": "ZeroDCE (Fast)",
                "description": "Lightweight, ~100ms inference. Best for quick previews.",
                "speed": "fast",
                "quality": "good"
            },
            {
                "id": "mirnet",
                "name": "MIRNet (High Quality)",
                "description": "Deep network, ~2s inference. Best for final output.",
                "speed": "slow",
                "quality": "excellent"
            }
        ]
    }
```

### Frontend Changes

Add a model selector card before the enhance button:
```jsx
const [selectedModel, setSelectedModel] = useState('zero_dce');
const [availableModels, setAvailableModels] = useState([]);

useEffect(() => {
    apiService.getAvailableModels().then(data => setAvailableModels(data.models));
}, []);

// Pass selected model to API:
await apiService.enhanceImage(file, selectedModel);
```

### Implementation Effort

- Effort: **2–3 days**

---

## Upgrade 4: Real-Time Progress via WebSocket

### Overview

Replace the fake static progress bar with real-time server-sent progress events.

### Backend — Add WebSocket endpoint

```python
from fastapi import WebSocket
import asyncio

@app.websocket("/ws/enhance/{file_id}")
async def enhancement_progress(websocket: WebSocket, file_id: str):
    await websocket.accept()
    try:
        await websocket.send_json({"step": "loading", "progress": 10})
        # Load image
        await asyncio.sleep(0)
        await websocket.send_json({"step": "preprocessing", "progress": 30})
        # Preprocess
        await asyncio.sleep(0)
        await websocket.send_json({"step": "inference", "progress": 60})
        # Run model
        await asyncio.sleep(0)
        await websocket.send_json({"step": "saving", "progress": 90})
        # Save
        await websocket.send_json({"step": "done", "progress": 100, "download_url": f"/download/{file_id}"})
    finally:
        await websocket.close()
```

### Frontend — Connect to WebSocket during processing

```js
const ws = new WebSocket(`ws://localhost:8000/ws/enhance/${fileId}`);
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setProgress(data.progress);
    setStep(data.step);
    if (data.step === 'done') {
        setDownloadUrl(data.download_url);
        ws.close();
    }
};
```

### Implementation Effort

- Effort: **2 days**

---

## Upgrade 5: Batch Processing

### Overview

Allow users to upload multiple images at once and process them in a queue, with progress tracked per-image.

### Backend Changes

```python
@app.post("/enhance/batch")
async def enhance_batch(
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    batch_id = str(uuid.uuid4())
    results = []
    for file in files:
        # Process each, return list of file_ids
        ...
    return {"batch_id": batch_id, "results": results}
```

### Implementation Effort

- Effort: **2–3 days**

---

## Upgrade 6: Image Comparison Slider

### Overview

Replace the side-by-side static layout with an interactive comparison slider (drag to reveal before/after).

### Implementation

Use the `img-comparison-slider` library or implement with a CSS clip-path approach:

```jsx
// CSS approach — no library needed
const ComparisonSlider = ({ originalSrc, enhancedSrc }) => {
    const [sliderPos, setSliderPos] = useState(50);

    return (
        <div className="comparison-container" onMouseMove={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            setSliderPos(((e.clientX - rect.left) / rect.width) * 100);
        }}>
            <img src={enhancedSrc} className="comparison-enhanced" />
            <div
                className="comparison-original-wrapper"
                style={{ width: `${sliderPos}%` }}
            >
                <img src={originalSrc} className="comparison-original" />
            </div>
            <div className="comparison-handle" style={{ left: `${sliderPos}%` }} />
        </div>
    );
};
```

### Implementation Effort

- Effort: **0.5–1 day**

---

## Upgrade 7: Database Migration (JSON → SQLite → PostgreSQL)

### Phase 1: SQLite (Immediate — Zero External Dependencies)

```sql
-- schema.sql
CREATE TABLE users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)))),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

CREATE TABLE processing_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    original_path TEXT NOT NULL,
    output_path TEXT,
    model_used TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

```python
import sqlite3
from contextlib import contextmanager

@contextmanager
def get_db():
    conn = sqlite3.connect('data/chandragrahan.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except:
        conn.rollback()
        raise
    finally:
        conn.close()
```

### Phase 2: PostgreSQL (Production)

Use SQLAlchemy ORM with async support:
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/chandragrahan")
engine = create_async_engine(DATABASE_URL)
```

### Implementation Effort

- SQLite migration: **1–2 days**
- PostgreSQL migration: **3–4 days**

---

## Upgrade 8: Automatic File Cleanup Service

### Overview

Add a background task that periodically removes old files from disk.

### Backend Implementation

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import shutil

scheduler = AsyncIOScheduler()

@scheduler.scheduled_job('interval', hours=1)
async def cleanup_old_files():
    threshold = datetime.now() - timedelta(hours=24)
    for path in Path("uploads").glob("*"):
        if datetime.fromtimestamp(path.stat().st_mtime) < threshold:
            path.unlink()
    for path in Path("outputs").glob("*"):
        if datetime.fromtimestamp(path.stat().st_mtime) < threshold:
            path.unlink()

@app.on_event("startup")
async def startup():
    scheduler.start()
```

### Implementation Effort

- Effort: **0.5 day**

---

## Upgrade 9: PSNR/SSIM Quality Metrics Display

### Overview

After enhancement, compute and display image quality metrics that demonstrate the improvement.

### Backend Addition

```python
from skimage.metrics import peak_signal_noise_ratio as psnr
from skimage.metrics import structural_similarity as ssim
import numpy as np

def compute_metrics(original_path, enhanced_path):
    orig = np.array(Image.open(original_path).convert('RGB'))
    enhanced = np.array(Image.open(enhanced_path).convert('RGB'))
    
    # Ensure same size for comparison
    if orig.shape != enhanced.shape:
        return None
    
    psnr_val = psnr(orig, enhanced, data_range=255)
    ssim_val = ssim(orig, enhanced, multichannel=True, channel_axis=2)
    
    return {
        "psnr": round(float(psnr_val), 2),
        "ssim": round(float(ssim_val), 4),
        "improvement": f"+{psnr_val:.1f} dB"
    }
```

Return metrics in the `/enhance` response and display them in the result card.

### Implementation Effort

- Effort: **1 day**

---

## Upgrade 10: User Image History Persistence (Server-Side)

### Overview

Currently, image history is stored in `localStorage` only, which means it's lost when clearing browser data and doesn't sync across devices.

### Backend Addition

Add a user images table and API endpoints:
```python
@app.get("/user/images")
async def get_user_images(current_user: dict = Depends(get_current_user)):
    # Return list of user's processed images from database
    ...

@app.delete("/user/images/{image_id}")
async def delete_user_image(
    image_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Verify ownership, delete files, remove record
    ...
```

Replace `localStorage.setItem('userImages', ...)` in `ImageContext.jsx` with API calls.

### Implementation Effort

- Effort: **2–3 days** (requires database upgrade first)

---

## Upgrade Priority Roadmap

| Phase | Upgrades | Priority | Estimated Time |
|---|---|---|---|
| **Phase 0** (Bug Fixes) | Fix model inference, bcrypt, JWT, URLs | 🔴 Critical | 1 week |
| **Phase 1** (Core Features) | Camera capture, real model, model selector | 🟠 High | 2 weeks |
| **Phase 2** (UX Polish) | Comparison slider, real progress, error boundaries | 🟡 Medium | 1 week |
| **Phase 3** (Infrastructure) | SQLite DB, file cleanup, server-side history | 🟡 Medium | 2 weeks |
| **Phase 4** (Advanced) | WebSocket progress, batch processing, metrics | 🟢 Low | 2 weeks |
