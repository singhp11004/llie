import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import apiService from '../services/api';

const ImageContext = createContext();

export const useImages = () => {
  const context = useContext(ImageContext);
  if (!context) {
    throw new Error('useImages must be used within an ImageProvider');
  }
  return context;
};

export const ImageProvider = ({ children }) => {
  const { user } = useAuth();
  const [images, setImages] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserImages();
      // Set up auto-deletion timer
      const interval = setInterval(checkExpiredImages, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadUserImages = () => {
    const savedImages = localStorage.getItem('userImages');
    if (savedImages) {
      const parsedImages = JSON.parse(savedImages);
      // Filter out expired images
      const validImages = parsedImages.filter(img => {
        const uploadTime = new Date(img.uploadedAt);
        const now = new Date();
        const hoursDiff = (now - uploadTime) / (1000 * 60 * 60);
        return hoursDiff < 24;
      });
      setImages(validImages);
      if (validImages.length !== parsedImages.length) {
        localStorage.setItem('userImages', JSON.stringify(validImages));
      }
    }
  };

  const checkExpiredImages = () => {
    setImages(prevImages => {
      const validImages = prevImages.filter(img => {
        const uploadTime = new Date(img.uploadedAt);
        const now = new Date();
        const hoursDiff = (now - uploadTime) / (1000 * 60 * 60);
        return hoursDiff < 24;
      });

      if (validImages.length !== prevImages.length) {
        localStorage.setItem('userImages', JSON.stringify(validImages));
      }

      return validImages;
    });
  };

  const processImage = async (file) => {
    setProcessing(true);

    try {
      // Call backend API for image enhancement
      const result = await apiService.enhanceImage(file);

      if (result.success) {
        const originalUrl = URL.createObjectURL(file);

        const newImage = {
          id: result.fileId,
          originalName: result.originalFilename,
          originalUrl,
          enhancedUrl: result.downloadUrl,
          uploadedAt: new Date().toISOString(),
          size: file.size,
          type: file.type,
          modelUsed: "lol_real"
        };

        const updatedImages = [...images, newImage];
        setImages(updatedImages);
        localStorage.setItem('userImages', JSON.stringify(updatedImages));

        setProcessing(false);
        return { success: true, image: newImage };
      } else {
        setProcessing(false);
        return { success: false, error: result.error };
      }

    } catch (error) {
      setProcessing(false);
      return { success: false, error: error.message };
    }
  };

  const deleteImage = async (imageId) => {
    try {
      await apiService.cleanupFiles(imageId);
    } catch (err) {
      console.warn('Server cleanup failed:', err);
    }
    const updatedImages = images.filter(img => img.id !== imageId);
    setImages(updatedImages);
    localStorage.setItem('userImages', JSON.stringify(updatedImages));
  };

  const getTimeRemaining = (uploadedAt) => {
    const uploadTime = new Date(uploadedAt);
    const now = new Date();
    const hoursPassed = (now - uploadTime) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, 24 - hoursPassed);

    if (hoursRemaining < 1) {
      const minutesRemaining = Math.max(0, (24 * 60) - ((now - uploadTime) / (1000 * 60)));
      return `${Math.floor(minutesRemaining)}m`;
    }

    return `${Math.floor(hoursRemaining)}h ${Math.floor((hoursRemaining % 1) * 60)}m`;
  };

  const value = {
    images,
    processing,
    processImage,
    deleteImage,
    getTimeRemaining
  };

  return (
    <ImageContext.Provider value={value}>
      {children}
    </ImageContext.Provider>
  );
};