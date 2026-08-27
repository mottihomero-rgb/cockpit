/* Camada de plataforma do Cockpit.
 *
 * O Cockpit nasceu só para o Mac: chamava /bin/sh, /usr/bin/python3 e um PATH
 * do Homebrew direto no código. Este arquivo isola tudo que muda entre Mac e
 * Windows, para o resto do main.js não precisar saber onde está rodando.
 *
 * Três coisas mudam de verdade:
 *   1. PATH e onde moram os executáveis do Claude e do Codex;
 *   2. como se chama um executável (no Windows, .cmd não pode ser chamado direto);
 *   3. como se abre um terminal de verdade (pty): no Mac é o ptybridge.py,
 *      no Windows é o ConPTY, via node-pty (binário pronto, não compila nada).
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const EH_WIN = process.platform === 'win32';
const HOME = os.homedir();
const SEP = EH_WIN ? ';' : ':';

/* ---------- PATH ----------
   App de janela não herda o PATH do terminal (vale nos dois sistemas), então
   montamos um PATH completo na mão com os lugares onde as ferramentas moram. */
function pastasExtras() {
  if (EH_WIN) {
    const appdata = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
    const local = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    return [
      path.join(HOME, '.local', 'bin'),        // instalador nativo do Claude Code
      path.join(HOME, '.codex', 'bin'),
      path.join(appdata, 'npm'),               // npm install -g
      path.join(local, 'Programs', 'nodejs'),
      path.join(local, 'nvs', 'default'),
      path.join(pf, 'nodejs'),
      path.join(HOME, 'scoop', 'shims'),
      'C:\\Windows\\System32', 'C:\\Windows',
    ];
  }
  return [
    path.join(HOME, '.local/bin'),
    path.join(HOME, '.nvm/versions/node/v22.23.1/bin'),
    path.join(HOME, '.codex/bin'),
    '/opt/homebrew/bin', '/opt/homebrew/sbin',
    '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
  ];
}

