// src/components/features/ImageUploader.tsx - Composant upload d'images (CORRIGÉ)
'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import { Upload, Image, Sparkles, Settings } from 'lucide-react';
import { uploadAPI } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

interface ImageUploaderProps {
  onJobCreated?: (jobId: number) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onJobCreated }) => {
  const { user } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);
  const [settings, setSettings] = useState({
    scale: '2',
    model: 'waifu2x'
  });
  const [showSettings, setShowSettings] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Vérifier les limites utilisateur
    if (!user) {
      toast.error('Connexion requise pour traiter des images');
      return;
    } else if (user.plan === 'FREE' && user.creditsUsedToday >= 5) {
      toast.error('Limite quotidienne atteinte. Passez au premium pour continuer !');
      return;
    }

    setIsUploading(true);
    
    try {
      const response = await uploadAPI.uploadImage(file, settings);
      toast.success('Image ajoutée à la file de traitement !');
      onJobCreated?.(response.data.jobId);
    } catch (error: any) {
      console.error('Erreur upload:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
    }
  }, [settings, user, onJobCreated]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff']
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: isUploading
  });

  const models = [
    { value: 'waifu2x', label: 'Waifu2x', description: 'Rapide - Idéal pour dessins/anime' },
    { value: 'real-esrgan', label: 'Real-ESRGAN', description: 'Excellent pour photos réalistes' },
    { value: 'esrgan', label: 'ESRGAN', description: 'Polyvalent - Bon compromis' },
  ];

  const scales = [
    { value: '2', label: '2x', description: 'Double la résolution' },
    { value: '4', label: '4x', description: 'Quadruple la résolution' },
    { value: '8', label: '8x', description: 'Premium uniquement' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Zone de Drop */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-300 ease-in-out upload-zone
          ${isDragActive ? 'active' : ''}
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <motion.div
            animate={{ 
              scale: isDragActive ? 1.2 : 1,
              rotate: isDragActive ? 10 : 0 
            }}
            className="mx-auto w-16 h-16 bg-black rounded-full flex items-center justify-center"
          >
            {isUploading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"
              />
            ) : (
              <Upload className="w-8 h-8 text-white" />
            )}
          </motion.div>
          
          <div>
            <h3 className="text-xl font-semibold text-black">
              {isUploading ? 'Upload en cours...' : 
               isDragActive ? 'Déposez votre image ici' : 
               'Glissez une image ou cliquez'}
            </h3>
            <p className="text-gray-500 mt-2">
              Formats supportés: PNG, JPG, WEBP, BMP, TIFF (max 50MB)
            </p>
          </div>
        </div>
        
        {/* Indicateur de crédits */}
        {user && (
          <div className="absolute top-4 right-4 bg-white rounded-lg px-3 py-1 shadow-sm border border-gray-200">
            <span className="text-sm font-medium text-gray-700">
              {user.plan === 'FREE' 
                ? `${5 - user.creditsUsedToday}/5 gratuit`
                : `${user.creditsRemaining} crédits`
              }
            </span>
          </div>
        )}
      </div>

      {/* Paramètres */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-black flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Paramètres d'amélioration
          </h4>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-gray-600 hover:text-black text-sm font-medium transition-colors"
          >
            {showSettings ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        <motion.div
          initial={false}
          animate={{ height: showSettings ? 'auto' : 0, opacity: showSettings ? 1 : 0 }}
          className="overflow-hidden"
        >
          <div className="space-y-6">
            {/* Échelle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Facteur d'agrandissement
              </label>
              <div className="grid grid-cols-3 gap-3">
                {scales.map((scale) => (
                  <button
                    key={scale.value}
                    onClick={() => setSettings(prev => ({ ...prev, scale: scale.value }))}
                    disabled={scale.value === '8' && user?.plan === 'FREE'}
                    className={`
                      p-3 rounded-lg border-2 text-center transition-all
                      ${settings.scale === scale.value
                        ? 'border-black bg-gray-50 text-black'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }
                      ${scale.value === '8' && user?.plan === 'FREE'
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                      }
                    `}
                  >
                    <div className="font-semibold">{scale.label}</div>
                    <div className="text-xs text-gray-500">{scale.description}</div>
                    {scale.value === '8' && user?.plan === 'FREE' && (
                      <div className="text-xs text-orange-600 font-medium mt-1">Premium</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Modèle IA */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Modèle d'intelligence artificielle
              </label>
              <div className="space-y-2">
                {models.map((model) => (
                  <button
                    key={model.value}
                    onClick={() => setSettings(prev => ({ ...prev, model: model.value }))}
                    className={`
                      w-full p-4 rounded-lg border-2 text-left transition-all
                      ${settings.model === model.value
                        ? 'border-black bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-black">{model.label}</div>
                        <div className="text-sm text-gray-500">{model.description}</div>
                      </div>
                      <Sparkles className={`w-5 h-5 ${
                        settings.model === model.value ? 'text-black' : 'text-gray-400'
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ImageUploader;