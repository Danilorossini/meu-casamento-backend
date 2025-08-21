const jwt = require('jsonwebtoken');
const db = require('./db'); // Precisaremos de uma pequena mudança para importar o DB

async function verificaAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.query("SELECT is_admin FROM casais WHERE id = ?", [decoded.id]);

    if (rows.length === 0 || !rows[0].is_admin) {
      return res.sendStatus(403); // Proibido! Não é um admin.
    }

    req.usuario = decoded;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
}

module.exports = verificaAdmin;