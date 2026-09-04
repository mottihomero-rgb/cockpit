const { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard, powerSaveBlocker, Notification } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const plataforma = require('./plataforma');
const { EH_WIN, acharBin, spawnBin, abrirPty } = plataforma;

const HOME = os.homedir();
// no Mac o Claude mora sempre no mesmo lugar; no Windows a gente procura
let CLAUDE_BIN = EH_WIN ? acharBin('claude') : path.join(HOME, '.local/bin/claude');

/* ---------- por que existe uma copia do Claude aqui dentro ----------
   O macOS guarda a permissao (Acesso Total ao Disco, Documentos, Mesa) pelo CAMINHO do
   programa. O Claude Code se atualiza sozinho e cada versao mora num caminho novo
   (~/.local/share/claude/versions/2.1.226, depois 2.1.227...). Resultado: a cada atualizacao
   o Mac pedia tudo de novo, e a tela de Ajustes mostrava "claude" JA LIGADO — que era a versao
   velha. Dava para liberar a vida inteira sem nunca ficar liberado.

   A permissao que o Mac grava nao esta presa a versao, e sim a assinatura da Anthropic
   (identifier "com.anthropic.claude-code", equipe Q6L2SF6YDW) — conferido no banco do TCC.
   Entao basta o CAMINHO parar de mudar: mantemos uma copia em ~/.cockpit/bin/claude, sempre
   igual a versao atual. Ele libera uma vez e acabou. A copia preserva a assinatura original. */
const CLAUDE_FIXO = path.join(HOME, '.cockpit', 'bin', 'claude');
function usarClaudeDeCaminhoFixo() {
  if (EH_WIN) return;
  try {
    const real = fs.realpathSync(path.join(HOME, '.local/bin/claude'));
    const nova = fs.statSync(real);
    let atual = null;
    try { atual = fs.statSync(CLAUDE_FIXO); } catch {}
    if (!atual || atual.size !== nova.size || Math.round(atual.mtimeMs) !== Math.round(nova.mtimeMs)) {
      fs.mkdirSync(path.dirname(CLAUDE_FIXO), { recursive: true });
      const meio = CLAUDE_FIXO + '.novo';
      fs.copyFileSync(real, meio);
      fs.chmodSync(meio, 0o755);
      fs.utimesSync(meio, nova.atime, nova.mtime);   // a data igual e o que diz "ja copiei esta"
      fs.renameSync(meio, CLAUDE_FIXO);              // troca atomica: quem esta rodando nao cai
      anota('copiei o Claude para o caminho fixo', real);
    }
    CLAUDE_BIN = CLAUDE_FIXO;
  } catch (e) {
    anota('nao consegui usar o caminho fixo do Claude', e.message);   // segue com o original
  }
}
const CONFIG_PATH = () => path.join(app.getPath('userData'), 'config.json');
const LOG = () => path.join(app.getPath('userData'), 'cockpit.log');
function anota(...partes) {
  const linha = new Date().toISOString() + '  ' + partes.map(x => (x && x.stack) || (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(' ') + '\n';
  try { fs.appendFileSync(LOG(), linha); } catch {}
  try { console.log(linha.trim()); } catch {}
}

/* Rede de seguranca do processo principal. Sem isto, qualquer erro nao tratado em qualquer
   canto do main mata o Electron na hora: a janela some da tela, todas as abas e todos os
   chats morrem juntos, e o log nao registra nada. Aqui o erro vira uma linha no cockpit.log
   e um aviso na tela, e o app continua de pe. */
process.on('uncaughtException', (e) => {
  try { anota('ERRO NAO TRATADO no main:', e); } catch {}
  try {
    if (win && !win.isDestroyed()) {
      win.webContents.send('app:erro', { texto: 'Um erro interno aconteceu, mas o Cockpit continua aberto: ' + (e && e.message || e) });
    }
  } catch {}
});
process.on('unhandledRejection', (e) => {
  try { anota('PROMESSA REJEITADA sem tratamento no main:', e); } catch {}
});

let win = null;
const HANDLERS = {};                    // os mesmos comandos, tambem servidos pelo Wi-Fi
function handle(nome, fn) { HANDLERS[nome] = fn; ipcMain.handle(nome, fn); }

/* ======================= util ======================= */
/* Gravar direto no arquivo final e perigoso: o config tem 2,3 MB (a foto em base64 sozinha
   ocupa quase tudo) e e reescrito dezenas de vezes por dia. Se o app morrer no meio de uma
   dessas gravacoes, o arquivo fica pela metade, o JSON.parse falha e TODAS as abas e chats
   somem de uma vez. Gravando num temporario e trocando o nome, o rename e atomico: ou entra
   o arquivo novo inteiro, ou fica o antigo inteiro. Nunca um pedaco. */
function gravarSeguro(alvo, texto) {
  const tmp = alvo + '.tmp';
  try {
    fs.writeFileSync(tmp, texto);
    fs.renameSync(tmp, alvo);
    return true;
  } catch (e) {
    anota('nao consegui gravar', alvo, e);
    try { fs.unlinkSync(tmp); } catch {}
    return false;
  }
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH(), 'utf8')); }
  catch (e) {
    // se o arquivo estiver corrompido, guarda uma copia antes de comecar do zero:
    // assim da pra resgatar as abas na mao em vez de perder tudo calado
    try {
      if (fs.existsSync(CONFIG_PATH())) {
        fs.copyFileSync(CONFIG_PATH(), CONFIG_PATH() + '.quebrado');
        anota('config ilegivel, copia salva em config.json.quebrado:', e && e.message);
      }
    } catch {}
    return {};
  }
}
/* Rede contra perder aba sem perceber: quando a gravacao nova traz MENOS abas do que a
   anterior, guarda o retrato de antes como config.json.anterior. Se uma restauracao falhar no
   meio (ou qualquer outra coisa comer abas), da pra voltar.
   A contagem fica na MEMORIA de proposito: reler e reinterpretar o arquivo de 2,2 MB a cada
   gravacao — e o savePanes grava a cada chat aberto, fechado ou redimensionado — custaria
   mais caro do que o problema que estamos evitando. */
let abasNoDisco = -1;
function saveConfig(cfg) {
  const nAgora = Array.isArray(cfg && cfg.abas) ? cfg.abas.length : 0;
  if (abasNoDisco < 0) {
    const d = loadConfig();
    abasNoDisco = Array.isArray(d && d.abas) ? d.abas.length : 0;
  }
  if (abasNoDisco > 0 && nAgora < abasNoDisco) {
    try {
      fs.copyFileSync(CONFIG_PATH(), CONFIG_PATH() + '.anterior');
      anota('abas caindo de ' + abasNoDisco + ' para ' + nAgora + ': guardei config.json.anterior');
    } catch {}
  }
  if (gravarSeguro(CONFIG_PATH(), JSON.stringify(cfg, null, 2))) abasNoDisco = nAgora;
}

// app GUI nao herda o PATH do shell: monta um PATH completo (ver plataforma.js)
const buildEnv = plataforma.buildEnv;

const ouvintesWeb = new Set();
function emit(paneId, kind, data) {
  // qualquer evento que nao seja pedaco de texto tem de sair DEPOIS do texto que ja estava
  // acumulado, senao o "texto final" chega antes do fim do rascunho e a resposta duplica
  if (kind !== 'text-delta') despejarDelta(paneId);
  // Pedido de permissao de um turno que acabou nao pode continuar respondivel: alem de sobrar
  // chave velha guardada a sessao inteira, responder "sim" ali escrevia num processo morto e
  // fazia aparecer "a conexao caiu" num chat que estava vivo.
  if (kind === 'turn-end' || kind === 'engine-down') {
    for (const [k, a] of pendingApprovals) if (a && a.paneId === paneId) pendingApprovals.delete(k);
  }
  const msg = { paneId, kind, ...data };
  if (win && !win.isDestroyed()) win.webContents.send('pane:event', msg);
  for (const ws of ouvintesWeb) { try { ws.send(JSON.stringify({ tipo: 'evento', canal: 'pane:event', dados: msg })); } catch {} }
}

/* O claude roda com --include-partial-messages: chega um pedacinho de texto a cada poucos
   caracteres. Cada um virava um envio para a tela, e a tela reprocessava o markdown da
   resposta INTEIRA a cada pedacinho — o custo cresce ao quadrado, e por isso resposta longa
   ia deixando o Cockpit pesado (rolar travava, digitar no outro chat engasgava).
   Aqui os pedacinhos sao juntados e mandados no maximo 20 vezes por segundo. Nada se perde:
   o texto final reescreve o bloco completo no fim do turno. */
const filaDelta = new Map();   // paneId -> { id, texto, timer }
function despejarDelta(paneId) {
  const f = filaDelta.get(paneId);
  if (!f) return;
  clearTimeout(f.timer);
  filaDelta.delete(paneId);
  if (f.texto) emit(paneId, 'text-delta', { id: f.id, text: f.texto });
}
function emitDelta(paneId, id, texto) {
  let f = filaDelta.get(paneId);
  if (f && f.id !== id) { despejarDelta(paneId); f = null; }
  if (!f) { f = { id, texto: '', timer: null }; filaDelta.set(paneId, f); }
  f.texto += texto;
  if (!f.timer) f.timer = setTimeout(() => despejarDelta(paneId), 50);
}
function avisarWeb(canal, dados) {
  for (const ws of ouvintesWeb) { try { ws.send(JSON.stringify({ tipo: 'evento', canal, dados })); } catch {} }
}

/* ======================= motor CODEX =======================
   Um `codex app-server` por DESTINO: um no Mac e um dentro da VPS (por SSH).
   Cada painel e uma thread, e o painel lembra em qual destino ele vive. */
const codexConns = new Map();     // destino ('local' | 'vps') -> conexao
const codexPaneDest = new Map();  // paneId -> destino
const codexPaneBilling = new Map(); // paneId -> 'plan' | 'api'
const codexApiCortado = new Set();  // evita mandar varios pedidos de parada pelo mesmo teto
const codex = {
  threadToPane: new Map(),   // threadId -> paneId
  paneToThread: new Map(),   // paneId -> threadId
  paneTurn: new Map(),       // paneId -> turnId em andamento
};

/* O Astra por creditos usa a API sem trocar o login normal do Codex. A chave fica no
   Chaveiro do Mac e o app-server pede ao proprio macOS quando realmente precisar dela. */
const ASTRA_API_MODEL = 'gpt-6-astra';
const ASTRA_PROVIDER = 'cockpit_api';
const ASTRA_KEYCHAIN_SERVICE = 'com.adsure.cockpit.openai-api';
const ASTRA_KEYCHAIN_ACCOUNT = os.userInfo().username;
function codexProviderAstra() {
  const q = (v) => JSON.stringify(String(v));
  return 'model_providers.' + ASTRA_PROVIDER + '={'
    + 'name="OpenAI API por creditos",'
    + 'base_url="https://api.openai.com/v1",'
    + 'wire_api="responses",'
    + 'auth={command="/usr/bin/security",args=['
    + ['find-generic-password', '-a', ASTRA_KEYCHAIN_ACCOUNT, '-s', ASTRA_KEYCHAIN_SERVICE, '-w'].map(q).join(',')
    + '],refresh_interval_ms=0,timeout_ms=5000}}';
}

const destinoDoCwd = (cwd) => (ehRemoto(cwd) ? String(cwd).split(':')[0] : 'local');
const destinoDoPane = (paneId) => codexPaneDest.get(paneId) || 'local';

function conexaoCodex(destino) {
  let c = codexConns.get(destino);
  if (!c) { c = { destino, proc: null, buf: '', id: 0, pend: new Map(), ready: null }; codexConns.set(destino, c); }
  return c;
}

