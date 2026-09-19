'use strict';
/* No iPhone o botao de copiar nao copiava NADA e nem avisava: tentava o atalho do Mac (que la
   nao existe) e depois o clipboard do navegador, que o Safari so libera em endereco seguro
   (https) — e o Cockpit no celular e servido em http. As duas falhavam e o codigo dava return
   calado. Agora existe o jeito antigo (caixa de texto escondida + execCommand) e, aconteca o
   que acontecer, a tela avisa. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.resolve(__dirname, '../renderer/app.js'), 'utf8');
function pedaco(inicio, fim) {
  const i = src.indexOf(inicio), f = src.indexOf(fim, i);
  assert.ok(i >= 0 && f > i, 'trecho nao encontrado: ' + inicio);
  return src.slice(i, f);
}

// navegador de mentira: so o que a copia da era antiga usa
function montar({ execOk = true } = {}) {
  const feito = { copiou: null, comandos: [], avisos: [], sobrou: 0 };
  const corpo = [];
  const doc = {
    createElement: () => {
      const el = { value: '', atributos: {}, style: {}, selecao: null };
      el.setAttribute = (n, v) => { el.atributos[n] = v; };
      el.select = () => { el.selecao = [0, el.value.length]; };
      el.setSelectionRange = (a, b) => { el.selecao = [a, b]; };
      el.remove = () => { const k = corpo.indexOf(el); if (k >= 0) corpo.splice(k, 1); };
      return el;
    },
    body: { appendChild: (el) => corpo.push(el) },
    execCommand: (cmd) => {
      feito.comandos.push(cmd);
      const alvo = corpo[corpo.length - 1];
      if (execOk && alvo && alvo.selecao) { feito.copiou = alvo.value; return true; }
      return false;
    },
  };
  const ctx = {
    document: doc, window: { SEM_ELECTRON: true, api: {} }, navigator: {},
    setTimeout: () => 0, console,
    ico: () => '<svg/>',
    avisosFechados: new Map(),
    mostrarAviso: (o) => feito.avisos.push(o),
    quantosSobraram: () => corpo.length,
  };
  ctx.window.api.copiar = () => Promise.reject(new Error('o navegador nao deixa copiar aqui'));
  vm.createContext(ctx);
  vm.runInContext(pedaco('function copiarNaMarra(txt)', '\nfunction botaoCopiar(')
    + '\nthis.copiarTexto = copiarTexto; this.copiarNaMarra = copiarNaMarra;', ctx);
  return { ctx, feito, corpo };
}

test('no iPhone o texto vai para a area de transferencia pelo jeito antigo', async () => {
  const { ctx, feito } = montar();
  const ok = await ctx.copiarTexto('texto que ele quer copiar');
  assert.equal(ok, true);
  assert.equal(feito.copiou, 'texto que ele quer copiar');
  assert.deepEqual(feito.comandos, ['copy']);
  assert.equal(feito.avisos.length, 0, 'deu certo: nao precisa assustar ninguem');
});

test('o texto tem de estar MARCADO antes de copiar, senao o iPhone copia vazio', async () => {
  const { ctx, corpo } = montar();
  let marcado = null;
  const criar = ctx.document.createElement;
  ctx.document.createElement = () => {
    const el = criar();
    const real = el.setSelectionRange;
    el.setSelectionRange = (a, b) => { marcado = [a, b]; real(a, b); };
    return el;
  };
  await ctx.copiarTexto('doze letras');
  assert.deepEqual(marcado, [0, 'doze letras'.length]);
  assert.equal(corpo.length, 0, 'a caixa escondida tem de sair da tela depois');
});

test('quando nada funciona, a tela AVISA em vez de nao fazer nada', async () => {
  const { ctx, feito } = montar({ execOk: false });
  const ok = await ctx.copiarTexto('nao vai dar');
  assert.equal(ok, false);
  assert.equal(feito.avisos.length, 1, 'tem de aparecer um aviso na tela');
  assert.equal(feito.avisos[0].tipo, 'erro');
  assert.match(feito.avisos[0].texto, /copiar/i);
});

test('um X dado um dia nao cala o aviso para sempre', async () => {
  const { ctx, feito } = montar({ execOk: false });
  ctx.avisosFechados.set('copiar-nao-deu', { nivel: 0, reseta: 0 });
  await ctx.copiarTexto('nao vai dar');
  assert.equal(ctx.avisosFechados.has('copiar-nao-deu'), false);
  assert.equal(feito.avisos.length, 1);
});

test('a caixa escondida tem letra de 16px: abaixo disso o iPhone da zoom', () => {
  assert.match(pedaco('function copiarNaMarra(txt)', '\nasync function copiarTexto'), /font-size:16px/);
});
