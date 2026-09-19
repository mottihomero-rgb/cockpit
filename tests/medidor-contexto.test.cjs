'use strict';
/* Trocar de motor, trocar a pasta ou entrar num worktree comeca uma conversa NOVA no mesmo
   painel. O codigo limpava tudo (historico, numero da conversa, plano, anexos) e esquecia dois
   numeros: quantos tokens a conversa usou e o tamanho da janela. O painel mostrava
   "390k / 1000k" com o anel no vermelho numa conversa recem-nascida. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.resolve(__dirname, '../renderer/app.js'), 'utf8');

test('zerarContexto zera os dois numeros e manda repintar', () => {
  const i = src.indexOf('function zerarContexto(P)');
  assert.ok(i > 0, 'a funcao zerarContexto tem de existir no app.js');
  const ctx = { pintou: null };
  vm.createContext(ctx);
  vm.runInContext('function pintarTokens(P){ this.pintou = P; }\n'
    + src.slice(i, src.indexOf('\n', i) + 1) + '\nthis.zerarContexto = zerarContexto;', ctx);
  const P = { tokens: 390000, janela: 1000000 };
  ctx.zerarContexto(P);
  assert.equal(P.tokens, 0);
  assert.equal(P.janela, 0);
  assert.equal(ctx.pintou, P, 'tem de repintar, senao o numero velho fica na tela');
});

/* Contrato: todo lugar que comeca conversa nova NO MESMO painel (o que se reconhece por zerar
   sessaoId e resumeId juntos) tem de zerar o medidor logo ali. Painel novo nasce zerado e nao
   entra nesta conta. */
test('todo reconeco de conversa no mesmo painel zera o medidor', () => {
  const linhas = src.split('\n');
  const faltando = [];
  linhas.forEach((linha, n) => {
    if (!/P\.sessaoId = null/.test(linha) || !/P\.resumeId = null/.test(linha)) return;
    if (/let P = newPane|const P = novoChatNaAba/.test(linhas.slice(Math.max(0, n - 12), n).join('\n'))) return;
    const perto = linhas.slice(n, n + 4).join('\n');
    if (!/zerarContexto\(P\)/.test(perto)) faltando.push((n + 1) + ': ' + linha.trim());
  });
  assert.deepEqual(faltando, [], 'estes reconecos deixam o medidor mentindo');
});
