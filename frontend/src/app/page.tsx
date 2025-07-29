// ================================

// src/app/page.tsx - Page d'accueil
'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Shield, Star } from 'lucide-react';
import ImageUploader from '@/components/features/ImageUploader';
import JobStatus from '@/components/features/JobStatus';
import { useAuthStore } from '@/store/authStore';
import { Job, uploadAPI } from '@/lib/api'; // ✅ Ajout de l'import uploadAPI

export default function HomePage() {
  const { user, isAuthenticated } = useAuthStore();
  const [currentJob, setCurrentJob] = useState<number | null>(null);
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);

  const handleJobCreated = (jobId: number) => {
    setCurrentJob(jobId);
  };

  const handleJobComplete = (job: Job) => {
    setCompletedJobs(prev => [job, ...prev.slice(0, 4)]); // Garder 5 derniers
    setCurrentJob(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              Améliorez vos images avec l'
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                IA
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Transformez vos images basse résolution en chef-d'œuvres haute définition 
              grâce à notre technologie d'upscaling par intelligence artificielle.
            </p>
            
            {/* Stats */}
            <div className="flex justify-center gap-8 mb-12">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="text-center"
              >
                <div className="text-3xl font-bold text-blue-600">4K-8K</div>
                <div className="text-gray-600">Résolution max</div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="text-center"
              >
                <div className="text-3xl font-bold text-purple-600">2min</div>
                <div className="text-gray-600">Traitement moyen</div>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="text-center"
              >
                <div className="text-3xl font-bold text-green-600">Gratuit</div>
                <div className="text-gray-600">5 images/jour</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Uploader */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <ImageUploader onJobCreated={handleJobCreated} />
          </motion.div>

          {/* Status & Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-6"
          >
            {currentJob && (
              <JobStatus 
                jobId={currentJob} 
                onComplete={handleJobComplete}
              />
            )}

            {/* Historique des jobs */}
            {completedJobs.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Derniers traitements
                </h3>
                {completedJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-lg border p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Star className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          Image {job.settings.scale}x
                        </div>
                        <div className="text-sm text-gray-500">
                          {job.settings.model} • {job.processingTime}s
                        </div>
                      </div>
                    </div>
                    <a
                      href={uploadAPI.downloadResult(job.id)}
                      download
                      className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      Télécharger
                    </a>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Pourquoi choisir notre outil ?
            </h2>
            <p className="text-lg text-gray-600">
              La technologie d'IA la plus avancée pour l'amélioration d'images
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              whileHover={{ y: -5 }}
              className="text-center p-6"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                IA Avancée
              </h3>
              <p className="text-gray-600">
                Modèles Real-ESRGAN et Waifu2x pour des résultats exceptionnels
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="text-center p-6"
            >
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Traitement Rapide
              </h3>
              <p className="text-gray-600">
                Résultats en moins de 2 minutes grâce à notre infrastructure optimisée
              </p>
            </motion.div>

            <motion.div
              whileHover={{ y: -5 }}
              className="text-center p-6"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Sécurisé
              </h3>
              <p className="text-gray-600">
                Vos images sont automatiquement supprimées après traitement
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
