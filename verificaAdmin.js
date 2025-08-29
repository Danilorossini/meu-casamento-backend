// verificaAdmin.js - VERSÃO DE DIAGNÓSTICO
const jwt = require('jsonwebtoken');
const db = require('./db');
const { JWT_SECRET } = require('./config');

async function verificaAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    console.log('[VerificaAdmin] ERRO: Token não encontrado.');
    return res.sendStatus(401);
  }

  try {
    // --- INÍCIO DO DIAGNÓSTICO ---
    console.log('\n--- [VerificaAdmin] Iniciando verificação ---');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('[VerificaAdmin] Token decodificado com sucesso. Conteúdo:', decoded);

    const [rows] = await db.query("SELECT is_admin FROM casais WHERE id = ?", [decoded.id]);
    console.log(`[VerificaAdmin] Consulta à base de dados para o ID ${decoded.id} retornou:`, rows);

    if (rows.length === 0) {
      console.log('[VerificaAdmin] ERRO: Nenhum usuário encontrado na base de dados com este ID.');
      return res.sendStatus(403);
    }
    
    const isAdmin = rows[0].is_admin;
    console.log(`[VerificaAdmin] O valor de 'is_admin' para este usuário é: ${isAdmin} (Tipo: ${typeof isAdmin})`);

    if (!isAdmin) {
      console.log('[VerificaAdmin] ACESSO NEGADO: O usuário não é um administrador.');
      return res.sendStatus(403);
    }
    // --- FIM DO DIAGNÓSTICO ---

    console.log('[VerificaAdmin] SUCESSO: Acesso de administrador concedido.');
    req.usuario = decoded;
    next();

  } catch (err) {
    console.error('[VerificaAdmin] ERRO: Ocorreu uma exceção durante a verificação.', err.message);
    return res.sendStatus(403);
  }
}

module.exports = verificaAdmin;
