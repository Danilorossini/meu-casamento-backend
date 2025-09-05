const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config');

function verificaToken(req, res, next) {
    // Adiciona logs para depuração
    console.log('--- Iniciando verificação de token ---');
    console.log('Segredo JWT sendo usado no servidor:', JWT_SECRET); // Mostra qual segredo está em uso

    const authHeader = req.headers['authorization'];
    console.log('Cabeçalho de autorização recebido:', authHeader);

    if (!authHeader) {
        console.error('ERRO: Cabeçalho de autorização em falta.');
        return res.status(403).json({ error: "Token não fornecido." });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        console.error('ERRO: Token mal formatado ou em falta após "Bearer".');
        return res.status(403).json({ error: "Token mal formatado." });
    }

    console.log('Token extraído para verificação:', token);

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('ERRO na verificação do JWT:', err.message);
            // Mostra detalhes do erro para ajudar a diagnosticar
            if (err.name === 'JsonWebTokenError') {
                console.error('Detalhe: O token é inválido ou o segredo não corresponde.');
            } else if (err.name === 'TokenExpiredError') {
                console.error('Detalhe: O token expirou.');
            }
            return res.status(403).json({ error: "Token inválido ou expirado." });
        }

        console.log('Token decodificado com sucesso:', decoded);
        req.usuario = decoded; // Anexa os dados do usuário (ex: id, email) à requisição
        console.log('--- Verificação de token concluída com sucesso ---');
        next(); // Continua para a próxima rota
    });
}

module.exports = verificaToken;

