// controllers/imageController.js - Logique upscaling images
const aiService = require('../services/aiService');
const storageService = require('../services/storageService');
const queueService = require('../services/queueService');
const JobService = require('../lib/jobService');
const UserService = require('../lib/userService');
const path = require('path');
const fs = require('fs').promises;

class ImageController {
  // Upload et traitement image
  async uploadAndProcess(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const userId = req.user?.id;
      const { scale = '2', model = 'real-esrgan' } = req.body;
      
      // Vérification crédits utilisateur avec Prisma
      if (userId) {
        const canProcess = await UserService.canProcessAndDecrement(userId);
        if (!canProcess) {
          await fs.unlink(req.file.path); // Nettoie le fichier
          return res.status(403).json({ 
            error: 'Crédits insuffisants. Passez au premium !' 
          });
        }
      }

      // Validation paramètres
      const validScales = ['2', '4', '8'];
      const validModels = ['real-esrgan', 'esrgan', 'waifu2x', 'srcnn'];
      
      if (!validScales.includes(scale)) {
        return res.status(400).json({ error: 'Scale invalide (2, 4, 8)' });
      }
      
      if (!validModels.includes(model)) {
        return res.status(400).json({ error: 'Modèle invalide' });
      }

      // Créer job avec Prisma
      const job = await JobService.createJob({
        userId,
        type: 'image',
        inputFile: req.file.path,
        settings: { scale, model }
      });

      // Traitement immédiat pour les petites images, sinon queue
      const fileSize = req.file.size;
      if (fileSize < 5 * 1024 * 1024) { // < 5MB = traitement immédiat
        const result = await this.processImageSync(job.id, req.file.path, { scale, model });
        return res.json(result);
      } else {
        // Ajouter à la queue pour gros fichiers
        await queueService.addImageJob(job.id, req.file.path, { scale, model });
        return res.json({
          jobId: job.id,
          status: 'queued',
          message: 'Fichier en cours de traitement...',
          estimatedTime: this.estimateProcessingTime(fileSize, scale)
        });
      }

    } catch (error) {
      console.error('Erreur upload image:', error);
      
      // Nettoie le fichier en cas d'erreur
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Erreur suppression fichier:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: 'Erreur lors du traitement',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Traitement synchrone pour petites images
  async processImageSync(jobId, inputPath, settings) {
    try {
      // Mise à jour status avec Prisma
      await JobService.updateStatus(jobId, 'processing', { progress: 10 });

      const startTime = Date.now();
      
      // Processing avec le service IA
      const outputPath = await aiService.upscaleImage(inputPath, settings);
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);

      // Mise à jour job terminé
      await JobService.updateStatus(jobId, 'completed', {
        progress: 100,
        outputFile: outputPath,
        processingTime
      });

      // Préparer URL de téléchargement
      const downloadUrl = `/api/images/download/${jobId}`;
      
      return {
        jobId,
        status: 'completed',
        downloadUrl,
        processingTime,
        originalSize: await this.getFileSize(inputPath),
        enhancedSize: await this.getFileSize(outputPath)
      };

    } catch (error) {
      console.error('Erreur processing sync:', error);
      
      await JobService.updateStatus(jobId, 'failed', {
        errorMessage: error.message
      });
      
      throw error;
    }
  }

  // Vérification statut job
  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await JobService.findById(jobId);
      if (!job) {
        return res.status(404).json({ error: 'Job non trouvé' });
      }

      let response = {
        jobId: job.id,
        status: job.status.toLowerCase(),
        progress: job.progress,
        createdAt: job.createdAt
      };

      if (job.status === 'COMPLETED') {
        response.downloadUrl = `/api/images/download/${jobId}`;
        response.processingTime = job.processingTime;
        response.completedAt = job.completedAt;
      } else if (job.status === 'FAILED') {
        response.error = job.errorMessage;
      }

      res.json(response);

    } catch (error) {
      console.error('Erreur get job status:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // Téléchargement résultat
  async downloadResult(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await JobService.findById(jobId);
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Résultat non trouvé' });
      }

      // Vérification existence fichier
      try {
        await fs.access(job.outputFile);
      } catch {
        return res.status(404).json({ error: 'Fichier non disponible' });
      }

      // Nom de fichier final
      const settings = job.settings || {};
      const scale = settings.scale || '2';
      const originalExt = path.extname(job.outputFile);
      const filename = `enhanced_${scale}x_${Date.now()}${originalExt}`;

      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Streaming du fichier
      const fileBuffer = await fs.readFile(job.outputFile);
      res.send(fileBuffer);

      // Programmer suppression du fichier après 1h
      setTimeout(async () => {
        try {
          await fs.unlink(job.outputFile);
          console.log(`🗑️ Fichier supprimé: ${job.outputFile}`);
        } catch (error) {
          console.error('Erreur suppression fichier:', error);
        }
      }, 60 * 60 * 1000);

    } catch (error) {
      console.error('Erreur download:', error);
      res.status(500).json({ error: 'Erreur téléchargement' });
    }
  }

  // Fonctions utilitaires
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return Math.round(stats.size / 1024); // en KB
    } catch {
      return 0;
    }
  }

  estimateProcessingTime(fileSize, scale) {
    // Estimation basique en secondes
    const sizeFactor = Math.ceil(fileSize / (1024 * 1024)); // MB
    const scaleFactor = parseInt(scale) / 2;
    return Math.min(sizeFactor * scaleFactor * 10, 300); // Max 5min
  }
}

module.exports = new ImageController();
