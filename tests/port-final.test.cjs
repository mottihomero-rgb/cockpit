'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { criarCli } = require('../cli-motors');
const { loadMain } = require('./main-harness.cjs');

function montar(t, instalado = true) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-gemini-'));
  const eventos = [], processos = [], mortos = [];
  const cli = criarCli({ HOME: home, pastaDados: () => path.join(home, 'app'),
    temBin: () => instalado, acharBin: () => '/fake/bin/gemini', buildEnv: () => ({}),
    emit: (paneId, kind, data) => eventos.push({ paneId, kind, ...data }),
    matarGrupo: p => mortos.push(p),
    spawnBin: (bin, args, options) => {
      const p = new EventEmitter(); p.stdout = new PassThrough(); p.stderr = new PassThrough(); p.stdin = new PassThrough();
      const r = { p, bin, args, options, texto: '' }; p.stdin.on('data', d => { r.texto += d; }); processos.push(r); return p;
    } });
  t.after(() => { cli.fechar(); fs.rmSync(home, { recursive: true, force: true }); });
  const mandar = (r, o, newline = true) => r.p.stdout.write(Buffer.from(JSON.stringify(o) + (newline ? '\n' : '')));
  return { cli, home, eventos, processos, mortos, mandar };
}

test('Gemini ausente e pasta VPS falham antes de criar processo', t => {
  const m = montar(t, false);
  assert.throws(() => m.cli.start('p', { cwd: m.home }), /não está instalado/);
  assert.throws(() => m.cli.start('p', { cwd: 'vps:/projeto' }), /Mac/);
  assert.equal(m.processos.length, 0);
});

test('Gemini transmite pasta, modo e anexo pelo stdin, com grupo de processos próprio', t => {
  const m = montar(t);
  m.cli.start('p', { cwd: m.home, approval: 'manual', model: 'modelo-escolhido' });
  assert.equal(m.cli.enviar('p', 'ação\nsegunda linha', [{ path: '/tmp/anexo com espaço.png' }]), true);
  const r = m.processos[0];
  assert.equal(r.bin, '/fake/bin/gemini'); assert.equal(r.options.cwd, m.home);
  assert.equal(r.options.detached, process.platform !== 'win32');
  assert.deepEqual(r.args, ['--output-format', 'stream-json', '--approval-mode', 'default', '--model', 'modelo-escolhido']);
  assert.match(r.texto, /ação\nsegunda linha/); assert.match(r.texto, /anexo com espaço/);
  assert.equal(m.cli.enviar('p', 'concorrente'), false);
});

test('Gemini mantém UTF-8 dividido, lê a última linha sem quebra e termina uma vez', t => {
  const m = montar(t); m.cli.start('p', { cwd: m.home }); m.cli.enviar('p', 'Olá');
  const r = m.processos[0];
  const b = Buffer.from(JSON.stringify({ type: 'message', role: 'assistant', content: 'ação concluída' }));
  const i = b.indexOf(Buffer.from('ç')) + 1;
  r.p.stdout.write(b.subarray(0, i)); r.p.stdout.write(b.subarray(i)); r.p.emit('close', 0); r.p.emit('close', 0);
  assert.equal(m.eventos.filter(e => e.kind === 'text-final').pop().text, 'ação concluída');
  assert.equal(m.eventos.filter(e => e.kind === 'turn-end').length, 1);
});

test('Gemini retoma o ID real em dois painéis sem misturar conversas após reinício', t => {
  const m = montar(t);
  for (const p of ['a', 'b']) {
    m.cli.start(p, { cwd: m.home }); m.cli.enviar(p, 'mensagem ' + p);
    const r = m.processos.at(-1);
    m.mandar(r, { type: 'init', session_id: 'real-' + p });
    m.mandar(r, { type: 'message', role: 'assistant', content: 'resposta ' + p }); r.p.emit('close', 0);
  }
  const sess = m.cli.sessoes(); assert.equal(sess.length, 2);
  const a = sess.find(s => s.title === 'mensagem a');
  m.cli.parar('a'); m.cli.start('a', { cwd: m.home, resumeId: a.id }); m.cli.enviar('a', 'continua');
  assert.deepEqual(m.processos.at(-1).args.slice(-2), ['--resume', 'real-a']);
  assert.equal(m.cli.historico(a.file).filter(x => x.role === 'bot')[0].text, 'resposta a');
});

