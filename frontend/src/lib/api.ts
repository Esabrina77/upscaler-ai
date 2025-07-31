// src/lib/api.ts - Client API corrigé selon le backend
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 120000, // 2 minutes pour les gros uploads
});

// Interceptor pour ajouter le token automatiquement
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Types API corrigés selon le backend
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
    originalInfo?: {
      duration?: number;
      resolution?: string;
      fps?: number;
      codec?: string;
    };
  };
  processingTime?: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  available?: boolean;
  expiredMessage?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  message: string;
}

export interface VideoUploadResponse {
  jobId: number;
  status: string;
  message: string;
  estimatedTime?: number;
  inputSize?: string;
  videoInfo?: {
    duration: number;
    resolution: string;
    currentFps: number;
  };
  queuePosition?: number;
}

export interface ImageUploadResponse {
  jobId: number;
  status: string;
  downloadUrl?: string;
  previewUrl?: string;
  processingTime?: number;
  inputSize?: string;
}

// Constants pour comparaisons type-safe
export const JobStatus = {
  PENDING: 'PENDING' as const,
  PROCESSING: 'PROCESSING' as const,
  COMPLETED: 'COMPLETED' as const,
  FAILED: 'FAILED' as const
} as const;

export const JobType = {
  IMAGE: 'IMAGE' as const,
  VIDEO: 'VIDEO' as const
} as const;

export const UserPlan = {
  FREE: 'FREE' as const,
  PREMIUM: 'PREMIUM' as const,
  PRO: 'PRO' as const
} as const;

// ✅ Modèles disponibles selon le backend
export const ImageModels = {
  'waifu2x': {
    name: 'Waifu2x (Sharp)',
    description: 'Optimisé dessins et anime - Rapide',
    speed: 'Très rapide',
    quality: 'Bon',
    badge: '🎨',
    premium: false
  },
  'real-esrgan': {
    name: 'Real-ESRGAN',
    description: 'IA avancée, excellent pour photos',
    speed: 'Moyen',
    quality: 'Excellent',
    badge: '📸',
    premium: false
  },
  'esrgan': {
    name: 'ESRGAN (Sharp)',
    description: 'Polyvalent, bon compromis',
    speed: 'Rapide',
    quality: 'Bon',
    badge: '⚡',
    premium: false
  },
  'srcnn': {
    name: 'SRCNN (Sharp)',
    description: 'Léger et efficace',
    speed: 'Très rapide',
    quality: 'Correct',
    badge: '🚀',
    premium: false
  }
} as const;

export const VideoModels = {
  'real-cugan': {
    name: 'Real-CUGAN',
    description: 'Upscaling vidéo temps réel de haute qualité',
    speed: 'Moyen',
    quality: 'Excellent',
    badge: '🎬',
    premium: false
  },
  'rife': {
    name: 'RIFE',
    description: 'Interpolation FPS fluide + upscaling',
    speed: 'Lent',
    quality: 'Exceptionnel',
    badge: '🌊',
    premium: true
  },
  'basicvsr': {
    name: 'BasicVSR++',
    description: 'Super-resolution vidéo avancée',
    speed: 'Très lent',
    quality: 'Maximum',
    badge: '🔬',
    premium: true
  },
  'ffmpeg': {
    name: 'FFmpeg Enhanced',
    description: 'Filtres avancés, compatible tout format',
    speed: 'Rapide',
    quality: 'Bon',
    badge: '⚡',
    premium: false
  }
} as const;

// ✅ API Functions avec bonnes routes
export const authAPI = {
  register: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  
  getProfile: () =>
    api.get<{ 
      user: User; 
      stats: {
        totalJobs: number;
        completedJobs: number;
        imagesProcessed: number;
        videosProcessed: number;
      };
    }>('/auth/profile'),
  
  upgrade: (plan: 'PREMIUM' | 'PRO') =>
    api.post<{ user: User; message: string }>('/auth/upgrade', { plan }),
};

