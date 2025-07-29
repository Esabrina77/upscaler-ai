// ================================
// services/firebaseStorageService.js - Service de stockage Firebase
const { bucket } = require('../config/firebase');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

class FirebaseStorageService {
  constructor() {
    this.bucket = bucket;
    this.baseUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}`;
  }

  // Générer un nom de fichier unique
  generateFileName(originalName, prefix = '') {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    
    return `${prefix}${prefix ? '_' : ''}${baseName}_${timestamp}_${random}${ext}`;
  }

  // Upload d'un fichier vers Firebase Storage
  async uploadFile(localFilePath, options = {}) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const {
        folder = 'uploads',
        originalName = path.basename(localFilePath),
        makePublic = false,
        metadata = {}
      } = options;

      // Générer nom de fichier unique
      const fileName = this.generateFileName(originalName, folder);
      const firebasePath = `${folder}/${fileName}`;

      // Référence du fichier dans Firebase
      const file = this.bucket.file(firebasePath);

      // Métadonnées du fichier
      const fileMetadata = {
        metadata: {
          originalName,
          uploadedAt: new Date().toISOString(),
          ...metadata
        },
        ...makePublic && {
          predefinedAcl: 'publicRead'
        }
      };

      // Upload du fichier
      await file.save(await fs.readFile(localFilePath), {
        metadata: fileMetadata,
        resumable: false, // Pour les petits fichiers
      });

      console.log(`✅ Fichier uploadé: ${firebasePath}`);

      // Générer URL de téléchargement
      let downloadUrl;
      if (makePublic) {
        downloadUrl = `${this.baseUrl}/${firebasePath}`;
      } else {
        // URL signée valide 7 jours
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 jours
        });
        downloadUrl = url;
      }

      // Supprimer le fichier local après upload
      try {
        await fs.unlink(localFilePath);
        console.log(`🗑️ Fichier local supprimé: ${localFilePath}`);
      } catch (unlinkError) {
        console.warn('Erreur suppression fichier local:', unlinkError.message);
      }

      return {
        firebasePath,
        downloadUrl,
        fileName,
        size: (await file.getMetadata())[0].size,
        contentType: (await file.getMetadata())[0].contentType
      };

    } catch (error) {
      console.error('Erreur upload Firebase:', error);
      throw new Error(`Échec upload Firebase: ${error.message}`);
    }
  }

  // Upload avec stream (pour gros fichiers)
  async uploadFileStream(localFilePath, options = {}) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const {
        folder = 'uploads',
        originalName = path.basename(localFilePath),
        makePublic = false
      } = options;

      const fileName = this.generateFileName(originalName, folder);
      const firebasePath = `${folder}/${fileName}`;
      const file = this.bucket.file(firebasePath);

      return new Promise((resolve, reject) => {
        const writeStream = file.createWriteStream({
          metadata: {
            metadata: {
              originalName,
              uploadedAt: new Date().toISOString(),
            }
          },
          resumable: true, // Pour gros fichiers
          ...(makePublic && { predefinedAcl: 'publicRead' })
        });

        writeStream.on('error', reject);
        
        writeStream.on('finish', async () => {
          try {
            let downloadUrl;
            if (makePublic) {
              downloadUrl = `${this.baseUrl}/${firebasePath}`;
            } else {
              const [url] = await file.getSignedUrl({
                action: 'read',
                expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
              });
              downloadUrl = url;
            }

            // Supprimer fichier local
            await fs.unlink(localFilePath);

            resolve({
              firebasePath,
              downloadUrl,
              fileName
            });
          } catch (error) {
            reject(error);
          }
        });

        // Pipe du fichier local vers Firebase
        const readStream = require('fs').createReadStream(localFilePath);
        readStream.pipe(writeStream);
      });

    } catch (error) {
      console.error('Erreur upload stream Firebase:', error);
      throw error;
    }
  }

  // Télécharger un fichier depuis Firebase
  async downloadFile(firebasePath, localPath) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const file = this.bucket.file(firebasePath);
      await file.download({ destination: localPath });
      
      console.log(`⬇️ Fichier téléchargé: ${firebasePath} → ${localPath}`);
      return localPath;
      
    } catch (error) {
      console.error('Erreur download Firebase:', error);
      throw new Error(`Échec download: ${error.message}`);
    }
  }

  // Supprimer un fichier
  async deleteFile(firebasePath) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      await this.bucket.file(firebasePath).delete();
      console.log(`🗑️ Fichier supprimé de Firebase: ${firebasePath}`);
      return true;
      
    } catch (error) {
      console.error('Erreur suppression Firebase:', error);
      return false;
    }
  }

  // Obtenir les métadonnées d'un fichier
  async getFileMetadata(firebasePath) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const [metadata] = await this.bucket.file(firebasePath).getMetadata();
      return metadata;
      
    } catch (error) {
      console.error('Erreur métadonnées Firebase:', error);
      throw error;
    }
  }

  // Lister les fichiers d'un dossier
  async listFiles(folder = '', options = {}) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const { maxResults = 100, pageToken } = options;
      
      const [files] = await this.bucket.getFiles({
        prefix: folder,
        maxResults,
        pageToken
      });

      return files.map(file => ({
        name: file.name,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        created: file.metadata.timeCreated,
        updated: file.metadata.updated
      }));
      
    } catch (error) {
      console.error('Erreur listage Firebase:', error);
      throw error;
    }
  }

  // Nettoyer les fichiers anciens
  async cleanupOldFiles(folder = '', maxAgeHours = 24) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
      const [files] = await this.bucket.getFiles({ prefix: folder });
      
      let deletedCount = 0;
      
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        const createdTime = new Date(metadata.timeCreated);
        
        if (createdTime < cutoffTime) {
          try {
            await file.delete();
            deletedCount++;
          } catch (deleteError) {
            console.warn(`Erreur suppression ${file.name}:`, deleteError.message);
          }
        }
      }
      
      console.log(`🧹 ${deletedCount} fichiers supprimés de Firebase (> ${maxAgeHours}h)`);
      return deletedCount;
      
    } catch (error) {
      console.error('Erreur nettoyage Firebase:', error);
      throw error;
    }
  }

  // Générer URL signée temporaire
  async generateSignedUrl(firebasePath, expirationHours = 24) {
    if (!this.bucket) {
      throw new Error('Firebase Storage non configuré');
    }

    try {
      const file = this.bucket.file(firebasePath);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expirationHours * 60 * 60 * 1000,
      });
      
      return url;
      
    } catch (error) {
      console.error('Erreur génération URL signée:', error);
      throw error;
    }
  }

  // Obtenir la taille totale utilisée
  async getStorageUsage(folder = '') {
    if (!this.bucket) {
      return { totalSize: 0, fileCount: 0 };
    }

    try {
      const [files] = await this.bucket.getFiles({ prefix: folder });
      
      let totalSize = 0;
      let fileCount = files.length;
      
      for (const file of files) {
        const [metadata] = await file.getMetadata();
        totalSize += parseInt(metadata.size || 0);
      }
      
      return {
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024)),
        fileCount
      };
      
    } catch (error) {
      console.error('Erreur calcul usage:', error);
      return { totalSize: 0, fileCount: 0 };
    }
  }
}

module.exports = new FirebaseStorageService();