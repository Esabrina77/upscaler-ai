// src/hooks/useUpload.ts - Hook corrigé pour l'upload
import { useState, useCallback } from 'react';
import { uploadAPI, validateImageFile, validateVideoFile, type UploadSettings } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface UseUploadReturn {
  isUploading: boolean;
  progress: number;
  uploadImage: (
    file: File,
    settings: UploadSettings,
    onJobCreated?: (jobId: number) => void
  ) => Promise<any>;
  uploadVideo: (
    file: File,
    settings: UploadSettings,
    onJobCreated?: (jobId: number) => void,
    userPlan?: 'FREE' | 'PREMIUM' | 'PRO'
  ) => Promise<any>;
}

export function useUpload(): UseUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = useCallback(async (
    file: File,
    settings: UploadSettings,
    onJobCreated?: (jobId: number) => void
  ) => {
    // Validation du fichier
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error!);
      throw new Error(validation.error);
    }

    setIsUploading(true);
    setProgress(10);

    try {
      // Simulation de progression
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await uploadAPI.uploadImage(file, {
        scale: settings.scale,
        model: settings.model
      });

      clearInterval(progressInterval);
      setProgress(100);

      toast.success('Image ajoutée à la file de traitement !');
      onJobCreated?.(response.data.jobId);
      
      return response.data;

    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de l\'upload';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  const uploadVideo = useCallback(async (
    file: File,
    settings: UploadSettings,
    onJobCreated?: (jobId: number) => void,
    userPlan: 'FREE' | 'PREMIUM' | 'PRO' = 'FREE'
  ) => {
    // Validation du fichier
    const validation = validateVideoFile(file, userPlan);
    if (!validation.isValid) {
      toast.error(validation.error!);
      throw new Error(validation.error);
    }

    setIsUploading(true);
    setProgress(5);

    try {
      // Simulation de progression pour vidéos (plus lent)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 80));
      }, 500);

      const response = await uploadAPI.uploadVideo(file, {
        scale: settings.scale,
        model: settings.model,
        fps: settings.fps,
        interpolation: settings.interpolation
      });

      clearInterval(progressInterval);
      setProgress(100);

      toast.success('Vidéo ajoutée à la file de traitement !');
      onJobCreated?.(response.data.jobId);
      
      return response.data;

    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de l\'upload';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  return {
    isUploading,
    progress,
    uploadImage,
    uploadVideo,
  };
}