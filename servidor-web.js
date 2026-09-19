/* A mesma interface e os mesmos históricos do Mac, pelo Tailscale.
   No modo protegido, só escuta no próprio Mac: o Tailscale entrega a conexão ali. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const cacheArq = new Map();
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.ico': 'image/x-icon' };

/* O que o telefone PODE pedir ao Mac. E a mesma lista que o renderer/web.js usa, ou seja,
   tudo que a tela do celular realmente faz — e nada alem disso. Antes valia qualquer nome de
   comando do app: quem descobrisse a senha nao via so as conversas, rodava o que quisesse aqui.
   Ficaram de fora de proposito os que abrem um terminal de verdade no Mac (term:run, term:input,
   term:resize, term:kill) e o shell:open, que manda o Finder abrir um caminho — e abrir um .app
   e rodar programa. Pelo celular esses cinco agora respondem "so funciona no Mac".
   Mexeu no renderer/web.js? Ponha o nome novo aqui tambem, senao o telefone nao alcanca. */
const PERMITIDOS = new Set([
  'config:get', 'sys:home', 'fs:list', 'fs:read', 'fs:buscarArquivos',
  'pane:start', 'pane:send', 'pane:respond', 'pane:settings', 'pane:steer',
  'pane:compactar', 'pane:interrupt', 'pane:stop', 'pane:approve',
  'codex:models', 'codex:api-status', 'codex:apps',
  'sessions:claude', 'sessions:codex', 'sessions:cli', 'sessions:acp', 'sessions:history',
  'sessions:titulo', 'sessions:buscar', 'sessions:claudeRemoto', 'sessions:historyRemoto',
  'sessao:renomear', 'sessao:nomeCurto', 'sessao:fork',
  'acp:config', 'skills:list', 'prompts:ler', 'prompts:salvar',
  'anexo:ler', 'imagem:salvar', 'ocr:ler',
  'quadro:salvar', 'quadro:rascunhoGravar', 'quadro:rascunhoLer',
  'arquivo:ver', 'arquivo:verVps', 'term:linhaShell',
  'conta:ler', 'uso:ler', 'agentes:claude', 'git:status', 'git:diff',
  'motores:versoes', 'motores:disponiveis', 'rotinas:listar',
  'mcp:list', 'mcp:acao', 'auth:acao',
]);

/* A sessao era procurada solta no meio do texto dos cookies: 'ck=' casa dentro de
   'track=abc123', e o servidor lia o valor errado — o telefone ficava pedindo senha mesmo ja
   logado. Agora o nome do cookie tem de comecar de verdade (no inicio ou logo depois do ';')
   e o valor tem o tamanho certo do nosso token. */
const pegarSessao = (cabecalho) =>
  (String(cabecalho || '').match(/(?:^|;\s*)ck=([a-f0-9]{64})(?:;|$)/) || [])[1];

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
  // O Tailscale em userspace (Homebrew no Mac) e o Serve entregam a conexão
  // por loopback. Exigir IP 100.x aqui barrava inclusive o iPhone autorizado.
  // Aceitar loopback SÓ é seguro junto do listen em 127.0.0.1 abaixo: a LAN
  // continua sem conseguir chegar ao servidor. Não confiar em headers de proxy.
  const redePermitida = (req) => !somenteTailscale || ipTailscale(ip(req))
    || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip(req));
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
  // Le o corpo do POST da tela de senha. Teto pequeno de proposito: aqui so passa "s=<senha>",
  // e assim ninguem enche a memoria do Mac mandando um corpo gigante.
  const lerCorpo = (req, pronto) => {
    let txt = '';
    req.on('data', (p) => { if (txt.length <= 4096) txt += p; });
    req.on('end', () => pronto(new URLSearchParams(txt.length > 4096 ? '' : txt)));
  };
  const paginaLogin = (res, status, errou, detalhe = '') => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(paginaSenha(errou, detalhe));
  };

  const servidor = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!redePermitida(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end('Abra pelo Tailscale para proteger seu Mac.');
    }
    // entrada com senha
    if (url.pathname === '/entrar') {
      // A senha vinha DENTRO do endereco (/entrar?s=...): ficava no historico do Safari, na
      // sugestao da barra do iPhone, no backup do iCloud e em qualquer log de rede do caminho.
      // Agora ela vem no corpo do POST. Endereco velho com a senha colada nao entra mais:
      // e ignorado e so devolve para a porta de entrada.
      if (req.method !== 'POST') {
        res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' });
        return res.end();
      }
      const endereco = ip(req);
      const jaDentro = sessaoValida(pegarSessao(req.headers.cookie));
      return lerCorpo(req, (campos) => {
        // A senha certa entra SEMPRE. Antes a trava de 5 erros era conferida ANTES dela: como
        // o Tailscale entrega todo mundo como 127.0.0.1, cinco erros de qualquer um (ou de uma
        // pagina aberta no navegador do Mac) deixavam o dono 15 minutos de fora do proprio Mac.
        if (igual(campos.get('s'), senha)) {
          const t = crypto.randomBytes(32).toString('hex');
          sessoes.set(t, Date.now() + VIDA_SESSAO);
          tentativas.delete(endereco);
          res.writeHead(302, { 'Set-Cookie': 'ck=' + t + '; Path=/; Max-Age=28800; HttpOnly; SameSite=Strict', Location: '/' });
          return res.end();
        }
        // agora a trava so pega quem erra a senha, e nem isso para quem ja tem sessao valida
        if (!jaDentro && !podeTentar(endereco)) {
          return paginaLogin(res, 429, true, 'Muitas senhas erradas. Espere 15 minutos, ou entre com a senha certa.');
        }
        falhou(endereco);
        paginaLogin(res, 401, true);
      });
    }
    // o telefone busca estes sem cookie; sao inofensivos
    if (['/manifest.json', '/icone-180.png', '/icone-512.png', '/favicon.ico'].includes(url.pathname)) {
      const pub = path.join(pastaRenderer, url.pathname.replace(/^\//, ''));
      if (url.pathname === '/favicon.ico' || !fs.existsSync(pub)) { res.writeHead(204); return res.end(); }
      return mandarArquivo(res, pub);
    }
    const t = pegarSessao(req.headers.cookie);
    if (!t || !sessaoValida(t)) return paginaLogin(res, 200, false);

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
    if (!redePermitida(req)) { ws.close(1008, 'fora do Tailscale'); return; }
    if (origin && origin !== esperado) { ws.close(1008, 'origem invalida'); return; }
    const t = pegarSessao(req.headers.cookie);
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
      // So passa o que esta na lista PERMITIDOS la de cima. O resto nem chega no comando.
      if (!PERMITIDOS.has(m.nome)) {
        aoLog && aoLog('telefone pediu comando fora da lista: ' + m.nome);
        // mesma resposta que o renderer/web.js ja da nos comandos so do Mac: a tela avisa na
        // hora, em vez de o toque ficar dois minutos esperando uma resposta que nao vem
        try { ws.send(JSON.stringify({ tipo: 'resposta', id: m.id, resposta: { error: 'Este comando só funciona no Mac.' }, erro: null })); } catch {}
        return;
      }
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
  servidor.listen(porta, somenteTailscale ? '127.0.0.1' : '0.0.0.0');

  // Desligar o acesso so parava de aceitar telefone NOVO: quem ja estava dentro continuava
  // com poder total sobre o Mac. Este fechar() derruba tambem as conexoes abertas.
  const fechar = () => {
    clearInterval(varredura);
    for (const ws of [...ouvintes]) { try { ws.close(1001, 'acesso desligado'); } catch {} }
    ouvintes.clear();
    try { wss.close(); } catch {}
    try { servidor.close(); } catch {}
  };

  return { servidor, fechar, pronto, endereco: endereco || (somenteTailscale ? '' : ('http://' + ipDaRede() + ':' + porta)) };
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
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Cockpit">
<meta name="theme-color" content="#1e1e1e" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<link rel="manifest" href="/manifest.json"><link rel="apple-touch-icon" href="/icone-180.png">
<title>Cockpit</title><style>
/* As cores eram cravadas no escuro: quem usa o tema Claro tomava uma tela preta na cara e o
   app saltava para o branco logo depois. Agora a porta de entrada segue o aparelho, com a
   mesma paleta clara do app (style.css). */
:root{--fundo:#1e1e1e;--texto:#ccc;--tit:#e8e8e8;--fraco:#8b8b8b;--campo:#252526;
--borda:#474747;--laranja:#d97757;--erro:#e05252;--ajuda:#aaa}
@media (prefers-color-scheme: light){
:root{--fundo:#ffffff;--texto:#3b3b40;--tit:#1c1c20;--fraco:#71717a;--campo:#f5f5f6;
--borda:#c8c8cb;--laranja:#c2521f;--erro:#c62828;--ajuda:#5f5f68}
}
body{margin:0;height:100dvh;display:grid;place-items:center;background:var(--fundo);color:var(--texto);
font:15px -apple-system,system-ui,sans-serif}
form{width:min(320px,86%);text-align:center}
h1{font-size:19px;color:var(--tit);margin:0 0 6px}p{color:var(--fraco);font-size:13px;margin:0 0 18px}
input{box-sizing:border-box;width:100%;padding:13px;border-radius:11px;border:1px solid var(--borda);background:var(--campo);
color:var(--texto);font-size:16px;outline:none;text-align:center}
input:focus{border-color:var(--laranja)}
button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:11px;background:var(--laranja);
color:#fff;font-size:15px;font-weight:600}
.erro{color:var(--erro);font-size:12.5px;margin-top:10px}
details{margin-top:28px;color:var(--ajuda);font-size:13px;line-height:1.6}summary{cursor:pointer}details p{margin-top:10px}
</style></head><body><form action="/entrar" method="post">
<h1>Cockpit</h1><p>Digite a senha que aparece no Mac</p>
<input name="s" type="password" autocomplete="current-password" aria-label="Senha do Cockpit" placeholder="senha mostrada no Mac" required>
<button>Entrar</button>${errou ? '<div class="erro">' + (detalhe || 'Senha errada') + '</div>' : ''}
<details><summary>Instalar no iPhone</summary><p>No Safari, toque em Compartilhar e em Adicionar à Tela de Início. Ative Abrir como App da Web e toque em Adicionar.</p><p>As conversas ficam no Mac. Mantenha o Mac ligado e o Tailscale conectado.</p></details>
</form></body></html>`;
}

module.exports = { criar, ipDaRede };
