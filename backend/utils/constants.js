
// ================================
// utils/constants.js - Constantes de l'application
module.exports = {
  // Plans utilisateur
  USER_PLANS: {
    FREE: 'free',
    PREMIUM: 'premium',
    PRO: 'pro'
  },

  // Limites par plan
  PLAN_LIMITS: {
    free: {
      dailyImages: 5,
      maxImageSize: 10 * 1024 * 1024, // 10MB
      videosAllowed: false,
      maxScale: 4,
      queuePriority: 1
    },
    premium: {
      dailyImages: 100,
      maxImageSize: 50 * 1024 * 1024, // 50MB
      videosAllowed: true,
      maxVideoSize: 100 * 1024 * 1024, // 100MB
      maxScale: 8,
      queuePriority: 2
    },
    pro: {
      dailyImages: -1, // illimité
      maxImageSize: 100 * 1024 * 1024, // 100MB
      videosAllowed: true,
      maxVideoSize: 500 * 1024 * 1024, // 500MB
      maxScale: 8,
      queuePriority: 3
    }
  },

  // Modèles IA disponibles
  AI_MODELS: {
    IMAGE: {
      'real-esrgan': {
        name: 'Real-ESRGAN',
        description: 'Excellent pour photos réalistes',
        maxScale: 8,
        processingTime: 'Moyen'
      },
      'esrgan': {
        name: 'ESRGAN',
        description: 'Modèle pré-entraîné polyvalent',
        maxScale: 4,
        processingTime: 'Rapide'
      },
      'waifu2x': {
        name: 'Waifu2x',
        description: 'Idéal pour dessins et anime',
        maxScale: 2,
        processingTime: 'Très rapide'
      },
      'srcnn': {
        name: 'SRCNN',
        description: 'Architecture simple et efficace',
        maxScale: 4,
        processingTime: 'Rapide'
      }
    },
    VIDEO: {
      'real-cugan': {
        name: 'Real-CUGAN',
        description: 'Upscaling vidéo temps réel',
        maxScale: 4,
        processingTime: 'Long'
      },
      'rife': {
        name: 'RIFE',
        description: 'Interpolation de frames',
        maxScale: 2,
        processingTime: 'Moyen'
      },
      'basicvsr': {
        name: 'BasicVSR++',
        description: 'Super-resolution vidéo avancée',
        maxScale: 4,
        processingTime: 'Très long'
      }
    }
  },

  // Statuts des jobs
  JOB_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
  },

  // Types de fichiers supportés
  SUPPORTED_FORMATS: {
    IMAGE: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff'],
    VIDEO: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm']
  },

  // Messages d'erreur
  ERROR_MESSAGES: {
    FILE_TOO_LARGE: 'Fichier trop volumineux',
    UNSUPPORTED_FORMAT: 'Format de fichier non supporté',
    INSUFFICIENT_CREDITS: 'Crédits insuffisants',
    PROCESSING_FAILED: 'Échec du traitement',
    UNAUTHORIZED: 'Authentification requise',
    PREMIUM_REQUIRED: 'Fonctionnalité premium requise'
  },

  // Configuration par défaut
  DEFAULT_SETTINGS: {
    IMAGE_SCALE: 2,
    IMAGE_MODEL: 'waifu2x',
    VIDEO_SCALE: 2,
    VIDEO_MODEL: 'real-cugan',
    VIDEO_FPS: 'auto'
  }
};