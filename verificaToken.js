const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

function verificaToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ error: "Token não fornecido." }); // Unauthorized
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: "Token mal formatado." });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            // Se o token for inválido ou expirado, retornamos 403 Forbidden
            return res.status(403).json({ error: "Token inválido ou expirado." });
        }

        req.usuario = decoded; // Anexa os dados do usuário à requisição
        next(); // Continua para a próxima rota
    });
}

module.exports = verificaToken;
