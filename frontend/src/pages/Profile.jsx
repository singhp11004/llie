import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useImages } from '../contexts/ImageContext';
import { Download, Trash2, Clock, Image as ImageIcon, User } from 'lucide-react';
import { gsap } from 'gsap';

const Profile = () => {
  const { user } = useAuth();
  const { images, deleteImage, getTimeRemaining } = useImages();
  const profileRef = useRef();

  useEffect(() => {
    if (profileRef.current) {
      gsap.fromTo('.profile-content',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
      );
    }
  }, []);

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const downloadImage = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `enhanced_${filename}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (imageId) => {
    if (window.confirm('Are you sure you want to delete this image?')) {
      deleteImage(imageId);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div ref={profileRef} className="profile-page">
      <div className="profile-container">
        {/* Profile Header */}
        <div className="profile-content profile-header card">
          <div className="profile-header-content">
            <div className="profile-avatar">
              <User className="profile-avatar-icon" />
            </div>
            <div className="profile-info">
              <h1 className="profile-name">{user.name}</h1>
              <p className="profile-email">{user.email}</p>
              <p className="profile-member-since">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="profile-content profile-stats">
          <div className="card stat-card">
            <div className="stat-number stat-number-primary">{images.length}</div>
            <div className="stat-label">Total Images</div>
          </div>
          <div className="card stat-card">
            <div className="stat-number stat-number-success">
              {images.reduce((acc, img) => acc + img.size, 0) > 0 ? formatFileSize(images.reduce((acc, img) => acc + img.size, 0)) : '0 MB'}
            </div>
            <div className="stat-label">Storage Used</div>
          </div>
          <div className="card stat-card">
            <div className="stat-number stat-number-purple">24h</div>
            <div className="stat-label">Auto-Delete Timer</div>
          </div>
        </div>

        {/* Images Grid */}
        <div className="profile-content">
          <div className="profile-images-header">
            <h2 className="profile-images-title">Your Enhanced Images</h2>
            <div className="profile-images-note">
              Images are automatically deleted after 24 hours
            </div>
          </div>

          {images.length === 0 ? (
            <div className="card profile-empty">
              <ImageIcon className="profile-empty-icon" />
              <h3 className="profile-empty-title">No Images Yet</h3>
              <p className="profile-empty-description">
                Upload your first low light image to get started with AI enhancement.
              </p>
              <a href="/" className="btn-primary profile-empty-button">
                Upload Image
              </a>
            </div>
          ) : (
            <div className="profile-images-grid">
              {images.map((image) => (
                <div key={image.id} className="card profile-image-card">
                  <div className="profile-image-container">
                    <img
                      src={image.enhancedUrl}
                      alt={image.originalName}
                      className="profile-image"
                    />
                    <div className="profile-image-timer">
                      <Clock className="profile-image-timer-icon" />
                      <span>{getTimeRemaining(image.uploadedAt)}</span>
                    </div>
                  </div>

                  <div className="profile-image-details">
                    <div className="profile-image-info">
                      <h3 className="profile-image-name">{image.originalName}</h3>
                      <p className="profile-image-meta">
                        {formatFileSize(image.size)} • {new Date(image.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="profile-image-actions">
                      <button
                        onClick={() => downloadImage(image.enhancedUrl, image.originalName)}
                        className="btn-primary profile-image-download"
                      >
                        <Download className="btn-icon" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => handleDelete(image.id)}
                        className="btn-secondary profile-image-delete"
                      >
                        <Trash2 className="btn-icon" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;