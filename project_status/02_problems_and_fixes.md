# ChandraGrahan LLIE — Problems and How to Fix Them

**Document Type:** Bug Analysis & Remediation Guide  
**Priority Order:** Critical → High → Medium

---

## Problem 1 (CRITICAL): AI Model Never Called — Placeholder Used

### What is Happening

`backend/models/image_processor.py` contains this comment at line 90:
```python
# In a real implementation, you would use: enhanced = model(input_tensor)
enhanced = self.simple_enhancement(input_tensor)  # ← Always runs this instead
```

The `simple_enhancement` method simply multiplies brightness by 1.5. No neural network is ever invoked, regardless of whether a model is loaded. The entire "AI enhancement" is fake.

### Root Cause

The developer did not know the architecture of the SMG model and used a placeholder, intending to fill it in later. That step was never completed.

### How to Fix

**Step 1 — Define the model architecture.**  
The model `trained_models_SMG_Low_Light_Enhancement` refers to the "Zero-DCE" or similar architecture trained on the LOL (Low-light Object in the real world) dataset. You need the exact architecture class that was used during training. Options:

- **Option A (Recommended):** If you have the original training code, import the model class from it.
- **Option B:** Use a well-known architecture. "SMG" likely refers to a UNet or MIRNet-style model commonly used for LOL. Implement the architecture that matches the `.pt` file's state dict.

**Step 2 — Fix `model_manager.py`.**

The current code blindly stores whatever `torch.load()` returns:
```python
# BROKEN — stores raw state dict, not a callable model
self.models[model_id] = model
```

Replace with proper architecture instantiation:
```python
# In model_manager.py
from models.architecture import YourModelClass  # ← define this

async def load_models(self):
    for model_id, model_path in self.model_paths.items():
        if os.path.exists(model_path):
            arch = YourModelClass()
            state_dict = torch.load(model_path, map_location=self.device)
            # Handle 'module.' prefix from DataParallel training
            if any(k.startswith('module.') for k in state_dict.keys()):
                state_dict = {k[7:]: v for k, v in state_dict.items()}
            arch.load_state_dict(state_dict)
            arch.eval()
            arch.to(self.device)
            self.models[model_id] = arch
            print(f"Loaded {model_id} model successfully")
```

**Step 3 — Fix `image_processor.py` to actually call the model.**

```python
async def apply_enhancement(self, input_tensor, model, model_id):
    with torch.no_grad():
        enhanced = model(input_tensor)  # ← This is the only line needed
    return enhanced
```

**Step 4 — Handle preprocessing correctly.**  
Some LLIE models (Zero-DCE, MIRNet) expect input in `[0, 1]` range, not `[-1, 1]`. The current normalization to `[-1, 1]` may produce wrong results. Verify the training preprocessing and match it exactly.

---

## Problem 2 (CRITICAL): Model File Missing from Repository

### What is Happening

`model_manager.py` looks for the model at:
```
backend/trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/model.pt
```
This directory does not exist in the repository. The model always silently fails to load.

### How to Fix

**Option A — Add model to repository (Not Recommended for Large Models)**  
Place `model.pt` at the expected path. Models >100 MB should NOT be committed to Git.

**Option B — Git LFS (For models ≤ 1GB)**
```bash
git lfs install
git lfs track "*.pt"
git add .gitattributes
git add backend/trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/model.pt
git commit -m "Add model via LFS"
```

**Option C — External Storage with Download Script (Recommended)**  
Store the model on Google Drive, Hugging Face Hub, or S3, and add a download script:
```python
# backend/download_models.py
import huggingface_hub
# or use gdown for Google Drive
huggingface_hub.hf_hub_download(
    repo_id="your-username/chandragrahan-models",
    filename="LOL_real/model.pt",
    local_dir="trained_models_SMG_Low_Light_Enhancement/trained_models/"
)
```

**Option D — Add a startup check with clear error**  
At minimum, make the server fail loudly if no model is found, instead of silently using the placeholder:
```python
# In main.py startup_event
if not model_manager.is_model_loaded("lol_real"):
    raise RuntimeError("FATAL: No models loaded. Cannot start server.")
```

