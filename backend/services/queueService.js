// services/queueService.js - VERSION MÉMOIRE SIMPLE - COMPLET CORRIGÉ
const aiService = require('./aiService');
const JobService = require('../lib/jobService');
const fs = require('fs').promises;

class QueueService {
  constructor() {
    this.jobs = new Map();
    this.processing = false;
    console.log('✅ Queue en mémoire initialisée');
    
    // Processeur simple
    setInterval(() => this.processNext(), 5000);
  }

  async processNext() {
    if (this.processing || this.jobs.size === 0) return;
    
    this.processing = true;
    const [jobId, jobData] = this.jobs.entries().next().value;
    this.jobs.delete(jobId);

    try {
      const { inputPath, settings, type } = jobData;
      
      await JobService.updateStatus(jobId, 'processing', { progress: 20 });

      const startTime = Date.now();
      let outputPath;
      
      if (type === 'image') {
        outputPath = await aiService.upscaleImage(inputPath, settings);
      } else {
        outputPath = await aiService.upscaleVideo(inputPath, settings);
      }
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      await JobService.updateStatus(jobId, 'completed', {
        progress: 100,
        outputFile: outputPath,
        processingTime
      });

      console.log(`✅ Job ${jobId} terminé`);

    } catch (error) {
      console.error(`❌ Job ${jobId} échoué:`, error);
      await JobService.updateStatus(jobId, 'failed', {
        errorMessage: error.message
      });
    }
    
    this.processing = false;
  }

  async addImageJob(jobId, inputPath, settings) {
    this.jobs.set(jobId, { inputPath, settings, type: 'image' });
    console.log(`📥 Job image ${jobId} ajouté`);
  }

  async addVideoJob(jobId, inputPath, settings) {
    this.jobs.set(jobId, { inputPath, settings, type: 'video' });
    console.log(`📥 Job vidéo ${jobId} ajouté`);
  }

  // ✅ Méthodes manquantes ajoutées
  async getQueuePosition(jobId) {
    const jobsArray = Array.from(this.jobs.keys());
    const position = jobsArray.indexOf(parseInt(jobId));
    return position >= 0 ? position + 1 : null;
  }

  async getQueueStats() {
    const imageJobs = Array.from(this.jobs.values()).filter(job => job.type === 'image').length;
    const videoJobs = Array.from(this.jobs.values()).filter(job => job.type === 'video').length;
    
    return {
      images: { 
        waiting: imageJobs, 
        active: this.processing && this.currentJobType === 'image' ? 1 : 0 
      },
      videos: { 
        waiting: videoJobs, 
        active: this.processing && this.currentJobType === 'video' ? 1 : 0 
      },
      total: {
        waiting: this.jobs.size,
        active: this.processing ? 1 : 0,
        processed: this.processedCount || 0
      }
    };
  }

  // ✅ Méthodes utilitaires ajoutées
  async getJobsInQueue() {
    return Array.from(this.jobs.entries()).map(([jobId, jobData]) => ({
      jobId,
      type: jobData.type,
      settings: jobData.settings,
      addedAt: jobData.addedAt || new Date()
    }));
  }

  async removeJob(jobId) {
    const removed = this.jobs.delete(parseInt(jobId));
    if (removed) {
      console.log(`🗑️ Job ${jobId} supprimé de la queue`);
    }
    return removed;
  }

  async clearQueue() {
    const count = this.jobs.size;
    this.jobs.clear();
    console.log(`🧹 Queue vidée: ${count} jobs supprimés`);
    return count;
  }

  async getQueueSize() {
    return this.jobs.size;
  }

  async isJobInQueue(jobId) {
    return this.jobs.has(parseInt(jobId));
  }

  // ✅ Priorité des jobs (vidéos en premier)
  async processNextByPriority() {
    if (this.processing || this.jobs.size === 0) return;
    
    this.processing = true;
    
    // Chercher d'abord les vidéos (priorité)
    let selectedJobId = null;
    let selectedJobData = null;
    
    for (const [jobId, jobData] of this.jobs.entries()) {
      if (jobData.type === 'video') {
        selectedJobId = jobId;
        selectedJobData = jobData;
        break;
      }
    }
    
    // Si pas de vidéo, prendre le premier job
    if (!selectedJobId) {
      const [jobId, jobData] = this.jobs.entries().next().value;
      selectedJobId = jobId;
      selectedJobData = jobData;
    }
    
    this.jobs.delete(selectedJobId);
    this.currentJobType = selectedJobData.type;

    try {
      const { inputPath, settings, type } = selectedJobData;
      
      await JobService.updateStatus(selectedJobId, 'processing', { progress: 20 });

      const startTime = Date.now();
      let outputPath;
      
      if (type === 'image') {
        outputPath = await aiService.upscaleImage(inputPath, settings);
      } else {
        outputPath = await aiService.upscaleVideo(inputPath, settings);
      }
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      await JobService.updateStatus(selectedJobId, 'completed', {
        progress: 100,
        outputFile: outputPath,
        processingTime
      });

      console.log(`✅ Job ${selectedJobId} (${type}) terminé`);
      this.processedCount = (this.processedCount || 0) + 1;

    } catch (error) {
      console.error(`❌ Job ${selectedJobId} échoué:`, error);
      await JobService.updateStatus(selectedJobId, 'failed', {
        errorMessage: error.message
      });
    }
    
    this.processing = false;
    this.currentJobType = null;
  }

