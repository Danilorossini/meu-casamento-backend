const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config'); // Certifique-se que o caminho para o seu segredo está correto

const verificaAdmin = (req, res, next) => {
  // 1. Obter o cabeçalho de autorização da requisição
  const authHeader = req.headers['authorization'];

  // 2. Verificar se o cabeçalho foi enviado
  // Se não houver cabeçalho, o acesso é negado imediatamente.
  if (!authHeader) {
    console.error('[verificaAdmin] Erro: Cabeçalho de autorização em falta.');
    return res.status(401).json({ error: 'Acesso negado. Nenhum token fornecido.' });
  }

  // 3. Extrair o token do cabeçalho
  // O frontend envia no formato "Bearer TOKEN_AQUI"
  // Nós dividimos a string pelo espaço e pegamos a segunda parte.
  const tokenParts = authHeader.split(' ');

  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    console.error('[verificaAdmin] Erro: Token mal formatado. Formato esperado "Bearer <token>".');
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  const token = tokenParts[1];

  try {
    // 4. Verificar se o token é válido usando o segredo
    const decoded = jwt.verify(token, JWT_SECRET);

    // 5. VERIFICAÇÃO CRÍTICA: Checar se o payload do token contém a flag de admin
    // No seu login, você define `is_admin: !!usuario.is_admin`
    if (decoded && decoded.is_admin) {
      // Se for admin, adicionamos os dados do usuário ao objeto `req` para uso futuro
      req.usuario = decoded;
      // E chamamos `next()` para permitir que a requisição prossiga para a rota final
      next();
    } else {
      // O token é válido, mas o usuário não é um administrador. Acesso proibido.
      console.warn(`[verificaAdmin] Tentativa de acesso negada para o usuário ID: ${decoded.id}. Não é admin.`);
      return res.status(403).json({ error: 'Acesso proibido. Permissões de administrador necessárias.' });
    }
  } catch (err) {
    // Se `jwt.verify` falhar, significa que o token é inválido ou expirou.
    console.error('[verificaAdmin] Erro: Token inválido ou expirado.', err.message);
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

module.exports = verificaAdmin;
