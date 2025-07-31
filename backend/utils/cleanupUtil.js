// backend/utils/cleanupUtil.js - Nettoyage intelligent Firebase + local
const firebaseStorage = require('../services/firebaseStorageService');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class CleanupUtil {
  constructor() {
    this.maxFirebaseUsageGB = 4.5; // Limite à 4.5GB sur 5GB disponibles
    this.cleanupScheduled = false;
    this.startPeriodicCleanup();
  }

  // Démarrer nettoyage périodique
  startPeriodicCleanup() {
    if (this.cleanupScheduled) return;
    
    // Nettoyage toutes les heures
    setInterval(async () => {
      try {
        await this.performSmartCleanup();
      } catch (error) {
        console.error('Erreur nettoyage périodique:', error);
      }
    }, 60 * 60 * 1000); // 1 heure

    // Nettoyage immédiat au démarrage
    setTimeout(() => this.performSmartCleanup(), 30000); // 30 secondes
    
    this.cleanupScheduled = true;
    console.log('🔄 Nettoyage automatique programmé (1h)');
  }

  // Nettoyage intelligent principal
  async performSmartCleanup() {
    console.log('🧹 Début nettoyage intelligent...');
    
    try {
      const stats = {
        localFiles: 0,
        firebaseFiles: 0,
        freedSpaceMB: 0,
        errors: []
      };

      // 1. Nettoyage fichiers locaux temporaires
      const localCleaned = await this.cleanupLocalTemp();
      stats.localFiles = localCleaned.count;
      stats.freedSpaceMB += localCleaned.sizeMB;

      // 2. Vérifier usage Firebase
      const firebaseUsage = await this.getFirebaseUsage();
      console.log(`📊 Usage Firebase: ${firebaseUsage.totalSizeMB}MB / ${this.maxFirebaseUsageGB * 1024}MB`);

      // 3. Nettoyage Firebase si nécessaire
      if (firebaseUsage.totalSizeMB > this.maxFirebaseUsageGB * 1024) {
        console.log('⚠️ Quota Firebase dépassé, nettoyage forcé...');
        const firebaseCleaned = await this.cleanupFirebaseForced();
        stats.firebaseFiles = firebaseCleaned.count;
        stats.freedSpaceMB += firebaseCleaned.sizeMB;
      } else {
        // Nettoyage normal (fichiers > 1h)
        const firebaseCleaned = await this.cleanupFirebaseNormal();
        stats.firebaseFiles = firebaseCleaned.count;
        stats.freedSpaceMB += firebaseCleaned.sizeMB;
      }

      // 4. Nettoyage output après délai
      await this.cleanupExpiredOutputs();

      console.log(`✅ Nettoyage terminé: ${stats.localFiles} fichiers locaux, ${stats.firebaseFiles} Firebase, ${stats.freedSpaceMB}MB libérés`);
      
      return stats;

    } catch (error) {
      console.error('❌ Erreur nettoyage intelligent:', error);
      throw error;
    }
  }

  // Nettoyage fichiers locaux temporaires
  async cleanupLocalTemp() {
    const tempDirs = [
      os.tmpdir(),
      path.join(__dirname, '../temp'),
      path.join(__dirname, '../uploads')
    ];

    let totalCount = 0;
    let totalSizeMB = 0;
    const maxAge = 2 * 60 * 60 * 1000; // 2 heures

    for (const dir of tempDirs) {
      try {
        const { count, sizeMB } = await this.cleanupDirectory(dir, maxAge, [
          /temp_/, /upload_/, /ffmpeg_/, /rife_/, /realesrgan_/, /processed_/
        ]);
        totalCount += count;
        totalSizeMB += sizeMB;
      } catch (error) {
        console.warn(`Erreur nettoyage ${dir}:`, error.message);
      }
    }

    console.log(`🗑️ Local: ${totalCount} fichiers supprimés (${totalSizeMB}MB)`);
    return { count: totalCount, sizeMB: totalSizeMB };
  }

  // Nettoyage Firebase normal (fichiers > 1h)
  async cleanupFirebaseNormal() {
    const folders = ['upscaler-img', 'upscaler-vid'];
    let totalCount = 0;
    let totalSizeMB = 0;

    for (const folder of folders) {
      try {
        // Supprimer outputs > 1 heure
        const outputCount = await firebaseStorage.cleanupOldFiles(`${folder}/output`, 1);
        
        // Supprimer inputs traités > 15 minutes
        const inputCount = await firebaseStorage.cleanupOldFiles(`${folder}/input`, 0.25);
        
        totalCount += outputCount + inputCount;
        
        // Estimer taille libérée (moyenne)
        const avgSizeMB = folder === 'upscaler-vid' ? 50 : 5;
        totalSizeMB += (outputCount + inputCount) * avgSizeMB;
        
      } catch (error) {
        console.warn(`Erreur nettoyage Firebase ${folder}:`, error.message);
      }
    }

    console.log(`🔥 Firebase normal: ${totalCount} fichiers supprimés (${totalSizeMB}MB estimés)`);
    return { count: totalCount, sizeMB: totalSizeMB };
  }

  // Nettoyage Firebase forcé (quota dépassé)
  async cleanupFirebaseForced() {
    console.log('🚨 NETTOYAGE FIREBASE FORCÉ - Quota dépassé');
    
    const folders = ['upscaler-img', 'upscaler-vid'];
    let totalCount = 0;
    let totalSizeMB = 0;

    for (const folder of folders) {
      try {
        // Mode agressif : supprimer tous les outputs > 30 minutes
        const outputCount = await firebaseStorage.cleanupOldFiles(`${folder}`, 0.5);
        
        // Supprimer aussi inputs > 10 minutes
        const inputCount = await firebaseStorage.cleanupOldFiles(`${folder}/input`, 0.17);
        
        totalCount += outputCount + inputCount;
        
        const avgSizeMB = folder === 'upscaler-vid' ? 60 : 8;
        totalSizeMB += (outputCount + inputCount) * avgSizeMB;
        
      } catch (error) {
        console.error(`Erreur nettoyage forcé ${folder}:`, error.message);
      }
    }

    // Si toujours pas assez, supprimer les plus gros fichiers
    if (totalSizeMB < 500) { // Si < 500MB libérés
      await this.cleanupLargestFiles();
    }

    console.log(`🔥 Firebase forcé: ${totalCount} fichiers supprimés (${totalSizeMB}MB estimés)`);
    return { count: totalCount, sizeMB: totalSizeMB };
  }

  // Supprimer les plus gros fichiers Firebase
  async cleanupLargestFiles() {
    try {
      const folders = ['upscaler-img', 'upscaler-vid'];
      
      for (const folder of folders) {
        const files = await firebaseStorage.listFiles(folder, { maxResults: 100 });
        
        // Trier par taille décroissante
        const sortedFiles = files.sort((a, b) => (b.size || 0) - (a.size || 0));
        
        // Supprimer les 10 plus gros fichiers > 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        let deleted = 0;
        
        for (const file of sortedFiles.slice(0, 10)) {
          const createdTime = new Date(file.created);
          if (createdTime < fiveMinutesAgo) {
            try {
              await firebaseStorage.deleteFile(file.name);
              deleted++;
              console.log(`🗑️ Gros fichier supprimé: ${file.name} (${Math.round((file.size || 0) / 1024 / 1024)}MB)`);
            } catch (deleteError) {
              console.warn(`Fichier déjà supprimé: ${file.name}`);
            }
          }
        }
        
        console.log(`📦 ${deleted} gros fichiers supprimés de ${folder}`);
      }
    } catch (error) {
      console.error('Erreur suppression gros fichiers:', error);
    }
  }

  // Nettoyage outputs expirés (programmé)
  async cleanupExpiredOutputs() {
    try {
      const JobService = require('../lib/jobService');
      
      // Trouver jobs complétés > 1 heure avec outputFile
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const expiredJobs = await JobService.searchJobs({
        status: 'COMPLETED',
        dateTo: oneHourAgo.toISOString()
      });

      let deletedCount = 0;
      
      for (const job of expiredJobs.jobs) {
        if (job.outputFile) {
          try {
            await firebaseStorage.deleteFile(job.outputFile);
            
            // Mettre à jour job pour indiquer fichier supprimé
            await JobService.updateStatus(job.id, 'COMPLETED', {
              outputFile: null,
              progress: 100
            });
            
            deletedCount++;
          } catch (deleteError) {
            console.warn(`Erreur suppression output job ${job.id}:`, deleteError.message);
          }
        }
      }

      if (deletedCount > 0) {
        console.log(`⏰ ${deletedCount} outputs expirés supprimés`);
      }

    } catch (error) {
      console.error('Erreur nettoyage outputs expirés:', error);
    }
  }

  // Supprimer input après traitement réussi
  async cleanupInputAfterProcessing(inputFirebasePath, jobId) {
    try {
      await firebaseStorage.deleteFile(inputFirebasePath);
      console.log(`🗑️ Input supprimé après traitement job ${jobId}: ${inputFirebasePath}`);
      return true;
    } catch (error) {
      if (error.code === 404) {
        console.log(`ℹ️ Input déjà supprimé job ${jobId}: ${inputFirebasePath}`);
        return true;
      }
      console.warn(`Erreur suppression input job ${jobId}:`, error.message);
      return false;
    }
  }

  // Programmer suppression output dans 1 heure
  async scheduleOutputDeletion(outputFirebasePath, jobId) {
    setTimeout(async () => {
      try {
        await firebaseStorage.deleteFile(outputFirebasePath);
        
        // Mettre à jour job
        const JobService = require('../lib/jobService');
        await JobService.updateStatus(jobId, 'COMPLETED', {
          outputFile: null,
          progress: 100
        });
        
        console.log(`⏰ Output programmé supprimé job ${jobId}: ${outputFirebasePath}`);
      } catch (error) {
        if (error.code === 404) {
          console.log(`ℹ️ Output déjà supprimé job ${jobId}: ${outputFirebasePath}`);
        } else {
          console.warn(`Erreur suppression programmée job ${jobId}:`, error.message);
        }
      }
    }, 60 * 60 * 1000); // 1 heure
  }

  // Nettoyage d'un dossier avec patterns
  async cleanupDirectory(dirPath, maxAgeMs, patterns = []) {
    let count = 0;
    let sizeMB = 0;

    try {
      await fs.access(dirPath);
      const files = await fs.readdir(dirPath);
      const cutoffTime = Date.now() - maxAgeMs;

      for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
          const stats = await fs.stat(filePath);
          
          // Vérifier âge et patterns
          const isOld = stats.mtime.getTime() < cutoffTime;
          const matchesPattern = patterns.length === 0 || patterns.some(pattern => pattern.test(file));
          
          if (isOld && matchesPattern) {
            if (stats.isFile()) {
              const fileSizeMB = stats.size / (1024 * 1024);
              await fs.unlink(filePath);
              count++;
              sizeMB += fileSizeMB;
            } else if (stats.isDirectory()) {
              // Nettoyer récursivement
              const subResult = await this.cleanupDirectory(filePath, maxAgeMs, patterns);
              count += subResult.count;
              sizeMB += subResult.sizeMB;
              
              // Supprimer dossier vide
              try {
                await fs.rmdir(filePath);
              } catch {}
            }
          }
        } catch (statError) {
          // Fichier déjà supprimé ou inaccessible
          continue;
        }
      }
    } catch (error) {
      // Dossier n'existe pas ou inaccessible
      return { count: 0, sizeMB: 0 };
    }

    return { count, sizeMB: Math.round(sizeMB * 100) / 100 };
  }

  // Obtenir usage Firebase total
  async getFirebaseUsage() {
    try {
      const folders = ['upscaler-img', 'upscaler-vid'];
      let totalSize = 0;
      let totalFiles = 0;

      for (const folder of folders) {
        const usage = await firebaseStorage.getStorageUsage(folder);
        totalSize += usage.totalSize;
        totalFiles += usage.fileCount;
      }

      return {
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024)),
        totalFiles,
        percentUsed: Math.round((totalSize / (this.maxFirebaseUsageGB * 1024 * 1024 * 1024)) * 100)
      };
    } catch (error) {
      console.error('Erreur calcul usage Firebase:', error);
      return { totalSize: 0, totalSizeMB: 0, totalFiles: 0, percentUsed: 0 };
    }
  }

  // Nettoyage d'urgence (manuel)
  async emergencyCleanup() {
    console.log('🚨 NETTOYAGE D\'URGENCE');
    
    try {
      // 1. Nettoyer tout le temporaire local
      const localResult = await this.cleanupLocalTemp();
      
      // 2. Nettoyer Firebase agressivement
      const firebaseResult = await this.cleanupFirebaseForced();
      
      // 3. Supprimer gros fichiers
      await this.cleanupLargestFiles();
      
      // 4. Forcer nettoyage outputs récents (> 15 minutes)
      await firebaseStorage.cleanupOldFiles('upscaler-img', 0.25);
      await firebaseStorage.cleanupOldFiles('upscaler-vid', 0.25);
      
      const totalFreed = localResult.sizeMB + firebaseResult.sizeMB;
      console.log(`🚨 Urgence terminée: ${totalFreed}MB libérés`);
      
      return {
        success: true,
        freedSpaceMB: totalFreed,
        localFiles: localResult.count,
        firebaseFiles: firebaseResult.count
      };
      
    } catch (error) {
      console.error('❌ Erreur nettoyage urgence:', error);
      throw error;
    }
  }

  // Vérifier si nettoyage nécessaire
  async isCleanupNeeded() {
    try {
      const usage = await this.getFirebaseUsage();
      return {
        needed: usage.percentUsed > 80, // > 80% = nettoyage nécessaire
        urgent: usage.percentUsed > 90, // > 90% = urgence
        usage: usage
      };
    } catch (error) {
      return { needed: true, urgent: false, usage: null };
    }
  }

  // Optimiser storage avant traitement
  async optimizeBeforeProcessing(estimatedOutputSizeMB = 50) {
    try {
      const usage = await this.getFirebaseUsage();
      const requiredSpaceMB = estimatedOutputSizeMB * 1.5; // Marge de sécurité
      const availableSpaceMB = (this.maxFirebaseUsageGB * 1024) - usage.totalSizeMB;

      if (availableSpaceMB < requiredSpaceMB) {
        console.log(`🔄 Optimisation pré-traitement: besoin ${requiredSpaceMB}MB, dispo ${availableSpaceMB}MB`);
        
        // Nettoyer pour libérer l'espace nécessaire
        const spaceToFree = requiredSpaceMB - availableSpaceMB + 100; // +100MB marge
        await this.freeSpecificSpace(spaceToFree);
        
        return true;
      }
      
      return false; // Pas besoin d'optimisation
    } catch (error) {
      console.error('Erreur optimisation pré-traitement:', error);
      return false;
    }
  }

  // Libérer un espace spécifique
  async freeSpecificSpace(targetMB) {
    let freedMB = 0;
    const folders = ['upscaler-img', 'upscaler-vid'];

    try {
      // 1. Supprimer outputs > 30 minutes
      for (const folder of folders) {
        if (freedMB >= targetMB) break;
        
        const files = await firebaseStorage.listFiles(folder, { maxResults: 50 });
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        for (const file of files) {
          if (freedMB >= targetMB) break;
          
          const createdTime = new Date(file.created);
          if (createdTime < thirtyMinutesAgo) {
            await firebaseStorage.deleteFile(file.name);
            const fileSizeMB = (file.size || 0) / (1024 * 1024);
            freedMB += fileSizeMB;
            console.log(`🗑️ Libéré: ${file.name} (${Math.round(fileSizeMB)}MB)`);
          }
        }
      }

      // 2. Si pas assez, supprimer outputs > 15 minutes
      if (freedMB < targetMB) {
        for (const folder of folders) {
          if (freedMB >= targetMB) break;
          await firebaseStorage.cleanupOldFiles(folder, 0.25);
          freedMB += 50; // Estimation
        }
      }

      console.log(`✅ Espace libéré: ${Math.round(freedMB)}MB / ${targetMB}MB demandés`);
      return freedMB >= targetMB;

    } catch (error) {
      console.error('Erreur libération espace:', error);
      return false;
    }
  }

  // Statistiques de nettoyage
  async getCleanupStats() {
    try {
      const firebaseUsage = await this.getFirebaseUsage();
      const localUsage = await this.getLocalTempUsage();

      return {
        firebase: {
          totalSizeMB: firebaseUsage.totalSizeMB,
          percentUsed: firebaseUsage.percentUsed,
          files: firebaseUsage.totalFiles,
          limitMB: this.maxFirebaseUsageGB * 1024
        },
        local: {
          totalSizeMB: localUsage.totalSizeMB,
          files: localUsage.files,
          oldFiles: localUsage.oldFiles
        },
        recommendations: this.getCleanupRecommendations(firebaseUsage, localUsage)
      };
    } catch (error) {
      console.error('Erreur stats nettoyage:', error);
      return null;
    }
  }

  // Usage local temporaire
  async getLocalTempUsage() {
    const tempDirs = [os.tmpdir(), path.join(__dirname, '../temp')];
    let totalSize = 0;
    let totalFiles = 0;
    let oldFiles = 0;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    for (const dir of tempDirs) {
      try {
        const result = await this.calculateDirectoryUsage(dir, twoHoursAgo);
        totalSize += result.totalSize;
        totalFiles += result.totalFiles;
        oldFiles += result.oldFiles;
      } catch (error) {
        // Ignorer erreurs accès dossiers
      }
    }

    return {
      totalSizeMB: Math.round(totalSize / (1024 * 1024)),
      files: totalFiles,
      oldFiles
    };
  }

  // Calculer usage d'un dossier
  async calculateDirectoryUsage(dirPath, cutoffTime) {
    let totalSize = 0;
    let totalFiles = 0;
    let oldFiles = 0;

    try {
      const files = await fs.readdir(dirPath);

      for (const file of files) {
        try {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);

          if (stats.isFile()) {
            totalSize += stats.size;
            totalFiles++;
            
            if (stats.mtime.getTime() < cutoffTime) {
              oldFiles++;
            }
          }
        } catch {
          // Ignorer fichiers inaccessibles
        }
      }
    } catch {
      // Dossier inaccessible
    }

    return { totalSize, totalFiles, oldFiles };
  }

  // Recommandations de nettoyage
  getCleanupRecommendations(firebaseUsage, localUsage) {
    const recommendations = [];

    if (firebaseUsage.percentUsed > 90) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Nettoyage Firebase urgent - Quota > 90%',
        command: 'emergencyCleanup'
      });
    } else if (firebaseUsage.percentUsed > 80) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Nettoyage Firebase préventif - Quota > 80%',
        command: 'cleanupFirebaseNormal'
      });
    }

    if (localUsage.oldFiles > 10) {
      recommendations.push({
        priority: 'LOW',
        action: `${localUsage.oldFiles} fichiers temporaires anciens`,
        command: 'cleanupLocalTemp'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        action: 'Stockage optimisé - Aucune action requise',
        command: null
      });
    }

    return recommendations;
  }

  // Monitoring continu
  startUsageMonitoring() {
    setInterval(async () => {
      try {
        const check = await this.isCleanupNeeded();
        
        if (check.urgent) {
          console.log('🚨 QUOTA FIREBASE CRITIQUE - Nettoyage automatique');
          await this.emergencyCleanup();
        } else if (check.needed) {
          console.log('⚠️ Quota Firebase élevé - Nettoyage préventif');
          await this.performSmartCleanup();
        }
      } catch (error) {
        console.error('Erreur monitoring usage:', error);
      }
    }, 15 * 60 * 1000); // Vérification toutes les 15 minutes

    console.log('📊 Monitoring usage Firebase démarré (15min)');
  }

  // Nettoyage spécifique par type
  async cleanupByType(type = 'all', maxAgeHours = 1) {
    const results = { count: 0, sizeMB: 0 };

    try {
      switch (type) {
        case 'images':
          const imgResult = await firebaseStorage.cleanupOldFiles('upscaler-img', maxAgeHours);
          results.count += imgResult;
          results.sizeMB += imgResult * 5; // Estimation 5MB par image
          break;

        case 'videos':
          const vidResult = await firebaseStorage.cleanupOldFiles('upscaler-vid', maxAgeHours);
          results.count += vidResult;
          results.sizeMB += vidResult * 50; // Estimation 50MB par vidéo
          break;

        case 'temp':
          const tempResult = await this.cleanupLocalTemp();
          results.count += tempResult.count;
          results.sizeMB += tempResult.sizeMB;
          break;

        case 'all':
        default:
          const allResult = await this.performSmartCleanup();
          return allResult;
      }

      console.log(`✅ Nettoyage ${type}: ${results.count} fichiers, ${results.sizeMB}MB`);
      return results;

    } catch (error) {
      console.error(`Erreur nettoyage ${type}:`, error);
      throw error;
    }
  }
}

module.exports = new CleanupUtil();