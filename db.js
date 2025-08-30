// db.js (Versão Corrigida e Pronta para Produção)
const mysql = require('mysql2/promise');

// Garante que as variáveis de ambiente sejam carregadas
require('dotenv').config();

// Cria o "pool" de conexões usando as variáveis de ambiente
const db = mysql.createPool({
  // A sintaxe process.env.NOME_DA_VARIAVEL lê o valor do ambiente.
  // Se estiver no Render, ele usa as configurações de lá.
  // Se estiver localmente, ele procura num ficheiro .env.
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306, // Usa a porta do ambiente ou a padrão 3306
  
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;
