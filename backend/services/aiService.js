// services/aiService.js - Service IA corrigé avec VRAIS modèles uniquement
const realEsrganUtil = require('../utils/realEsrganUtil');
const rifeUtil = require('../utils/rifeUtil');
const ffmpegUtil = require('../utils/ffmpegUtil');
const cleanupUtil = require('../utils/cleanupUtil');
const firebaseStorage = require('./firebaseStorageService');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class AIService {
  constructor() {
    this.isInitialized = false;
    this.availableTools = {};
    
    // Délai pour permettre aux utils de s'initialiser
    setTimeout(() => this.init(), 2000);
  }

  async init() {
    console.log('🤖 Initialisation service IA...');
    
    // Vérifier disponibilité des outils RÉELS uniquement
    const [realEsrganHealth, rifeHealth, ffmpegHealth] = await Promise.all([
      realEsrganUtil.healthCheck(),
      rifeUtil.healthCheck(),
      ffmpegUtil.healthCheck()
    ]);

    this.availableTools = {
      realEsrgan: realEsrganHealth,
      rife: rifeHealth,
      ffmpeg: ffmpegHealth,
      firebase: !!firebaseStorage.bucket
    };

    console.log('🔧 Outils disponibles:', {
      'Real-ESRGAN': realEsrganHealth.localAvailable,
      'RIFE': rifeHealth.available && rifeHealth.hasModels,
      'FFmpeg': ffmpegHealth.available,
      'Firebase': this.availableTools.firebase
    });

    this.isInitialized = true;
  }

  // ✅ UPSCALING IMAGE - Modèles RÉELS uniquement
  async upscaleImage(inputPath, settings) {
    const { scale = '2', model = 'realesrgan-x4plus' } = settings;
    const scaleInt = parseInt(scale);
    
    console.log(`🎯 Upscaling image ${model} ${scale}x: ${inputPath}`);

    try {
      // Optimiser stockage avant traitement
      const estimatedOutputSize = await this.estimateImageOutputSize(inputPath, scaleInt);
      await cleanupUtil.optimizeBeforeProcessing(estimatedOutputSize);

      let processedImagePath;

      // VRAIS modèles Real-ESRGAN uniquement
      if (this.availableTools.realEsrgan.localAvailable) {
        processedImagePath = await realEsrganUtil.upscale(inputPath, { 
          scale: scaleInt,
          model: model // Utiliser le modèle exact demandé
        });
      } else {
        throw new Error('Real-ESRGAN non disponible. Aucun autre modèle d\'upscaling installé.');
      }

      // Upload vers Firebase
      const firebaseResult = await firebaseStorage.uploadFile(processedImagePath, {
        folder: 'upscaler-img',
        originalName: `enhanced_${model}_${scale}x_${Date.now()}.png`,
        makePublic: false,
        metadata: {
          model,
          scale: scaleInt,
          processedAt: new Date().toISOString(),
          type: 'processed-image',
          originalSize: await this.getFileSize(inputPath),
          processedSize: await this.getFileSize(processedImagePath)
        }
      });

      console.log(`✅ Image traitée: ${firebaseResult.firebasePath}`);
      return firebaseResult.firebasePath;

    } catch (error) {
      console.error('❌ Erreur upscaling image:', error);
      throw error;
    }
  }

  // ✅ UPSCALING VIDEO - Modèles RÉELS uniquement
  async upscaleVideo(inputPath, settings) {
    const { scale = '2', fps = '60', model = 'ffmpeg', interpolation = false } = settings;
    const scaleInt = parseInt(scale);
    
    console.log(`🎬 Upscaling vidéo ${model} ${scale}x fps ${fps}`);

    try {
      // Optimiser stockage (vidéos plus volumineuses)
      const estimatedOutputSize = await this.estimateVideoOutputSize(inputPath, scaleInt, fps);
      await cleanupUtil.optimizeBeforeProcessing(estimatedOutputSize);

      let processedVideoPath;

      switch (model) {
        case 'rife':
          // RIFE pour interpolation FPS + upscaling
          if (this.availableTools.rife.available && this.availableTools.rife.hasModels) {
            if (interpolation && fps !== 'auto') {
              // RIFE avec upscaling et interpolation
              processedVideoPath = await rifeUtil.upscaleAndInterpolate(inputPath, scaleInt, parseInt(fps));
            } else {
              // RIFE interpolation seule puis FFmpeg pour upscaling
              const interpolatedPath = await rifeUtil.interpolateVideo(inputPath, parseInt(fps));
              processedVideoPath = await ffmpegUtil.upscaleVideo(interpolatedPath, scaleInt, {
                preset: 'medium',
                crf: 18
              });
            }
          } else {
            throw new Error('RIFE non disponible - modèles manquants dans train_log/');
          }
          break;

        case 'ffmpeg':
        default:
          // FFmpeg pour upscaling basique + interpolation optionnelle
          if (this.availableTools.ffmpeg.available) {
            const options = {
              fps: fps !== 'auto' ? fps : undefined,
              preset: 'medium',
              crf: 18
            };
            
            // Ajouter interpolation si demandée
            if (interpolation && fps !== 'auto') {
              options.filters = [`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc`];
            }
            
            processedVideoPath = await ffmpegUtil.upscaleVideo(inputPath, scaleInt, options);
          } else {
            throw new Error('FFmpeg non disponible');
          }
          break;
      }

      // Upload vers Firebase avec stream pour gros fichiers
      const firebaseResult = await firebaseStorage.uploadFileStream(processedVideoPath, {
        folder: 'upscaler-vid',
        originalName: `enhanced_${model}_${scale}x_${fps}fps_${Date.now()}.mp4`,
        makePublic: false,
        metadata: {
          model,
          scale: scaleInt,
          fps,
          interpolation,
          processedAt: new Date().toISOString(),
          type: 'processed-video',
          originalSize: await this.getFileSize(inputPath),
          processedSize: await this.getFileSize(processedVideoPath)
        }
      });

      console.log(`✅ Vidéo traitée: ${firebaseResult.firebasePath}`);
      return firebaseResult.firebasePath;

    } catch (error) {
      console.error('❌ Erreur upscaling vidéo:', error);
      throw error;
    }
  }

  // ✅ Estimation taille output image
  async estimateImageOutputSize(inputPath, scale) {
    try {
      const stats = await fs.stat(inputPath);
      const inputSizeMB = stats.size / (1024 * 1024);
      
      // Facteur d'agrandissement réaliste pour Real-ESRGAN
      const scaleFactor = Math.pow(scale, 1.6); // Real-ESRGAN optimisé
      const compressionFactor = 0.8; // PNG bien compressé
      
      return Math.ceil(inputSizeMB * scaleFactor * compressionFactor);
    } catch {
      return scale * scale * 8; // 8MB par défaut plus réaliste
    }
  }

  // ✅ Estimation taille output vidéo
  async estimateVideoOutputSize(inputPath, scale, fps) {
    try {
      const stats = await fs.stat(inputPath);
      const inputSizeMB = stats.size / (1024 * 1024);
      
      const scaleFactor = Math.pow(scale, 1.4); // Facteur vidéo réaliste
      const fpsFactor = fps === 'auto' ? 1 : Math.min(parseInt(fps) / 30, 2); // Plafonner à 2x
      const compressionFactor = 0.75; // H264 très efficace
      
      return Math.ceil(inputSizeMB * scaleFactor * fpsFactor * compressionFactor);
    } catch {
      return scale * 80; // 80MB par défaut plus réaliste
    }
  }

  // ✅ Obtenir taille fichier
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return Math.round(stats.size / (1024 * 1024) * 100) / 100; // MB avec 2 décimales
    } catch {
      return 0;
    }
  }

  // ✅ Estimer temps de traitement RÉALISTE
  async estimateProcessingTime(filePath, settings) {
    const { scale, model, fps, type } = settings;
    
    try {
      const stats = await fs.stat(filePath);
      const sizeMB = stats.size / (1024 * 1024);
      const scaleInt = parseInt(scale);
      
      if (type === 'image') {
        // Real-ESRGAN uniquement
        if (model.includes('realesrgan')) {
          // Basé sur tests réels: ~20-40 secondes pour 1MB en 4x
          const baseTime = model.includes('anime') ? 15 : 25; // Anime plus rapide
          return Math.ceil(sizeMB * baseTime * Math.pow(scaleInt / 4, 1.2));
        }
        return Math.ceil(sizeMB * scaleInt * 5); // Fallback
        
      } else {
        // Vidéo avec RIFE ou FFmpeg
        const durationEstimate = sizeMB / 10; // ~10MB par minute de vidéo
        
        if (model === 'rife') {
          // RIFE très lent mais haute qualité
          return Math.ceil(durationEstimate * scaleInt * 180); // 3 minutes par minute source
        } else {
          // FFmpeg plus rapide
          const fpsFactor = fps !== 'auto' && parseInt(fps) > 30 ? 1.5 : 1;
          return Math.ceil(durationEstimate * scaleInt * 60 * fpsFactor); // 1 minute par minute source
        }
      }
    } catch {
      return type === 'image' ? 120 : 600; // Défaut conservateur: 2min image, 10min vidéo
    }
  }

  // ✅ Obtenir modèles RÉELS disponibles
  getAvailableModels() {
    const models = {
      image: {},
      video: {}
    };

    // Modèles image Real-ESRGAN
    if (this.availableTools.realEsrgan?.localAvailable) {
      models.image['realesrgan-x4plus'] = {
        name: 'Real-ESRGAN x4+',
        description: 'Modèle général haute qualité pour photos',
        scales: [2, 4],
        speed: 'Moyen (2-5 min)',
        quality: 'Excellent',
        type: 'general'
      };

      models.image['realesrgan-x4plus-anime'] = {
        name: 'Real-ESRGAN Anime',
        description: 'Optimisé pour dessins, anime et illustrations',
        scales: [2, 4],
        speed: 'Rapide (1-3 min)',
        quality: 'Excellent',
        type: 'anime'
      };
    }

    // Modèles vidéo
    if (this.availableTools.ffmpeg?.available) {
      models.video['ffmpeg'] = {
        name: 'FFmpeg Enhanced',
        description: 'Upscaling rapide avec filtres avancés',
        scales: [2, 4],
        speed: 'Rapide (1:1 ratio)',
        quality: 'Bon',
        interpolation: true
      };
    }

    if (this.availableTools.rife?.available && this.availableTools.rife?.hasModels) {
      models.video['rife'] = {
        name: 'RIFE AI',
        description: 'Interpolation FPS IA ultra-fluide + upscaling',
        scales: [2, 4],
        speed: 'Lent (3:1 ratio)',
        quality: 'Exceptionnel',
        interpolation: true,
        premium: true
      };
    }

    return models;
  }

  // ✅ Test santé du service
  async healthCheck() {
    return {
      initialized: this.isInitialized,
      tools: this.availableTools,
      models: this.getAvailableModels(),
      realEsrganModels: this.availableTools.realEsrgan?.localAvailable ? 
        await this.getRealEsrganAvailableModels() : [],
      rifeModels: this.availableTools.rife?.hasModels ? 
        await this.getRifeAvailableModels() : [],
      storage: {
        firebase: this.availableTools.firebase,
        usage: await cleanupUtil.getFirebaseUsage()
      }
    };
  }

  // ✅ Vérifier modèles Real-ESRGAN disponibles
  async getRealEsrganAvailableModels() {
    try {
      const modelsPath = process.platform === 'win32' 
        ? '../ai/Real-ESRGAN-windows/models'
        : '../ai/Real-ESRGAN-ubuntu/models';
      
      const files = await fs.readdir(modelsPath);
      const models = [];
      
      // Vérifier présence des fichiers .bin et .param
      if (files.includes('realesrgan-x4plus.bin') && files.includes('realesrgan-x4plus.param')) {
        models.push('realesrgan-x4plus');
      }
      
      if (files.includes('realesrgan-x4plus-anime.bin') && files.includes('realesrgan-x4plus-anime.param')) {
        models.push('realesrgan-x4plus-anime');
      }
      
      // Modèles vidéo anime
      if (files.includes('realesr-animevideov3-x4.bin')) {
        models.push('realesr-animevideov3-x4');
      }
      
      return models;
    } catch {
      return [];
    }
  }

  // ✅ Vérifier modèles RIFE disponibles
  async getRifeAvailableModels() {
    try {
      const rifePath = '../ai/ECCV2022-RIFE/train_log';
      const files = await fs.readdir(rifePath);
      
      const models = [];
      
      if (files.includes('flownet.pkl')) {
        models.push('flownet');
      }
      
      if (files.includes('RIFE_HDv3.py')) {
        models.push('RIFE_HDv3');
      }
      
      if (files.includes('IFNet_HDv3.py')) {
        models.push('IFNet_HDv3');
      }
      
      return models;
    } catch {
      return [];
    }
  }

  // ✅ Créer thumbnail vidéo
  async createVideoThumbnail(videoPath, timeSeconds = 5) {
    if (!this.availableTools.ffmpeg?.available) {
      throw new Error('FFmpeg requis pour thumbnail');
    }

    try {
      const tempDir = os.tmpdir();
      const thumbnailPath = path.join(tempDir, `thumb_${Date.now()}.jpg`);
      
      await ffmpegUtil.createThumbnail(videoPath, thumbnailPath, {
        time: `00:00:${timeSeconds.toString().padStart(2, '0')}`,
        width: 320,
        height: 240
      });

      return thumbnailPath;
    } catch (error) {
      console.error('Erreur création thumbnail:', error);
      throw error;
    }
  }

  // ✅ Analyser fichier média
  async analyzeMediaFile(filePath, type) {
    try {
      if (type === 'video' && this.availableTools.ffmpeg?.available) {
        return await ffmpegUtil.getVideoInfo(filePath);
      }
      
      // Pour les images, utiliser analyse basique
      if (type === 'image') {
        const stats = await fs.stat(filePath);
        return {
          size: stats.size,
          format: path.extname(filePath).toLowerCase().substring(1),
          // Dimensions seront détectées par Real-ESRGAN
          width: null,
          height: null
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erreur analyse média:', error);
      return null;
    }
  }

  // ✅ Valider compatibilité modèle/paramètres
  validateModelSettings(type, model, scale, fps = null) {
    const errors = [];
    
    if (type === 'image') {
      // Vérifier modèles Real-ESRGAN
      const validImageModels = ['realesrgan-x4plus', 'realesrgan-x4plus-anime'];
      if (!validImageModels.includes(model)) {
        errors.push(`Modèle image invalide: ${model}. Modèles disponibles: ${validImageModels.join(', ')}`);
      }
      
      // Real-ESRGAN supporte 2x et 4x principalement
      if (![2, 4].includes(parseInt(scale))) {
        errors.push(`Scale non optimale pour Real-ESRGAN: ${scale}. Recommandé: 2 ou 4`);
      }
      
    } else if (type === 'video') {
      const validVideoModels = ['ffmpeg', 'rife'];
      if (!validVideoModels.includes(model)) {
        errors.push(`Modèle vidéo invalide: ${model}. Modèles disponibles: ${validVideoModels.join(', ')}`);
      }
      
      if (model === 'rife' && !this.availableTools.rife?.hasModels) {
        errors.push('RIFE non disponible - modèles manquants dans train_log/');
      }
      
      if (fps && ![24, 30, 60, 120].includes(parseInt(fps))) {
        errors.push(`FPS non standard: ${fps}. Recommandé: 24, 30, 60 ou 120`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new AIService();