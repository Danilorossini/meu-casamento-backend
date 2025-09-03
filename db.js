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
};

// --- LOG DE DIAGNÓSTICO ---
// Isto irá aparecer nos logs do Render quando o servidor iniciar,
// mostrando-nos exatamente as configurações que ele está a usar.
console.log("--- INICIANDO COM A SEGUINTE CONFIGURAÇÃO DE DB ---");
console.log({ ...dbConfig, password: '*** SENHA OCULTA ***' });
console.log("-------------------------------------------------");

// Cria o "pool" de ligações
const db = mysql.createPool(dbConfig);

module.exports = db;

