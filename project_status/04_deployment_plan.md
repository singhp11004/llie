# ChandraGrahan LLIE — Deployment Plan

**Document Type:** Production Deployment Strategy  
**Covers:** Architecture, Infrastructure, CI/CD, Scaling, Security

---

## 1. Recommended Deployment Architecture

### Overview

The best deployment structure for this project separates the frontend (static assets) from the backend (Python/PyTorch server). This provides:
- **Independent scaling:** The backend (CPU/GPU intensive) scales separately from the frontend
- **Cost efficiency:** Static frontend hosting is essentially free
- **Better caching:** CDN for frontend, no server resources wasted serving HTML/JS/CSS

```
┌─────────────────────────────────────────────────────────┐
│                         Internet                         │
└───────────┬────────────────────────┬────────────────────┘
            │                        │
    ┌───────▼────────┐      ┌────────▼────────┐
    │   CDN / Static │      │  Load Balancer  │
    │   Frontend     │      │  (nginx/ALB)    │
    │  (Vercel/CF)   │      └────────┬────────┘
    └────────────────┘               │
                             ┌───────▼────────┐
                             │  Backend API   │
                             │  (FastAPI)     │
                             │  Docker/VM     │
                             └───────┬────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                 ┌────────▼──────┐    ┌─────────▼──────┐
                 │   Database    │    │  File Storage  │
                 │  (SQLite or   │    │  (Local or S3) │
                 │  PostgreSQL)  │    └────────────────┘
                 └───────────────┘
```

---

## 2. Deployment Options — Tiers by Cost and Complexity

### Tier 1: Minimal (Self-Hosted VPS) — Recommended for Personal/Portfolio

**Best for:** Showcasing the project, personal use, development  
**Cost:** ~$5–15/month  
**Complexity:** Low

**Frontend:** Vercel (free)  
**Backend:** A $5/mo VPS (DigitalOcean Droplet, Linode, Hetzner)

```
Provider Recommendations:
- Hetzner CX21 (2 vCPU, 4GB RAM): €3.79/mo — best value in Europe
- DigitalOcean Basic Droplet (1 vCPU, 2GB RAM): $6/mo — easiest UX
- AWS Lightsail (1 vCPU, 2GB RAM): $5/mo — AWS ecosystem
```

> **Note:** PyTorch CPU inference works on 2GB RAM for images up to ~1024×1024. GPU inference requires a GPU instance (~$0.50–1/hr on spot).

### Tier 2: Production (Docker + Cloud) — Recommended for Real Users

**Best for:** Production, team use, API sharing  
**Cost:** $15–50/month  
**Complexity:** Medium

**Frontend:** Vercel or Cloudflare Pages (free)  
**Backend:** Docker container on AWS EC2, GCP Compute Engine, or Railway.app

### Tier 3: Fully Managed (High Traffic)

**Best for:** Scale, SLA, enterprise  
**Cost:** $50–500+/month  
**Complexity:** High  
**Stack:** Kubernetes + RDS PostgreSQL + S3 + CloudFront

---

## 3. Step-by-Step Deployment: Tier 1 (VPS + Vercel)

### Step 1: Prepare the Repository

**Before deployment, fix these in the codebase (see `02_problems_and_fixes.md`):**

1. Add `.env` support:
   ```
   # backend/.env
   SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(64))">
   ALLOWED_ORIGINS=https://your-frontend.vercel.app
   DATABASE_URL=sqlite:///data/chandragrahan.db
   ```

2. Add `frontend/.env.production`:
   ```
   VITE_API_BASE_URL=https://your-backend-domain.com
   ```

3. Ensure `.gitignore` contains:
   ```
   backend/.env
   backend/data/
   backend/uploads/
   backend/outputs/
   backend/venv/
   frontend/.env.production
   ```

### Step 2: Set Up VPS (DigitalOcean example)

```bash
# On your local machine — SSH into VPS
ssh root@YOUR_VPS_IP

# Update and install prerequisites
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl

# Install Node.js (if building frontend on server — optional)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Create app user (don't run as root)
adduser --disabled-password --gecos "" chandragrahan
su - chandragrahan
```

### Step 3: Deploy Backend on VPS

```bash
# As chandragrahan user
cd ~
git clone https://github.com/YOUR_USERNAME/llie.git
cd llie/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Add your PyTorch model file
mkdir -p trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/
# Upload model.pt here via scp or wget

# Create .env file
cat > .env << 'EOF'
SECRET_KEY=<your-secret-key>
ALLOWED_ORIGINS=https://your-frontend.vercel.app
EOF

# Create systemd service for auto-restart
```