  // ✅ Statistiques détaillées
  async getDetailedStats() {
    const jobs = await this.getJobsInQueue();
    const imageJobs = jobs.filter(job => job.type === 'image');
    const videoJobs = jobs.filter(job => job.type === 'video');
    
    return {
      queue: {
        total: jobs.length,
        images: imageJobs.length,
        videos: videoJobs.length,
        processing: this.processing,
        currentJobType: this.currentJobType
      },
      performance: {
        totalProcessed: this.processedCount || 0,
        averageWaitTime: this.calculateAverageWaitTime(),
        uptime: process.uptime()
      },
      nextJobs: jobs.slice(0, 5).map(job => ({
        jobId: job.jobId,
        type: job.type,
        position: jobs.indexOf(job) + 1,
        estimatedWait: this.estimateWaitTime(jobs.indexOf(job) + 1)
      }))
    };
  }

  calculateAverageWaitTime() {
    // Estimation basée sur le type de jobs en queue
    const imageTime = 2; // 2 minutes moyenne pour image
    const videoTime = 15; // 15 minutes moyenne pour vidéo
    
    let totalTime = 0;
    let jobCount = 0;
    
    for (const [jobId, jobData] of this.jobs.entries()) {
      totalTime += jobData.type === 'video' ? videoTime : imageTime;
      jobCount++;
    }
    
    return jobCount > 0 ? Math.round(totalTime / jobCount) : 0;
  }

  estimateWaitTime(position) {
    if (position <= 1) return 'En cours';
    
    // Estimation conservative
    const avgProcessingTime = 8; // 8 minutes moyenne
    const estimatedMinutes = (position - 1) * avgProcessingTime;
    
    if (estimatedMinutes < 60) {
      return `~${estimatedMinutes} min`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return `~${hours}h ${minutes}min`;
    }
  }

  // ✅ Monitoring et health check
  async healthCheck() {
    return {
      status: 'OK',
      queueSize: this.jobs.size,
      processing: this.processing,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      lastProcessedJob: this.lastProcessedJob || null,
      errors: this.errorCount || 0
    };
  }

  // ✅ Gestion d'erreurs améliorée
  async handleJobError(jobId, error) {
    this.errorCount = (this.errorCount || 0) + 1;
    
    console.error(`❌ Erreur job ${jobId}:`, error.message);
    
    // Retry logic pour certaines erreurs
    if (error.message.includes('timeout') || error.message.includes('network')) {
      const jobData = this.jobs.get(jobId);
      if (jobData && !jobData.retryCount) {
        jobData.retryCount = 1;
        console.log(`🔄 Retry job ${jobId}`);
        return; // Garder le job en queue pour retry
      }
    }
    
    // Marquer comme failed
    await JobService.updateStatus(jobId, 'failed', {
      errorMessage: error.message
    });
  }

  // ✅ Nettoyage périodique
  async cleanup() {
    // Supprimer les jobs trop anciens (> 1h en queue)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    let removedCount = 0;
    
    for (const [jobId, jobData] of this.jobs.entries()) {
      const addedAt = jobData.addedAt || Date.now();
      if (addedAt < oneHourAgo) {
        this.jobs.delete(jobId);
        removedCount++;
        
        // Marquer comme failed
        await JobService.updateStatus(jobId, 'failed', {
          errorMessage: 'Timeout en queue (> 1h)'
        });
      }
    }
    
    if (removedCount > 0) {
      console.log(`🧹 ${removedCount} jobs expirés supprimés de la queue`);
    }
    
    return removedCount;
  }

  // ✅ Démarrer nettoyage périodique
  startPeriodicCleanup() {
    setInterval(() => {
      this.cleanup();
    }, 30 * 60 * 1000); // Toutes les 30 minutes
    
    console.log('🧹 Nettoyage périodique queue démarré (30min)');
  }
}

module.exports = new QueueService();