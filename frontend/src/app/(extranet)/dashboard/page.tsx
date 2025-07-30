// src/app/(extranet)/dashboard/page.tsx - Dashboard avec support vidéo
'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Image, 
  Video, 
  Clock, 
  CheckCircle, 
  XCircle,
  TrendingUp,
  Zap,
  Crown,
  BarChart3,
  Monitor,
  Cpu,
  Play
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { authAPI, uploadAPI, Job, JobStatus } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import ImageUploader from '@/components/features/ImageUploader';
import VideoUploader from '@/components/features/VideoUploader';
import JobStatusComponent from '@/components/features/JobStatusComponent';
import VideoJobStatus from '@/components/features/VideoJobStatus';

export default function DashboardPage() {
  const { user, isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [currentJob, setCurrentJob] = useState<number | null>(null);
  const [currentJobType, setCurrentJobType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images');

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        const response = await authAPI.getProfile();
        setStats(response.data.stats);
      } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        toast.error('Erreur lors du chargement');
      }
    };

    fetchDashboardData();
  }, [isAuthenticated, router]);

  const handleJobCreated = (jobId: number, type: 'IMAGE' | 'VIDEO' = 'IMAGE') => {
    setCurrentJob(jobId);
    setCurrentJobType(type);
  };

  const handleJobComplete = (job: Job) => {
    setRecentJobs(prev => [job, ...prev.slice(0, 9)]);
    setCurrentJob(null);
    authAPI.getProfile().then(response => setStats(response.data.stats));
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'FREE': return 'text-gray-600 bg-gray-100';
      case 'PREMIUM': return 'text-blue-600 bg-blue-100';
      case 'PRO': return 'text-purple-600 bg-purple-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPlanIcon = (plan: string) => {
    switch (plan) {
      case 'PRO': return <Crown className="w-4 h-4" />;
      case 'PREMIUM': return <Zap className="w-4 h-4" />;
      default: return null;
    }
  };

  const getJobIcon = (job: Job) => {
    if (job.type === 'VIDEO') {
      switch (job.status) {
        case JobStatus.COMPLETED: return <Video className="w-5 h-5 text-green-600" />;
        case JobStatus.FAILED: return <XCircle className="w-5 h-5 text-red-500" />;
        default: return <Cpu className="w-5 h-5 text-purple-500 animate-pulse" />;
      }
    } else {
      switch (job.status) {
        case JobStatus.COMPLETED: return <Image className="w-5 h-5 text-green-600" />;
        case JobStatus.FAILED: return <XCircle className="w-5 h-5 text-red-500" />;
        default: return <Image className="w-5 h-5 text-blue-500" />;
      }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-black">Bonjour, {user.email.split('@')[0]} 👋</h1>
              <p className="text-gray-600 mt-1">Transformez vos contenus avec l'intelligence artificielle</p>
            </div>
            <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${getPlanColor(user.plan)}`}>
              {getPlanIcon(user.plan)}
              <span className="font-medium">{user.plan}</span>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-6">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button onClick={() => setActiveTab('images')} className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'images' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'}`}>
                <Image className="w-4 h-4" />
                Images
              </button>
              <button onClick={() => setActiveTab('videos')} className={`flex-1 py-3 px-4 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === 'videos' ? 'bg-white text-black shadow-sm' : 'text-gray-600 hover:text-black'} ${user.plan === 'FREE' ? 'opacity-50' : ''}`}>
                <Video className="w-4 h-4" />
                Vidéos
                {user.plan === 'FREE' && <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded">Premium</span>}
              </button>
            </div>

            {activeTab === 'images' && <ImageUploader onJobCreated={(jobId) => handleJobCreated(jobId, 'IMAGE')} />}
            {activeTab === 'videos' && <VideoUploader onJobCreated={(jobId) => handleJobCreated(jobId, 'VIDEO')} />}
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
            {currentJob && (
              currentJobType === 'VIDEO' ? (
                <VideoJobStatus jobId={currentJob} onComplete={handleJobComplete} />
              ) : (
                <JobStatusComponent jobId={currentJob} onComplete={handleJobComplete} />
              )
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
