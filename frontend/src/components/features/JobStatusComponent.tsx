// src/components/features/JobStatusComponent.tsx - CORRIGÉ avec bonnes routes
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Download, Play, Eye } from 'lucide-react';
import { uploadAPI, Job, JobStatus } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface JobStatusProps {
  jobId: number;
  onComplete?: (job: Job) => void;
}

const JobStatusComponent: React.FC<JobStatusProps> = ({ jobId, onComplete }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [videoStreamUrl, setVideoStreamUrl] = useState<string | null>(null);

  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        // Utiliser la bonne route selon le type de job
        const response = job?.type === 'VIDEO' 
          ? await uploadAPI.getVideoJobStatus(jobId)
          : await uploadAPI.getJobStatus(jobId);
        
        const jobData = response.data;
        setJob(jobData);

        if (jobData.status === JobStatus.COMPLETED) {
          setIsPolling(false);
          toast.success('Traitement terminé !');
          onComplete?.(jobData);

          // Pour les vidéos, récupérer l'URL de streaming
          if (jobData.type === 'VIDEO') {
            try {
              const streamResponse = await uploadAPI.getVideoStream(jobData.id);
              setVideoStreamUrl(streamResponse.data.streamUrl);
            } catch (streamError) {
              console.warn('Impossible de récupérer le stream vidéo:', streamError);
            }
          }
        } else if (jobData.status === JobStatus.FAILED) {
          setIsPolling(false);
          toast.error('Échec du traitement');
        }
      } catch (error) {
        console.error('Erreur poll status:', error);
        setIsPolling(false);
      }
    };

    if (isPolling) {
      pollJobStatus();
      const interval = setInterval(pollJobStatus, 3000); // 3 secondes
      return () => clearInterval(interval);
    }
  }, [jobId, isPolling, onComplete, job?.type]);

  if (!job) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-2 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  const getStatusIcon = () => {
    switch (job.status) {
      case JobStatus.PENDING:
      case JobStatus.PROCESSING:
        return <Clock className="w-5 h-5 text-blue-500" />;
      case JobStatus.COMPLETED:
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case JobStatus.FAILED:
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case JobStatus.PENDING:
        return 'En attente...';
      case JobStatus.PROCESSING:
        return 'Traitement en cours...';
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
      case JobStatus.PROCESSING:
        return 'text-blue-600';
      case JobStatus.COMPLETED:
        return 'text-green-600';
      case JobStatus.FAILED:
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getDownloadUrl = () => {
    return job.type === 'VIDEO' 
      ? uploadAPI.downloadVideoResult(job.id)
      : uploadAPI.downloadResult(job.id);
  };

  const getPreviewUrl = () => {
    return job.type === 'VIDEO' 
      ? videoStreamUrl
      : uploadAPI.downloadResult(job.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-black">
                Job #{job.id} • {job.type === 'VIDEO' ? 'Vidéo' : 'Image'}
              </h3>
              <p className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </p>
            </div>
          </div>
          
          {job.status === JobStatus.COMPLETED && (
            <div className="flex gap-2">
              {/* Bouton prévisualisation */}
              {(job.type === 'VIDEO' && videoStreamUrl) || job.type === 'IMAGE' ? (
                <button
                  onClick={() => {
                    const previewUrl = getPreviewUrl();
                    if (previewUrl) {
                      window.open(previewUrl, '_blank');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {job.type === 'VIDEO' ? <Play className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {job.type === 'VIDEO' ? 'Lire' : 'Voir'}
                </button>
              ) : null}
              
              {/* Bouton téléchargement */}
              <a
                href={getDownloadUrl()}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </a>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progression</span>
            <span className="font-medium text-black">{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="h-2 rounded-full bg-black"
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type:</span>
            <span className="ml-2 font-medium text-black capitalize">
              {job.type.toLowerCase()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Modèle:</span>
            <span className="ml-2 font-medium text-black">{job.settings.model}</span>
          </div>
          <div>
            <span className="text-gray-500">Échelle:</span>
            <span className="ml-2 font-medium text-black">{job.settings.scale}x</span>
          </div>
          {job.processingTime && (
            <div>
              <span className="text-gray-500">Durée:</span>
              <span className="ml-2 font-medium text-black">{job.processingTime}s</span>
            </div>
          )}
          {job.type === 'VIDEO' && job.settings.fps && (
            <div>
              <span className="text-gray-500">FPS:</span>
              <span className="ml-2 font-medium text-black">{job.settings.fps}</span>
            </div>
          )}
          {job.type === 'VIDEO' && job.settings.interpolation && (
            <div>
              <span className="text-gray-500">Interpolation:</span>
              <span className="ml-2 font-medium text-black">
                {job.settings.interpolation ? 'Activée' : 'Désactivée'}
              </span>
            </div>
          )}
        </div>

        {/* Visualisation pour images terminées */}
        {job.status === JobStatus.COMPLETED && job.type === 'IMAGE' && (
          <div className="pt-4">
            <p className="text-sm text-gray-500 mb-2">Aperçu du résultat</p>
            <div className="bg-gray-100 rounded-lg p-4 text-center">
              <img
                src={uploadAPI.downloadResult(job.id)}
                alt="Image traitée"
                className="max-w-full max-h-64 mx-auto rounded-lg shadow"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling!.textContent = 
                    'Aperçu non disponible - Fichier peut-être expiré';
                }}
              />
              <p className="text-sm text-gray-500 mt-2 hidden">
                Aperçu non disponible - Fichier peut-être expiré
              </p>
            </div>
          </div>
        )}

        {/* Lecteur vidéo pour vidéos terminées */}
        {job.status === JobStatus.COMPLETED && job.type === 'VIDEO' && videoStreamUrl && (
          <div className="pt-4">
            <p className="text-sm text-gray-500 mb-2">Aperçu de la vidéo</p>
            <div className="bg-black rounded-lg overflow-hidden">
              <video 
                controls 
                className="w-full max-h-64"
                preload="metadata"
              >
                <source src={videoStreamUrl} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture vidéo.
              </video>
            </div>
          </div>
        )}

        {/* Informations vidéo originale */}
        {job.type === 'VIDEO' && job.settings.originalInfo && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Informations vidéo</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>
                <span className="font-medium">Résolution:</span> {job.settings.originalInfo.resolution}
              </div>
              <div>
                <span className="font-medium">FPS original:</span> {job.settings.originalInfo.fps}
              </div>
              <div>
                <span className="font-medium">Durée:</span> {job.settings.originalInfo.duration}s
              </div>
              <div>
                <span className="font-medium">Codec:</span> {job.settings.originalInfo.codec}
              </div>
            </div>
          </div>
        )}

        {job.status === JobStatus.FAILED && job.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm font-medium">Erreur de traitement</p>
            <p className="text-red-600 text-sm mt-1">{job.errorMessage}</p>
          </div>
        )}

        {/* Informations disponibilité */}
        {job.status === JobStatus.COMPLETED && job.available === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-amber-700 text-sm font-medium">Fichier expiré</p>
            <p className="text-amber-600 text-sm mt-1">
              {job.expiredMessage || 'Le fichier a été supprimé après la période de conservation (1h)'}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default JobStatusComponent;