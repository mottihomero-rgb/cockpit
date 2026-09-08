'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');
const { once } = require('node:events');
const WebSocket = require('ws');
const { criar } = require('../servidor-web');

async function servidor(t) {
  const calls = [], ouvintes = new Set();
  const s = criar({ pastaRenderer: path.resolve(__dirname, '../renderer'), porta: 0,
    senha: 'senha-apenas-de-teste', somenteTailscale: true, ouvintes,
    handlers: { ler: (e, arg) => { calls.push({ e, arg }); return 'mesmo histórico'; } } });
  await s.pronto; t.after(() => s.fechar());
  const origin = 'http://127.0.0.1:' + s.servidor.address().port;
  const login = async () => {
    const r = await fetch(origin + '/entrar?s=senha-apenas-de-teste', { redirect: 'manual' });
    assert.equal(r.status, 302); return r.headers.get('set-cookie').split(';')[0];
  };
  return { s, origin, login, calls, ouvintes };
}

test('Tailscale userspace chega ao login por loopback, sem abrir uma porta na LAN', async t => {
  const { s, origin } = await servidor(t);
  assert.equal(s.servidor.address().address, '127.0.0.1');
  const r = await fetch(origin);
  assert.equal(r.status, 200); assert.match(await r.text(), /Senha do Cockpit/);
  assert.equal(s.endereco, '', 'não inventar endereço da LAN quando o Tailscale estiver desligado');
  const manifest = await (await fetch(origin + '/manifest.json')).json();
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.start_url, '/');
  const protegido = await (await fetch(origin + '/app.js', { headers: { 'X-Forwarded-For': '100.64.0.1', 'Tailscale-User-Login': 'falso' } })).text();
  assert.match(protegido, /Senha do Cockpit/);
});

test('WebSocket exige sessão e mesma origem; desligar remove todos os telefones', async t => {
  const { s, origin, login, calls, ouvintes } = await servidor(t);
  const cookie = await login(), url = origin.replace('http:', 'ws:') + '/ws';
  for (const headers of [{ Origin: origin }, { Origin: 'http://site-estranho.test', Cookie: cookie }]) {
    const ws = new WebSocket(url, { headers });
    const [code] = await once(ws, 'close'); assert.equal(code, 1008);
  }
  assert.equal(calls.length, 0);
  const ws = new WebSocket(url, { headers: { Origin: origin, Cookie: cookie } });
  await once(ws, 'open');
  const resposta = once(ws, 'message');
  ws.send(JSON.stringify({ tipo: 'chamada', id: 7, nome: 'ler', arg: 'conversa' }));
  assert.equal(JSON.parse(String((await resposta)[0])).resposta, 'mesmo histórico');
  assert.equal(calls[0].e.remoto, true); assert.equal(ouvintes.size, 1);
  const fim = once(ws, 'close'); s.fechar();
  assert.equal((await fim)[0], 1001); assert.equal(ouvintes.size, 0);
});

test('Senha mantém limite de tentativas e sessão expira dentro do WebSocket', async t => {
  const { origin, login, calls } = await servidor(t);
  const cookie = await login();
  for (let i = 0; i < 5; i++) assert.equal((await fetch(origin + '/entrar?s=errada')).status, 401);
  assert.equal((await fetch(origin + '/entrar?s=senha-apenas-de-teste', { redirect: 'manual' })).status, 429);
  const ws = new WebSocket(origin.replace('http:', 'ws:') + '/ws', { headers: { Origin: origin, Cookie: cookie } });
  await once(ws, 'open');
  const agora = Date.now(); t.mock.method(Date, 'now', () => agora + 9 * 60 * 60 * 1000);
  const fechado = once(ws, 'close'); ws.send(JSON.stringify({ tipo: 'chamada', id: 1, nome: 'ler' }));
  assert.equal((await fechado)[0], 1008); assert.equal(calls.length, 0);
});

function ponte() {
  const sockets = [], timers = new Map(), events = [], listeners = {}, urls = [];
  let seq = 0;
  class Socket {
    constructor() { this.readyState = 0; this.sent = []; sockets.push(this); }
    send(txt) { this.sent.push(JSON.parse(txt)); }
    abrir() { this.readyState = 1; this.onopen(); }
    fechar(code = 1006, reason = '') { this.readyState = 3; this.onclose({ code, reason }); }
  }
  const window = { dispatchEvent: e => events.push(e), addEventListener: (k, f) => { listeners[k] = f; } };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../renderer/web.js'), 'utf8'), {
    window, WebSocket: Socket, CustomEvent: class { constructor(type, x) { this.type = type; this.detail = x?.detail; } },
    document: { body: { classList: { add() {}, remove() {} } }, addEventListener() {} },
    location: { protocol: 'http:', host: 'teste', replace: u => urls.push(u) },
    setTimeout: f => { const id = ++seq; timers.set(id, f); return id; }, clearTimeout: id => timers.delete(id),
  });
  return { api: window.api, sockets, timers, events, urls, listeners };
}

test('Pedido vencido enquanto estava offline nunca é enviado ao reconectar', async () => {
  const b = ponte(); const p = b.api.paneSend({ text: 'não enviar atrasado' });
  const erro = assert.rejects(p, /não respondeu/);
  [...b.timers.values()][0](); await erro;
  b.sockets[0].abrir(); assert.equal(b.sockets[0].sent.length, 0);
});

test('Queda não repete envio e sessão expirada volta ao login preservando rascunhos', async () => {
  const b = ponte(); b.sockets[0].abrir();
  const p = b.api.paneSend({ text: 'uma vez' }); const erro = assert.rejects(p, /conexão/);
  b.sockets[0].fechar(); await erro;
  b.listeners.online(); b.sockets[1].abrir(); assert.equal(b.sockets[1].sent.length, 0);
  b.sockets[1].fechar(1008, 'sessao expirou');
  assert.equal(b.events.at(-1).type, 'cockpit:salvar-rascunhos'); assert.deepEqual(b.urls, ['/']);
});
