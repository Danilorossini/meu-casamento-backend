// Este ficheiro verifica se o utilizador tem permissões de administrador.

function verificaAdmin(req, res, next) {
    // Este middleware deve ser usado SEMPRE DEPOIS do `verificaToken`.
    // O `verificaToken` já confirmou que o token é válido e adicionou `req.usuario`.

    // Verificamos se o campo `is_admin` no token é verdadeiro (ou 1 no banco de dados).
    if (req.usuario && req.usuario.is_admin) {
        // Se for administrador, permite que a requisição continue para a rota final.
        next();
    } else {
        // Se não for administrador, bloqueia o acesso com um erro 403 (Forbidden).
        res.status(403).json({ error: 'Acesso negado. Rota exclusiva para administradores.' });
    }
}

module.exports = verificaAdmin;

