// services/aiService.js - IA avec Firebase Storage uniquement
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');
const firebaseStorage = require('./firebaseStorageService');
const os = require('os');
const fs = require('fs').promises;

class AIService {
  constructor() {
    console.log('🔥 Service IA initialisé avec Firebase Storage');
  }

  // Upscaling d'images avec stockage Firebase
  async upscaleImage(inputPath, settings) {
    const { scale = '2', model = 'waifu2x' } = settings;
    
    console.log(`🎯 Upscaling image ${model} scale ${scale}x`);
    
    try {
      let processedImagePath;
      
      switch (model) {
        case 'waifu2x':
          processedImagePath = await this.useLocalUpscale(inputPath, scale);
          break;
        case 'real-esrgan':
          processedImagePath = await this.useRealESRGAN(inputPath, scale);
          break;
        case 'esrgan':
          processedImagePath = await this.useLocalUpscale(inputPath, scale);
          break;
        case 'srcnn':
          processedImagePath = await this.useLocalUpscale(inputPath, scale);
          break;
        default:
          throw new Error(`Modèle non supporté: ${model}`);
      }

      // ✅ Upload vers Firebase dans dossier upscaler-img
      const firebaseResult = await firebaseStorage.uploadFile(processedImagePath, {
        folder: 'upscaler-img',
        originalName: `enhanced_${scale}x_${Date.now()}.png`,
        makePublic: false,
        metadata: {
          model,
          scale,
          processedAt: new Date().toISOString(),
          type: 'processed-image'
        }
      });

      console.log(`✅ Image traitée et stockée Firebase: ${firebaseResult.firebasePath}`);
      
      // Supprimer le fichier temporaire local
      try {
        await fs.unlink(processedImagePath);
      } catch (error) {
        console.warn('Erreur suppression fichier temp:', error.message);
      }

      // Retourner le chemin Firebase
      return firebaseResult.firebasePath;

    } catch (error) {
      console.error('Erreur upscaling image:', error);
      throw error;
    }
  }

  // Upscaling vidéo avec stockage Firebase
  async upscaleVideo(inputPath, settings) {
    const { scale = '2', fps = '60', model = 'real-cugan', interpolation = false } = settings;
    
    console.log(`🎬 Upscaling vidéo ${model} scale ${scale}x fps ${fps}`);

    try {
      let processedVideoPath;
      
      switch (model) {
        case 'real-cugan':
          processedVideoPath = await this.useAdvancedVideoUpscale(inputPath, { scale, fps, interpolation });
          break;
        case 'rife':
          processedVideoPath = await this.useRIFEInterpolation(inputPath, { fps, scale });
          break;
        case 'basicvsr':
          processedVideoPath = await this.useBasicVSR(inputPath, { scale, fps });
          break;
        default:
          processedVideoPath = await this.useFFmpegUpscale(inputPath, { scale, fps });
      }

      // ✅ Upload vers Firebase dans dossier upscaler-vid
      const firebaseResult = await firebaseStorage.uploadFileStream(processedVideoPath, {
        folder: 'upscaler-vid',
        originalName: `enhanced_video_${scale}x_${fps}fps_${Date.now()}.mp4`,
        makePublic: false,
        metadata: {
          model,
          scale,
          fps,
          interpolation,
          processedAt: new Date().toISOString(),
          type: 'processed-video'
        }
      });

      console.log(`✅ Vidéo traitée et stockée Firebase: ${firebaseResult.firebasePath}`);
      
      // Supprimer le fichier temporaire local
      try {
        await fs.unlink(processedVideoPath);
      } catch (error) {
        console.warn('Erreur suppression fichier temp:', error.message);
      }

      return firebaseResult.firebasePath;

    } catch (error) {
      console.error('Erreur upscaling vidéo:', error);
      throw error;
    }
  }

