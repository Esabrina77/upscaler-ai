// lib/userService.js - Service utilisateur avec remboursement (AJOUTS)
const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');

class UserService {
  // Créer un nouvel utilisateur
  static async createUser(userData) {
    const { email, password, plan = 'FREE' } = userData;
    
    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Définir les crédits selon le plan
    const creditsMap = {
      'FREE': 5,
      'PREMIUM': 100,
      'PRO': 500
    };
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash, // ✅ Utilise passwordHash (camelCase)
        plan,
        creditsRemaining: creditsMap[plan],
      },
      select: {
        id: true,
        email: true,
        plan: true,
        creditsRemaining: true,
        createdAt: true,
      },
    });
    
    return user;
  }
  
  // Trouver utilisateur par email - CORRIGÉ
  static async findByEmail(email) {
    return await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,  // ✅ CORRIGÉ: utilise passwordHash (camelCase)
        plan: true,
        creditsRemaining: true,
        creditsUsedToday: true,
        lastReset: true,
      },
    });
  }
  
  // Trouver utilisateur par ID
  static async findById(id) {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        plan: true,
        creditsRemaining: true,
        creditsUsedToday: true,
        lastReset: true,
        createdAt: true,
      },
    });
  }
  
  // Vérifier et décrémenter les crédits
  static async canProcessAndDecrement(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (!user) return false;
    
    const today = new Date().toISOString().split('T')[0];
    const lastReset = user.lastReset.toISOString().split('T')[0];
    
    // Reset quotidien pour utilisateurs gratuits
    if (user.plan === 'FREE' && lastReset !== today) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          creditsUsedToday: 0,
          lastReset: new Date(),
        },
      });
      user.creditsUsedToday = 0;
    }
    
    // Vérifier les limites
    const canProcess = user.plan === 'FREE' 
      ? user.creditsUsedToday < 5 
      : user.creditsRemaining > 0;
    
    if (!canProcess) return false;
    
    // Décrémenter les crédits
    await prisma.user.update({
      where: { id: userId },
      data: {
        creditsUsedToday: { increment: 1 },
        creditsRemaining: user.plan !== 'FREE' 
          ? { decrement: 1 } 
          : user.creditsRemaining,
      },
    });
    
    return true;
  }

  // ✅ NOUVEAU: Décrémenter les crédits utilisés aujourd'hui (pour remboursement FREE)
  static async decrementDailyCredits(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          creditsUsedToday: { decrement: 1 },
        },
      });
      return true;
    } catch (error) {
      console.error('Erreur décrement crédits quotidiens:', error);
      return false;
    }
  }

  // ✅ NOUVEAU: Incrémenter les crédits restants (pour remboursement PREMIUM/PRO)
  static async incrementCredits(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          creditsRemaining: { increment: 1 },
        },
      });
      return true;
    } catch (error) {
      console.error('Erreur incrémentation crédits:', error);
      return false;
    }
  }
  
  // Upgrader un utilisateur
  static async upgradePlan(userId, newPlan) {
    const creditsMap = {
      'PREMIUM': 100,
      'PRO': 500
    };
    
    return await prisma.user.update({
      where: { id: userId },
      data: {
        plan: newPlan,
        creditsRemaining: creditsMap[newPlan],
      },
      select: {
        id: true,
        email: true,
        plan: true,
        creditsRemaining: true,
      },
    });
  }
  
  // Statistiques utilisateur
  static async getUserStats(userId) {
    // Statistiques globales
    const totalStats = await prisma.job.aggregate({
      where: { userId },
      _count: {
        id: true,
      },
    });
    
    // Stats par statut
    const statusStats = await prisma.job.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        status: true,
      },
    });
    
    // Stats par type
    const typeStats = await prisma.job.groupBy({
      by: ['type'],
      where: { userId },
      _count: {
        type: true,
      },
    });
    
    // Temps de traitement moyen
    const avgProcessingTime = await prisma.job.aggregate({
      where: { 
        userId,
        status: 'COMPLETED',
        processingTime: { not: null }
      },
      _avg: {
        processingTime: true,
      },
    });
    
    return {
      totalJobs: totalStats._count.id,
      byStatus: statusStats.reduce((acc, item) => {
        acc[item.status.toLowerCase()] = item._count.status;
        return acc;
      }, {}),
      byType: typeStats.reduce((acc, item) => {
        acc[item.type.toLowerCase()] = item._count.type;
        return acc;
      }, {}),
      avgProcessingTime: Math.round(avgProcessingTime._avg.processingTime || 0),
    };
  }
  
  // Obtenir les jobs récents d'un utilisateur
  static async getRecentJobs(userId, limit = 10) {
    return await prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        settings: true,
        processingTime: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }
  
  // Reset des crédits quotidiens (tâche cron)
  static async resetDailyCredits() {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await prisma.user.updateMany({
      where: {
        plan: 'FREE',
        lastReset: {
          lt: new Date(today),
        },
      },
      data: {
        creditsUsedToday: 0,
        lastReset: new Date(today),
      },
    });
    
    return result.count;
  }
  
  // Statistiques globales des utilisateurs
  static async getGlobalUserStats() {
    const totalUsers = await prisma.user.count();
    
    const planStats = await prisma.user.groupBy({
      by: ['plan'],
      _count: {
        plan: true,
      },
    });
    
    // Utilisateurs actifs (ayant fait au moins 1 job)
    const activeUsers = await prisma.user.count({
      where: {
        jobs: {
          some: {},
        },
      },
    });
    
    return {
      totalUsers,
      activeUsers,
      byPlan: planStats.reduce((acc, item) => {
        acc[item.plan.toLowerCase()] = item._count.plan;
        return acc;
      }, {}),
    };
  }
}

module.exports = UserService;