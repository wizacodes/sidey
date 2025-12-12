// Cloudflare Configuration for SideyCMS
// This config replaces Firebase and will be used across the entire Sidey CMS platform

const CLOUDFLARE_CONFIG = {
  // API base URL - update this to your deployed worker URL
  apiBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://sidey-api.robwillmarsh.workers.dev',
  
  // R2 bucket public URL for assets
  r2PublicUrl: 'https://assets.sidey.app',
  
  // App URL
  appUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.host}`
    : 'https://sidey.app',
};

// Auth state management
let currentUser = null;
let authToken = null;

// Initialize from localStorage
function initAuth() {
  const storedToken = localStorage.getItem('sidey_token');
  const storedUser = localStorage.getItem('sidey_user');
  if (storedToken && storedUser) {
    authToken = storedToken;
    currentUser = JSON.parse(storedUser);
  }
}

// API helper function
async function apiRequest(endpoint, options = {}) {
  const url = `${CLOUDFLARE_CONFIG.apiBaseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  
  return response.json();
}

// Auth API wrapper
const auth = {
  // Sign up new user
  async signUp(email, password, siteName, fullName) {
    const result = await apiRequest('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, siteName, fullName }),
    });
    
    if (result.token) {
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem('sidey_token', authToken);
      localStorage.setItem('sidey_user', JSON.stringify(currentUser));
    }
    
    return result;
  },
  
  // Sign in existing user
  async signIn(email, password) {
    const result = await apiRequest('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (result.token) {
      authToken = result.token;
      currentUser = result.user;
      localStorage.setItem('sidey_token', authToken);
      localStorage.setItem('sidey_user', JSON.stringify(currentUser));
    }
    
    return result;
  },
  
  // Sign out
  signOut() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('sidey_token');
    localStorage.removeItem('sidey_user');
  },
  
  // Get current user
  getCurrentUser() {
    return currentUser;
  },
  
  // Check if user is authenticated
  isAuthenticated() {
    return !!authToken && !!currentUser;
  },
  
  // Listen for auth state changes (for compatibility)
  onAuthStateChanged(callback) {
    // Initial call with current state
    callback(currentUser);
    
    // Listen for storage events (for multi-tab support)
    window.addEventListener('storage', (e) => {
      if (e.key === 'sidey_token' || e.key === 'sidey_user') {
        initAuth();
        callback(currentUser);
      }
    });
  },
  
  // Send password reset email
  async sendPasswordResetEmail(email) {
    return apiRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

// Database API wrapper (replaces Firestore)
const db = {
  // Get a document
  async get(collection, docId) {
    return apiRequest(`/api/data/${collection}/${docId}`);
  },
  
  // Get all documents in a collection
  async getAll(collection, options = {}) {
    const params = new URLSearchParams();
    
    // Handle siteId - can be in options directly or in options.where
    if (options.siteId) {
      params.set('siteId', options.siteId);
    } else if (options.where && options.where.siteId) {
      params.set('siteId', options.where.siteId);
    }
    
    if (options.orderBy) {
      params.set('orderBy', options.orderBy);
    }
    if (options.orderDir) {
      params.set('orderDir', options.orderDir);
    }
    if (options.limit) {
      params.set('limit', options.limit);
    }
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest(`/api/data/${collection}${query}`);
  },
  
  // Create a document
  async create(collection, data, docId = null) {
    const endpoint = docId 
      ? `/api/data/${collection}/${docId}` 
      : `/api/data/${collection}`;
    
    return apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Update a document
  async update(collection, docId, data) {
    return apiRequest(`/api/data/${collection}/${docId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  // Delete a document
  async delete(collection, docId) {
    return apiRequest(`/api/data/${collection}/${docId}`, {
      method: 'DELETE',
    });
  },
  
  // Query with filters
  async query(collection, filters = {}) {
    return this.getAll(collection, { where: filters });
  },
};

// Storage API wrapper (replaces Firebase Storage with R2)
const storage = {
  // Upload a file
  async upload(path, file, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);
    if (metadata.contentType) {
      formData.append('contentType', metadata.contentType);
    }
    
    const response = await fetch(`${CLOUDFLARE_CONFIG.apiBaseUrl}/api/storage/upload`, {
      method: 'POST',
      headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }
    
    return response.json();
  },
  
  // Get download URL for a file
  getDownloadURL(path) {
    return `${CLOUDFLARE_CONFIG.r2PublicUrl}/${path}`;
  },
  
  // Delete a file
  async delete(path) {
    return apiRequest('/api/storage/delete', {
      method: 'DELETE',
      body: JSON.stringify({ path }),
    });
  },
  
  // List files in a path
  async list(prefix) {
    return apiRequest(`/api/storage/list?prefix=${encodeURIComponent(prefix)}`);
  },
};

// Initialize auth on load
initAuth();

// Get siteName from URL parameter, worker injection, or default
const urlParams = new URLSearchParams(window.location.search);
const SITE_NAME = urlParams.get('siteName') || window.SITE_NAME_FROM_WORKER || 'demo';
window.SITE_NAME = SITE_NAME;

// Expose to window for global access
window.auth = auth;
window.db = db;
window.storage = storage;
window.CLOUDFLARE_CONFIG = CLOUDFLARE_CONFIG;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CLOUDFLARE_CONFIG, auth, db, storage, SITE_NAME };
}
