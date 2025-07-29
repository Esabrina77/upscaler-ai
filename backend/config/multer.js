
// ================================
// config/multer.js - Configuration upload fichiers
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Créer le dossier uploads temporaire s'il n'existe pas
const uploadDir = path.join(__dirname, '../temp');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuration stockage temporaire
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// Filtre types de fichiers
const fileFilter = (req, file, cb) => {
  // Images autorisées
  const imageTypes = /jpeg|jpg|png|webp|bmp|tiff/;
  // Vidéos autorisées  
  const videoTypes = /mp4|avi|mov|wmv|flv|webm/;
  
  const extname = imageTypes.test(path.extname(file.originalname).toLowerCase()) ||
                  videoTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('image/') || 
                   file.mimetype.startsWith('video/');
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Format de fichier non supporté'), false);
  }
};

// Configuration multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 1 // 1 fichier max
  },
  fileFilter: fileFilter
});

// Middleware de nettoyage automatique (supprime les fichiers > 1h)
const cleanupOldFiles = () => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  fs.readdir(uploadDir, (err, files) => {
    if (err) return;
    
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        
        if (stats.mtime.getTime() < oneHourAgo) {
          fs.unlink(filePath, (err) => {
            if (!err) console.log(`🗑️ Fichier temporaire supprimé: ${file}`);
          });
        }
      });
    });
  });
};

// Nettoyage toutes les heures
setInterval(cleanupOldFiles, 60 * 60 * 1000);

module.exports = {
  upload,
  uploadDir
};