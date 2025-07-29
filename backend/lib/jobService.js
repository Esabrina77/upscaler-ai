
// ================================
// lib/jobService.js - Service job avec Prisma
const { prisma } = require('../config/prisma');

class JobService {
  // Créer un nouveau job
  static async createJob(jobData) {
    const { userId, type, inputFile, settings } = jobData;
    
    return await prisma.job.create({
      data: {
        userId,
        type: type.toUpperCase(),
        inputFile,
        settings: typeof settings === 'object' ? settings : {},
        status: 'PENDING',
      },
      select: {
        id: true,
        userId: true,
        type: true,
        status: true,
        inputFile: true,
        settings: true,
        createdAt: true,
      },
    });
  }
  
  // Trouver job par ID
  static async findById(jobId, userId = null) {
    const where = { id: parseInt(jobId) };
    if (userId) where.userId = userId;
    
    return await prisma.job.findUnique({
      where,
      include: {
        user: {
          select: {
            email: true,
            plan: true,
          },
        },
      },
    });
  }
  
  // Mettre à jour le statut d'un job
  static async updateStatus(jobId, status, additionalData = {}) {
    const updateData = {
      status: status.toUpperCase(),
      updatedAt: new Date(),
    };
    
    // Ajouter les données additionnelles
    if (additionalData.progress !== undefined) {
      updateData.progress = additionalData.progress;
    }
    
    if (additionalData.outputFile) {
      updateData.outputFile = additionalData.outputFile;
    }
    
    if (additionalData.processingTime) {
      updateData.processingTime = additionalData.processingTime;
    }
    
    if (additionalData.errorMessage) {
      updateData.errorMessage = additionalData.errorMessage;
    }
    
    if (status.toUpperCase() === 'COMPLETED') {
      updateData.completedAt = new Date();
    }
    
    return await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: updateData,
      select: {
        id: true,
        status: true,
        progress: true,
        outputFile: true,
        processingTime: true,
        completedAt: true,
      },
    });
  }
  
  // Obtenir les jobs d'un utilisateur avec pagination
  static async getUserJobs(userId, options = {}) {
    const { 
      limit = 20, 
      offset = 0, 
      status, 
      type,
      orderBy = 'createdAt',
      orderDirection = 'desc'
    } = options;
    
    const where = { userId };
    if (status) where.status = status.toUpperCase();
    if (type) where.type = type.toUpperCase();
    
    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          settings: true,
          processingTime: true,
          createdAt: true,
          completedAt: true,
          errorMessage: true,
        },
      }),
      prisma.job.count({ where })
    ]);
    
    return {
      jobs,
      totalCount,
      hasMore: offset + limit < totalCount,
      nextOffset: offset + limit,
    };
  }
  
  // Statistiques globales des jobs
  static async getGlobalStats(daysBack = 7) {
    const dateFilter = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    // Total des jobs
    const totalJobs = await prisma.job.count();
    
    // Stats par statut (derniers X jours)
    const statusStats = await prisma.job.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: dateFilter },
      },
      _count: {
        status: true,
      },
    });
    
    // Stats par type (derniers X jours)
    const typeStats = await prisma.job.groupBy({
      by: ['type'],
      where: {
        createdAt: { gte: dateFilter },
      },
      _count: {
        type: true,
      },
    });
    
    // Temps de traitement moyen
    const avgProcessingTime = await prisma.job.aggregate({
      where: {
        status: 'COMPLETED',
        processingTime: { not: null },
        createdAt: { gte: dateFilter },
      },
      _avg: {
        processingTime: true,
      },
    });
    
    // Jobs en cours
    const activeJobs = await prisma.job.count({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
      },
    });
    
    return {
      totalJobs,
      activeJobs,
      avgProcessingTime: Math.round(avgProcessingTime._avg.processingTime || 0),
      last7Days: {
        byStatus: statusStats.reduce((acc, item) => {
          acc[item.status.toLowerCase()] = item._count.status;
          return acc;
        }, {}),
        byType: typeStats.reduce((acc, item) => {
          acc[item.type.toLowerCase()] = item._count.type;
          return acc;
        }, {}),
      },
    };
  }
  
  // Nettoyer les anciens jobs
  static async cleanupOldJobs(daysOld = 7, statuses = ['COMPLETED', 'FAILED']) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await prisma.job.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: statuses.map(s => s.toUpperCase()) },
      },
    });
    
    return result.count;
  }
  
  // Obtenir les jobs en attente pour processing
  static async getPendingJobs(type = null, limit = 10) {
    const where = {
      status: 'PENDING',
    };
    
    if (type) {
      where.type = type.toUpperCase();
    }
    
    return await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        inputFile: true,
        settings: true,
        createdAt: true,
        user: {
          select: {
            plan: true,
          },
        },
      },
    });
  }
  
  // Obtenir les jobs échoués pour retry
  static async getFailedJobs(limit = 10) {
    return await prisma.job.findMany({
      where: {
        status: 'FAILED',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Dernières 24h
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        userId: true,
        type: true,
        inputFile: true,
        settings: true,
        errorMessage: true,
        createdAt: true,
      },
    });
  }
  
  // Mettre à jour le progress d'un job
  static async updateProgress(jobId, progress) {
    return await prisma.job.update({
      where: { id: parseInt(jobId) },
      data: { 
        progress: Math.max(0, Math.min(100, progress)),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        progress: true,
        status: true,
      },
    });
  }
  
  // Reprendre un job échoué
  static async retryJob(jobId) {
    return await prisma.job.update({
      where: { 
        id: parseInt(jobId),
        status: 'FAILED',
      },
      data: {
        status: 'PENDING',
        progress: 0,
        errorMessage: null,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        inputFile: true,
        settings: true,
      },
    });
  }
  
  // Rechercher des jobs par critères
  static async searchJobs(criteria = {}) {
    const {
      userId,
      status,
      type,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
    } = criteria;
    
    const where = {};
    
    if (userId) where.userId = userId;
    if (status) where.status = status.toUpperCase();
    if (type) where.type = type.toUpperCase();
    
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    
    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              email: true,
              plan: true,
            },
          },
        },
      }),
      prisma.job.count({ where })
    ]);
    
    return {
      jobs,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  }
  
  // Statistiques par utilisateur (pour admin)
  static async getUserJobStats(userId) {
    const [
      totalJobs,
      completedJobs,
      failedJobs,
      avgProcessingTime,
      recentJobs
    ] = await Promise.all([
      prisma.job.count({ where: { userId } }),
      prisma.job.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.job.count({ where: { userId, status: 'FAILED' } }),
      prisma.job.aggregate({
        where: { 
          userId, 
          status: 'COMPLETED',
          processingTime: { not: null }
        },
        _avg: { processingTime: true },
      }),
      prisma.job.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
          processingTime: true,
        },
      })
    ]);
    
    return {
      totalJobs,
      completedJobs,
      failedJobs,
      successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
      avgProcessingTime: Math.round(avgProcessingTime._avg.processingTime || 0),
      recentJobs,
    };
  }
}

module.exports = JobService;