'use strict';
/* O que este teste segura (defeito 3b do video do iPhone):

   1. Mandar VIDEO do celular. O Mac so aceitava png/jpg/webp e devolvia "isso nao chegou
      como imagem" para qualquer outra coisa. Agora mp4, mov e webm tambem entram — e a
      extensao do arquivo sai da LEITURA DOS BYTES, nunca do rotulo que veio de fora
      (o iPhone chama o mesmo .mov ora de video/quicktime, ora de video/mp4).

   2. O teto tem de caber no cano. O teto de texto era 9 MB e o quadro do WebSocket do
      telefone e de 8 MB: o arquivo entre 8 e 9 MB derrubava a conexao — ele via o app
      reconectando e o anexo sumir — em vez de voltar com um erro legivel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadMain } = require('./main-harness.cjs');

const dataUrl = (mime, buf) => 'data:' + mime + ';base64,' + buf.toString('base64');
const caixaIso = (marca) => Buffer.concat([
  Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp'), Buffer.from(marca), Buffer.alloc(16),
]);
// o nome do arquivo gravado (o harness guarda tudo num Map no lugar do disco)
const gravados = (app) => [...app.files.keys()].filter(f => f.includes('/colados/'));

test('video do celular entra: mp4, mov e webm viram arquivo em colados/', () => {
  const app = loadMain();
  const casos = [
    ['video/mp4', caixaIso('isom'), '.mp4'],
    ['video/quicktime', caixaIso('qt  '), '.mov'],
    ['video/webm', Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]), '.webm'],
  ];
  for (const [mime, bytes, fim] of casos) {
    const r = app.call('imagem:salvar', { dados: dataUrl(mime, bytes), prefixo: 'anexo' });
    assert.equal(r.error, undefined, mime + ' voltou com erro: ' + r.error);
    assert.ok(r.arquivo.endsWith(fim), mime + ' virou ' + r.arquivo);
    assert.ok(r.arquivo.includes('/colados/'), 'gravou fora da pasta colados/: ' + r.arquivo);
  }
});

test('quem decide a extensao sao os bytes, nao o rotulo que veio do iPhone', () => {
  const app = loadMain();
  // o mesmo .mov que o Safari as vezes anuncia como mp4 continua saindo .mov
  const r = app.call('imagem:salvar', { dados: dataUrl('video/mp4', caixaIso('qt  ')), prefixo: 'anexo' });
  assert.ok(r.arquivo.endsWith('.mov'), 'saiu ' + r.arquivo);
});

test('imagem continua entrando (o Mac usa o mesmo caminho na foto e no recorte)', () => {
  const app = loadMain();
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  const r = app.call('imagem:salvar', { dados: dataUrl('image/png', png), prefixo: 'recorte' });
  assert.ok(r.arquivo.endsWith('.png'), 'saiu ' + r.arquivo);
  // jpeg e jpg sao o mesmo rotulo bagunçado pelo navegador
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8)]);
  assert.ok(app.call('imagem:salvar', { dados: dataUrl('image/jpg', jpg) }).arquivo.endsWith('.jpg'));
});

test('texto vestido de video nao vira arquivo, e o erro diz o que aconteceu', () => {
  const app = loadMain();
  const r = app.call('imagem:salvar', { dados: dataUrl('video/mp4', Buffer.from('nao sou video')) });
  assert.match(r.error, /não é um vídeo de verdade/);
  // imagem anunciada como video tambem nao cola: familia tem de bater
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8)]);
  assert.match(app.call('imagem:salvar', { dados: dataUrl('video/mp4', png) }).error, /não é um vídeo/);
  assert.match(app.call('imagem:salvar', { dados: 'xis' }).error, /não chegou como imagem nem como vídeo/);
  assert.equal(gravados(app).length, 0, 'gravou arquivo que devia ter sido recusado');
});

test('o nome do arquivo e montado aqui dentro: nada do que vem de fora vira caminho', () => {
  const app = loadMain();
  const r = app.call('imagem:salvar', {
    dados: dataUrl('video/mp4', caixaIso('isom')), prefixo: '../../../etc/passwd',
  });
  const nome = path.basename(r.arquivo);
  assert.ok(!r.arquivo.includes('..'), 'o prefixo escapou da pasta: ' + r.arquivo);
  assert.match(nome, /^etcpasswd-\d+\.mp4$/, 'nome gerado fora do padrao: ' + nome);
});

test('o teto cabe no cano do telefone (antes era 9 MB num cano de 8 MB)', () => {
  const app = loadMain();
  const tetoTexto = app.evaluate('IMG_MAX_TXT');
  const tetoBytes = app.evaluate('IMG_MAX');

  // o tamanho do quadro sai do proprio servidor-web.js: os dois numeros tem de conversar
  const web = fs.readFileSync(path.resolve(__dirname, '../servidor-web.js'), 'utf8');
  const m = /maxPayload:\s*([\d*\s]+)/.exec(web);
  assert.ok(m, 'nao achei o maxPayload no servidor-web.js — confira o limite do WebSocket la');
  const quadro = m[1].trim().split('*').reduce((a, n) => a * Number(n.trim()), 1);

  assert.ok(tetoTexto < quadro, 'o teto do texto (' + tetoTexto + ') passou do quadro do ws (' + quadro + ')');
  assert.ok(tetoBytes * 4 / 3 <= tetoTexto, 'o teto dos bytes nao cabe no teto do texto');

  const r = app.call('imagem:salvar', { dados: 'data:video/mp4;base64,' + 'A'.repeat(tetoTexto) });
  assert.match(r.error, /grande demais/);
  assert.equal(gravados(app).length, 0);
});

test('ditado longo do celular volta com recado, nao com a conexao caindo', async () => {
  const app = loadMain();
  const r = await app.call('voz:transcrever', { audio: 'A'.repeat(app.evaluate('IMG_MAX_TXT') + 1) });
  assert.match(r.error, /longa demais/);
});
