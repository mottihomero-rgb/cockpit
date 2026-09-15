'use strict';
/* O quadro "Limite de uso" ficava com "—" e "o Claude está limitando as consultas agora".
   Duas causas: (1) cada tela perguntava o uso ao Claude por conta propria (faixa, cartao,
   celular, fim de cada resposta), a Anthropic respondia 429 e o app APAGAVA os numeros que ja
   tinha; (2) o plano Pro do Codex hoje so tem a janela da semana, e a "Sessão" vazia parecia
   defeito. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadMain } = require('./main-harness.cjs');

const USO_BOM = { five_hour: { utilization: 29, resets_at: '2099-01-01T00:00:00Z' },
  seven_day: { utilization: 55, resets_at: '2099-01-07T00:00:00Z' } };

function comRede(h, respostas) {
  const pedidos = [];
  const g = h.evaluate('globalThis');
  g.fetch = async (url) => {
    pedidos.push(url);
    const r = respostas.length > 1 ? respostas.shift() : respostas[0];
    if (r instanceof Error) throw r;
    return { status: r.status, ok: r.status >= 200 && r.status < 300,
      headers: { get: (n) => (r.headers || {})[String(n).toLowerCase()] ?? null },
      json: async () => r.body };
  };
  h.evaluate('credGuardada = "token-de-teste"');
  return pedidos;
}

test('Claude: 429 depois de uma leitura boa mantem os numeros, marcados como antigos', async () => {
  const h = loadMain();
  const pedidos = comRede(h, [{ status: 200, body: USO_BOM }, { status: 429, headers: { 'retry-after': '120' } }]);
  const bom = await h.call('uso:ler', 'claude');
  assert.equal(bom.sessao.pct, 29); assert.equal(bom.semana.pct, 55);
  h.evaluate('usoClaude.quando = 0');                  // leitura ficou velha: vai buscar de novo
  const depois = await h.call('uso:ler', 'claude');
  assert.equal(pedidos.length, 2);
  assert.equal(depois.sessao.pct, 29, 'o 429 nao pode apagar o numero que ja tinha');
  assert.equal(depois.semana.pct, 55);
  assert.ok(depois.velho > 0, 'tem que dizer de quando e o numero');
  assert.ok(!depois.limitado);
});

test('Claude: consultas seguidas usam a mesma leitura, sem bater de novo na Anthropic', async () => {
  const h = loadMain();
  const pedidos = comRede(h, [{ status: 200, body: USO_BOM }]);
  await Promise.all([h.call('uso:ler', 'claude'), h.call('uso:ler', 'claude'), h.call('uso:ler', 'claude')]);
  await h.call('uso:ler', 'claude');
  assert.equal(pedidos.length, 1);
});

test('Claude: depois do 429 espera o prazo que ela mandou antes de perguntar de novo', async () => {
  const h = loadMain();
  const pedidos = comRede(h, [{ status: 429, headers: { 'retry-after': '120' } }, { status: 200, body: USO_BOM }]);
  const r = await h.call('uso:ler', 'claude');
  assert.equal(r.limitado, true);
  assert.ok(r.voltaEm > Date.now() + 100000, 'devolve quando tenta de novo');
  await h.call('uso:ler', 'claude');
  assert.equal(pedidos.length, 1, 'dentro da pausa nao pode perguntar');
  h.evaluate('usoClaude.pausaAte = 0');
  const ok = await h.call('uso:ler', 'claude');
  assert.equal(pedidos.length, 2); assert.equal(ok.sessao.pct, 29);
});

test('Claude: falha de rede tambem devolve o ultimo numero bom', async () => {
  const h = loadMain();
  comRede(h, [{ status: 200, body: USO_BOM }, new Error('sem internet')]);
  await h.call('uso:ler', 'claude');
  h.evaluate('usoClaude.quando = 0');
  const r = await h.call('uso:ler', 'claude');
  assert.equal(r.semana.pct, 55); assert.ok(r.velho > 0);
});

test('Claude: numero antigo de janela que ja zerou nao aparece como se valesse', async () => {
  const h = loadMain();
  const passado = { ...USO_BOM, five_hour: { utilization: 97, resets_at: '2001-01-01T00:00:00Z' } };
  comRede(h, [{ status: 200, body: passado }, { status: 429 }]);
  await h.call('uso:ler', 'claude');
  h.evaluate('usoClaude.quando = 0');
  const r = await h.call('uso:ler', 'claude');
  assert.equal(r.sessao, null, 'a janela de 5h ja virou: o 97% antigo nao vale mais');
  assert.equal(r.semana.pct, 55);
});

const SO_SEMANA = { rateLimits: { primary: { usedPercent: 88, windowDurationMins: 10080, resetsAt: 4102444800 }, secondary: null, planType: 'pro' } };

test('Codex: plano so com limite da semana diz que nao ha limite de sessao', async () => {
  const h = loadMain();
  h.attachCodex('local', async (m) => (m === 'account/rateLimits/read' ? SO_SEMANA : {}));
  const r = await h.call('uso:ler', 'codex');
  assert.equal(r.semana.pct, 88);
  assert.equal(r.sessao, null);
  assert.equal(r.semSessao, true);
});

test('Codex: falha depois de uma leitura boa devolve o ultimo numero bom', async () => {
  const h = loadMain();
  let falhar = false;
  h.attachCodex('local', async (m) => {
    if (m !== 'account/rateLimits/read') return {};
    if (falhar) throw new Error('backend fora');
    return SO_SEMANA;
  });
  await h.call('uso:ler', 'codex');
  falhar = true;
  const r = await h.call('uso:ler', 'codex');
  assert.equal(r.semana.pct, 88); assert.ok(r.velho > 0);
});
