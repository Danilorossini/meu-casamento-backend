// Importa e configura o dotenv para ler variáveis do ficheiro .env
require('dotenv').config();

module.exports = {
  // Tenta usar a variável de ambiente JWT_SECRET. 
  // Se não existir, usa a string secreta como um fallback.
  JWT_SECRET: process.env.JWT_SECRET || 'd8f054308e3945399ab177c02d5e4389'
};