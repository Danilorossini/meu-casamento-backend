// no topo do index.js
require('dotenv').config(); 
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const verificaToken = require('./verificaToken'); 
const verificaAdmin = require('./verificaAdmin');
const { JWT_SECRET } = require('./config'); 
const db = require('./db'); 

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static('public'));

const PORT = process.env.PORT || 3001;
const saltRounds = 10;

// Função para criar uma URL amigável a partir do nome
const criarUrlAmigavel = (texto) => {
    if (!texto) return '';
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')

    return texto.toString().toLowerCase()
        .replace(/\s+/g, '-') // Substitui espaços por -
        .replace(p, c => b.charAt(a.indexOf(c))) // Substitui caracteres especiais
        .replace(/&/g, '-e-') // Substitui & por '-e-'
        .replace(/[^\w\-]+/g, '') // Remove todos os caracteres não alfanuméricos
        .replace(/\-\-+/g, '-') // Substitui múltiplos - por um único -
        .replace(/^-+/, '') // Remove - do início
        .replace(/-+$/, '') // Remove - do final
};

// Rota de Login (sem alterações)
app.post('/api/login', async (req, res) => { 
    try { 
        const { email, senha } = req.body; 
        const sql = "SELECT * FROM casais WHERE email = ?"; 
        const [rows] = await db.query(sql, [email]); 
        if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." }); 
        const usuario = rows[0]; 
        const isMatch = await bcrypt.compare(senha, usuario.senha); 
        if (isMatch) { 
            const payload = { id: usuario.id, email: usuario.email, is_admin: usuario.is_admin }; 
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' }); 
            return res.json({ message: "Login bem-sucedido!", token: token, is_admin: !!usuario.is_admin }); 
        } else { 
            return res.status(401).json({ error: "Senha incorreta." }); 
        } 
    } catch (err) { 
        console.error("!!! ERRO CRÍTICO NA ROTA DE LOGIN !!!", err);
        return res.status(500).json({ error: "Erro interno do servidor." }); 
    } 
});

// --- ROTA DE CADASTRO DE CASAIS ---
app.post('/api/casais', async (req, res) => { 
    try { 
        const { nome_completo, email, senha, data_casamento } = req.body; 
        const url_site = criarUrlAmigavel(nome_completo);
        const hash = await bcrypt.hash(senha, saltRounds); 
        const sql = "INSERT INTO casais (nome_completo, email, senha, url_site, data_casamento, is_admin, trial_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)"; 
        const trialDate = new Date();
        trialDate.setDate(trialDate.getDate() + 15);
        const values = [nome_completo, email, hash, url_site, data_casamento || null, false, trialDate]; 
        const [result] = await db.query(sql, values); 
        return res.status(201).json({ message: "Casal criado com sucesso!", id: result.insertId }); 
    } catch (err) { 
        console.error("ERRO AO CADASTRAR NOVO CASAL:", err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: "Este email ou nome de casal já foi registado." }); 
        }
        return res.status(500).json({ error: "Erro interno do servidor." }); 
    } 
});

