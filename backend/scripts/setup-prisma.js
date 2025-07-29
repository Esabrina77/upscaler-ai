
// ================================
// scripts/setup-prisma.js - Script d'initialisation Prisma
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function setupPrisma() {
  console.log('🔧 Configuration de Prisma...');
  
  try {
    // Vérifier que le fichier .env existe avec DATABASE_URL
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found');
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    if (!envContent.includes('DATABASE_URL')) {
      console.log('⚠️ Ajout de DATABASE_URL dans .env...');
      
      const databaseUrl = '\n# Base de données PostgreSQL avec Prisma\nDATABASE_URL="postgresql://ai_upscaler_user:ai_upscaler_2024!@localhost:5432/ai_upscaler"\n';
      fs.appendFileSync(envPath, databaseUrl);
      
      console.log('✅ DATABASE_URL ajoutée');
    }
    
    // Générer le client Prisma
    console.log('📦 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Créer et appliquer la migration initiale
    console.log('🗄️ Création de la migration initiale...');
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
    
    console.log('✅ Prisma configuré avec succès !');
    
    // Vérifier la connexion
    const { prisma } = require('../config/prisma');
    const userCount = await prisma.user.count();
    const jobCount = await prisma.job.count();
    
    console.log('📊 État de la base de données :');
    console.log(`   - Utilisateurs : ${userCount}`);
    console.log(`   - Jobs : ${jobCount}`);
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Erreur setup Prisma :', error.message);
    
    if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n💡 Solution :');
      console.log('1. Assurez-vous que PostgreSQL est démarré');
      console.log('2. Créez la base de données : sudo -u postgres createdb ai_upscaler');
      console.log('3. Créez l\'utilisateur avec les commandes SQL fournies');
    }
    
    process.exit(1);
  }
}

// Lancer le setup si appelé directement
if (require.main === module) {
  setupPrisma();
}

module.exports = setupPrisma;