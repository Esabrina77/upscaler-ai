// services/queueService.js - VERSION MÉMOIRE SIMPLE
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

  async getQueueStats() {
    return {
      images: { waiting: this.jobs.size, active: this.processing ? 1 : 0 },
      videos: { waiting: 0, active: 0 }
    };
  }
}

module.exports = new QueueService();