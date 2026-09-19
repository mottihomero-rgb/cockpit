'use strict';
/* Copia de seguranca (arquivo.js.antes-alguma-coisa) nao pode virar commit.
   Ja aconteceu: 15 desses foram parar no GitHub publico, 1,8 MB de codigo velho
   que qualquer um baixava sem login. A regra "*.antes-*" no .gitignore tapou o
   buraco; este teste segura a regra no lugar pra nao abrir de novo sem ninguem ver. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const raiz = path.resolve(__dirname, '..');
const gitignore = fs.readFileSync(path.join(raiz, '.gitignore'), 'utf8');

// roda um git dentro da pasta do projeto e devolve saida + codigo de saida
function git(...args) {
  const r = spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
  return { ok: r.status === 0, saida: (r.stdout || '').trim(), erro: r.error };
}
// so da pra conferir o que o git enxerga se isto aqui for mesmo um repositorio
const temGit = git('rev-parse', '--is-inside-work-tree').saida === 'true';

// as formas de nome que ja apareceram de verdade no historico do projeto
const NOMES_DE_BACKUP = [
  'main.js.antes-quadro',
  'preload.js.antes-teclado',
  'renderer/app.js.antes-sem-limite-12',
  'renderer/style.css.antes-plano-icone',
  'renderer/app.js.bak.antes-quadro',
  'renderer/web.js.bak',
  'renderer/quadro.js.bak-antigo',
];

test('o .gitignore ainda barra copia de seguranca', () => {
  assert.match(gitignore, /^\*\.antes-\*$/m, 'sumiu a regra *.antes-* do .gitignore');
  assert.match(gitignore, /^\*\.bak$/m, 'sumiu a regra *.bak do .gitignore');
  assert.match(gitignore, /^\*\.bak\.\*$/m, 'sumiu a regra *.bak.* do .gitignore');
});

test('a regra pega mesmo cada formato de nome que ja foi usado', { skip: !temGit && 'sem git' }, () => {
  for (const nome of NOMES_DE_BACKUP) {
    assert.ok(git('check-ignore', '-q', '--no-index', nome).ok, 'o git ainda commitaria: ' + nome);
  }
});

test('nenhuma copia de seguranca esta sendo versionada agora', { skip: !temGit && 'sem git' }, () => {
  const rastreados = git('ls-files').saida.split('\n').filter(Boolean);
  const sobrando = rastreados.filter((f) => /\.antes-|\.bak(\.|-|$)/.test(f));
  assert.deepEqual(sobrando, [], 'backup dentro do repositorio: rodar git rm --cached nesses');
});
