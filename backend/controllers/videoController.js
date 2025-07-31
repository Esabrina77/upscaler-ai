// controllers/videoController.js - Modernisé avec nettoyage intelligent
const aiService = require('../services/aiService');
const queueService = require('../services/queueService');
const JobService = require('../lib/jobService');
const UserService = require('../lib/userService');
const firebaseStorage = require('../services/firebaseStorageService');
const cleanupUtil = require('../utils/cleanupUtil');
const ffmpegUtil = require('../utils/ffmpegUtil');
const fs = require('fs').promises;
const path = require('path');

class VideoController {
  async uploadAndProcess(req, res) {
    let creditDeducted = false;
    let userId = null;
    let inputFirebasePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier vidéo fourni' });
      }

      userId = req.user?.id;
      const { 
        scale = '2', 
        fps = '60', 
        model = 'real-cugan',
        interpolation = 'false'
      } = req.body;

      // Vérification utilisateur premium
      if (!userId) {
        await fs.unlink(req.file.path);
        return res.status(401).json({ 
          error: 'Compte premium requis pour l\'upscaling vidéo' 
        });
      }

      const user = await UserService.findById(userId);
      if (user.plan === 'FREE') {
        await fs.unlink(req.file.path);
        return res.status(403).json({ 
          error: 'Fonctionnalité premium. Passez au plan Pro pour les vidéos !' 
        });
      }

      // Validation paramètres
      const validScales = ['2', '4', '8'];
      const validModels = ['real-cugan', 'rife', 'basicvsr', 'ffmpeg'];
      const validFps = ['auto', '24', '30', '60', '120'];

