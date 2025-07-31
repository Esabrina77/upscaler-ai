// backend/utils/rifeUtil.js - Utilitaire RIFE spécialisé (interpolation FPS)
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class RifeUtil {
  constructor() {
    this.rifePath = null;
    this.isAvailable = false;
    this.init();
  }

  async init() {
    this.isAvailable = await this.checkRifeInstallation();
    console.log(`🔍 RIFE disponible: ${this.isAvailable ? '✅' : '❌'}`);
  }

  // Vérifier installation RIFE
  async checkRifeInstallation() {
    try {
      // Chercher RIFE dans le dossier ai
      const rifePath = process.env.RIFE_PATH || '../ai/ECCV2022-RIFE';
      
      // Vérifier que les scripts existent
      const videoScript = path.join(rifePath, 'inference_video.py');
      const imgScript = path.join(rifePath, 'inference_img.py');
      
      await fs.access(videoScript);
      await fs.access(imgScript);
      
      // Vérifier que les modèles sont présents
      const modelDir = path.join(rifePath, 'train_log');
      try {
        const modelFiles = await fs.readdir(modelDir);
        const hasFlownet = modelFiles.includes('flownet.pkl');
        const hasPythonModels = modelFiles.some(file => file.endsWith('.py') && file.includes('HDv3'));
        
        if (!hasFlownet) {
          console.warn('⚠️ RIFE: flownet.pkl manquant dans train_log/');
          this.hasModels = false;
        } else if (!hasPythonModels) {
          console.warn('⚠️ RIFE: Modèles HDv3 Python manquants');
          this.hasModels = false;
        } else {
          this.hasModels = true;
          console.log(`✅ RIFE: flownet.pkl + modèles HDv3 trouvés`);
        }
      } catch {
        console.warn('⚠️ RIFE: Dossier train_log/ inaccessible');
        this.hasModels = false;
      }
      
      this.rifePath = rifePath;
      return true;
    } catch {
      console.error('❌ RIFE: Scripts inference non trouvés');
      return false;
    }
  }

  // Extraire les frames d'une vidéo
  async extractFrames(videoPath, outputDir) {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', videoPath,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Assurer dimensions paires
        '-pix_fmt', 'rgb24',
        path.join(outputDir, 'frame_%05d.png')
      ];

      console.log(`🎬 Extraction frames: ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Frames extraites');
          resolve(outputDir);
        } else {
          reject(new Error(`Échec extraction frames (code ${code})`));
        }
      });

      // Timeout 5 minutes
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout extraction frames'));
      }, 300000);
    });
  }

  // Interpoler les frames avec RIFE
  async interpolateFrames(inputDir, outputDir, targetFps = 60) {
    if (!this.isAvailable) {
      throw new Error('RIFE non disponible');
    }

    if (!this.hasModels) {
      throw new Error('Modèles RIFE manquants. Téléchargez-les depuis Google Drive.');
    }

    return new Promise((resolve, reject) => {
      // Utiliser inference_video.py pour interpolation depuis frames
      const pythonArgs = [
        path.join(this.rifePath, 'inference_video.py'),
        '--exp=1', // 2x interpolation par défaut
        '--img', inputDir,
        '--output', outputDir,
        '--fps', targetFps.toString()
      ];

      console.log(`🌊 RIFE interpolation: python ${pythonArgs.join(' ')}`);

      const process = spawn('python', pythonArgs, {
        cwd: this.rifePath // Important: exécuter depuis le dossier RIFE
      });
      
      let stderr = '';
      let stdout = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('RIFE stdout:', data.toString().trim());
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        const progress = this.extractProgress(data.toString());
        if (progress) {
          console.log(`📊 RIFE progress: ${progress}%`);
        }
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Interpolation RIFE terminée');
          resolve(outputDir);
        } else {
          console.error('Erreur RIFE:', stderr);
          console.error('RIFE stdout:', stdout);
          reject(new Error(`RIFE échoué (code ${code}): ${stderr}`));
        }
      });

      // Timeout 30 minutes pour vidéos longues
      setTimeout(() => {
        process.kill();
        reject(new Error('Timeout RIFE - Traitement trop long'));
      }, 1800000);
    });
  }

  // Reconstruire vidéo depuis frames
  async reconstructVideo(framesDir, originalVideoPath, outputPath, fps = 60) {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-r', fps.toString(),
        '-i', path.join(framesDir, 'frame_%05d.png'),
        '-i', originalVideoPath,
        '-map', '0:v', // Vidéo depuis frames
        '-map', '1:a?', // Audio depuis original (optionnel)
        '-c:v', 'libx264',
        '-crf', '16', // Haute qualité
        '-preset', 'slow',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-movflags', '+faststart',
        outputPath
      ];

      console.log(`🎞️ Reconstruction vidéo: ffmpeg ${ffmpegArgs.join(' ')}`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Vidéo reconstruite');
          resolve(outputPath);
        } else {
          reject(new Error(`Échec reconstruction vidéo (code ${code})`));
        }
      });

      // Timeout 15 minutes
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout reconstruction vidéo'));
      }, 900000);
    });
  }

  // Interpolation vidéo complète (méthode principale)
  async interpolateVideo(inputVideoPath, targetFps = 60, options = {}) {
    if (!this.isAvailable) {
      throw new Error('RIFE non disponible');
    }

    if (!this.hasModels) {
      throw new Error('Modèles RIFE manquants');
    }

    const tempDir = os.tmpdir();
    const outputVideoPath = path.join(tempDir, `rife_output_${Date.now()}_${targetFps}fps.mp4`);

    try {
      console.log(`🎯 RIFE interpolation directe ${targetFps}fps: ${inputVideoPath}`);

      // Utiliser inference_video.py directement sur la vidéo
      return new Promise((resolve, reject) => {
        const exp = targetFps === 120 ? 2 : 1; // 2^2=4x pour 120fps, 2^1=2x pour 60fps
        
        const pythonArgs = [
          path.join(this.rifePath, 'inference_video.py'),
          `--exp=${exp}`,
          `--video=${inputVideoPath}`,
          `--output=${outputVideoPath}`,
          '--scale=1.0' // Résolution processus par défaut
        ];

        // Ajouter fps spécifique si différent de auto
        if (targetFps !== 'auto') {
          pythonArgs.push(`--fps=${targetFps}`);
        }

        console.log(`🌊 RIFE commande: python ${pythonArgs.join(' ')}`);

        const process = spawn('python', pythonArgs, {
          cwd: this.rifePath
        });
        
        let stderr = '';
        let stdout = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
          console.log('RIFE:', data.toString().trim());
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
          // RIFE peut afficher progression sur stderr
          console.log('RIFE stderr:', data.toString().trim());
        });

        process.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ RIFE interpolation terminée: ${outputVideoPath}`);
            resolve(outputVideoPath);
          } else {
            console.error('Erreur RIFE:', stderr);
            console.error('RIFE stdout:', stdout);
            reject(new Error(`RIFE échoué (code ${code}): ${stderr}`));
          }
        });

        // Timeout adaptatif selon taille fichier
        const timeoutMs = this.calculateVideoTimeout(inputVideoPath);
        setTimeout(() => {
          process.kill();
          reject(new Error(`Timeout RIFE après ${timeoutMs/1000}s`));
        }, timeoutMs);
      });

    } catch (error) {
      console.error('Erreur RIFE:', error.message);
      throw error;
    }
  }

  // Upscaling + interpolation combiné
  async upscaleAndInterpolate(inputVideoPath, scale = 2, targetFps = 60) {
    const tempDir = os.tmpdir();
    const workDir = path.join(tempDir, `rife_upscale_${Date.now()}`);
    const framesDir = path.join(workDir, 'input_frames');
    const upscaledFramesDir = path.join(workDir, 'upscaled_frames');
    const interpolatedFramesDir = path.join(workDir, 'interpolated_frames');
    const outputVideoPath = path.join(tempDir, `rife_upscaled_${Date.now()}_${scale}x_${targetFps}fps.mp4`);

    try {
      // Créer dossiers
      await fs.mkdir(workDir, { recursive: true });
      await fs.mkdir(framesDir, { recursive: true });
      await fs.mkdir(upscaledFramesDir, { recursive: true });
      await fs.mkdir(interpolatedFramesDir, { recursive: true });

      console.log(`🚀 RIFE upscale ${scale}x + interpolation ${targetFps}fps`);

      // 1. Extraire frames
      await this.extractFrames(inputVideoPath, framesDir);

      // 2. Upscaler chaque frame
      await this.upscaleFrames(framesDir, upscaledFramesDir, scale);

      // 3. Interpoler frames upscalées
      await this.interpolateFrames(upscaledFramesDir, interpolatedFramesDir, targetFps);

      // 4. Reconstruire vidéo
      await this.reconstructVideo(interpolatedFramesDir, inputVideoPath, outputVideoPath, targetFps);

      // 5. Nettoyer
      await this.cleanupDirectory(workDir);

      console.log(`✅ RIFE upscale + interpolation terminé: ${outputVideoPath}`);
      return outputVideoPath;

    } catch (error) {
      try {
        await this.cleanupDirectory(workDir);
      } catch {}
      
      throw error;
    }
  }

  // Upscaler frames avec FFmpeg
  async upscaleFrames(inputDir, outputDir, scale) {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', path.join(inputDir, 'frame_%05d.png'),
        '-vf', `scale=iw*${scale}:ih*${scale}:flags=lanczos`,
        '-pix_fmt', 'rgb24',
        path.join(outputDir, 'frame_%05d.png')
      ];

      console.log(`🔍 Upscale frames ${scale}x`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputDir);
        } else {
          reject(new Error(`Échec upscale frames (code ${code})`));
        }
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout upscale frames'));
      }, 600000);
    });
  }

  // Extraire progression depuis stderr
  extractProgress(stderr) {
    const match = stderr.match(/(\d+)\/(\d+)/);
    if (match) {
      const current = parseInt(match[1]);
      const total = parseInt(match[2]);
      return Math.round((current / total) * 100);
    }
    return null;
  }

  // Nettoyer dossier récursivement
  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          await this.cleanupDirectory(filePath);
        } else {
          await fs.unlink(filePath);
        }
      }
      
      await fs.rmdir(dirPath);
    } catch (error) {
      console.warn(`Erreur nettoyage ${dirPath}:`, error.message);
    }
  }

  // Estimer temps de traitement
  async estimateProcessingTime(inputPath, targetFps) {
    try {
      const stats = await fs.stat(inputPath);
      const sizeMB = stats.size / (1024 * 1024);
      
      // Facteurs: taille, FPS cible, complexité
      const baseFactor = 60; // 1 minute par MB de base
      const fpsFactor = targetFps / 30; // Relatif à 30fps
      const sizeFactor = Math.sqrt(sizeMB);
      
      const estimatedSeconds = Math.ceil(baseFactor * fpsFactor * sizeFactor);
      return Math.min(estimatedSeconds, 3600); // Max 1 heure
    } catch {
      return 600; // 10 minutes par défaut
    }
  }

  // Obtenir infos vidéo
  async getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
      const ffprobeArgs = [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        videoPath
      ];

      const ffprobe = spawn('ffprobe', ffprobeArgs);
      let stdout = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code === 0) {
          try {
            const info = JSON.parse(stdout);
            const videoStream = info.streams.find(s => s.codec_type === 'video');
            
            resolve({
              duration: parseFloat(info.format.duration),
              fps: eval(videoStream.r_frame_rate),
              width: videoStream.width,
              height: videoStream.height,
              bitrate: parseInt(info.format.bit_rate)
            });
          } catch (parseError) {
            reject(new Error('Erreur parsing info vidéo'));
          }
        } else {
          reject(new Error('Erreur obtention info vidéo'));
        }
      });
    });
  }

  // Calculer timeout adaptatif
  calculateVideoTimeout(videoPath) {
    try {
      const stats = require('fs').statSync(videoPath);
      const sizeMB = stats.size / (1024 * 1024);
      
      // 2 minutes par MB minimum, max 2 heures
      const timeoutMs = Math.max(sizeMB * 2 * 60 * 1000, 30 * 60 * 1000);
      return Math.min(timeoutMs, 2 * 60 * 60 * 1000);
    } catch {
      return 30 * 60 * 1000; // 30 minutes par défaut
    }
  }

  // Vérifier santé du service
  async healthCheck() {
    const health = {
      available: this.isAvailable,
      rifePath: this.rifePath,
      hasModels: this.hasModels,
      ffmpegAvailable: await this.checkFFmpeg(),
      supportedFps: [24, 30, 60, 120],
      pythonAvailable: await this.checkPython()
    };

    // Test des scripts RIFE
    if (this.isAvailable) {
      try {
        const videoScript = path.join(this.rifePath, 'inference_video.py');
        const imgScript = path.join(this.rifePath, 'inference_img.py');
        
        await fs.access(videoScript);
        await fs.access(imgScript);
        health.scriptsOk = true;
      } catch {
        health.scriptsOk = false;
      }
    }

    return health;
  }

  async checkPython() {
    return new Promise((resolve) => {
      const python = spawn('python', ['--version']);
      python.on('error', () => resolve(false));
      python.on('close', (code) => resolve(code === 0));
    });
  }

  async checkFFmpeg() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('error', () => resolve(false));
      ffmpeg.on('close', (code) => resolve(code === 0));
    });
  }
}

module.exports = new RifeUtil();