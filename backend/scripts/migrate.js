// ================================
// scripts/migrate.js - Gestion des migrations
const { execSync } = require('child_process');

function runMigration(name) {
  try {
    console.log(`🔄 Création de la migration: ${name}`);
    execSync(`npx prisma migrate dev --name ${name}`, { stdio: 'inherit' });
    console.log('✅ Migration créée et appliquée');
  } catch (error) {
    console.error('❌ Erreur migration:', error.message);
    process.exit(1);
  }
}

function deployMigrations() {
  try {
    console.log('🚀 Déploiement des migrations en production...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('✅ Migrations déployées');
  } catch (error) {
    console.error('❌ Erreur déploiement:', error.message);
    process.exit(1);
  }
}

function resetDatabase() {
  try {
    console.log('⚠️ Reset de la base de données...');
    execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
    console.log('✅ Base de données resetée');
  } catch (error) {
    console.error('❌ Erreur reset:', error.message);
    process.exit(1);
  }
}

function generateClient() {
  try {
    console.log('📦 Génération du client Prisma...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ Client généré');
  } catch (error) {
    console.error('❌ Erreur génération:', error.message);
    process.exit(1);
  }
}

// CLI Interface
if (require.main === module) {
  const command = process.argv[2];
  const name = process.argv[3];
  
  switch (command) {
    case 'create':
      if (!name) {
        console.error('❌ Nom de migration requis: npm run migrate create <nom>');
        process.exit(1);
      }
      runMigration(name);
      break;
      
    case 'deploy':
      deployMigrations();
      break;
      
    case 'reset':
      resetDatabase();
      break;
      
    case 'generate':
      generateClient();
      break;
      
    default:
      console.log('📚 Commandes disponibles:');
      console.log('  npm run migrate create <nom>  - Créer une migration');
      console.log('  npm run migrate deploy        - Déployer en production');
      console.log('  npm run migrate reset         - Reset database');
      console.log('  npm run migrate generate      - Générer client');
  }
}

module.exports = {
  runMigration,
  deployMigrations,
  resetDatabase,
  generateClient
};