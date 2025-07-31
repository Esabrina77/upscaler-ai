// src/components/features/ModernVideoUploader.tsx - CORRIGÉ avec bons modèles et routes
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Video, Play, Settings, Download, Eye, Trash2, 
  Zap, Clock, Gauge, Sparkles, Crown, Lock, AlertCircle 
} from 'lucide-react';
import { uploadAPI, validateVideoFile, formatFileSize, VideoModels, type UploadSettings } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface VideoUploaderProps {
  onUpload?: (file: File, settings: VideoUploadSettings) => void;
  userPlan?: 'FREE' | 'PREMIUM' | 'PRO';
}

interface VideoUploadSettings {
  scale: 2 | 4 | 8;
  fps: 'auto' | '24' | '30' | '60' | '120';
  model: keyof typeof VideoModels;
  interpolation: boolean;
}

interface VideoJobStatus {
  id: string;
  apiJobId?: number;
  status: 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  queuePosition?: number;
  estimatedTime?: number;
  inputFile?: string;
  outputFile?: string;
  settings?: VideoUploadSettings;
  processingTime?: number;
  errorMessage?: string;
  videoInfo?: {
    duration: number;
    resolution: string;
    currentFps: number;
  };
}

const ModernVideoUploader: React.FC<VideoUploaderProps> = ({ 
  onUpload, 
  userPlan = 'FREE' 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<VideoUploadSettings>({
    scale: 2,
    fps: '60',
    model: 'ffmpeg', // Modèle par défaut disponible pour tous
    interpolation: false
  });
  const [jobs, setJobs] = useState<VideoJobStatus[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vérifier les limites selon le plan
  const canUploadVideos = userPlan !== 'FREE';
  const maxScale = userPlan === 'PRO' ? 8 : userPlan === 'PREMIUM' ? 4 : 2;
  const canUse120fps = userPlan === 'PRO';
  const maxFileSize = userPlan === 'PRO' ? 500 : 100; // MB

  // Configuration dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.webm']
    },
    maxSize: maxFileSize * 1024 * 1024,
    disabled: !canUploadVideos || isProcessing,
    onDrop: useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (!canUploadVideos) {
        toast.error('Compte Premium requis pour les vidéos');
        return;
      }

      rejectedFiles.forEach((rejection) => {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          toast.error(`Fichier trop volumineux (max ${maxFileSize}MB)`);
        } else {
          toast.error('Format de fichier non supporté');
        }
      });

      if (acceptedFiles.length > 0) {
        const validFiles = acceptedFiles.filter(file => {
          const validation = validateVideoFile(file, userPlan);
          if (!validation.isValid) {
            toast.error(`${file.name}: ${validation.error}`);
            return false;
          }
          return true;
        });
        
        if (validFiles.length > 0) {
          setFiles(prev => [...prev, ...validFiles]);
          toast.success(`${validFiles.length} vidéo(s) ajoutée(s)`);
        }
      }
    }, [canUploadVideos, maxFileSize, userPlan])
  );

  // Options FPS avec restrictions
  const fpsOptions = [
    { value: 'auto' as const, label: 'Auto', description: 'Conserver FPS original' },
    { value: '24' as const, label: '24 FPS', description: 'Cinéma' },
    { value: '30' as const, label: '30 FPS', description: 'Vidéo standard' },
    { value: '60' as const, label: '60 FPS', description: 'Fluide - Gaming' },
    { value: '120' as const, label: '120 FPS', description: 'Ultra fluide', premium: true }
  ];

  // Traiter les vidéos
  const handleProcess = async () => {
    if (files.length === 0 || !canUploadVideos || isProcessing) return;

    setIsProcessing(true);
    
    try {
      for (const file of files) {
        await processVideo(file);
      }
      setFiles([]);
    } catch (error) {
      console.error('Erreur traitement batch:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Traiter une vidéo
  const processVideo = async (file: File) => {
    const validation = validateVideoFile(file, userPlan);
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
    }

    const jobId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newJob: VideoJobStatus = {
      id: jobId,
      status: 'uploading',
      progress: 5,
      settings
    };
    
    setJobs(prev => [newJob, ...prev]);

    try {
      // Upload vers l'API avec les bons paramètres selon le backend
      const uploadSettings: UploadSettings = {
        scale: settings.scale.toString(),
        model: settings.model,
        fps: settings.fps,
        interpolation: settings.interpolation
      };

      const response = await uploadAPI.uploadVideo(file, uploadSettings);
      
      // Mettre à jour le job avec la réponse API
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              apiJobId: response.data.jobId,
              status: 'queued', 
              progress: 20,
              queuePosition: response.data.queuePosition,
              estimatedTime: response.data.estimatedTime,
              videoInfo: response.data.videoInfo
            } 
          : job
      ));

      // Démarrer le polling
      if (response.data.jobId) {
        pollVideoJobStatus(response.data.jobId, jobId);
      }

      toast.success('Vidéo ajoutée à la file de traitement !');
      onUpload?.(file, settings);
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de l\'upload';
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'failed', errorMessage, progress: 0 }
          : job
      ));
      
      toast.error(errorMessage);
    }
  };

  // Polling statut vidéo
  const pollVideoJobStatus = async (apiJobId: number, localJobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await uploadAPI.getVideoJobStatus(apiJobId);
        const status = response.data;

        setJobs(prev => prev.map(job => 
          job.id === localJobId 
            ? {
                ...job,
                status: status.status === 'COMPLETED' ? 'completed' : 
                       status.status === 'FAILED' ? 'failed' : 
                       status.status === 'PROCESSING' ? 'processing' : 'queued',
                progress: status.progress || job.progress,
                processingTime: status.processingTime,
                outputFile: status.status === 'COMPLETED' ? 
                  uploadAPI.downloadVideoResult(apiJobId) : undefined,
                errorMessage: status.errorMessage,
                queuePosition: status.status === 'PENDING' ? job.queuePosition : undefined
              }
            : job
        ));

        // Arrêter le polling si terminé
        if (status.status === 'COMPLETED') {
          clearInterval(pollInterval);
          toast.success('Vidéo traitée avec succès !');
        } else if (status.status === 'FAILED') {
          clearInterval(pollInterval);
          toast.error(`Échec du traitement: ${status.errorMessage}`);
        }
        
      } catch (error) {
        console.error('Erreur polling vidéo:', error);
        // Ne pas arrêter le polling pour une erreur temporaire
      }
    }, 5000); // 5 secondes pour vidéos

    // Timeout après 30 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 1800000);
  };

  // Calculer temps estimé
  const getEstimatedTime = (settings: VideoUploadSettings, fileSizeMB: number) => {
    const baseFactor = settings.model === 'rife' ? 12 : 
                      settings.model === 'basicvsr' ? 15 : 
                      settings.model === 'real-cugan' ? 8 : 5;
    const scaleFactor = Math.pow(settings.scale, 1.5);
    const fpsFactor = settings.fps === '120' ? 2 : settings.fps === '60' ? 1.5 : 1;
    
    return Math.ceil(fileSizeMB * baseFactor * scaleFactor * fpsFactor / 10); // en minutes
  };

  // Supprimer fichier
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Supprimer job
  const removeJob = (jobId: string) => {
    setJobs(prev => prev.filter(job => job.id !== jobId));
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          🎬 AI Video Upscaler
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Améliorez vos vidéos en 4K/8K avec interpolation FPS
        </p>
        
        {!canUploadVideos && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 justify-center">
              <Crown className="w-5 h-5" />
              <span className="font-medium">Fonctionnalité Premium</span>
            </div>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              L'upscaling vidéo nécessite un compte Premium ou Pro
            </p>
          </div>
        )}
      </div>

      {/* Zone de drop */}
      <div className="relative">
        <motion.div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-300
            ${!canUploadVideos ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' :
              isDragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 
              files.length > 0 ? 'border-green-400 bg-green-50 dark:bg-green-900/20' :
              'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'
            }
          `}
          whileHover={canUploadVideos && !isProcessing ? { scale: 1.01 } : {}}
          whileTap={canUploadVideos && !isProcessing ? { scale: 0.99 } : {}}
        >
          <input {...getInputProps()} ref={fileInputRef} />
          
          {!canUploadVideos && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 rounded-xl z-10">
              <div className="text-center">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="font-semibold text-gray-600 dark:text-gray-400">Premium Requis</p>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <motion.div
              animate={{ rotate: isDragActive ? 180 : 0 }}
              transition={{ duration: 0.3 }}
              className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center"
            >
              <Video className="w-8 h-8 text-white" />
            </motion.div>
            
            <div>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                {isDragActive ? '🎥 Déposez vos vidéos ici' : 
                 isProcessing ? '⚙️ Traitement en cours...' :
                 '🎯 Cliquez ou glissez vos vidéos'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                MP4, AVI, MOV, WebM jusqu'à {maxFileSize}MB ({userPlan})
              </p>
            </div>

            {/* Liste des fichiers */}
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap gap-2 justify-center"
              >
                {files.map((file, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm border flex items-center gap-3">
                    <Video className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="text-sm font-medium truncate max-w-32">{file.name}</div>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(file.size)} • 
                        ~{getEstimatedTime(settings, file.size / (1024 * 1024))} min
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="text-red-500 hover:text-red-600 flex-shrink-0"
                      disabled={isProcessing}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Paramètres vidéo */}
      {canUploadVideos && (
        <motion.div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-blue-500" />
              <span className="font-semibold">Paramètres vidéo avancés</span>
            </div>
            <motion.div
              animate={{ rotate: showSettings ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-500"
            >
              ⌄
            </motion.div>
          </button>

          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 pb-4 space-y-6"
              >
                {/* Échelle */}
                <div>
                  <label className="block text-sm font-medium mb-3">Facteur d'agrandissement</label>
                  <div className="grid grid-cols-3 gap-3">
                    {([2, 4, 8] as const).map((scale) => (
                      <button
                        key={scale}
                        onClick={() => setSettings(prev => ({ ...prev, scale }))}
                        disabled={scale > maxScale}
                        className={`
                          p-4 rounded-lg border-2 transition-all font-medium relative
                          ${scale > maxScale ? 'opacity-50 cursor-not-allowed' :
                            settings.scale === scale
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                              : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="text-xl">{scale}x</div>
                        <div className="text-xs text-gray-500">
                          {scale === 2 ? 'HD → 4K' : scale === 4 ? '4K → 8K' : '8K → 16K'}
                        </div>
                        {scale > maxScale && (
                          <div className="absolute top-1 right-1">
                            <Crown className="w-4 h-4 text-amber-500" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS */}
                <div>
                  <label className="block text-sm font-medium mb-3">Images par seconde (FPS)</label>
                  <div className="grid grid-cols-2 gap-3">
                    {fpsOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSettings(prev => ({ ...prev, fps: option.value }))}
                        disabled={option.premium && !canUse120fps}
                        className={`
                          p-3 rounded-lg border-2 transition-all text-left relative
                          ${option.premium && !canUse120fps ? 'opacity-50 cursor-not-allowed' :
                            settings.fps === option.value
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{option.label}</span>
                          {option.premium && (
                            <Crown className="w-3 h-3 text-amber-500" />
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modèle - CORRIGÉ avec vrais modèles backend */}
                <div>
                  <label className="block text-sm font-medium mb-3">Modèle d'IA</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(VideoModels) as Array<[keyof typeof VideoModels, typeof VideoModels[keyof typeof VideoModels]]>).map(([key, model]) => (
                      <button
                        key={key}
                        onClick={() => setSettings(prev => ({ ...prev, model: key }))}
                        disabled={model.premium && userPlan === 'FREE'}
                        className={`
                          p-4 rounded-lg border-2 transition-all text-left relative
                          ${model.premium && userPlan === 'FREE' ? 'opacity-50 cursor-not-allowed' :
                            settings.model === key
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span>{model.badge}</span>
                          <span className="font-medium">{model.name}</span>
                          {model.premium && (
                            <Crown className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {model.speed}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {model.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Interpolation */}
                <div>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={settings.interpolation}
                      onChange={(e) => setSettings(prev => ({ ...prev, interpolation: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <div>
                      <span className="font-medium">Interpolation FPS avancée</span>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Génère des frames intermédiaires pour un mouvement ultra-fluide
                      </p>
                    </div>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Bouton traitement */}
      {canUploadVideos && (
        <motion.button
          onClick={handleProcess}
          disabled={files.length === 0 || isProcessing}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          whileHover={files.length > 0 && !isProcessing ? { scale: 1.02 } : {}}
          whileTap={files.length > 0 && !isProcessing ? { scale: 0.98 } : {}}
        >
          {isProcessing ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
              />
              Traitement en cours...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Améliorer Vidéo {files.length > 0 && `(${files.length} vidéo${files.length > 1 ? 's' : ''})`}
              <Zap className="w-5 h-5" />
            </>
          )}
        </motion.button>
      )}

      {/* Liste des jobs vidéo */}
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Video className="w-5 h-5" />
              Traitement vidéo ({jobs.length})
            </h3>
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg border p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      job.status === 'completed' ? 'bg-green-500' :
                      job.status === 'failed' ? 'bg-red-500' :
                      job.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                      'bg-yellow-500 animate-pulse'
                    }`} />
                    <span className="font-medium">
                      {job.status === 'uploading' ? '📤 Upload...' :
                       job.status === 'queued' ? '⏳ En file d\'attente' :
                       job.status === 'processing' ? '⚙️ Traitement...' :
                       job.status === 'completed' ? '✅ Terminé' :
                       '❌ Échec'}
                    </span>
                    {job.settings && (
                      <div className="flex gap-1">
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          {job.settings.model}
                        </span>
                        <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded">
                          {job.settings.scale}x • {job.settings.fps}fps
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {job.status === 'completed' && job.outputFile && (
                      <>
                        <button 
                          onClick={() => window.open(job.outputFile, '_blank')}
                          className="text-blue-500 hover:text-blue-600 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg transition-colors"
                          title="Prévisualiser"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <a 
                          href={job.outputFile}
                          download
                          className="text-green-500 hover:text-green-600 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    )}
                    
                    {(job.status === 'completed' || job.status === 'failed') && (
                      <button
                        onClick={() => removeJob(job.id)}
                        className="text-gray-500 hover:text-red-500 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Infos vidéo */}
                {job.videoInfo && (
                  <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>📐 {job.videoInfo.resolution}</span>
                    <span>⏱️ {job.videoInfo.duration}s</span>
                    <span>🎞️ {job.videoInfo.currentFps}fps</span>
                  </div>
                )}

                {/* File d'attente */}
                {job.status === 'queued' && job.queuePosition && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                      <Clock className="w-4 h-4" />
                      <span className="font-medium">
                        Position {job.queuePosition} dans la file
                      </span>
                    </div>
                    {job.estimatedTime && (
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                        Temps estimé: ~{job.estimatedTime} minutes
                      </p>
                    )}
                  </div>
                )}

                {/* Message d'erreur */}
                {job.status === 'failed' && job.errorMessage && (
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">Erreur de traitement</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      {job.errorMessage}
                    </p>
                  </div>
                )}

                {/* Barre de progression */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full flex items-center justify-end pr-2"
                    initial={{ width: 0 }}
                    animate={{ width: `${job.progress}%` }}
                    transition={{ duration: 0.5 }}
                  >
                    {job.progress > 15 && (
                      <span className="text-xs text-white font-medium">
                        {job.progress}%
                      </span>
                    )}
                  </motion.div>
                </div>

                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Progression: {job.progress}%</span>
                  {job.processingTime && job.status === 'completed' && (
                    <span>⚡ Traité en {Math.floor(job.processingTime / 60)}min {job.processingTime % 60}s</span>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModernVideoUploader;