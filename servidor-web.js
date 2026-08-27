/* Serve a mesma interface do Cockpit pelo Wi-Fi, para abrir no iPhone.
   Só a sua rede enxerga, e ainda assim pede uma senha. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const cacheArq = new Map();
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.ico': 'image/x-icon' };

function ipDaRede() {
  for (const lista of Object.values(os.networkInterfaces())) {
    for (const i of lista || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return '127.0.0.1';
}

function criar({ pastaRenderer, handlers, ouvintes, porta, senha, aoLog, somenteTailscale = false, endereco = '' }) {
  const { WebSocketServer } = require('ws');
  const sessoes = new Map();
  const tentativas = new Map();
  const VIDA_SESSAO = 8 * 60 * 60 * 1000;
  const JANELA_TENTATIVAS = 15 * 60 * 1000;
  const MAX_TENTATIVAS = 5;
  const ip = (req) => String(req.socket && req.socket.remoteAddress || 'desconhecido');
  const ipTailscale = (enderecoIp) => {
    const v = String(enderecoIp || '').replace(/^::ffff:/, '');
    const p = v.split('.').map(Number);
    return p.length === 4 && p[0] === 100 && p[1] >= 64 && p[1] <= 127;
  };
  const igual = (a, b) => {
    const x = Buffer.from(String(a || ''));
    const y = Buffer.from(String(b || ''));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  const sessaoValida = (token) => {
    const ate = sessoes.get(token);
    if (!ate || ate < Date.now()) { sessoes.delete(token); return false; }
    return true;
  };
  const podeTentar = (endereco) => {
    const item = tentativas.get(endereco);
    if (!item || item.inicio + JANELA_TENTATIVAS < Date.now()) return true;
    return item.total < MAX_TENTATIVAS;
  };
  const falhou = (endereco) => {
    const anterior = tentativas.get(endereco);
    const item = (!anterior || anterior.inicio + JANELA_TENTATIVAS < Date.now())
      ? { inicio: Date.now(), total: 0 } : anterior;
    item.total += 1; tentativas.set(endereco, item);
  };

  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (somenteTailscale && !ipTailscale(ip(req))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('Abra pelo Tailscale para proteger seu Mac.');
    }
    // entrada com senha
    if (url.pathname === '/entrar') {
      const endereco = ip(req);
      if (!podeTentar(endereco)) {
        res.writeHead(429, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(paginaSenha(true, 'Muitas tentativas. Espere 15 minutos.'));
      }
      if (igual(url.searchParams.get('s'), senha)) {
        const t = crypto.randomBytes(32).toString('hex');
        sessoes.set(t, Date.now() + VIDA_SESSAO);
        tentativas.delete(endereco);
        res.writeHead(302, { 'Set-Cookie': 'ck=' + t + '; Path=/; Max-Age=28800; HttpOnly; SameSite=Strict', Location: '/' });
        return res.end();
      }
      falhou(endereco);
      res.writeHead(401, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(paginaSenha(true));
    }
    // o telefone busca estes sem cookie; sao inofensivos
    if (['/manifest.json', '/icone-180.png', '/icone-512.png', '/favicon.ico'].includes(url.pathname)) {
      const pub = path.join(pastaRenderer, url.pathname.replace(/^\//, ''));
      if (url.pathname === '/favicon.ico' || !fs.existsSync(pub)) { res.writeHead(204); return res.end(); }
      return mandarArquivo(res, pub);
    }
    const cookie = String(req.headers.cookie || '');
    const t = (cookie.match(/ck=([a-f0-9]+)/) || [])[1];
    if (!t || !sessaoValida(t)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(paginaSenha(false));
    }

    let arq = url.pathname === '/' ? '/index-web.html' : url.pathname;
    const alvo = path.join(pastaRenderer, path.normalize(arq).replace(/^(\.\.[/\\])+/, ''));
    if (!alvo.startsWith(pastaRenderer) || !fs.existsSync(alvo)) { res.writeHead(404); return res.end('nao achei'); }
    mandarArquivo(res, alvo);
  });

  // 256 KB era pouco: o config do Mac tem mais de 2 MB (a foto de perfil em base64 sozinha
  // passa de 2 MB) e a conexao do telefone caia toda vez que uma mensagem grande passava.
  const wss = new WebSocketServer({ server: servidor, path: '/ws', maxPayload: 8 * 1024 * 1024 });
  wss.on('connection', (ws, req) => {
    const origin = String(req.headers.origin || '');
    const esperado = 'http://' + String(req.headers.host || '');
    // Navegadores sempre informam a origem. Sem esta checagem, uma página aberta
    // no celular poderia tentar falar com o Cockpit usando a sessão já existente.
    if (somenteTailscale && !ipTailscale(ip(req))) { ws.close(1008, 'fora do Tailscale'); return; }
    if (origin && origin !== esperado) { ws.close(1008, 'origem invalida'); return; }
    const cookie = String(req.headers.cookie || '');
    const t = (cookie.match(/ck=([a-f0-9]+)/) || [])[1];
    if (!t || !sessaoValida(t)) { ws.close(1008, 'sem sessao'); return; }
    ws.ck = t;                       // guarda a sessao deste telefone para reconferir depois
    ouvintes.add(ws);
    aoLog && aoLog('telefone conectado');
    ws.on('close', () => { ouvintes.delete(ws); aoLog && aoLog('telefone saiu'); });
    ws.on('message', async (bruto) => {
      // A sessao era conferida uma unica vez, no aperto de mao. Quem ja estava conectado
      // nunca mais era checado: podia rodar comando no Mac para sempre, mesmo depois das
      // 8 horas de validade e mesmo depois de desligar o acesso pelo Wi-Fi nos Ajustes.
      if (!sessaoValida(ws.ck)) { try { ws.close(1008, 'sessao expirou'); } catch {} return; }
      let m; try { m = JSON.parse(bruto.toString()); } catch { return; }
      if (m.tipo !== 'chamada' || typeof m.nome !== 'string') return;
      const fn = handlers[m.nome];
      let resposta = null, erro = null;
      try { resposta = fn ? await fn({ remoto: true, ip: ip(req) }, m.arg) : null; if (!fn) erro = 'comando desconhecido: ' + m.nome; }
      catch (e) { erro = String(e && e.message || e); }
      try { ws.send(JSON.stringify({ tipo: 'resposta', id: m.id, resposta, erro })); } catch {}
    });
  });

  // varre de minuto em minuto e fecha quem ja venceu, em vez de esperar o telefone
  // mandar alguma coisa para so entao descobrir que a sessao caiu
  const varredura = setInterval(() => {
    for (const ws of [...ouvintes]) {
      if (!sessaoValida(ws.ck)) { try { ws.close(1008, 'sessao expirou'); } catch {} ouvintes.delete(ws); }
    }
  }, 60000);
  if (varredura.unref) varredura.unref();
  servidor.on('close', () => clearInterval(varredura));

  // O listen() e assincrono e nao havia ninguem ouvindo o erro dele. Com a porta 7788 ocupada,
  // criar() voltava dizendo "ligado", a tela mostrava endereco e senha, e o telefone nunca
  // conectava. Agora quem chama espera o "listening" de verdade e o erro vira frase em portugues.
  // A ordem importa: o on('error') generico vem ANTES do once, porque o close() de um servidor
  // que nunca escutou re-emite erro.
  servidor.on('error', (e) => { aoLog && aoLog('erro do servidor do telefone: ' + ((e && e.message) || e)); });
  // o ws se pendura no mesmo servidor e REPASSA o erro para si: sem ouvinte aqui, um
  // "porta ocupada" virava excecao nao tratada e derrubava o processo
  wss.on('error', (e) => { aoLog && aoLog('erro do canal do telefone: ' + ((e && e.message) || e)); });
  const pronto = new Promise((ok, deuErro) => {
    servidor.once('listening', ok);
    const caiu = (e) => {
      try { clearInterval(varredura); } catch {}
      try { wss.close(); } catch {}
      try { servidor.close(); } catch {}
      deuErro(new Error(e && e.code === 'EADDRINUSE'
        ? 'a porta ' + porta + ' ja esta sendo usada por outro programa'
        : ((e && e.message) || String(e))));
    };
    servidor.once('error', caiu);
    wss.once('error', caiu);
  });
  servidor.listen(porta, '0.0.0.0');

  // Desligar o acesso so parava de aceitar telefone NOVO: quem ja estava dentro continuava
  // com poder total sobre o Mac. Este fechar() derruba tambem as conexoes abertas.
  const fechar = () => {
    clearInterval(varredura);
    for (const ws of [...ouvintes]) { try { ws.close(1001, 'acesso desligado'); } catch {} }
    ouvintes.clear();
    try { wss.close(); } catch {}
    try { servidor.close(); } catch {}
  };

  return { servidor, fechar, pronto, endereco: endereco || ('http://' + ipDaRede() + ':' + porta) };
}

function mandarArquivo(res, arq) {
  // guarda em memoria, mas solta a copia velha assim que o arquivo muda,
  // senao o telefone fica vendo a tela antiga depois de atualizar o app
  let st; try { st = fs.statSync(arq); } catch { res.writeHead(404); return res.end('nao achei'); }
  const selo = st.mtimeMs + ':' + st.size;
  let item = cacheArq.get(arq);
  if (!item || item.selo !== selo) {
    try { item = { selo, dados: fs.readFileSync(arq) }; cacheArq.set(arq, item); }
    catch { res.writeHead(404); return res.end('nao achei'); }
  }
  res.writeHead(200, {
    'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream',
    'Content-Length': item.dados.length,
    'Cache-Control': 'no-store, must-revalidate',
  });
  res.end(item.dados);
}

function paginaSenha(errou, detalhe = '') {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Cockpit</title><style>
body{margin:0;height:100dvh;display:grid;place-items:center;background:#1e1e1e;color:#ccc;
font:15px -apple-system,system-ui,sans-serif}
form{width:min(320px,86%);text-align:center}
h1{font-size:19px;color:#e8e8e8;margin:0 0 6px}p{color:#8b8b8b;font-size:13px;margin:0 0 18px}
input{width:100%;padding:13px;border-radius:11px;border:1px solid #474747;background:#252526;
color:#ccc;font-size:16px;outline:none;text-align:center}
input:focus{border-color:#d97757}
button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:11px;background:#d97757;
color:#fff;font-size:15px;font-weight:600}
.erro{color:#e05252;font-size:12.5px;margin-top:10px}
</style></head><body><form action="/entrar">
<h1>Cockpit</h1><p>Digite a senha que aparece no Mac</p>
<input name="s" type="password" autofocus placeholder="senha mostrada no Mac">
<button>Entrar</button>${errou ? '<div class="erro">' + (detalhe || 'Senha errada') + '</div>' : ''}
</form></body></html>`;
}

module.exports = { criar, ipDaRede };
