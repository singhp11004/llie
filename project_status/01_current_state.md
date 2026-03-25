# ChandraGrahan LLIE — Current State of the Project

**Last Reviewed:** March 25, 2026  
**Project Status:** ⚠️ Partially Functional — Core AI Feature Non-Operational

---

## 1. Project Overview

**ChandraGrahan** is a full-stack Low Light Image Enhancement (LLIE) web application. It consists of:

- **Backend:** Python FastAPI server responsible for AI model inference and user authentication.
- **Frontend:** React (Vite) single-page application with Three.js/GSAP animations.

The intended workflow is:
1. User registers/logs in via the web UI.
2. User uploads a dark/low-light image.
3. The backend runs inference through a trained PyTorch neural network.
4. The enhanced image is returned and presented side-by-side with the original.

---

## 2. What is Currently Working

| Feature | Status | Notes |
|---|---|---|
| Frontend renders | ✅ Working | React/Vite app starts and displays UI |
| Three.js 3D background | ✅ Working | Animated particle background renders |
| GSAP animations | ✅ Working | Page animations function correctly |
| User registration | ✅ Working | Saves user to `data/users.json` |
| User login / logout | ✅ Working | Token-based session, persists in `localStorage` |
| Drag-and-drop image upload UI | ✅ Working | File input and drop zone function |
| Backend API server starts | ✅ Working | FastAPI/uvicorn server launches |
| `/auth/register`, `/auth/login`, `/auth/me` | ✅ Working | HTTP endpoints respond correctly |
| `/enhance` endpoint (HTTP plumbing) | ✅ Working | Receives multipart file upload |
| `/download/{file_id}` endpoint | ✅ Working | Returns saved file |
| Profile page — image history | ✅ Working | Reads from `localStorage` |

---

## 3. What is NOT Working

### 3.1 Core Issue — AI Model Is Never Actually Used

This is the most critical bug in the entire project. In `backend/models/image_processor.py`, the `apply_enhancement` method is explicitly a **placeholder**:

```python
# In apply_enhancement():
# For now, we'll use a simple brightness/contrast enhancement
# In a real implementation, you would use: enhanced = model(input_tensor)
enhanced = self.simple_enhancement(input_tensor)
```

The `simple_enhancement` method does **nothing more than multiply pixel values by 1.5** and adjust contrast. No neural network is ever called. The model, even if loaded, is completely bypassed.

Furthermore, in `model_manager.py`, the loading logic itself is broken:

```python
model = torch.load(model_path, map_location=self.device)
if isinstance(model, dict):
    # If it's a state dict, we need to create the model architecture first
    # For now, we'll assume the model is already complete
    self.models[model_id] = model  # Stores a dict, not a callable model!
```

If the `.pt` file is a **state dictionary** (which is the standard format for saved PyTorch models), the code stores the raw dictionary and never reconstructs the model architecture. A state dict is not callable — `model(input_tensor)` would crash immediately. The application was written without knowing the underlying model architecture.

### 3.2 Model File Likely Missing

The expected model path is:
```
backend/trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/model.pt
```

This path is hardcoded but the directory does not appear to exist in the repository (no `trained_models_SMG_Low_Light_Enhancement` directory was found). This means the model silently fails to load on startup, and the placeholder fallback is used.

### 3.3 Authentication — Not Using Real JWT

`requirements.txt` includes `python-jose[cryptography]` (JWT library) and `passlib[bcrypt]` (proper password hashing), but **neither is used**:

- Passwords are hashed with raw `hashlib.sha256` — a fast, non-salted hash that is vulnerable to rainbow table attacks. bcrypt (which is already installed) should be used instead.
- Tokens are generated as `secrets.token_urlsafe(32)` — random hex strings, not JWT. This means tokens cannot carry expiry metadata without a database lookup on every request (which it does, reading JSON from disk on every API call).

### 3.4 Authentication Storage — JSON Flat Files

User and token data is stored in `data/users.json` and `data/tokens.json`. This approach has serious problems:

- **No concurrency safety:** Multiple simultaneous requests will cause race conditions and data corruption (read-modify-write without locking).
- **Not scalable:** Every request reads the entire file from disk.
- **Tokens never expire from disk:** The `logout` endpoint does not clear the token server-side via the standard flow; `auth_manager.logout_user()` is never called (the `logout` endpoint only calls `auth_manager.verify_token` indirectly).

### 3.5 React Router / Context Provider Ordering Bug

In `frontend/src/App.jsx`:

```jsx
<AuthProvider>
  <ImageProvider>
    <Router>   {/* ← Router is nested INSIDE providers */}
```

`AuthContext` and `ImageContext` are mounted **outside** of `BrowserRouter`. This means if either context ever uses `react-router-dom` hooks (e.g., `useNavigate`), it will crash. Best practice requires `<Router>` to be the outermost wrapper.

### 3.6 Hardcoded API Base URL

In `frontend/src/services/api.js` line 1:
```js
const API_BASE_URL = 'http://localhost:8000';
```

