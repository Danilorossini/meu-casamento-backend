// 1. Importar as ferramentas
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const verificaToken = require('./verificaToken');

// 2. Criar o nosso aplicativo
const app = express();
app.use(cors());
app.use(express.json());
const PORT = 3001;
const saltRounds = 10;
const JWT_SECRET = 'seu_segredo_super_secreto_e_longo_para_jwt'; 

// =================================================================
// ==> NOSSAS ROTAS DA API <==

// ... (outras rotas) ...

// Rota de Login (Autenticação) - COM SONDA DE TESTE
app.post('/api/login', (req, res) => {
  // --- SONDA NO BACK-END ---
  console.log(`[${new Date().toLocaleTimeString()}] Recebida requisição de login para o email:`, req.body.email);
  // -----------------------

  const { email, senha } = req.body;
  const sql = "SELECT * FROM casais WHERE email = ?";
  db.query(sql, [email], (err, data) => {
    if (err) {
      console.error("Erro na consulta ao banco:", err);
      return res.status(500).json({ error: "Erro interno do servidor." });
    }
    if (data.length === 0) {
      console.log(`Tentativa de login falhou: Email ${email} não encontrado.`);
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const usuario = data[0];
    bcrypt.compare(senha, usuario.senha, (err, isMatch) => {
      if (err) {
        console.error("Erro ao comparar senha:", err);
        return res.status(500).json({ error: "Erro ao verificar a senha." });
      }
      if (isMatch) {
        console.log(`Login bem-sucedido para o usuário: ${email}`);
        const payload = { id: usuario.id, email: usuario.email };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        return res.json({ message: "Login bem-sucedido!", token: token });
      } else {
        console.log(`Tentativa de login falhou: Senha incorreta para o email ${email}.`);
        return res.status(401).json({ error: "Senha incorreta." });
      }
    });
  });
});

// ... (O restante do seu código completo está abaixo para referência, copie o bloco inteiro)
// =================================================================
// Rota Principal (Boas-vindas)
app.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API do Meu Casamento!' });
});
// Rota para buscar os dados do usuário LOGADO - PROTEGIDA
app.get('/api/meus-dados', verificaToken, (req, res) => {
  const idDoUsuario = req.usuario.id;
  const sql = "SELECT id, nome_completo, email, data_casamento, url_site FROM casais WHERE id = ?";
  db.query(sql, [idDoUsuario], (err, data) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    if (data.length === 0) return res.status(404).json({ error: "Usuário não encontrado no banco de dados." });
    return res.json(data[0]);
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
app.delete('/api/casais/:id', verificaToken, (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM casais WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    if (result.affectedRows === 0) return res.status(404).json({ error: "Casal não encontrado." });
    return res.json({ message: "Casal apagado com sucesso!" });
  });
});
// Rota para atualizar um casal pelo ID (Update)
app.put('/api/casais/:id', verificaToken, (req, res) => {
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
// Rota para buscar todos os casais (Read) - PROTEGIDA
app.get('/api/casais', verificaToken, (req, res) => {
  const sql = "SELECT id, nome_completo, email, data_casamento, url_site, data_criacao FROM casais";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor." });
    return res.json(data);
  });
});
// Rota para CRIAR um novo presente (Protegida)
app.post('/api/presentes', verificaToken, (req, res) => {
  const casal_id = req.usuario.id;
  const { descricao, valor, imagem_url } = req.body;
  const sql = "INSERT INTO presentes (descricao, valor, imagem_url, casal_id) VALUES (?, ?, ?, ?)";
  const values = [descricao, valor, imagem_url || null, casal_id];
  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor ao criar presente." });
    return res.status(201).json({ message: "Presente adicionado com sucesso!", id: result.insertId });
  });
});
// Rota para LER os presentes do casal logado (Protegida)
app.get('/api/presentes', verificaToken, (req, res) => {
  const casal_id = req.usuario.id;
  const sql = "SELECT * FROM presentes WHERE casal_id = ?";
  db.query(sql, [casal_id], (err, data) => {
    if (err) return res.status(500).json({ error: "Erro interno do servidor ao buscar presentes." });
    return res.json(data);
  });
});
// Conexão com o banco
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'meu_casamento_db'
});
db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    return;
  }
  console.log('Conexão com o banco de dados MySQL estabelecida com sucesso!');
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});