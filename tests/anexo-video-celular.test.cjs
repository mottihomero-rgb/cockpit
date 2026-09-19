'use strict';
/* No video de 19/09 o dono tentou mandar um video do iPhone e NADA foi anexado (quadros q101
   a q107). Eram tres defeitos no renderer/web.js, e este teste roda o codigo de verdade, num
   DOM de mentira, para provar que os tres morreram:
     1. o seletor so mostrava foto (accept 'image/*' esconde os videos na Fototeca);
     2. o menu do iPhone abria no canto de cima, porque o input nascia colado no <body>;
     3. o app desistia 800ms depois do 'focus' da janela — e o 'focus' chega quando o TECLADO
        fecha, antes de a Fototeca abrir. Ele ficou 3 segundos escolhendo e perdeu o arquivo.
   Ler o arquivo com regex nao provaria nada: o que decide e o que acontece quando os eventos
   chegam fora de ordem. Por isso aqui o web.js e executado. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fonte = fs.readFileSync(path.resolve(__dirname, '../renderer/web.js'), 'utf8');
const respirar = () => new Promise((r) => setImmediate(r));

/* Um DOM de mentira, so com o que o web.js usa. O relogio tambem e de mentira: assim da para
   pular 3 segundos sem o teste demorar 3 segundos. */
