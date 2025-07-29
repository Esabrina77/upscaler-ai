
// ================================
// middleware/rateLimit.js - Limitation des requêtes (CORRIGÉ)
const rateLimit = require('express-rate-limit');

// Limite pour upload images (utilisateurs non authentifiés)
const imageUploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Utilisateurs authentifiés = plus de requêtes
    if (req.user) {
      return req.user.plan === 'free' ? 10 : 50;
    }
    return 3; // Non authentifiés = 3 images/15min
  },
  message: {
    error: 'Trop de requêtes. Créez un compte pour plus de crédits !'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // CORRECTION: Utiliser le générateur de clé par défaut
  skip: (req) => false, // Ne pas skip les requêtes
});

// Limite pour upload vidéos (premium uniquement, plus restrictive)
const videoUploadLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: (req) => {
    if (!req.user) return 0;
    return req.user.plan === 'pro' ? 10 : 3;
  },
  message: {
    error: 'Limite de vidéos atteinte. Attendez ou passez au plan Pro !'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite pour authentification
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives de connexion
  message: {
    error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Limite API globale par IP
const apiLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // 200 requêtes API/15min
  message: {
    error: 'Limite API atteinte. Réessayez plus tard.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  imageUploadLimit,
  videoUploadLimit,
  authLimit,
  apiLimit
};
