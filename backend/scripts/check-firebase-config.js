// backend/scripts/check-firebase-config.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const varName = 'FIREBASE_SERVICE_ACCOUNT_PATH';
const configPath = process.env[varName];

console.log(`Vérification de la variable ${varName} dans .env...`);
if (!configPath) {
  console.error(`❌ Variable ${varName} absente ou vide dans .env`);
  process.exit(1);
}

const absPath = path.resolve(__dirname, '../', configPath);
console.log(`Chemin du fichier de service Firebase : ${absPath}`);
if (!fs.existsSync(absPath)) {
  console.error(`❌ Fichier de service Firebase introuvable à : ${absPath}`);
  process.exit(1);
}

console.log('✅ Configuration Firebase OK : variable et fichier présents.');
process.exit(0); 