function buildEnv() {
  // no Windows a variável pode vir escrita "Path"; achamos a chave real
  const chavePath = Object.keys(process.env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  const cur = (process.env[chavePath] || '').split(SEP);
  const env = { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'cockpit' };
  env[chavePath] = [...new Set([...cur, ...pastasExtras()])].filter(Boolean).join(SEP);
  if (EH_WIN && chavePath !== 'PATH') env.PATH = env[chavePath];
  // variaveis do VSCode quebram processos filhos
  delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
  delete env.VSCODE_PID; delete env.VSCODE_IPC_HOOK_CLI; delete env.VSCODE_CWD;
  return env;
}

/* ---------- achar executável ----------
   No Mac o caminho do Claude era fixo (~/.local/bin/claude). No Windows ele pode
   estar em quatro lugares e com três extensões, então procuramos de fato. */
const cacheBin = new Map();

function acharBin(nome) {
  if (cacheBin.has(nome)) return cacheBin.get(nome);
  const exts = EH_WIN ? ['.exe', '.cmd', '.bat', ''] : [''];
  const pastas = [...pastasExtras(), ...((process.env.PATH || '').split(SEP))];
  let achado = null;
  for (const dir of pastas) {
    if (!dir) continue;
    for (const ext of exts) {
      const p = path.join(dir, nome + ext);
      try { if (fs.statSync(p).isFile()) { achado = p; break; } } catch {}
    }
    if (achado) break;
  }
  const r = achado || nome;   // não achou: deixa o sistema procurar sozinho
  cacheBin.set(nome, r);
  return r;
}

/* ---------- chamar executável ----------
   No Windows, desde o Node 20 é proibido chamar um .cmd direto por spawn (foi
   uma correção de segurança). O jeito certo é passar pelo cmd.exe com a linha
   inteira montada e escapada por nós. */
function aspas(s) { return '"' + String(s).replace(/"/g, '""') + '"'; }

function linhaWindows(bin, args) {
  return '"' + [bin, ...args].map(aspas).join(' ') + '"';
}

function spawnBin(bin, args, opts = {}) {
  const alvo = path.isAbsolute(bin) ? bin : acharBin(bin);
  if (EH_WIN && /\.(cmd|bat)$/i.test(alvo)) {
    const comspec = process.env.ComSpec || 'cmd.exe';
    return spawn(comspec, ['/d', '/s', '/c', linhaWindows(alvo, args)],
      { ...opts, windowsVerbatimArguments: true });
  }
  return spawn(alvo, args, opts);
}

/* ---------- terminal de verdade (pty) ----------
   Interface única. Quem chama não sabe (nem precisa saber) qual dos dois motores
   está por baixo: os dois entregam dados, aceitam digitação e redimensionam. */
function abrirPty({ linha, cols, rows, cwd, env, ptyBridge }) {
  if (EH_WIN) return ptyWindows({ linha, cols, rows, cwd, env });
  return ptyMac({ linha, cols, rows, cwd, env, ptyBridge });
}

// Mac: continua exatamente como sempre foi — python3 + ptybridge.py, fd 3 resize.
function ptyMac({ linha, cols, rows, cwd, env, ptyBridge }) {
  const p = spawn('/usr/bin/python3', [ptyBridge, String(cols), String(rows), '/bin/sh', '-c', linha], {
    cwd, env, stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
  });
  return {
    onData(fn) { p.stdout.on('data', (d) => fn(d.toString('utf8'))); p.stderr.on('data', (d) => fn(d.toString('utf8'))); },
    onErro(fn) { p.on('error', (e) => fn(e)); },
    onFim(fn) { p.on('close', (code) => fn(code)); },
    escrever(d) { p.stdin.write(d); },
    redimensionar(c, r) { try { p.stdio[3].write(`resize ${c} ${r}\n`); } catch {} },
    matar() {
      try { p.kill('SIGTERM'); } catch {}
      setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, 1500);
    },
  };
}

// Windows: ConPTY pelo node-pty. O shell é o cmd.exe, que roda a linha e sai.
// Os argumentos vão como TEXTO, não como lista: em lista o node-pty escaparia
// do jeito do C, que não é o jeito do cmd.exe, e um caminho com espaço quebraria.
// Com `/s`, o cmd tira a primeira e a última aspas e roda o miolo como está.
function ptyWindows({ linha, cols, rows, cwd, env }) {
  const pty = require('@lydell/node-pty');
  const comspec = process.env.ComSpec || 'cmd.exe';
  const p = pty.spawn(comspec, '/d /s /c "' + linha + '"', {
    name: 'xterm-256color', cols, rows, cwd, env, useConpty: true,
  });
  let fimJaAvisado = false;
  return {
    onData(fn) { p.onData((d) => fn(d)); },
    onErro(fn) { /* node-pty avisa falha pelo onExit */ void fn; },
    onFim(fn) { p.onExit(({ exitCode }) => { if (!fimJaAvisado) { fimJaAvisado = true; fn(exitCode); } }); },
    escrever(d) { try { p.write(d); } catch {} },
    redimensionar(c, r) { try { p.resize(c, r); } catch {} },
    matar() { try { p.kill(); } catch {} },
  };
}

/* ---------- onde ficam as credenciais do Claude ----------
   No Mac ficam no Chaveiro (comando `security`). No Windows ficam num arquivo. */
function tokenClaude() {
  if (!EH_WIN) {
    try {
      const { execFileSync } = require('child_process');
      for (const conta of [process.env.USER, 'unknown']) {
        try {
          const raw = execFileSync('security',
            ['find-generic-password', '-s', 'Claude Code-credentials', '-a', conta, '-w'],
            { encoding: 'utf8', timeout: 8000 });
          const o = (JSON.parse(raw).claudeAiOauth) || {};
          if (o.accessToken) return o.accessToken;
        } catch {}
      }
    } catch {}
    return null;
  }
  for (const f of [path.join(HOME, '.claude', '.credentials.json'),
                   path.join(HOME, '.config', 'claude', '.credentials.json')]) {
    try {
      const o = (JSON.parse(fs.readFileSync(f, 'utf8')).claudeAiOauth) || {};
      if (o.accessToken) return o.accessToken;
    } catch {}
  }
  return null;
}

module.exports = { EH_WIN, HOME, buildEnv, acharBin, spawnBin, abrirPty, tokenClaude };
