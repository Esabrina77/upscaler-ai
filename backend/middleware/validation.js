// middleware/validation.js - Validation des données (CORRIGÉ)
const { body, validationResult } = require('express-validator');

// Middleware pour traiter les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

// Validation upload image
const validateImageUpload = [
  body('scale')
    .optional()
    .isIn(['2', '4', '8'])
    .withMessage('Scale doit être 2, 4 ou 8'),
  
  body('model')
    .optional()
    .isIn(['real-esrgan', 'esrgan', 'waifu2x', 'srcnn'])
    .withMessage('Modèle invalide'),
  
  // Validation du fichier
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune image fournie' });
    }
    
    // Vérifier type MIME
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'image/webp', 'image/bmp', 'image/tiff'
    ];
    
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Format non supporté. Utilisez JPG, PNG, WebP, BMP ou TIFF' 
      });
    }
    
    // Vérifier taille (50MB max)
    if (req.file.size > 50 * 1024 * 1024) {
      return res.status(400).json({ 
        error: 'Fichier trop volumineux (max 50MB)' 
      });
    }
    
    next();
  },
  
  handleValidationErrors
];

// Validation upload vidéo
const validateVideoUpload = [
  body('scale')
    .optional()
    .isIn(['2', '4'])
    .withMessage('Scale vidéo doit être 2 ou 4'),
  
  body('model')
    .optional()
    .isIn(['real-cugan', 'rife', 'basicvsr'])
    .withMessage('Modèle vidéo invalide'),
  
  body('fps')
    .optional()
    .matches(/^(auto|24|30|60|120)$/)
    .withMessage('FPS invalide (auto, 24, 30, 60, 120)'),
  
  body('interpolation')
    .optional()
    .isIn(['true', 'false', true, false])
    .withMessage('Interpolation doit être true/false'),
  
  // Validation fichier vidéo
  (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Aucune vidéo fournie' });
    }
    
    const allowedMimes = [
      'video/mp4', 'video/avi', 'video/mov', 
      'video/wmv', 'video/flv', 'video/webm'
    ];
    
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Format vidéo non supporté. Utilisez MP4, AVI, MOV, WMV, FLV ou WebM' 
      });
    }
    
    // Limite plus stricte pour vidéos
    if (req.file.size > 100 * 1024 * 1024) { // 100MB max
      return res.status(400).json({ 
        error: 'Vidéo trop volumineuse (max 100MB)' 
      });
    }
    
    next();
  },
  
  handleValidationErrors
];

// Validation inscription
const validateRegister = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Mot de passe: 6-100 caractères'),
  
  handleValidationErrors
];

// Validation connexion
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email invalide'),
  
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis'),
  
  handleValidationErrors
];

module.exports = {
  validateImageUpload,
  validateVideoUpload,
  validateRegister,
  validateLogin,
  handleValidationErrors
};