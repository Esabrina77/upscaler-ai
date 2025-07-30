// scripts/seed.js - Données de test avec Prisma (CORRIGÉ)
const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  console.log('🌱 Initialisation des données de test...');
  
  try {
    // 🗑️ Supprimer les anciennes données de test
    console.log('🧹 Suppression des anciennes données...');
    
    // Supprimer les jobs de test en premier (contrainte de clé étrangère)
    const deletedJobs = await prisma.job.deleteMany({
      where: {
        OR: [
          { inputFile: { contains: 'test-' } },
          { outputFile: { contains: 'test-' } },
          { inputFile: { contains: 'corrupted-' } }
        ]
      }
    });
    console.log(`   - ${deletedJobs.count} jobs de test supprimés`);
    
    // Supprimer les utilisateurs de test
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test.free@aiupscaler.com',
            'test.premium@aiupscaler.com', 
            'test.pro@aiupscaler.com'
          ]
        }
      }
    });
    console.log(`   - ${deletedUsers.count} utilisateurs de test supprimés`);
    
    // ✨ Créer des utilisateurs de test frais
    console.log('✨ Création de nouveaux utilisateurs de test...');
    const testPassword = await bcrypt.hash('TestPass123', 12);
    
    // Utilisateur gratuit - CORRIGÉ: utilise passwordHash
    const freeUser = await prisma.user.create({
      data: {
        email: 'test.free@aiupscaler.com',
        passwordHash: testPassword, // ✅ CORRIGÉ: passwordHash au lieu de password_hash
        plan: 'FREE',
        creditsRemaining: 5,
      },
    });
    
    // Utilisateur premium
    const premiumUser = await prisma.user.create({
      data: {
        email: 'test.premium@aiupscaler.com',
        passwordHash: testPassword, // ✅ CORRIGÉ
        plan: 'PREMIUM',
        creditsRemaining: 100,
      },
    });
    
    // Utilisateur pro
    const proUser = await prisma.user.create({
      data: {
        email: 'test.pro@aiupscaler.com',
        passwordHash: testPassword, // ✅ CORRIGÉ
        plan: 'PRO',
        creditsRemaining: 500,
      },
    });
    
    console.log('✅ Utilisateurs de test créés :');
    console.log(`   - Free: ${freeUser.email} (ID: ${freeUser.id})`);
    console.log(`   - Premium: ${premiumUser.email} (ID: ${premiumUser.id})`);
    console.log(`   - Pro: ${proUser.email} (ID: ${proUser.id})`);
    
    // ✨ Créer des jobs de test frais
    console.log('✨ Création de nouveaux jobs de test...');
    const jobsData = [
      // Jobs pour utilisateur gratuit
      {
        userId: freeUser.id,
        type: 'IMAGE',
        status: 'COMPLETED',
        inputFile: '/uploads/test-input-1.jpg',
        outputFile: '/uploads/test-output-1.jpg',
        settings: { scale: 2, model: 'waifu2x' },
        progress: 100,
        processingTime: 15,
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2h
      },
      {
        userId: freeUser.id,
        type: 'IMAGE',
        status: 'PENDING',
        inputFile: '/uploads/test-input-2.jpg',
        settings: { scale: 4, model: 'real-esrgan' },
        progress: 0,
      },
      
      // Jobs pour utilisateur premium
      {
        userId: premiumUser.id,
        type: 'IMAGE',
        status: 'COMPLETED',
        inputFile: '/uploads/test-input-3.png',
        outputFile: '/uploads/test-output-3.png',
        settings: { scale: 8, model: 'real-esrgan' },
        progress: 100,
        processingTime: 45,
        completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // Il y a 1h
      },
      {
        userId: premiumUser.id,
        type: 'VIDEO',
        status: 'PROCESSING',
        inputFile: '/uploads/test-video.mp4',
        settings: { scale: 2, model: 'real-cugan', fps: 60 },
        progress: 65,
      },
      
      // Jobs pour utilisateur pro
      {
        userId: proUser.id,
        type: 'VIDEO',
        status: 'COMPLETED',
        inputFile: '/uploads/test-video-pro.mp4',
        outputFile: '/uploads/test-video-pro-enhanced.mp4',
        settings: { scale: 4, model: 'real-cugan', interpolation: true },
        progress: 100,
        processingTime: 180,
        completedAt: new Date(Date.now() - 30 * 60 * 1000), // Il y a 30min
      },
      {
        userId: proUser.id,
        type: 'IMAGE',
        status: 'FAILED',
        inputFile: '/uploads/corrupted-image.jpg',
        settings: { scale: 8, model: 'real-esrgan' },
        progress: 25,
        errorMessage: 'Image corrompue - impossible de traiter',
      },
    ];
    
    // Insérer les jobs un par un pour avoir les bonnes dates
    let jobsCreated = 0;
    for (const jobData of jobsData) {
      await prisma.job.create({ data: jobData });
      jobsCreated++;
    }
    
    console.log(`✅ ${jobsCreated} jobs de test créés`);
    
    // 📊 Statistiques finales
    const stats = await prisma.user.count();
    const jobStats = await prisma.job.count();
    
    console.log(`\n📊 État final de la base de données :`);
    console.log(`   - Utilisateurs total : ${stats}`);
    console.log(`   - Jobs total : ${jobStats}`);
    
    console.log('\n🔑 Identifiants de test créés :');
    console.log('   Email: test.free@aiupscaler.com | Mot de passe: TestPass123');
    console.log('   Email: test.premium@aiupscaler.com | Mot de passe: TestPass123');
    console.log('   Email: test.pro@aiupscaler.com | Mot de passe: TestPass123');
    
    console.log('\n✅ Données de test initialisées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation des données :', error);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;