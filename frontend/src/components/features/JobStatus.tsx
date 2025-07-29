
// ================================
// src/components/features/JobStatus.tsx - Statut des tâches
'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, Download, Eye } from 'lucide-react';
import { uploadAPI, Job } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface JobStatusProps {
  jobId: number;
  onComplete?: (job: Job) => void;
}

const JobStatus: React.FC<JobStatusProps> = ({ jobId, onComplete }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    const pollJobStatus = async () => {
      try {
        const response = await uploadAPI.getJobStatus(jobId);
        const jobData = response.data;
        setJob(jobData);

        if (jobData.status === 'completed') {
          setIsPolling(false);
          toast.success('Traitement terminé !');
          onComplete?.(jobData);
        } else if (jobData.status === 'failed') {
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
      const interval = setInterval(pollJobStatus, 2000); // Poll toutes les 2s
      return () => clearInterval(interval);
    }
  }, [jobId, isPolling, onComplete]);

  if (!job) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-6">
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
      case 'pending':
      case 'processing':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'pending':
        return 'En attente...';
      case 'processing':
        return 'Traitement en cours...';
      case 'completed':
        return 'Terminé !';
      case 'failed':
        return 'Échec';
      default:
        return 'Inconnu';
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'pending':
      case 'processing':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border shadow-sm p-6"
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="font-medium text-gray-900">Job #{job.id}</h3>
              <p className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </p>
            </div>
          </div>
          
          {job.status === 'completed' && (
            <div className="flex gap-2">
              <a
                href={uploadAPI.downloadResult(job.id)}
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger
              </a>
            </div>
          )}
        </div>

        {/* Barre de progression */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progression</span>
            <span className="font-medium">{job.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Détails */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type:</span>
            <span className="ml-2 font-medium capitalize">{job.type}</span>
          </div>
          <div>
            <span className="text-gray-500">Modèle:</span>
            <span className="ml-2 font-medium">{job.settings.model}</span>
          </div>
          <div>
            <span className="text-gray-500">Échelle:</span>
            <span className="ml-2 font-medium">{job.settings.scale}x</span>
          </div>
          {job.processingTime && (
            <div>
              <span className="text-gray-500">Durée:</span>
              <span className="ml-2 font-medium">{job.processingTime}s</span>
            </div>
          )}
        </div>

        {/* Message d'erreur */}
        {job.status === 'failed' && job.errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-700 text-sm">{job.errorMessage}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default JobStatus;