function codexStart(destino = 'local') {
  const c = conexaoCodex(destino);
  if (c.ready) return c.ready;
  const tentativa = new Promise((resolve, reject) => {
    let p;
    try {
      if (destino === 'local') {
        p = spawnBin('codex', ['-c', codexProviderAstra(), 'app-server'], { cwd: HOME, env: buildEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      } else {
        const r = partesRemoto(destino + ':/');
        if (!r) return reject(new Error('servidor desconhecido: ' + destino));
        p = spawn('ssh', argsSsh(r, 'codex app-server'), { env: buildEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      }
    } catch (e) { return reject(e); }
    c.proc = p;

    p.stdout.on('data', (chunk) => {
      c.buf += chunk.toString('utf8');
      let i;
      while ((i = c.buf.indexOf('\n')) >= 0) {
        const line = c.buf.slice(0, i).trim();
        c.buf = c.buf.slice(i + 1);
        if (!line) continue;
        let m; try { m = JSON.parse(line); } catch { continue; }
        codexIncoming(destino, m);
      }
    });
    p.stderr.on('data', () => {});   // logs do rust, ruido
    // escrever no stdin de um codex ja morto emite 'error' no stream; sem ouvinte isso
    // derruba o Electron inteiro
    p.stdin.on('error', (e) => { anota('stdin do codex caiu:', e && e.message); });
    p.on('close', () => {
      c.proc = null; c.ready = null;
      // quem estava esperando resposta precisa saber que caiu. Sem isto a promessa nunca
      // resolve e o chat fica em "Ligando o Codex..." para sempre, sem erro nenhum.
      for (const [, pend] of c.pend) { try { pend.reject(new Error('o Codex caiu no meio')); } catch {} }
      c.pend.clear();
      for (const [paneId, d] of codexPaneDest) {
        if (d !== destino) continue;
        emit(paneId, 'engine-down', {});
        const tid = codex.paneToThread.get(paneId);
        if (tid) codex.threadToPane.delete(tid);
        codex.paneToThread.delete(paneId);
        codexPaneDest.delete(paneId);
        codexPaneBilling.delete(paneId);
      }
    });
    p.on('error', (e) => { c.ready = null; reject(e); });

    codexReq(destino, 'initialize', { clientInfo: { name: 'cockpit', version: '1.0.0', title: 'Cockpit' }, capabilities: { experimentalApi: true } })
      .then(() => { codexNote(destino, 'initialized', {}); resolve(true); })
      .catch(reject);
  });
  c.ready = tentativa;
  // Se ligar o Codex falhar, esquecer a tentativa. Antes o erro ficava guardado em c.ready e
  // TODA chamada seguinte recebia o mesmo erro velho: o Codex ficava morto ate reiniciar o app.
  tentativa.catch(() => { if (c.ready === tentativa) c.ready = null; });
  return c.ready;
}

// escrita protegida: o processo pode ter morrido entre o "if (c.proc)" e o write
function escreverCodex(c, obj) {
  if (!c.proc || !c.proc.stdin || c.proc.stdin.destroyed || !c.proc.stdin.writable) return false;
  try { c.proc.stdin.write(JSON.stringify(obj) + '\n'); return true; }
  catch (e) { anota('nao consegui falar com o codex:', e && e.message); return false; }
}

function codexReq(destino, method, params) {
  return new Promise((resolve, reject) => {
    const c = conexaoCodex(destino);
    if (!c.proc) return reject(new Error('codex fora do ar' + (destino !== 'local' ? ' na ' + destino : '')));
    const id = ++c.id;
    c.pend.set(id, { resolve, reject });
    if (!escreverCodex(c, { jsonrpc: '2.0', id, method, params })) {
      c.pend.delete(id);
      reject(new Error('o Codex caiu antes de receber o pedido'));
    }
  });
}
function codexNote(destino, method, params) {
  escreverCodex(conexaoCodex(destino), { jsonrpc: '2.0', method, params });
}
function codexReply(destino, id, result) {
  escreverCodex(conexaoCodex(destino), { jsonrpc: '2.0', id, result });
}

const pendingApprovals = new Map();  // approvalKey -> {rpcId, type}

function codexIncoming(destino, m) {
  const c = conexaoCodex(destino);
  // resposta a uma chamada nossa
  if (m.id !== undefined && m.method === undefined) {
    const p = c.pend.get(m.id);
    if (p) { c.pend.delete(m.id); m.error ? p.reject(new Error(m.error.message || 'erro')) : p.resolve(m.result); }
    return;
  }
  // servidor pedindo algo (aprovacao)
  if (m.id !== undefined && m.method) { codexServerRequest(destino, m); return; }
  // notificacao
  if (m.method) codexNotification(m.method, m.params || {});
}

function paneOf(params) {
  const tid = params.threadId || (params.thread && params.thread.id);
  return tid ? codex.threadToPane.get(tid) : undefined;
}

function codexServerRequest(destino, m) {
  const pane = paneOf(m.params || {});
  const meth = m.method;
  const key = 'ap_' + m.id;

  if (meth === 'item/commandExecution/requestApproval' || meth === 'execCommandApproval') {
    pendingApprovals.set(key, { rpcId: m.id, kind: 'cmd', destino, paneId: pane });
    emit(pane, 'approval', {
      key, title: destino === 'local' ? 'Rodar comando no seu Mac' : 'Rodar comando na ' + destino.toUpperCase(),
      detail: (m.params.command || '') + (m.params.cwd ? '\nem ' + m.params.cwd : ''),
      reason: m.params.reason || '',
    });
    return;
  }
  if (meth === 'item/fileChange/requestApproval' || meth === 'applyPatchApproval') {
    pendingApprovals.set(key, { rpcId: m.id, kind: 'file', destino, paneId: pane });
    emit(pane, 'approval', {
      key, title: 'Alterar arquivos',
      detail: m.params.grantRoot ? 'em ' + m.params.grantRoot : '',
      reason: m.params.reason || '',
    });
    return;
  }
  if (meth === 'item/permissions/requestApproval') {
    pendingApprovals.set(key, { rpcId: m.id, kind: 'perm', paneId: pane });
    emit(pane, 'approval', {
      key, title: 'Pedir mais acesso ao Mac',
      detail: m.params.reason || JSON.stringify(m.params.permissions || {}).slice(0, 300),
      reason: '',
    });
    return;
  }
  if (meth === 'currentTime/read') { codexReply(destino, m.id, { currentTimeAt: new Date().toISOString() }); return; }
  // qualquer outro pedido: responde vazio pra nao travar
  codexReply(destino, m.id, {});
}

function codexNotification(method, params) {
  if (method === 'thread/started') {
    return; // o paneamento e feito no thread/start
  }
  const pane = paneOf(params);
  if (pane === undefined) return;

  switch (method) {
    case 'turn/started':
      codexApiCortado.delete(pane);
      codex.paneTurn.set(pane, params.turnId || (params.turn && params.turn.id));
      emit(pane, 'busy', {});
      break;

    case 'item/agentMessage/delta':
      emitDelta(pane, params.itemId || 'msg', params.delta || '');
      break;

    case 'item/reasoning/summaryTextDelta':
    case 'item/reasoning/textDelta':
      emit(pane, 'think-delta', { text: params.delta || '' });
      break;

    case 'item/started': {
      const it = params.item || {};
      if (it.type === 'commandExecution') emit(pane, 'tool-start', { id: it.id, name: 'Terminal', arg: it.command || '' });
      else if (it.type === 'fileChange') emit(pane, 'tool-start', { id: it.id, name: 'Editando arquivo', arg: fileChangeArg(it), edicao: edicaoDoCodex(it) });
      else if (it.type === 'mcpToolCall') emit(pane, 'tool-start', { id: it.id, name: mcpName(it), arg: shortJson(it.arguments) });
      else if (it.type === 'webSearch') emit(pane, 'tool-start', { id: it.id, name: 'Pesquisando na web', arg: it.query || '' });
      break;
    }

    case 'item/commandExecution/outputDelta':
    case 'command/exec/outputDelta': {
      const txt = decodeChunk(params.chunk ?? params.delta ?? params.data);
      if (txt) emit(pane, 'tool-output', { id: params.itemId || params.callId, text: txt });
      break;
    }

    case 'item/completed': {
      const it = params.item || {};
      if (it.type === 'agentMessage') {
        emit(pane, 'text-final', { id: it.id, text: it.text || '', phase: it.phase || '' });
      } else if (it.type === 'commandExecution') {
        emit(pane, 'tool-end', {
          id: it.id,
          output: it.aggregatedOutput || it.output || '',
          error: (it.exitCode != null && it.exitCode !== 0) || it.status === 'failed',
        });
      } else if (it.type === 'fileChange') {
        emit(pane, 'tool-end', { id: it.id, output: fileChangeSummary(it), error: it.status === 'failed' });
      } else if (it.type === 'mcpToolCall') {
        emit(pane, 'tool-end', { id: it.id, output: shortJson(it.result ?? it.output), error: it.status === 'failed' });
      } else if (it.type === 'webSearch') {
        emit(pane, 'tool-end', { id: it.id, output: it.query || '', error: false });
      } else if (it.type === 'error') {
        emit(pane, 'note', { text: it.message || 'erro', error: true });
      }
      break;
    }

    case 'turn/completed': {
      codex.paneTurn.delete(pane);
      emit(pane, 'turn-end', {});
      break;
    }

    case 'turn/failed':
    case 'error': {
      // o erro pode vir como texto ou como objeto {message, codexErrorInfo}
      const e = params.error;
      const texto = params.message
        || (typeof e === 'string' ? e : (e && (e.message || e.codexErrorInfo)))
        || 'erro no Codex';
      const remoto = destinoDoPane(pane) !== 'local';
      const precisaEntrar = /revoked|unauthorized|log out and sign in|not logged in/i.test(texto);
      emit(pane, 'note', {
        text: texto + (precisaEntrar && remoto ? ' — use o menu / → Conta → trocar conta para entrar de novo na VPS.' : ''),
        error: true,
      });
      emit(pane, 'turn-end', {});
      break;
    }

    case 'thread/tokenUsage/updated': {
      const tu = params.tokenUsage || {};
      // "last" e o tamanho da conversa agora; "total" seria o gasto acumulado
      const atual = (tu.last && tu.last.totalTokens) || (tu.total && tu.total.totalTokens) || 0;
      emit(pane, 'tokens', { total: atual, janela: tu.modelContextWindow || undefined });
      if (codexPaneBilling.get(pane) === 'api' && tu.total) {
        const tid = params.threadId || codex.paneToThread.get(pane);
        const uso = registrarUsoAstra(tid, tu.total);
        emit(pane, 'api-usage', uso);
        const turno = codex.paneTurn.get(pane);
        if (uso.remainingUsd <= 0 && tid && turno && !codexApiCortado.has(pane)) {
          codexApiCortado.add(pane);
          emit(pane, 'note', { text: 'O limite mensal dos créditos foi atingido. Parei este trabalho.', error: true });
          codexReq(destinoDoPane(pane), 'turn/interrupt', { threadId: tid, turnId: turno }).catch(() => {});
        }
      }
      break;
    }

    case 'thread/compacted':
      emit(pane, 'compactou', {});
      break;

    case 'thread/status/changed':
      if (params.status && params.status.type === 'idle') emit(pane, 'turn-end', {});
      break;
  }
}

function decodeChunk(c) {
  if (!c) return '';
  if (typeof c === 'string') { try { return Buffer.from(c, 'base64').toString('utf8'); } catch { return c; } }
  if (Array.isArray(c)) { try { return Buffer.from(c).toString('utf8'); } catch { return ''; } }
  return '';
}
function mcpName(it) { return (it.server ? it.server + ' · ' : '') + (it.tool || 'MCP'); }
function shortJson(v) { if (v == null) return ''; try { return typeof v === 'string' ? v : JSON.stringify(v); } catch { return String(v); } }
function fileChangeArg(it) {
  const ch = it.changes || it.fileChanges || [];
  if (Array.isArray(ch) && ch.length) return ch.map(c => c.path || c.file || '').filter(Boolean).join(', ');
  return it.path || '';
}
/* O Codex manda a mudanca ja mastigada, e o formato varia conforme a versao: as vezes vem um
   patch unificado pronto, as vezes o par antes/depois. Pega o que houver. */
function edicaoDoCodex(it) {
  const ch = it.changes || it.fileChanges || [];
  const lista = Array.isArray(ch) ? ch : [];
  if (!lista.length) return null;
  const c = lista[0];
  const arquivo = c.path || c.file || it.path || '';
  if (!arquivo) return null;
  const pronto = c.unified_diff || c.unifiedDiff || c.diff || c.patch;
  if (typeof pronto === 'string' && pronto) return { arquivo, patch: pronto.slice(0, 40000) };
  const antes = c.old_content ?? c.oldContent ?? c.before ?? c.old_string;
  const depois = c.new_content ?? c.newContent ?? c.after ?? c.new_string;
  if (typeof depois === 'string') return { arquivo, partes: [{ antes: String(antes || ''), depois: String(depois) }] };
  return null;
}

function fileChangeSummary(it) {
  const ch = it.changes || it.fileChanges || [];
  if (Array.isArray(ch) && ch.length) return ch.map(c => (c.kind || c.type || 'alterado') + '  ' + (c.path || c.file || '')).join('\n');
  return shortJson(it);
}

/* O app-server nao aplica sozinho o ~/.codex/AGENTS.md, entao mandamos as regras da casa
   junto com cada conversa nova. Se o arquivo existir, ele manda; senao, vai o basico. */
function instrucoesCasa() {
  const base = 'Responda SEMPRE em português do Brasil, nunca em inglês.\n'
    + 'O Homero é leigo em código: fale em palavras simples, com exemplos do contexto dele.\n'
    + 'Resposta curta: ele tem TDAH e não lê texto longo. Comece pelo resultado.\n'
    + 'Não use travessão no texto para ele.';
  try {
    const f = path.join(HOME, '.codex/AGENTS.md');
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.trim()) return base + '\n\n--- regras da casa (~/.codex/AGENTS.md) ---\n' + txt.slice(0, 12000);
  } catch {}
  return base;
}

const CODEX_MODE = {
  manual:      { policy: 'untrusted',  sandbox: 'workspace-write' },
  'auto-edit': { policy: 'on-request', sandbox: 'workspace-write' },
  auto:        { policy: 'on-request', sandbox: 'workspace-write' },
  bypass:      { policy: 'never',      sandbox: 'danger-full-access' },
};
const CLAUDE_MODE = { manual: 'manual', 'auto-edit': 'acceptEdits', plan: 'plan', auto: 'auto', bypass: 'bypassPermissions' };

/* O settings.json do usuario tem defaultMode: bypassPermissions, que atropela qualquer
   --permission-mode. Para Manual e Auto funcionarem, escrevemos uma copia sem essa linha
   e carregamos ela por --settings, tirando o global do --setting-sources.            */
function claudeSettingsSemBypass() {
  try {
    const src = path.join(HOME, '.claude/settings.json');
    const d = JSON.parse(fs.readFileSync(src, 'utf8'));
    delete d.defaultMode;                       // existe tambem na raiz
    if (d.permissions) {
      delete d.permissions.defaultMode;
      delete d.permissions.additionalDirectories;  // isso liberava a home inteira sem perguntar
    }
    const out = path.join(app.getPath('userData'), 'claude-settings-sem-bypass.json');
    fs.writeFileSync(out, JSON.stringify(d));
    return out;
  } catch { return null; }
}

/* ======================= motor CLAUDE ======================= */
/* um processo `claude` por painel, protocolo stream-json */
const claudePanes = new Map();  // paneId -> {proc, buf, blocks}

const claudeCwd = new Map();
/* O Claude Code nomeia a pasta da sessao trocando TODO caractere que nao e letra nem numero
   por traco. Aqui so trocava "/" e ".", entao pasta com espaco ou acento gerava um caminho
   que nao existe no disco e a conversa nunca voltava. Conferido: a pasta real do cliente
   "Matheus Mota" e "-Users-...-Projetos-claude-Matheus-Mota", e a de "Adsure - Copy Lancamentos"
   e "-Users-...-Adsure---Copy-Lan-amentos" (o "c cedilha" tambem vira traco). */
function caminhoReal(dir) {
  // O Claude Code resolve o atalho (realpath) ANTES de montar o nome da pasta da conversa.
  // A home do Homero tem varios atalhos (~/cockpit, ~/maquina-sites, ~/mcp-servers...)
  // apontando para ~/Documents/Adsure - Sistemas/. Sem resolver aqui, o nome que montamos
  // aponta para uma pasta que nao existe no disco e a conversa volta vazia.
  try { return fs.realpathSync(String(dir)); } catch { return String(dir); }
}
function encodeCwd(dir) { return caminhoReal(dir).replace(/[^a-zA-Z0-9]/g, '-'); }

// texto oficial do modo ultracode do proprio Claude Code (o mesmo que a versao de terminal injeta)
const ULTRACODE_SP = 'Ultracode is on: optimize for the most exhaustive, correct answer — not the fastest or cheapest. Use the Workflow tool on every substantive task; token cost is not a constraint. See the Workflow tool\'s **Ultracode** section and quality patterns. Solo only on conversational/trivial turns.';

function claudeStart(paneId, opts) {
  claudeStop(paneId);
  claudeCwd.set(paneId, opts.cwd || HOME);
  const args = [
    '--print', '--input-format', 'stream-json', '--output-format', 'stream-json',
    '--verbose', '--include-partial-messages',
    '--permission-mode', CLAUDE_MODE[opts.approval] || 'bypassPermissions',
  ];
  const modo = opts.approval || 'bypass';
  if (modo === 'bypass') {
    args.push('--dangerously-skip-permissions');
  } else {
    // canal para ele perguntar antes de agir
    args.push('--permission-prompt-tool', 'stdio');
    const sf = claudeSettingsSemBypass();
    if (sf) { args.push('--setting-sources', 'project,local'); args.push('--settings', sf); }
  }
  if (opts.effort) args.push('--effort', opts.effort);
  // no esforco Maximo o painel vira "ultracode": ele passa a usar workflows (varios agentes
  // em paralelo) por conta propria. Em --print o CLI nasce com a regra contraria, entao alem
  // deste texto o renderer ainda manda a autorizacao junto da primeira mensagem.
  if (opts.effort === 'max') args.push('--append-system-prompt', ULTRACODE_SP);
  if (opts.model) args.push('--model', opts.model);
  if (opts.resumeId) args.push('--resume', opts.resumeId);
  // acesso amplo de saida so no modo que nao pergunta; nos outros ele pede na hora
  if (modo === 'bypass' && opts.cwd && opts.cwd !== HOME && !ehRemoto(opts.cwd)) args.push('--add-dir', HOME);

  let proc;
  if (ehRemoto(opts.cwd)) {
    // roda o Claude DENTRO da VPS: o mesmo fluxo de stream-json vem pelo SSH
    const r = partesRemoto(opts.cwd);
    const semLocal = args.filter((a, i) => {
      if (a === '--settings' || a === '--setting-sources') return false;
      const antes = args[i - 1];
      return antes !== '--settings' && antes !== '--setting-sources';
    });
    const comando = 'cd ' + aspaSh(r.caminho) + ' && claude ' + semLocal.map(aspaSh).join(' ');
    proc = spawn('ssh', argsSsh(r, comando), { env: buildEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
  } else {
    proc = spawnBin(CLAUDE_BIN, args, { cwd: opts.cwd || HOME, env: buildEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
  }
  const st = { proc, buf: '' };
  claudePanes.set(paneId, st);

  proc.stdout.on('data', (chunk) => {
    st.buf += chunk.toString('utf8');
    let i;
    while ((i = st.buf.indexOf('\n')) >= 0) {
      const line = st.buf.slice(0, i).trim(); st.buf = st.buf.slice(i + 1);
      if (!line) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      claudeMessage(paneId, m);
    }
  });
  proc.stderr.on('data', (c) => {
    const t = String(c).trim();
    // ruido normal do ssh nao vira aviso; erro de verdade sim
    if (!t || /Warning: Permanently added|Pseudo-terminal/i.test(t)) return;
    // Antes, tudo que o Claude local escrevia aqui era jogado fora, e o chat so dizia
    // "A conexao caiu" — sem nunca mostrar a frase em que o proprio CLI explica o problema
    // (conta vencida, conversa que nao existe mais, modelo invalido). Agora fica guardado.
    st.erro = ((st.erro || '') + t + '\n').slice(-1000);
    if (ehRemoto(opts.cwd)) emit(paneId, 'note', { text: 'VPS: ' + t.slice(0, 300), error: true });
  });
  // Se o processo do claude ja morreu e alguem escreve no stdin dele, o Node emite 'error'
  // no stream. Evento 'error' sem ouvinte = excecao nao tratada = o Electron inteiro fecha,
  // levando junto todas as abas e todos os chats. Este ouvinte e o que impede isso.
  proc.stdin.on('error', (e) => {
    anota('stdin do claude caiu:', e && e.message);
    if (claudePanes.get(paneId) !== st) return;
    claudePanes.delete(paneId);
    if (!st.parandoDeProposito) emit(paneId, 'engine-down', {});
  });
  // handshake que liga o canal de permissao (e devolve a lista de skills)
  try { proc.stdin.write(JSON.stringify({ type: 'control_request', request_id: 'init-' + paneId, request: { subtype: 'initialize', hooks: {} } }) + '\n'); } catch {}
  proc.on('close', (code) => {
    // so apaga se o registro ainda for DESTE processo. Se o painel ja subiu um claude novo
    // (troca de modelo, de modo, de esforco), apagar aqui mataria o registro do novo: o chat
    // ficaria com "a conexao caiu" mentindo e sobraria um processo orfao rodando escondido.
    if (claudePanes.get(paneId) !== st) return;
    claudePanes.delete(paneId);
    if (st.parandoDeProposito) return;
    // diz o MOTIVO, em vez de so "a conexao caiu"
    if (st.erro) emit(paneId, 'note', { text: st.erro.trim().slice(-400), error: true });
    else if (code) emit(paneId, 'note', { text: 'O Claude saiu com erro (código ' + code + ').', error: true });
    // UNICO caso em que o fio da conversa deve ser solto: o proprio Claude avisa que aquela
    // conversa nao existe mais. Em toda outra queda (limite de uso, internet, ssh) o id
    // continua valendo e a proxima mensagem TEM de voltar para ela.
    if (st.erro && /No conversation found with session ID/i.test(st.erro)) emit(paneId, 'sessao-sumiu', {});
    emit(paneId, 'engine-down', {});
  });
  proc.on('error', (e) => {
    const meu = claudePanes.get(paneId) === st;
    if (meu) claudePanes.delete(paneId);
    emit(paneId, 'note', { text: 'Erro: ' + e.message, error: true });
    // o 'close' que vem em seguida sai calado (a guarda ve que o registro ja nao e deste
    // processo), entao o aviso que DESTRAVA a tela precisa sair daqui: sem ele o chat fica
    // girando "trabalhando..." para sempre quando o claude nem consegue abrir
    if (meu && !st.parandoDeProposito) emit(paneId, 'engine-down', {});
  });
  return true;
}

function claudeStop(paneId) {
  const st = claudePanes.get(paneId);
  if (st) { st.parandoDeProposito = true; try { st.proc.kill('SIGTERM'); } catch {} }
}

/* Unico lugar que fala com o claude. Antes cada comando escrevia direto no stdin, e escrever
   num processo que acabou de morrer derrubava o app inteiro. Aqui a escrita e sempre
   protegida, e quando falha o painel recebe "engine-down" em vez de ficar pendurado. */
function escreverClaude(paneId, obj) {
  const st = claudePanes.get(paneId);
  if (!st || !st.proc || !st.proc.stdin || st.proc.stdin.destroyed || !st.proc.stdin.writable) {
    // Nao basta devolver false: sem o 'engine-down' a tela mantem "ja esta ligado" e o envio
    // seguinte pula o religar. O chat repetia "manda de novo que ele religa" para sempre.
    if (st && claudePanes.get(paneId) === st) claudePanes.delete(paneId);
    if (!st || !st.parandoDeProposito) emit(paneId, 'engine-down', {});
    return false;
  }
  try {
    st.proc.stdin.write(JSON.stringify(obj) + '\n');
    return true;
  } catch (e) {
    anota('nao consegui falar com o claude:', e && e.message);
    if (claudePanes.get(paneId) === st) claudePanes.delete(paneId);
    emit(paneId, 'engine-down', {});
    return false;
  }
}

function claudeMessage(paneId, m) {
  if (m.type === 'control_response') return;
  if (m.type === 'control_request' && m.request && m.request.subtype === 'can_use_tool') {
    const key = 'cl_' + paneId + '_' + m.request_id;
    pendingApprovals.set(key, { kind: 'claude', paneId, reqId: m.request_id, input: m.request.input });
    emit(paneId, 'approval', {
      key, title: 'Claude quer usar: ' + (m.request.tool_name || 'ferramenta'),
      detail: claudeToolArg(m.request.tool_name, m.request.input), reason: '',
    });
    return;
  }
  if (m.type === 'stream_event' && m.event) {
    const ev = m.event;
    if (ev.type === 'content_block_delta') {
      const d = ev.delta || {};
      if (d.type === 'text_delta') emitDelta(paneId, 'b' + ev.index, d.text || '');
      else if (d.type === 'thinking_delta') emit(paneId, 'think-delta', { text: d.thinking || '' });
    }
    return;
  }
  if (m.type === 'assistant' && m.message) {
    (m.message.content || []).forEach((c, i) => {
      if (c.type === 'text') emit(paneId, 'text-final', { id: 'b' + i, text: c.text || '' });
      else if (c.type === 'tool_use') emit(paneId, 'tool-start', {
        id: c.id, name: c.name, arg: claudeToolArg(c.name, c.input),
        edicao: dadosDaEdicao(c.name, c.input),
        tarefas: c.name === 'TodoWrite' && c.input ? c.input.todos : null,
      });
    });
    return;
  }
  if (m.type === 'user' && m.message && Array.isArray(m.message.content)) {
    for (const c of m.message.content) {
      if (c.type === 'tool_result') {
        let txt = '';
        if (typeof c.content === 'string') txt = c.content;
        else if (Array.isArray(c.content)) txt = c.content.map(x => x && x.type === 'text' ? x.text : '').join('\n');
        emit(paneId, 'tool-end', { id: c.tool_use_id, output: txt, error: !!c.is_error });
      }
    }
    return;
  }
  if (m.type === 'system' && m.subtype === 'init' && m.session_id) {
    emit(paneId, 'sessao', { id: m.session_id, file: path.join(CLAUDE_PROJ, encodeCwd(claudeCwd.get(paneId) || HOME), m.session_id + '.jsonl') });
    return;
  }
  /* ---------- o time de agentes ----------
     Quando ele lanca subagente (ferramenta Agent) ou um workflow, o CLI ja conta TUDO por aqui:
     quem comecou, em que fase esta, que ferramenta cada um esta usando agora e quando terminou.
     Nada disso ia para a tela — o app so via o "tool_use" da chamada, uma linha igual a de um
     Read. Estes quatro avisos sao o que alimenta o painel de agentes; nao precisa de flag nova
     no CLI nem de ler arquivo no disco. */
  if (m.type === 'system' && m.subtype === 'task_started') {
    emit(paneId, 'agentes', { ev: 'inicio', id: m.task_id, toolId: m.tool_use_id,
      desc: m.description || '', tipo: m.subagent_type || '', classe: m.task_type || '',
      workflow: m.workflow_name || '', fundo: !!m.is_backgrounded, nivel: m.spawn_depth || 1,
      prompt: String(m.prompt || '').slice(0, 400), em: Date.now() });
    return;
  }
  if (m.type === 'system' && m.subtype === 'task_progress') {
    emit(paneId, 'agentes', { ev: 'andamento', id: m.task_id, desc: m.description || '',
      ferramenta: m.last_tool_name || '', resumo: String(m.summary || '').slice(0, 200),
      uso: m.usage || null, fluxo: Array.isArray(m.workflow_progress) ? m.workflow_progress : null,
      em: Date.now() });
    return;
  }
  if (m.type === 'system' && m.subtype === 'task_updated') {
    emit(paneId, 'agentes', { ev: 'mudou', id: m.task_id, patch: m.patch || {}, em: Date.now() });
    return;
  }
  if (m.type === 'system' && m.subtype === 'task_notification') {
    emit(paneId, 'agentes', { ev: 'fim', id: m.task_id, estado: m.status || 'completed',
      resumo: String(m.summary || '').slice(0, 300), uso: m.usage || null, em: Date.now() });
    return;
  }
  if (m.type === 'system' && m.subtype === 'background_tasks_changed') {
    emit(paneId, 'agentes', { ev: 'lista', tarefas: Array.isArray(m.tasks) ? m.tasks : [], em: Date.now() });
    return;
  }
  if (m.type === 'result') {
    const u = m.usage || {};
    let janela = 0;
    try { const mu = m.modelUsage || {}; const k = Object.keys(mu)[0]; if (k) janela = mu[k].contextWindow || 0; } catch {}
    emit(paneId, 'tokens', {
      total: (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0),
      janela: janela || undefined,
    });
    if (m.is_error) emit(paneId, 'note', { text: String(m.result || m.subtype), error: true });
    emit(paneId, 'turn-end', {});
  }
}

function claudeToolArg(name, inp) {
  if (!inp) return '';
  const v = inp.command || inp.file_path || inp.pattern || inp.query || inp.url || inp.description || inp.skill || inp.notebook_path;
  if (v) return String(v);
  try { return JSON.stringify(inp).slice(0, 160); } catch { return ''; }
}

/* ---------- o antes e o depois de cada edicao ----------
   A tela mostrava so "Editando arquivo.js" e o texto cru do resultado. Quem e visual nao le
   patch em texto. Aqui sai o par (antes, depois) de cada pedaco mexido, para o outro lado
   pintar de verde e vermelho — e para dar de desfazer depois. */
const PEDACO_MAX = 40000;               // nao adianta mandar arquivo gigante pelo cano do IPC
const corta = (s) => { s = String(s == null ? '' : s); return s.length > PEDACO_MAX ? s.slice(0, PEDACO_MAX) + '\n… (cortado)' : s; };

function dadosDaEdicao(name, inp) {
  if (!inp) return null;
  const arquivo = inp.file_path || inp.notebook_path || '';
  if (!arquivo) return null;
  if ((name === 'Edit' || name === 'NotebookEdit') && typeof inp.old_string === 'string') {
    return { arquivo, partes: [{ antes: corta(inp.old_string), depois: corta(inp.new_string) }] };
  }
  if (name === 'MultiEdit' && Array.isArray(inp.edits)) {
    return { arquivo, partes: inp.edits.slice(0, 30).map(e => ({ antes: corta(e.old_string), depois: corta(e.new_string) })) };
  }
  if (name === 'Write' && typeof inp.content === 'string') {
    // le o arquivo ANTES de o motor gravar por cima: e o unico momento em que o "antes" existe
    let antes = '';
    let existia = false;
    try { antes = fs.readFileSync(arquivo, 'utf8'); existia = true; } catch {}
    return { arquivo, novo: !existia, partes: [{ antes: corta(antes), depois: corta(inp.content) }] };
  }
  return null;
}

/* desfazer uma edicao: troca de volta o pedaco novo pelo antigo, no arquivo de verdade */
handle('arquivo:desfazer', (_e, { arquivo, antes, depois }) => {
  try {
    if (!arquivo) return { error: 'sem arquivo' };
    const atual = fs.readFileSync(arquivo, 'utf8');
    const novo = String(depois == null ? '' : depois);
    if (!novo) return { error: 'não sei o que tirar' };
    const onde = atual.indexOf(novo);
    if (onde < 0) return { error: 'o arquivo mudou depois dessa edição — desfazer aqui ia estragar' };
    if (atual.indexOf(novo, onde + 1) >= 0) return { error: 'esse trecho aparece mais de uma vez no arquivo' };
    fs.writeFileSync(arquivo, atual.slice(0, onde) + String(antes == null ? '' : antes) + atual.slice(onde + novo.length), 'utf8');
    return { ok: true };
  } catch (e) { return { error: e.message }; }
});

/* ======================= arvore de arquivos ======================= */
const IGNORE = new Set(['node_modules', '.git', '.DS_Store', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', '.cache', 'Library']);
function listDir(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return { error: e.message }; }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith('.') && !['.claude', '.codex', '.env.example'].includes(e.name)) continue;
    if (IGNORE.has(e.name)) continue;
    let isDir = e.isDirectory();
    if (e.isSymbolicLink()) { try { isDir = fs.statSync(path.join(dir, e.name)).isDirectory(); } catch { continue; } }
    out.push({ name: e.name, dir: isDir, path: path.join(dir, e.name) });
  }
  out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  return { entries: out.slice(0, 800) };
}


/* ======================= trabalhar direto na VPS =======================
   Uma pasta remota vem escrita como "vps:/caminho/na/vps". Tudo que fala com
   pasta (motor, arvore de arquivos, visor) passa por aqui e vira comando por SSH.
   O Claude/Codex rodam LA, entao e a conta e o disco da VPS que valem. */
const SERVIDORES = {
  vps: { host: 'vps', usuario: 'homero', nome: 'VPS' },
};
const ehRemoto = (cwd) => /^[a-z0-9_-]+:\//i.test(String(cwd || '')) && !!SERVIDORES[String(cwd).split(':')[0]];
function partesRemoto(cwd) {
  const txt = String(cwd || '');
  const chave = txt.slice(0, txt.indexOf(':'));
  const srv = SERVIDORES[chave];
  if (!srv) return null;
  return { chave, ...srv, caminho: txt.slice(chave.length + 1) || '/' };
}
// aspas de shell: o unico jeito seguro de mandar texto com espaco, acento e quebra de linha
const aspaSh = (t) => "'" + String(t).replace(/'/g, "'\\''") + "'";

function linhaNoServidor(r, comando) {
  const dentro = 'bash -lc ' + aspaSh(comando);
  return r.usuario ? 'sudo -u ' + r.usuario + ' -H ' + dentro : dentro;
}
function argsSsh(r, comando) {
  return ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=12', '-o', 'ServerAliveInterval=20', r.host, linhaNoServidor(r, comando)];
}
// roda um comando na VPS e devolve a saida (para listar pasta, ler arquivo, etc.)
function noServidor(r, comando, ms = 20000) {
  return new Promise((res) => {
    const p = spawn('ssh', argsSsh(r, comando), { env: buildEnv() });
    let out = '', erro = '';
    const t = setTimeout(() => { try { p.kill(); } catch {} res({ error: 'a VPS demorou demais para responder' }); }, ms);
    p.stdout.on('data', (c) => { out += c.toString('utf8'); });
    p.stderr.on('data', (c) => { erro += c.toString('utf8'); });
    p.on('error', (e) => { clearTimeout(t); res({ error: e.message }); });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code !== 0) return res({ error: (erro || out || 'a VPS respondeu com erro ' + code).trim().slice(0, 300) });
      // varias ferramentas (o codex, por exemplo) escrevem o status no stderr mesmo dando certo
      res({ out: out || erro });
    });
  });
}

async function listDirRemoto(cwd) {
  const r = partesRemoto(cwd);
  if (!r) return { error: 'servidor desconhecido' };
  // "-p" poe barra no fim das pastas: e assim que sei quem e pasta sem outra chamada
  const rr = await noServidor(r, 'ls -1Ap -- ' + aspaSh(r.caminho));
  if (rr.error) return { error: rr.error };
  const out = [];
  for (const linha of rr.out.split('\n')) {
    const nome0 = linha.replace(/\r$/, '');
    if (!nome0) continue;
    const dir = nome0.endsWith('/');
    const nome = dir ? nome0.slice(0, -1) : nome0;
    if (nome.startsWith('.') && !['.claude', '.codex', '.env.example'].includes(nome)) continue;
    if (IGNORE.has(nome)) continue;
    const base = r.caminho.endsWith('/') ? r.caminho : r.caminho + '/';
    out.push({ name: nome, dir, path: r.chave + ':' + base + nome });
  }
  out.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  return { entries: out.slice(0, 800) };
}

async function lerArquivoRemoto(f) {
  const r = partesRemoto(f);
  if (!r) return { error: 'servidor desconhecido' };
  const rr = await noServidor(r, 'if [ $(stat -c%s -- ' + aspaSh(r.caminho) + ') -gt 512000 ]; then echo GRANDE_DEMAIS >&2; exit 1; fi; cat -- ' + aspaSh(r.caminho));
  if (rr.error) return { error: /GRANDE_DEMAIS/.test(rr.error) ? 'Arquivo grande demais para ver aqui.' : rr.error };
  return { content: rr.out };
}

/* ======================= conversas recentes ======================= */
const CLAUDE_PROJ = path.join(HOME, '.claude/projects');
const NOMES_PATH = () => path.join(app.getPath('userData'), 'nomes.json');
function lerNomes() { try { return JSON.parse(fs.readFileSync(NOMES_PATH(), 'utf8')); } catch { return {}; } }
function salvarNomes(o) { gravarSeguro(NOMES_PATH(), JSON.stringify(o)); }

handle('sessao:renomear', async (_e, { engine, id, nome }) => {
  const todos = lerNomes();
  if (nome && nome.trim()) todos[id] = nome.trim(); else delete todos[id];
  salvarNomes(todos);
  if (engine === 'codex' && id) {
    try { await codexStart(); await codexReq('local', 'thread/name/set', { threadId: id, name: nome || null }); } catch {}
  }
  return true;
});

/* procura um pedaço de texto dentro da conversa e devolve o trecho achado */
function acharNaConversa(file, alvo, engine) {
  try {
    const st = fs.statSync(file);
    const dados = st.size > 8 * 1024 * 1024 ? tailRead(file, 8 * 1024 * 1024) : fs.readFileSync(file, 'utf8');
    const baixo = dados.toLowerCase();
    const i = baixo.indexOf(alvo);
    if (i < 0) return null;
    // acha a linha inteira e tenta extrair um texto legivel
    const ini = dados.lastIndexOf('\n', i) + 1;
    const fim = dados.indexOf('\n', i);
    const linha = dados.slice(ini, fim < 0 ? dados.length : fim);
    let trecho = '';
    try {
      const d = JSON.parse(linha);
      const pega = (c) => typeof c === 'string' ? c
        : Array.isArray(c) ? c.map(x => x && (x.text || x.thinking || '')).join(' ') : '';
      trecho = pega(d.message && d.message.content) || pega(d.payload && d.payload.content) || '';
    } catch {}
    if (!trecho) trecho = linha.replace(/\\[nrt]/g, ' ').replace(/[{}"\[\]]/g, ' ');
    const j = trecho.toLowerCase().indexOf(alvo);
    const de = Math.max(0, (j < 0 ? 0 : j) - 45);
    return (de > 0 ? '…' : '') + trecho.slice(de, de + 150).replace(/\s+/g, ' ').trim() + '…';
  } catch { return null; }
}

/* ---------- indice de busca ----------
   Buscar abria conversa por conversa (mais de 600 arquivos, varios GB) e desistia em 4
   segundos dizendo "olhei so as mais recentes". Agora cada conversa e lida UMA vez, o texto
   limpo fica guardado em ~/.cockpit/indice-busca.json, e a busca roda em memoria: instantanea
   e completa. Arquivo que nao mudou (mesma data e mesmo tamanho) nem e reaberto. */
const IND_ARQ = path.join(HOME, '.cockpit', 'indice-busca.json');
const IND_MAX = 40000;              // caracteres de texto guardados por conversa
let indBusca = null, indiceSujo = false, indiceTimer = null;

/* O indice inteiro pesa umas dezenas de MB. Carregar leva 150ms, entao nao vale manter na
   memoria o dia todo: depois de 5 minutos sem ninguem buscar, ele e solto e o app volta ao
   tamanho de antes. A proxima busca recarrega sem ninguem notar. */
let soltarIndTimer = null;
function lerIndiceBusca() {
  clearTimeout(soltarIndTimer);
  soltarIndTimer = setTimeout(() => { if (!indiceSujo) indBusca = null; }, 5 * 60000);
  if (indBusca) return indBusca;
  try { indBusca = JSON.parse(fs.readFileSync(IND_ARQ, 'utf8')); } catch { indBusca = {}; }
  return indBusca;
}
function gravarIndiceDepois() {
  indiceSujo = true;
  clearTimeout(indiceTimer);
  indiceTimer = setTimeout(() => {
    if (!indiceSujo) return;
    try {
      fs.mkdirSync(path.dirname(IND_ARQ), { recursive: true });
      fs.writeFileSync(IND_ARQ, JSON.stringify(indBusca));
      indiceSujo = false;
    } catch {}
  }, 4000);
}
/* tira do .jsonl so o que e texto de gente ou do motor: o resto e encanamento */
function textoLegivel(file) {
  let dados;
  try {
    const st = fs.statSync(file);
    dados = st.size > 8 * 1024 * 1024 ? tailRead(file, 8 * 1024 * 1024) : fs.readFileSync(file, 'utf8');
  } catch { return ''; }
  const pega = (c) => typeof c === 'string' ? c
    : Array.isArray(c) ? c.map(x => x && (x.text || x.thinking || '')).filter(Boolean).join(' ') : '';
  const partes = [];
  let tam = 0;
  for (const linha of dados.split('\n')) {
    if (!linha || linha[0] !== '{') continue;
    let t = '';
    try {
      const d = JSON.parse(linha);
      t = pega(d.message && d.message.content) || pega(d.payload && d.payload.content) || '';
    } catch { continue; }
    t = String(t).replace(/\s+/g, ' ').trim();
    if (!t) continue;
    partes.push(t); tam += t.length + 1;
    if (tam >= IND_MAX) break;
  }
  return partes.join('\n');
}
function noIndice(file) {
  const ind = lerIndiceBusca();
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const e = ind[file];
  if (e && e.m === st.mtimeMs && e.t === st.size) return e;
  const novo = { m: st.mtimeMs, t: st.size, x: textoLegivel(file) };
  ind[file] = novo;
  gravarIndiceDepois();
  return novo;
}
function trechoDoIndice(texto, alvo) {
  const j = texto.toLowerCase().indexOf(alvo);
  if (j < 0) return null;
  const de = Math.max(0, j - 45);
  return (de > 0 ? '…' : '') + texto.slice(de, de + 150).replace(/\s+/g, ' ').trim() + '…';
}

handle('sessions:buscar', async (_e, { engine, termo, itens }) => {
  const alvo = String(termo || '').toLowerCase().trim();
  if (!alvo) return [];
  const achados = [];
  const lista = itens || [];
  // teto largo: so entra em acao na primeira busca, quando o indice ainda esta sendo montado
  const ateQuando = Date.now() + 20000;
  let vistos = 0, cortou = false;
  for (const it of lista) {
    vistos++;
    if (!it.file) continue;
    const e = noIndice(it.file);
    if (e) {
      const t = trechoDoIndice(e.x, alvo);
      if (t) achados.push({ id: it.id, trecho: t });
    }
    if (achados.length >= 40) break;
    if (Date.now() > ateQuando) { cortou = true; break; }
    if (vistos % 25 === 0) await new Promise(r => setImmediate(r));
  }
  // o corte por tempo nao pode ser silencioso: se sobrou conversa sem olhar, a tela avisa
  return { achados, parcial: cortou ? { vistos, total: lista.length } : null };
});

/* Montar o indice ANTES de ele precisar: passados 20s de app aberto, indexa devagarinho,
   um arquivo por vez, deixando o processador respirar entre eles. */
function montarIndiceDeFundo() {
  setTimeout(async () => {
    try {
      const listas = [claudeSessions(5000, true) || [], codexSessions(true, {}) || []];
      const arquivos = listas.flat().map(s => s && s.file).filter(Boolean);
      for (const f of arquivos) {
        noIndice(f);
        await new Promise(r => setTimeout(r, 12));   // devagar de proposito: nada de travar a tela
      }
      // conversa apagada nao pode ficar ocupando o indice para sempre
      const ind = lerIndiceBusca();
      const vivos = new Set(arquivos);
      let tirou = 0;
      for (const f of Object.keys(ind)) if (!vivos.has(f) && !fs.existsSync(f)) { delete ind[f]; tirou++; }
      if (tirou) gravarIndiceDepois();
    } catch {}
  }, 20000);
}

function tailRead(file, bytes) {
  try {
    const fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(bytes, size);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    return buf.toString('utf8');
  } catch { return ''; }
}
function headRead(file, bytes) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, n);
  } catch { return ''; }
}

const ENTRADAS_DE_GENTE = ['claude-vscode', 'cockpit', 'cli', 'claude-code'];

const INDICE_PATH = () => path.join(app.getPath('userData'), 'indice-conversas.json');
let indice = null;
function lerIndice() { if (indice) return indice; try { indice = JSON.parse(fs.readFileSync(INDICE_PATH(), 'utf8')); } catch { indice = {}; } return indice; }
function gravarIndice() { gravarSeguro(INDICE_PATH(), JSON.stringify(indice || {})); }

const PULAR_PASTA = new Set(['subagents', 'workflows']);

function varrerConversas(dir, achados, nivel) {
  let itens = [];
  try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of itens) {
    const p2 = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (PULAR_PASTA.has(e.name) || nivel > 4) continue;   // agentes internos nao sao conversa sua
      varrerConversas(p2, achados, nivel + 1);
    } else if (e.name.endsWith('.jsonl')) {
      try { const st = fs.statSync(p2); if (st.size > 300) achados.push({ f: p2, mtime: st.mtimeMs, size: st.size, id: e.name.replace('.jsonl', '') }); } catch {}
    }
  }
}

/* le titulo/pasta/entrada de um arquivo, guardando em indice para nao reler toda vez */
function fichaConversa(it) {
  const ind = lerIndice();
  const salvo = ind[it.f];
  if (salvo && salvo.mtime === it.mtime && salvo.size === it.size) return salvo;

  const head = headRead(it.f, 64 * 1024);
  const em = head.match(/"entrypoint":"([^"]*)"/);
  const entrada = em ? em[1] : '';

  const tail = tailRead(it.f, 96 * 1024);
  let title = '';
  const tm = [...tail.matchAll(/"aiTitle":"((?:[^"\\]|\\.)*)"/g)];
  if (tm.length) { try { title = JSON.parse('"' + tm[tm.length - 1][1] + '"'); } catch { title = tm[tm.length - 1][1]; } }

  let cwd = '';
  const cm = head.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
  if (cm) { try { cwd = JSON.parse('"' + cm[1] + '"'); } catch { cwd = cm[1]; } }

  if (!title) {
    for (const linha of head.split('\n')) {
      if (!linha.includes('"type":"user"')) continue;
      try {
        const d = JSON.parse(linha);
        if (d.isMeta) continue;
        const c = d.message && d.message.content;
        const bruto = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x && x.text || '').join(' ') : '';
        const t = tiraBlocos(bruto);
        if (t && !ehTecnico(t)) { title = limparTitulo(t).slice(0, 90); break; }
      } catch {}
    }
  }
  const ficha = { mtime: it.mtime, size: it.size, title, cwd, entrada };
  ind[it.f] = ficha;
  return ficha;
}

