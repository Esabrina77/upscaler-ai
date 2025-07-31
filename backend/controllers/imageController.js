// controllers/imageController.js - Modernisé avec nettoyage intelligent
const aiService = require('../services/aiService');
const JobService = require('../lib/jobService');
const UserService = require('../lib/userService');
const firebaseStorage = require('../services/firebaseStorageService');
const cleanupUtil = require('../utils/cleanupUtil');
const path = require('path');
const fs = require('fs').promises;

class ImageController {
  async uploadAndProcess(req, res) {
    let creditDeducted = false;
    let userId = null;
    let inputFirebasePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      userId = req.user?.id;
      const { scale = '2', model = 'waifu2x' } = req.body;
      
      // Validation paramètres AVANT traitement
      const validScales = ['2', '4', '8'];
      const validModels = ['real-esrgan', 'esrgan', 'waifu2x', 'srcnn'];
      
      if (!validScales.includes(scale)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: 'Scale invalide (2, 4, 8)' });
      }
      
      if (!validModels.includes(model)) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ error: 'Modèle invalide' });
      }

      // ✅ Vérifier quota Firebase AVANT upload
      const quotaCheck = await cleanupUtil.isCleanupNeeded();
      if (quotaCheck.urgent) {
        await fs.unlink(req.file.path);
        return res.status(507).json({ 
          error: 'Stockage saturé. Réessayez dans quelques minutes.' 
        });
      }

      // ✅ Estimer espace nécessaire et optimiser
      const estimatedSize = await aiService.estimateImageOutputSize(req.file.path, parseInt(scale));
      await cleanupUtil.optimizeBeforeProcessing(estimatedSize);

      // ✅ Upload input vers Firebase
      const inputFirebaseResult = await firebaseStorage.uploadFile(req.file.path, {
        folder: 'upscaler-img/input',
        originalName: req.file.originalname,
        makePublic: false,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userId: userId,
          type: 'input-image',
          size: req.file.size
        }
      });

      inputFirebasePath = inputFirebaseResult.firebasePath;
      console.log(`📤 Image uploadée Firebase: ${inputFirebasePath}`);

      // Décrémenter crédits APRÈS upload réussi
      if (userId) {
        const canProcess = await UserService.canProcessAndDecrement(userId);
        if (!canProcess) {
          await firebaseStorage.deleteFile(inputFirebasePath);
          return res.status(403).json({ 
            error: 'Crédits insuffisants. Passez au premium !' 
          });
        }
        creditDeducted = true;
      }

      // Créer job avec Firebase path
      const job = await JobService.createJob({
        userId,
        type: 'IMAGE',
        inputFile: inputFirebasePath,
        settings: { scale, model }
      });

      // Traitement selon taille fichier
      const fileSize = req.file.size;
      if (fileSize < 10 * 1024 * 1024) { // < 10MB = traitement immédiat
        try {
          const result = await this.processImageSync(job.id, inputFirebasePath, { scale, model });
          
          // ✅ Supprimer input immédiatement après traitement réussi
          await cleanupUtil.cleanupInputAfterProcessing(inputFirebasePath, job.id);
          
          // ✅ Programmer suppression output dans 1h
          if (result.outputPath) {
            cleanupUtil.scheduleOutputDeletion(result.outputPath, job.id);
          }
          
          return res.json(result);
          
        } catch (processError) {
          console.error('Erreur traitement:', processError);
          
          // Nettoyage en cas d'erreur
          await firebaseStorage.deleteFile(inputFirebasePath);
          if (creditDeducted && userId) {
            await this.refundCredit(userId);
          }
          
          return res.status(500).json({ 
            error: 'Erreur lors du traitement de l\'image'
          });
        }
      } else {
        // Queue pour gros fichiers
        const queueService = require('../services/queueService');
        await queueService.addImageJob(job.id, inputFirebasePath, { scale, model });
        
        return res.json({
          jobId: job.id,
          status: 'queued',
          message: 'Fichier en cours de traitement...',
          inputSize: Math.round(fileSize / (1024 * 1024)) + ' MB',
          estimatedTime: await aiService.estimateProcessingTime(req.file.path, { scale, model, type: 'image' })
        });
      }

    } catch (error) {
      console.error('Erreur upload image:', error);
      
      // Nettoyage complet en cas d'erreur
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
        error: 'Erreur lors du traitement',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // ✅ Traitement synchrone optimisé
  async processImageSync(jobId, inputFirebasePath, settings) {
    try {
      console.log(`🔄 Début traitement image job ${jobId}`);
      
      await JobService.updateStatus(jobId, 'PROCESSING', { progress: 5 });

      // Télécharger depuis Firebase vers temp local
      const tempDir = require('os').tmpdir();
      const localInputPath = path.join(tempDir, `input_${Date.now()}.jpg`);
      
      await firebaseStorage.downloadFile(inputFirebasePath, localInputPath);
      await JobService.updateStatus(jobId, 'PROCESSING', { progress: 20 });

      const startTime = Date.now();
      
      // Processing avec le service IA (retourne Firebase path)
      console.log(`📸 Traitement image avec ${settings.model} scale ${settings.scale}x`);
      const outputFirebasePath = await aiService.upscaleImage(localInputPath, settings);
      
      const processingTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`✅ Traitement terminé en ${processingTime}s`);

      // Nettoyage fichier local input
      try {
        await fs.unlink(localInputPath);
      } catch (error) {
        console.warn('Erreur suppression fichier local:', error.message);
      }

      // Mettre à jour job terminé
      await JobService.updateStatus(jobId, 'COMPLETED', {
        progress: 100,
        outputFile: outputFirebasePath,
        processingTime
      });

      return {
        jobId,
        status: 'COMPLETED',
        downloadUrl: `/api/images/download/${jobId}`,
        previewUrl: `/api/images/preview/${jobId}`,
        processingTime,
        outputPath: outputFirebasePath // Pour nettoyage programmé
      };

    } catch (error) {
      console.error('Erreur processing image:', error);
      
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
        response.downloadUrl = `/api/images/download/${jobId}`;
        response.previewUrl = `/api/images/preview/${jobId}`;
        response.processingTime = job.processingTime;
        response.completedAt = job.completedAt;
        
        // ✅ Vérifier si fichier encore disponible
        if (job.outputFile) {
          try {
            await firebaseStorage.getFileMetadata(job.outputFile);
            response.available = true;
          } catch {
            response.available = false;
            response.expiredMessage = 'Fichier expiré (1h de conservation)';
          }
        }
      } else if (job.status === 'FAILED') {
        response.errorMessage = job.errorMessage;
      }

      res.json(response);

    } catch (error) {
      console.error('Erreur get job status:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // ✅ Téléchargement avec vérification expiration
  async downloadResult(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Résultat non trouvé' });
      }

      try {
        // Vérifier que le fichier existe encore
        await firebaseStorage.getFileMetadata(job.outputFile);
        
        // Générer URL signée Firebase (24h)
        const signedUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 24);
        
        // Redirection vers l'URL Firebase
        res.redirect(signedUrl);
        console.log(`📥 Téléchargement image job ${jobId}`);
        
      } catch (fileError) {
        // Fichier expiré ou supprimé
        return res.status(410).json({ 
          error: 'Fichier expiré',
          message: 'Les fichiers sont conservés 1 heure après traitement'
        });
      }

    } catch (error) {
      console.error('Erreur download:', error);
      res.status(500).json({ error: 'Erreur téléchargement' });
    }
  }

  // ✅ Prévisualisation avec vérification
  async previewResult(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Image non trouvée' });
      }

      try {
        // Vérifier disponibilité
        const metadata = await firebaseStorage.getFileMetadata(job.outputFile);
        
        // URL signée pour prévisualisation (1h)
        const previewUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 1);
        
        res.json({
          previewUrl,
          jobId: job.id,
          settings: job.settings,
          processingTime: job.processingTime,
          fileInfo: {
            size: Math.round((metadata.size || 0) / (1024 * 1024) * 100) / 100 + ' MB',
            contentType: metadata.contentType,
            created: metadata.timeCreated
          }
        });
        
      } catch (fileError) {
        return res.status(410).json({ 
          error: 'Fichier expiré',
          message: 'Prévisualisation non disponible - fichier supprimé'
        });
      }

    } catch (error) {
      console.error('Erreur preview:', error);
      res.status(500).json({ error: 'Erreur prévisualisation' });
    }
  }

  // ✅ Analyse image uploadée
  async analyzeImage(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucune image fournie' });
      }

      const analysis = await aiService.analyzeMediaFile(req.file.path, 'image');
      
      // Supprimer fichier après analyse
      await fs.unlink(req.file.path);
      
      if (!analysis) {
        return res.status(400).json({ error: 'Impossible d\'analyser l\'image' });
      }

      // Ajouter recommandations
      const recommendations = this.getProcessingRecommendations(analysis);
      
      res.json({
        analysis,
        recommendations,
        supportedScales: this.getSupportedScales(analysis),
        estimatedTimes: await this.getEstimatedTimes(analysis)
      });

    } catch (error) {
      console.error('Erreur analyse image:', error);
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch {}
      }
      res.status(500).json({ error: 'Erreur analyse' });
    }
  }

  // Recommandations de traitement
  getProcessingRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.width > 2048 || analysis.height > 2048) {
      recommendations.push({
        type: 'WARNING',
        message: 'Image haute résolution - traitement plus long',
        suggestion: 'Utilisez scale 2x pour un résultat rapide'
      });
    }
    
    if (analysis.format === 'jpeg') {
      recommendations.push({
        type: 'INFO',
        message: 'Format JPEG détecté',
        suggestion: 'Real-ESRGAN recommandé pour les photos'
      });
    }
    
    if (analysis.hasAlpha) {
      recommendations.push({
        type: 'INFO',
        message: 'Transparence détectée',
        suggestion: 'Sortie en PNG pour conserver la transparence'
      });
    }
    
    return recommendations;
  }

  // Scales supportées selon résolution
  getSupportedScales(analysis) {
    const maxDimension = Math.max(analysis.width, analysis.height);
    
    if (maxDimension > 2048) return [2];
    if (maxDimension > 1024) return [2, 4];
    return [2, 4, 8];
  }

  // Temps estimés par modèle
  async getEstimatedTimes(analysis) {
    const sizeFactor = (analysis.width * analysis.height) / (1024 * 1024); // MPx
    
    return {
      'waifu2x': Math.ceil(sizeFactor * 10), // Rapide
      'real-esrgan': Math.ceil(sizeFactor * 30), // Moyen
      'esrgan': Math.ceil(sizeFactor * 20), // Moyen-rapide
      'srcnn': Math.ceil(sizeFactor * 15) // Rapide-moyen
    };
  }

  // Remboursement crédit
  async refundCredit(userId) {
    try {
      const user = await UserService.findById(userId);
      if (!user) return;

      if (user.plan === 'FREE') {
        await UserService.decrementDailyCredits(userId);
      } else {
        await UserService.incrementCredits(userId);
      }
      
      console.log(`💰 Crédit remboursé pour l'utilisateur ${userId}`);
    } catch (error) {
      console.error('Erreur remboursement crédit:', error);
    }
  }

  // ✅ Statistiques stockage pour l'utilisateur
  async getStorageStats(req, res) {
    try {
      const usage = await cleanupUtil.getFirebaseUsage();
      const recommendations = await cleanupUtil.getCleanupStats();
      
      res.json({
        firebase: {
          used: `${usage.totalSizeMB} MB`,
          total: `${cleanupUtil.maxFirebaseUsageGB * 1024} MB`,
          percentUsed: usage.percentUsed,
          files: usage.totalFiles
        },
        recommendations: recommendations?.recommendations || [],
        status: usage.percentUsed > 90 ? 'CRITICAL' : usage.percentUsed > 80 ? 'WARNING' : 'OK'
      });

    } catch (error) {
      console.error('Erreur stats stockage:', error);
      res.status(500).json({ error: 'Erreur récupération statistiques' });
    }
  }
}

module.exports = new ImageController();