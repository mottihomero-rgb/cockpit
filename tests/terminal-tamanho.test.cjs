'use strict';
/* O terminal de dentro do painel nascia preso em 92 colunas por 22 linhas escritas no codigo,
   e o programa la dentro acreditava nesse tamanho: em painel estreito a linha quebrava no
   lugar errado e barra de progresso e tabela saiam tortas. O canal para avisar o tamanho novo
   (term:resize) existia no app desde sempre e ninguem chamava. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../renderer/app.js'), 'utf8');
const i = app.indexOf('function janelaTerminal(');
const f = app.indexOf('\nfunction perguntarTexto(', i);
assert.ok(i > 0 && f > i, 'janelaTerminal nao encontrada');
const janela = app.slice(i, f);

test('o tamanho nao e mais escrito no codigo', () => {
  assert.doesNotMatch(janela, /cols:\s*92/, 'as 92 colunas fixas tem de sumir');
  assert.doesNotMatch(janela, /rows:\s*22/, 'as 22 linhas fixas tem de sumir');
});

test('o terminal nasce do tamanho REAL da caixa preta', () => {
  assert.match(janela, /getBoundingClientRect/, 'tem de medir a caixa');
  assert.match(janela, /cols:\s*tam\.cols/, 'o terminal nasce com a medida');
  assert.match(janela, /termRun\(\{[^)]*cols:\s*tam\.cols/, 'o processo tem de receber a mesma medida');
});

test('mudou o tamanho do painel, o terminal e avisado', () => {
  assert.match(janela, /new ResizeObserver/, 'falta o observador de tamanho');
  assert.match(janela, /window\.api\.termResize\(\{ id, cols:/, 'falta chamar o canal term:resize');
});

test('fechar o terminal desliga o observador e tira a regua da tela', () => {
  const fechar = janela.slice(janela.indexOf('const fechar = () =>'));
  assert.match(fechar, /olhoTerminal\.disconnect\(\)/);
  assert.match(fechar, /regua\.remove\(\)/);
});

test('a ponte do telefone tambem tem o term:resize', () => {
  const web = fs.readFileSync(path.resolve(__dirname, '../renderer/web.js'), 'utf8');
  assert.match(web, /termResize:/);
});
