// middleware/auth.js - Authentification JWT avec Prisma (CORRIGÉ)
const jwt = require('jsonwebtoken');
const UserService = require('../lib/userService');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware authentification obligatoire
const authRequired = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Vérifier que l'utilisateur existe encore avec Prisma
      const user = await UserService.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      req.user = {
        id: user.id,
        email: user.email,
        plan: user.plan.toLowerCase()
      };
      
      next();
      
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré' });
      } else if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Token invalide' });
      } else {
        throw jwtError;
      }
    }
    
  } catch (error) {
    console.error('Erreur auth middleware:', error);
    res.status(500).json({ error: 'Erreur authentification' });
  }
};

// Middleware authentification optionnelle (pour features freemium)
const authOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const user = await UserService.findById(decoded.userId);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          plan: user.plan.toLowerCase()
        };
      } else {
        req.user = null;
      }
      
    } catch (jwtError) {
      req.user = null;
    }
    
    next();
    
  } catch (error) {
    console.error('Erreur auth optional:', error);
    req.user = null;
    next();
  }
};

module.exports = {
  authRequired,
  authOptional
};