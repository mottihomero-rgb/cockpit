'use strict';
// Leitura de sessões/comandos portada do fork ohugomotti/cockpit (52dee0f).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { StringDecoder } = require('string_decoder');
function criarCli({ HOME, emit, spawnBin, acharBin, temBin, buildEnv, pastaDados, matarGrupo }) {
const CLIS = { gemini: { nome: 'Gemini', bin: 'gemini', conversas: true, comandos: true,
  pastaSessoes: () => path.join(HOME, '.gemini', 'tmp') } };
const headRead = (file, max) => { try { return fs.readFileSync(file, 'utf8').slice(0, max); } catch { return ''; } };
function cliFalaDeGente(t) {
  const s = String(t || '').trim();
  return !!s && !s.startsWith('/') && !s.startsWith('?')
    && !s.startsWith('<session_context>') && !s.startsWith('<hook_context>');
}
const cliTexto = (c) => (Array.isArray(c)
  ? c.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('')
  : (typeof c === 'string' ? c : ''));

/* Remonta o mapa de mensagens de um arquivo de conversa, na mesma ordem e com
   as mesmas regras do CLI. Devolve { meta, msgs }. */
function cliLerConversa(file, tetoBytes) {
  const mapa = new Map();
  let meta = {};
  let bruto = '';
  try {
    bruto = tetoBytes ? headRead(file, tetoBytes) : fs.readFileSync(file, 'utf8');
  } catch { return { meta, msgs: [] }; }
  // As versões atuais também usam um JSON completo, não apenas JSONL.
  try {
    const registro = JSON.parse(bruto);
    if (registro.sessionId && Array.isArray(registro.messages)) return { meta: registro, msgs: registro.messages };
  } catch {}
  for (const linha of bruto.split('\n')) {
    // chave aberta como TEXTO engana o contador de chaves de quem extrai a
    // funcao pra testar (ja quebrou o andaime). Aqui vai o codigo do caractere.
    if (linha.charCodeAt(0) !== 123) continue;
    let d; try { d = JSON.parse(linha); } catch { continue; }
    if (typeof d.$rewindTo === 'string') {
      // apaga dali pra frente; se o id nao esta no mapa, o CLI limpa tudo
      const ids = [...mapa.keys()];
      const i = ids.indexOf(d.$rewindTo);
      if (i < 0) mapa.clear();
      else for (const id of ids.slice(i)) mapa.delete(id);
      continue;
    }
    if (d.$set && typeof d.$set === 'object') {
      if (Array.isArray(d.$set.messages)) {
        mapa.clear();
        for (const m of d.$set.messages) if (m && typeof m.id === 'string') mapa.set(m.id, m);
      }
      meta = { ...meta, ...d.$set };
      continue;
    }
    if (typeof d.id === 'string') { mapa.set(d.id, d); continue; }
    if (typeof d.sessionId === 'string') meta = { ...meta, ...d };
  }
  return { meta, msgs: [...mapa.values()] };
}

/* ~/.gemini/projects.json guarda "caminho em minusculas" -> "nome da pasta em
   tmp". Sem ele a lista mostraria "hugom" como se fosse a pasta do painel, e o
   filtro por aba nunca casaria. */
function cliMapaProjetos(engine) {
  const fora = {};
  const raizCli = path.dirname(CLIS[engine].pastaSessoes());
  try {
    const j = JSON.parse(fs.readFileSync(path.join(raizCli, 'projects.json'), 'utf8'));
    for (const [caminho, apelido] of Object.entries((j && j.projects) || {})) {
      fora[apelido] = String(caminho).replace(/^([a-z]):/, (_m, d) => d.toUpperCase() + ':');
    }
  } catch {}
  return fora;
}

const CLI_TETO_TITULO = 512 * 1024;   // pro titulo nao precisa do arquivo inteiro

function cliSessions(engine) {
  const cli = CLIS[engine];
  if (!cli || !cli.conversas) return [];
  const raizCli = cli.pastaSessoes();
  if (!fs.existsSync(raizCli)) return [];
  const projetos = cliMapaProjetos(engine);
  const out = [];
  const olhar = (dir, fundo, apelido) => {
    if (fundo > 3) return;
    let itens = [];
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) { olhar(p, fundo + 1, fundo === 0 ? it.name : apelido); continue; }
      if (!/\.jsonl?$/i.test(it.name)) continue;
      if (/[\\/]logs[\\/]/i.test(p)) continue;   // log do desenvolvedor nao e' conversa
      let quando = 0;
      try { quando = fs.statSync(p).mtimeMs; } catch { continue; }
      const { meta, msgs } = cliLerConversa(p, CLI_TETO_TITULO);
      const id = meta && meta.sessionId;
      if (!id) continue;
      const primeira = msgs.find((m) => m.type === 'user' && cliFalaDeGente(cliTexto(m.content)));
      if (!primeira) continue;   // conversa que nunca saiu do contexto inicial
      out.push({
        engine, id, file: p, when: quando, entrada: 'cockpit',
        cwd: projetos[apelido] || HOME,
        title: cliTexto(primeira.content).replace(/\s+/g, ' ').trim().slice(0, 120),
      });
    }
  };
  olhar(raizCli, 0, '');
  out.sort((a, b) => b.when - a.when);
  return out.slice(0, 300);
}