```bash
# As root — create systemd service
cat > /etc/systemd/system/chandragrahan.service << 'EOF'
[Unit]
Description=ChandraGrahan LLIE Backend
After=network.target

[Service]
User=chandragrahan
WorkingDirectory=/home/chandragrahan/llie/backend
Environment="PATH=/home/chandragrahan/llie/backend/venv/bin"
ExecStart=/home/chandragrahan/llie/backend/venv/bin/python start_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable chandragrahan
systemctl start chandragrahan
systemctl status chandragrahan  # Verify it's running
```

### Step 4: Configure Nginx as Reverse Proxy

```nginx
# /etc/nginx/sites-available/chandragrahan
server {
    listen 80;
    server_name api.your-domain.com;

    # Max upload size (match your use case)
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # For WebSocket support (Upgrade 4)
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

```bash
# Activate and get SSL certificate
ln -s /etc/nginx/sites-available/chandragrahan /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# Get free SSL certificate (HTTPS required for camera API)
certbot --nginx -d api.your-domain.com
# Certbot auto-renews certificates
```

### Step 5: Deploy Frontend on Vercel

```bash
# On your local machine
cd frontend

# Install Vercel CLI
npm install -g vercel

# Create production env
echo "VITE_API_BASE_URL=https://api.your-domain.com" > .env.production

# Deploy
vercel --prod

# Follow the interactive prompts:
# Set up and deploy → Yes
# Which scope → your account
# Link to existing project? → No
# Project name → chandragrahan
# Directory → ./
# Build command → npm run build
# Output directory → dist
```

After deployment, Vercel provides a URL like `https://chandragrahan.vercel.app`.  
Update backend `.env`'s `ALLOWED_ORIGINS` to match.

---

## 4. Step-by-Step Deployment: Tier 2 (Docker)

### Docker Configuration

**`backend/Dockerfile`:**
```dockerfile
FROM python:3.10-slim

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create runtime directories
RUN mkdir -p uploads outputs data

# Expose port
EXPOSE 8000

# Non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "start_server.py"]
```

**`docker-compose.yml` (project root):**
```yaml
version: '3.9'

services:
  backend:
    build:
      context: ./backend
    image: chandragrahan-backend:latest
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./backend/data:/app/data        # Persist user database
      - ./backend/uploads:/app/uploads  # Persist uploads
      - ./backend/outputs:/app/outputs  # Persist outputs
      - ./backend/trained_models_SMG_Low_Light_Enhancement:/app/trained_models_SMG_Low_Light_Enhancement
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - backend
    restart: unless-stopped
```

**Deploy with Docker:**
```bash
# On your server
git clone https://github.com/YOUR_USERNAME/llie.git
cd llie

# Set environment variables
cat > .env << 'EOF'
SECRET_KEY=<your-secret-key>
ALLOWED_ORIGINS=https://chandragrahan.vercel.app
EOF

# Build and start
docker compose up -d

# View logs
docker compose logs -f backend
```

---

## 5. CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml` for automatic deployment on every push to `main`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - run: pip install -r backend/requirements.txt
      - run: python -m pytest backend/tests/ -v  # Add tests first

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: chandragrahan
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/llie
            git pull origin main
            source backend/venv/bin/activate
            pip install -r backend/requirements.txt
            sudo systemctl restart chandragrahan

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.PROD_API_URL }}
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
          vercel-args: '--prod'
```

---

## 6. Environment Variables Reference

### Backend (`.env`)

| Variable | Description | Example |
|---|---|---|
| `SECRET_KEY` | JWT signing key (min 32 chars) | `openssl rand -hex 64` |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs | `https://app.vercel.app` |
| `DATABASE_URL` | SQLite or PostgreSQL URL | `sqlite:///data/app.db` |
| `MODEL_DIR` | Path to model weights | `./trained_models/` |
| `MAX_UPLOAD_MB` | Max file size in MB | `20` |
| `PORT` | Server port | `8000` |

### Frontend (`.env.production`)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Backend API base URL | `https://api.your-domain.com` |

---

## 7. Security Checklist for Production

- [ ] `SECRET_KEY` is a long random string, not the default
- [ ] HTTPS is enabled (required for camera API, JWT security)
- [ ] CORS `allow_origins` lists only your actual domain
- [ ] Passwords use bcrypt (not SHA-256)
- [ ] JWT tokens used (not random strings)
- [ ] `.env` and `data/` directory are in `.gitignore`
- [ ] Model files are not committed to Git (use Git LFS or S3)
- [ ] File upload size is limited (`client_max_body_size` in nginx)
- [ ] Backend runs as non-root user
- [ ] Rate limiting configured (add `slowapi` package for FastAPI)

---

## 8. Domain and DNS Setup

If you have a custom domain (e.g., `chandragrahan.com`):