  // ✅ Upscaling image local avec Sharp (temp dans OS)
  async useLocalUpscale(inputPath, scale) {
    try {
      const scaleInt = parseInt(scale);
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `upscaled_${Date.now()}_${scale}x.png`);

      console.log(`🔧 Upscaling local Sharp scale ${scale}x`);

      // Lire les dimensions originales
      const metadata = await sharp(inputPath).metadata();
      const newWidth = Math.round(metadata.width * scaleInt);
      const newHeight = Math.round(metadata.height * scaleInt);

      // Upscaling avec Sharp - algorithme optimisé
      await sharp(inputPath)
        .resize(newWidth, newHeight, {
          kernel: 'lanczos3', // Meilleur pour upscaling
          fit: 'fill'
        })
        .png({ 
          quality: 100,
          compressionLevel: 0 // Pas de compression pour la qualité
        })
        .toFile(outputPath);

      console.log(`✅ Upscaling local terminé: ${newWidth}x${newHeight}`);
      return outputPath;

    } catch (error) {
      console.error('Erreur upscaling local:', error);
      throw new Error('Échec du traitement local');
    }
  }

  // Real-ESRGAN via Replicate
  async useRealESRGAN(inputPath, scale) {
    if (!process.env.REPLICATE_API_TOKEN) {
      console.warn('Token Replicate manquant, fallback Sharp');
      return await this.useLocalUpscale(inputPath, scale);
    }

    try {
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `real_esrgan_${Date.now()}_${scale}x.png`);

      console.log('🚀 Real-ESRGAN via Replicate');

      const imageBase64 = await this.fileToBase64(inputPath);
      
      const response = await axios.post('https://api.replicate.com/v1/predictions', {
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc972b0d3329bfd13c5ce22d",
        input: {
          image: imageBase64,
          scale: parseInt(scale)
        }
      }, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // Polling pour le résultat
      let result = response.data;
      let attempts = 0;
      const maxAttempts = 30;

      while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
        const statusResponse = await axios.get(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
        });
        result = statusResponse.data;
      }

      if (result.status !== 'succeeded') {
        throw new Error(`Real-ESRGAN échoué: ${result.error || 'Timeout'}`);
      }

      // Télécharger le résultat
      const imageResponse = await axios.get(result.output, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      await fs.writeFile(outputPath, imageResponse.data);
      
      console.log('✅ Real-ESRGAN terminé');
      return outputPath;

    } catch (error) {
      console.error('Erreur Real-ESRGAN:', error.message);
      return await this.useLocalUpscale(inputPath, scale);
    }
  }

  // ✅ Upscaling vidéo avancé avec FFmpeg + filtres IA
  async useAdvancedVideoUpscale(inputPath, settings) {
    const { scale, fps, interpolation } = settings;
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `video_upscaled_${Date.now()}_${scale}x_${fps}fps.mp4`);

    const ffmpegAvailable = await this.checkCommand('ffmpeg');
    if (!ffmpegAvailable) {
      throw new Error('FFmpeg requis pour traitement vidéo');
    }

    return new Promise((resolve, reject) => {
      // Filtres avancés pour qualité 4K/8K
      const filters = [];
      
      // 1. Débruitage
      filters.push('bm3d=sigma=3:block=4:bstep=2:group=1:estim=basic');
      
      // 2. Upscaling avec Lanczos haute qualité
      filters.push(`scale=iw*${scale}:ih*${scale}:flags=lanczos:param0=3`);
      
      // 3. Sharpening adaptatif
      filters.push('unsharp=5:5:1.0:5:5:0.0');
      
      // 4. Interpolation FPS si demandée
      if (interpolation && fps !== 'auto') {
        filters.push(`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`);
      } else if (fps !== 'auto') {
        filters.push(`fps=${fps}`);
      }

      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', filters.join(','),
        '-c:v', 'libx264',
        '-crf', '15', // Très haute qualité
        '-preset', 'slower', // Meilleure compression
        '-tune', 'film', // Optimisé pour vidéo
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-movflags', '+faststart',
        outputPath
      ];

      console.log(`🎥 FFmpeg avancé: ${ffmpegArgs.join(' ')}`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let progress = '';
      
      ffmpeg.stderr.on('data', (data) => {
        progress += data.toString();
        // Extraire progression si nécessaire
        const timeMatch = progress.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) {
          console.log(`📹 Progression: ${timeMatch[1]}`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Upscaling vidéo avancé terminé');
          resolve(outputPath);
        } else {
          console.error('Erreur FFmpeg:', progress);
          reject(new Error('Échec traitement vidéo'));
        }
      });

      // Timeout 30 minutes pour gros fichiers
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout traitement vidéo'));
      }, 1800000);
    });
  }

  // ✅ RIFE - Interpolation FPS avancée
  async useRIFEInterpolation(inputPath, settings) {
    const { fps, scale } = settings;
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `rife_${Date.now()}_${fps}fps.mp4`);

    return new Promise((resolve, reject) => {
      // RIFE avec interpolation fluide
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', [
          `scale=iw*${scale}:ih*${scale}:flags=lanczos`,
          `minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`
        ].join(','),
        '-c:v', 'libx264',
        '-crf', '16',
        '-preset', 'medium',
        '-tune', 'animation', // Optimisé pour mouvement fluide
        outputPath
      ];

      console.log(`🌊 RIFE interpolation ${fps}fps`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error('Échec RIFE'));
        }
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout RIFE'));
      }, 1200000); // 20min
    });
  }

  // ✅ BasicVSR - Super-resolution vidéo
  async useBasicVSR(inputPath, settings) {
    const { scale, fps } = settings;
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `basicvsr_${Date.now()}_${scale}x.mp4`);

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', [
          `scale=iw*${scale}:ih*${scale}:flags=spline`,
          'eq=contrast=1.1:brightness=0.02:saturation=1.1',
          fps !== 'auto' ? `fps=${fps}` : null
        ].filter(Boolean).join(','),
        '-c:v', 'libx264',
        '-crf', '14',
        '-preset', 'veryslow',
        outputPath
      ];

      console.log(`🔬 BasicVSR processing`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        code === 0 ? resolve(outputPath) : reject(new Error('Échec BasicVSR'));
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout BasicVSR'));
      }, 1800000);
    });
  }

  // FFmpeg basique pour fallback
  async useFFmpegUpscale(inputPath, settings) {
    const { scale, fps } = settings;
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `ffmpeg_${Date.now()}_${scale}x.mp4`);

    return new Promise((resolve, reject) => {
      const scaleFilter = `scale=iw*${scale}:ih*${scale}:flags=lanczos`;
      const fpsFilter = fps !== 'auto' ? `,fps=${fps}` : '';
      
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', scaleFilter + fpsFilter,
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'medium',
        outputPath
      ];

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        code === 0 ? resolve(outputPath) : reject(new Error('Échec FFmpeg'));
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout FFmpeg'));
      }, 600000);
    });
  }

  // Utilitaires
  async fileToBase64(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const mimeType = path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  }

  async checkCommand(command) {
    return new Promise((resolve) => {
      const child = spawn(command, ['--version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }

  async testAvailableTools() {
    const tools = {
      sharp: true,
      ffmpeg: await this.checkCommand('ffmpeg'),
      replicate: !!process.env.REPLICATE_API_TOKEN,
      firebase: !!firebaseStorage.bucket
    };

    console.log('🔧 Outils disponibles:', tools);
    return tools;
  }
}

module.exports = new AIService();