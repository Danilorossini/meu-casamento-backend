// 1. Importar as ferramentas
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken'); // Importamos a biblioteca JWT

// 2. Criar o nosso aplicativo
const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3001;
const saltRounds = 10;
const JWT_SECRET = 'seu_segredo_super_secreto_e_longo_para_jwt'; // Chave secreta para assinar os tokens

// =================================================================
// ==> NOSSAS ROTAS DA API <==

// ... (as rotas GET, POST, DELETE, PUT de /api/casais continuam exatamente iguais) ...

// Rota para buscar todos os casais (Read)
app.get('/api/casais', (req, res) => {
  const sql = "SELECT * FROM casais";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    return res.json(data);
  });
});

// Rota para criar um novo casal (Create)
app.post('/api/casais', (req, res) => {
  const { nome_completo, email, senha, url_site, data_casamento } = req.body;
  bcrypt.hash(senha, saltRounds, (err, hash) => {
    if (err) return res.status(500).json({ error: "Erro ao processar sua requisição." });
    const sql = "INSERT INTO casais (nome_completo, email, senha, url_site, data_casamento) VALUES (?, ?, ?, ?, ?)";
    const values = [nome_completo, email, hash, url_site, data_casamento || null];
    db.query(sql, values, (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Email ou URL do site já existem." });
        return res.status(500).json({ error: "Erro interno do servidor." });
      }
      return res.status(201).json({ message: "Casal criado com sucesso!", id: result.insertId });
    });
  });
});

// Rota para apagar um casal pelo ID (Delete)
app.delete('/api/casais/:id', (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM casais WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Casal não encontrado." });
    return res.json({ message: "Casal apagado com sucesso!" });
  });
});

// Rota para atualizar um casal pelo ID (Update)
app.put('/api/casais/:id', (req, res) => {
  const { id } = req.params;
  const { nome_completo, email, senha, url_site, data_casamento } = req.body;
  const sql = "UPDATE casais SET nome_completo = ?, email = ?, senha = ?, url_site = ?, data_casamento = ? WHERE id = ?";
  const values = [nome_completo, email, senha, url_site, data_casamento || null, id];
  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Casal não encontrado." });
    return res.json({ message: "Casal atualizado com sucesso!" });
  });
});

// Rota de Login (Autenticação) - MODIFICADA PARA GERAR TOKEN
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const sql = "SELECT * FROM casais WHERE email = ?";
  db.query(sql, [email], (err, data) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    if (data.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });

    const usuario = data[0];
    const senhaHash = usuario.senha;

    bcrypt.compare(senha, senhaHash, (err, isMatch) => {
      if (err) return res.status(500).json({ error: "Erro ao verificar a senha." });
      
      if (isMatch) {
        // Se a senha bate, criamos o payload do token
        const payload = { id: usuario.id, email: usuario.email };
        // Geramos o token com o payload e a chave secreta
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' }); // Token expira em 1 hora

        // Enviamos o token de volta para o cliente
        return res.json({ message: "Login bem-sucedido!", token: token });
      } else {
        return res.status(401).json({ error: "Senha incorreta." });
      }
    });
  });
});

// =================================================================

// 3. Configurar a conexão com o banco de dados
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'meu_casamento_db'
});

// 4. Tentar conectar ao banco de dados
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('Conexão com o banco de dados MySQL estabelecida com sucesso!');

  // 5. Ligar o servidor
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});