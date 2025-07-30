// controllers/userController.js - Gestion utilisateurs (CORRIGÉ)
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');

class UserController {
  async register(req, res) {
    try {
      const { email, password } = req.body;
      
      // Validation
      if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
      }
      
      if (password.length < 6) {
        return res.status(400).json({ error: 'Mot de passe trop court (min 6 caractères)' });
      }

      // Vérification email unique
      const existingUser = await prisma.user.findUnique({
        where: { email: email }
      });
      if (existingUser) {
        return res.status(400).json({ error: 'Email déjà utilisé' });
      }

      // Hash password
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Créer utilisateur - CORRIGÉ: utilise passwordHash
      const user = await prisma.user.create({
        data: {
          email: email,
          passwordHash: passwordHash, // ✅ CORRIGÉ: passwordHash au lieu de password_hash
          plan: 'FREE',
          creditsRemaining: 5,
        },
      });

      // Générer JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        message: 'Compte créé avec succès',
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan,
          creditsRemaining: user.creditsRemaining
        },
        token
      });

    } catch (error) {
      console.error('Erreur register:', error);
      res.status(500).json({ error: 'Erreur lors de la création du compte' });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
      }

      // Trouver utilisateur - CORRIGÉ: utilise le bon nom de champ
      const user = await prisma.user.findUnique({
        where: { email: email }
      });

      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Vérifier password - CORRIGÉ: utilise passwordHash
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Générer JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '7d' }
      );

      res.json({
        message: 'Connexion réussie',
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan,
          creditsRemaining: user.creditsRemaining,
          creditsUsedToday: user.creditsUsedToday
        },
        token
      });

    } catch (error) {
      console.error('Erreur login:', error);
      res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
  }

  async getProfile(req, res) {
    try {
      const userId = req.user.id;
      
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      // Statistiques utilisateur
      const stats = await prisma.job.groupBy({
        by: ['type'],
        where: { userId: userId },
        _count: {
          _all: true,
        },
      });

      const totalJobs = await prisma.job.count({ where: { userId: userId } });
      const completedJobs = await prisma.job.count({ 
        where: { userId: userId, status: 'COMPLETED' } 
      });
      const imagesProcessed = stats.find(s => s.type === 'IMAGE')?._count._all || 0;
      const videosProcessed = stats.find(s => s.type === 'VIDEO')?._count._all || 0;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan,
          creditsRemaining: user.creditsRemaining,
          creditsUsedToday: user.creditsUsedToday,
          lastReset: user.lastReset,
          createdAt: user.createdAt
        },
        stats: {
          totalJobs: parseInt(totalJobs),
          completedJobs: parseInt(completedJobs),
          imagesProcessed: parseInt(imagesProcessed),
          videosProcessed: parseInt(videosProcessed)
        }
      });

    } catch (error) {
      console.error('Erreur get profile:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
  }

  async upgradeUser(req, res) {
    try {
      const userId = req.user.id;
      const { plan } = req.body; // 'PREMIUM' ou 'PRO'
      
      const validPlans = ['PREMIUM', 'PRO'];
      if (!validPlans.includes(plan)) {
        return res.status(400).json({ error: 'Plan invalide' });
      }

      // Définir crédits selon le plan
      const credits = plan === 'PREMIUM' ? 100 : 500;
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: plan,
          creditsRemaining: credits,
          updatedAt: new Date(),
        },
      });

      res.json({
        message: `Compte upgradé vers ${plan} avec succès`,
        plan,
        creditsRemaining: credits
      });

    } catch (error) {
      console.error('Erreur upgrade:', error);
      res.status(500).json({ error: 'Erreur lors de l\'upgrade' });
    }
  }
}

module.exports = new UserController();