// Rota para buscar os dados do casal logado
app.get('/api/meus-dados', verificaToken, async (req, res) => { 
    try { 
        const idDoUsuario = req.usuario.id; 
        const sql = "SELECT id, nome_completo, email, data_casamento, url_site, local_cerimonia, hora_cerimonia FROM casais WHERE id = ?"; 
        const [rows] = await db.query(sql, [idDoUsuario]); 
        if (rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado." }); 
        return res.json(rows[0]); 
    } catch (err) { 
        console.error("ERRO na rota /api/meus-dados:", err);
        return res.status(500).json({ error: "Erro interno do servidor." }); 
    } 
});

// ROTA DE ATUALIZAÇÃO DE DADOS DO CASAL - CORRIGIDA
app.put('/api/meus-dados', verificaToken, async (req, res) => { 
    try { 
        const idDoUsuario = req.usuario.id; 
        const { nome_completo, email, data_casamento, local_cerimonia, hora_cerimonia } = req.body; 
        const url_site = criarUrlAmigavel(nome_completo);
        const sql = `UPDATE casais SET nome_completo = ?, email = ?, url_site = ?, data_casamento = ?, local_cerimonia = ?, hora_cerimonia = ? WHERE id = ?`; 
        const values = [nome_completo, email, url_site, data_casamento || null, local_cerimonia, hora_cerimonia || null, idDoUsuario]; 
        const [result] = await db.query(sql, values); 
        if (result.affectedRows === 0) return res.status(404).json({ error: "Usuário não encontrado." }); 
        const [updatedUser] = await db.query("SELECT id, nome_completo, email, data_casamento, url_site, local_cerimonia, hora_cerimonia FROM casais WHERE id = ?", [idDoUsuario]); 
        res.json(updatedUser[0]); 
    } catch (err) { 
        console.error("Erro ao atualizar dados do casal:", err);
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: "Este email já está em uso." }); 
        return res.status(500).json({ error: "Erro interno do servidor." }); 
    } 
});