/* Reabrir a conversa na tela, no mesmo formato que o Claude e o Codex ja
   devolvem: { role: 'user' | 'bot' | 'tool', text, name, arg }. */
function cliHistory(file, maxMsgs) {
  const { msgs } = cliLerConversa(file, 0);
  const out = [];
  for (const m of msgs) {
    if (!m || m.type === 'info' || m.type === 'error' || m.type === 'warning') continue;
    const texto = cliTexto(m.content).trim();
    if (m.type === 'user') {
      if (!cliFalaDeGente(texto)) continue;
      out.push({ role: 'user', text: texto });
      continue;
    }
    // o CLI chama a fala do modelo de "gemini"
    if (texto) out.push({ role: 'bot', text: texto });
    for (const t of (m.toolCalls || [])) {
      let arg = '';
      try { arg = t.args ? JSON.stringify(t.args).slice(0, 120) : ''; } catch {}
      out.push({ role: 'tool', name: t.name || 'Ferramenta', arg });
    }
  }
  return out.slice(-(maxMsgs || 60));
}

function comandosDoCli(engine) {
  const cli = CLIS[engine];
  if (!cli || !cli.comandos) return [];
  const raizCmd = path.join(path.dirname(cli.pastaSessoes()), 'commands');
  const out = [];
  const olhar = (dir, prefixo, fundo) => {
    if (fundo > 4) return;
    let itens = [];
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const it of itens) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) { olhar(p, prefixo + it.name + ':', fundo + 1); continue; }
      if (!/\.toml$/i.test(it.name)) continue;
      out.push({ name: prefixo + it.name.replace(/\.toml$/i, ''), desc: descricaoDoToml(p) });
    }
  };
  olhar(raizCmd, '', 0);
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/* Do arquivo inteiro so' a linha "description = ..." interessa pro menu. Trazer
   um leitor de TOML pra dentro do app por causa de uma linha nao se paga. */
function descricaoDoToml(file) {
  const cabeca = headRead(file, 2000);
  const m = cabeca.match(/^[ \t]*description[ \t]*=[ \t]*(.+)$/m);
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '').slice(0, 140);
}

