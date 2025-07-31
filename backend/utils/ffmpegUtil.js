// backend/utils/ffmpegUtil.js - Utilitaire FFmpeg spécialisé
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class FFmpegUtil {
  constructor() {
    this.isAvailable = false;
    this.version = null;
    this.init();
  }

  async init() {
    this.isAvailable = await this.checkFFmpegInstallation();
    if (this.isAvailable) {
      this.version = await this.getFFmpegVersion();
    }
    console.log(`🔍 FFmpeg: ${this.isAvailable ? `✅ v${this.version}` : '❌'}`);
  }

  // Vérifier installation FFmpeg
  async checkFFmpegInstallation() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      ffmpeg.on('error', () => resolve(false));
      ffmpeg.on('close', (code) => resolve(code === 0));
    });
  }

  // Obtenir version FFmpeg
  async getFFmpegVersion() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      let output = '';

      ffmpeg.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.on('close', () => {
        const match = output.match(/ffmpeg version (\S+)/);
        resolve(match ? match[1] : 'unknown');
      });
    });
  }

  // Upscaling vidéo basique avec filtres avancés
  async upscaleVideo(inputPath, scale = 2, options = {}) {
    if (!this.isAvailable) {
      throw new Error('FFmpeg non disponible');
    }

    const {
      fps = 'auto',
      preset = 'medium',
      crf = 18,
      filters = []
    } = options;

    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `ffmpeg_upscaled_${Date.now()}_${scale}x.mp4`);

    return new Promise((resolve, reject) => {
      // Construire les filtres vidéo
      const videoFilters = [];
      
      // 1. Débruitage adaptatif
      if (scale >= 4) {
        videoFilters.push('bm3d=sigma=2:block=4:bstep=2');
      }
      
      // 2. Upscaling avec Lanczos haute qualité
      videoFilters.push(`scale=iw*${scale}:ih*${scale}:flags=lanczos:param0=3`);
      
      // 3. Sharpening intelligent
      videoFilters.push('unsharp=5:5:1.0:5:5:0.0');
      
      // 4. Correction colorimétrique
      videoFilters.push('eq=contrast=1.05:brightness=0.01:saturation=1.02');
      
      // 5. Filtres FPS si nécessaire
      if (fps !== 'auto') {
        if (fps === '60' || fps === '120') {
          // Interpolation motion pour hauts FPS
          videoFilters.push(`minterpolate=fps=${fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1`);
        } else {
          videoFilters.push(`fps=${fps}`);
        }
      }
      
      // Ajouter filtres personnalisés
      videoFilters.push(...filters);

      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', videoFilters.join(','),
        '-c:v', 'libx264',
        '-crf', crf.toString(),
        '-preset', preset,
        '-tune', 'film',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-movflags', '+faststart',
        outputPath
      ];

      console.log(`🎬 FFmpeg upscale ${scale}x: ${ffmpegArgs.slice(0, 10).join(' ')}...`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      let progress = '';
      
      ffmpeg.stderr.on('data', (data) => {
        const chunk = data.toString();
        progress += chunk;
        
        // Extraire progression
        const timeMatch = chunk.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
        if (timeMatch) {
          console.log(`📹 FFmpeg: ${timeMatch[1]}`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ FFmpeg upscale terminé: ${outputPath}`);
          resolve(outputPath);
        } else {
          console.error('Erreur FFmpeg:', progress.slice(-500));
          reject(new Error(`FFmpeg échoué (code ${code})`));
        }
      });

      // Timeout adaptatif selon la taille
      const timeoutMs = this.calculateTimeout(inputPath, scale);
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout FFmpeg'));
      }, timeoutMs);
    });
  }

  // Interpolation FPS sans upscaling
  async interpolateFPS(inputPath, targetFps, options = {}) {
    const {
      mode = 'mci', // motion compensated interpolation
      preset = 'medium',
      crf = 16
    } = options;

    if (!this.isAvailable) {
      throw new Error('FFmpeg non disponible');
    }

    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `ffmpeg_fps_${Date.now()}_${targetFps}fps.mp4`);

    return new Promise((resolve, reject) => {
      const videoFilters = [];
      
      // Interpolation intelligente selon FPS cible
      if (targetFps >= 60) {
        videoFilters.push(`minterpolate=fps=${targetFps}:mi_mode=${mode}:mc_mode=aobmc:me_mode=bidir:vsbmc=1`);
      } else {
        videoFilters.push(`fps=${targetFps}`);
      }

      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', videoFilters.join(','),
        '-c:v', 'libx264',
        '-crf', crf.toString(),
        '-preset', preset,
        '-tune', 'animation', // Optimisé pour mouvement fluide
        '-pix_fmt', 'yuv420p',
        '-c:a', 'copy', // Conserver audio original
        '-movflags', '+faststart',
        outputPath
      ];

      console.log(`🌊 FFmpeg interpolation ${targetFps}fps`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        const progress = this.extractProgress(data.toString());
        if (progress) {
          console.log(`📊 Interpolation: ${progress}%`);
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Interpolation terminée: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`Interpolation échouée (code ${code})`));
        }
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout interpolation'));
      }, 1800000); // 30 minutes
    });
  }

  // Compression intelligente (réduction taille)
  async compressVideo(inputPath, targetSizeMB, options = {}) {
    const {
      maxCrf = 28,
      minCrf = 15,
      preset = 'medium'
    } = options;

    if (!this.isAvailable) {
      throw new Error('FFmpeg non disponible');
    }

    try {
      // 1. Analyser vidéo pour calculer bitrate cible
      const videoInfo = await this.getVideoInfo(inputPath);
      const targetBitrate = this.calculateTargetBitrate(targetSizeMB, videoInfo.duration);
      
      // 2. Déterminer CRF optimal
      const crf = this.calculateOptimalCrf(targetBitrate, videoInfo);
      const finalCrf = Math.max(minCrf, Math.min(maxCrf, crf));

      const tempDir = os.tmpdir();
      const outputPath = path.join(tempDir, `ffmpeg_compressed_${Date.now()}.mp4`);

      return new Promise((resolve, reject) => {
        const ffmpegArgs = [
          '-i', inputPath,
          '-c:v', 'libx264',
          '-crf', finalCrf.toString(),
          '-preset', preset,
          '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // Assurer dimensions paires
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          outputPath
        ];

        console.log(`🗜️ FFmpeg compression CRF ${finalCrf} -> ${targetSizeMB}MB`);

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve(outputPath);
          } else {
            reject(new Error(`Compression échouée (code ${code})`));
          }
        });

        setTimeout(() => {
          ffmpeg.kill();
          reject(new Error('Timeout compression'));
        }, 1200000); // 20 minutes
      });

    } catch (error) {
      throw new Error(`Erreur compression: ${error.message}`);
    }
  }

  // Extraire frames à intervalles
  async extractFrames(inputPath, outputDir, options = {}) {
    const {
      interval = 1, // 1 frame par seconde
      format = 'png',
      quality = 95
    } = options;

    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', inputPath,
        '-vf', `fps=1/${interval}`,
        '-q:v', quality.toString(),
        path.join(outputDir, `frame_%04d.${format}`)
      ];

      console.log(`📸 Extraction frames (1/${interval}s)`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputDir);
        } else {
          reject(new Error(`Extraction frames échouée (code ${code})`));
        }
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout extraction'));
      }, 300000); // 5 minutes
    });
  }

  // Assembler frames en vidéo
  async framesToVideo(framesDir, outputPath, fps = 30, options = {}) {
    const {
      framePattern = 'frame_%04d.png',
      crf = 18,
      preset = 'medium'
    } = options;

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-r', fps.toString(),
        '-i', path.join(framesDir, framePattern),
        '-c:v', 'libx264',
        '-crf', crf.toString(),
        '-preset', preset,
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputPath
      ];

      console.log(`🎞️ Assemblage vidéo ${fps}fps`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Assemblage échoué (code ${code})`));
        }
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout assemblage'));
      }, 600000); // 10 minutes
    });
  }

  // Obtenir informations détaillées vidéo
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
            const audioStream = info.streams.find(s => s.codec_type === 'audio');
            
            resolve({
              duration: parseFloat(info.format.duration),
              size: parseInt(info.format.size),
              bitrate: parseInt(info.format.bit_rate),
              video: videoStream ? {
                codec: videoStream.codec_name,
                fps: eval(videoStream.r_frame_rate),
                width: videoStream.width,
                height: videoStream.height,
                bitrate: parseInt(videoStream.bit_rate) || 0
              } : null,
              audio: audioStream ? {
                codec: audioStream.codec_name,
                sampleRate: parseInt(audioStream.sample_rate),
                channels: audioStream.channels,
                bitrate: parseInt(audioStream.bit_rate) || 0
              } : null
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

  // Créer thumbnail/preview
  async createThumbnail(videoPath, outputPath, options = {}) {
    const {
      time = '00:00:05', // 5 secondes dans la vidéo
      width = 320,
      height = 240
    } = options;

    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i', videoPath,
        '-ss', time,
        '-vframes', '1',
        '-vf', `scale=${width}:${height}`,
        '-q:v', '2',
        outputPath
      ];

      console.log(`📷 Création thumbnail ${width}x${height}`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve(outputPath);
        } else {
          reject(new Error(`Thumbnail échoué (code ${code})`));
        }
      });

      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Timeout thumbnail'));
      }, 30000); // 30 secondes
    });
  }

  // Utilitaires privés
  calculateTimeout(inputPath, scale) {
    // Timeout adaptatif basé sur la complexité
    const baseTimeout = 600000; // 10 minutes
    const scaleFactor = Math.pow(scale, 1.5);
    return Math.min(baseTimeout * scaleFactor, 3600000); // Max 1 heure
  }

  extractProgress(stderr) {
    // Extraire progression depuis time= et duration
    const timeMatch = stderr.match(/time=(\d{2}):(\d{2}):(\d{2})\./);
    const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\./);
    
    if (timeMatch && durationMatch) {
      const currentSeconds = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);
      const totalSeconds = parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]);
      
      if (totalSeconds > 0) {
        return Math.round((currentSeconds / totalSeconds) * 100);
      }
    }
    
    return null;
  }

  calculateTargetBitrate(targetSizeMB, durationSeconds) {
    // Calculer bitrate pour atteindre taille cible
    const targetBits = targetSizeMB * 1024 * 1024 * 8;
    const videoBitrate = targetBits / durationSeconds * 0.9; // 90% pour vidéo, 10% pour audio
    return Math.round(videoBitrate / 1000); // kbps
  }

  calculateOptimalCrf(targetBitrate, videoInfo) {
    // Estimer CRF pour atteindre bitrate cible
    const currentBitrate = videoInfo.bitrate / 1000;
    const ratio = currentBitrate / targetBitrate;
    
    if (ratio < 0.5) return 15; // Très haute qualité
    if (ratio < 1) return 18;   // Haute qualité
    if (ratio < 2) return 23;   // Qualité normale
    if (ratio < 4) return 28;   // Basse qualité
    return 32; // Très basse qualité
  }

  // Présets prédéfinis pour différents usages
  getPresets() {
    return {
      web_optimized: {
        crf: 23,
        preset: 'fast',
        tune: 'zerolatency',
        maxWidth: 1920
      },
      high_quality: {
        crf: 16,
        preset: 'slow',
        tune: 'film',
        maxWidth: 3840
      },
      mobile_friendly: {
        crf: 28,
        preset: 'fast',
        tune: 'fastdecode',
        maxWidth: 1280
      },
      social_media: {
        crf: 25,
        preset: 'medium',
        tune: 'zerolatency',
        maxWidth: 1080
      }
    };
  }

  // Vérifier santé du service
  async healthCheck() {
    return {
      available: this.isAvailable,
      version: this.version,
      codecs: await this.getSupportedCodecs(),
      filters: await this.getSupportedFilters()
    };
  }

  async getSupportedCodecs() {
    if (!this.isAvailable) return [];
    
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-codecs']);
      let output = '';

      ffmpeg.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.on('close', () => {
        const codecs = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.includes('libx264')) codecs.push('h264');
          if (line.includes('libx265')) codecs.push('h265');
          if (line.includes('libvpx')) codecs.push('vp8');
          if (line.includes('libvpx-vp9')) codecs.push('vp9');
        }
        
        resolve(codecs);
      });
    });
  }

  async getSupportedFilters() {
    if (!this.isAvailable) return [];
    
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-filters']);
      let output = '';

      ffmpeg.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffmpeg.on('close', () => {
        const filters = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.includes('scale')) filters.push('scale');
          if (line.includes('minterpolate')) filters.push('minterpolate');
          if (line.includes('bm3d')) filters.push('bm3d');
          if (line.includes('unsharp')) filters.push('unsharp');
        }
        
        resolve(filters);
      });
    });
  }
}

module.exports = new FFmpegUtil();