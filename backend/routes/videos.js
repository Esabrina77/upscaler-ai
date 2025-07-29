
// ================================
// routes/videos.js - Routes pour vidéos
const express = require('express');
const videoController = require('../controllers/videoController');
const { upload } = require('../config/multer');
const { authRequired } = require('../middleware/auth');
const { videoUploadLimit } = require('../middleware/rateLimit');
const { validateVideoUpload } = require('../middleware/validation');

const router = express.Router();

// Upload et traitement vidéo (premium uniquement)
router.post('/upload',
  videoUploadLimit,
  authRequired,
  upload.single('video'),
  validateVideoUpload,
  videoController.uploadAndProcess
);

// Statut d'un job vidéo
router.get('/job/:jobId/status', videoController.getJobStatus);

// Téléchargement résultat vidéo
router.get('/download/:jobId', videoController.downloadResult);

module.exports = router;
