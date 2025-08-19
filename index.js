// 1. Importar as ferramentas
const express = require('express');
const mysql = require('mysql2/promise');
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

// 3. Configuração da Conexão com o Banco de Dados
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'meu_casamento_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// =================================================================
// ==> NOSSAS ROTAS DA API <==

// Rota Principal (Boas-vindas)
app.get('/', (req, res) => {
  res.json({ message: 'Bem-vindo à API do Meu Casamento!' });
});

// --- ROTAS PÚBLICAS ---

app.post('/api/casais', async (req, res) => {
  try {
    const { nome_completo, email, senha, url_site, data_casamento } = req.body;
    const hash = await bcrypt.hash(senha, saltRounds);
    const sql = "INSERT INTO casais (nome_completo, email, senha, url_site, data_casamento) VALUES (?, ?, ?, ?, ?)";
    const values = [nome_completo, email, hash, url_site, data_casamento || null];
    const [result] = await db.query(sql, values);
    return res.status(201).json({ message: "Casal criado com sucesso!", id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Email ou URL do site já existem." });
    console.error("Erro ao criar casal:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    const sql = "SELECT * FROM casais WHERE email = ?";
    const [rows] = await db.query(sql, [email]);
    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    const usuario = rows[0];
    const isMatch = await bcrypt.compare(senha, usuario.senha);
    if (isMatch) {
      const payload = { id: usuario.id, email: usuario.email };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ message: "Login bem-sucedido!", token: token });
    } else {
      return res.status(401).json({ error: "Senha incorreta." });
    }
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

app.post('/api/public/rsvp/auth', async (req, res) => {
  try {
    const { url_site, senha_rsvp } = req.body;
    const sql = `
      SELECT g.id, g.nome_grupo FROM grupos_convidados g
      JOIN casais c ON g.casal_id = c.id
      WHERE c.url_site = ? AND g.senha_rsvp = ?
    `;
    const [grupos] = await db.query(sql, [url_site, senha_rsvp]);

    if (grupos.length === 0) {
      return res.status(404).json({ error: "Convite não encontrado. Verifique a senha e tente novamente." });
    }

    const grupo = grupos[0];
    const sqlConvidados = "SELECT id, nome_completo, is_crianca, status_confirmacao FROM convidados_individuais WHERE grupo_id = ?";
    const [convidados] = await db.query(sqlConvidados, [grupo.id]);
    
    res.json({
      grupo_id: grupo.id,
      nome_grupo: grupo.nome_grupo,
      convidados: convidados
    });
  } catch (err) {
    console.error("Erro na autenticação do convidado:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
});

app.put('/api/public/rsvp/confirmar/:grupoId', async (req, res) => {
  const { grupoId } = req.params;
  const confirmacoes = req.body; 

  if (!Array.isArray(confirmacoes)) {
    return res.status(400).json({ error: "Formato de dados inválido." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const convidado of confirmacoes) {
      const status = convidado.confirmado ? 'Confirmado' : 'Recusado';
      const sql = "UPDATE convidados_individuais SET nome_completo = ?, status_confirmacao = ? WHERE id = ? AND grupo_id = ?";
      await connection.query(sql, [convidado.nome_completo, status, convidado.id, grupoId]);
    }
    await connection.commit();
    res.json({ message: "Confirmação recebida com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao salvar confirmação de RSVP:", err);
    res.status(500).json({ error: "Erro ao salvar a confirmação." });
  } finally {
    connection.release();
  }
});


// --- ROTAS PROTEGIDAS (Exigem Token) ---

app.get('/api/meus-dados', verificaToken, async (req, res) => {
  try {
    const idDoUsuario = req.usuario.id;
    const sql = "SELECT id, nome_completo, email, data_casamento, url_site FROM casais WHERE id = ?";
    const [rows] = await db.query(sql, [idDoUsuario]);
    if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." });
    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar dados do usuário:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ROTAS DE PRESENTES
app.post('/api/presentes', verificaToken, async (req, res) => {
  try {
    const casal_id = req.usuario.id;
    const { descricao, valor, imagem_url } = req.body;
    const sql = "INSERT INTO presentes (descricao, valor, imagem_url, casal_id) VALUES (?, ?, ?, ?)";
    const values = [descricao, valor, imagem_url || null, casal_id];
    const [result] = await db.query(sql, values);
    return res.status(201).json({ message: "Presente adicionado com sucesso!", id: result.insertId });
  } catch (err) {
    console.error("Erro ao criar presente:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

app.get('/api/presentes', verificaToken, async (req, res) => {
  try {
    const casal_id = req.usuario.id;
    const sql = "SELECT * FROM presentes WHERE casal_id = ?";
    const [rows] = await db.query(sql, [casal_id]);
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar presentes:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// ROTAS DE CONVIDADOS
app.get('/api/convidados', verificaToken, async (req, res) => {
  const casal_id = req.usuario.id;
  try {
    const sql = `
      SELECT g.id, g.nome_grupo, g.senha_rsvp, i.id as convidado_id, i.nome_completo, i.is_crianca, i.status_confirmacao
      FROM grupos_convidados g LEFT JOIN convidados_individuais i ON g.id = i.grupo_id
      WHERE g.casal_id = ? ORDER BY g.nome_grupo, i.nome_completo;
    `;
    const [rows] = await db.query(sql, [casal_id]);
    const grupos = {};
    rows.forEach(row => {
      if (!grupos[row.id]) {
        grupos[row.id] = { id: row.id, nome_grupo: row.nome_grupo, senha_rsvp: row.senha_rsvp, convidados: [] };
      }
      if (row.convidado_id) {
        grupos[row.id].convidados.push({
          id: row.convidado_id, nome_completo: row.nome_completo,
          is_crianca: !!row.is_crianca, status_confirmacao: row.status_confirmacao
        });
      }
    });
    res.json(Object.values(grupos));
  } catch (err) {
    console.error("Erro ao listar convidados:", err);
    res.status(500).json({ error: "Erro ao listar convidados." });
  }
});

app.post('/api/convidados', verificaToken, async (req, res) => {
  const casal_id = req.usuario.id;
  const { nome_grupo, senha_rsvp, convidados } = req.body;
  if (!nome_grupo || !convidados || !Array.isArray(convidados) || convidados.length === 0) {
    return res.status(400).json({ error: "Dados inválidos." });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const sqlGrupo = "INSERT INTO grupos_convidados (nome_grupo, senha_rsvp, casal_id) VALUES (?, ?, ?)";
    const [resultGrupo] = await connection.query(sqlGrupo, [nome_grupo, senha_rsvp, casal_id]);
    const grupo_id = resultGrupo.insertId;
    const sqlConvidados = "INSERT INTO convidados_individuais (nome_completo, is_crianca, grupo_id) VALUES ?";
    const valuesConvidados = convidados.map(c => [c.nome_completo, c.is_crianca || false, grupo_id]);
    await connection.query(sqlConvidados, [valuesConvidados]);
    await connection.commit();
    res.status(201).json({ message: "Grupo de convidados adicionado com sucesso!", id: grupo_id });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao adicionar grupo de convidados:", err);
    res.status(500).json({ error: "Erro ao adicionar grupo de convidados." });
  } finally {
    connection.release();
  }
});

app.put('/api/convidados/grupos/:id', verificaToken, async (req, res) => {
  const casal_id = req.usuario.id;
  const grupo_id = req.params.id;
  const { nome_grupo, senha_rsvp, convidados } = req.body;
  if (!nome_grupo || !convidados || !Array.isArray(convidados)) {
    return res.status(400).json({ error: "Dados inválidos." });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const sqlUpdateGrupo = "UPDATE grupos_convidados SET nome_grupo = ?, senha_rsvp = ? WHERE id = ? AND casal_id = ?";
    const [result] = await connection.query(sqlUpdateGrupo, [nome_grupo, senha_rsvp, grupo_id, casal_id]);
    if (result.affectedRows === 0) throw new Error('Grupo não encontrado ou não pertence ao usuário.');
    const sqlDeleteConvidados = "DELETE FROM convidados_individuais WHERE grupo_id = ?";
    await connection.query(sqlDeleteConvidados, [grupo_id]);
    if (convidados.length > 0) {
      const sqlInsertConvidados = "INSERT INTO convidados_individuais (nome_completo, is_crianca, status_confirmacao, grupo_id) VALUES ?";
      const valuesConvidados = convidados.map(c => [c.nome_completo, c.is_crianca || false, c.status_confirmacao || 'Pendente', grupo_id]);
      await connection.query(sqlInsertConvidados, [valuesConvidados]);
    }
    await connection.commit();
    res.json({ message: "Grupo de convidados atualizado com sucesso!" });
  } catch (err) {
    await connection.rollback();
    console.error("Erro ao atualizar grupo de convidados:", err);
    if (err.message.includes('Grupo não encontrado')) return res.status(404).json({ error: err.message });
    res.status(500).json({ error: "Erro ao atualizar grupo de convidados." });
  } finally {
    connection.release();
  }
});

app.delete('/api/grupos-convidados/:id', verificaToken, async (req, res) => {
  const casal_id = req.usuario.id;
  const grupo_id = req.params.id;
  try {
    const sql = "DELETE FROM grupos_convidados WHERE id = ? AND casal_id = ?";
    const [result] = await db.query(sql, [grupo_id, casal_id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Grupo não encontrado ou não pertence a você." });
    return res.json({ message: "Grupo de convidados apagado com sucesso!" });
  } catch (err) {
    console.error("Erro ao apagar grupo:", err);
    return res.status(500).json({ error: "Erro ao apagar grupo." });
  }
});


// =================================================================

// 4. Ligar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});