
// ================================
// routes/auth.js - Routes authentification
const express = require('express');
const userController = require('../controllers/userController');
const { authRequired } = require('../middleware/auth');
const { authLimit } = require('../middleware/rateLimit');
const { validateRegister, validateLogin } = require('../middleware/validation');

const router = express.Router();

// Inscription
router.post('/register', 
  authLimit,
  validateRegister,
  userController.register
);

// Connexion
router.post('/login',
  authLimit, 
  validateLogin,
  userController.login
);

// Profil utilisateur
router.get('/profile',
  authRequired,
  userController.getProfile
);

// Upgrade compte
router.post('/upgrade',
  authRequired,
  userController.upgradeUser
);

module.exports = router;
