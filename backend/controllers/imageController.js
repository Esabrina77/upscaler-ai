// controllers/imageController.js - Avec Firebase Storage uniquement
const aiService = require('../services/aiService');
const JobService = require('../lib/jobService');
const UserService = require('../lib/userService');
const firebaseStorage = require('../services/firebaseStorageService');
const path = require('path');
const fs = require('fs').promises;

class ImageController {
  async uploadAndProcess(req, res) {
    let creditDeducted = false;
    let userId = null;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      userId = req.user?.id;
      const { scale = '2', model = 'waifu2x' } = req.body;
      
      // Validation paramètres AVANT de décrémenter les crédits
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

      // ✅ Upload vers Firebase input d'abord
      const inputFirebaseResult = await firebaseStorage.uploadFile(req.file.path, {
        folder: 'upscaler-img/input',
        originalName: req.file.originalname,
        makePublic: false,
        metadata: {
          uploadedAt: new Date().toISOString(),
          userId: userId,
          type: 'input-image'
        }
      });

      console.log(`📤 Image uploadée vers Firebase: ${inputFirebaseResult.firebasePath}`);

      // Décrémenter crédits SEULEMENT après upload réussi
      if (userId) {
        const canProcess = await UserService.canProcessAndDecrement(userId);
        if (!canProcess) {
          // Supprimer de Firebase si pas de crédits
          await firebaseStorage.deleteFile(inputFirebaseResult.firebasePath);
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
        inputFile: inputFirebaseResult.firebasePath, // Firebase path
        settings: { scale, model }
      });

      // Traitement immédiat pour les petites images
      const fileSize = req.file.size;
      if (fileSize < 10 * 1024 * 1024) { // < 10MB
        try {
          const result = await processImageSync(job.id, inputFirebaseResult.firebasePath, { scale, model });
          return res.json(result);
        } catch (processError) {
          console.error('Erreur traitement:', processError);
          
          // Remboursement en cas d'erreur
          if (creditDeducted && userId) {
            await refundCredit(userId);
          }
          
          return res.status(500).json({ 
            error: 'Erreur lors du traitement de l\'image'
          });
        }
      } else {
        // Queue pour gros fichiers
        const queueService = require('../services/queueService');
        await queueService.addImageJob(job.id, inputFirebaseResult.firebasePath, { scale, model });
        return res.json({
          jobId: job.id,
          status: 'queued',
          message: 'Fichier en cours de traitement...',
          inputSize: Math.round(fileSize / (1024 * 1024)) + ' MB'
        });
      }

    } catch (error) {
      console.error('Erreur upload image:', error);
      
      // Remboursement en cas d'erreur générale
      if (creditDeducted && userId) {
        await refundCredit(userId);
      }
      
      // Nettoyage fichier local
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Erreur suppression fichier:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: 'Erreur lors du traitement'
      });
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
        response.processingTime = job.processingTime;
        response.completedAt = job.completedAt;
      } else if (job.status === 'FAILED') {
        response.errorMessage = job.errorMessage;
      }

      res.json(response);

    } catch (error) {
      console.error('Erreur get job status:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }

  // ✅ Téléchargement depuis Firebase
  async downloadResult(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Résultat non trouvé' });
      }

      // Générer URL signée Firebase
      const signedUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 24);
      
      // Redirection vers l'URL Firebase
      res.redirect(signedUrl);

      console.log(`📥 Téléchargement image job ${jobId}`);

    } catch (error) {
      console.error('Erreur download:', error);
      res.status(500).json({ error: 'Erreur téléchargement' });
    }
  }

  // ✅ Prévisualisation image
  async previewResult(req, res) {
    try {
      const { jobId } = req.params;
      
      const job = await JobService.findById(parseInt(jobId));
      if (!job || job.status !== 'COMPLETED' || !job.outputFile) {
        return res.status(404).json({ error: 'Image non trouvée' });
      }

      // URL signée pour prévisualisation (1h)
      const previewUrl = await firebaseStorage.generateSignedUrl(job.outputFile, 1);
      
      res.json({
        previewUrl,
        jobId: job.id,
        settings: job.settings,
        processingTime: job.processingTime
      });

    } catch (error) {
      console.error('Erreur preview:', error);
      res.status(500).json({ error: 'Erreur prévisualisation' });
    }
  }
}

// ✅ Traitement synchrone avec Firebase
async function processImageSync(jobId, inputFirebasePath, settings) {
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
      outputFile: outputFirebasePath, // Firebase path
      processingTime
    });

    return {
      jobId,
      status: 'COMPLETED',
      downloadUrl: `/api/images/download/${jobId}`,
      previewUrl: `/api/images/preview/${jobId}`,
      processingTime
    };

  } catch (error) {
    console.error('Erreur processing image:', error);
    
    await JobService.updateStatus(jobId, 'FAILED', {
      errorMessage: error.message
    });
    
    throw error;
  }
}

// Fonction de remboursement
async function refundCredit(userId) {
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

module.exports = new ImageController();