export const uploadAPI = {
  // ✅ Upload d'images - ROUTE CORRIGÉE
  uploadImage: (file: File, settings: { scale: string; model: string }) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('scale', settings.scale);
    formData.append('model', settings.model);
    
    return api.post<ImageUploadResponse>('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  // ✅ Upload de vidéos - ROUTE CORRIGÉE
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
    
    return api.post<VideoUploadResponse>('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000, // 3 minutes pour upload vidéo
    });
  },
  
  // ✅ Status des jobs - ROUTES CORRIGÉES
  getJobStatus: (jobId: number) =>
    api.get<Job>(`/images/job/${jobId}/status`),
    
  getVideoJobStatus: (jobId: number) =>
    api.get<Job>(`/videos/job/${jobId}/status`),
  
  // ✅ Téléchargements - URLs CORRIGÉES
  downloadResult: (jobId: number) =>
    `${API_URL}/images/download/${jobId}`,
    
  downloadVideoResult: (jobId: number) =>
    `${API_URL}/videos/download/${jobId}`,
  
  // ✅ Prévisualisations - ROUTES CORRIGÉES
  getImagePreview: (jobId: number) =>
    api.get<{ 
      previewUrl: string; 
      settings: any; 
      processingTime?: number;
      fileInfo: {
        size: string;
        contentType: string;
        created: string;
      };
    }>(`/images/preview/${jobId}`),
    
  getVideoStream: (jobId: number) =>
    api.get<{ 
      streamUrl: string; 
      settings: any; 
      processingTime?: number;
      fileInfo: {
        size: string;
        contentType: string;
        duration: string;
      };
    }>(`/videos/stream/${jobId}`),
    
  // ✅ Informations détaillées
  getVideoInfo: (jobId: number) =>
    api.get<{ 
      jobId: number; 
      status: string; 
      settings: any; 
      available: boolean;
      fileInfo: {
        size: string;
        contentType: string;
        created: string;
        updated: string;
      };
      comparison?: {
        original: {
          resolution: string;
          fps: number;
          duration: string;
        };
        processed: {
          resolution: string;
          fps: string;
          model: string;
        };
      };
      processingTime?: number;
    }>(`/videos/info/${jobId}`),

  // ✅ Analyse fichiers - ROUTES CORRIGÉES
  analyzeImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    
    return api.post<{
      analysis: {
        width: number;
        height: number;
        format: string;
        size: number;
        hasAlpha: boolean;
      };
      recommendations: Array<{
        type: 'INFO' | 'WARNING';
        message: string;
        suggestion: string;
      }>;
      supportedScales: number[];
      estimatedTimes: Record<string, number>;
    }>('/images/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  analyzeVideo: (file: File) => {
    const formData = new FormData();
    formData.append('video', file);
    
    return api.post<{
      analysis: {
        duration: number;
        size: string;
        bitrate: string;
        video: {
          resolution: string;
          fps: number;
          codec: string;
        };
        audio?: {
          codec: string;
          sampleRate: string;
          channels: number;
        };
      };
      recommendations: Array<{
        type: 'INFO' | 'WARNING';
        message: string;
        suggestion: string;
      }>;
      supportedScales: number[];
      estimatedTimes: Record<string, string>;
      processingTips: string[];
    }>('/videos/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ✅ API de test et santé
export const testAPI = {
  healthCheck: () =>
    api.get<{
      status: string;
      timestamp: string;
      tools: any;
      summary: {
        realEsrgan: string;
        rife: string;
        ffmpeg: string;
        firebase: string;
      };
    }>('/test/health'),

  getModels: () =>
    api.get<{
      success: boolean;
      models: {
        image: Record<string, any>;
        video: Record<string, any>;
      };
      tools: {
        realEsrgan: Record<string, any>;
        supported: {
          imageFormats: string[];
          videoFormats: string[];
          scales: number[];
          fps: number[];
        };
      };
    }>('/test/models'),

  getStorageStats: () =>
    api.get<{
      firebase: {
        used: string;
        total: string;
        percentUsed: number;
        files: number;
      };
      recommendations: Array<{
        priority: string;
        action: string;
        command: string | null;
      }>;
      status: 'OK' | 'WARNING' | 'CRITICAL';
    }>('/images/storage-stats'),
};

// ✅ Helpers de validation
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

export const validateVideoFile = (file: File, userPlan: 'FREE' | 'PREMIUM' | 'PRO' = 'FREE'): { isValid: boolean; error?: string } => {
  const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
  const maxSizes = {
    FREE: 0, // Pas de vidéos en FREE
    PREMIUM: 100 * 1024 * 1024, // 100MB
    PRO: 500 * 1024 * 1024, // 500MB
  };
  
  if (userPlan === 'FREE') {
    return {
      isValid: false,
      error: 'Compte Premium requis pour l\'upload de vidéos.',
    };
  }
  
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Format vidéo non supporté. Utilisez MP4, AVI, MOV, WMV, FLV ou WebM.',
    };
  }
  
  if (file.size > maxSizes[userPlan]) {
    const maxMB = maxSizes[userPlan] / (1024 * 1024);
    return {
      isValid: false,
      error: `Vidéo trop volumineuse (max ${maxMB}MB pour ${userPlan}).`,
    };
  }
  
  return { isValid: true };
};

// ✅ Types pour les hooks
export type UploadSettings = {
  scale: string;
  model: string;
  fps?: string;
  interpolation?: boolean;
};

// ✅ Helpers pour estimation et formatage
export const estimateProcessingTime = (
  fileSize: number, 
  scale: string, 
  type: 'image' | 'video' = 'image',
  model?: string
): number => {
  const sizeMB = fileSize / (1024 * 1024);
  const scaleMultiplier = Math.pow(parseInt(scale), 1.5);
  
  if (type === 'video') {
    const modelFactors = {
      'rife': 12,
      'basicvsr': 15,
      'real-cugan': 8,
      'ffmpeg': 5
    };
    const factor = modelFactors[model as keyof typeof modelFactors] || 8;
    return Math.min(sizeMB * scaleMultiplier * factor, 3600); // Max 1h
  } else {
    const factor = model === 'real-esrgan' ? 10 : 5;
    return Math.min(sizeMB * scaleMultiplier * factor, 300); // Max 5min
  }
};

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