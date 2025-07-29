// ================================
// controllers/userController.js - Gestion utilisateurs
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

      // Créer utilisateur
      const user = await prisma.user.create({
        data: {
          email: email,
          password_hash: passwordHash,
          plan: 'free',
          credits_remaining: 5,
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
          creditsRemaining: user.credits_remaining
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

      // Trouver utilisateur
      const user = await prisma.user.findUnique({
        where: { email: email }
      });

      if (!user) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Vérifier password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
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
          creditsRemaining: user.credits_remaining,
          creditsUsedToday: user.credits_used_today
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
        where: { user_id: userId },
        _count: {
          _all: true,
          completed: true,
        },
      });

      const totalJobs = await prisma.job.count({ where: { user_id: userId } });
      const completedJobs = await prisma.job.count({ where: { user_id: userId, status: 'completed' } });
      const imagesProcessed = stats.find(s => s.type === 'image')?._count._all || 0;
      const videosProcessed = stats.find(s => s.type === 'video')?._count._all || 0;

      res.json({
        user: {
          id: user.id,
          email: user.email,
          plan: user.plan,
          creditsRemaining: user.credits_remaining,
          creditsUsedToday: user.credits_used_today,
          lastReset: user.last_reset,
          createdAt: user.created_at
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
      const { plan } = req.body; // 'premium' ou 'pro'
      
      const validPlans = ['premium', 'pro'];
      if (!validPlans.includes(plan)) {
        return res.status(400).json({ error: 'Plan invalide' });
      }

      // Définir crédits selon le plan
      const credits = plan === 'premium' ? 100 : 500;
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: plan,
          credits_remaining: credits,
          updated_at: new Date(),
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