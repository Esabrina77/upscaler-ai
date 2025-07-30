// routes/videos.js - Routes pour vidéos avec Firebase
const express = require('express');
const videoController = require('../controllers/videoController');
const { upload } = require('../config/multer');
const { authRequired } = require('../middleware/auth');
const { videoUploadLimit } = require('../middleware/rateLimit');
const { validateVideoUpload } = require('../middleware/validation');

const router = express.Router();

// ✅ Upload et traitement vidéo (premium uniquement)
router.post('/upload',
  videoUploadLimit,
  authRequired, // Obligatoire pour vidéos
  upload.single('video'),
  validateVideoUpload,
  videoController.uploadAndProcess
);

// ✅ Statut d'un job vidéo
router.get('/job/:jobId/status', videoController.getJobStatus);

// ✅ Téléchargement résultat vidéo
router.get('/download/:jobId', videoController.downloadResult);

// ✅ Stream vidéo pour prévisualisation
router.get('/stream/:jobId', videoController.streamVideo);

// ✅ Informations détaillées vidéo
router.get('/info/:jobId', videoController.getVideoInfo);

module.exports = router;