# ChandraGrahan - Low Light Image Enhancement

A full-stack application for enhancing low light images using AI models. The application consists of a React frontend and a Python FastAPI backend with three trained PyTorch models.

## Features

- **AI-Powered Enhancement**: Uses LOL Real Dataset model trained on real low light images
- **Modern UI**: Beautiful React frontend with 3D background and smooth animations
- **Real-time Processing**: Upload images and get enhanced results instantly
- **Secure Authentication**: JWT-based authentication with password hashing
- **User Management**: Register, login, and manage user accounts
- **Image Management**: View and manage your enhanced images
- **Session Management**: Automatic token validation and refresh

## Project Structure

```
ChandraGrahan/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── contexts/        # React contexts (Auth, Image)
│   │   ├── services/        # API services
│   │   └── pages/           # Page components
│   └── package.json
├── backend/                  # Python FastAPI backend
│   ├── models/              # AI model management
│   ├── trained_models_SMG_Low_Light_Enhancement/
│   │   └── trained_models/  # Pre-trained PyTorch models
│   ├── main.py              # FastAPI application
│   └── requirements.txt     # Python dependencies
└── README.md
```

## Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **Git**

## Quick Start

### 1. Start the Backend

**Windows:**
```bash
cd backend
run_backend.bat
```

**Linux/Mac:**
```bash
cd backend
./run_backend.sh
```

The backend will be available at `http://localhost:8000`

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Manual Setup

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment:**
   
   **Windows:**
   ```bash
   venv\Scripts\activate
   ```
   
   **Linux/Mac:**
   ```bash
   source venv/bin/activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

5. **Start the server:**
   ```bash
   python start_server.py
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - Logout user

### Image Processing
- `GET /` - API status
- `GET /models` - Get available models
- `POST /enhance` - Enhance an image (requires authentication)
- `GET /download/{file_id}` - Download enhanced image
- `DELETE /cleanup/{file_id}` - Clean up files

## Usage

1. **Open the application** in your browser at `http://localhost:5173`
2. **Create an account** or **login** with existing credentials
3. **Upload an image** by dragging and dropping or clicking to browse
4. **Click "Enhance Image"** to process your image with the LOL Real model
5. **Download** the enhanced result

### Authentication

- **Registration**: Create a new account with email, password, and name
- **Login**: Sign in with your email and password
- **Security**: Passwords are hashed and tokens are used for authentication
- **Session**: Your session persists across browser refreshes
- **Logout**: Sign out to end your session

## AI Model

### LOL Real Dataset
- **Best for**: Real-world low light photographs
- **Training**: Real low light images from various sources
- **Use case**: General photography enhancement
- **Performance**: Optimized for natural low light scenarios

## Troubleshooting

### Backend Issues

- **Port 8000 already in use**: Change the port in `start_server.py`
- **Model loading errors**: Ensure all model files are present in the `trained_models` directory. **Note: Currently, the pre-trained weights for the `LOL_real` model are missing from the `backend/trained_models_SMG_Low_Light_Enhancement/trained_models/LOL_real/` directory. You must supply a trained `model.pt` file for the AI enhancement to work, otherwise the system will use a simple brightness/contrast fallback.**
- **Python dependencies**: Make sure all packages are installed correctly

### Frontend Issues

- **Port 5173 already in use**: Vite will automatically use the next available port
- **API connection errors**: Ensure the backend is running on `http://localhost:8000`
- **Build errors**: Clear node_modules and reinstall dependencies

## Development

### Backend Development

The backend uses FastAPI with the following structure:
- `main.py` - Main application and API endpoints
- `models/model_manager.py` - Model loading and management
- `models/image_processor.py` - Image processing logic

### Frontend Development

The frontend uses React with:
- **Context API** for state management
- **React Router** for navigation
- **GSAP** for animations
- **Three.js** for 3D background

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational and personal use.

## Support

For issues and questions, please check the troubleshooting section or create an issue in the repository.
