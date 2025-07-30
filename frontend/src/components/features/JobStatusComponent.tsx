'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Download } from 'lucide-react';
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
        const response = await uploadAPI.getJobStatus(jobId);
        const jobData = response.data;
        setJob(jobData);

        if (jobData.status === JobStatus.COMPLETED) {
          setIsPolling(false);
          toast.success('Traitement terminé !');
          onComplete?.(jobData);

          if (jobData.type === 'VIDEO') {
            const res = await uploadAPI.getVideoStream(jobData.id);
            setVideoStreamUrl(res.data.streamUrl);
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
      const interval = setInterval(pollJobStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [jobId, isPolling, onComplete]);

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

  const getPublicUrl = (firebasePath: string) => {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(firebasePath)}?alt=media`;
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
              <h3 className="font-medium text-black">Job #{job.id}</h3>
              <p className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </p>
            </div>
          </div>
          {job.status === JobStatus.COMPLETED && (
            <a
              href={
                job.type === 'VIDEO'
                  ? uploadAPI.downloadVideoResult(job.id)
                  : uploadAPI.downloadResult(job.id)
              }
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Télécharger
            </a>
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
        </div>

        {/* Visualisation image ou vidéo */}
        {job.status === JobStatus.COMPLETED && (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Entrée</p>
              {job.type === 'VIDEO' ? (
                <div className="bg-gray-100 text-center text-sm text-gray-500 p-4 rounded-lg">
                  Vidéo d’entrée non disponible
                </div>
              ) : job.inputFile ? (
                <img
                  src={getPublicUrl(job.inputFile)}
                  alt="Image d'entrée"
                  className="w-full rounded-lg shadow"
                />
              ) : (
                <div className="bg-gray-100 text-center text-sm text-gray-500 p-4 rounded-lg">
                  Image d’entrée non disponible
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Sortie</p>
              {job.type === 'VIDEO' && videoStreamUrl ? (
                <video controls className="w-full rounded-lg shadow">
                  <source src={videoStreamUrl} type="video/mp4" />
                </video>
              ) : job.type === 'IMAGE' ? (
                <img
                  src={uploadAPI.downloadResult(job.id)}
                  alt="Image sortie"
                  className="w-full rounded-lg shadow"
                />
              ) : (
                <div className="bg-gray-100 text-center text-sm text-gray-500 p-4 rounded-lg">
                  Aperçu indisponible
                </div>
              )}
            </div>
          </div>
        )}

        {job.status === JobStatus.FAILED && job.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{job.errorMessage}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default JobStatusComponent;
