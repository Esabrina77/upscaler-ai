// routes/test.js - Route pour tester les outils IA
const express = require('express');
const aiService = require('../services/aiService');
const realEsrganUtil = require('../utils/realEsrganUtil');
const rifeUtil = require('../utils/rifeUtil');
const ffmpegUtil = require('../utils/ffmpegUtil');
const cleanupUtil = require('../utils/cleanupUtil');

const router = express.Router();

// Test santé de tous les outils
router.get('/health', async (req, res) => {
  try {
    const health = await aiService.healthCheck();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      tools: health,
      summary: {
        realEsrgan: health.tools.realEsrgan.localAvailable ? 'LOCAL' : 
                   health.tools.realEsrgan.replicateAvailable ? 'REPLICATE' : 'UNAVAILABLE',
        rife: health.tools.rife.available && health.tools.rife.hasModels ? 'AVAILABLE' : 'UNAVAILABLE',
        ffmpeg: health.tools.ffmpeg.available ? `v${health.tools.ffmpeg.version}` : 'UNAVAILABLE',
        firebase: health.storage.firebase ? 'CONNECTED' : 'DISCONNECTED'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Test Real-ESRGAN avec image de demo
router.post('/real-esrgan', async (req, res) => {
  try {
    const { scale = 2, model = 'RealESRGAN_x4plus' } = req.body;
    
    // Utiliser image de demo RIFE
    const demoImagePath = '../ai/ECCV2022-RIFE/demo/I0_0.png';
    
    const result = await realEsrganUtil.upscale(demoImagePath, { scale, model });
    
    res.json({
      success: true,
      message: 'Real-ESRGAN test réussi',
      outputPath: result,
      scale,
      model
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test RIFE avec vidéo de demo
router.post('/rife', async (req, res) => {
  try {
    const { fps = 60 } = req.body;
    
    // Créer une vidéo de test simple avec FFmpeg depuis les images demo
    const ffmpeg = require('child_process').spawn;
    const tempDir = require('os').tmpdir();
    const testVideo = require('path').join(tempDir, 'test_rife.mp4');
    
    // Créer vidéo courte depuis images demo
    const ffmpegProcess = ffmpeg('ffmpeg', [
      '-r', '1',
      '-i', '../ai/ECCV2022-RIFE/demo/I%d_0.png',
      '-vf', 'scale=256:256',
      '-t', '2',
      '-y',
      testVideo
    ]);
    
    ffmpegProcess.on('close', async (code) => {
      if (code === 0) {
        try {
          const result = await rifeUtil.interpolateVideo(testVideo, fps);
          res.json({
            success: true,
            message: 'RIFE test réussi',
            outputPath: result,
            fps
          });
        } catch (rifeError) {
          res.status(500).json({
            success: false,
            error: rifeError.message
          });
        }
      } else {
        res.status(500).json({
          success: false,
          error: 'Erreur création vidéo test'
        });
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test nettoyage Firebase
router.get('/cleanup', async (req, res) => {
  try {
    const stats = await cleanupUtil.getCleanupStats();
    
    res.json({
      success: true,
      storage: stats,
      recommendations: stats?.recommendations || []
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force nettoyage (admin)
router.post('/cleanup/force', async (req, res) => {
  try {
    const result = await cleanupUtil.emergencyCleanup();
    
    res.json({
      success: true,
      message: 'Nettoyage d\'urgence terminé',
      result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Modèles disponibles
router.get('/models', async (req, res) => {
  try {
    const models = aiService.getAvailableModels();
    
    res.json({
      success: true,
      models,
      tools: {
        realEsrgan: realEsrganUtil.getAvailableModels(),
        supported: {
          imageFormats: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'],
          videoFormats: ['mp4', 'avi', 'mov', 'wmv', 'webm'],
          scales: [2, 4, 8],
          fps: [24, 30, 60, 120]
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;