This is hardcoded, making it impossible to deploy without modifying source code. No `.env` file or environment variable is used.

### 3.7 No Camera Support

There is no implementation for live camera capture. Users can only upload pre-existing files from disk. No `getUserMedia` API, no `<video>` element, no canvas capture.

### 3.8 No Error Boundaries

The React application has no `ErrorBoundary` component. Any unhandled JavaScript error will crash the entire UI with a blank white screen, with no user-friendly fallback.

### 3.9 CORS Configuration is Development-Only

```python
allow_origins=["http://localhost:5173", "http://localhost:3000"]
```

Only local development URLs are whitelisted. Any production deployment will fail CORS checks from day one.

### 3.10 Progress Bar is Static / Fake

In `ImageUploader.jsx`:
```jsx
<div className="processing-progress-bar" style={{ width: '60%' }}></div>
```

The progress bar is hardcoded at 60%. It never actually reflects real processing state.

### 3.11 `user.createdAt` vs `user.created_at` Mismatch

In `Profile.jsx`:
```jsx
Member since {new Date(user.createdAt).toLocaleDateString()}
```

But the backend's `auth_manager.py` stores the field as `created_at` (snake_case). This will always display `Invalid Date` on the Profile page.

### 3.12 Image Deletion on Profile is Frontend-Only

When a user deletes an image from their Profile, only the `localStorage` entry is removed. The actual files on the server (`uploads/` and `outputs/` directories) are not cleaned up. The `/cleanup/{file_id}` API endpoint exists but is never called by the frontend delete action.

---

## 4. File and Directory Structure (Actual)

```
llie/
├── README.md
├── .gitignore
├── backend/
│   ├── main.py                     # FastAPI app, all routes
│   ├── requirements.txt            # Python dependencies
│   ├── start_server.py             # uvicorn launcher
│   ├── run_backend.sh              # Shell script launcher
│   ├── run_backend.bat             # Windows launcher
│   └── models/
│       ├── __init__.py
│       ├── auth_manager.py         # JSON file-based auth
│       ├── image_processor.py      # ⚠️ PLACEHOLDER — no real model inference
│       └── model_manager.py        # ⚠️ BROKEN — doesn't rebuild model from state dict
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx                 # ⚠️ Router context ordering issue
        ├── App.css                 # All styles (large monolithic file)
        ├── main.jsx
        ├── components/
        │   ├── ImageUploader.jsx   # Upload + result display
        │   ├── Navbar.jsx          # Navigation bar
        │   └── ThreeBackground.jsx # Three.js particle background
        ├── contexts/
        │   ├── AuthContext.jsx     # Auth state management
        │   └── ImageContext.jsx    # Image history management
        ├── pages/
        │   ├── Home.jsx            # Landing + upload section
        │   ├── Auth.jsx            # Login/Register form
        │   └── Profile.jsx         # ⚠️ createdAt bug
        └── services/
            └── api.js              # ⚠️ Hardcoded localhost URL
```

---

## 5. Technology Stack Summary

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 18.x |
| Frontend Build Tool | Vite | Latest |
| 3D Graphics | Three.js | Latest |
| Animations | GSAP + ScrollTrigger | Latest |
| Icons | Lucide React | Latest |
| Router | React Router DOM | Latest |
| Backend Framework | FastAPI | 0.104.1 |
| Backend Server | Uvicorn | 0.24.0 |
| ML Framework | PyTorch | 2.1.0 |
| Image Library | Pillow + OpenCV | 10.1.0 / 4.8.1 |
| Auth Utilities (unused) | python-jose, passlib[bcrypt] | Installed |

---

## 6. Critical Defect Priority Matrix

| # | Defect | Severity | Impact |
|---|---|---|---|
| 1 | AI model never called — placeholder used | 🔴 Critical | Core feature completely broken |
| 2 | Model architecture not defined — state dict unusable | 🔴 Critical | Even with model file, inference fails |
| 3 | Passwords hashed with SHA-256, not bcrypt | 🔴 Critical | Security vulnerability |
| 4 | Token auth uses random string, not JWT | 🟠 High | No stateless auth, disk read per request |
| 5 | JSON flat-file storage — race conditions | 🟠 High | Data corruption under load |
| 6 | Model file missing from repository | 🟠 High | Backend always falls back to placeholder |
| 7 | Hardcoded API URL in frontend | 🟠 High | Deployment blocker |
| 8 | `createdAt` vs `created_at` field name mismatch | 🟡 Medium | Profile page bug |
| 9 | Image delete doesn't clean server files | 🟡 Medium | Disk space leak |
| 10 | Router outside context providers | 🟡 Medium | Future hook usage will crash |
| 11 | Static 60% progress bar | 🟡 Medium | Poor UX |
| 12 | CORS locked to localhost | 🟡 Medium | Deployment blocker |
| 13 | No camera support | 🟡 Medium | Missing requested feature |
| 14 | No error boundaries in React | 🟡 Medium | White screen on any unhandled error |
