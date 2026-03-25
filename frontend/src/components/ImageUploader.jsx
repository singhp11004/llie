import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, Download, Loader } from 'lucide-react';
import { useImages } from '../contexts/ImageContext';
import { useAuth } from '../contexts/AuthContext';
import { gsap } from 'gsap';

const ImageUploader = () => {
  const { user } = useAuth();
  const { processImage, processing } = useImages();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef();
  const uploaderRef = useRef();

  useEffect(() => {
    if (uploaderRef.current) {
      gsap.fromTo(uploaderRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.3 }
      );
    }
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

    const result = await processImage(selectedFile);
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

              <button
                onClick={handleUpload}
                className="btn-primary selected-image-enhance"
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

          <div className="result-grid">
            <div className="result-image-container">
              <img
                src={result.originalUrl}
                alt="Original"
                className="result-image"
              />
              <p className="result-image-label">Original Image</p>
            </div>

            <div className="result-image-container">
              <img
                src={result.enhancedUrl}
                alt="Enhanced"
                className="result-image"
              />
              <p className="result-image-label">Enhanced Image</p>
            </div>
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