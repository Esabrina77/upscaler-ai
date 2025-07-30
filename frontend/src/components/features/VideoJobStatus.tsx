// src/components/features/VideoJobStatus.tsx - Statut des jobs vidéo
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download, 
  Play,
  Monitor,
  Cpu,
  Zap
} from 'lucide-react';
import { uploadAPI, Job, JobStatus } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface VideoJobStatusProps {
  jobId: number;
  onComplete?: (job: Job) => void;
}

const VideoJobStatus: React.FC<VideoJobStatusProps> = ({ jobId, onComplete }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const response = await uploadAPI.getVideoJobStatus(jobId);
        const jobData = response.data;
        setJob(jobData);

        if (jobData.status === JobStatus.COMPLETED) {
          setIsPolling(false);
          toast.success('Traitement vidéo terminé !');
          onComplete?.(jobData);
          
          // Récupérer infos vidéo et stream
          try {
            const [infoResponse, streamResponse] = await Promise.all([
              uploadAPI.getVideoInfo(jobId),
              uploadAPI.getVideoStream(jobId)
            ]);
            setVideoInfo(infoResponse.data);
            setStreamUrl(streamResponse.data.streamUrl);
          } catch (error) {
            console.warn('Erreur récupération infos vidéo:', error);
          }
        } else if (jobData.status === JobStatus.FAILED) {
          setIsPolling(false);
          toast.error('Échec du traitement vidéo');
        }
      } catch (error) {
        console.error('Erreur poll status vidéo:', error);
        setIsPolling(false);
      }
    };

    if (isPolling) {
      pollJobStatus();
      const interval = setInterval(pollJobStatus, 5000); // Poll toutes les 5s pour vidéos
      return () => clearInterval(interval);
    }
  }, [jobId, isPolling, onComplete]);

  if (!job) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case JobStatus.PENDING:
        return <Clock className="w-6 h-6 text-blue-500" />;
      case JobStatus.PROCESSING:
        return <Cpu className="w-6 h-6 text-purple-500 animate-pulse" />;
      case JobStatus.COMPLETED:
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case JobStatus.FAILED:
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Clock className="w-6 h-6 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case JobStatus.PENDING:
        return 'En attente...';
      case JobStatus.PROCESSING:
        return 'Traitement IA en cours...';
      case JobStatus.COMPLETED:
        return 'Terminé !';
      case JobStatus.FAILED:
        return 'Échec';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case JobStatus.PENDING:
        return 'text-blue-600';
      case JobStatus.PROCESSING:
        return 'text-purple-600';
      case JobStatus.COMPLETED:
        return 'text-green-600';
      case JobStatus.FAILED:
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProcessingStage = () => {
    if (job.progress < 20) return 'Préparation...';
    if (job.progress < 40) return 'Analyse des frames...';
    if (job.progress < 60) return 'Upscaling IA...';
    if (job.progress < 80) return 'Interpolation FPS...';
    if (job.progress < 95) return 'Finalisation...';
    return 'Presque fini...';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-black text-lg">
                Vidéo #{job.id}
              </h3>
              <p className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </p>
              {job.status === JobStatus.PROCESSING && (
                <p className="text-xs text-gray-500 mt-1">
                  {getProcessingStage()}
                </p>
              )}
            </div>
          </div>
          
          {job.status === JobStatus.COMPLETED && (
            <div className="flex gap-3">
              {streamUrl && (
                <a
                  href={streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Preview
                </a>
              )}
              <a
                href={uploadAPI.downloadVideoResult(job.id)}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </a>
            </div>
          )}
        </div>

        {/* Barre de progression améliorée */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Progression</span>
            <span className="font-medium text-black">{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              className="h-3 rounded-full bg-gradient-to-r from-purple-500 to-blue-600 relative overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {job.status === JobStatus.PROCESSING && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: [-100, 200] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              )}
            </motion.div>
          </div>
        </div>

        {/* Détails techniques */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Échelle:</span>
              <span className="font-medium text-black">{job.settings.scale}x</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">FPS:</span>
              <span className="font-medium text-black">
                {job.settings.fps === 'auto' ? 'Original' : `${job.settings.fps} FPS`}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modèle:</span>
              <span className="font-medium text-black">{job.settings.model}</span>
            </div>
            {job.processingTime && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">Durée:</span>
                <span className="font-medium text-black">
                  {Math.floor(job.processingTime / 60)}m {job.processingTime % 60}s
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Informations vidéo (si disponibles) */}
        {videoInfo && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-black mb-3">Informations de sortie</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Taille:</span>
                <span className="ml-2 font-medium text-black">{videoInfo.metadata.size}</span>
              </div>
              <div>
                <span className="text-gray-500">Format:</span>
                <span className="ml-2 font-medium text-black">
                  {videoInfo.metadata.contentType.split('/')[1].toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Message d'erreur */}
        {job.status === JobStatus.FAILED && job.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">Erreur de traitement</h4>
            <p className="text-red-700 text-sm">{job.errorMessage}</p>
            <p className="text-red-600 text-xs mt-2">
              💡 Essayez avec un fichier plus petit ou contactez le support
            </p>
          </div>
        )}

        {/* Temps d'attente estimé */}
        {job.status === JobStatus.PENDING && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">File d'attente</h4>
            <p className="text-blue-700 text-sm">
              Votre vidéo est en attente de traitement. Le processus peut prendre 15-60 minutes 
              selon la taille et les paramètres choisis.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VideoJobStatus;