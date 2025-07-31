// backend/utils/realEsrganUtil.js - Utilitaire Real-ESRGAN spécialisé
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const axios = require('axios');

class RealEsrganUtil {
  constructor() {
    this.modelPath = null;
    this.isAvailable = false;
    this.init();
  }

  async init() {
    // Vérifier si Real-ESRGAN est installé localement
    this.isAvailable = await this.checkLocalInstallation();
    console.log(`🔍 Real-ESRGAN local: ${this.isAvailable ? '✅' : '❌'}`);
  }

  // Vérifier installation locale Real-ESRGAN
  async checkLocalInstallation() {
    try {
      // Chercher l'executable Windows d'abord
      const windowsPath = process.env.REAL_ESRGAN_PATH || '../ai/Real-ESRGAN-windows';
      const executablePath = path.join(windowsPath, 'realesrgan-ncnn-vulkan.exe');
      
      try {
        await fs.access(executablePath);
        this.modelPath = windowsPath;
        this.useExecutable = true;
        return true;
      } catch {}
      
      // Fallback: version Python
      const pythonPath = '../ai/Real-ESRGAN';
      const pythonScript = path.join(pythonPath, 'inference_realesrgan.py');
      
      await fs.access(pythonScript);
      this.modelPath = pythonPath;
      this.useExecutable = false;
      return true;
    } catch {
      return false;
    }
  }

  // Upscaling avec executable Windows (priorité)
  async upscaleExecutable(inputPath, scale = 4, model = 'realesrgan-x4plus') {
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `realesrgan_exe_${Date.now()}_${scale}x.png`);
    
    return new Promise((resolve, reject) => {
      const executablePath = path.join(this.modelPath, 'realesrgan-ncnn-vulkan.exe');
      
      // Mapper les modèles aux noms executable
      const modelMap = {
        'RealESRGAN_x4plus': 'realesrgan-x4plus',
        'RealESRGAN_x2plus': 'realesrgan-x4plus', // Fallback
        'RealESRGAN_x4plus_anime_6B': 'realesrgan-x4plus-anime'
      };
      
      const executableModel = modelMap[model] || 'realesrgan-x4plus';
      
      const args = [
        '-i', inputPath,
        '-o', outputPath,
        '-n', executableModel,
        '-s', scale.toString(),
        '-f', 'png'
      ];

      console.log(`🚀 Real-ESRGAN executable: ${executablePath} ${args.join(' ')}`);

      const process = spawn(executablePath, args);
      
      let stderr = '';
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        // Extraire progression si possible
        const progressMatch = data.toString().match(/(\d+(?:\.\d+)?)%/);
        if (progressMatch) {
          console.log(`📊 Real-ESRGAN: ${progressMatch[1]}%`);
        }
      });

      process.on('close', async (code) => {
        if (code === 0) {
          try {
            await fs.access(outputPath);
            console.log(`✅ Real-ESRGAN executable terminé: ${outputPath}`);
            resolve(outputPath);
          } catch {
            reject(new Error('Fichier de sortie non créé'));
          }
        } else {
          console.error('Erreur Real-ESRGAN executable:', stderr);
          reject(new Error(`Real-ESRGAN échoué (code ${code})`));
        }
      });

