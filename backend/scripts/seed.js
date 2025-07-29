// ================================
// scripts/seed.js - Données de test avec Prisma
const { prisma } = require('../config/prisma');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  console.log('🌱 Ajout de données de test...');
  
  try {
    // Créer des utilisateurs de test
    const testPassword = await bcrypt.hash('TestPass123', 12);
    
    // Utilisateur gratuit
    const freeUser = await prisma.user.upsert({
      where: { email: 'test.free@aiupscaler.com' },
      update: {},
      create: {
        email: 'test.free@aiupscaler.com',
        passwordHash: testPassword,
        plan: 'FREE',
        creditsRemaining: 5,
      },
    });
    
    // Utilisateur premium
    const premiumUser = await prisma.user.upsert({
      where: { email: 'test.premium@aiupscaler.com' },
      update: {},
      create: {
        email: 'test.premium@aiupscaler.com',
        passwordHash: testPassword,
        plan: 'PREMIUM',
        creditsRemaining: 100,
      },
    });
    
    // Utilisateur pro
    const proUser = await prisma.user.upsert({
      where: { email: 'test.pro@aiupscaler.com' },
      update: {},
      create: {
        email: 'test.pro@aiupscaler.com',
        passwordHash: testPassword,
        plan: 'PRO',
        creditsRemaining: 500,
      },
    });
    
    console.log('✅ Utilisateurs de test créés :');
    console.log(`   - Free: ${freeUser.email}`);
    console.log(`   - Premium: ${premiumUser.email}`);
    console.log(`   - Pro: ${proUser.email}`);
    
    // Créer des jobs de test
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
    for (const jobData of jobsData) {
      await prisma.job.create({ data: jobData });
    }
    
    console.log('✅ Jobs de test créés');
    
    // Statistiques finales
    const stats = await prisma.user.count();
    const jobStats = await prisma.job.count();
    
    console.log(`📊 Données de test ajoutées :`);
    console.log(`   - Utilisateurs : ${stats}`);
    console.log(`   - Jobs : ${jobStats}`);
    
    console.log('\n🔑 Identifiants de test :');
    console.log('Email: test.free@aiupscaler.com | Mot de passe: TestPass123');
    console.log('Email: test.premium@aiupscaler.com | Mot de passe: TestPass123');
    console.log('Email: test.pro@aiupscaler.com | Mot de passe: TestPass123');
    
  } catch (error) {
    console.error('❌ Erreur seed :', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
