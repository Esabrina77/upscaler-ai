// server.js - Point d'entrée principal COMPLET
require('dotenv').config();

// Imports principaux
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

// Imports Firebase et services
const firebaseAdmin = require('./config/firebase');
const { prisma } = require('./config/prisma');
const cleanupUtil = require('./utils/cleanupUtil');

// Routes imports
const imageRoutes = require('./routes/images');
const videoRoutes = require('./routes/videos');
const authRoutes = require('./routes/auth');
const testRoutes = require('./routes/test');

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ Initialisation Firebase Admin
try {
  console.log('✅ Firebase Admin initialisé');
} catch (error) {
  console.error('❌ Erreur Firebase Admin:', error);
}

// ✅ Initialisation des services de base
async function initializeServices() {
  try {
    // Test connexion Prisma
    await prisma.$connect();
    console.log('✅ Prisma connecté à PostgreSQL');
    
    // Démarrer le nettoyage périodique
    cleanupUtil.startPeriodicCleanup();
    
    // Démarrer monitoring usage
    cleanupUtil.startUsageMonitoring();
    
  } catch (error) {
    console.error('❌ Erreur initialisation services:', error);
    process.exit(1);
  }
}

// ✅ Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
    },
  },
}));

// ✅ CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ✅ Middleware de base
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb' 
}));

// ✅ Trust proxy (pour les headers de forwarded)
app.set('trust proxy', 1);

// ✅ Health check principal
app.get('/health', async (req, res) => {
  try {
    // Test base de données
    await prisma.$queryRaw`SELECT 1`;
    
    // Test Firebase
    const firebaseStatus = firebaseAdmin ? 'OK' : 'ERROR';
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'OK',
        firebase: firebaseStatus,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ Health check détaillé
app.get('/health/detailed', async (req, res) => {
  try {
    const aiService = require('./services/aiService');
    const queueService = require('./services/queueService');
    
    const [
      aiHealth,
      queueHealth,
      storageStats
    ] = await Promise.all([
      aiService.healthCheck(),
      queueService.healthCheck(),
      cleanupUtil.getCleanupStats()
    ]);
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      services: {
        ai: aiHealth,
        queue: queueHealth,
        storage: storageStats,
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          nodeVersion: process.version,
          platform: process.platform
        }
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR', 
      error: error.message 
    });
  }
});

// ✅ API Routes avec préfixe /api
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/test', testRoutes);

// ✅ Route pour les métriques (monitoring)
app.get('/metrics', (req, res) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString(),
    nodejs_version: process.version,
    platform: process.platform,
    pid: process.pid
  };
  
  res.json(metrics);
});

// ✅ Route de debug (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/debug/env', (req, res) => {
    res.json({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      FRONTEND_URL: process.env.FRONTEND_URL,
      DATABASE_URL: process.env.DATABASE_URL ? '***configured***' : 'not set',
      FIREBASE_CONFIG: process.env.FIREBASE_PROJECT_ID ? '***configured***' : 'not set'
    });
  });
}

// ✅ Route pour forcer le nettoyage (admin)
app.post('/admin/cleanup', async (req, res) => {
  try {
    const { force = false } = req.body;
    
    let result;
    if (force) {
      result = await cleanupUtil.emergencyCleanup();
    } else {
      result = await cleanupUtil.performSmartCleanup();
    }
    
    res.json({
      success: true,
      message: 'Nettoyage terminé',
      result
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Erreur nettoyage',
      details: error.message 
    });
  }
});

// ✅ Middleware pour logs des requêtes lentes
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 5000) { // > 5 secondes
      console.warn(`⚠️ Requête lente: ${req.method} ${req.url} - ${duration}ms`);
    }
  });
  
  next();
});

// ✅ Middleware pour limiter les requêtes concurrentes
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 100;

app.use((req, res, next) => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return res.status(503).json({ 
      error: 'Serveur surchargé. Réessayez plus tard.' 
    });
  }
  
  activeRequests++;
  res.on('finish', () => {
    activeRequests--;
  });
  
  next();
});

// ✅ 404 handler
app.use('*', (req, res) => {
  console.log(`404 - Route non trouvée: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Route non trouvée',
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// ✅ Error handler global
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  
  // Erreurs spécifiques
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ 
      error: 'Fichier trop volumineux (max 50MB)' 
    });
  }
  
  if (err.code === 'ENOTFOUND') {
    return res.status(503).json({ 
      error: 'Service externe indisponible' 
    });
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Données invalides',
      details: err.message 
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      error: 'Non autorisé' 
    });
  }
  
  // Erreur générique
  res.status(500).json({ 
    error: 'Erreur serveur interne',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue',
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });
});

// ✅ Gestion des signaux de fermeture
process.on('SIGTERM', async () => {
  console.log('🔄 Signal SIGTERM reçu, fermeture gracieuse...');
  
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma déconnecté');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur fermeture:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🔄 Signal SIGINT reçu, fermeture gracieuse...');
  
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma déconnecté');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur fermeture:', error);
    process.exit(1);
  }
});

// ✅ Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('❌ Exception non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  // Ne pas fermer le serveur pour une promesse rejetée
});

// ✅ Démarrage du serveur
async function startServer() {
  try {
    // Initialiser les services
    await initializeServices();
    
    // Démarrer le serveur
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`🔗 http://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 PID: ${process.pid}`);
    });
    
    // Configuration du serveur
    server.timeout = 300000; // 5 minutes timeout
    server.keepAliveTimeout = 65000; // 65 secondes
    server.headersTimeout = 66000; // 66 secondes
    
    // Gestion de la fermeture gracieuse du serveur
    const gracefulShutdown = async () => {
      console.log('🔄 Fermeture gracieuse du serveur...');
      
      server.close(async () => {
        console.log('✅ Serveur HTTP fermé');
        
        try {
          await prisma.$disconnect();
          console.log('✅ Prisma déconnecté');
          process.exit(0);
        } catch (error) {
          console.error('❌ Erreur fermeture Prisma:', error);
          process.exit(1);
        }
      });
      
      // Force la fermeture après 10 secondes
      setTimeout(() => {
        console.error('❌ Fermeture forcée après timeout');
        process.exit(1);
      }, 10000);
    };
    
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

// ✅ Démarrer l'application
startServer();