      if (!validScales.includes(scale)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: 'Scale invalide pour vidéo (2, 4, 8)' });
      }

      if (!validModels.includes(model)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: 'Modèle vidéo invalide' });
      }

      if (!validFps.includes(fps)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: 'FPS invalide (auto, 24, 30, 60, 120)' });
      }

      // ✅ Vérifier quota Firebase URGENT pour vidéos
      const quotaCheck = await cleanupUtil.isCleanupNeeded();
      if (quotaCheck.urgent) {
        await fs.unlink(req.file.path);
        return res.status(507).json({ 
          error: 'Stockage critique. Impossible de traiter des vidéos actuellement.' 
        });
      }

      // ✅ Estimer espace nécessaire (vidéos = beaucoup d'espace)
      const estimatedSize = await aiService.estimateVideoOutputSize(req.file.path, parseInt(scale), fps);
      const optimized = await cleanupUtil.optimizeBeforeProcessing(estimatedSize);
      
      if (!optimized && estimatedSize > 500) {
        await fs.unlink(req.file.path);
        return res.status(507).json({ 
          error: 'Vidéo trop volumineuse. Espace de stockage insuffisant.' 
        });
      }

      // ✅ Analyser vidéo avant traitement
      let videoInfo = null;
      try {
        videoInfo = await aiService.analyzeMediaFile(req.file.path, 'video');
        console.log(`📹 Vidéo analysée: ${videoInfo.video.width}x${videoInfo.video.height} @${videoInfo.video.fps}fps`);
      } catch (analysisError) {
        console.warn('Erreur analyse vidéo:', analysisError.message);
      }

      // ✅ Upload vers Firebase
      const inputFirebaseResult = await firebaseStorage.uploadFileStream(req.file.path, {
        folder: 'upscaler-vid/input',
        originalName: req.file.originalname,
        makePublic: false,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userId: userId,
          type: 'input-video',
          size: req.file.size,
          videoInfo: videoInfo ? {
            duration: videoInfo.duration,
            resolution: `${videoInfo.video.width}x${videoInfo.video.height}`,
            fps: videoInfo.video.fps,
            codec: videoInfo.video.codec
          } : null
        }
      });

      inputFirebasePath = inputFirebaseResult.firebasePath;
      console.log(`📤 Vidéo uploadée Firebase: ${inputFirebasePath}`);

      // Décrémenter crédits après upload
      const canProcess = await UserService.canProcessAndDecrement(userId);
      if (!canProcess) {
        await firebaseStorage.deleteFile(inputFirebasePath);
        return res.status(403).json({ 
          error: 'Crédits insuffisants pour traiter cette vidéo' 
        });
      }
      creditDeducted = true;

      // Créer job
      const job = await JobService.createJob({
        userId,
        type: 'VIDEO',
        inputFile: inputFirebasePath,
        settings: { 
          scale, 
          fps, 
          model, 
          interpolation: interpolation === 'true',
          originalInfo: videoInfo
        }
      });

      // ✅ Traitement via queue (vidéos toujours en queue)
      await queueService.addVideoJob(job.id, inputFirebasePath, { 
        scale, fps, model, interpolation: interpolation === 'true' 
      });

      // Estimer temps de traitement
      const estimatedTime = await aiService.estimateProcessingTime(req.file.path, {
        scale, fps, model, type: 'video'
      });

      res.json({
        jobId: job.id,
        status: 'queued',
        message: 'Vidéo ajoutée à la file de traitement',
        estimatedTime,
        inputSize: Math.round(req.file.size / (1024 * 1024)) + ' MB',
        videoInfo: videoInfo ? {
          duration: Math.round(videoInfo.duration),
          resolution: `${videoInfo.video.width}x${videoInfo.video.height}`,
          currentFps: Math.round(videoInfo.video.fps)
        } : null,
        queuePosition: await this.getQueuePosition(job.id)
      });

    } catch (error) {
      console.error('Erreur upload vidéo:', error);

      // Nettoyage complet
      if (inputFirebasePath) {
        await firebaseStorage.deleteFile(inputFirebasePath);
      }
      if (creditDeducted && userId) {
        await this.refundCredit(userId);
      }
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch {}
      }

      res.status(500).json({ 
        error: 'Erreur lors du traitement vidéo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ✅ Traitement vidéo synchrone optimisé
  async processVideoSync(jobId, inputFirebasePath, settings) {
    try {
      console.log(`🎬 Début traitement vidéo job ${jobId}`);

      await JobService.updateStatus(jobId, 'PROCESSING', { progress: 5 });

      // Télécharger depuis Firebase
      const tempDir = require('os').tmpdir();
      const localInputPath = path.join(tempDir, `input_video_${Date.now()}.mp4`);

      await firebaseStorage.downloadFile(inputFirebasePath, localInputPath);
      await JobService.updateStatus(jobId, 'PROCESSING', { progress: 15 });

      const startTime = Date.now();

      // Processing avec service IA
      console.log(`🎥 Traitement vidéo avec ${settings.model}`);
      const outputFirebasePath = await aiService.upscaleVideo(localInputPath, settings);

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Traitement vidéo terminé en ${processingTime}s`);

      // Nettoyage fichier local
      try {
        await fs.unlink(localInputPath);
      } catch (error) {
        console.warn('Erreur suppression fichier local:', error.message);
      }

      // Job terminé
      await JobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        outputFile: outputFirebasePath,
        processingTime
      });

      return {
        jobId,
        status: 'COMPLETED',
        downloadUrl: `/api/videos/download/${jobId}`,
        streamUrl: `/api/videos/stream/${jobId}`,
        processingTime,
        outputPath: outputFirebasePath
      };

    } catch (error) {
      console.error('Erreur processing vidéo:', error);

      await JobService.updateStatus(jobId, 'FAILED', {
        errorMessage: error.message
      });

      throw error;
    }
  }

  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ error: 'Job non trouvé' });
      }

      const response = {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        settings: job.settings,
        createdAt: job.createdAt
      };

      if (job.status === 'COMPLETED') {
        response.downloadUrl = `/api/videos/download/${jobId}`;
        response.streamUrl = `/api/videos/stream/${jobId}`;
        response.processingTime = job.processingTime;
        response.completedAt = job.completedAt;
        
        // ✅ Vérifier disponibilité fichier
        if (job.outputFile) {
          try {
            const metadata = await firebaseStorage.getFileMetadata(job.outputFile);
            response.available = true;
            response.fileSize = Math.round((metadata.size || 0) / (1024 * 1024) * 100) / 100 + ' MB';
          } catch {
            response.available = false;
            response.expiredMessage = 'Vidéo expirée (1h de conservation)';
          }
        }
      } else if (job.status === 'FAILED') {
        response.errorMessage = job.errorMessage;
      } else if (job.status === 'PENDING') {
        response.queuePosition = await this.getQueuePosition(jobId);
        response.estimatedWait = await this.getEstimatedWaitTime(jobId);
      }

      res.json(response);

    } catch (error) {
      console.error('Erreur get job status vidéo:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // ✅ Téléchargement vidéo avec vérification
  async downloadResult(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Résultat vidéo non trouvé' });
      }

      try {
        // Vérifier disponibilité
        await firebaseStorage.getFileMetadata(job.outputFile);
        
        // URL signée longue durée pour vidéos (24h)
        const signedUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 24);
        res.redirect(signedUrl);
        console.log(`📥 Téléchargement vidéo job ${jobId}`);
        
      } catch (fileError) {
        return res.status(410).json({ 
          error: 'Vidéo expirée',
          message: 'Les vidéos sont conservées 1 heure après traitement'
        });
      }

    } catch (error) {
      console.error('Erreur download vidéo:', error);
      res.status(500).json({ error: 'Erreur téléchargement vidéo' });
    }
  }

  // ✅ Streaming vidéo
  async streamVideo(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      try {
        const metadata = await firebaseStorage.getFileMetadata(job.outputFile);
        const streamUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 2); // 2h pour streaming

        res.json({
          streamUrl,
          jobId: job.id,
          settings: job.settings,
          processingTime: job.processingTime,
          fileInfo: {
            size: Math.round((metadata.size || 0) / (1024 * 1024) * 100) / 100 + ' MB',
            contentType: metadata.contentType,
            duration: job.settings.originalInfo?.duration || 'Inconnue'
          }
        });
        
      } catch (fileError) {
        return res.status(410).json({ 
          error: 'Vidéo expirée',
          message: 'Streaming non disponible - fichier supprimé'
        });
      }

    } catch (error) {
      console.error('Erreur stream vidéo:', error);
      res.status(500).json({ error: 'Erreur streaming vidéo' });
    }
  }

  // ✅ Informations détaillées vidéo
  async getVideoInfo(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ error: 'Job non trouvé' });
      }

      let metadata = {};
      let available = false;
      
      if (job.outputFile) {
        try {
          metadata = await firebaseStorage.getFileMetadata(job.outputFile);
          available = true;
        } catch (error) {
          console.warn('Fichier non disponible:', error.message);
        }
      }

      const response = {
        jobId: job.id,
        status: job.status,
        settings: job.settings,
        available,
        processingTime: job.processingTime
      };

      if (available) {
        response.fileInfo = {
          size: Math.round((metadata.size || 0) / (1024 * 1024) * 100) / 100 + ' MB',
          contentType: metadata.contentType || 'video/mp4',
          created: metadata.timeCreated || job.createdAt,
          updated: metadata.updated || job.updatedAt
        };

        // Informations vidéo originale vs traitée
        if (job.settings.originalInfo) {
          const original = job.settings.originalInfo;
          response.comparison = {
            original: {
              resolution: original.resolution,
              fps: Math.round(original.fps),
              duration: Math.round(original.duration) + 's'
            },
            processed: {
              resolution: this.calculateNewResolution(original.resolution, job.settings.scale),
              fps: job.settings.fps === 'auto' ? Math.round(original.fps) : job.settings.fps,
              model: job.settings.model
            }
          };
        }
      } else {
        response.message = 'Fichier expiré ou en cours de traitement';
      }

      res.json(response);

    } catch (error) {
      console.error('Erreur get video info:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // ✅ Créer thumbnail vidéo
  async createThumbnail(req, res) {
    try {
      const { jobId } = req.params;
      const { time = 5 } = req.query; // Seconde pour thumbnail

      const job = await JobService.findById(parseInt(jobId));
      if (!job || !job.outputFile) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      try {
        // Télécharger vidéo temporairement
        const tempDir = require('os').tmpdir();
        const videoPath = path.join(tempDir, `video_${jobId}.mp4`);
        const thumbnailPath = path.join(tempDir, `thumb_${jobId}_${time}.jpg`);

        await firebaseStorage.downloadFile(job.outputFile, videoPath);
        
        // Créer thumbnail avec FFmpeg
        await aiService.createVideoThumbnail(videoPath, parseInt(time));
        
        // Upload thumbnail vers Firebase
        const thumbnailResult = await firebaseStorage.uploadFile(thumbnailPath, {
          folder: 'upscaler-vid/thumbnails',
          originalName: `thumbnail_${jobId}_${time}s.jpg`,
          makePublic: true // Public pour affichage direct
        });

        // Nettoyage fichiers temporaires
        try {
          await fs.unlink(videoPath);
          await fs.unlink(thumbnailPath);
        } catch {}

        res.json({
          thumbnailUrl: thumbnailResult.downloadUrl,
          time: parseInt(time),
          jobId: job.id
        });

      } catch (fileError) {
        return res.status(410).json({ 
          error: 'Impossible de créer le thumbnail',
          message: 'Vidéo expirée ou inaccessible'
        });
      }

    } catch (error) {
      console.error('Erreur création thumbnail:', error);
      res.status(500).json({ error: 'Erreur création thumbnail' });
    }
  }

  // ✅ Analyser vidéo uploadée
  async analyzeVideo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucune vidéo fournie' });
      }

      const analysis = await aiService.analyzeMediaFile(req.file.path, 'video');
      
      // Supprimer fichier après analyse
      await fs.unlink(req.file.path);
      
      if (!analysis) {
        return res.status(400).json({ error: 'Impossible d\'analyser la vidéo' });
      }

      // Ajouter recommandations
      const recommendations = this.getVideoRecommendations(analysis);
      
      res.json({
        analysis: {
          duration: Math.round(analysis.duration),
          size: Math.round(analysis.size / (1024 * 1024)) + ' MB',
          bitrate: Math.round((analysis.bitrate || 0) / 1000) + ' kbps',
          video: {
            resolution: `${analysis.video.width}x${analysis.video.height}`,
            fps: Math.round(analysis.video.fps),
            codec: analysis.video.codec
          },
          audio: analysis.audio ? {
            codec: analysis.audio.codec,
            sampleRate: analysis.audio.sampleRate + ' Hz',
            channels: analysis.audio.channels
          } : null
        },
        recommendations,
        supportedScales: this.getSupportedVideoScales(analysis),
        estimatedTimes: await this.getVideoEstimatedTimes(analysis),
        processingTips: this.getProcessingTips(analysis)
      });

    } catch (error) {
      console.error('Erreur analyse vidéo:', error);
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch {}
      }
      res.status(500).json({ error: 'Erreur analyse vidéo' });
    }
  }

  // Recommandations vidéo
  getVideoRecommendations(analysis) {
    const recommendations = [];
    const duration = analysis.duration;
    const resolution = analysis.video.width * analysis.video.height;
    
    if (duration > 300) { // > 5 minutes
      recommendations.push({
        type: 'WARNING',
        message: 'Vidéo longue détectée',
        suggestion: 'Traitement très long attendu. Considérez découper la vidéo.'
      });
    }
    
    if (resolution > 1920 * 1080) { // > Full HD
      recommendations.push({
        type: 'WARNING',
        message: 'Haute résolution détectée',
        suggestion: 'Scale 2x recommandé pour éviter saturation stockage'
      });
    }
    
    if (analysis.video.fps > 60) {
      recommendations.push({
        type: 'INFO',
        message: 'FPS élevé détecté',
        suggestion: 'Interpolation désactivée recommandée'
      });
    }
    
    if (analysis.video.codec === 'h265') {
      recommendations.push({
        type: 'INFO',
        message: 'Codec H.265 détecté',
        suggestion: 'Compatibilité optimale, traitement efficace'
      });
    }
    
    return recommendations;
  }

  // Scales supportées selon résolution vidéo
  getSupportedVideoScales(analysis) {
    const maxDimension = Math.max(analysis.video.width, analysis.video.height);
    
    if (maxDimension > 1920) return [2]; // 4K+ => seulement 2x
    if (maxDimension > 1280) return [2, 4]; // HD+ => 2x, 4x
    return [2, 4, 8]; // SD => tous
  }

  // Temps estimés par modèle vidéo
  async getVideoEstimatedTimes(analysis) {
    const durationMinutes = analysis.duration / 60;
    const complexityFactor = (analysis.video.width * analysis.video.height) / (1920 * 1080);
    
    return {
      'ffmpeg': Math.ceil(durationMinutes * 5 * complexityFactor) + ' min',
      'real-cugan': Math.ceil(durationMinutes * 8 * complexityFactor) + ' min',
      'rife': Math.ceil(durationMinutes * 12 * complexityFactor) + ' min',
      'basicvsr': Math.ceil(durationMinutes * 15 * complexityFactor) + ' min'
    };
  }

  // Conseils de traitement
  getProcessingTips(analysis) {
    const tips = [];
    
    if (analysis.duration < 60) {
      tips.push('Vidéo courte: tous les modèles recommandés');
    } else if (analysis.duration < 300) {
      tips.push('Durée moyenne: FFmpeg ou Real-CUGAN recommandés');
    } else {
      tips.push('Vidéo longue: FFmpeg uniquement pour temps raisonnable');
    }
    
    if (analysis.video.fps < 30) {
      tips.push('FPS faible: interpolation 60fps recommandée');
    }
    
    if (analysis.video.width < 1280) {
      tips.push('Résolution faible: scale 4x ou 8x possible');
    }
    
    return tips;
  }

  // Position dans la queue
  async getQueuePosition(jobId) {
    try {
      const pendingJobs = await JobService.getPendingJobs('VIDEO', 50);
      const position = pendingJobs.findIndex(job => job.id === parseInt(jobId));
      return position >= 0 ? position + 1 : null;
    } catch {
      return null;
    }
  }

  // Temps d'attente estimé
  async getEstimatedWaitTime(jobId) {
    try {
      const position = await this.getQueuePosition(jobId);
      if (!position) return null;
      
      // Estimation: 10 minutes par vidéo en moyenne
      const estimatedMinutes = (position - 1) * 10;
      return estimatedMinutes > 0 ? `${estimatedMinutes} min` : 'Prochainement';
    } catch {
      return null;
    }
  }

  // Calculer nouvelle résolution
  calculateNewResolution(originalResolution, scale) {
    if (!originalResolution) return 'Inconnue';
    
    const match = originalResolution.match(/(\d+)x(\d+)/);
    if (!match) return 'Inconnue';
    
    const width = parseInt(match[1]) * parseInt(scale);
    const height = parseInt(match[2]) * parseInt(scale);
    
    return `${width}x${height}`;
  }

  // Remboursement crédit vidéo
  async refundCredit(userId) {
    try {
      const user = await UserService.findById(userId);
      if (!user) return;

      if (user.plan !== 'FREE') {
        await UserService.incrementCredits(userId);
        console.log(`💰 Crédit vidéo remboursé pour l'utilisateur ${userId}`);
      }
    } catch (error) {
      console.error('Erreur remboursement crédit vidéo:', error);
    }
  }

  // ✅ Optimisation stockage spéciale vidéos
  async optimizeVideoStorage(req, res) {
    try {
      const { force = false } = req.query;
      
      let result;
      if (force === 'true') {
        result = await cleanupUtil.emergencyCleanup();
      } else {
        result = await cleanupUtil.cleanupByType('videos', 0.5); // Vidéos > 30min
      }
      
      res.json({
        success: true,
        message: `Optimisation terminée: ${result.count} fichiers supprimés`,
        freedSpace: `${result.sizeMB} MB libérés`,
        type: force ? 'emergency' : 'normal'
      });

    } catch (error) {
      console.error('Erreur optimisation stockage:', error);
      res.status(500).json({ error: 'Erreur optimisation' });
    }
  }

  // ✅ Queue stats pour l'admin
  async getQueueStats(req, res) {
    try {
      const stats = await queueService.getQueueStats();
      const pendingJobs = await JobService.getPendingJobs('VIDEO', 10);
      const processingJobs = await JobService.searchJobs({ 
        status: 'PROCESSING', 
        type: 'VIDEO' 
      });

      res.json({
        queue: stats,
        pending: pendingJobs.length,
        processing: processingJobs.totalCount,
        nextJobs: pendingJobs.slice(0, 5).map(job => ({
          id: job.id,
          settings: job.settings,
          createdAt: job.createdAt,
          userPlan: job.user?.plan
        }))
      });

    } catch (error) {
      console.error('Erreur stats queue:', error);
      res.status(500).json({ error: 'Erreur statistiques' });
    }
  }
}

module.exports = new VideoController();