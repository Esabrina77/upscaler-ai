// src/components/features/VideoUploader.tsx - Composant upload vidéos
'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Video, 
  Sparkles, 
  Settings, 
  Crown,
  Zap,
  Clock,
  Monitor
} from 'lucide-react';
import { uploadAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

interface VideoUploaderProps {
  onJobCreated?: (jobId: number) => void;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onJobCreated }) => {
  const { user } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [settings, setSettings] = useState({
    scale: '2',
    fps: '60',
    model: 'real-cugan',
    interpolation: false
  });
  const [showSettings, setShowSettings] = useState(true);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Vérification premium
    if (!user) {
      toast.error('Connexion requise pour l\'upscaling vidéo');
      return;
    }

    if (user.plan === 'FREE') {
      toast.error('Fonctionnalité premium. Passez au plan Pro pour les vidéos !');
      return;
    }

    if (user.creditsRemaining <= 0) {
      toast.error('Crédits insuffisants pour traiter cette vidéo');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulation progression upload
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await uploadAPI.uploadVideo(file, settings);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      toast.success('Vidéo ajoutée à la file de traitement !');
      onJobCreated?.(response.data.jobId);
    } catch (error: any) {
      console.error('Erreur upload vidéo:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload vidéo');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [settings, user, onJobCreated]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']
    },
    maxFiles: 1,
    maxSize: 500 * 1024 * 1024, // 500MB pour premium
    disabled: isUploading || user?.plan === 'FREE'
  });

  const models = [
    { 
      value: 'real-cugan', 
      label: 'Real-CUGAN', 
      description: 'IA avancée - Excellent pour anime/dessins',
      quality: 'Excellent',
      speed: 'Lent'
    },
    { 
      value: 'rife', 
      label: 'RIFE', 
      description: 'Interpolation fluide - Idéal pour sport/action',
      quality: 'Très bon',
      speed: 'Rapide'
    },
    { 
      value: 'basicvsr', 
      label: 'BasicVSR++', 
      description: 'Super-resolution - Films/séries',
      quality: 'Excellent',
      speed: 'Très lent'
    },
    { 
      value: 'ffmpeg', 
      label: 'FFmpeg Pro', 
      description: 'Traitement classique optimisé',
      quality: 'Bon',
      speed: 'Très rapide'
    }
  ];

  const scales = [
    { value: '2', label: '2x', description: '2K → 4K', time: '~5min' },
    { value: '4', label: '4x', description: '2K → 8K', time: '~15min' },
    { value: '8', label: '8x', description: '2K → 16K', time: '~45min', pro: true }
  ];

  const fpsOptions = [
    { value: 'auto', label: 'Auto', description: 'Conserver FPS original' },
    { value: '24', label: '24 FPS', description: 'Cinéma' },
    { value: '30', label: '30 FPS', description: 'Vidéo standard' },
    { value: '60', label: '60 FPS', description: 'Fluide - Gaming' },
    { value: '120', label: '120 FPS', description: 'Ultra fluide - Pro only', pro: true }
  ];

  if (user?.plan === 'FREE') {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-8 text-center">
          <Crown className="w-16 h-16 text-purple-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-black mb-4">
            Upscaling Vidéo Premium
          </h3>
          <p className="text-gray-600 mb-6">
            Transformez vos vidéos 2K en 4K/8K avec l'IA. 
            Disponible pour les utilisateurs Premium et Pro.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="bg-white/70 rounded-lg p-3">
              <Zap className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="font-medium">Jusqu'à 8K</p>
              <p className="text-gray-600">Super-resolution</p>
            </div>
            <div className="bg-white/70 rounded-lg p-3">
              <Monitor className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="font-medium">120 FPS</p>
              <p className="text-gray-600">Ultra fluide</p>
            </div>
          </div>
          <button
            onClick={() => window.location.href = '/billing'}
            className="bg-black text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Passer au Premium
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Zone de Drop */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-300 ease-in-out
          ${isDragActive 
            ? 'border-purple-500 bg-purple-50 scale-105' 
            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <motion.div
            animate={{ 
              scale: isDragActive ? 1.2 : 1,
              rotate: isDragActive ? 10 : 0 
            }}
            className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center"
          >
            {isUploading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <Video className="w-8 h-8 text-white" />
            )}
          </motion.div>
          
          <div>
            <h3 className="text-xl font-semibold text-black">
              {isUploading ? `Upload en cours... ${uploadProgress}%` : 
               isDragActive ? 'Déposez votre vidéo ici' : 
               'Glissez une vidéo ou cliquez'}
            </h3>
            <p className="text-gray-500 mt-2">
              Formats: MP4, AVI, MOV, WMV, FLV, WebM (max 500MB)
            </p>
          </div>

          {isUploading && (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
              <motion.div
                className="bg-gradient-to-r from-purple-500 to-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>
        
        {/* Indicateur de crédits */}
        {user && (
          <div className="absolute top-4 right-4 bg-white rounded-lg px-3 py-1 shadow-md">
            <span className="text-sm font-medium text-gray-600">
              {user.creditsRemaining} crédits
            </span>
          </div>
        )}
      </div>

      {/* Paramètres Vidéo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-lg font-medium text-black flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Paramètres d'amélioration vidéo
          </h4>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
          >
            {showSettings ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        <motion.div
          initial={false}
          animate={{ height: showSettings ? 'auto' : 0, opacity: showSettings ? 1 : 0 }}
          className="overflow-hidden space-y-6"
        >
          {/* Échelle */}
          <div>
            <label className="block text-sm font-medium text-black mb-3">
              Facteur d'agrandissement
            </label>
            <div className="grid grid-cols-3 gap-3">
              {scales.map((scale) => (
                <button
                  key={scale.value}
                  onClick={() => setSettings(prev => ({ ...prev, scale: scale.value }))}
                  disabled={scale.pro && user?.plan !== 'PRO'}
                  className={`
                    p-4 rounded-lg border-2 text-center transition-all
                    ${settings.scale === scale.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300 text-black'
                    }
                    ${scale.pro && user?.plan !== 'PRO'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                    }
                  `}
                >
                  <div className="font-bold text-lg">{scale.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{scale.description}</div>
                  <div className="text-xs text-gray-500 mt-1">{scale.time}</div>
                  {scale.pro && user?.plan !== 'PRO' && (
                    <div className="text-xs text-orange-600 font-medium mt-1">Pro uniquement</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div>
            <label className="block text-sm font-medium text-black mb-3">
              Images par seconde (FPS)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {fpsOptions.map((fps) => (
                <button
                  key={fps.value}
                  onClick={() => setSettings(prev => ({ ...prev, fps: fps.value }))}
                  disabled={fps.pro && user?.plan !== 'PRO'}
                  className={`
                    p-3 rounded-lg border text-center transition-all text-sm
                    ${settings.fps === fps.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 hover:border-gray-300 text-black'
                    }
                    ${fps.pro && user?.plan !== 'PRO'
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                    }
                  `}
                >
                  <div className="font-medium">{fps.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{fps.description}</div>
                  {fps.pro && user?.plan !== 'PRO' && (
                    <div className="text-xs text-orange-600 font-medium mt-1">Pro</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Modèle IA */}
          <div>
            <label className="block text-sm font-medium text-black mb-3">
              Modèle d'intelligence artificielle
            </label>
            <div className="space-y-3">
              {models.map((model) => (
                <button
                  key={model.value}
                  onClick={() => setSettings(prev => ({ ...prev, model: model.value }))}
                  className={`
                    w-full p-4 rounded-lg border-2 text-left transition-all
                    ${settings.model === model.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-black">{model.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{model.description}</div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          {model.quality}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {model.speed}
                        </span>
                      </div>
                    </div>
                    <Sparkles className={`w-6 h-6 ${
                      settings.model === model.value ? 'text-purple-500' : 'text-gray-400'
                    }`} />
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
                className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <span className="text-sm font-medium text-black">Interpolation avancée</span>
                <p className="text-xs text-gray-600">
                  Améliore la fluidité entre les frames (augmente le temps de traitement)
                </p>
              </div>
            </label>
          </div>

          {/* Estimation */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-black">Estimation</span>
            </div>
            <div className="text-sm text-gray-600">
              <p>Résolution: {settings.scale === '2' ? '2K → 4K' : settings.scale === '4' ? '2K → 8K' : '2K → 16K'}</p>
              <p>FPS: {settings.fps === 'auto' ? 'Original' : `${settings.fps} FPS`}</p>
              <p>Modèle: {models.find(m => m.value === settings.model)?.label}</p>
              <p className="text-orange-600 font-medium mt-2">
                ⚠️ Traitement intensif - Peut prendre 15-60 minutes selon la vidéo
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VideoUploader;