'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadMain } = require('./main-harness.cjs');

test('Sugestões do Claude chegam ao painel certo, sem duplicatas ou objetos inválidos', () => {
  const h = loadMain();
  h.evaluate(`claudeMessage('p-teste', {type:'prompt_suggestion',suggestion:[' Revisar a oferta ',{text:'Preparar as mensagens'},'Revisar a oferta',null,{}]})`);
  const ev = h.paneEvents('sugestao');
  assert.equal(ev.length,1); assert.equal(ev[0].paneId,'p-teste');
  assert.deepEqual(ev[0].itens,['Revisar a oferta','Preparar as mensagens']);
  assert.equal(h.wire.length,0);
  h.evaluate(`claudeMessage('p-outro', {type:'prompt_suggestion',suggestion:{text:42}})`);
  assert.equal(h.paneEvents('sugestao').length,1);
});

test('Planos dos três protocolos mantêm texto e estado real de cada tarefa', () => {
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer/layout-hugo.js'),'utf8'),ctx);
  const result = JSON.parse(JSON.stringify(vm.runInContext(`normalizarPlano([
    {content:'Conferir a oferta',status:'completed'},
    {step:'Preparar os anúncios',status:'in_progress'},
    {txt:'Revisar',estado:'pendente'},
    {description:'Conferir no celular',status:'pending'},null,{status:'done'}])`,ctx)));
  assert.deepEqual(result,[{txt:'Conferir a oferta',estado:'feito'},{txt:'Preparar os anúncios',estado:'fazendo'},
    {txt:'Revisar',estado:'pendente'},{txt:'Conferir no celular',estado:'pendente'}]);
});

test('Sugestão vazia não gera evento e texto excessivo tem limite', () => {
  const h=loadMain();
  h.evaluate(`claudeMessage('p', {type:'prompt_suggestion',text:'   '})`);
  assert.equal(h.paneEvents('sugestao').length,0);
  h.evaluate(`claudeMessage('p', {type:'prompt_suggestion',prompt:'a'.repeat(9000)})`);
  assert.equal(h.paneEvents('sugestao')[0].itens[0].length,4000);
});
