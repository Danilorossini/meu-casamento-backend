const mysql = require('mysql2/promise');

// Lê as configurações das variáveis de ambiente
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Adiciona uma camada de segurança SSL/TLS à ligação
  // Rejeita ligações que não são seguras, o que é preferido por muitos hosts
  ssl: {
    rejectUnauthorized: false 
  }
};

// Cria o "pool" de ligações com a nova configuração
const db = mysql.createPool(dbConfig);

module.exports = db;

