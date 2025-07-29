// ================================
// scripts/cleanup-prisma.js - Nettoyage avec Prisma
const fs = require('fs').promises;
const path = require('path');
const { prisma } = require('../config/prisma');
const UserService = require('../lib/userService');
const JobService = require('../lib/jobService');

async function cleanupWithPrisma() {
  console.log('🧹 Nettoyage avec Prisma...');
  
  try {
    // 1. Nettoyer les fichiers anciens
    const uploadDir = path.join(__dirname, '../uploads');
    const processedDir = path.join(__dirname, '../uploads/processed');
    
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24h
    let filesDeleted = 0;
    
    for (const dir of [uploadDir, processedDir]) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath);
            filesDeleted++;
          }
        }
      } catch (error) {
        console.warn(`Erreur nettoyage ${dir}:`, error.message);
      }
    }
    
    console.log(`✅ ${filesDeleted} fichiers supprimés`);
    
    // 2. Nettoyer les jobs anciens avec Prisma
    const deletedJobs = await JobService.cleanupOldJobs(7, ['COMPLETED', 'FAILED']);
    console.log(`✅ ${deletedJobs} jobs anciens supprimés`);
    
    // 3. Reset des crédits quotidiens avec Prisma
    const resetUsers = await UserService.resetDailyCredits();
    console.log(`✅ ${resetUsers} quotas utilisateurs réinitialisés`);
    
    // 4. Statistiques finales avec Prisma
    const [jobStats, userStats] = await Promise.all([
      JobService.getGlobalStats(),
      UserService.getGlobalUserStats()
    ]);
    
    console.log('📊 Statistiques après nettoyage:');
    console.log(`   Jobs: ${jobStats.totalJobs} total, ${jobStats.activeJobs} actifs`);
    console.log(`   Users: ${userStats.totalUsers} total, ${userStats.activeUsers} actifs`);
    console.log(`   Plans: Free=${userStats.byPlan.free || 0}, Premium=${userStats.byPlan.premium || 0}, Pro=${userStats.byPlan.pro || 0}`);
    
    // 5. Vérification intégrité base de données
    console.log('🔍 Vérification de l\'intégrité...');
    
    // Jobs orphelins (sans utilisateur)
    const orphanJobs = await prisma.job.count({
      where: { userId: null }
    });
    
    if (orphanJobs > 0) {
      console.warn(`⚠️ ${orphanJobs} jobs sans utilisateur trouvés`);
    }
    
    // Users sans email
    const invalidUsers = await prisma.user.count({
      where: { email: '' }
    });
    
    if (invalidUsers > 0) {
      console.warn(`⚠️ ${invalidUsers} utilisateurs sans email trouvés`);
    }
    
    console.log('✅ Nettoyage terminé');
    
  } catch (error) {
    console.error('❌ Erreur nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Auto-nettoyage programmé
function scheduleAutoCleanup() {
  // Nettoyage toutes les 6 heures
  setInterval(async () => {
    console.log('🔄 Nettoyage automatique programmé...');
    await cleanupWithPrisma();
  }, 6 * 60 * 60 * 1000);
  
  console.log('⏰ Nettoyage automatique programmé (toutes les 6h)');
}

if (require.main === module) {
  cleanupWithPrisma();
}

module.exports = {
  cleanupWithPrisma,
  scheduleAutoCleanup
};


