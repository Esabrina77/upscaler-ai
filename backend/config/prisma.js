// ================================
// config/prisma.js - Client Prisma
const { PrismaClient } = require('@prisma/client');

// Configuration du client Prisma avec gestion d'erreurs
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  errorFormat: 'minimal',
});

// Gestion des erreurs de connexion
prisma.$connect()
  .then(() => {
    console.log('✅ Prisma connecté à PostgreSQL');
  })
  .catch((error) => {
    console.error('❌ Erreur connexion Prisma:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

// Helper pour les transactions
const withTransaction = async (callback) => {
  return await prisma.$transaction(callback);
};

// Helper pour les requêtes raw si nécessaire
const rawQuery = async (query, params = []) => {
  return await prisma.$queryRawUnsafe(query, ...params);
};

module.exports = {
  prisma,
  withTransaction,
  rawQuery
};