function montarMundo(opcoes = {}) {
  const criados = [];
  const alertas = [];
  const anexados = [];
  const pedidosFetch = [];

  function novoEl(tag) {
    return {
      tagName: tag, style: { cssText: '' }, filhos: [], pai: null, cliques: 0, _ouv: {},
      addEventListener(n, f) { (this._ouv[n] = this._ouv[n] || []).push(f); },
      removeEventListener(n, f) { this._ouv[n] = (this._ouv[n] || []).filter((x) => x !== f); },
      disparar(n) { (this._ouv[n] || []).slice().forEach((f) => f({ target: this })); },
      appendChild(c) { c.pai = this; this.filhos.push(c); return c; },
      remove() { if (this.pai) this.pai.filhos = this.pai.filhos.filter((x) => x !== this); this.pai = null; },
      querySelector() { return null; },
      click() { this.cliques += 1; },
    };
  }

  const corpo = novoEl('body');
  const caixaDeEscrever = novoEl('div');        // a .pane-cmp do painel em foco
  caixaDeEscrever.classe = 'pane-cmp';

  // relogio de mentira
  let agora = 0;
  const marcados = [];
  const setTimeoutFalso = (f, ms) => { marcados.push({ f, quando: agora + (ms || 0), vivo: true }); return marcados.length - 1; };
  const clearTimeoutFalso = (id) => { if (marcados[id]) marcados[id].vivo = false; };
  const correr = (ms) => {
    agora += ms;
    for (const m of marcados) if (m.vivo && m.quando <= agora) { m.vivo = false; m.f(); }
  };

  const ouvDoc = {};
  const doc = {
    hidden: false,
    body: corpo,
    createElement(tag) { const e = novoEl(tag); criados.push(e); return e; },
    querySelector(sel) { return /pane-cmp/.test(sel) ? caixaDeEscrever : null; },
    addEventListener(n, f) { (ouvDoc[n] = ouvDoc[n] || []).push(f); },
    removeEventListener(n, f) { ouvDoc[n] = (ouvDoc[n] || []).filter((x) => x !== f); },
    disparar(n) { (ouvDoc[n] || []).slice().forEach((f) => f({})); },
  };

  const painel = { id: 'p1', anexos: [], el: { querySelector: () => caixaDeEscrever } };

  const ctx = {
    console,
    location: { protocol: 'http:', host: 'mac.local', origin: 'http://mac.local' },
    document: doc,
    focusPane: painel,
    setTimeout: setTimeoutFalso,
    clearTimeout: clearTimeoutFalso,
    alert: (t) => alertas.push(String(t)),
    CustomEvent: class { constructor(n, o) { this.type = n; Object.assign(this, o); } },
    WebSocket: class { constructor() { this.readyState = 0; } send() {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    FileReader: class {
      readAsDataURL() { setTimeoutFalso(() => this.onload && this.onload(), 0); }
      get result() { return 'data:image/png;base64,AAA'; }
    },
    fetch: async (endereco, conf) => {
      pedidosFetch.push({ endereco, conf });
      return opcoes.resposta ? opcoes.resposta(endereco, conf) : { status: 200, ok: true, json: async () => ({ arquivo: '/Users/h/colados/anexo.mov' }) };
    },
    anexar: async (P, caminhos) => { anexados.push({ P, caminhos }); },
  };
  ctx.window = ctx;
  ctx.addEventListener = (n, f) => { (ouvDoc['win:' + n] = ouvDoc['win:' + n] || []).push(f); };
  ctx.removeEventListener = (n, f) => { ouvDoc['win:' + n] = (ouvDoc['win:' + n] || []).filter((x) => x !== f); };
  ctx.dispatchEvent = () => true;
  ctx.dispararNaJanela = (n) => (ouvDoc['win:' + n] || []).slice().forEach((f) => f({}));

  vm.createContext(ctx);
  vm.runInContext(fonte, ctx);
  return { ctx, doc, corpo, caixaDeEscrever, criados, alertas, anexados, pedidosFetch, correr, painel };
}

// o input que a funcao acabou de criar
const oInput = (m) => m.criados.filter((e) => e.tagName === 'input').pop();
/* A lista nasce dentro do vm (outro mundo) e o assert strict reclama do prototipo dela.
   Copiar para uma lista daqui deixa a comparacao ser sobre o conteudo, que e o que importa. */
const lista = (v) => (v == null ? v : Array.from(v));
const arquivoFalso = (extra = {}) => Object.assign({ name: 'video.mov', type: 'video/quicktime', size: 100 * 1024 * 1024 }, extra);

test('o seletor aceita video, nao so foto', () => {
  const m = montarMundo();
  m.ctx.window.api.pickFiles('image');
  assert.match(oInput(m).accept, /video\/\*/, "sem video/* a Fototeca do iPhone esconde os videos");
});

test('o input nasce dentro da caixa de escrever, nao colado no body', () => {
  const m = montarMundo();
  m.ctx.window.api.pickFiles('image');
  const inp = oInput(m);
  assert.equal(inp.pai, m.caixaDeEscrever, 'no body o iPhone ancora o menu no canto de cima');
  assert.doesNotMatch(inp.style.cssText, /display:\s*none/, 'display:none e o que joga o menu pro canto');
  assert.match(inp.style.cssText, /position:absolute/);
  assert.equal(inp.cliques, 1, 'a janela de arquivo tem de abrir sozinha');
});

test('o "focus" da janela NAO desiste mais (era o que matava o anexo)', async () => {
  const m = montarMundo();
  let terminou = false;
  m.ctx.window.api.pickFiles('image').then(() => { terminou = true; });
  m.ctx.dispararNaJanela('focus');     // o teclado fechou; a Fototeca nem abriu ainda
  m.correr(5000);
  await respirar();
  assert.equal(terminou, false, 'ele ainda esta escolhendo a foto: o app nao pode desistir');
});

test('so desiste depois que a pagina volta a aparecer', async () => {
  const m = montarMundo();
  let resposta = null;
  m.ctx.window.api.pickFiles('image').then((v) => { resposta = v; });

  m.doc.hidden = true; m.doc.disparar('visibilitychange');   // a Fototeca abriu
  m.correr(10000); await respirar();
  assert.equal(resposta, null, 'com a galeria aberta o app espera o tempo que precisar');

  m.doc.hidden = false; m.doc.disparar('visibilitychange');  // ele voltou sem escolher nada
  m.correr(2600); await respirar();
  assert.deepEqual(lista(resposta), [], 'voltou de maos vazias: a promessa tem de terminar');
});

test('escolha que chega atrasada ainda vira anexo', async () => {
  const m = montarMundo();
  let resposta = null;
  m.ctx.window.api.pickFiles('image').then((v) => { resposta = v; });
  const inp = oInput(m);

  m.doc.hidden = true; m.doc.disparar('visibilitychange');
  m.doc.hidden = false; m.doc.disparar('visibilitychange');
  m.correr(2600); await respirar();
  assert.deepEqual(lista(resposta), [], 'o app ja desistiu');

  inp.files = [arquivoFalso()];        // o iPhone entrega a escolha DEPOIS
  inp.disparar('change');
  for (let i = 0; i < 12; i++) { m.correr(1); await respirar(); }
  assert.equal(m.anexados.length, 1, 'o arquivo nao pode se perder so porque chegou tarde');
  assert.equal(m.anexados[0].P, m.painel, 'anexa no painel que estava em foco no toque do +');
  assert.deepEqual(lista(m.anexados[0].caminhos), ['/Users/h/colados/anexo.mov']);
});

test('no caminho normal a resposta ja vem com o arquivo', async () => {
  const m = montarMundo();
  let resposta = null;
  m.ctx.window.api.pickFiles('image').then((v) => { resposta = v; });
  const inp = oInput(m);
  inp.files = [arquivoFalso()];
  inp.disparar('change');
  for (let i = 0; i < 12; i++) { m.correr(1); await respirar(); }
  assert.deepEqual(lista(resposta), ['/Users/h/colados/anexo.mov']);
  assert.equal(m.anexados.length, 0, 'quem anexa aqui e o app.js: nao pode anexar duas vezes');
});

test('o video sobe inteiro pelo POST /upload, sem virar texto', async () => {
  const m = montarMundo();
  m.ctx.window.api.pickFiles('image');
  const inp = oInput(m);
  const f = arquivoFalso();
  inp.files = [f];
  inp.disparar('change');
  for (let i = 0; i < 12; i++) { m.correr(1); await respirar(); }
  assert.equal(m.pedidosFetch.length, 1);
  const p = m.pedidosFetch[0];
  assert.match(p.endereco, /^\/upload\?nome=/);
  assert.equal(p.conf.method, 'POST');
  assert.equal(p.conf.body, f, 'tem de ir o arquivo cru: base64 estoura o cano de 8 MB');
});

test('sem a rota /upload, o video avisa o porque em vez de falhar calado', async () => {
  const m = montarMundo({ resposta: async () => ({ status: 404, ok: false, json: async () => ({}) }) });
  let resposta = null;
  m.ctx.window.api.pickFiles('image').then((v) => { resposta = v; });
  const inp = oInput(m);
  inp.files = [arquivoFalso()];
  inp.disparar('change');
  for (let i = 0; i < 12; i++) { m.correr(1); await respirar(); }
  assert.deepEqual(lista(resposta), []);
  assert.equal(m.alertas.length, 1);
  assert.match(m.alertas[0], /vídeo/i);
});

test('uma falha de rede nao desliga o /upload pro resto da sessao', async () => {
  // a 1a tentativa cai (Wi-Fi oscilou), a 2a tem de tentar o /upload de novo
  let vez = 0;
  const m = montarMundo({ resposta: async () => { vez += 1; if (vez === 1) throw new Error('sem rede'); return { status: 200, ok: true, json: async () => ({ arquivo: '/Users/h/colados/foto.jpg' }) }; } });

  for (const passo of [1, 2]) {
    m.ctx.window.api.pickFiles('image');
    const inp = oInput(m);
    inp.files = [arquivoFalso({ name: 'foto.jpg', type: 'image/jpeg', size: 400 * 1024 })];
    inp.disparar('change');
    for (let i = 0; i < 12; i++) { m.correr(1); await respirar(); }
    assert.equal(m.pedidosFetch.length, passo, 'a tentativa ' + passo + ' tinha de bater no /upload');
  }
});

test('quando a rota nao existe mesmo, para de insistir', async () => {
  const m = montarMundo({ resposta: async () => ({ status: 404, ok: false, json: async () => ({}) }) });
  for (let passo = 0; passo < 2; passo++) {
    m.ctx.window.api.pickFiles('image');
    const inp = oInput(m);
    inp.files = [arquivoFalso({ name: 'foto.jpg', type: 'image/jpeg', size: 400 * 1024 })];
    inp.disparar('change');
    for (let i = 0; i < 12; i++) { m.correr(1); await respirar(); }
  }
  assert.equal(m.pedidosFetch.length, 1, 'Mac sem a rota: nao adianta bater nela a cada foto');
});

test('o app.js continua expondo o anexar que o web.js chama quando a escolha atrasa', () => {
  /* O web.js chama window.anexar(P, [caminho]) para nao perder o arquivo que chega tarde.
     Isso so funciona porque o anexar e declarado na primeira coluna do app.js: funcao de
     primeiro nivel em <script> comum vira window.<nome>. Se um dia ela entrar para dentro de
     outra funcao, o anexo atrasado volta a sumir calado — e este teste avisa antes. */
  const app = fs.readFileSync(path.resolve(__dirname, '../renderer/app.js'), 'utf8');
  assert.match(app, /^async function anexar\(/m, 'o anexar saiu do primeiro nivel do app.js');
  const web = fs.readFileSync(path.resolve(__dirname, '../renderer/web.js'), 'utf8');
  assert.match(web, /window\.anexar\(/, 'o web.js parou de anexar a escolha que chega atrasada');
});
