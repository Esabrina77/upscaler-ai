// src/app/(extranet)/dashboard/page.tsx - Dashboard corrigé final
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Upload, Image, Video, Crown, Zap, Clock, Download, 
  BarChart3, TrendingUp, Settings, RefreshCw, AlertCircle
} from 'lucide-react';
import { authAPI, uploadAPI, testAPI, type User, type Job } from '@/lib/api';
import { formatFileSize, formatDuration } from '@/lib/api';
import { toast } from 'react-hot-toast';
import ModernVideoUploader from '@/components/features/ModernVideoUploader';
import ModernImageUploader from '@/components/features/ModernImageUploader';

interface DashboardStats {
  totalJobs: number;
  completedJobs: number;
  imagesProcessed: number;
  videosProcessed: number;
}

interface SystemHealth {
  status: string;
  tools: {
    realEsrgan: string;
    rife: string;
    ffmpeg: string;
    firebase: string;
  };
}

const DashboardPage: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [jobHistory, setJobHistory] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Charger les données du dashboard
  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Charger profil utilisateur et stats
      const profileResponse = await authAPI.getProfile();
      setUser(profileResponse.data.user);
      setStats(profileResponse.data.stats);

      // Charger santé du système
      try {
        const healthResponse = await testAPI.healthCheck();
        setSystemHealth({
          status: healthResponse.data.status,
          tools: healthResponse.data.summary
        });
      } catch (healthError) {
        console.warn('Impossible de charger la santé du système:', healthError);
      }

      // Charger historique des jobs (simulé pour l'instant)
      setJobHistory([]);

    } catch (error: any) {
      console.error('Erreur chargement dashboard:', error);
      toast.error('Erreur lors du chargement du dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  // Actualiser les données
  const refreshData = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
    toast.success('Dashboard actualisé');
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"
          />
          <p className="text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  const planBadges = {
    FREE: { color: 'bg-gray-100 text-gray-700', icon: '🆓' },
    PREMIUM: { color: 'bg-blue-100 text-blue-700', icon: '💎' },
    PRO: { color: 'bg-purple-100 text-purple-700', icon: '👑' }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Dashboard AI Upscaler
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Bienvenue, {user?.email}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Badge plan */}
              {user?.plan && (
                <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${planBadges[user.plan].color}`}>
                  <span>{planBadges[user.plan].icon}</span>
                  {user.plan}
                </div>
              )}
              
              {/* Bouton actualiser */}
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Crédits restants"
            value={user?.creditsRemaining || 0}
            icon={<Zap className="w-6 h-6" />}
            color="text-yellow-600"
            bgColor="bg-yellow-50 dark:bg-yellow-900/20"
          />
          
          <StatCard
            title="Jobs terminés"
            value={stats?.completedJobs || 0}
            icon={<BarChart3 className="w-6 h-6" />}
            color="text-green-600"
            bgColor="bg-green-50 dark:bg-green-900/20"
          />
          
          <StatCard
            title="Images traitées"
            value={stats?.imagesProcessed || 0}
            icon={<Image className="w-6 h-6" />}
            color="text-blue-600"
            bgColor="bg-blue-50 dark:bg-blue-900/20"
          />
          
          <StatCard
            title="Vidéos traitées"
            value={stats?.videosProcessed || 0}
            icon={<Video className="w-6 h-6" />}
            color="text-purple-600"
            bgColor="bg-purple-50 dark:bg-purple-900/20"
          />
        </div>

        {/* Santé du système */}
        {systemHealth && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              État du système
            </h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(systemHealth.tools).map(([tool, status]) => (
                <div key={tool} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    status.includes('AVAILABLE') || status.includes('v') || status === 'CONNECTED' 
                      ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium capitalize">{tool}</span>
                  <span className="text-xs text-gray-500">{status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Onglets Upload */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('images')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'images'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Images
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('videos')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'videos'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  Vidéos
                  {user?.plan === 'FREE' && (
                    <Crown className="w-3 h-3 text-amber-500" />
                  )}
                </div>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'images' ? (
              <ModernImageUploader 
                userPlan={user?.plan || 'FREE'}
                onUpload={(file, settings) => {
                  console.log('Upload image:', file, settings);
                }}
              />
            ) : (
              <ModernVideoUploader 
                userPlan={user?.plan || 'FREE'}
                onUpload={(file, settings) => {
                  console.log('Upload video:', file, settings);
                }}
              />
            )}
          </div>
        </div>

        {/* Historique des jobs */}
        {jobHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Historique récent
            </h2>
            
            <div className="space-y-3">
              {jobHistory.slice(0, 5).map((job) => (
                <JobHistoryItem key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}

        {/* Upgrade prompt pour FREE */}
        {user?.plan === 'FREE' && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-full p-3">
                <Crown className="w-6 h-6 text-white" />
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Débloquez tout le potentiel de l'IA
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Passez au Premium pour l'upscaling vidéo, plus de crédits et des modèles avancés
                </p>
              </div>
              
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-300">
                Passer au Premium
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

// Composant StatCard
interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  change?: number;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, bgColor, change }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-6"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-medium">
              {change >= 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </div>
      
      <div className={`p-3 rounded-lg ${bgColor}`}>
        <div className={color}>
          {icon}
        </div>
      </div>
    </div>
  </motion.div>
);

// Composant Job History Item
interface JobHistoryItemProps {
  job: Job;
}

const JobHistoryItem: React.FC<JobHistoryItemProps> = ({ job }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />;
      case 'FAILED':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      case 'PROCESSING':
        return <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />;
      default:
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'Terminé';
      case 'FAILED':
        return 'Échec';
      case 'PROCESSING':
        return 'En cours';
      case 'PENDING':
        return 'En attente';
      default:
        return status;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center gap-3">
        {getStatusIcon(job.status)}
        
        <div className="flex items-center gap-2">
          {job.type === 'IMAGE' ? (
            <Image className="w-4 h-4 text-blue-500" />
          ) : (
            <Video className="w-4 h-4 text-purple-500" />
          )}
          <span className="font-medium text-sm">
            {job.type === 'IMAGE' ? 'Image' : 'Vidéo'} {job.settings.scale}x
          </span>
        </div>
        
        <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
          {job.settings.model}
        </span>
      </div>
      
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>{getStatusText(job.status)}</span>
        
        {job.processingTime && (
          <span>⚡ {formatDuration(job.processingTime)}</span>
        )}
        
        <span>{new Date(job.createdAt).toLocaleDateString()}</span>
        
        {job.status === 'COMPLETED' && (
          <button className="text-blue-500 hover:text-blue-600 p-1">
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;