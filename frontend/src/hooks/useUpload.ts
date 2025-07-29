
// ================================
// src/hooks/useUpload.ts - Hook pour l'upload
import { useState, useCallback } from 'react';
import { uploadAPI } from '@/lib/api';
import { validateImageFile, validateVideoFile } from '@/lib/utils';
import { toast } from 'react-hot-toast';

interface UploadSettings {
  scale: string;
  model: string;
  fps?: string;
  interpolation?: boolean;
}

export function useUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadImage = useCallback(async (
    file: File,
    settings: UploadSettings,
    onJobCreated?: (jobId: number) => void
  ) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const response = await uploadAPI.uploadImage(file, settings);
      toast.success('Image ajoutée à la file de traitement !');
      onJobCreated?.(response.data.jobId);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de l\'upload';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  const uploadVideo = useCallback(async (
    file: File,
    settings: UploadSettings,
    onJobCreated?: (jobId: number) => void
  ) => {
    const validation = validateVideoFile(file);
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const response = await uploadAPI.uploadVideo(file, settings);
      toast.success('Vidéo ajoutée à la file de traitement !');
      onJobCreated?.(response.data.jobId);
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de l\'upload';
      toast.error(errorMessage);
      throw error;
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  return {
    isUploading,
    progress,
    uploadImage,
    uploadVideo,
  };
}
