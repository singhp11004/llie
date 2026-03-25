import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, Download, Loader, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';
import ComparisonSlider from './ComparisonSlider';
import { useImages } from '../contexts/ImageContext';
import { useAuth } from '../contexts/AuthContext';
import { gsap } from 'gsap';

const ImageUploader = () => {
  const { user } = useAuth();
  const { processImage, processing } = useImages();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'camera'
  const [selectedModel, setSelectedModel] = useState('lol_real');
  const [availableModels, setAvailableModels] = useState([]);
  const fileInputRef = useRef();
  const uploaderRef = useRef();

  useEffect(() => {
    if (uploaderRef.current) {
      gsap.fromTo(uploaderRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.3 }
      );
    }

    // Fetch available models
    import('../services/api').then(({ default: apiService }) => {
      apiService.getAvailableModels().then(data => {
        if (data && data.models) {
          setAvailableModels(data.models);
        }
      });
    });
  }, []);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type.startsWith('image/')) {
      setSelectedFile(file);
      setResult(null);
    } else {
      alert('Please select an image file');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    const result = await processImage(selectedFile, selectedModel);
    if (result.success) {
      setResult(result.image);
      setSelectedFile(null);
    } else {
      alert(result.error);
    }
  };

  const downloadImage = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetUploader = () => {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div ref={uploaderRef} className="image-uploader">

      {!selectedFile && !result && (
        <div className="input-mode-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
          <button
            className={`tab btn-secondary ${inputMode === 'upload' ? 'active' : ''}`}
            style={{ padding: '0.5rem 1.5rem', opacity: inputMode === 'upload' ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setInputMode('upload')}
          >
            <Upload size={18} /> Upload File
          </button>
          <button
            className={`tab btn-secondary ${inputMode === 'camera' ? 'active' : ''}`}
            style={{ padding: '0.5rem 1.5rem', opacity: inputMode === 'camera' ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => setInputMode('camera')}
          >
            <Camera size={18} /> Use Camera
          </button>
        </div>
      )}

      {!selectedFile && !result && inputMode === 'upload' && (
        <div
          className={`upload-dropzone ${dragActive ? 'upload-dropzone-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleChange}
            className="upload-input"
          />

          <div className="upload-content">
            <div className="upload-icon-container">
              <Upload className="upload-icon" />
            </div>

            <div className="upload-text">
              <h3 className="upload-title">
                Upload Your Low Light Image
              </h3>
              <p className="upload-description">
                Drag and drop your image here, or click to browse
              </p>
              <p className="upload-formats">
                Supports JPG, PNG, WebP up to 10MB
              </p>
            </div>

            <button className="btn-primary upload-button">
              Choose File
            </button>
          </div>
        </div>
      )}

      {!selectedFile && !result && inputMode === 'camera' && (
        <div className="card" style={{ padding: '2rem' }}>
          <CameraCapture onCapture={handleFile} />
        </div>
      )}

      {selectedFile && !processing && !result && (
        <div className="card">
          <div className="selected-image-header">
            <h3 className="selected-image-title">Selected Image</h3>
            <button
              onClick={resetUploader}
              className="selected-image-close"
            >
              <X className="selected-image-close-icon" />
            </button>
          </div>

          <div className="selected-image-grid">
            <div className="selected-image-preview">
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Selected"
                className="selected-image-img"
              />
              <p className="selected-image-label">Original Image</p>
            </div>

            <div className="selected-image-actions">
              <div className="selected-image-placeholder">
                <ImageIcon className="selected-image-placeholder-icon" />
                <p className="selected-image-placeholder-text">Enhanced image will appear here</p>
              </div>

              {availableModels.length > 0 && (
                <div style={{ marginTop: '1rem', width: '100%' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#aaa' }}>Select Enhancement Model</label>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    style={{
                      width: '100%', padding: '0.75rem', paddingRight: '2.5rem',
                      borderRadius: '8px', border: '1px solid #444',
                      backgroundColor: '#2a2a2a', color: 'white',
                      appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto'
                    }}
                  >
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={handleUpload}
                className="btn-primary selected-image-enhance"
                style={{ marginTop: '1rem', width: '100%' }}
              >
                Enhance Image
              </button>
            </div>
          </div>
        </div>
      )}

      {processing && (
        <div className="card processing-card">
          <div className="processing-content">
            <div className="processing-icon-container">
              <Loader className="processing-icon" />
            </div>
            <h3 className="processing-title">Enhancing Your Image</h3>
            <p className="processing-description">
              Our AI is working to brighten and enhance your low light image...
            </p>
            <div className="processing-progress">
              <div className="processing-progress-bar" style={{ width: '60%' }}></div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="card">
          <div className="result-header">
            <h3 className="result-title">Enhancement Complete!</h3>
            <button
              onClick={resetUploader}
              className="result-close"
            >
              <X className="result-close-icon" />
            </button>
          </div>

          <div style={{ margin: '1.5rem 0' }}>
            <ComparisonSlider
              originalSrc={result.originalUrl}
              enhancedSrc={result.enhancedUrl}
            />
          </div>

          <div className="result-download">
            <button
              onClick={() => downloadImage(result.enhancedUrl, result.originalName)}
              className="btn-primary result-download-button"
            >
              <Download className="btn-icon" />
              <span>Download Enhanced Image</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;