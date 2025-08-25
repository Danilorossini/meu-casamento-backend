const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config'); // A MESMA chave secreta do index.js

function verificaToken(req, res, next) {
  // O token virá no cabeçalho (header) da requisição
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

  // Se não houver token, barra a entrada
  if (token == null) {
    return res.sendStatus(401); // 401 Unauthorized (Não autorizado)
  }

  // Se houver token, vamos verificar se é válido
  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) {
      return res.sendStatus(403); // 403 Forbidden (Token não é mais válido ou é falso)
    }

    // Se o token for válido, guardamos os dados do usuário na requisição
    req.usuario = usuario;

    // Deixa a requisição continuar para a rota final
    next(); 
  });
}

module.exports = verificaToken;