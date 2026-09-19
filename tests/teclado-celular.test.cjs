'use strict';
/* O defeito nº 1 do vídeo no iPhone: ao abrir o teclado, a barra de escrever pulava para o
   TOPO da tela, por baixo do relógio e da ilha dinâmica, e o meio da tela virava um vazio
   preto. Três causas somadas, todas em renderer/mobile.js:
   1. ninguém desfazia a rolagem que o iOS faz para revelar o campo em foco;
   2. o micro-zoom automático do iOS batia no "scale !== 1" e CONGELAVA a altura;
   3. a altura era gravada no meio da animação do teclado e nunca medida de novo — é o que
      deixava a faixa preta morta no rodapé quando o teclado fechava.
   Estes testes travam os três. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.resolve(__dirname, '../renderer/mobile.js'), 'utf8');
// só o pedaço da altura: o resto do mobile.js é da tela e não carrega aqui
function pedaco(inicio, fim) {
  const i = src.indexOf(inicio), f = src.indexOf(fim, i);
  assert.ok(i >= 0 && f > i, 'não achei o trecho da altura no mobile.js');
  return src.slice(i, f);
}
const CODIGO = pedaco('const vv = window.visualViewport;', 'function mostrarConversa()');

/* iPhone de mentira: só o que o trecho da altura encosta. A "janela visível" (visualViewport)
   é a parte da tela que sobra acima do teclado. */
function iphone({ altura = 852, descida = 0, zoom = 1, rolagem = 0 } = {}) {
  const ouvintes = new Map(), relogios = new Map();
  let seq = 0;
  const escutar = (alvo) => (nome, fn) => ouvintes.set(alvo + ':' + nome, (ouvintes.get(alvo + ':' + nome) || []).concat(fn));
  const feito = { rolagens: [], css: {} };
  const vv = { height: altura, offsetTop: descida, scale: zoom, addEventListener: escutar('vv') };
  const janela = {
    visualViewport: vv, scrollY: rolagem, pageYOffset: rolagem,
    addEventListener: escutar('win'),
    scrollTo: (x, y) => { feito.rolagens.push([x, y]); janela.scrollY = y; janela.pageYOffset = y; },
  };
  const doc = {
    hidden: false, addEventListener: escutar('doc'),
    documentElement: { style: { setProperty: (n, v) => { feito.css[n] = v; } } },
  };
  vm.runInNewContext(CODIGO, {
    window: janela, document: doc, innerHeight: altura,
    setTimeout: (fn, ms) => { const id = ++seq; relogios.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => relogios.delete(id),
  });
  return {
    vv, janela, doc, feito,
    appTem: () => feito.css['--altura-app'],
    disparar: (chave) => (ouvintes.get(chave) || []).forEach(fn => fn({})),
    // o tempo passa: roda os relógios que estavam marcados (a segunda medida do teclado)
    passarTempo: () => { const fila = [...relogios.values()]; relogios.clear(); fila.forEach(r => r.fn()); },
    quantosRelogios: () => relogios.size,
  };
}

test('Teclado abre: o app encolhe E a página volta ao topo (a barra não sobe pro relógio)', () => {
  const t = iphone();
  assert.equal(t.appTem(), '852px', 'de cara o app ocupa a tela inteira');

  // o teclado sobe: sobram 516pt de tela, e o iOS rolou a página 240pt pra revelar o campo
  t.vv.height = 516; t.janela.scrollY = 240; t.janela.pageYOffset = 240;
  t.disparar('vv:resize');

  assert.equal(t.appTem(), '516px', 'o app tem de caber no que sobrou acima do teclado');
  assert.deepEqual(t.feito.rolagens, [[0, 0]], 'a rolagem que o iOS fez tem de ser desfeita');
  assert.equal(t.janela.scrollY, 0);
});

test('A rolagem do iOS chega pelo "scroll" da janela visível, não só pelo "resize"', () => {
  const t = iphone();
  t.janela.scrollY = 300; t.janela.pageYOffset = 300;
  t.disparar('vv:scroll');
  assert.deepEqual(t.feito.rolagens, [[0, 0]], 'sem este ouvinte a barra fica presa lá em cima');
});

test('Micro-zoom do iOS no campo em foco NÃO congela a altura', () => {
  const t = iphone();
  // o iOS dá um zoominho sozinho ao focar o campo: antes isso travava tudo
  t.vv.scale = 1.02; t.vv.height = 516;
  t.disparar('vv:resize');
  assert.equal(t.appTem(), '516px', 'zoom de 2% é do iOS, não dele: a altura tem de acompanhar');
});

test('Zoom de verdade (dedos na tela) é respeitado: o app não mexe em nada', () => {
  const t = iphone();
  t.vv.scale = 1.6; t.vv.height = 400; t.janela.scrollY = 120;
  t.disparar('vv:resize');
  assert.equal(t.appTem(), '852px', 'enquanto ele lê com zoom, a tela fica quieta');
  assert.deepEqual(t.feito.rolagens, [], 'e ninguém puxa a página de volta pro canto');
});

test('Segunda medida ~350ms depois acerta a faixa preta morta do rodapé', () => {
  const t = iphone();
  // o teclado está FECHANDO: a medida pega o meio da animação e sobra vão preto embaixo
  t.vv.height = 700;
  t.disparar('vv:resize');
  assert.equal(t.appTem(), '700px');
  assert.equal(t.quantosRelogios(), 1, 'tem de ficar uma segunda medida marcada');

  t.vv.height = 852;             // a animação terminou de verdade
  t.passarTempo();
  assert.equal(t.appTem(), '852px', 'a segunda medida é que fecha o app no rodapé');
});

test('Vários resizes seguidos deixam só UMA segunda medida marcada', () => {
  const t = iphone();
  for (const h of [800, 700, 600]) { t.vv.height = h; t.disparar('vv:resize'); }
  assert.equal(t.quantosRelogios(), 1, 'a animação do teclado dispara dezenas de resize');
});

test('Janela visível que desce (offsetTop) entra na conta da altura', () => {
  const t = iphone();
  // o iOS empurra a janela visível pra baixo: sem somar isso, o fim do app some sob o teclado
  t.vv.height = 500; t.vv.offsetTop = 30;
  t.disparar('vv:resize');
  assert.equal(t.appTem(), '530px');
});

test('Girar o aparelho e voltar de outra aba remedem a tela', () => {
  for (const gatilho of ['win:orientationchange', 'win:pageshow', 'win:resize', 'doc:focusin']) {
    const t = iphone();
    t.vv.height = 393;                      // deitou o telefone
    t.disparar(gatilho);
    assert.equal(t.appTem(), '393px', gatilho + ' tem de remedir');
    assert.equal(t.quantosRelogios(), 1, gatilho + ' tem de marcar a segunda medida');
  }
  // voltou do WhatsApp: remede ao aparecer, e não faz nada ao esconder
  const t = iphone();
  t.doc.hidden = true; t.vv.height = 300;
  t.disparar('doc:visibilitychange');
  assert.equal(t.appTem(), '852px', 'escondido não mede: o iPhone devolve número errado');
  t.doc.hidden = false;
  t.disparar('doc:visibilitychange');
  assert.equal(t.appTem(), '300px');
});
