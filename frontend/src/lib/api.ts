// src/lib/api.ts - Client API
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
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
  plan: 'free' | 'premium' | 'pro';
  creditsRemaining: number;
  creditsUsedToday: number;
}

export interface Job {
  id: number;
  type: 'image' | 'video';
  status: 'pending' | 'processing' | 'completed' | 'failed';
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
  uploadImage: (file: File, settings: { scale: string; model: string }) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('scale', settings.scale);
    formData.append('model', settings.model);
    
    return api.post<{ jobId: number; status: string; downloadUrl?: string }>('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  uploadVideo: (file: File, settings: { scale: string; model: string; fps?: string }) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('scale', settings.scale);
    formData.append('model', settings.model);
    if (settings.fps) formData.append('fps', settings.fps);
    
    return api.post<{ jobId: number; status: string }>('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  getJobStatus: (jobId: number) =>
    api.get<Job>(`/images/job/${jobId}/status`),
  
  downloadResult: (jobId: number) =>
    `/images/download/${jobId}`,
};
