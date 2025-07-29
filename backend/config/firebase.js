// config/firebase.js - Configuration Firebase Admin
const admin = require('firebase-admin');
const path = require('path');

// Configuration Firebase Admin SDK
let firebaseApp;

try {
  // Méthode 1: Utiliser le fichier service account
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    const serviceAccount = require(serviceAccountPath);
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'upscaler-ai.firebasestorage.app'
    });
  } 
  // Méthode 2: Utiliser les variables d'environnement
  else if (process.env.FIREBASE_PRIVATE_KEY) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'upscaler-ai.firebasestorage.app'
    });
  } else {
    throw new Error('Configuration Firebase manquante');
  }
  
  console.log('✅ Firebase Admin initialisé');
  
} catch (error) {
  console.error('❌ Erreur initialisation Firebase:', error.message);
  console.log('💡 Vérifiez votre configuration Firebase dans .env');
}

// Instances Firebase
const bucket = firebaseApp ? firebaseApp.storage().bucket() : null;
const firestore = firebaseApp ? firebaseApp.firestore() : null;

module.exports = {
  admin,
  bucket,
  firestore,
  firebaseApp
};

