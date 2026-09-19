'use strict';
/* O celular so alcanca o Mac pelos nomes que estao na lista PERMITIDOS do servidor-web.js.
   Ja aconteceu duas vezes: alguem acrescenta um comando no renderer/web.js, esquece de por o
   nome na lista, e no iPhone o toque responde "so funciona no Mac" sem ninguem entender por que.
   Este teste amarra os dois arquivos: todo comando que a tela do celular chama tem de estar
   na lista, tirando os cinco que ficaram de fora DE PROPOSITO (terminal de verdade e Finder). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const servidor = fs.readFileSync(path.join(raiz, 'servidor-web.js'), 'utf8');
const web = fs.readFileSync(path.join(raiz, 'renderer/web.js'), 'utf8');

// os que o celular NAO pode ter: abrem um terminal de verdade no Mac ou mandam o Finder abrir
const DE_FORA = new Set(['term:run', 'term:input', 'term:resize', 'term:kill', 'shell:open', 'shell:openUrl']);

function lista() {
  const m = servidor.match(/const PERMITIDOS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(m, 'nao achei a lista PERMITIDOS no servidor-web.js');
  // so o que esta entre aspas simples e fora de comentario conta como nome de comando
  const semComentario = m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  return new Set([...semComentario.matchAll(/'([^']+)'/g)].map((x) => x[1]));
}

function chamados() {
  return new Set([...web.matchAll(/chamar\('([a-zA-Z0-9:._-]+)'/g)].map((x) => x[1]));
}

test('todo comando que o celular chama esta na lista branca', () => {
  const permitidos = lista();
  const faltando = [...chamados()].filter((n) => !DE_FORA.has(n) && !permitidos.has(n));
  assert.deepEqual(faltando, [],
    'o renderer/web.js chama estes comandos e o servidor nao deixa passar: ' + faltando.join(', '));
});

test('os cinco perigosos continuam fora da lista', () => {
  const permitidos = lista();
  for (const n of DE_FORA) {
    assert.equal(permitidos.has(n), false, n + ' nao pode estar na lista: abre terminal ou Finder no Mac');
  }
});

test('config:set nao entra na lista (o celular ja apagou as abas do Mac uma vez)', () => {
  assert.equal(lista().has('config:set'), false);
});
