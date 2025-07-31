// src/components/features/ModernImageUploader.tsx - CORRIGÉ avec bons modèles et routes
'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Image as ImageIcon, Sparkles, Settings, Download, Eye, Trash2, Zap } from 'lucide-react';
import { uploadAPI, validateImageFile, ImageModels, type UploadSettings } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface ImageUploaderProps {
  onUpload?: (file: File, settings: ImageUploadSettings) => void;
  userPlan?: 'FREE' | 'PREMIUM' | 'PRO';
}

interface ImageUploadSettings {
  scale: 2 | 4 | 8;
  model: keyof typeof ImageModels;
  outputFormat: 'png' | 'jpg';
}

interface JobStatus {
  id: string;
  apiJobId?: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  inputFile?: string;
  outputFile?: string;
  settings?: ImageUploadSettings;
  processingTime?: number;
  errorMessage?: string;
}

const ModernImageUploader: React.FC<ImageUploaderProps> = ({ 
  onUpload, 
  userPlan = 'FREE' 
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [settings, setSettings] = useState<ImageUploadSettings>({
    scale: 2,
    model: 'waifu2x', // Modèle par défaut disponible
    outputFormat: 'png'
  });
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isProcessing,
    onDrop: useCallback((acceptedFiles: File[]) => {
      const validFiles = acceptedFiles.filter(file => {
        const validation = validateImageFile(file);
        if (!validation.isValid) {
          toast.error(`${file.name}: ${validation.error}`);
          return false;
        }
        return true;
      });
      
      if (validFiles.length > 0) {
        setFiles(prev => [...prev, ...validFiles]);
        toast.success(`${validFiles.length} image(s) ajoutée(s)`);
      }
    }, [])
  });

  // Traiter les fichiers
  const handleProcess = async () => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    
    try {
      for (const file of files) {
        await processImage(file);
      }
      setFiles([]);
    } catch (error) {
      console.error('Erreur traitement batch:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Traiter une image
  const processImage = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error!);
      return;
    }

    const jobId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newJob: JobStatus = {
      id: jobId,
      status: 'uploading',
      progress: 5,
      settings
    };
    
    setJobs(prev => [newJob, ...prev]);

    try {
      // Upload vers l'API avec les bons paramètres
      const uploadSettings: UploadSettings = {
        scale: settings.scale.toString(),
        model: settings.model
      };

      const response = await uploadAPI.uploadImage(file, uploadSettings);
      
      // Mettre à jour le job avec la réponse API
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { 
              ...job, 
              apiJobId: response.data.jobId,
              status: response.data.status === 'COMPLETED' ? 'completed' : 'processing',
              progress: response.data.status === 'COMPLETED' ? 100 : 30,
              outputFile: response.data.downloadUrl,
              processingTime: response.data.processingTime
            } 
          : job
      ));

      // Si pas terminé immédiatement, démarrer le polling
      if (response.data.status !== 'COMPLETED' && response.data.jobId) {
        pollImageJobStatus(response.data.jobId, jobId);
      } else if (response.data.status === 'COMPLETED') {
        toast.success('Image traitée avec succès !');
      }

      onUpload?.(file, settings);
      
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Erreur lors de l\'upload';
      
      setJobs(prev => prev.map(job => 
        job.id === jobId 
          ? { ...job, status: 'failed', errorMessage, progress: 0 }
          : job
      ));
      
      toast.error(errorMessage);
    }
  };

  // Polling statut image
  const pollImageJobStatus = async (apiJobId: number, localJobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await uploadAPI.getJobStatus(apiJobId);
        const status = response.data;

        setJobs(prev => prev.map(job => 
          job.id === localJobId 
            ? {
                ...job,
                status: status.status === 'COMPLETED' ? 'completed' : 
                       status.status === 'FAILED' ? 'failed' : 'processing',
                progress: status.progress || job.progress,
                processingTime: status.processingTime,
                outputFile: status.status === 'COMPLETED' ? 
                  uploadAPI.downloadResult(apiJobId) : undefined,
                errorMessage: status.errorMessage
              }
            : job
        ));

        // Arrêter le polling si terminé
        if (status.status === 'COMPLETED') {
          clearInterval(pollInterval);
          toast.success('Image traitée avec succès !');
        } else if (status.status === 'FAILED') {
          clearInterval(pollInterval);
          toast.error(`Échec du traitement: ${status.errorMessage}`);
        }
        
      } catch (error) {
        console.error('Erreur polling image:', error);
      }
    }, 2000); // 2 secondes pour images

    // Timeout après 10 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
    }, 600000);
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
        <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          ✨ AI Image Upscaler
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Transformez vos images en haute résolution avec l'intelligence artificielle
        </p>
      </div>

      {/* Zone de drop */}
      <motion.div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-300 hover:border-purple-400 hover:bg-purple-50/50
          dark:hover:bg-purple-900/20 dark:border-gray-600
          ${isDragActive ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-300'}
          ${files.length > 0 ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : ''}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        whileHover={!isProcessing ? { scale: 1.02 } : {}}
        whileTap={!isProcessing ? { scale: 0.98 } : {}}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        
        <div className="space-y-4">
          <motion.div
            animate={{ rotate: isDragActive ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center"
          >
            <Upload className="w-8 h-8 text-white" />
          </motion.div>
          
          <div>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {isDragActive ? '📁 Déposez vos images ici' : 
               isProcessing ? '⚙️ Traitement en cours...' :
               '🎯 Cliquez ou glissez vos images'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              PNG, JPG, WebP, BMP, TIFF jusqu'à 50MB
            </p>
          </div>

          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 justify-center"
            >
              {files.map((file, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm border flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-purple-500" />
                  <span className="text-sm truncate max-w-32">{file.name}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="text-red-500 hover:text-red-600"
                    disabled={isProcessing}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Paramètres */}
      <motion.div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
        >
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-purple-500" />
            <span className="font-semibold">Paramètres d'amélioration</span>
          </div>
          <motion.div
            animate={{ rotate: showSettings ? 180 : 0 }}
            transition={{ duration: 0.2 }}
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
              className="px-4 pb-4 space-y-4"
            >
              {/* Échelle */}
              <div>
                <label className="block text-sm font-medium mb-2">Facteur d'agrandissement</label>
                <div className="grid grid-cols-3 gap-2">
                  {([2, 4, 8] as const).map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setSettings(prev => ({ ...prev, scale }))}
                      className={`
                        p-3 rounded-lg border-2 transition-all font-medium
                        ${settings.scale === scale
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }
                      `}
                    >
                      <div className="text-lg">{scale}x</div>
                      <div className="text-xs text-gray-500">
                        {scale === 2 ? '~1min' : scale === 4 ? '~3min' : '~8min'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modèle - CORRIGÉ avec vrais modèles backend */}
              <div>
                <label className="block text-sm font-medium mb-2">Modèle d'IA</label>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.entries(ImageModels) as Array<[keyof typeof ImageModels, typeof ImageModels[keyof typeof ImageModels]]>).map(([key, model]) => (
                    <button
                      key={key}
                      onClick={() => setSettings(prev => ({ ...prev, model: key }))}
                      className={`
                        p-3 rounded-lg border-2 transition-all text-left
                        ${settings.model === key
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span>{model.badge}</span>
                        <span className="font-medium">{model.name}</span>
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

              {/* Format de sortie */}
              <div>
                <label className="block text-sm font-medium mb-2">Format de sortie</label>
                <div className="flex gap-2">
                  {(['png', 'jpg'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setSettings(prev => ({ ...prev, outputFormat: format }))}
                      className={`
                        px-4 py-2 rounded-lg border-2 transition-all font-medium
                        ${settings.outputFormat === format
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                          : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                        }
                      `}
                    >
                      {format.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bouton traitement */}
      <motion.button
        onClick={handleProcess}
        disabled={files.length === 0 || isProcessing}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
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
            Améliorer {files.length > 0 && `(${files.length} image${files.length > 1 ? 's' : ''})`}
            <Zap className="w-5 h-5" />
          </>
        )}
      </motion.button>

      {/* Liste des jobs */}
      <AnimatePresence>
        {jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Traitement en cours ({jobs.length})
            </h3>
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg border p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      job.status === 'completed' ? 'bg-green-500' :
                      job.status === 'failed' ? 'bg-red-500' :
                      'bg-blue-500 animate-pulse'
                    }`} />
                    <span className="font-medium">
                      {job.status === 'uploading' ? '📤 Upload...' :
                       job.status === 'processing' ? '⚙️ Traitement...' :
                       job.status === 'completed' ? '✅ Terminé' :
                       '❌ Échec'}
                    </span>
                    {job.settings && (
                      <span className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {job.settings.model} • {job.settings.scale}x
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    {job.status === 'completed' && job.outputFile && (
                      <>
                        <button 
                          onClick={() => window.open(job.outputFile, '_blank')}
                          className="text-blue-500 hover:text-blue-600 p-1"
                          title="Prévisualiser"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a 
                          href={job.outputFile}
                          download
                          className="text-green-500 hover:text-green-600 p-1"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </>
                    )}
                    
                    {(job.status === 'completed' || job.status === 'failed') && (
                      <button
                        onClick={() => removeJob(job.id)}
                        className="text-gray-500 hover:text-red-500 p-1"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Barre de progression */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                  <motion.div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${job.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>

                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>{job.progress}%</span>
                  {job.processingTime && job.status === 'completed' && (
                    <span>⚡ Traité en {job.processingTime}s</span>
                  )}
                  {job.errorMessage && (
                    <span className="text-red-500">{job.errorMessage}</span>
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

export default ModernImageUploader;