function claudeSessions(limit, incluirRobos) {
  const achados = [];
  varrerConversas(CLAUDE_PROJ, achados, 0);
  achados.sort((a, b) => b.mtime - a.mtime);

  const nomesMeus = lerNomes();
  const alvo = limit || 5000;
  const out = [];
  let lidos = 0;
  for (const it of achados) {
    if (out.length >= alvo) break;
    const fi = fichaConversa(it);
    lidos++;
    if (!incluirRobos && fi.entrada && !ENTRADAS_DE_GENTE.includes(fi.entrada)) continue;
    let title = nomesMeus[it.id] || fi.title;
    if (!title) continue;
    out.push({ engine: 'claude', id: it.id, title, cwd: fi.cwd || HOME, when: it.mtime, file: it.f, entrada: fi.entrada });
  }
  if (lidos) gravarIndice();
  return out;
}

/* ---- quanto da conversa volta para a tela ----
   Antes era um `slice(-60)` cru sobre TUDO, e cada Edit, Bash ou Read conta como item. Numa
   conversa de trabalho as ferramentas comem as 60 vagas sozinhas: medido em 03/09/2026, uma
   conversa de 10 falas do Homero + 59 respostas + 363 ferramentas voltava com 4 falas e 11
   respostas. Ou seja, o que sumia era justamente a CONVERSA — e ela ainda alimenta o P.hist,
   de onde sai o contexto quando o chat volta sem o fio. Agora quem manda no corte e a fala:
   elas voltam todas (ate maxFalas) e so as ferramentas mais ANTIGAS sao podadas, ate maxTools. */
