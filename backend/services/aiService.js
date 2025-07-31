// services/aiService.js - Service IA modernisé avec utils spécialisés
const realEsrganUtil = require('../utils/realEsrganUtil');
const rifeUtil = require('../utils/rifeUtil');
const ffmpegUtil = require('../utils/ffmpegUtil');
const cleanupUtil = require('../utils/cleanupUtil');
const firebaseStorage = require('./firebaseStorageService');
const sharp = require('sharp');
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
    
    // Vérifier disponibilité des outils (attendre les checks asynchrones)
    const [realEsrganHealth, rifeHealth, ffmpegHealth] = await Promise.all([
      realEsrganUtil.healthCheck(),
      rifeUtil.healthCheck(),
      ffmpegUtil.healthCheck()
    ]);

    this.availableTools = {
      realEsrgan: realEsrganHealth,
      rife: rifeHealth,
      ffmpeg: ffmpegHealth,
      sharp: true,
      firebase: !!firebaseStorage.bucket
    };

    console.log('🔧 Outils disponibles:', {
      'Real-ESRGAN': realEsrganHealth.localAvailable || realEsrganHealth.replicateAvailable,
      'RIFE': rifeHealth.available && rifeHealth.hasModels,
      'FFmpeg': ffmpegHealth.available,
      'Sharp': this.availableTools.sharp,
      'Firebase': this.availableTools.firebase
    });

    this.isInitialized = true;
  }

  // ✅ UPSCALING IMAGE avec utils spécialisés
  async upscaleImage(inputPath, settings) {
    const { scale = '2', model = 'waifu2x' } = settings;
    const scaleInt = parseInt(scale);
    
    console.log(`🎯 Upscaling image ${model} ${scale}x: ${inputPath}`);

    try {
      // Optimiser stockage avant traitement
      const estimatedOutputSize = await this.estimateImageOutputSize(inputPath, scaleInt);
      await cleanupUtil.optimizeBeforeProcessing(estimatedOutputSize);

      let processedImagePath;

      switch (model) {
        case 'real-esrgan':
          if (this.availableTools.realEsrgan.localAvailable || this.availableTools.realEsrgan.replicateAvailable) {
            processedImagePath = await realEsrganUtil.upscale(inputPath, { 
              scale: scaleInt,
              model: 'RealESRGAN_x4plus'
            });
          } else {
            throw new Error('Real-ESRGAN non disponible');
          }
          break;

        case 'esrgan':
          if (this.availableTools.realEsrgan.localAvailable || this.availableTools.realEsrgan.replicateAvailable) {
            processedImagePath = await realEsrganUtil.upscale(inputPath, { 
              scale: scaleInt,
              model: 'RealESRGAN_x2plus'
            });
          } else {
            processedImagePath = await this.useSharpUpscale(inputPath, scaleInt);
          }
          break;

        case 'waifu2x':
          processedImagePath = await this.useSharpUpscale(inputPath, scaleInt, 'anime');
          break;

        case 'srcnn':
          processedImagePath = await this.useSharpUpscale(inputPath, scaleInt, 'photo');
          break;

        default:
          throw new Error(`Modèle non supporté: ${model}`);
      }

      // Upload vers Firebase
      const firebaseResult = await firebaseStorage.uploadFile(processedImagePath, {
        folder: 'upscaler-img',
        originalName: `enhanced_${scale}x_${Date.now()}.png`,
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

  // ✅ UPSCALING VIDEO avec utils spécialisés
  async upscaleVideo(inputPath, settings) {
    const { scale = '2', fps = '60', model = 'real-cugan', interpolation = false } = settings;
    const scaleInt = parseInt(scale);
    
    console.log(`🎬 Upscaling vidéo ${model} ${scale}x fps ${fps}`);

    try {
      // Optimiser stockage (vidéos plus volumineuses)
      const estimatedOutputSize = await this.estimateVideoOutputSize(inputPath, scaleInt, fps);
      await cleanupUtil.optimizeBeforeProcessing(estimatedOutputSize);

      let processedVideoPath;

      switch (model) {
        case 'real-cugan':
          if (this.availableTools.ffmpeg.available) {
            // Upscaling + interpolation combiné avec FFmpeg
            processedVideoPath = await ffmpegUtil.upscaleVideo(inputPath, scaleInt, {
              fps: fps !== 'auto' ? fps : undefined,
              preset: 'medium',
              crf: 16,
              filters: interpolation ? [`minterpolate=fps=${fps}`] : []
            });
          } else {
            throw new Error('FFmpeg requis pour Real-CUGAN');
          }
          break;

        case 'rife':
          if (this.availableTools.rife.available) {
            if (interpolation && fps !== 'auto') {
              // RIFE avec upscaling et interpolation
              processedVideoPath = await rifeUtil.upscaleAndInterpolate(inputPath, scaleInt, parseInt(fps));
            } else {
              // RIFE interpolation seule
              processedVideoPath = await rifeUtil.interpolateVideo(inputPath, parseInt(fps));
            }
          } else {
            // Fallback FFmpeg
            processedVideoPath = await ffmpegUtil.upscaleVideo(inputPath, scaleInt, { fps });
          }
          break;

        case 'basicvsr':
          if (this.availableTools.ffmpeg.available) {
            processedVideoPath = await ffmpegUtil.upscaleVideo(inputPath, scaleInt, {
              fps,
              preset: 'slow',
              crf: 14,
              filters: ['eq=contrast=1.1:brightness=0.02:saturation=1.1']
            });
          } else {
            throw new Error('FFmpeg requis pour BasicVSR');
          }
          break;

        case 'ffmpeg':
        default:
          if (this.availableTools.ffmpeg.available) {
            processedVideoPath = await ffmpegUtil.upscaleVideo(inputPath, scaleInt, {
              fps: fps !== 'auto' ? fps : undefined,
              preset: 'medium',
              crf: 18
            });
          } else {
            throw new Error('FFmpeg non disponible');
          }
      }

      // Upload vers Firebase avec stream pour gros fichiers
      const firebaseResult = await firebaseStorage.uploadFileStream(processedVideoPath, {
        folder: 'upscaler-vid',
        originalName: `enhanced_video_${scale}x_${fps}fps_${Date.now()}.mp4`,
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

  // ✅ Upscaling Sharp optimisé
  async useSharpUpscale(inputPath, scale, type = 'general') {
    try {
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `sharp_${Date.now()}_${scale}x.png`);

      console.log(`🔧 Sharp upscale ${scale}x (${type})`);

      const metadata = await sharp(inputPath).metadata();
      const newWidth = Math.round(metadata.width * scale);
      const newHeight = Math.round(metadata.height * scale);

      let sharpPipeline = sharp(inputPath);

      // Optimisations selon le type
      switch (type) {
        case 'anime':
          // Optimisé pour dessins/anime
          sharpPipeline = sharpPipeline
            .resize(newWidth, newHeight, {
              kernel: 'cubic',
              fit: 'fill'
            })
            .sharpen({ sigma: 1, m1: 0.5, m2: 2 });
          break;

        case 'photo':
          // Optimisé pour photos
          sharpPipeline = sharpPipeline
            .resize(newWidth, newHeight, {
              kernel: 'lanczos3',
              fit: 'fill'
            })
            .modulate({ brightness: 1.02, saturation: 1.05 });
          break;

        default:
          // Général
          sharpPipeline = sharpPipeline
            .resize(newWidth, newHeight, {
              kernel: 'lanczos3',
              fit: 'fill'
            });
      }

      await sharpPipeline
        .png({ 
          quality: 100,
          compressionLevel: 0,
          progressive: true
        })
        .toFile(outputPath);

      console.log(`✅ Sharp terminé: ${newWidth}x${newHeight}`);
      return outputPath;

    } catch (error) {
      console.error('❌ Erreur Sharp:', error);
      throw new Error('Échec traitement Sharp');
    }
  }

  // ✅ Estimation taille output image
  async estimateImageOutputSize(inputPath, scale) {
    try {
      const stats = await fs.stat(inputPath);
      const inputSizeMB = stats.size / (1024 * 1024);
      
      // Facteur d'agrandissement non linéaire
      const scaleFactor = Math.pow(scale, 1.8);
      const compressionFactor = 0.7; // PNG compressé vs non compressé
      
      return Math.ceil(inputSizeMB * scaleFactor * compressionFactor);
    } catch {
      return scale * scale * 10; // 10MB par défaut
    }
  }

  // ✅ Estimation taille output vidéo
  async estimateVideoOutputSize(inputPath, scale, fps) {
    try {
      const stats = await fs.stat(inputPath);
      const inputSizeMB = stats.size / (1024 * 1024);
      
      const scaleFactor = Math.pow(scale, 1.5);
      const fpsFactor = fps === 'auto' ? 1 : (parseInt(fps) / 30);
      const compressionFactor = 0.8; // H264 efficace
      
      return Math.ceil(inputSizeMB * scaleFactor * fpsFactor * compressionFactor);
    } catch {
      return scale * 100; // 100MB par défaut
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

  // ✅ Estimer temps de traitement
  async estimateProcessingTime(filePath, settings) {
    const { scale, model, fps, type } = settings;
    
    try {
      if (type === 'image') {
        if (model === 'real-esrgan') {
          return await realEsrganUtil.estimateProcessingTime(filePath, parseInt(scale));
        } else {
          // Sharp très rapide
          const stats = await fs.stat(filePath);
          const sizeMB = stats.size / (1024 * 1024);
          return Math.ceil(sizeMB * parseInt(scale) * 2); // 2 secondes par MB*scale
        }
      } else {
        // Vidéo
        if (model === 'rife') {
          return await rifeUtil.estimateProcessingTime(filePath, parseInt(fps));
        } else {
          const stats = await fs.stat(filePath);
          const sizeMB = stats.size / (1024 * 1024);
          const scaleFactor = Math.pow(parseInt(scale), 1.5);
          return Math.ceil(sizeMB * scaleFactor * 10); // 10 secondes par MB*scale
        }
      }
    } catch {
      return type === 'image' ? 60 : 300; // Défaut: 1min image, 5min vidéo
    }
  }

  // ✅ Obtenir modèles disponibles
  getAvailableModels() {
    const models = {
      image: {},
      video: {}
    };

    // Modèles image
    if (this.availableTools.realEsrgan.localAvailable || this.availableTools.realEsrgan.replicateAvailable) {
      models.image['real-esrgan'] = {
        name: 'Real-ESRGAN',
        description: 'IA avancée, excellent pour photos',
        scales: [2, 4, 8],
        speed: 'Moyen',
        quality: 'Excellent'
      };
    }

    models.image['waifu2x'] = {
      name: 'Waifu2x (Sharp)',
      description: 'Optimisé dessins et anime',
      scales: [2, 4],
      speed: 'Rapide',
      quality: 'Bon'
    };

    models.image['srcnn'] = {
      name: 'SRCNN (Sharp)',
      description: 'Polyvalent, photos et dessins',
      scales: [2, 4],
      speed: 'Rapide',
      quality: 'Bon'
    };

    // Modèles vidéo
    if (this.availableTools.ffmpeg.available) {
      models.video['ffmpeg'] = {
        name: 'FFmpeg Enhanced',
        description: 'Filtres avancés, compatible tout format',
        scales: [2, 4],
        speed: 'Moyen',
        quality: 'Bon'
      };
    }

    if (this.availableTools.rife.available) {
      models.video['rife'] = {
        name: 'RIFE',
        description: 'Interpolation FPS fluide + upscaling',
        scales: [2, 4],
        speed: 'Lent',
        quality: 'Excellent'
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
      storage: {
        firebase: this.availableTools.firebase,
        usage: await cleanupUtil.getFirebaseUsage()
      }
    };
  }

  // ✅ Créer thumbnail vidéo
  async createVideoThumbnail(videoPath, timeSeconds = 5) {
    if (!this.availableTools.ffmpeg.available) {
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
      if (type === 'image') {
        const metadata = await sharp(filePath).metadata();
        return {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
          density: metadata.density,
          size: await this.getFileSize(filePath)
        };
      } else if (type === 'video' && this.availableTools.ffmpeg.available) {
        return await ffmpegUtil.getVideoInfo(filePath);
      }
      
      return null;
    } catch (error) {
      console.error('Erreur analyse média:', error);
      return null;
    }
  }
}

module.exports = new AIService();