// src/lib/utils.ts - Fonctions utilitaires corrigées
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

export function validateVideoFile(file: File, userPlan: 'FREE' | 'PREMIUM' | 'PRO' = 'FREE'): { isValid: boolean; error?: string } {
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

// Helper pour estimer temps de traitement
export function estimateProcessingTime(
  fileSize: number, 
  scale: string, 
  type: 'image' | 'video' = 'image',
  model?: string
): number {
  const sizeMB = fileSize / (1024 * 1024);
  const scaleMultiplier = Math.pow(parseInt(scale), 1.5);
  
  if (type === 'video') {
    const modelFactors: Record<string, number> = {
      'rife': 12,
      'basicvsr': 15,
      'real-cugan': 8,
      'ffmpeg': 5
    };
    const factor = modelFactors[model || 'ffmpeg'] || 8;
    return Math.min(sizeMB * scaleMultiplier * factor, 3600); // Max 1h
  } else {
    const factor = model === 'real-esrgan' ? 10 : 5;
    return Math.min(sizeMB * scaleMultiplier * factor, 300); // Max 5min
  }
}

// Helper pour formater les pourcentages
export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return Math.round((value / total) * 100) + '%';
}

// Helper pour formater les dates relatives
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInMs = now.getTime() - targetDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return 'À l\'instant';
  if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
  if (diffInHours < 24) return `Il y a ${diffInHours}h`;
  if (diffInDays < 7) return `Il y a ${diffInDays} jour${diffInDays > 1 ? 's' : ''}`;
  
  return targetDate.toLocaleDateString('fr-FR');
}

// Helper pour générer des couleurs de status
export function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-300',
        dot: 'bg-green-500'
      };
    case 'FAILED':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-300',
        dot: 'bg-red-500'
      };
    case 'PROCESSING':
      return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500'
      };
    case 'PENDING':
      return {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        text: 'text-yellow-700 dark:text-yellow-300',
        dot: 'bg-yellow-500'
      };
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-900/20',
        text: 'text-gray-700 dark:text-gray-300',
        dot: 'bg-gray-500'
      };
  }
}

// Helper pour valider les paramètres d'upscaling
export function validateUpscaleSettings(
  settings: { scale: string; model: string; fps?: string },
  userPlan: 'FREE' | 'PREMIUM' | 'PRO',
  type: 'image' | 'video'
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validation du scale
  const validScales = ['2', '4', '8'];
  if (!validScales.includes(settings.scale)) {
    errors.push('Facteur d\'agrandissement invalide (2, 4 ou 8)');
  }
  
  // Limitations par plan
  const maxScale = userPlan === 'PRO' ? 8 : userPlan === 'PREMIUM' ? 4 : 2;
  if (parseInt(settings.scale) > maxScale) {
    errors.push(`Scale ${settings.scale}x nécessite un plan supérieur (max ${maxScale}x pour ${userPlan})`);
  }
  
  // Validation FPS pour vidéos
  if (type === 'video' && settings.fps) {
    const validFps = ['auto', '24', '30', '60', '120'];
    if (!validFps.includes(settings.fps)) {
      errors.push('FPS invalide (auto, 24, 30, 60, 120)');
    }
    
    if (settings.fps === '120' && userPlan !== 'PRO') {
      errors.push('120 FPS nécessite un plan Pro');
    }
  }
  
  // Validation vidéos pour plan FREE
  if (type === 'video' && userPlan === 'FREE') {
    errors.push('Upscaling vidéo nécessite un compte Premium ou Pro');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Types utilitaires
export type FileValidation = {
  isValid: boolean;
  error?: string;
};

export type UpscaleValidation = {
  isValid: boolean;
  errors: string[];
};