```
DNS Records:
──────────────────────────────────────────────────────
Type    Host          Value                   TTL
──────────────────────────────────────────────────────
A       api           YOUR_VPS_IP             3600   ← Backend
CNAME   @             cname.vercel-dns.com    3600   ← Frontend (if using Vercel)
──────────────────────────────────────────────────────
```

Update nginx `server_name api.chandragrahan.com;`  
Run `certbot --nginx -d api.chandragrahan.com`  
Update `VITE_API_BASE_URL=https://api.chandragrahan.com`

---

## 9. Performance Tuning for Production

### Uvicorn Worker Configuration

Replace single-process uvicorn with multiple workers:

```python
# start_server.py — production config
uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=8000,
    workers=2,          # 2 workers for CPU inference (1 per CPU core)
    log_level="warning",
    access_log=True,
)
```

> **WARNING:** With `workers=2`, the `ModelManager` and its loaded model are duplicated in each worker process. Each worker needs ~1–2GB RAM. Ensure your VPS has enough memory (4GB+ recommended for 2 workers with PyTorch).

### Async File I/O

Replace synchronous file operations with `aiofiles`:
```python
import aiofiles

async with aiofiles.open(upload_path, "wb") as buffer:
    content = await file.read()
    await buffer.write(content)
```

### Model Inference Offloading

For production, run model inference in a separate thread pool to avoid blocking the event loop:
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

async def apply_enhancement(self, input_tensor, model):
    loop = asyncio.get_event_loop()
    def run_inference():
        with torch.no_grad():
            return model(input_tensor)
    return await loop.run_in_executor(executor, run_inference)
```

---

## 10. Monitoring and Logging

### Add structured logging

```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)
```

### Health Check Endpoint (add to `main.py`)

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "models_loaded": model_manager.get_available_models(),
        "timestamp": datetime.now().isoformat()
    }
```

### Free Monitoring Options

- **UptimeRobot** (free): Ping your `/health` endpoint every 5 min, alert on downtime
- **Grafana Cloud** (free tier): Metrics dashboards
- **Sentry** (free tier): Error tracking for both Python and React

---

## 11. Deployment Checklist

### Pre-Deployment

- [ ] All bugs from `02_problems_and_fixes.md` (Critical + High) are fixed
- [ ] Model file is available at the configured path on the server
- [ ] Environment variables set in `.env`
- [ ] Frontend `.env.production` has correct API URL
- [ ] HTTPS certificate obtained and nginx configured
- [ ] Firewall allows ports 80, 443, 22 only

### Post-Deployment Verification

- [ ] `GET https://api.your-domain.com/` returns `{"status": "running"}`
- [ ] `GET https://api.your-domain.com/health` shows model loaded
- [ ] Frontend loads at `https://chandragrahan.your-domain.com`
- [ ] User can register and log in
- [ ] Image upload returns enhanced result (not placeholder)
- [ ] Camera capture works in browser (HTTPS required)
- [ ] Download of enhanced image succeeds
- [ ] SSL certificate is valid (check at `ssllabs.com/ssltest`)

---

## 12. Recommended Final Repository Structure

```
llie/                               ← project root
├── .github/
│   └── workflows/
│       └── deploy.yml              ← CI/CD pipeline
├── .gitignore
├── docker-compose.yml              ← Docker orchestration
├── nginx.conf                      ← Production nginx config
├── README.md
├── backend/
│   ├── .env.example                ← Template (not .env itself)
│   ├── Dockerfile
│   ├── main.py
│   ├── start_server.py
│   ├── requirements.txt
│   ├── download_models.py          ← Script to fetch model weights
│   ├── models/
│   │   ├── __init__.py
│   │   ├── architecture/
│   │   │   └── zero_dce.py         ← Model architecture definition
│   │   ├── auth_manager.py         ← Uses bcrypt + JWT
│   │   ├── image_processor.py      ← Real model inference
│   │   └── model_manager.py        ← Proper state dict loading
│   └── tests/
│       ├── test_auth.py
│       └── test_enhancement.py
├── frontend/
│   ├── .env.example
│   ├── .env.development            ← localhost API URL (not committed)
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                 ← Router outermost
│       ├── components/
│       │   ├── CameraCapture.jsx   ← New camera component
│       │   ├── ErrorBoundary.jsx   ← New error boundary
│       │   ├── ImageUploader.jsx
│       │   ├── Navbar.jsx
│       │   └── ThreeBackground.jsx
│       ├── contexts/
│       ├── pages/
│       └── services/
│           └── api.js              ← Uses VITE_API_BASE_URL
└── project_status/                 ← This directory
    ├── 01_current_state.md
    ├── 02_problems_and_fixes.md
    ├── 03_upgrade_plans.md
    └── 04_deployment_plan.md       ← This file
```
