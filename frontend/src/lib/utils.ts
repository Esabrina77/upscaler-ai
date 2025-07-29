
// ================================
// src/lib/utils.ts - Fonctions utilitaires
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours}h ${minutes}m ${secs}s`;
}

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
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
      error: 'Fichier trop volumineux (max 50MB).',
    };
  }
  
  return { isValid: true };
}

export function validateVideoFile(file: File): { isValid: boolean; error?: string } {
  const validTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
  const maxSize = 100 * 1024 * 1024; // 100MB
  
  if (!validTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Format vidéo non supporté. Utilisez MP4, AVI, MOV, WMV, FLV ou WebM.',
    };
  }
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'Vidéo trop volumineuse (max 100MB).',
    };
  }
  
  return { isValid: true };
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