const paineis = new Map();
const arquivo = id => path.join(pastaDados(), 'gemini', String(id).replace(/[^\w-]/g, '') + '.jsonl');
const anotar = (st, msg) => {
  fs.mkdirSync(path.dirname(st.file), { recursive: true });
  fs.appendFileSync(st.file, JSON.stringify(msg) + '\n', 'utf8');
};
function motivo(erro) {
  const s = String(erro || '').replace(/\x1b\[[0-9;]*m/g, '');
  if (/auth|credentials|GEMINI_API_KEY|Please login/i.test(s)) return 'Entre na conta do Gemini pelo terminal antes de usar este chat.';
  if (/quota|RESOURCE_EXHAUSTED|429/i.test(s)) return 'O Gemini atingiu o limite de uso da conta. Tente mais tarde.';
  return s.trim().split('\n').filter(x => !/^\s*at /.test(x)).slice(-2).join(' ').slice(0, 300) || 'O Gemini encerrou sem responder.';
}
function fala(st) {
  if (!st.acc) return;
  emit(st.paneId, 'text-final', { id: st.msgId, text: st.acc });
}
function fecharFala(st) {
  clearTimeout(st.timer); st.timer = null;
  if (st.acc) { fala(st); anotar(st, { role: 'bot', text: st.acc }); }
  st.acc = ''; st.msgId = null;
}
function evento(st, ev) {
  if (!ev || typeof ev !== 'object') return;
  if (ev.type === 'init' && ev.session_id) {
    st.resumeId = String(ev.session_id);
    anotar(st, { retomada: st.resumeId });
    return;
  }
  if (ev.type === 'message' && ev.role !== 'user') {
    const t = cliTexto(ev.content);
    if (!t) return;
    if (!st.msgId) st.msgId = 'gemini-' + crypto.randomUUID();
    st.acc = ev.delta === false ? t : st.acc + t;
    if (!st.timer) st.timer = setTimeout(() => { st.timer = null; if (paineis.get(st.paneId) === st) fala(st); }, 100);
  } else if (ev.type === 'tool_use') {
    fecharFala(st);
    const args = ev.parameters || ev.args || {};
    const name = ev.tool_name || ev.name || 'Ferramenta';
    const id = ev.tool_id || ev.id || crypto.randomUUID();
    if (name === 'write_todos' && Array.isArray(args.todos)) {
      emit(st.paneId, 'plan', { id: 'gemini', steps: args.todos.map(t => ({ step: String(t.description || t.content || ''), status: t.status || 'pending' })) });
    }
    const arg = typeof args === 'string' ? args : JSON.stringify(args);
    emit(st.paneId, 'tool-start', { id, name, arg: arg.slice(0, 400) });
    anotar(st, { role: 'tool', name, arg: arg.slice(0, 400) });
  } else if (ev.type === 'tool_result') {
    emit(st.paneId, 'tool-end', { id: ev.tool_id || ev.id, output: cliTexto(ev.output) || JSON.stringify(ev.output || ''), error: ev.status === 'error' || !!ev.error });
  } else if (ev.type === 'error' || (ev.type === 'result' && ev.status === 'error')) {
    st.erro = motivo(ev.message || ev.error?.message || ev.error);
    emit(st.paneId, 'note', { text: st.erro, error: true });
    st.avisou = true;
  } else if (ev.type === 'result') {
    const s = ev.stats || {};
    const entrada = s.input_tokens || s.inputTokens || 0, saida = s.output_tokens || s.outputTokens || 0;
    if (entrada || saida) emit(st.paneId, 'tokens', { total: entrada + saida });
  }
}
function parar(paneId, manter) {
  const st = paineis.get(paneId);
  if (!st) return;
  const proc = st.proc;
  st.proc = null;
  fecharFala(st);
  if (proc) matarGrupo(proc);
  if (!manter) paineis.delete(paneId);
  else if (proc) emit(paneId, 'turn-end', {});
}
function start(paneId, opts) {
  if (String(opts.cwd || '').startsWith('vps:')) throw new Error('O Gemini deste painel roda somente em uma pasta do Mac.');
  if (!temBin('gemini')) throw new Error('Gemini ainda não está instalado neste Mac. Instale o Gemini CLI e entre na conta pelo terminal.');
  parar(paneId);
  const id = opts.resumeId || crypto.randomUUID();
  const file = arquivo(id);
  let resumeId = opts.resumeId || '';
  if (fs.existsSync(file)) {
    const linhas = fs.readFileSync(file, 'utf8').split('\n');
    resumeId = '';
    for (const l of linhas) { try { const x = JSON.parse(l); if (x.retomada) resumeId = x.retomada; } catch {} }
  }
  const st = { paneId, id, file, resumeId, cwd: opts.cwd || HOME, model: opts.model || '',
    modo: ({ manual: 'default', auto: 'auto_edit', plan: 'plan', bypass: 'yolo' })[opts.approval] || 'default',
    proc: null, acc: '', msgId: null, timer: null };
  if (!fs.existsSync(file)) anotar(st, { cockpit: 1, id, cwd: st.cwd, model: st.model, criado: Date.now() });
  paineis.set(paneId, st);
  emit(paneId, 'sessao', { id, file });
  return true;
}
function enviar(paneId, texto, anexos = []) {
  const st = paineis.get(paneId);
  if (!st || st.proc) return false;
  const args = ['--output-format', 'stream-json', '--approval-mode', st.modo];
  if (st.model) args.push('--model', st.model);
  if (st.resumeId) args.push('--resume', st.resumeId);
  const caminhos = anexos.map(a => a?.path).filter(Boolean);
  const prompt = String(texto || '') + (caminhos.length ? '\n\nArquivos anexados no Mac:\n' + caminhos.join('\n') : '');
  let proc;
  try { proc = spawnBin(acharBin('gemini'), args, { cwd: st.cwd, env: buildEnv(), detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { emit(paneId, 'note', { text: motivo(e.message), error: true }); return false; }
  st.proc = proc; st.erro = ''; st.avisou = false;
  const decoder = new StringDecoder('utf8'); let buf = '', fim = false;
  const ler = chunk => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { evento(st, JSON.parse(line)); } catch (e) { if (!(e instanceof SyntaxError)) st.erro = motivo(e.message); } }
  };
  const concluir = (code, error) => {
    if (fim || paineis.get(paneId) !== st || st.proc !== proc) return;
    fim = true;
    ler(decoder.end()); if (buf.trim()) { try { evento(st, JSON.parse(buf)); } catch {} }
    st.proc = null; fecharFala(st);
    if ((code !== 0 || error) && !st.avisou) emit(paneId, 'note', { text: motivo(error?.message || st.erro), error: true });
    emit(paneId, 'turn-end', {});
  };
  proc.stdout.on('data', d => { if (paineis.get(paneId) === st && st.proc === proc) ler(decoder.write(d)); });
  proc.stderr.on('data', d => { st.erro = (st.erro + d.toString('utf8')).slice(-4000); });
  proc.on('close', code => concluir(code));
  proc.on('error', error => concluir(-1, error));
  proc.stdin.on('error', error => concluir(-1, error));
  anotar(st, { role: 'user', text: prompt });
  emit(paneId, 'busy', {});
  proc.stdin.end(prompt);
  return true;
}
function sessoes() {
  const out = cliSessions('gemini');
  const dir = path.join(pastaDados(), 'gemini');
  try { for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith('.jsonl')) continue;
    const file = path.join(dir, nome);
    const linhas = fs.readFileSync(file, 'utf8').split('\n').flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
    const meta = linhas[0], user = linhas.find(m => m.role === 'user');
    if (!meta?.cockpit || !user) continue;
    const retomada = linhas.filter(m => m.retomada).pop()?.retomada;
    const existente = out.findIndex(s => s.id === retomada);
    if (existente >= 0) out.splice(existente, 1);
    out.push({ engine: 'gemini', id: meta.id, file, cwd: meta.cwd, when: fs.statSync(file).mtimeMs, title: String(user.text).replace(/\s+/g, ' ').slice(0, 120) });
  } } catch {}
  return out.sort((a, b) => b.when - a.when).slice(0, 300);
}
function historico(file) {
  try {
    const linhas = fs.readFileSync(file, 'utf8').split('\n').flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } });
    if (linhas[0]?.cockpit) return linhas.filter(m => ['user', 'bot', 'tool'].includes(m.role));
  } catch { return []; }
  return cliHistory(file, 5000);
}
return { start, enviar, parar, sessoes, historico, comandos: () => comandosDoCli('gemini'), fechar: () => { for (const id of [...paineis.keys()]) parar(id); } };
}
module.exports = { criarCli };