function cortarHistorico(msgs, maxFalas, maxTools) {
  let falas = 0, ini = 0;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'tool') continue;
    if (++falas > maxFalas) { ini = i + 1; break; }
  }
  const trecho = msgs.slice(ini);
  let sobra = trecho.filter(m => m.role === 'tool').length - (maxTools || 250);
  if (sobra <= 0) return trecho;
  return trecho.filter(m => !(m.role === 'tool' && sobra-- > 0));
}

function claudeHistory(file, maxFalas, maxTools) {
  const msgs = [];
  let data = '';
  try {
    const st = fs.statSync(file);
    // arquivos gigantes: le so o final
    data = st.size > 6 * 1024 * 1024 ? tailRead(file, 6 * 1024 * 1024) : fs.readFileSync(file, 'utf8');
  } catch { return msgs; }
  for (const line of data.split('\n')) {
    if (!line.startsWith('{')) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    // isMeta marca o que o proprio Claude Code escreveu se passando por usuario: prompt de
    // subagente, texto de skill, aviso de imagem colada. Nada disso e conversa.
    if (d.isMeta) continue;
    if (d.type === 'user' && d.message) {
      const c = d.message.content;
      let t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter(x => x && x.type === 'text').map(x => x.text).join('\n') : '';
      t = tiraBlocos(t);
      if (t && !ehTecnico(t)) msgs.push({ role: 'user', text: semContexto(t) || t });
    } else if (d.type === 'assistant' && d.message) {
      const c = d.message.content || [];
      for (const x of c) {
        if (x.type === 'text' && x.text && x.text.trim()) msgs.push({ role: 'bot', text: x.text });
        else if (x.type === 'tool_use') msgs.push({ role: 'tool', name: x.name, arg: claudeToolArg(x.name, x.input) });
      }
    }
  }
  return cortarHistorico(msgs, maxFalas || 600, maxTools);
}

function codexHistory(file, maxFalas, maxTools) {
  const msgs = [];
  let data = '';
  try { data = fs.readFileSync(file, 'utf8'); } catch { return msgs; }
  for (const line of data.split('\n')) {
    if (!line.startsWith('{')) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d.type !== 'response_item') continue;
    const p = d.payload || {};
    if (p.type === 'message') {
      if (p.role === 'developer' || p.role === 'system') continue;
      const t = tiraBlocos((p.content || []).map(c => c.text || '').join('\n'));
      if (!t) continue;
      // pula o contexto tecnico que o Codex injeta como se fosse fala do usuario
      if (ehTecnico(t) || t.includes('<workspace_roots>')) continue;
      msgs.push({ role: p.role === 'user' ? 'user' : 'bot', text: p.role === 'user' ? (semContexto(t) || t) : t });
    } else if (p.type === 'function_call' || p.type === 'local_shell_call') {
      let arg = '';
      try { const a = typeof p.arguments === 'string' ? JSON.parse(p.arguments) : (p.action || p.arguments || {}); arg = a.command ? (Array.isArray(a.command) ? a.command.join(' ') : a.command) : JSON.stringify(a).slice(0, 120); } catch { arg = String(p.arguments || '').slice(0, 120); }
      msgs.push({ role: 'tool', name: p.name === 'shell' || p.type === 'local_shell_call' ? 'Terminal' : (p.name || 'Ferramenta'), arg });
    }
  }
  return cortarHistorico(msgs, maxFalas || 600, maxTools);
}

handle('sessions:claude', (_e, incluirRobos) => claudeSessions(5000, incluirRobos));
const CODEX_SESS = path.join(HOME, '.codex/sessions');
const ORIGENS_DE_GENTE = ['cockpit', 'codex-tui', 'codex_tui', 'codex_vscode', 'codex-vscode', 'codex_app', 'codex-app', 'vscode'];