---

## Problem 3 (CRITICAL): Password Hashing — SHA-256 Instead of bcrypt

### What is Happening

`auth_manager.py` line 57:
```python
def _hash_password(self, password):
    return hashlib.sha256(password.encode()).hexdigest()
```

SHA-256 is a fast hash, not a password hash. It has no salt and can be cracked in seconds using rainbow tables or GPU brute-force. The `passlib[bcrypt]` library is already installed but ignored.

### How to Fix

Replace the `_hash_password` and password verification logic with bcrypt:

```python
from passlib.context import CryptContext

class AuthManager:
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        # ... rest of init

    def _hash_password(self, password: str) -> str:
        return self.pwd_context.hash(password)

    def _verify_password(self, plain: str, hashed: str) -> bool:
        return self.pwd_context.verify(plain, hashed)
```

Then update the login check:
```python
# Before (insecure):
if user["password"] != hashed_password:

# After (secure):
if not self._verify_password(password, user["password"]):
```

> **Note:** Existing stored passwords will need to be reset after this change, as they are stored as SHA-256 hashes and won't verify with bcrypt.

---

## Problem 4 (HIGH): Token Auth — Random String Instead of JWT

### What is Happening

Tokens are `secrets.token_urlsafe(32)` — opaque random strings stored in `data/tokens.json`. Every authenticated API request requires:
1. Reading `tokens.json` from disk
2. Checking if the token exists
3. Reading `users.json` from disk for user data

This causes 2 disk reads per API call and has race condition risks.

### How to Fix

Implement proper JWT using `python-jose` (already installed):

```python
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24 * 7  # 7 days

def _create_jwt_token(self, user_data: dict) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user_data["email"],
        "user_id": user_data["id"],
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(self, token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if email is None:
            return None
        users = self._load_users()
        user = users.get(email)
        if not user:
            return None
        return {k: v for k, v in user.items() if k != 'password'}
    except JWTError:
        return None
```

Benefits: no token file needed, expiry is embedded in the token, stateless verification.

---

## Problem 5 (HIGH): JSON Flat-File Storage — Race Conditions

### What is Happening

All user and token data is stored in plain JSON files. The pattern:
```python
users = self._load_users()    # Read entire file
users[email] = user_data      # Modify in memory
self._save_users(users)        # Write entire file back
```

Under concurrent requests, two requests can both read the same state, make different modifications, and whichever writes last wins — causing data loss.

### How to Fix (Minimal)

Add file locking as a short-term fix:
```python
import fcntl

def _save_users(self, users):
    with open(self.users_file, 'w') as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        json.dump(users, f, indent=2)
        fcntl.flock(f, fcntl.LOCK_UN)
```

### How to Fix (Proper)

Migrate to SQLite (no server required, zero external dependencies beyond Python stdlib):
```python
import sqlite3

# schema.sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_login TEXT
);
```

Or use a proper database (PostgreSQL/MySQL) for production — see Deployment Plan document.

---

## Problem 6 (HIGH): Hardcoded API Base URL

### What is Happening

`frontend/src/services/api.js` line 1:
```js
const API_BASE_URL = 'http://localhost:8000';
```

This makes deployment impossible without source code changes.

### How to Fix

Use Vite's built-in environment variable support:

1. Create `frontend/.env.development`:
```
VITE_API_BASE_URL=http://localhost:8000
```

2. Create `frontend/.env.production`:
```
VITE_API_BASE_URL=https://your-production-domain.com
```

3. Update `api.js`:
```js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
```

---

## Problem 7 (MEDIUM): `createdAt` vs `created_at` Field Name Mismatch

### What is Happening

Backend stores: `"created_at": datetime.now().isoformat()`  
Frontend reads: `user.createdAt`  

Result: Profile page always shows "Member since Invalid Date".

### How to Fix

**Option A — Fix the backend** to return camelCase:
```python
# In auth_manager.py, when building user_response:
user_response = {
    "id": user["id"],
    "email": user["email"],
    "name": user["name"],
    "createdAt": user["created_at"],   # ← map here
    "lastLogin": user.get("last_login")
}
```