      // Timeout 15 minutes
      setTimeout(() => {
        process.kill();
        reject(new Error('Timeout Real-ESRGAN executable'));
      }, 900000);
    });
  }
  // Upscaling avec Real-ESRGAN local (version Python)
  async upscaleLocal(inputPath, scale = 4, model = 'RealESRGAN_x4plus') {
    if (!this.isAvailable) {
      throw new Error('Real-ESRGAN non disponible localement');
    }

    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `realesrgan_${Date.now()}_${scale}x.png`);
    
    return new Promise((resolve, reject) => {
      const pythonArgs = [
        path.join(this.modelPath, 'inference_realesrgan.py'),
        '-n', model,
        '-i', inputPath,
        '-o', outputPath,
        '--outscale', scale.toString(),
        '--fp32' // Pour éviter les erreurs GPU
      ];

      console.log(`🚀 Real-ESRGAN local: python ${pythonArgs.join(' ')}`);

      const process = spawn('python', pythonArgs);
      
      let stderr = '';
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Real-ESRGAN:', data.toString().trim());
      });

      process.on('close', async (code) => {
        if (code === 0) {
          try {
            // Vérifier que le fichier de sortie existe
            await fs.access(outputPath);
            console.log(`✅ Real-ESRGAN terminé: ${outputPath}`);
            resolve(outputPath);
          } catch {
            reject(new Error('Fichier de sortie non créé'));
          }
        } else {
          console.error('Erreur Real-ESRGAN:', stderr);
          reject(new Error(`Real-ESRGAN échoué (code ${code})`));
        }
      });

      // Timeout 10 minutes
      setTimeout(() => {
        process.kill();
        reject(new Error('Timeout Real-ESRGAN'));
      }, 600000);
    });
  }

  // Upscaling via API Replicate (fallback)
  async upscaleReplicate(inputPath, scale = 4) {
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('Token Replicate manquant');
    }

    try {
      console.log(`🌐 Real-ESRGAN via Replicate scale ${scale}x`);
      
      const imageBase64 = await this.fileToBase64(inputPath);
      
      // Créer prédiction
      const response = await axios.post('https://api.replicate.com/v1/predictions', {
        version: "42fed1c4974146d4d2414e2be2c5277c7fcf05fcc972b0d3329bfd13c5ce22d",
        input: {
          image: imageBase64,
          scale: scale,
          face_enhance: false
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
      const maxAttempts = 60; // 2 minutes max

      while ((result.status === 'starting' || result.status === 'processing') && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        
        const statusResponse = await axios.get(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { 'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}` }
        });
        result = statusResponse.data;
        
        console.log(`⏳ Replicate status: ${result.status} (${attempts}/${maxAttempts})`);
      }

      if (result.status !== 'succeeded') {
        throw new Error(`Replicate échoué: ${result.error || result.status}`);
      }

      // Télécharger le résultat
      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `replicate_${Date.now()}_${scale}x.png`);
      
      const imageResponse = await axios.get(result.output, {
        responseType: 'arraybuffer',
        timeout: 120000
      });

      await fs.writeFile(outputPath, imageResponse.data);
      
      console.log(`✅ Real-ESRGAN Replicate terminé: ${outputPath}`);
      return outputPath;

    } catch (error) {
      console.error('Erreur Real-ESRGAN Replicate:', error.message);
      throw error;
    }
  }

  // Méthode principale d'upscaling
  async upscale(inputPath, options = {}) {
    const { scale = 4, model = 'RealESRGAN_x4plus', forceReplicate = false } = options;
    
    // Valider les paramètres
    const validScales = [2, 4, 8];
    if (!validScales.includes(scale)) {
      throw new Error(`Scale invalide: ${scale}. Utilisez 2, 4 ou 8`);
    }

    try {
      // 1. Priorité: Executable Windows (le plus rapide)
      if (this.isAvailable && this.useExecutable && !forceReplicate) {
        try {
          return await this.upscaleExecutable(inputPath, scale, model);
        } catch (execError) {
          console.warn('Échec executable, essai Python:', execError.message);
        }
      }

      // 2. Fallback: Version Python locale
      if (this.isAvailable && !this.useExecutable && !forceReplicate) {
        try {
          return await this.upscaleLocal(inputPath, scale, model);
        } catch (localError) {
          console.warn('Échec Python local, essai Replicate:', localError.message);
        }
      }

      // 3. Dernier recours: Replicate API
      return await this.upscaleReplicate(inputPath, scale);
      
    } catch (error) {
      console.error('Échec complet Real-ESRGAN:', error.message);
      throw new Error(`Real-ESRGAN indisponible: ${error.message}`);
    }
  }

  // Obtenir les modèles disponibles
  getAvailableModels() {
    return {
      'RealESRGAN_x4plus': {
        scale: [2, 4],
        description: 'Général, haute qualité'
      },
      'RealESRGAN_x2plus': {
        scale: [2],
        description: 'Optimisé 2x'
      },
      'RealESRGAN_x4plus_anime_6B': {
        scale: [4],
        description: 'Spécialisé anime/dessins'
      }
    };
  }

  // Estimer le temps de traitement
  estimateProcessingTime(inputPath, scale) {
    // Estimation basée sur la taille et le scale
    return new Promise(async (resolve) => {
      try {
        const stats = await fs.stat(inputPath);
        const sizeMB = stats.size / (1024 * 1024);
        
        // Facteurs: taille fichier, scale, méthode
        const baseFactor = this.isAvailable ? 1 : 2; // Replicate plus lent
        const scaleFactor = Math.pow(scale, 1.5);
        const sizeFactor = Math.sqrt(sizeMB);
        
        const estimatedSeconds = Math.ceil(baseFactor * scaleFactor * sizeFactor * 10);
        resolve(Math.min(estimatedSeconds, 600)); // Max 10 minutes
      } catch {
        resolve(120); // 2 minutes par défaut
      }
    });
  }

  // Convertir fichier en base64
  async fileToBase64(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } catch (error) {
      throw new Error(`Erreur lecture fichier: ${error.message}`);
    }
  }

  // Vérifier la santé du service
  async healthCheck() {
    const health = {
      localAvailable: this.isAvailable,
      replicateAvailable: !!process.env.REPLICATE_API_TOKEN,
      modelPath: this.modelPath,
      models: this.getAvailableModels()
    };

    // Test rapide local si disponible
    if (this.isAvailable) {
      try {
        const testResult = await this.checkLocalInstallation();
        health.localWorking = testResult;
      } catch {
        health.localWorking = false;
      }
    }

    return health;
  }
}

module.exports = new RealEsrganUtil();