const TECNICO = /<recommended_plugins>|<environment_context>|<user_instructions>|<system-reminder>|<available_tools>|<plugins>|<task-notification>|<command-name>|<local-command-stdout>|<bash-input>|<function_results>|^Caveat:|^\[Request interrupted|^\[Image: original|^<[a-z_-]+>/i;
const ehTecnico = (t) => !t || TECNICO.test(t.trim().slice(0, 400));

/* O que o Claude Code injeta na conversa NAO e fala do Homero, mas fica gravado no mesmo lugar
   e com o mesmo "role: user". Antes so era barrado o que comecava com a tag — o que vinha
   colado DEPOIS da fala dele (lembrete de sistema, contexto de hook, aviso de tarefa que
   terminou) passava batido e reaparecia na tela ao reabrir o app, misturado com a conversa.
   Aqui esses pedacos saem do texto onde quer que estejam; se nao sobrar nada, a mensagem some. */
const BLOCOS_TECNICOS = [
  'system-reminder', 'task-notification', 'command-name', 'command-message', 'command-args',
  'local-command-stdout', 'local-command-stderr', 'bash-input', 'bash-stdout', 'bash-stderr',
  'user-prompt-submit-hook', 'function_results', 'recommended_plugins', 'environment_context',
  'user_instructions', 'available_tools', 'plugins', 'workspace_roots', 'EXTREMELY_IMPORTANT',
  'ide_selection', 'ide_opened_file', 'ide_diagnostics',
];
function tiraBlocos(t) {
  let s = String(t || '');
  for (const tag of BLOCOS_TECNICOS) {
    s = s.replace(new RegExp('<' + tag + '>[\\s\\S]*?<\\/' + tag + '>', 'gi'), '');
    // bloco aberto e nunca fechado (arquivo cortado no meio): corta dali ate o fim
    s = s.replace(new RegExp('<' + tag + '>[\\s\\S]*$', 'i'), '');
  }
  // contexto que o harness cola sem tag nenhuma, sempre no fim da mensagem
  s = s.replace(/(^|\n)[^\n]{0,80}hook additional context:[\s\S]*$/i, '');
  s = s.replace(/^\[Image: original[^\]]*\]$/gim, '');
  s = s.replace(/^\[Request interrupted[^\]]*\]$/gim, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

function semContexto(t) {
  if (!t) return t;
  const i = t.indexOf('Agora, o novo pedido:');
  if (i >= 0) return t.slice(i + 'Agora, o novo pedido:'.length).trim();
  const j = t.indexOf('Arquivos que anexei');
  if (j > 0) return t.slice(0, j).trim();
  return t;
}
const limparTitulo = (t) => (semContexto(t) || '').slice(0, 90);

function fichaCodex(it) {
  const ind = lerIndice();
  const salvo = ind[it.f];
  if (salvo && salvo.mtime === it.mtime && salvo.size === it.size) return salvo;

  let head = headRead(it.f, 96 * 1024);
  let id = '', cwd = '', origem = '', title = '', doAssistente = '';
  const varrer = (texto) => {
  for (const linha of texto.split('\n')) {
    if (!linha.startsWith('{')) continue;
    let d; try { d = JSON.parse(linha); } catch { continue; }
    if (d.type === 'session_meta') {
      const p2 = d.payload || {};
      id = p2.id || p2.session_id || '';
      cwd = p2.cwd || '';
      origem = p2.originator || p2.source || '';
      continue;
    }
    if (!title && d.type === 'response_item') {
      const p2 = d.payload || {};
      if (p2.type === 'message') {
        const t = (p2.content || []).map(c => c.text || '').join(' ').trim();
        if (p2.role === 'user' && t && !ehTecnico(t)) title = limparTitulo(t).slice(0, 90);
        else if (p2.role === 'assistant' && t && !doAssistente) doAssistente = t.slice(0, 90);
      }
    }
    if (title && id) return true;
  }
  return false;
  };
  if (!varrer(head) && it.size > 96 * 1024) varrer(fs.readFileSync(it.f, 'utf8'));   // arquivo grande: le tudo
  if (!title) title = doAssistente;                       // ao menos a primeira resposta
  if (!title) title = 'Conversa de ' + new Date(it.mtime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const ficha = { mtime: it.mtime, size: it.size, title, cwd, entrada: origem, sid: id };
  ind[it.f] = ficha;
  return ficha;
}

function codexSessions(incluirRobos, nomesDoApp) {
  const achados = [];
  varrerConversas(CODEX_SESS, achados, 0);
  achados.sort((a, b) => b.mtime - a.mtime);
  const meus = lerNomes();
  const out = [];
  let lidos = 0;
  for (const it of achados) {
    const fi = fichaCodex(it);
    lidos++;
    if (!incluirRobos && fi.entrada && !ORIGENS_DE_GENTE.includes(fi.entrada)) continue;
    const id = fi.sid || it.id;
    const title = meus[id] || (nomesDoApp && nomesDoApp[id]) || fi.title;
    if (!title) continue;
    out.push({ engine: 'codex', id, title: title.slice(0, 120), cwd: fi.cwd || HOME, when: it.mtime, file: it.f, entrada: fi.entrada });
  }
  if (lidos) gravarIndice();
  return out;
}

handle('sessions:codex', async (_e, incluirRobos) => {
  // nomes que o proprio Codex guarda (renomeadas por lá)
  const nomesDoApp = {};
  try {
    await codexStart();
    const r = await codexReq('local', 'thread/list', { pageSize: 500 });
    for (const t of ((r && (r.data || r.threads)) || [])) if (t.name) nomesDoApp[t.id] = t.name;
  } catch {}
  try { return codexSessions(incluirRobos, nomesDoApp); }
  catch (e) { return { error: e.message }; }
});

handle('sessions:titulo', (_e, { engine, file, id }) => {
  try {
    if (engine !== 'claude') return '';
    let f = file;
    if ((!f || !fs.existsSync(f)) && id) {
      const achados = [];
      varrerConversas(CLAUDE_PROJ, achados, 0);
      const it = achados.find(a => a.id === id);
      if (it) f = it.f;
    }
    if (!f || !fs.existsSync(f)) return '';
    const tail = tailRead(f, 96 * 1024);
    const m = [...tail.matchAll(/"aiTitle":"((?:[^"\\]|\\.)*)"/g)];
    if (!m.length) return '';
    try { return JSON.parse('"' + m[m.length - 1][1] + '"'); } catch { return m[m.length - 1][1]; }
  } catch { return ''; }
});

/* Acha o arquivo de uma conversa do Claude pelo id.
   Primeiro tenta a pasta da aba, que e o caso normal. Se nao achar, varre TODAS as pastas de
   projeto: a conversa pode ter comecado com o chat apontando para outra pasta (a home, por
   exemplo) e so depois a aba ter mudado de pasta. Sem esta segunda tentativa, a conversa
   existia inteira no disco e o chat voltava vazio. Medido: varrer as 162 pastas leva 0,3 ms. */
function acharConversaClaude(id, cwd) {
  if (!id) return '';
  try {
    const perto = path.join(CLAUDE_PROJ, encodeCwd(cwd || HOME), id + '.jsonl');
    if (fs.existsSync(perto)) return perto;
  } catch {}
  try {
    for (const pasta of fs.readdirSync(CLAUDE_PROJ)) {
      const f = path.join(CLAUDE_PROJ, pasta, id + '.jsonl');
      if (fs.existsSync(f)) return f;
    }
  } catch {}
  return '';
}

handle('sessions:history', (_e, { engine, file, id, cwd }) => {
  let alvo = file && fs.existsSync(file) ? file : '';
  // o caminho guardado pode estar vazio (config antigo) ou apontar para um lugar que nao
  // existe mais: nos dois casos, procurar pelo id
  if (!alvo && engine === 'claude') alvo = acharConversaClaude(id, cwd);
  if (!alvo) return [];
  return engine === 'claude' ? claudeHistory(alvo, 600, 250) : codexHistory(alvo, 600, 250);
});

/* ======================= comandos e skills ======================= */
function readSkillDirs(dirs) {
  const out = [];
  for (const d of dirs) {
    let names = [];
    try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of names) {
      if (e.isDirectory()) {
        const f = path.join(d, e.name, 'SKILL.md');
        if (fs.existsSync(f)) out.push({ name: e.name, desc: skillDesc(f) });
      } else if (e.name.endsWith('.md')) {
        out.push({ name: e.name.replace(/\.md$/, ''), desc: skillDesc(path.join(d, e.name)) });
      }
    }
  }
  return out;
}
function skillDesc(file) {
  const head = headRead(file, 1600);
  const m = head.match(/^description:\s*(.+)$/m);
  if (m) return m[1].replace(/^["']|["']$/g, '').slice(0, 140);
  const t = head.split('\n').find(l => l.trim() && !l.startsWith('---') && !l.startsWith('name:'));
  return (t || '').replace(/^#+\s*/, '').slice(0, 140);
}

let skillCache = { claude: null, codex: null };
handle('skills:list', (_e, engine) => {
  if (skillCache[engine]) return skillCache[engine];
  let dirs;
  if (engine === 'claude') {
    dirs = [path.join(HOME, '.claude/skills'), path.join(HOME, '.claude/commands')];
    // skills que vem de plugins
    const pc = path.join(HOME, '.claude/plugins/cache');
    try {
      for (const owner of fs.readdirSync(pc)) {
        const od = path.join(pc, owner);
        for (const plug of fs.readdirSync(od)) {
          const pd = path.join(od, plug);
          for (const ver of fs.readdirSync(pd)) {
            const sd = path.join(pd, ver, 'skills');
            if (fs.existsSync(sd)) dirs.push(sd);
          }
        }
      }
    } catch {}
  } else {
    dirs = [path.join(HOME, '.codex/skills'), path.join(HOME, '.codex/prompts'), path.join(HOME, '.agents/skills')];
  }
  const seen = new Set(); const out = [];
  for (const s of readSkillDirs(dirs)) { if (seen.has(s.name)) continue; seen.add(s.name); out.push(s); }
  out.sort((a, b) => a.name.localeCompare(b.name));
  skillCache[engine] = out;
  return out;
});

/* ---------- conectores (MCP) ---------- */
function rodar(bin, args, timeout) {
  // spawnBin em vez de execFile porque no Windows o binario pode ser um .cmd,
  // que o Node se recusa a chamar direto desde a correcao de seguranca do Node 20
  return new Promise((res) => {
    let out = '', errout = '', acabou = false;
    const p = spawnBin(bin, args, { env: buildEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
    const t = setTimeout(() => { try { p.kill(); } catch {} }, timeout || 60000);
    const fim = (err) => { if (acabou) return; acabou = true; clearTimeout(t); res({ err, out, errout }); };
    p.stdout.on('data', (d) => { if (out.length < 4 * 1024 * 1024) out += d.toString('utf8'); });
    p.stderr.on('data', (d) => { if (errout.length < 4 * 1024 * 1024) errout += d.toString('utf8'); });
    p.on('error', (e) => fim(e));
    p.on('close', (code) => fim(code === 0 ? null : new Error('saiu com código ' + code)));
  });
}

/* ---------- GPT-6 Astra pela API, com trava de gasto ---------- */
const USO_ASTRA_PATH = () => path.join(app.getPath('userData'), 'openai-api-uso.json');
let usoAstraCache = null;
let chaveAstraCache = null;
let testeAstra = { estado: 'nao-testado', mensagem: 'Chave ainda não testada.', quando: 0 };

function mesAstra() { return new Date().toISOString().slice(0, 7); }
function lerUsoAstra() {
  if (usoAstraCache) return usoAstraCache;
  try { usoAstraCache = JSON.parse(fs.readFileSync(USO_ASTRA_PATH(), 'utf8')); } catch { usoAstraCache = {}; }
  usoAstraCache.version = 1;
  usoAstraCache.months = usoAstraCache.months || {};
  usoAstraCache.threads = usoAstraCache.threads || {};
  return usoAstraCache;
}
function gastoAstraMicros() {
  const d = lerUsoAstra();
  return Number((d.months[mesAstra()] || {}).usdMicros || 0);
}
function configAstra() {
  const c = loadConfig();
  const cap = Number(c.codexApiCapUsd);
  return {
    enabled: !!c.codexApiEnabled,
    capUsd: Number.isFinite(cap) && cap > 0 ? Math.min(10000, cap) : 10,
  };
}
async function lerChaveAstra() {
  if (process.platform !== 'darwin') return '';
  const r = await rodar('/usr/bin/security', ['find-generic-password', '-a', ASTRA_KEYCHAIN_ACCOUNT,
    '-s', ASTRA_KEYCHAIN_SERVICE, '-w'], 8000);
  return r.err ? '' : String(r.out || '').trim();
}
async function temChaveAstra(denovo) {
  if (denovo || chaveAstraCache === null) chaveAstraCache = !!(await lerChaveAstra());
  return chaveAstraCache;
}
async function guardarChaveAstra(chave) {
  if (process.platform !== 'darwin') return { error: 'A chave segura está disponível somente no Mac.' };
  const limpa = String(chave || '').trim();
  if (!/^sk-[A-Za-z0-9_-]{20,}$/.test(limpa)) return { error: 'Essa chave não parece uma chave da OpenAI.' };
  const r = await rodar('/usr/bin/security', ['add-generic-password', '-U', '-a', ASTRA_KEYCHAIN_ACCOUNT,
    '-s', ASTRA_KEYCHAIN_SERVICE, '-w', limpa], 10000);
  if (r.err) return { error: 'Não consegui guardar a chave no Chaveiro do Mac.' };
  chaveAstraCache = true;
  testeAstra = { estado: 'nao-testado', mensagem: 'Chave guardada. Falta testar o acesso ao Astra.', quando: 0 };
  return { ok: true };
}
async function testarAstra() {
  const chave = await lerChaveAstra();
  if (!chave) {
    chaveAstraCache = false;
    testeAstra = { estado: 'sem-chave', mensagem: 'Nenhuma chave da OpenAI foi guardada.', quando: Date.now() };
    return testeAstra;
  }
  chaveAstraCache = true;
  try {
    // Consultar os dados do modelo não gera texto e não consome tokens pagos.
    const r = await fetch('https://api.openai.com/v1/models/' + ASTRA_API_MODEL, {
      headers: { Authorization: 'Bearer ' + chave },
    });
    if (r.ok) testeAstra = { estado: 'pronto', mensagem: 'A API desta chave já tem acesso ao Astra.', quando: Date.now() };
    else if (r.status === 401) testeAstra = { estado: 'erro', mensagem: 'A chave é inválida ou foi cancelada.', quando: Date.now() };
    else if (r.status === 403 || r.status === 404) testeAstra = { estado: 'aguardando', mensagem: 'A chave funciona, mas este projeto ainda não recebeu o Astra.', quando: Date.now() };
    else testeAstra = { estado: 'erro', mensagem: 'A OpenAI respondeu com erro ' + r.status + '.', quando: Date.now() };
  } catch {
    testeAstra = { estado: 'erro', mensagem: 'Não consegui falar com a OpenAI. Confira a internet.', quando: Date.now() };
  }
  return testeAstra;
}
async function estadoAstra() {
  const c = configAstra();
  const gasto = gastoAstraMicros() / 1000000;
  return {
    configured: await temChaveAstra(false), enabled: c.enabled, capUsd: c.capUsd,
    spentUsd: gasto, remainingUsd: Math.max(0, c.capUsd - gasto),
    testStatus: testeAstra.estado, testMessage: testeAstra.mensagem, testedAt: testeAstra.quando,
  };
}
async function validarUsoAstra() {
  if (process.platform !== 'darwin') throw new Error('O Astra por créditos está preparado somente no Mac.');
  const c = configAstra();
  if (!c.enabled) throw new Error('O uso por créditos está desligado nos Ajustes.');
  if (!(await temChaveAstra(false))) throw new Error('Guarde uma chave da OpenAI nos Ajustes antes de usar créditos.');
  if (gastoAstraMicros() >= Math.round(c.capUsd * 1000000)) {
    throw new Error('O limite mensal do Astra por créditos foi atingido. Aumente o teto nos Ajustes para continuar.');
  }
}
function custoAstraMicros(tokens) {
  const entrada = Math.max(0, Number(tokens.inputTokens || 0));
  const cache = Math.max(0, Number(tokens.cachedInputTokens || 0));
  const cacheGravado = Math.max(0, Number(tokens.cacheWriteInputTokens || 0));
  const normal = Math.max(0, entrada - cache - cacheGravado);
  const saida = Math.max(0, Number(tokens.outputTokens || 0));
  // Preços oficiais em dólares por milhão. O resultado abaixo já fica em milionésimos de dólar.
  return Math.max(0, Math.round(normal * 10 + cache * 1 + cacheGravado * 12.5 + saida * 50));
}
function registrarUsoAstra(threadId, tokens) {
  const d = lerUsoAstra();
  const id = String(threadId || 'sem-id');
  const total = custoAstraMicros(tokens);
  const anterior = Number((d.threads[id] || {}).usdMicros || 0);
  const delta = Math.max(0, total - anterior);
  d.threads[id] = { usdMicros: Math.max(anterior, total), updatedAt: Date.now() };
  const mes = mesAstra();
  const m = d.months[mes] || { usdMicros: 0 };
  m.usdMicros = Number(m.usdMicros || 0) + delta;
  d.months[mes] = m;
  if (delta) gravarSeguro(USO_ASTRA_PATH(), JSON.stringify(d, null, 2));
  const c = configAstra();
  const gasto = m.usdMicros / 1000000;
  return { spentUsd: gasto, capUsd: c.capUsd, remainingUsd: Math.max(0, c.capUsd - gasto) };
}
/* ---------- terminal embutido: roda no app, sem abrir o Terminal do sistema ----------
   Dá um terminal de verdade (pty) ao comando, assim as telinhas interativas
   (login, colar codigo) funcionam dentro do Cockpit. No Mac quem faz isso é o
   ptybridge.py; no Windows é o ConPTY. Quem escolhe é o plataforma.js.        */
const terms = new Map();
const PTY_BRIDGE = app.isPackaged
  ? path.join(process.resourcesPath, 'ptybridge.py')
  : path.join(__dirname, 'ptybridge.py');

function termEnviar(id, kind, data) {
  if (win && !win.isDestroyed()) win.webContents.send('term:event', { id, kind, ...data }); avisarWeb('term:event', { id, kind, ...data });
}

function termRodar({ id, linha, cols, rows }) {
  if (!id || !linha) return { error: 'faltou o comando' };
  termMatar(id);
  const c = Math.max(40, Math.min(400, Number(cols) || 100));
  const r = Math.max(10, Math.min(200, Number(rows) || 30));
  let p;
  try {
    p = abrirPty({
      linha, cols: c, rows: r, cwd: HOME, ptyBridge: PTY_BRIDGE,
      env: { ...buildEnv(), TERM: 'xterm-256color', COLUMNS: String(c), LINES: String(r) },
    });
  } catch (e) { return { error: e.message }; }
  terms.set(id, p);
  p.onData((d) => termEnviar(id, 'data', { data: d }));
  p.onErro((e) => termEnviar(id, 'data', { data: '\r\n[erro: ' + e.message + ']\r\n' }));
  p.onFim((code) => { terms.delete(id); termEnviar(id, 'exit', { code }); });
  return { ok: true };
}

function termMatar(id) {
  const p = terms.get(id);
  if (!p) return { ok: true };
  terms.delete(id);
  p.matar();
  return { ok: true };
}

handle('term:run', (_e, o) => termRodar(o || {}));
handle('term:input', (_e, { id, data }) => {
  const p = terms.get(id);
  if (!p) return { error: 'esse terminal já fechou' };
  try { p.escrever(data); } catch (e) { return { error: e.message }; }
  return { ok: true };
});
handle('term:resize', (_e, { id, cols, rows }) => {
  const p = terms.get(id);
  if (!p) return { ok: true };
  p.redimensionar(Math.round(cols), Math.round(rows));
  return { ok: true };
});
handle('term:kill', (_e, { id }) => termMatar(id));

app.on('before-quit', () => { for (const id of [...terms.keys()]) termMatar(id); });

function alvoDoTransporte(t) {
  if (!t) return '';
  if (t.url) return t.url;
  const c = t.command;
  if (Array.isArray(c)) return c.join(' ');
  if (typeof c === 'string') return c + (Array.isArray(t.args) ? ' ' + t.args.join(' ') : '');
  return t.type || '';
}

handle('mcp:list', async (_e, engine) => {
  if (engine === 'codex') {
    const r = await rodar('codex', ['mcp', 'list', '--json'], 45000);
    try {
      const arr = JSON.parse(r.out);
      return arr.map(m => ({
        nome: m.name,
        alvo: alvoDoTransporte(m.transport),
        ligado: m.enabled !== false,
        precisaEntrar: m.auth_status === 'not_logged_in' && (m.transport || {}).type !== 'stdio',
        status: m.auth_status === 'logged_in' ? 'conectado'
          : m.auth_status === 'not_logged_in' ? 'precisa entrar' : (m.disabled_reason || 'ok'),
      }));
    } catch (e) { return { error: 'não consegui ler a lista do Codex: ' + String(e.message).slice(0, 160) }; }
  }
  const r = await rodar(CLAUDE_BIN, ['mcp', 'list'], 90000);
  const linhas = (r.out + '\n' + r.errout).split('\n').map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const l of linhas) {
    const m = l.match(/^(.+?):\s+(\S+)\s+-\s+(.+)$/);
    if (!m) continue;
    const st = m[3];
    out.push({
      nome: m[1], alvo: m[2],
      ligado: true,
      precisaEntrar: /authentication|auth/i.test(st),
      status: /Connected/i.test(st) ? 'conectado' : /authentication/i.test(st) ? 'precisa entrar' : st.replace(/[✔✗!⏸]/g, '').trim(),
    });
  }
  return out;
});

handle('mcp:acao', async (_e, { engine, acao, nome, url, comando }) => {
  const bin = engine === 'claude' ? CLAUDE_BIN : 'codex';
  const cru = engine === 'claude' ? CLAUDE_BIN : acharBin('codex');
  // Esta linha vai para o /bin/sh. O JSON.stringify() de antes so poe aspas DUPLAS, e dentro
  // delas o sh ainda expande $(...) e crase: um nome de conector com isso dentro (vem do
  // formulario e do ~/.claude.json, que qualquer programa escreve) rodava comando escondido.
  // Aspas SIMPLES nao expandem nada.
  const aspas = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
  const nomeBin = aspas(cru);
  if (acao === 'login' || acao === 'logout') {
    // roda no terminal embutido do Cockpit, sem abrir o Terminal do Mac
    return { terminal: nomeBin + ' mcp ' + acao + ' ' + aspas(nome),
             titulo: (acao === 'login' ? 'Entrar no conector ' : 'Sair do conector ') + nome };
  }
  if (acao === 'remove') {
    const r = await rodar(bin, ['mcp', 'remove', nome], 30000);
    return r.err ? { error: (r.errout || r.err.message).slice(0, 300) } : { ok: true };
  }
  if (acao === 'add') {
    if (!nome) return { error: 'falta o nome' };
    let args;
    if (url) {
      args = engine === 'claude' ? ['mcp', 'add', '--transport', 'http', nome, url] : ['mcp', 'add', nome, '--url', url];
    } else if (comando) {
      const partes = comando.split(/\s+/).filter(Boolean);
      args = engine === 'claude' ? ['mcp', 'add', nome, '--', ...partes] : ['mcp', 'add', nome, '--', ...partes];
    } else return { error: 'informe o endereço ou o comando' };
    const r = await rodar(bin, args, 45000);
    return r.err ? { error: (r.errout || r.out || r.err.message).slice(0, 300) } : { ok: true };
  }
  return { error: 'ação desconhecida' };
});

/* ---------- conta e limite de uso ---------- */
// Mac: Chaveiro. Windows: arquivo de credenciais. Detalhe em plataforma.js
const tokenDoClaude = plataforma.tokenClaude;

// fica guardado na memoria: assim o Chaveiro so e consultado uma vez por sessao do app,
// em vez de a cada leitura da faixa de uso
let credGuardada = null;
function credClaude(denovo) {
  if (denovo) credGuardada = null;
  if (!credGuardada) credGuardada = tokenDoClaude();
  return credGuardada;
}

async function usoDoClaude(segundaTentativa) {
  const t = credClaude(false);
  if (!t) return null;
  try {
    const r = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: 'Bearer ' + t, 'anthropic-beta': 'oauth-2025-04-20' },
    });
    // vencida: descarta a guardada e tenta mais uma vez com a atual
    if ((r.status === 401 || r.status === 403) && !segundaTentativa) { credClaude(true); return usoDoClaude(true); }
    // 429 e "muita consulta em pouco tempo", nao e conta com problema: vale dizer isso
    if (r.status === 429) return { limitado: true };
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

handle('conta:ler', async (_e, engine) => {
  if (engine === 'claude') {
    let conta = {};
    try { conta = JSON.parse((await rodar(CLAUDE_BIN, ['auth', 'status'], 25000)).out || '{}'); } catch {}
    const u = await usoDoClaude();
    const janela = (x) => x ? { pct: Math.round(x.utilization || 0), reseta: x.resets_at ? Date.parse(x.resets_at) : 0 } : null;
    return {
      entrou: !!conta.loggedIn,
      email: conta.email || '',
      nome: (conta.orgName || '').replace(/'s Organization$/, '') || conta.email || '',
      plano: conta.subscriptionType || '',
      via: conta.authMethod || '',
      // 429 do endpoint de uso = muita consulta em pouco tempo. Nao e conta com problema,
      // entao a tela diz isso em vez de "nao consegui ler"
      limitado: !!(u && u.limitado),
      sessao: (u && !u.limitado) ? janela(u.five_hour) : null,
      semana: (u && !u.limitado) ? janela(u.seven_day) : null,
      extra: u && u.extra_usage ? {
        ligado: !!u.extra_usage.is_enabled,
        usado: u.extra_usage.used_credits || 0,
        teto: u.extra_usage.monthly_limit || 0,
        moeda: u.extra_usage.currency || '',
      } : null,
    };
  }

  // sem este try, quando o Codex nao sobe a promessa rejeita, o renderer morre na linha do
  // await e o painel fica girando em "Vendo a conta..." para sempre, sem erro nenhum
  try { await codexStart(); }
  catch (e) {
    return {
      entrou: false, email: '', nome: '', plano: '', via: '',
      sessao: null, semana: null, extra: null,
      erro: 'não consegui falar com o Codex: ' + String((e && e.message) || e),
    };
  }
  let conta = {}, lim = {};
  try { conta = await codexReq('local', 'account/read', {}); } catch {}
  try { lim = await codexReq('local', 'account/rateLimits/read', {}); } catch {}
  const rl = (lim && lim.rateLimits) || {};
  const jan = (x) => x ? { pct: Math.round(x.usedPercent || 0), reseta: (x.resetsAt || 0) * 1000, mins: x.windowDurationMins || 0 } : null;
  const a = jan(rl.primary), b = jan(rl.secondary);
  const curta = [a, b].find(x => x && x.mins && x.mins <= 1440) || null;
  const longa = [a, b].find(x => x && x.mins && x.mins > 1440) || null;
  const c = (conta && conta.account) || {};
  return {
    entrou: !!c.email,
    email: c.email || '',
    nome: c.email || '',
    plano: c.planType || rl.planType || '',
    via: c.type || '',
    sessao: curta,
    semana: longa,
    extra: rl.credits ? {
      ligado: !!rl.credits.hasCredits,
      usado: 0,
      teto: rl.credits.unlimited ? -1 : Number(rl.credits.balance || 0),
      moeda: 'créditos',
    } : null,
  };
});

/* so os percentuais do plano, para a faixa em cima da caixa de texto.
   Diferente do conta:ler, nao chama o CLI: e leve o bastante para repetir de minuto em minuto. */
handle('uso:ler', async (_e, engine) => {
  if (engine === 'claude') {
    const u = await usoDoClaude();
    if (!u) return null;
    if (u.limitado) return { limitado: true, sessao: null, semana: null };
    const janela = (x) => x ? { pct: Math.round(x.utilization || 0), reseta: x.resets_at ? Date.parse(x.resets_at) : 0 } : null;
    return { sessao: janela(u.five_hour), semana: janela(u.seven_day) };
  }
  try {
    await codexStart();
    const lim = await codexReq('local', 'account/rateLimits/read', {});
    const rl = (lim && lim.rateLimits) || {};
    const jan = (x) => x ? { pct: Math.round(x.usedPercent || 0), reseta: (x.resetsAt || 0) * 1000, mins: x.windowDurationMins || 0 } : null;
    const a = jan(rl.primary), b = jan(rl.secondary);
    return {
      sessao: [a, b].find(x => x && x.mins && x.mins <= 1440) || null,
      semana: [a, b].find(x => x && x.mins && x.mins > 1440) || null,
    };
  } catch { return null; }
});

handle('auth:acao', async (_e, { engine, acao, cwd }) => {
  const ehClaude = engine === 'claude';
  const naVps = ehRemoto(cwd);
  const alvo = naVps ? (ehClaude ? 'claude' : 'codex') : (ehClaude ? CLAUDE_BIN : acharBin('codex'));
  const bin = (/[ ()]/.test(alvo) ? '"' + alvo + '"' : alvo);
  // na VPS tudo roda por SSH, dentro do usuario que tem a conta
  const naMaquina = (comando) => {
    if (!naVps) return null;
    const r = partesRemoto(cwd);
    return 'ssh -o BatchMode=yes -o ConnectTimeout=12 ' + r.host + ' ' + JSON.stringify(linhaNoServidor(r, comando));
  };
  const CMD = ehClaude
    ? { login: 'auth login', logout: 'auth logout', status: 'auth status', codigo: 'auth login' }
    : { login: 'login', logout: 'logout', status: 'login status', codigo: 'login --device-auth' };

  if (acao === 'status') {
    if (naVps) {
      const r2 = await noServidor(partesRemoto(cwd), bin + ' ' + CMD.status, 25000);
      return { texto: String(r2.out || r2.error || '').trim().slice(0, 800) };
    }
    const r = await rodar(alvo, CMD.status.split(' '), 25000);
    return { texto: String(r.out || r.errout || (r.err && r.err.message) || '').trim().slice(0, 800) };
  }

  // TROCAR de conta: sai da atual e entra na nova numa tacada so.
  // Sem o logout antes, o CLI ve que ja tem sessao e nao troca nada — era o que quebrava.
  const ondeDiz = naVps ? ' na VPS' : '';
  if (acao === 'trocar' || acao === 'trocarCodigo') {
    // na VPS o navegador nao existe: o caminho que funciona e o codigo (device auth)
    const entrar = (acao === 'trocarCodigo' || naVps) ? CMD.codigo : CMD.login;
    const linha = bin + ' ' + CMD.logout + ' ; ' + bin + ' ' + entrar;
    return {
      terminal: naMaquina(linha) || linha,
      titulo: 'Trocar a conta do ' + (ehClaude ? 'Claude' : 'Codex') + ondeDiz,
      esperaLink: true, confereDepois: true, naVps,
    };
  }

  const cmd = CMD[acao];
  if (!cmd) return { error: 'ação desconhecida' };
  const linha = bin + ' ' + cmd;
  return { terminal: naMaquina(linha) || linha,
           titulo: (acao === 'logout' ? 'Sair da conta do ' : 'Entrar na conta do ') + (ehClaude ? 'Claude' : 'Codex') + ondeDiz,
           esperaLink: acao !== 'logout', confereDepois: acao !== 'logout', naVps };
});

/* Um toque no iPhone NUNCA pode abrir janela do sistema no Mac: no macOS ela nasce presa a
   janela (modal) e trava o Cockpit inteiro para quem esta na frente do computador. O servidor
   do telefone ja marca a chamada com { remoto: true }; faltava alguem olhar. */
const souRemoto = (e) => !!(e && e.remoto);

handle('codex:api-status', async () => estadoAstra());
handle('codex:api-key:set', async (_e, chave) => {
  if (souRemoto(_e)) return { error: 'A chave só pode ser guardada no Mac.' };
  const r = await guardarChaveAstra(chave);
  return r.error ? r : { ...(await estadoAstra()), ok: true };
});
handle('codex:api-test', async (_e) => {
  if (souRemoto(_e)) return { error: 'O teste da chave só pode ser feito no Mac.' };
  await testarAstra();
  return estadoAstra();
});
handle('codex:api-config:set', async (_e, dados) => {
  if (souRemoto(_e)) return { error: 'O uso por créditos só pode ser alterado no Mac.' };
  const c = loadConfig();
  const cap = Number(dados && dados.capUsd);
  c.codexApiCapUsd = Number.isFinite(cap) && cap > 0 ? Math.min(10000, cap) : 10;
  if (dados && Object.prototype.hasOwnProperty.call(dados, 'enabled')) {
    if (dados.enabled && !(await temChaveAstra(false))) return { error: 'Guarde a chave da OpenAI antes de ligar os créditos.' };
    c.codexApiEnabled = !!dados.enabled;
  }
  anotarChaveDoMain('codexApiCapUsd', c.codexApiCapUsd);
  anotarChaveDoMain('codexApiEnabled', !!c.codexApiEnabled);
  saveConfig(c);
  // Desligar significa parar também um trabalho pago que já esteja rodando, não só o próximo.
  if (!c.codexApiEnabled) {
    for (const [paneId, origem] of codexPaneBilling) {
      if (origem !== 'api') continue;
      const threadId = codex.paneToThread.get(paneId), turnId = codex.paneTurn.get(paneId);
      if (threadId && turnId) codexReq(destinoDoPane(paneId), 'turn/interrupt', { threadId, turnId }).catch(() => {});
    }
  }
  return estadoAstra();
});

handle('user:pickPhoto', async (_e) => {
  if (souRemoto(_e)) return { error: 'Trocar a foto só funciona no Mac.' };
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], defaultPath: HOME,
    filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  try {
    const f = r.filePaths[0];
    const ext = path.extname(f).slice(1).toLowerCase();
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    const b = fs.readFileSync(f);
    if (b.length > 3 * 1024 * 1024) return { error: 'Imagem muito pesada. Use uma menor que 3 MB.' };
    return { dataUrl: 'data:image/' + mime + ';base64,' + b.toString('base64') };
  } catch (e) { return { error: e.message }; }
});

const EXT_IMG = ['png','jpg','jpeg','gif','webp','bmp','heic','svg'];
/* o que estiver na area de transferencia: arquivos copiados no Finder ou imagem/print */
function arquivosColados() {
  const achados = [];
  try {
    const buf = clipboard.readBuffer('NSFilenamesPboardType');
    if (buf && buf.length) {
      const txt = buf.toString('utf8');
      for (const m of txt.matchAll(/<string>([^<]+)<\/string>/g)) achados.push(m[1]);
    }
  } catch {}
  if (!achados.length) {
    for (const fmt of ['public.file-url', 'text/uri-list']) {
      try {
        const u = clipboard.read(fmt);
        if (u) for (const linha of String(u).split(/\r?\n/)) {
          const l = linha.trim();
          if (l.startsWith('file://')) achados.push(decodeURIComponent(l.replace(/^file:\/\//, '')));
        }
      } catch {}
    }
  }
  return [...new Set(achados)].filter(f => { try { return fs.existsSync(f); } catch { return false; } });
}

const EXT_VIS_IMG = ['png','jpg','jpeg','gif','webp','bmp','svg'];
handle('arquivo:ver', (_e, file) => {
  try {
    const st = fs.statSync(file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const base = { path: file, nome: path.basename(file), ext, bytes: st.size };
    if (EXT_VIS_IMG.includes(ext) && st.size <= 25 * 1024 * 1024) {
      const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
      base.tipo = 'imagem';
      base.dados = 'data:image/' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
    } else if (st.size <= 600 * 1024 && /^(txt|md|json|js|ts|py|html|css|csv|log|sh|yml|yaml|toml|xml)$/.test(ext)) {
      base.tipo = 'texto';
      base.dados = fs.readFileSync(file, 'utf8');
    } else {
      base.tipo = 'outro';
    }
    return base;
  } catch (e) { return { erro: e.message, path: file, nome: path.basename(file) }; }
});

handle('clipboard:anexos', () => {
  const arquivos = arquivosColados();
  if (arquivos.length) return { arquivos };
  try {
    const img = clipboard.readImage();
    if (img && !img.isEmpty()) {
      const dir = path.join(app.getPath('userData'), 'colados');
      fs.mkdirSync(dir, { recursive: true });
      const nome = 'colado-' + Date.now() + '.png';
      const destino = path.join(dir, nome);
      fs.writeFileSync(destino, img.toPNG());
      return { arquivos: [destino] };
    }
  } catch {}
  return { arquivos: [] };
});

/* ---------- quadro branco: o desenho vira PNG + JSON aqui no Mac ----------
   O telefone TAMBEM salva: nao ha janela do sistema envolvida, so escrita numa pasta nossa.
   Em troca, nada do que chega vira caminho: o nome do arquivo e montado aqui dentro, e o
   conteudo e conferido byte a byte antes de virar arquivo. */
const PASTA_QUADROS = () => path.join(app.getPath('userData'), 'quadros');
const QUADRO_MAX_PNG = 12 * 1024 * 1024;   // ja decodificado
const QUADRO_MAX_CENA = 2 * 1024 * 1024;   // o JSON da cena, em texto
const SELO_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
function carimboQuadro() {
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate())
    + '_' + z(d.getHours()) + z(d.getMinutes()) + z(d.getSeconds());
}
function cenaEmTexto(cena) {
  const t = JSON.stringify(cena && typeof cena === 'object' && !Array.isArray(cena)
    ? cena : { v: 1, formas: [], setas: [] });
  return t.length > QUADRO_MAX_CENA ? null : t;
}

handle('quadro:salvar', (_e, { png, cena } = {}) => {
  try {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(png || ''));
    if (!m) return { error: 'o desenho não veio como PNG' };
    const cru = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
    // a assinatura do PNG. Sem isto, qualquer base64 viraria um arquivo .png mentiroso
    if (cru.length < 8 || !cru.subarray(0, 8).equals(SELO_PNG)) return { error: 'o desenho não é um PNG' };
    if (cru.length > QUADRO_MAX_PNG) return { error: 'o desenho ficou grande demais' };
    const texto = cenaEmTexto(cena);
    if (texto == null) return { error: 'o desenho tem peças demais' };
    const dir = PASTA_QUADROS();
    fs.mkdirSync(dir, { recursive: true });
    let base = 'quadro-' + carimboQuadro(), n = 2;
    while (fs.existsSync(path.join(dir, base + '.png'))) base = 'quadro-' + carimboQuadro() + '-' + (n++);
    const alvoPng = path.join(dir, base + '.png');
    const alvoJson = path.join(dir, base + '.json');
    fs.writeFileSync(alvoPng, cru);
    fs.writeFileSync(alvoJson, texto, 'utf8');
    anota('quadro salvo', alvoPng);
    return { png: alvoPng, json: alvoJson };
  } catch (e) { return { error: e.message }; }
});

handle('quadro:rascunhoGravar', (_e, { cena } = {}) => {
  try {
    const texto = cenaEmTexto(cena);
    if (texto == null) return { error: 'o desenho tem peças demais' };
    const dir = PASTA_QUADROS();
    fs.mkdirSync(dir, { recursive: true });
    // gravarSeguro grava num .tmp e troca o nome: nunca fica meio arquivo
    return gravarSeguro(path.join(dir, 'rascunho.json'), texto) ? { ok: true } : { error: 'não consegui gravar o rascunho' };
  } catch (e) { return { error: e.message }; }
});

handle('quadro:rascunhoLer', () => {
  try {
    const arq = path.join(PASTA_QUADROS(), 'rascunho.json');
    if (!fs.existsSync(arq)) return { cena: null };
    const c = JSON.parse(fs.readFileSync(arq, 'utf8'));
    return { cena: (c && typeof c === 'object' && !Array.isArray(c)) ? c : null };
  } catch { return { cena: null }; }   // rascunho quebrado nunca derruba a abertura do quadro
});

handle('anexo:ler', (_e, file) => {
  try {
    const st = fs.statSync(file);
    const ext = path.extname(file).slice(1).toLowerCase();
    const base = { path: file, nome: path.basename(file), ext, bytes: st.size };
    if (EXT_IMG.includes(ext) && st.size <= 8 * 1024 * 1024) {
      const mime = ext === 'jpg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : ext;
      base.mini = 'data:image/' + mime + ';base64,' + fs.readFileSync(file).toString('base64');
    }
    return base;
  } catch (e) { return { path: file, nome: path.basename(file), erro: e.message }; }
});

handle('dialog:pickFiles', async (_e, kind) => {
  if (souRemoto(_e)) return [];
  const opt = { properties: ['multiSelections'], defaultPath: HOME };
  if (kind === 'folder') opt.properties = ['openDirectory'];
  else opt.properties.push('openFile');
  if (kind === 'image') opt.filters = [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'] }];
  const r = await dialog.showOpenDialog(win, opt);
  return r.canceled ? [] : r.filePaths;
});

/* ======================= janela ======================= */
function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 900, minWidth: 900, minHeight: 560,
    backgroundColor: '#1e1e1e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, 'renderer/index.html'));
  win.on('focus', zerarBadge);   // voltou para a janela: o numero no Dock nao serve mais
  // o ditado precisa do microfone; a pagina e o proprio app, entao o pedido e liberado
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(true));

  // menu do botao direito: copiar, colar, procurar, etc. — o do sistema mesmo
  win.webContents.on('context-menu', (_ev, props) => {
    const itens = [];
    const temSelecao = !!(props.selectionText && props.selectionText.trim());
    const podeEditar = props.isEditable;

    if (props.linkURL) {
      itens.push({ label: 'Abrir link no navegador', click: () => shell.openExternal(props.linkURL) });
      itens.push({ label: 'Copiar o endereço do link', click: () => clipboard.writeText(props.linkURL) });
      itens.push({ type: 'separator' });
    }
    if (podeEditar) {
      itens.push({ role: 'undo', label: 'Desfazer' });
      itens.push({ role: 'redo', label: 'Refazer' });
      itens.push({ type: 'separator' });
      itens.push({ role: 'cut', label: 'Recortar' });
    }
    itens.push({ role: 'copy', label: 'Copiar', enabled: temSelecao });
    if (podeEditar) itens.push({ role: 'paste', label: 'Colar' });
    if (podeEditar) itens.push({ role: 'selectAll', label: 'Selecionar tudo' });
    else if (temSelecao) itens.push({ role: 'selectAll', label: 'Selecionar tudo' });

    if (temSelecao) {
      const t = props.selectionText.trim().slice(0, 120);
      itens.push({ type: 'separator' });
      itens.push({ label: 'Procurar no Google', click: () => shell.openExternal('https://www.google.com/search?q=' + encodeURIComponent(t)) });
      // se o que ele marcou parece um caminho de arquivo, deixo abrir no Finder
      if (/^[~/][^\n]{2,}$/.test(t)) {
        itens.push({ label: 'Mostrar no Finder', click: () => shell.showItemInFolder(t.replace(/^~/, HOME)) });
      }
    }
    itens.push({ type: 'separator' });
    itens.push({ label: 'Recarregar a tela', click: () => win.webContents.reload() });
    itens.push({ label: 'Ferramentas de desenvolvedor', click: () => win.webContents.toggleDevTools() });

    Menu.buildFromTemplate(itens).popup({ window: win });
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // clicar num link nunca troca a tela do app: abre no navegador.
  // O file:// ficava LIBERADO aqui, e era por isso que arrastar um arquivo e soltar fora da
  // caixa de texto fazia o Cockpit "sumir": a janela navegava para o arquivo e a interface
  // inteira era trocada pelo conteudo dele. Agora nada navega; arquivo abre no Finder.
  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    if (/^https?:/i.test(url)) { shell.openExternal(url); return; }
    if (url.startsWith('file://')) {
      try { shell.showItemInFolder(decodeURIComponent(url.replace('file://', ''))); } catch {}
    }
  });
  win.on('closed', () => { win = null; shutdown(); });
}

function shutdown() {
  for (const id of [...claudePanes.keys()]) claudeStop(id);
  for (const c of codexConns.values()) { if (c.proc) { try { c.proc.kill('SIGTERM'); } catch {} c.proc = null; c.ready = null; } }
}

/* ======================= IPC ======================= */
handle('config:get', () => loadConfig());
/* Estas tres chaves quem manda e o main (senha do iPhone e o liga/desliga do Wi-Fi). A tela
   trabalha com uma copia do config lida uma unica vez no boot, entao qualquer gravacao dela
   — e o savePanes() grava a cada chat aberto, fechado ou redimensionado — mandava de volta o
   valor VELHO e apagava a senha e o "ligado". Era por isso que o acesso pelo iPhone se
   desligava sozinho e a senha mudava. Agora estas tres vem sempre do disco. */
const CHAVES_DO_MAIN = ['senhaWeb', 'webLigado', 'webSeguroConfirmado', 'codexApiEnabled', 'codexApiCapUsd'];
/* Estas tres ficam na memoria do main. Antes eu relia o arquivo de 2,2 MB a cada gravacao so
   para busca-las — e o savePanes grava a cada chat aberto ou fechado. Quem escreve nelas e
   sempre o main (senhaDoTelefone e web:ligar), entao a copia na memoria esta sempre certa. */
let chavesDoMain = null;
function lerChavesDoMain() {
  if (chavesDoMain) return chavesDoMain;
  const d = loadConfig();
  chavesDoMain = {};
  for (const k of CHAVES_DO_MAIN) {
    if (Object.prototype.hasOwnProperty.call(d, k)) chavesDoMain[k] = d[k];
  }
  return chavesDoMain;
}
function anotarChaveDoMain(k, v) { lerChavesDoMain(); chavesDoMain[k] = v; }

handle('config:set', (_e, c) => {
  const novo = (c && typeof c === 'object') ? { ...c } : {};
  const donas = lerChavesDoMain();
  for (const k of CHAVES_DO_MAIN) {
    if (Object.prototype.hasOwnProperty.call(donas, k)) novo[k] = donas[k];
    else delete novo[k];
  }
  saveConfig(novo);
  return true;
});
handle('sys:home', () => HOME);

/* Escolher pasta sem um ponto de partida cai na home, e de la sao 3 cliques ate os projetos.
   O padrao passa a ser a pasta dos projetos do Claude, que e de onde quase toda aba nasce. */
const PASTA_PROJETOS = path.join(HOME, 'Desktop', 'Projetos-claude');
function pastaInicial(start) {
  if (start) return start;
  try { if (fs.statSync(PASTA_PROJETOS).isDirectory()) return PASTA_PROJETOS; } catch {}
  return HOME;
}
handle('dialog:pickFolder', async (_e, start) => {
  if (souRemoto(_e)) return null;
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], defaultPath: pastaInicial(start), title: 'Pasta de trabalho deste painel' });
  return r.canceled ? null : r.filePaths[0];
});
handle('fs:list', (_e, d) => (ehRemoto(d) ? listDirRemoto(d) : listDir(d)));
handle('fs:read', (_e, f) => {
  if (ehRemoto(f)) return lerArquivoRemoto(f);
  try {
    if (fs.statSync(f).size > 500 * 1024) return { error: 'Arquivo grande demais para ver aqui.' };
    return { content: fs.readFileSync(f, 'utf8') };
  } catch (e) { return { error: e.message }; }
});
// listar pastas da VPS para o seletor de pasta remoto
handle('vps:pastas', async (_e, cwd) => {
  const alvo = ehRemoto(cwd) ? cwd : 'vps:/';
  return listDirRemoto(alvo);
});
handle('vps:testar', async () => {
  const r = partesRemoto('vps:/');
  const rr = await noServidor(r, 'echo ok; claude --version 2>/dev/null | head -1', 15000);
  if (rr.error) return { error: rr.error };
  return { ok: true, versao: (rr.out || '').split('\n')[1] || '' };
});
/* ---------- guardar a conversa no Obsidian ----------
   Regra da casa: texto mora no vault. Conversa de cliente vai para a pasta dele; o resto cai
   em "3 - Operação". O nome do cliente sai da pasta do chat (…/Projetos-claude/<Cliente>/…). */
const VAULT = path.join(HOME, 'Documents', 'Adsure - Copy Lançamentos');
function pastaNoVault(cwd) {
  const m = String(cwd || '').match(/Projetos-claude\/([^/]+)/);
  const cliente = m && m[1];
  const genericos = ['Homero', 'Adsure'];
  if (cliente && !genericos.includes(cliente)) {
    const dele = path.join(VAULT, '2 - Clientes', cliente, '_Fontes');
    if (fs.existsSync(path.join(VAULT, '2 - Clientes', cliente))) return dele;
  }
  return path.join(VAULT, '3 - Operação', 'Conversas do Cockpit');
}
handle('vault:salvar', (_e, { titulo, cwd, motor, texto }) => {
  try {
    if (!fs.existsSync(VAULT)) return { error: 'não achei o vault do Obsidian' };
    const pasta = pastaNoVault(cwd);
    fs.mkdirSync(pasta, { recursive: true });
    const d = new Date();
    const dia = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const limpo = String(titulo || 'Conversa').replace(/[\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
    let arq = path.join(pasta, dia + ' - ' + limpo + '.md');
    let n = 2;
    while (fs.existsSync(arq)) arq = path.join(pasta, dia + ' - ' + limpo + ' (' + (n++) + ').md');
    const cab = '---\nfonte: Cockpit\nmotor: ' + (motor || '') + '\npasta: ' + (cwd || '') + '\ndata: ' + dia + '\n---\n\n# ' + limpo + '\n\n';
    fs.writeFileSync(arq, cab + (texto || ''), 'utf8');
    return { ok: true, caminho: arq, pasta, curto: arq.replace(VAULT + '/', '') };
  } catch (e) { return { error: e.message }; }
});

/* ---------- ditar: o audio vira texto aqui no Mac ----------
   whisper.cpp com o modelo small. Sem internet, sem conta, sem custo por minuto. */
const VOZ_MODELO = path.join(HOME, '.cockpit', 'modelos', 'ggml-small.bin');
handle('voz:transcrever', async (_e, { audio }) => {
  try {
    if (!fs.existsSync(VOZ_MODELO)) return { error: 'falta o modelo de voz em ~/.cockpit/modelos' };
    const whisper = acharBin('whisper-cli');
    const ff = acharBin('ffmpeg');
    if (!whisper || !ff) return { error: 'falta o whisper-cli ou o ffmpeg' };
    const base = path.join(os.tmpdir(), 'ck-voz-' + process.pid);
    fs.writeFileSync(base + '.webm', Buffer.from(audio, 'base64'));
    // o whisper so aceita wav de 16 kHz mono: o navegador grava em webm/opus
    const conv = await rodar(ff, ['-y', '-i', base + '.webm', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', base + '.wav'], 60000);
    if (!fs.existsSync(base + '.wav')) return { error: 'não converti o áudio' + (conv.errout ? ': ' + String(conv.errout).slice(-120) : '') };
    await rodar(whisper, ['-m', VOZ_MODELO, '-l', 'pt', '-nt', '-otxt', '-of', base, base + '.wav'], 180000);
    const saida = base + '.txt';
    const texto = fs.existsSync(saida) ? fs.readFileSync(saida, 'utf8').trim() : '';
    for (const f of [base + '.webm', base + '.wav', saida]) { try { fs.unlinkSync(f); } catch {} }
    if (!texto) return { error: 'não saiu texto nenhum' };
    return { texto };
  } catch (e) { return { error: e.message }; }
});

/* ---------- avisar que a resposta ficou pronta ----------
   Ele sai da frente do Mac enquanto o motor trabalha e voltava so para descobrir se ja tinha
   acabado. Agora chega recado do sistema e o icone no Dock ganha o numero de chats prontos.
   Clicar no recado traz a janela para a frente E abre o chat certo. */
/* ---------- ditado AO VIVO (motor de fala do proprio macOS) ----------
   O ditado antigo grava tudo, para, converte e so entao transcreve: ele fala 40 segundos
   olhando para uma tela muda. Aqui quem ouve e o motor nativo do Mac (SpeechAnalyzer, o mesmo
   do Eco), num programinha Swift que cospe uma linha JSON por evento — parcial enquanto fala,
   final quando fecha a frase, e para sozinho quando o silencio passa de N segundos.
   Nada de ffmpeg, nada de arquivo temporario, nada de modelo de 465 MB na memoria. */
const VOZ_BIN = app.isPackaged
  ? path.join(process.resourcesPath, 'ditado-vivo')
  : path.join(__dirname, 'voz', 'ditado-vivo');
const vozAtiva = new Map();     // paneId -> processo do ditado
function vozMatar(paneId) {
  const p = vozAtiva.get(paneId);
  if (!p) return;
  vozAtiva.delete(paneId);
  try { p.kill('SIGTERM'); } catch {}
}
handle('voz:vivo', (_e, { paneId, silencio, teto }) => {
  if (process.platform !== 'darwin') return { error: 'o ditado ao vivo só existe no Mac' };
  if (!fs.existsSync(VOZ_BIN)) return { error: 'falta o programa de ditado' };
  vozMatar(paneId);
  let proc;
  try {
    proc = spawn(VOZ_BIN, ['pt-BR', String(silencio || 1.8), String(teto || 180), '15'],
      { stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) { return { error: String(e && e.message || e) }; }
  vozAtiva.set(paneId, proc);
  let buf = '';
  proc.stdout.on('data', (d) => {
    buf += d.toString();
    const linhas = buf.split('\n');
    buf = linhas.pop();
    for (const l of linhas) {
      const t = l.trim(); if (!t) continue;
      let m; try { m = JSON.parse(t); } catch { continue; }
      emit(paneId, 'voz', m);
    }
  });
  // stderr do Swift so interessa quando o programa morre sem dizer nada
  let erro = '';
  proc.stderr.on('data', (d) => { erro = (erro + d.toString()).slice(-500); });
  proc.on('close', () => {
    if (vozAtiva.get(paneId) === proc) vozAtiva.delete(paneId);
    emit(paneId, 'voz', { type: 'status', msg: 'fim', erro: erro || undefined });
  });
  proc.on('error', (e) => emit(paneId, 'voz', { type: 'error', msg: String(e && e.message || e) }));
  return { ok: true };
});
handle('voz:parar', (_e, { paneId, cancelar }) => {
  const p = vozAtiva.get(paneId);
  if (!p) return { ok: false };
  // "stop" fecha bonito e ainda devolve o texto final; cancelar mata na hora e joga fora
  if (cancelar) vozMatar(paneId);
  else { try { p.stdin.write('stop\n'); } catch { vozMatar(paneId); } }
  return { ok: true };
});

let prontosParados = 0;
handle('aviso:pronto', (_e, { paneId, titulo, texto }) => {
  if (!win || win.isFocused()) return { ok: false };
  prontosParados++;
  if (app.dock) app.dock.setBadge(String(prontosParados));
  if (Notification.isSupported()) {
    const n = new Notification({
      title: titulo || 'Terminou',
      body: (texto || '').slice(0, 220),
      silent: false,
    });
    n.on('click', () => {
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show(); win.focus();
      win.webContents.send('menu', 'ir:' + paneId);
    });
    n.show();
  }
  return { ok: true };
});
function zerarBadge() {
  prontosParados = 0;
  if (app.dock) app.dock.setBadge('');
}

handle('clipboard:copiar', (_e, txt) => { clipboard.writeText(String(txt || '')); return { ok: true }; });

/* ---------- puxar a aba que ele está olhando no navegador ----------
   Ele manda link o dia todo copiando e colando. Isto pergunta ao navegador qual e a aba da
   frente. Se o Mac ainda nao deu permissao de automacao, o proprio erro explica o caminho. */
handle('navegador:aba', async () => {
  const roteiros = [
    ['Google Chrome', 'tell application "Google Chrome" to return (URL of active tab of front window) & "\\n" & (title of active tab of front window)'],
    ['Safari', 'tell application "Safari" to return (URL of front document) & "\\n" & (name of front document)'],
  ];
  for (const [nome, script] of roteiros) {
    const r = await rodar('/usr/bin/osascript', ['-e', script], 8000);
    const saida = String(r.out || '').trim();
    if (saida && /^https?:/i.test(saida)) {
      const [url, ...resto] = saida.split('\n');
      return { url, titulo: resto.join(' ').trim(), navegador: nome };
    }
    if (/not allowed|permitido|-1743/i.test(String(r.errout || ''))) {
      return { error: 'o Mac ainda não deixou o Cockpit falar com o ' + nome + '. Ajustes do Sistema › Privacidade › Automação › Cockpit' };
    }
  }
  return { error: 'não achei nenhuma aba aberta no Chrome nem no Safari' };
});

/* ---------- o que manda no comportamento do Claude ----------
   Só lê e mostra: memória (CLAUDE.md), agentes, hooks e permissões. Mexer nesses arquivos
   muda o comportamento de TODOS os projetos, então isso continua sendo decisão dele. */
handle('config:claude', () => {
  const casa = path.join(HOME, '.claude');
  const ler = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
  const lista = (d) => { try { return fs.readdirSync(d).filter(x => !x.startsWith('.')); } catch { return []; } };
  let ajustes = {};
  try { ajustes = JSON.parse(ler(path.join(casa, 'settings.json')) || '{}'); } catch {}
  const perm = ajustes.permissions || {};
  return {
    memoria: {
      global: { caminho: path.join(casa, 'CLAUDE.md'), tamanho: (ler(path.join(casa, 'CLAUDE.md')) || '').length },
      casa: { caminho: path.join(HOME, 'CLAUDE.md'), tamanho: (ler(path.join(HOME, 'CLAUDE.md')) || '').length },
    },
    agentes: lista(path.join(casa, 'agents')).map(x => x.replace(/\.md$/, '')),
    skills: lista(path.join(casa, 'skills')).length,
    hooks: Object.keys(ajustes.hooks || {}),
    permissoes: {
      liberado: (perm.allow || []).length,
      negado: (perm.deny || []).length,
      pergunta: (perm.ask || []).length,
      modo: ajustes.defaultMode || perm.defaultMode || 'padrão',
    },
    arquivoAjustes: path.join(casa, 'settings.json'),
  };
});
handle('shell:open', (_e, p) => shell.openPath(p));
handle('shell:link', (_e, url) => {
  if (/^https?:\/\//i.test(url)) return shell.openExternal(url);
  return shell.openPath(url);
});
handle('shell:openUrl', (_e, u) => {
  if (!/^https?:\/\//i.test(String(u || ''))) return { error: 'link inválido' };
  shell.openExternal(u); return { ok: true };
});

handle('pane:start', async (_e, { paneId, engine, cwd, model, approval, resumeId, effort, billing }) => {
  if (engine === 'claude') return claudeStart(paneId, { cwd, model, approval, resumeId, effort });
  const dest = destinoDoCwd(cwd);
  const porCreditos = billing === 'api';
  if (porCreditos) {
    if (dest !== 'local') throw new Error('O Astra por créditos funciona no Mac, não na VPS.');
    await validarUsoAstra();
  }
  codexPaneDest.set(paneId, dest);
  codexPaneBilling.set(paneId, porCreditos ? 'api' : 'plan');
  await codexStart(dest);
  if (resumeId) {
    const r = await codexReq(dest, 'thread/resume', { threadId: resumeId });
    const rid = (r && (r.threadId || (r.thread && r.thread.id))) || resumeId;
    codex.threadToPane.set(rid, paneId);
    codex.paneToThread.set(paneId, rid);
    emit(paneId, 'sessao', { id: rid, file: (r && r.thread && r.thread.path) || '' });
    return true;
  }
  const pol = CODEX_MODE[approval] || CODEX_MODE.bypass;
  const res = await codexReq(dest, 'thread/start', {
    cwd: (dest === 'local' ? (cwd || HOME) : partesRemoto(cwd).caminho),
    sandbox: pol.sandbox,
    approvalPolicy: pol.policy,
    developerInstructions: instrucoesCasa(),
    ...(model ? { model } : {}),
    ...(porCreditos ? { modelProvider: ASTRA_PROVIDER, serviceTier: 'default' } : {}),
  });
  const tid = res && (res.threadId || (res.thread && res.thread.id));
  if (!tid) throw new Error('Codex não devolveu a conversa');
  codex.threadToPane.set(tid, paneId);
  codex.paneToThread.set(paneId, tid);
  emit(paneId, 'sessao', { id: tid, file: (res.thread && res.thread.path) || '' });
  return true;
});

handle('pane:send', async (_e, { paneId, engine, text, effort }) => {
  if (engine === 'claude') {
    return escreverClaude(paneId, { type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } });
  }
  const tid = codex.paneToThread.get(paneId);
  if (!tid) return false;
  if (codexPaneBilling.get(paneId) === 'api') await validarUsoAstra();
  await codexReq(destinoDoPane(paneId), 'turn/start', { threadId: tid, input: [{ type: 'text', text }], ...(effort ? { effort } : {}) });
  return true;
});

handle('pane:compactar', async (_e, { paneId, engine }) => {
  if (engine === 'claude') {
    if (!escreverClaude(paneId, { type: 'user', message: { role: 'user', content: [{ type: 'text', text: '/compact' }] } })) return { error: 'sessão fora do ar' };
    return { ok: true };
  }
  const tid = codex.paneToThread.get(paneId);
  if (!tid) return { error: 'nenhuma conversa aberta' };
  try { await codexReq(destinoDoPane(paneId), 'thread/compact/start', { threadId: tid }); return { ok: true }; }
  catch (e) { return { error: String(e && e.message || e) }; }
});

handle('pane:steer', async (_e, { paneId, engine, text }) => {
  if (engine === 'claude') {
    // o CLI aceita uma fala nova no meio do turno pelo mesmo canal
    if (!escreverClaude(paneId, { type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } })) return { error: 'sessão fora do ar' };
    return { ok: true };
  }
  const tid = codex.paneToThread.get(paneId);
  const turno = codex.paneTurn.get(paneId);
  if (!tid || !turno) return { error: 'nenhum trabalho em andamento' };
  try {
    await codexReq(destinoDoPane(paneId), 'turn/steer', { threadId: tid, expectedTurnId: turno, input: [{ type: 'text', text }] });
    return { ok: true };
  } catch (e) { return { error: String(e && e.message || e) }; }
});

handle('pane:interrupt', async (_e, { paneId, engine }) => {
  if (engine === 'claude') {
    escreverClaude(paneId, { type: 'control_request', request_id: 'i' + Date.now(), request: { subtype: 'interrupt' } });
    return true;
  }
  const tid = codex.paneToThread.get(paneId);
  const turn = codex.paneTurn.get(paneId);
  if (tid && turn) { try { await codexReq(destinoDoPane(paneId), 'turn/interrupt', { threadId: tid, turnId: turn }); } catch {} }
  return true;
});

handle('pane:stop', async (_e, { paneId, engine }) => {
  if (engine === 'claude') claudeStop(paneId);
  else {
    const tid = codex.paneToThread.get(paneId);
    const turno = codex.paneTurn.get(paneId);
    // O codex app-server e um processo so, compartilhado por todos os chats. Fechar o chat
    // apenas esquecia o apontamento: o turno continuava vivo la dentro, rodando comando e
    // editando arquivo no Mac, sem aparecer em lugar nenhum e sem jeito de parar. Aqui a
    // gente manda parar de verdade — com limite de 1,5s pra nao travar quem fechou a aba.
    if (tid && turno) {
      try {
        await Promise.race([
          codexReq(destinoDoPane(paneId), 'turn/interrupt', { threadId: tid, turnId: turno }),
          new Promise(r => setTimeout(r, 1500)),
        ]);
      } catch {}
    }
    codex.paneTurn.delete(paneId);
    codexApiCortado.delete(paneId);
    if (tid) {
      codex.threadToPane.delete(tid);
      // So apaga o apontamento se ele ainda for para ESTA conversa. Durante a espera de 1,5s
      // do turn/interrupt o painel pode ter comecado uma conversa nova (arrastar o chat, trocar
      // a pasta) — apagar aqui mataria a nova. E a mesma guarda que o Claude ja tem no close.
      if (codex.paneToThread.get(paneId) === tid) codex.paneToThread.delete(paneId);
    }
    codexPaneDest.delete(paneId);
    codexPaneBilling.delete(paneId);
  }
  return true;
});

handle('pane:approve', (_e, { key, allow }) => {
  const a = pendingApprovals.get(key);
  if (!a) return false;
  pendingApprovals.delete(key);
  if (a.kind === 'claude') {
    escreverClaude(a.paneId, {
      type: 'control_response',
      response: { request_id: a.reqId, subtype: 'success',
        response: allow ? { behavior: 'allow', updatedInput: a.input } : { behavior: 'deny', message: 'Negado por você' } },
    });
    return true;
  }
  codexReply(a.destino || 'local', a.rpcId, { decision: allow ? 'acceptForSession' : 'reject' });
  return true;
});

handle('codex:models', async () => {
  try {
    await codexStart();
    const r = await codexReq('local', 'model/list', {});
    const arr = (r && (r.data || r.models || r)) || [];
    return arr.filter(m => !m.hidden).map(m => ({
      id: m.id || m.model,
      nome: m.displayName || m.id,
      desc: m.description || '',
      efforts: (m.supportedReasoningEfforts || []).map(e => ({ id: e.reasoningEffort, desc: e.description || '' })),
      padraoEffort: m.defaultReasoningEffort || 'medium',
      padrao: !!m.isDefault,
    }));
  } catch { return []; }
});

/* ======================= menu ======================= */
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'appMenu' },
    { label: 'Painel', submenu: [
      { label: 'Novo chat nesta aba', accelerator: 'CmdOrCtrl+T', click: () => win && win.webContents.send('menu', 'newPane') },
      { label: 'Nova aba de projeto…', accelerator: 'CmdOrCtrl+Shift+T', click: () => win && win.webContents.send('menu', 'newTab') },
      { label: 'Fechar chat', accelerator: 'CmdOrCtrl+W', click: () => win && win.webContents.send('menu', 'closePane') },
      { label: 'Reabrir o último chat fechado', accelerator: 'CmdOrCtrl+Shift+W', click: () => win && win.webContents.send('menu', 'reabrirFechado') },
      { type: 'separator' },
      { label: 'Trocar a pasta desta aba…', accelerator: 'CmdOrCtrl+O', click: () => win && win.webContents.send('menu', 'pickFolder') },
      { label: 'Limpar conversa', accelerator: 'CmdOrCtrl+K', click: () => win && win.webContents.send('menu', 'clearPane') },
      { type: 'separator' },
      { label: 'Buscar nesta conversa', accelerator: 'CmdOrCtrl+F', click: () => win && win.webContents.send('menu', 'buscarNaConversa') },
      { label: 'Perguntar aos dois motores', accelerator: 'CmdOrCtrl+D', click: () => win && win.webContents.send('menu', 'perguntarAosDois') },
      { label: 'Ditar (segure para falar)', accelerator: 'CmdOrCtrl+Shift+D', click: () => win && win.webContents.send('menu', 'ditar') },
      { label: 'Desenhar um fluxo (quadro branco)', accelerator: 'CmdOrCtrl+Shift+E', click: () => win && win.webContents.send('menu', 'quadro') },
      { type: 'separator' },
      { label: 'Salvar conversa no Obsidian', accelerator: 'CmdOrCtrl+S', click: () => win && win.webContents.send('menu', 'salvarVault') },
    ]},
    /* Menu Editar proprio, em portugues. Nao pode ser { role: 'editMenu' }: no macOS o menu do
       aplicativo fica com ⌘Z, ⌘⇧Z e ⌘A antes da pagina, e os papeis prontos so sabem desfazer
       dentro de um campo de texto — o quadro branco ficaria sem desfazer, que e o atalho mais
       usado de quem desenha. Aqui os tres avisam a tela, e o renderer decide o destino
       (quadro aberto -> pilha do quadro; senao -> o campo de texto em foco, como antes). */
    { label: 'Editar', submenu: [
      { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: () => win && win.webContents.send('menu', 'desfazer') },
      { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', click: () => win && win.webContents.send('menu', 'refazer') },
      { type: 'separator' },
      { role: 'cut', label: 'Recortar' },
      { role: 'copy', label: 'Copiar' },
      { role: 'paste', label: 'Colar' },
      { role: 'pasteAndMatchStyle', label: 'Colar sem formatacao' },
      { role: 'delete', label: 'Apagar' },
      { type: 'separator' },
      { label: 'Selecionar tudo', accelerator: 'CmdOrCtrl+A', click: () => win && win.webContents.send('menu', 'selecionarTudo') },
      // o papel pronto trazia o "Falar" do macOS junto; sem isto ele sumiria da barra
      { type: 'separator' },
      { label: 'Falar', submenu: [
        { role: 'startSpeaking', label: 'Começar a falar' },
        { role: 'stopSpeaking', label: 'Parar de falar' },
      ]},
    ]},
    { label: 'Ver', submenu: [
      { label: 'Mostrar/ocultar arquivos', accelerator: 'CmdOrCtrl+B', click: () => win && win.webContents.send('menu', 'toggleSidebar') },
      { label: 'Modo foco (só pergunta e resposta)', accelerator: 'CmdOrCtrl+Shift+F', click: () => win && win.webContents.send('menu', 'foco') },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Zoom normal' }, { role: 'zoomIn', label: 'Aumentar' }, { role: 'zoomOut', label: 'Diminuir' },
      { type: 'separator' },
      { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' }, { role: 'reload', label: 'Recarregar' },
    ]},
    { role: 'windowMenu', label: 'Janela' },
  ]));
}

/* ---------- Cockpit no telefone ---------- */
let web = null;
/* o macOS coloca o app para dormir quando fica sem foco, e ai o telefone
   conecta mas nunca recebe resposta. Enquanto o servidor estiver ligado,
   seguramos o app acordado. */
let travaSono = null, batimento = null;
function manterAcordado(ligar) {
  try {
    if (ligar) {
      if (travaSono === null || !powerSaveBlocker.isStarted(travaSono)) {
        travaSono = powerSaveBlocker.start('prevent-app-suspension');
      }
      // um tique de nada, so para o app nunca ficar totalmente parado:
      // parado, ele demora a perceber que o telefone chamou.
      if (!batimento) batimento = setInterval(() => {}, 1000);
    } else {
      if (travaSono !== null && powerSaveBlocker.isStarted(travaSono)) {
        powerSaveBlocker.stop(travaSono);
      }
      travaSono = null;
      if (batimento) { clearInterval(batimento); batimento = null; }
    }
  } catch (e) { anota('sono:', e); }
}
function senhaDoTelefone() {
  const cfg = loadConfig();
  if (!cfg.senhaWeb || !/^([a-f0-9]{4}-){3}[a-f0-9]{4}$/i.test(cfg.senhaWeb)) {
    cfg.senhaWeb = crypto.randomBytes(8).toString('hex').match(/.{1,4}/g).join('-');
    anotarChaveDoMain('senhaWeb', cfg.senhaWeb);
    saveConfig(cfg);
  }
  return cfg.senhaWeb;
}
function enderecoTailscale() {
  try {
    const { execFileSync } = require('child_process');
    const bin = acharBin('tailscale');
    const socket = path.join(HOME, '.tailscale', 'tailscaled.sock');
    const args = fs.existsSync(socket) ? ['--socket=' + socket, 'status', '--json'] : ['status', '--json'];
    const st = JSON.parse(execFileSync(bin, args, { encoding: 'utf8', timeout: 5000 }));
    const dns = st && st.Self && String(st.Self.DNSName || '').replace(/\.$/, '');
    if (dns) return 'http://' + dns + ':7788';
    const ip = st && st.TailscaleIPs && st.TailscaleIPs[0];
    if (ip) return 'http://' + ip + ':7788';
  } catch (e) { anota('tailscale:', e.message); }
  return '';
}
handle('web:estado', () => ({
  ligado: !!web,
  endereco: web ? web.endereco : '',
  senha: senhaDoTelefone(),
}));
handle('web:ligar', async (_e, ligar) => {
  const cfg = loadConfig();
  if (ligar && !web) {
    try {
      const sw = require('./servidor-web.js');
      web = sw.criar({
        pastaRenderer: path.join(__dirname, 'renderer'),
        handlers: HANDLERS, ouvintes: ouvintesWeb,
        porta: 7788, senha: senhaDoTelefone(), somenteTailscale: true, endereco: enderecoTailscale(),
      });
      // espera o servidor ESCUTAR de verdade antes de dizer que ligou: com a porta ocupada
      // a tela mostrava endereco e senha e o telefone nunca conectava
      if (web && web.pronto) await web.pronto;
      manterAcordado(true);
      cfg.webLigado = true; cfg.webSeguroConfirmado = true;
      anotarChaveDoMain('webLigado', true); anotarChaveDoMain('webSeguroConfirmado', true);
      saveConfig(cfg);
    } catch (e) { anota('web:', e); return { error: e.message }; }
  } else if (!ligar && web) {
    // fechar() derruba tambem os telefones ja conectados; o close() sozinho so impedia
    // conexao nova e quem estava dentro seguia com poder total sobre o Mac
    try { (web.fechar || web.servidor.close.bind(web.servidor))(); } catch {}
    web = null; manterAcordado(false); cfg.webLigado = false;
    anotarChaveDoMain('webLigado', false);
    saveConfig(cfg);
  }
  return { ligado: !!web, endereco: web ? web.endereco : '', senha: senhaDoTelefone() };
});

app.whenReady().then(() => { anota('app iniciou'); usarClaudeDeCaminhoFixo(); menu(); createWindow(); montarIndiceDeFundo();
  try {
    const cfgInicial = loadConfig();
    // Quem já usava o iPhone não precisa caçar um novo botão após atualizar.
    // A migração só liga o servidor porque esta versão já obriga Tailscale.
    if (cfgInicial.webLigado && !Object.prototype.hasOwnProperty.call(cfgInicial, 'webSeguroConfirmado')) {
      cfgInicial.webSeguroConfirmado = true;
      saveConfig(cfgInicial);
    }
    if (cfgInicial.webLigado && cfgInicial.webSeguroConfirmado) {
      const sw = require('./servidor-web.js');
      web = sw.criar({ pastaRenderer: path.join(__dirname, 'renderer'), handlers: HANDLERS,
        ouvintes: ouvintesWeb, porta: 7788, senha: senhaDoTelefone(), somenteTailscale: true, endereco: enderecoTailscale() });
      manterAcordado(true);
      // no boot nao da pra esperar; mas o erro tem de aparecer no log e o estado tem de ficar
      // honesto, senao o app acha que o telefone esta ligado e ele nunca conecta
      if (web && web.pronto) web.pronto
        .then(() => anota('telefone ligado em', web.endereco))
        .catch((e) => { anota('NAO consegui abrir para o telefone:', (e && e.message) || e); web = null; manterAcordado(false); });
      else anota('telefone ligado em', web.endereco);
    }
  } catch (e) { anota('NAO ABRIU para o telefone:', e); } setTimeout(() => codexStart().catch(() => {}), 1500); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { shutdown(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { shutdown(); if (web) { try { (web.fechar || web.servidor.close.bind(web.servidor))(); } catch {} } });