test('Parar Gemini conserva o texto parcial e ignora saída atrasada do processo antigo', t => {
  const m = montar(t); m.cli.start('p', { cwd: m.home }); m.cli.enviar('p', 'um');
  const r = m.processos[0]; m.mandar(r, { type: 'message', role: 'assistant', content: 'parcial' });
  m.cli.parar('p', true); m.cli.enviar('p', 'dois');
  const n = m.eventos.length; m.mandar(r, { type: 'message', role: 'assistant', content: 'antigo' }); r.p.emit('close', 0);
  assert.equal(m.eventos.length, n); assert.equal(m.mortos.length, 1);
  assert.equal(m.cli.historico(m.cli.sessoes()[0].file).filter(x => x.role === 'bot')[0].text, 'parcial');
});

test('Sessões nativas Gemini em JSON e JSONL respeitam rebobinar e substituir mensagens', t => {
  const m = montar(t), dir = path.join(m.home, '.gemini/tmp/projeto/chats'); fs.mkdirSync(dir, { recursive: true });
  const a = path.join(dir, 'a.json'); fs.writeFileSync(a, JSON.stringify({ sessionId: 'a', messages: [{ id: '1', type: 'user', content: [{ text: 'pergunta nativa' }] }, { id: '2', type: 'gemini', content: 'resposta' }] }));
  const b = path.join(dir, 'b.jsonl'); fs.writeFileSync(b, [
    { sessionId: 'b' }, { id: '1', type: 'user', content: 'velha' },
    { $set: { messages: [{ id: '2', type: 'user', content: 'nova' }, { id: '3', type: 'gemini', content: 'remover' }] } }, { $rewindTo: '3' },
  ].map(JSON.stringify).join('\n'));
  assert.equal(m.cli.sessoes().length, 2);
  assert.deepEqual(m.cli.historico(b), [{ role: 'user', text: 'nova' }]);
  assert.equal(m.cli.historico(a)[1].text, 'resposta');
});

test('Comandos do Gemini vêm de TOML; contas e ajustes extras não iniciam Codex', async t => {
  const m = montar(t), dir = path.join(m.home, '.gemini/commands'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'revisar.toml'), 'description = "Revisar o projeto"\nprompt = "teste"');
  assert.deepEqual(m.cli.comandos(), [{ name: 'revisar', desc: 'Revisar o projeto' }]);
  const h = loadMain();
  for (const engine of ['gemini', 'grok']) {
    assert.equal((await h.call('conta:ler', engine)).entrou, null);
    assert.equal(await h.call('uso:ler', engine), null);
    assert.equal((await h.call('pane:settings', { engine, paneId: 'p' })).ok, false);
    assert.ok((await h.call('auth:acao', { engine, acao: 'login' })).error);
  }
  assert.equal(h.spawned.length, 0);
});

test('Grok usa ACP e autentica pelo login salvo, sem solicitar chave de API', async () => {
  const h = loadMain();
  const start = h.call('pane:start', { paneId: 'g', engine: 'grok', cwd: h.HOME, approval: 'manual' });
  const r = h.spawned[0];
  assert.equal(r.bin, 'grok'); assert.deepEqual(r.args, ['--no-auto-update', 'agent', 'stdio']);
  const reply = (method, result) => { const q = r.writes.find(x => x.method === method); assert.ok(q, method); r.proc.stdout.emit('data', Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: q.id, result }) + '\n')); };
  reply('initialize', { agentCapabilities: {}, authMethods: [{ id: 'cached_token' }, { id: 'xai.api_key' }] });
  await new Promise(setImmediate);
  assert.equal(r.writes.find(x => x.method === 'authenticate').params.methodId, 'cached_token');
  reply('authenticate', {}); await new Promise(setImmediate);
  reply('session/new', { sessionId: 'grok-test' }); assert.equal(await start, true);
  await h.call('pane:stop', { paneId: 'g', engine: 'grok' });
  assert.ok(Object.hasOwn(r, 'signal'));
});
