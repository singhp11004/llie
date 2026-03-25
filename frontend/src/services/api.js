const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async register(email, password, name) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, password, name }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const result = await response.json();
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      console.error('Registration Error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }

  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const result = await response.json();
      this.setToken(result.token);
      return {
        success: true,
        user: result.user,
        token: result.token
      };
    } catch (error) {
      console.error('Login Error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  async logout() {
    try {
      if (this.token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
        });
      }
      this.setToken(null);
      return { success: true };
    } catch (error) {
      console.error('Logout Error:', error);
      this.setToken(null);
      return { success: true }; // Always succeed logout locally
    }
  }

  async getCurrentUser() {
    try {
      if (!this.token) {
        return { success: false, error: 'No token available' };
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.setToken(null);
          return { success: false, error: 'Token expired' };
        }
        throw new Error('Failed to get user info');
      }

      const result = await response.json();
      return {
        success: true,
        user: result.user
      };
    } catch (error) {
      console.error('Get User Error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get user info'
      };
    }
  }
  async enhanceImage(file, modelId = "lol_real") {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_id', modelId);

    try {
      const headers = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${API_BASE_URL}/enhance`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.setToken(null);
          throw new Error('Authentication required');
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Enhancement failed');
      }

      const result = await response.json();
      return {
        success: true,
        fileId: result.file_id,
        originalFilename: result.original_filename,
        downloadUrl: `${API_BASE_URL}${result.download_url}`,
        modelUsed: result.model_used
      };
    } catch (error) {
      console.error('API Error:', error);
      let errorMsg = error.message;
      if (errorMsg === 'Failed to fetch') {
        errorMsg = 'Cannot connect to the server. Please ensure the backend Python server is running.';
      }
      return {
        success: false,
        error: errorMsg || 'Network error occurred'
      };
    }
  }

  async getAvailableModels() {
    try {
      const response = await fetch(`${API_BASE_URL}/models`);
      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching models:', error);
      return { models: [] };
    }
  }

  async downloadEnhancedImage(downloadUrl) {
    try {
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      return await response.blob();
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async cleanupFiles(fileId) {
    try {
      const response = await fetch(`${API_BASE_URL}/cleanup/${fileId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Cleanup failed');
      }
      return await response.json();
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }
}

export default new ApiService();
