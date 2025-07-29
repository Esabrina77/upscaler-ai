
// ================================
// controllers/videoController.js - Logique upscaling vidéos
const aiService = require('../services/aiService');
const queueService = require('../services/queueService');
const JobService = require('../lib/jobService');
const UserService = require('../lib/userService');
const fs = require('fs').promises;

class VideoController {
  async uploadAndProcess(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier vidéo fourni' });
      }

      const userId = req.user?.id;
      const { 
        scale = '2', 
        fps = 'auto', 
        model = 'real-cugan',
        interpolation = 'false'
      } = req.body;

      // Vérification premium (vidéos = premium uniquement)
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
          error: 'Fonctionnalité premium. Passez au plan Pro !' 
        });
      }

      // Validation paramètres
      const validScales = ['2', '4'];
      const validModels = ['real-cugan', 'rife', 'basicvsr'];
      
      if (!validScales.includes(scale)) {
        return res.status(400).json({ error: 'Scale invalide pour vidéo (2, 4)' });
      }

      // Créer job vidéo avec Prisma
      const job = await JobService.createJob({
        userId,
        type: 'video',
        inputFile: req.file.path,
        settings: { 
          scale, 
          fps, 
          model, 
          interpolation: interpolation === 'true' 
        }
      });

      // Toujours en queue pour les vidéos (traitement lourd)
      await queueService.addVideoJob(job.id, req.file.path, { 
        scale, fps, model, interpolation: interpolation === 'true' 
      });

      res.json({
        jobId: job.id,
        status: 'queued',
        message: 'Vidéo ajoutée à la file de traitement',
        estimatedTime: this.estimateVideoProcessingTime(req.file.size, scale)
      });

    } catch (error) {
      console.error('Erreur upload vidéo:', error);
      
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

  estimateVideoProcessingTime(fileSize, scale) {
    // Estimation plus longue pour vidéos
    const sizeFactor = Math.ceil(fileSize / (1024 * 1024)); // MB
    const scaleFactor = parseInt(scale);
    return Math.min(sizeFactor * scaleFactor * 60, 1800); // Max 30min
  }

  // Réutilise les mêmes méthodes que ImageController pour status et download
  async getJobStatus(req, res) {
    return require('./imageController').getJobStatus(req, res);
  }

  async downloadResult(req, res) {
    return require('./imageController').downloadResult(req, res);
  }
}

module.exports = new VideoController();
