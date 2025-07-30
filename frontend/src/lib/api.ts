// src/lib/api.ts - Client API avec support vidéo
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60s pour les gros uploads
});

// Interceptor pour ajouter le token automatiquement
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types API
export interface User {
  id: number;
  email: string;
  plan: 'FREE' | 'PREMIUM' | 'PRO';
  creditsRemaining: number;
  creditsUsedToday: number;
  createdAt: string;
  lastReset?: string;
}

export interface Job {
  id: number;
  type: 'IMAGE' | 'VIDEO';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  settings: {
    scale: string;
    model: string;
    fps?: string;
    interpolation?: boolean;
  };
  processingTime?: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

// Helpers pour les comparaisons de status
export const JobStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const
};

export const JobType = {
  IMAGE: 'IMAGE' as const,
  VIDEO: 'VIDEO' as const
};

// API Functions
export const authAPI = {
  register: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  
  getProfile: () =>
    api.get<{ user: User; stats: any }>('/auth/profile'),
  
  upgrade: (plan: string) =>
    api.post<{ user: User }>('/auth/upgrade', { plan }),
};

export const uploadAPI = {
  // ✅ Upload d'images
  uploadImage: (file: File, settings: { scale: string; model: string }) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('scale', settings.scale);
    formData.append('model', settings.model);
    
    return api.post<{ 
      jobId: number; 
      status: string; 
      downloadUrl?: string;
      previewUrl?: string;
      inputSize?: string;
    }>('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // ✅ Upload de vidéos
  uploadVideo: (file: File, settings: { 
    scale: string; 
    model: string; 
    fps?: string; 
    interpolation?: boolean;
  }) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('scale', settings.scale);
    formData.append('model', settings.model);
    if (settings.fps) formData.append('fps', settings.fps);
    if (settings.interpolation !== undefined) {
      formData.append('interpolation', settings.interpolation.toString());
    }
    
    return api.post<{ 
      jobId: number; 
      status: string; 
      estimatedTime?: number;
      inputSize?: string;
    }>('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 minutes pour upload vidéo
    });
  },
  
  // Status des jobs (images et vidéos)
  getJobStatus: (jobId: number) =>
    api.get<Job>(`/images/job/${jobId}/status`),
    
  getVideoJobStatus: (jobId: number) =>
    api.get<Job>(`/videos/job/${jobId}/status`),
  
  // Téléchargement résultats
  downloadResult: (jobId: number) =>
    `${API_URL}/images/download/${jobId}`,
    
  downloadVideoResult: (jobId: number) =>
    `${API_URL}/videos/download/${jobId}`,
  
  // ✅ Prévisualisation
  getImagePreview: (jobId: number) =>
    api.get<{ previewUrl: string; settings: any; processingTime?: number }>(`/images/preview/${jobId}`),
    
  getVideoStream: (jobId: number) =>
    api.get<{ streamUrl: string; settings: any; processingTime?: number }>(`/videos/stream/${jobId}`),
    
  // ✅ Informations détaillées
  getVideoInfo: (jobId: number) =>
    api.get<{ 
      jobId: number; 
      status: string; 
      settings: any; 
      metadata: {
        size: string;
        contentType: string;
        created: string;
        updated: string;
      };
      processingTime?: number;
    }>(`/videos/info/${jobId}`),
};

// ✅ Helpers pour validation
export const validateImageFile = (file: File): { isValid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Format non supporté. Utilisez JPG, PNG, WebP, BMP ou TIFF.',
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Image trop volumineuse (max 50MB).',
    };
  }
  
  return { isValid: true };
};

export const validateVideoFile = (file: File): { isValid: boolean; error?: string } => {
  const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
  const maxSize = 500 * 1024 * 1024; // 500MB pour premium
  
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Format vidéo non supporté. Utilisez MP4, AVI, MOV, WMV, FLV ou WebM.',
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Vidéo trop volumineuse (max 500MB).',
    };
  }
  
  return { isValid: true };
};

// ✅ Helpers pour estimation temps
export const estimateProcessingTime = (
  fileSize: number, 
  scale: string, 
  type: 'image' | 'video' = 'image'
): number => {
  const sizeMB = fileSize / (1024 * 1024);
  const scaleMultiplier = Math.pow(parseInt(scale), 1.5);
  
  if (type === 'video') {
    // Vidéo: beaucoup plus long
    return Math.min(sizeMB * scaleMultiplier * 30, 3600); // Max 1h
  } else {
    // Image: rapide
    return Math.min(sizeMB * scaleMultiplier * 5, 300); // Max 5min
  }
};

// ✅ Helpers pour formats
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours}h ${minutes}m ${secs}s`;
};