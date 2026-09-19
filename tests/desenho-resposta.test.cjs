'use strict';
/* A tela remontava a resposta INTEIRA a cada pedacinho de texto que chegava: numa resposta de
   40 KB isso e mais de 26 milhoes de letras passando pelo markdown so para mostrar o fim.
   Agora o que ja fechou (tudo antes da ultima linha em branco) e desenhado uma vez, e so a
   PONTA e refeita. Este teste segura as duas coisas: o resultado tem de ser o mesmo, e o
   trabalho tem de ser muito menor. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { marked } = require('marked');

const src = fs.readFileSync(path.resolve(__dirname, '../renderer/app.js'), 'utf8');
const i = src.indexOf('const PONTA_GRANDE');
const f = src.indexOf('function textDelta(P, key, text) {');
assert.ok(i >= 0 && f > i, 'o pintor da ponta nao foi encontrado no app.js');

// tela de mentira: so o que o pintor usa de verdade
function elFalso() {
  const filhos = [];
  return {
    childNodes: filhos,
    get lastChild() { return filhos[filhos.length - 1]; },
    removeChild(n) { const k = filhos.indexOf(n); if (k >= 0) filhos.splice(k, 1); return n; },
    insertAdjacentHTML(_onde, html) { for (const p of String(html).split('\n')) if (p) filhos.push(p); },
    html() { return filhos.join('\n'); },
  };
}
const soTexto = (html) => String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

function carregar() {
  let contados = 0;
  const parseReal = marked.parse.bind(marked);
  const espiao = { parse: (t) => { contados += t.length; return parseReal(t); } };
  const ctx = { marked: espiao, Date, console };
  vm.createContext(ctx);
  vm.runInContext(src.slice(i, f) + '\nthis.pintarPonta = pintarPonta;', ctx);
  return { pintarPonta: ctx.pintarPonta, letras: () => contados };
}

const RESPOSTA = [
  '## Primeiro passo', '', 'Um paragrafo com **negrito** e um `trecho de codigo`.', '',
  '- item um', '- item dois', '', '```js', 'function soma(a, b) {', '', '  return a + b;', '}',
  '```', '', 'E o fim da resposta, depois do bloco.', '',
].join('\n');

function emPedacos(texto, tamanho) {
  const { pintarPonta, letras } = carregar();
  const b = { el: elFalso(), raw: '', corte: 0, fixos: 0 };
  for (let k = 0; k < texto.length; k += tamanho) {
    b.raw += texto.slice(k, k + tamanho);
    pintarPonta(b);
  }
  return { b, letras: letras() };
}

test('desenhar aos pedacos mostra o mesmo texto que desenhar tudo de uma vez', () => {
  const { b } = emPedacos(RESPOSTA, 7);
  assert.equal(soTexto(b.el.html()), soTexto(marked.parse(RESPOSTA)));
});

test('a linha em branco DENTRO do bloco de codigo nao corta a resposta no meio', () => {
  const { b } = emPedacos(RESPOSTA, 7);
  // "return a + b;" tem de continuar dentro do <pre>, e nao virar paragrafo solto
  assert.match(b.el.html(), /<pre>[\s\S]*return a \+ b;[\s\S]*<\/pre>/);
});

test('o trabalho do markdown cai MUITO: nao se refaz mais a resposta inteira a cada pedaco', () => {
  const grande = Array.from({ length: 120 }, (_, n) =>
    '## Passo ' + n + '\n\nUm paragrafo de explicacao com tamanho de resposta de verdade.\n\n- um\n- dois\n').join('\n');
  const { letras } = emPedacos(grande, 30);
  // o jeito antigo era marked.parse(tudo que chegou ate agora), a cada pedaco
  let antigo = 0;
  for (let k = 30; k <= grande.length; k += 30) antigo += k;
  assert.ok(letras * 10 < antigo,
    'a ponta tem de custar pelo menos 10x menos que refazer tudo (antigo=' + antigo + ', agora=' + letras + ')');
});

test('o que ja fechou fica quieto na tela: nao e redesenhado a cada pedaco', () => {
  const { pintarPonta } = carregar();
  const b = { el: elFalso(), raw: '', corte: 0, fixos: 0 };
  b.raw = 'Primeiro paragrafo.\n\nSegundo em construcao';
  pintarPonta(b);
  const primeiro = b.el.childNodes[0];
  b.raw += ' que continua crescendo.';
  pintarPonta(b);
  assert.equal(b.el.childNodes[0], primeiro, 'o paragrafo que ja fechou nao pode ser refeito');
});
