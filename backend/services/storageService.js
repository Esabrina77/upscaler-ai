
// ================================
// services/storageService.js - Gestion stockage fichiers
const fs = require('fs').promises;
const path = require('path');

class StorageService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../uploads');
    this.processedDir = path.join(__dirname, '../uploads/processed');
    this.ensureDirectories();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.mkdir(this.processedDir, { recursive: true });
      console.log('📁 Dossiers de stockage initialisés');
    } catch (error) {
      console.error('Erreur création dossiers:', error);
    }
  }

  // Nettoyage automatique des fichiers anciens
  async cleanupOldFiles(maxAgeHours = 24) {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    
    const directories = [this.uploadDir, this.processedDir];
    
    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            console.log(`🗑️ Fichier supprimé: ${file}`);
          }
        }
      } catch (error) {
        console.error(`Erreur nettoyage ${dir}:`, error.message);
      }
    }
  }

  // Obtenir la taille d'un fichier
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  // Obtenir l'espace disque utilisé
  async getDiskUsage() {
    let totalSize = 0;
    let fileCount = 0;
    
    const directories = [this.uploadDir, this.processedDir];
    
    for (const dir of directories) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const size = await this.getFileSize(filePath);
          totalSize += size;
          fileCount++;
        }
      } catch (error) {
        console.error(`Erreur calcul usage ${dir}:`, error.message);
      }
    }
    
    return {
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024)),
      fileCount
    };
  }

  // Programmer nettoyage automatique
  startAutoCleanup(intervalHours = 6, maxAgeHours = 24) {
    setInterval(() => {
      this.cleanupOldFiles(maxAgeHours);
    }, intervalHours * 60 * 60 * 1000);
    
    console.log(`🔄 Nettoyage automatique programmé (${intervalHours}h)`);
  }
}

module.exports = new StorageService();