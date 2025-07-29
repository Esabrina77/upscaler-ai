
// ================================
// utils/helpers.js - Fonctions utilitaires
const fs = require('fs').promises;
const path = require('path');

class Helpers {
  // Formater la taille de fichier
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Formater la durée
  static formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours}h ${minutes}m ${secs}s`;
  }

  // Générer nom de fichier unique
  static generateFilename(originalName, suffix = '') {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${name}${suffix}_${timestamp}_${random}${ext}`;
  }

  // Valider type de fichier
  static isValidImageType(mimetype) {
    const validTypes = [
      'image/jpeg', 'image/jpg', 'image/png',
      'image/webp', 'image/bmp', 'image/tiff'
    ];
    return validTypes.includes(mimetype);
  }

  static isValidVideoType(mimetype) {
    const validTypes = [
      'video/mp4', 'video/avi', 'video/mov',
      'video/wmv', 'video/flv', 'video/webm'
    ];
    return validTypes.includes(mimetype);
  }

  // Créer réponse API standardisée
  static createResponse(success, data = null, message = null, errors = null) {
    const response = {
      success,
      timestamp: new Date().toISOString()
    };

    if (message) response.message = message;
    if (data) response.data = data;
    if (errors) response.errors = errors;

    return response;
  }

  // Logger personnalisé
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    console.log(logMessage);
    
    if (data) {
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  }

  // Vérifier espace disque disponible
  static async checkDiskSpace(path) {
    try {
      const stats = await fs.stat(path);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  // Nettoyer fichiers temporaires
  static async cleanupTempFiles(directory, maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
      const files = await fs.readdir(directory);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('Erreur nettoyage:', error);
      return 0;
    }
  }
}

module.exports = Helpers;