**Option B — Fix the frontend** to use snake_case:
```jsx
Member since {new Date(user.created_at).toLocaleDateString()}
```

---

## Problem 8 (MEDIUM): Image Delete Doesn't Clean Server Files

### What is Happening

`Profile.jsx` → `deleteImage(imageId)` only removes the entry from `localStorage`. The actual files at `backend/uploads/` and `backend/outputs/` accumulate indefinitely.

### How to Fix

Call the cleanup endpoint before removing from local state in `ImageContext.jsx`:

```js
const deleteImage = async (imageId) => {
    try {
        await apiService.cleanupFiles(imageId);  // ← add this call
    } catch (err) {
        console.warn('Server cleanup failed:', err);
        // Still proceed with local delete
    }
    const updatedImages = images.filter(img => img.id !== imageId);
    setImages(updatedImages);
    localStorage.setItem('userImages', JSON.stringify(updatedImages));
};
```

---

## Problem 9 (MEDIUM): React Router Outside Context Providers

### What is Happening

`App.jsx` nests `<Router>` inside `<AuthProvider>` and `<ImageProvider>`. Any future use of `useNavigate()`, `useLocation()`, or `<Link>` inside either context will throw:

> "useNavigate() may be used only in the context of a Router component"

### How to Fix

Wrap everything in `<Router>` first:
```jsx
function App() {
  return (
    <Router>                    {/* ← Router outermost */}
      <AuthProvider>
        <ImageProvider>
          <div className="App">
            <Navbar />
            <Routes>...</Routes>
          </div>
        </ImageProvider>
      </AuthProvider>
    </Router>
  );
}
```

---

## Problem 10 (MEDIUM): No Error Boundaries

### What is Happening

Any JavaScript error in a child component will unmount the entire React tree and show a blank white page. There is no fallback UI.

### How to Fix

Add a class-based ErrorBoundary component:

```jsx
// frontend/src/components/ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('ErrorBoundary caught:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="error-fallback">
                    <h2>Something went wrong.</h2>
                    <button onClick={() => this.setState({ hasError: false })}>
                        Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
```

Wrap the app:
```jsx
<ErrorBoundary>
  <Router>...</Router>
</ErrorBoundary>
```

---

## Problem 11 (MEDIUM): CORS Locked to Localhost

### What is Happening

```python
allow_origins=["http://localhost:5173", "http://localhost:3000"]
```

Any production deployment from a different domain will fail all browser requests.

### How to Fix

Read allowed origins from environment variables:

```python
import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Set in production environment:
```
ALLOWED_ORIGINS=https://chandragrahan.yoursite.com
```

---

## Problem 12 (LOW): Static 60% Progress Bar

### What is Happening

The progress bar during image processing is hardcoded at `width: '60%'` and never animates.

### How to Fix

Use a CSS indeterminate animation (simplest fix):
```css
.processing-progress-bar {
    animation: indeterminate 1.5s infinite linear;
    width: 40%;
}
@keyframes indeterminate {
    0%   { transform: translateX(-150%); }
    100% { transform: translateX(350%); }
}
```

Or implement real-time WebSocket progress streaming from the backend for a proper solution.

---

## Summary of Fixes by Priority

| # | Problem | Effort | Priority |
|---|---|---|---|
| 1 | Wire actual model inference | High | 🔴 Critical |
| 2 | Add model file / download script | Medium | 🔴 Critical |
| 3 | Replace SHA-256 with bcrypt | Low | 🔴 Critical |
| 4 | Replace random tokens with JWT | Medium | 🟠 High |
| 5 | File locking or migrate to SQLite | Medium | 🟠 High |
| 6 | Use `VITE_API_BASE_URL` env var | Low | 🟠 High |
| 7 | Fix `createdAt`/`created_at` mismatch | Low | 🟡 Medium |
| 8 | Call server cleanup on image delete | Low | 🟡 Medium |
| 9 | Fix Router provider nesting order | Low | 🟡 Medium |
| 10 | Add React ErrorBoundary | Low | 🟡 Medium |
| 11 | CORS from environment variable | Low | 🟡 Medium |
| 12 | Animated progress bar | Low | 🟢 Low |
