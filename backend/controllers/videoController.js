// controllers/videoController.js - Contrôleur vidéo avec Firebase
const aiService = require('../services/aiService');
const queueService = require('../services/queueService');
const JobService = require('../lib/jobService');
const UserService = require('../lib/userService');
const firebaseStorage = require('../services/firebaseStorageService');
const fs = require('fs').promises;
const path = require('path');

class VideoController {
  async uploadAndProcess(req, res) {
    let creditDeducted = false;
    let userId = null;

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

      const inputFirebaseResult = await firebaseStorage.uploadFile(req.file.path, {
        folder: 'upscaler-vid/input',
        originalName: req.file.originalname,
        makePublic: false,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userId: userId,
          type: 'input-video'
        }
      });

      console.log(`📤 Vidéo uploadée vers Firebase: ${inputFirebaseResult.firebasePath}`);

      const canProcess = await UserService.canProcessAndDecrement(userId);
      if (!canProcess) {
        await firebaseStorage.deleteFile(inputFirebaseResult.firebasePath);
        return res.status(403).json({ 
          error: 'Crédits insuffisants pour traiter cette vidéo' 
        });
      }
      creditDeducted = true;

      const job = await JobService.createJob({
        userId,
        type: 'VIDEO',
        inputFile: inputFirebaseResult.firebasePath,
        settings: { 
          scale, 
          fps, 
          model, 
          interpolation: interpolation === 'true' 
        }
      });

      await queueService.addVideoJob(job.id, inputFirebaseResult.firebasePath, { 
        scale, fps, model, interpolation: interpolation === 'true' 
      });

      res.json({
        jobId: job.id,
        status: 'queued',
        message: 'Vidéo ajoutée à la file de traitement',
        estimatedTime: estimateVideoProcessingTime(req.file.size, scale, fps),
        inputSize: Math.round(req.file.size / (1024 * 1024)) + ' MB'
      });

    } catch (error) {
      console.error('Erreur upload vidéo:', error);

      if (creditDeducted && userId) {
        await refundCredit(userId);
      }

      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Erreur suppression fichier:', unlinkError);
        }
      }

      res.status(500).json({ 
        error: 'Erreur lors du traitement vidéo',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async processVideoSync(jobId, inputFirebasePath, settings) {
    try {
      console.log(`🎬 Début traitement vidéo job ${jobId}`);

      await JobService.updateStatus(jobId, 'PROCESSING', { progress: 5 });

      const tempDir = require('os').tmpdir();
      const localInputPath = path.join(tempDir, `input_${Date.now()}.mp4`);

      await firebaseStorage.downloadFile(inputFirebasePath, localInputPath);
      await JobService.updateStatus(jobId, 'PROCESSING', { progress: 15 });

      const startTime = Date.now();

      console.log(`🎥 Traitement vidéo avec ${settings.model}`);
      const outputFirebasePath = await aiService.upscaleVideo(localInputPath, settings);

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Traitement vidéo terminé en ${processingTime}s`);

      try {
        await fs.unlink(localInputPath);
      } catch (error) {
        console.warn('Erreur suppression fichier local:', error.message);
      }

      await JobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        outputFile: outputFirebasePath,
        processingTime
      });

      return {
        jobId,
        status: 'COMPLETED',
        downloadUrl: `/api/videos/download/${jobId}`,
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

  async downloadResult(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Résultat vidéo non trouvé' });
      }

      const signedUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 24);
      res.redirect(signedUrl);
      console.log(`📥 Téléchargement vidéo job ${jobId}`);

    } catch (error) {
      console.error('Erreur download vidéo:', error);
      res.status(500).json({ error: 'Erreur téléchargement vidéo' });
    }
  }

  async streamVideo(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Vidéo non trouvée' });
      }

      const streamUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 1);

      res.json({
        streamUrl,
        jobId: job.id,
        settings: job.settings,
        processingTime: job.processingTime
      });

    } catch (error) {
      console.error('Erreur stream vidéo:', error);
      res.status(500).json({ error: 'Erreur streaming vidéo' });
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
      } else if (job.status === 'FAILED') {
        response.errorMessage = job.errorMessage;
      }

      res.json(response);

    } catch (error) {
      console.error('Erreur get job status vidéo:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  async getVideoInfo(req, res) {
    try {
      const { jobId } = req.params;

      const job = await JobService.findById(parseInt(jobId));
      if (!job) {
        return res.status(404).json({ error: 'Job non trouvé' });
      }

      let metadata = {};
      if (job.outputFile) {
        try {
          metadata = await firebaseStorage.getFileMetadata(job.outputFile);
        } catch (error) {
          console.warn('Erreur métadonnées:', error.message);
        }
      }

      res.json({
        jobId: job.id,
        status: job.status,
        settings: job.settings,
        metadata: {
          size: metadata.size ? Math.round(metadata.size / (1024 * 1024)) + ' MB' : 'N/A',
          contentType: metadata.contentType || 'video/mp4',
          created: metadata.timeCreated || job.createdAt,
          updated: metadata.updated || job.updatedAt
        },
        processingTime: job.processingTime
      });

    } catch (error) {
      console.error('Erreur get video info:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
}

function estimateVideoProcessingTime(fileSize, scale, fps) {
  const sizeFactor = Math.ceil(fileSize / (1024 * 1024));
  const scaleFactor = parseInt(scale);
  const fpsFactor = fps === 'auto' ? 1 : (parseInt(fps) / 30);
  const estimatedSeconds = sizeFactor * 30 * Math.pow(scaleFactor, 1.5) * fpsFactor;
  return Math.min(estimatedSeconds, 3600);
}

async function refundCredit(userId) {
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

module.exports = new VideoController();
