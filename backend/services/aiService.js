// ================================
// services/aiService.js - Interface avec les APIs d'IA + Firebase Storage
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const firebaseStorage = require('./firebaseStorageService');

class AIService {
  constructor() {
    this.tempDir = path.join(__dirname, '../temp');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  // Upscaling d'images avec différents modèles
  async upscaleImage(inputPath, settings) {
    const { scale = '2', model = 'real-esrgan' } = settings;
    
    try {
      let outputPath;
      
      switch (model) {
        case 'waifu2x':
          outputPath = await this.useWaifu2x(inputPath, scale);
          break;
        case 'real-esrgan':
          outputPath = await this.useRealESRGAN(inputPath, scale);
          break;
        case 'esrgan':
          outputPath = await this.useESRGAN(inputPath, scale);
          break;
        case 'srcnn':
          outputPath = await this.useSRCNN(inputPath, scale);
          break;
        default:
          throw new Error(`Modèle non supporté: ${model}`);
      }

      // Upload vers Firebase Storage
      const firebaseResult = await firebaseStorage.uploadFile(outputPath, {
        folder: 'processed/images',
        originalName: `enhanced_${scale}x_${Date.now()}.png`,
        makePublic: false,
        metadata: {
          model,
          scale,
          processedAt: new Date().toISOString()
        }
      });

      console.log(`✅ Image traitée et stockée: ${firebaseResult.firebasePath}`);
      
      // Retourner le chemin Firebase au lieu du chemin local
      return firebaseResult.firebasePath;

    } catch (error) {
      console.error('Erreur upscaling image:', error);
      throw error;
    }
  }

  // Waifu2x - API gratuite (le plus simple à implémenter)
  async useWaifu2x(inputPath, scale) {
    try {
      const formData = new FormData();
      formData.append('image', fs.createReadStream(inputPath));
      formData.append('scale', scale);
      formData.append('noise', '1'); // Réduction de bruit

      const response = await axios.post('https://api.waifu2x.cc/api', formData, {
        headers: {
          ...formData.getHeaders(),
        },
        responseType: 'arraybuffer',
        timeout: 120000 // 2 minutes timeout
      });

      if (response.status !== 200) {
        throw new Error('Erreur API Waifu2x');
      }

      // Sauvegarder temporairement
      const tempFilename = `waifu2x_${Date.now()}_${scale}x.png`;
      const tempPath = path.join(this.tempDir, tempFilename);
      
      await fs.promises.writeFile(tempPath, response.data);
      
      return tempPath;

    } catch (error) {
      console.error('Erreur Waifu2x:', error.message);
      throw new Error('Échec du traitement Waifu2x');
    }
  }

  // Real-ESRGAN via Replicate API
  async useRealESRGAN(inputPath, scale) {
    try {
      if (!process.env.REPLICATE_API_TOKEN) {
        console.warn('Token Replicate manquant, fallback vers Waifu2x');
        return await this.useWaifu2x(inputPath, scale);
      }

      const response = await axios.post('https://api.replicate.com/v1/predictions', {
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc972b0d3329bfd13c5ce22d",
        input: {
          image: await this.fileToBase64(inputPath),
          scale: parseInt(scale)
        }
      }, {
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 minutes
      });

      // Polling pour attendre le résultat
      let result = response.data;
      let attempts = 0;
      const maxAttempts = 60; // 2 minutes max

      while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre 2s
        attempts++;
        
        const statusResponse = await axios.get(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: {
            'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`
          }
        });
        result = statusResponse.data;
      }

      if (result.status !== 'succeeded') {
        throw new Error(`Real-ESRGAN échoué: ${result.error || 'Timeout'}`);
      }

      // Télécharger le résultat
      const imageResponse = await axios.get(result.output, {
        responseType: 'arraybuffer'
      });

      const tempFilename = `real_esrgan_${Date.now()}_${scale}x.png`;
      const tempPath = path.join(this.tempDir, tempFilename);
      
      await fs.promises.writeFile(tempPath, imageResponse.data);
      
      return tempPath;

    } catch (error) {
      console.error('Erreur Real-ESRGAN:', error.message);
      // Fallback vers Waifu2x si Real-ESRGAN échoue
      return await this.useWaifu2x(inputPath, scale);
    }
  }

  // ESRGAN - Version locale simplifiée (si Python installé)
  async useESRGAN(inputPath, scale) {
    try {
      // Vérifier si le script Python ESRGAN existe
      const scriptPath = path.join(__dirname, '../python/esrgan_simple.py');
      
      if (!fs.existsSync(scriptPath)) {
        console.warn('Script ESRGAN non trouvé, fallback vers Waifu2x');
        return await this.useWaifu2x(inputPath, scale);
      }

      const tempFilename = `esrgan_${Date.now()}_${scale}x.png`;
      const tempPath = path.join(this.tempDir, tempFilename);

      return new Promise((resolve, reject) => {
        const python = spawn('python3', [scriptPath, inputPath, tempPath, scale]);
        
        let errorOutput = '';
        
        python.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        python.on('close', (code) => {
          if (code === 0 && fs.existsSync(tempPath)) {
            resolve(tempPath);
          } else {
            console.error('Erreur ESRGAN:', errorOutput);
            // Fallback vers Waifu2x
            this.useWaifu2x(inputPath, scale).then(resolve).catch(reject);
          }
        });

        // Timeout après 5 minutes
        setTimeout(() => {
          python.kill();
          reject(new Error('Timeout ESRGAN'));
        }, 300000);
      });

    } catch (error) {
      console.error('Erreur ESRGAN:', error.message);
      return await this.useWaifu2x(inputPath, scale);
    }
  }

  // SRCNN - Implémentation basique
  async useSRCNN(inputPath, scale) {
    // Pour l'instant, utilise Waifu2x comme fallback
    console.log('SRCNN non implémenté, utilisation de Waifu2x');
    return await this.useWaifu2x(inputPath, scale);
  }

  // Upscaling vidéo avec différents modèles
  async upscaleVideo(inputPath, settings) {
    const { scale = '2', model = 'real-cugan', fps, interpolation } = settings;
    
    try {
      let outputPath;
      
      switch (model) {
        case 'real-cugan':
          outputPath = await this.useRealCUGAN(inputPath, scale);
          break;
        case 'rife':
          outputPath = await this.useRIFE(inputPath, fps, interpolation);
          break;
        case 'basicvsr':
          outputPath = await this.useBasicVSR(inputPath, scale);
          break;
        default:
          throw new Error(`Modèle vidéo non supporté: ${model}`);
      }

      // Upload vers Firebase Storage
      const firebaseResult = await firebaseStorage.uploadFileStream(outputPath, {
        folder: 'processed/videos',
        originalName: `enhanced_video_${scale}x_${Date.now()}.mp4`,
        makePublic: false,
        metadata: {
          model,
          scale,
          fps,
          interpolation,
          processedAt: new Date().toISOString()
        }
      });

      console.log(`✅ Vidéo traitée et stockée: ${firebaseResult.firebasePath}`);
      
      return firebaseResult.firebasePath;

    } catch (error) {
      console.error('Erreur upscaling vidéo:', error);
      throw error;
    }
  }

  // Real-CUGAN pour vidéos (nécessite installation locale)
  async useRealCUGAN(inputPath, scale) {
    try {
      const tempFilename = `realcugan_${Date.now()}_${scale}x.mp4`;
      const tempPath = path.join(this.tempDir, tempFilename);

      // Commande ffmpeg avec Real-CUGAN (si disponible)
      const ffmpegCmd = [
        '-i', inputPath,
        '-vf', `scale=iw*${scale}:ih*${scale}:flags=lanczos`, // Fallback simple
        '-c:v', 'libx264',
        '-crf', '23',
        '-preset', 'medium',
        tempPath
      ];

      return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', ffmpegCmd);
        
        let errorOutput = '';
        
        ffmpeg.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
          if (code === 0 && fs.existsSync(tempPath)) {
            resolve(tempPath);
          } else {
            console.error('Erreur FFmpeg:', errorOutput);
            reject(new Error('Échec du traitement vidéo'));
          }
        });

        // Timeout 10 minutes pour vidéos
        setTimeout(() => {
          ffmpeg.kill();
          reject(new Error('Timeout traitement vidéo'));
        }, 600000);
      });

    } catch (error) {
      console.error('Erreur Real-CUGAN:', error.message);
      throw error;
    }
  }

  // RIFE - Interpolation de frames
  async useRIFE(inputPath, targetFps, interpolation) {
    const tempFilename = `rife_${Date.now()}_${targetFps}fps.mp4`;
    const tempPath = path.join(this.tempDir, tempFilename);

    const ffmpegCmd = [
      '-i', inputPath,
      '-filter:v', `fps=${targetFps}`,
      '-c:v', 'libx264',
      '-crf', '20',
      tempPath
    ];

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegCmd);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(tempPath);
        } else {
          reject(new Error('Échec interpolation RIFE'));
        }
      });
    });
  }

  // BasicVSR - Super-resolution vidéo
  async useBasicVSR(inputPath, scale) {
    // Pour l'instant, utilise Real-CUGAN comme fallback
    return await this.useRealCUGAN(inputPath, scale);
  }

  // Télécharger un fichier depuis Firebase pour traitement
  async downloadFromFirebase(firebasePath, localFileName = null) {
    try {
      const fileName = localFileName || path.basename(firebasePath);
      const localPath = path.join(this.tempDir, fileName);
      
      await firebaseStorage.downloadFile(firebasePath, localPath);
      return localPath;
      
    } catch (error) {
      console.error('Erreur téléchargement Firebase:', error);
      throw error;
    }
  }

  // Utilitaires
  async fileToBase64(filePath) {
    const fileBuffer = await fs.promises.readFile(filePath);
    return `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
  }

  // Test disponibilité des outils
  async testAvailableTools() {
    const tools = {
      waifu2x: true, // API toujours disponible
      ffmpeg: await this.checkCommand('ffmpeg'),
      python: await this.checkCommand('python3'),
      replicate: !!process.env.REPLICATE_API_TOKEN,
      huggingface: !!process.env.HUGGINGFACE_API_TOKEN,
      firebase: !!firebaseStorage.bucket
    };

    console.log('🔧 Outils disponibles:', tools);
    return tools;
  }

  async checkCommand(command) {
    return new Promise((resolve) => {
      const child = spawn(command, ['--version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }

  // Nettoyage des fichiers temporaires
  async cleanupTempFiles() {
    try {
      const files = await fs.promises.readdir(this.tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      let cleaned = 0;
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.promises.stat(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.promises.unlink(filePath);
          cleaned++;
        }
      }
      
      console.log(`🧹 ${cleaned} fichiers temporaires supprimés`);
      return cleaned;
      
    } catch (error) {
      console.error('Erreur nettoyage temp:', error);
      return 0;
    }
  }
}

module.exports = new AIService();