// --- RESTANTE DAS SUAS ROTAS (sem alterações) ---
app.get('/api/convidados', verificaToken, async (req, res) => { const casal_id = req.usuario.id; try { const sql = `SELECT g.id, g.nome_grupo, g.senha_rsvp, i.id as convidado_id, i.nome_completo, i.is_crianca, i.status_confirmacao FROM grupos_convidados g LEFT JOIN convidados_individuais i ON g.id = i.grupo_id WHERE g.casal_id = ? ORDER BY g.nome_grupo, i.nome_completo;`; const [rows] = await db.query(sql, [casal_id]); const grupos = {}; rows.forEach(row => { if (!grupos[row.id]) { grupos[row.id] = { id: row.id, nome_grupo: row.nome_grupo, senha_rsvp: row.senha_rsvp, convidados: [] }; } if (row.convidado_id) { grupos[row.id].convidados.push({ id: row.convidado_id, nome_completo: row.nome_completo, is_crianca: !!row.is_crianca, status_confirmacao: row.status_confirmacao }); } }); res.json(Object.values(grupos)); } catch (err) { res.status(500).json({ error: "Erro ao listar convidados." }); } });
app.post('/api/convidados', verificaToken, async (req, res) => { const casal_id = req.usuario.id; const { nome_grupo, senha_rsvp, convidados } = req.body; if (!nome_grupo || !convidados || !Array.isArray(convidados) || convidados.length === 0) return res.status(400).json({ error: "Dados inválidos." }); const connection = await db.getConnection(); try { await connection.beginTransaction(); const sqlGrupo = "INSERT INTO grupos_convidados (nome_grupo, senha_rsvp, casal_id) VALUES (?, ?, ?)"; const [resultGrupo] = await connection.query(sqlGrupo, [nome_grupo, senha_rsvp, casal_id]); const grupo_id = resultGrupo.insertId; const sqlConvidados = "INSERT INTO convidados_individuais (nome_completo, is_crianca, grupo_id) VALUES ?"; const valuesConvidados = convidados.map(c => [c.nome_completo, c.is_crianca || false, grupo_id]); await connection.query(sqlConvidados, [valuesConvidados]); await connection.commit(); res.status(201).json({ message: "Grupo de convidados adicionado com sucesso!", id: grupo_id }); } catch (err) { await connection.rollback(); res.status(500).json({ error: "Erro ao adicionar grupo de convidados." }); } finally { connection.release(); } });
app.put('/api/convidados/grupos/:id', verificaToken, async (req, res) => { const casal_id = req.usuario.id; const grupo_id = req.params.id; const { nome_grupo, senha_rsvp, convidados } = req.body; if (!nome_grupo || !convidados || !Array.isArray(convidados)) return res.status(400).json({ error: "Dados inválidos." }); const connection = await db.getConnection(); try { await connection.beginTransaction(); const sqlUpdateGrupo = "UPDATE grupos_convidados SET nome_grupo = ?, senha_rsvp = ? WHERE id = ? AND casal_id = ?"; const [result] = await connection.query(sqlUpdateGrupo, [nome_grupo, senha_rsvp, grupo_id, casal_id]); if (result.affectedRows === 0) throw new Error('Grupo não encontrado.'); const sqlDeleteConvidados = "DELETE FROM convidados_individuais WHERE grupo_id = ?"; await connection.query(sqlDeleteConvidados, [grupo_id]); if (convidados.length > 0) { const sqlInsertConvidados = "INSERT INTO convidados_individuais (nome_completo, is_crianca, status_confirmacao, grupo_id) VALUES ?"; const valuesConvidados = convidados.map(c => [c.nome_completo, c.is_crianca || false, c.status_confirmacao || 'Pendente', grupo_id]); await connection.query(sqlInsertConvidados, [valuesConvidados]); } await connection.commit(); res.json({ message: "Grupo de convidados atualizado com sucesso!" }); } catch (err) { await connection.rollback(); if (err.message.includes('Grupo não encontrado')) return res.status(404).json({ error: err.message }); res.status(500).json({ error: "Erro ao atualizar grupo de convidados." }); } finally { connection.release(); } });
app.delete('/api/grupos-convidados/:id', verificaToken, async (req, res) => { const casal_id = req.usuario.id; const grupo_id = req.params.id; try { const sql = "DELETE FROM grupos_convidados WHERE id = ? AND casal_id = ?"; const [result] = await db.query(sql, [grupo_id, casal_id]); if (result.affectedRows === 0) return res.status(404).json({ error: "Grupo não encontrado." }); return res.json({ message: "Grupo de convidados apagado com sucesso!" }); } catch (err) { return res.status(500).json({ error: "Erro ao apagar grupo." }); } });
app.get('/api/orcamento', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const sql = "SELECT * FROM orcamentos WHERE casal_id = ?"; const [rows] = await db.query(sql, [casal_id]); if (rows.length === 0) return res.json({ id: null, valor_total_estimado: "0.00", casal_id }); return res.json(rows[0]); } catch (err) { return res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/orcamento', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const { valor_total_estimado } = req.body; const sql = "INSERT INTO orcamentos (casal_id, valor_total_estimado) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor_total_estimado = VALUES(valor_total_estimado)"; await db.query(sql, [casal_id, valor_total_estimado]); res.json({ message: "Orçamento salvo com sucesso!" }); } catch (err) { return res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/despesas', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const sql = `SELECT d.* FROM despesas d JOIN orcamentos o ON d.orcamento_id = o.id WHERE o.casal_id = ? ORDER BY d.data_despesa DESC, d.id DESC`; const [despesas] = await db.query(sql, [casal_id]); res.json(despesas); } catch (err) { return res.status(500).json({ error: "Erro interno do servidor." }); } });
app.post('/api/despesas', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const { descricao, categoria, valor_pago, data_despesa } = req.body; const [orcamentos] = await db.query("SELECT id FROM orcamentos WHERE casal_id = ?", [casal_id]); if (orcamentos.length === 0) return res.status(400).json({ error: "Orçamento não encontrado." }); const orcamento_id = orcamentos[0].id; let dataFormatada = null; if (data_despesa) { try { dataFormatada = new Date(data_despesa).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: "Formato de data inválido." }); } } const sql = "INSERT INTO despesas (descricao, categoria, valor_pago, data_despesa, orcamento_id) VALUES (?, ?, ?, ?, ?)"; const values = [descricao, categoria, valor_pago || 0.00, dataFormatada, orcamento_id]; const [result] = await db.query(sql, values); const [newDespesa] = await db.query("SELECT * FROM despesas WHERE id = ?", [result.insertId]); res.status(201).json(newDespesa[0]); } catch (err) { console.error("Erro ao criar despesa:", err); return res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/despesas/:id', verificaToken, async (req, res) => { try { const despesaId = parseInt(req.params.id, 10); if (isNaN(despesaId)) { return res.status(400).json({ error: "ID de despesa inválido." }); } const casal_id = req.usuario.id; const { descricao, categoria, valor_pago, data_despesa } = req.body; const [orcamentos] = await db.query("SELECT id FROM orcamentos WHERE casal_id = ?", [casal_id]); if (orcamentos.length === 0) return res.status(403).json({ error: "Acesso negado."}); const orcamento_id = orcamentos[0].id; let dataFormatada = null; if (data_despesa) { try { dataFormatada = new Date(data_despesa).toISOString().split('T')[0]; } catch (e) { return res.status(400).json({ error: "Formato de data inválido." }); } } const sql = "UPDATE despesas SET descricao = ?, categoria = ?, valor_pago = ?, data_despesa = ? WHERE id = ? AND orcamento_id = ?"; const values = [descricao, categoria, valor_pago, dataFormatada, despesaId, orcamento_id]; const [result] = await db.query(sql, values); if (result.affectedRows === 0) return res.status(404).json({ error: "Despesa não encontrada." }); const [updatedDespesa] = await db.query("SELECT * FROM despesas WHERE id = ?", [despesaId]); res.json(updatedDespesa[0]); } catch (err) { console.error("Erro ao atualizar despesa:", err); return res.status(500).json({ error: "Erro interno do servidor." }); } });
app.delete('/api/despesas/:id', verificaToken, async (req, res) => { try { const despesaId = parseInt(req.params.id, 10); if (isNaN(despesaId)) { return res.status(400).json({ error: "ID de despesa inválido." }); } const casal_id = req.usuario.id; const [orcamentos] = await db.query("SELECT id FROM orcamentos WHERE casal_id = ?", [casal_id]); if (orcamentos.length === 0) return res.status(403).json({ error: "Acesso negado."}); const orcamento_id = orcamentos[0].id; const sql = "DELETE FROM despesas WHERE id = ? AND orcamento_id = ?"; const [result] = await db.query(sql, [despesaId, orcamento_id]); if (result.affectedRows === 0) return res.status(404).json({ error: "Despesa não encontrada." }); res.json({ message: "Despesa apagada com sucesso!" }); } catch(err) { console.error("Erro ao apagar despesa:", err); return res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/cha-de-panela', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const sql = "SELECT * FROM cha_de_panela_itens WHERE casal_id = ? ORDER BY data_criacao DESC"; const [itens] = await db.query(sql, [casal_id]); res.json(itens); } catch (err) { console.error("Erro ao buscar itens do Chá de Panela:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.post('/api/cha-de-panela', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const { nome_item, descricao } = req.body; if (!nome_item) { return res.status(400).json({ error: "O nome do item é obrigatório." }); } const sql = "INSERT INTO cha_de_panela_itens (casal_id, nome_item, descricao) VALUES (?, ?, ?)"; const [result] = await db.query(sql, [casal_id, nome_item, descricao]); res.status(201).json({ message: "Item adicionado com sucesso!", id: result.insertId }); } catch (err) { console.error("Erro ao adicionar item:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/cha-de-panela/:id', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const { id } = req.params; const { nome_item, descricao } = req.body; const sql = "UPDATE cha_de_panela_itens SET nome_item = ?, descricao = ? WHERE id = ? AND casal_id = ?"; const [result] = await db.query(sql, [nome_item, descricao, id, casal_id]); if (result.affectedRows === 0) { return res.status(404).json({ error: "Item não encontrado ou não pertence a este casal." }); } res.json({ message: "Item atualizado com sucesso!" }); } catch (err) { console.error("Erro ao atualizar item:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.delete('/api/cha-de-panela/:id', verificaToken, async (req, res) => { try { const casal_id = req.usuario.id; const { id } = req.params; const sql = "DELETE FROM cha_de_panela_itens WHERE id = ? AND casal_id = ?"; const [result] = await db.query(sql, [id, casal_id]); if (result.affectedRows === 0) { return res.status(404).json({ error: "Item não encontrado ou não pertence a este casal." }); } res.json({ message: "Item apagado com sucesso!" }); } catch (err) { console.error("Erro ao apagar item:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/public/cha-de-panela/:urlSite', async (req, res) => { try { const { urlSite } = req.params; const [casal] = await db.query("SELECT id FROM casais WHERE url_site = ?", [urlSite]); if (casal.length === 0) { return res.status(404).json({ error: "Lista não encontrada." }); } const casal_id = casal[0].id; const [itens] = await db.query("SELECT id, nome_item, descricao, presenteado, nome_convidado_presenteou FROM cha_de_panela_itens WHERE casal_id = ?", [casal_id]); res.json(itens); } catch (err) { console.error("Erro ao buscar lista pública:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/public/cha-de-panela/:itemId/presentear', async (req, res) => { try { const { itemId } = req.params; const { nome_convidado } = req.body; if (!nome_convidado) { return res.status(400).json({ error: "O seu nome é obrigatório para dar o presente." }); } const connection = await db.getConnection(); await connection.beginTransaction(); const [itens] = await connection.query("SELECT presenteado FROM cha_de_panela_itens WHERE id = ? FOR UPDATE", [itemId]); if (itens.length === 0 || itens[0].presenteado) { await connection.rollback(); connection.release(); return res.status(409).json({ error: "Oops! Alguém já escolheu este presente." }); } const sql = "UPDATE cha_de_panela_itens SET presenteado = TRUE, nome_convidado_presenteou = ? WHERE id = ?"; await connection.query(sql, [nome_convidado, itemId]); await connection.commit(); connection.release(); res.json({ message: "Obrigado pelo seu presente!" }); } catch (err) { console.error("Erro ao presentear item:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/public/cha-de-panela/presentear-multiplos', async (req, res) => { try { const { itemIds, nome_convidado } = req.body; if (!nome_convidado) { return res.status(400).json({ error: "O seu nome é obrigatório para dar os presentes." }); } if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) { return res.status(400).json({ error: "Você precisa de selecionar pelo menos um item." }); } const connection = await db.getConnection(); await connection.beginTransaction(); try { const placeholders = itemIds.map(() => '?').join(','); const [itens] = await connection.query(`SELECT id, presenteado FROM cha_de_panela_itens WHERE id IN (${placeholders}) FOR UPDATE`, itemIds); if (itens.length !== itemIds.length) { throw new Error("Um ou mais itens selecionados não foram encontrados."); } const itemJaPresenteado = itens.some(item => item.presenteado); if (itemJaPresenteado) { await connection.rollback(); return res.status(409).json({ error: "Oops! Um dos itens que você selecionou já foi escolhido por outra pessoa. Por favor, atualize a página e tente novamente." }); } const updateSql = `UPDATE cha_de_panela_itens SET presenteado = TRUE, nome_convidado_presenteou = ? WHERE id IN (${placeholders})`; await connection.query(updateSql, [nome_convidado, ...itemIds]); await connection.commit(); res.json({ message: "Muito obrigado pelos seus presentes!" }); } catch (err) { await connection.rollback(); throw err; } finally { connection.release(); } } catch (err) { console.error("Erro ao presentear múltiplos itens:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/admin/casais', verificaAdmin, async (req, res) => { try { const sql = ` SELECT c.id, c.nome_completo, c.email, c.url_site, c.data_criacao, p.nome_plano FROM casais c LEFT JOIN planos p ON c.plano_id = p.id WHERE c.is_admin = false ORDER BY c.data_criacao DESC `; const [casais] = await db.query(sql); res.json(casais); } catch (err) { console.error("Erro ao buscar todos os casais:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/admin/casais/:id/plano', verificaAdmin, async (req, res) => { try { const { id } = req.params; const { plano_id } = req.body; const novoPlanoId = plano_id === 'nenhum' ? null : plano_id; const sql = "UPDATE casais SET plano_id = ? WHERE id = ?"; const [result] = await db.query(sql, [novoPlanoId, id]); if (result.affectedRows === 0) { return res.status(404).json({ error: "Cliente não encontrado." }); } res.json({ message: "Plano do cliente atualizado com sucesso!" }); } catch (err) { console.error("Erro ao atualizar o plano do cliente:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.post('/api/admin/casais', verificaAdmin, async (req, res) => { try { const { nome_completo, email, senha, plano_id } = req.body; const hash = await bcrypt.hash(senha, saltRounds); const trialDate = new Date(); trialDate.setDate(trialDate.getDate() + 15); const sql = ` INSERT INTO casais (nome_completo, email, senha, plano_id, trial_expires_at, is_admin) VALUES (?, ?, ?, ?, ?, ?) `; const values = [nome_completo, email, hash, plano_id || null, trialDate, false]; const [result] = await db.query(sql, values); res.status(201).json({ message: "Cliente criado com sucesso!", id: result.insertId }); } catch (err) { if (err.code === 'ER_DUP_ENTRY') { return res.status(409).json({ error: "Este email já está a ser utilizado." }); } console.error("Erro ao criar cliente:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/admin/planos', verificaAdmin, async (req, res) => { try { const sql = "SELECT * FROM planos ORDER BY preco"; const [planos] = await db.query(sql); res.json(planos); } catch (err) { console.error("Erro ao buscar planos:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.post('/api/admin/planos', verificaAdmin, async (req, res) => { try { const { nome_plano, descricao, preco, preco_promocional, ativo } = req.body; const sql = ` INSERT INTO planos (nome_plano, descricao, preco, preco_promocional, ativo) VALUES (?, ?, ?, ?, ?) `; const values = [nome_plano, descricao, preco, preco_promocional || null, ativo]; const [result] = await db.query(sql, values); res.status(201).json({ message: "Plano criado com sucesso!", id: result.insertId }); } catch (err) { console.error("Erro ao criar plano:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/admin/planos/:id', verificaAdmin, async (req, res) => { try { const { id } = req.params; const { nome_plano, descricao, preco, preco_promocional, ativo } = req.body; const sql = ` UPDATE planos SET nome_plano = ?, descricao = ?, preco = ?, preco_promocional = ?, ativo = ? WHERE id = ? `; const values = [nome_plano, descricao, preco, preco_promocional || null, ativo, id]; const [result] = await db.query(sql, values); if (result.affectedRows === 0) { return res.status(404).json({ error: "Plano não encontrado." }); } res.json({ message: "Plano atualizado com sucesso!" }); } catch (err) { console.error("Erro ao atualizar plano:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.delete('/api/admin/planos/:id', verificaToken, async (req, res) => { try { const { id } = req.params; const sql = "DELETE FROM planos WHERE id = ?"; const [result] = await db.query(sql, [id]); if (result.affectedRows === 0) { return res.status(404).json({ error: "Plano não encontrado." }); } res.json({ message: "Plano apagado com sucesso!" }); } catch (err) { console.error("Erro ao apagar plano:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/admin/relatorio-financeiro', verificaAdmin, async (req, res) => { try { let { data_inicio, data_fim } = req.query; if (!data_inicio || !data_fim) { const hoje = new Date(); data_fim = hoje.toISOString().split('T')[0]; hoje.setDate(hoje.getDate() - 30); data_inicio = hoje.toISOString().split('T')[0]; } const dataFimCompleta = `${data_fim} 23:59:59`; const sqlVendas = ` SELECT p.nome_plano, COUNT(t.id) as quantidade_vendida, SUM(t.valor_pago) as total_valor FROM transacoes t JOIN planos p ON t.plano_id = p.id WHERE t.data_transacao BETWEEN ? AND ? GROUP BY p.nome_plano; `; const [vendasPorPlano] = await db.query(sqlVendas, [data_inicio, dataFimCompleta]); const sqlCadastrosManuais = ` SELECT COUNT(id) as quantidade FROM casais WHERE is_admin = false AND plano_id IS NULL AND data_criacao BETWEEN ? AND ? `; const [cadastrosManuais] = await db.query(sqlCadastrosManuais, [data_inicio, dataFimCompleta]); const sqlTotais = ` SELECT SUM(valor_pago) as faturamento_total, COUNT(id) as total_vendas FROM transacoes WHERE data_transacao BETWEEN ? AND ? `; const [totais] = await db.query(sqlTotais, [data_inicio, dataFimCompleta]); const relatorio = { periodo: { inicio: data_inicio, fim: data_fim }, faturamento_total: totais[0].faturamento_total || 0, total_vendas: totais[0].total_vendas || 0, cadastros_manuais: cadastrosManuais[0].quantidade || 0, vendas_por_plano: vendasPorPlano }; res.json(relatorio); } catch (err) { console.error("Erro ao gerar relatório financeiro:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.get('/api/public/planos', async (req, res) => { try { const sql = `SELECT * FROM planos WHERE ativo = TRUE ORDER BY preco`; const [planos] = await db.query(sql); res.json(planos); } catch (err) { console.error("Erro ao buscar planos públicos:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.post('/api/public/rsvp/auth', async (req, res) => { try { const { url_site, senha_rsvp } = req.body; const sqlCasal = "SELECT id FROM casais WHERE url_site = ?"; const [casais] = await db.query(sqlCasal, [url_site]); if (casais.length === 0) { return res.status(404).json({ error: "Site não encontrado." }); } const casal_id = casais[0].id; const sqlGrupo = "SELECT id, nome_grupo FROM grupos_convidados WHERE casal_id = ? AND senha_rsvp = ?"; const [grupos] = await db.query(sqlGrupo, [casal_id, senha_rsvp]); if (grupos.length === 0) { return res.status(401).json({ error: "Senha incorreta." }); } const grupo = grupos[0]; const sqlConvidados = "SELECT id, nome_completo FROM convidados_individuais WHERE grupo_id = ?"; const [convidados] = await db.query(sqlConvidados, [grupo.id]); res.json({ grupo_id: grupo.id, nome_grupo: grupo.nome_grupo, convidados: convidados }); } catch (err) { console.error("Erro na autenticação do RSVP:", err); res.status(500).json({ error: "Erro interno do servidor." }); } });
app.put('/api/public/rsvp/confirmar', async (req, res) => { try { const { confirmacoes } = req.body; if (!confirmacoes || typeof confirmacoes !== 'object' || Object.keys(confirmacoes).length === 0) { return res.status(400).json({ error: "Dados de confirmação inválidos." }); } const connection = await db.getConnection(); try { await connection.beginTransaction(); const promessasDeUpdate = Object.entries(confirmacoes).map(([convidadoId, status]) => { const sql = "UPDATE convidados_individuais SET status_confirmacao = ? WHERE id = ?"; const statusValido = ['Presente', 'Ausente'].includes(status) ? status : 'Pendente'; return connection.query(sql, [statusValido, convidadoId]); }); await Promise.all(promessasDeUpdate); await connection.commit(); res.json({ message: "Confirmação de presença salva com sucesso!" }); } catch (err) { await connection.rollback(); throw err; } finally { connection.release(); } } catch (err) { console.error("Erro ao salvar confirmação de RSVP:", err); res.status(500).json({ error: "Erro interno do servidor ao salvar confirmação." }); } });

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

