// routes/images.js - Routes pour images (CORRIGÉ)
const express = require('express');
const imageController = require('../controllers/imageController');
const { upload } = require('../config/multer');
const { authOptional } = require('../middleware/auth');
const { imageUploadLimit } = require('../middleware/rateLimit');
const { validateImageUpload } = require('../middleware/validation');

const router = express.Router();

// Upload et traitement image
router.post('/upload', 
  imageUploadLimit,
  authOptional,
  upload.single('image'),
  validateImageUpload,
  imageController.uploadAndProcess
);

// Statut d'un job
router.get('/job/:jobId/status', imageController.getJobStatus);

// Téléchargement résultat - CORRIGÉ
router.get('/download/:jobId', imageController.downloadResult);

module.exports = router;