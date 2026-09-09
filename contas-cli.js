'use strict';

// O login continua sendo feito pelos programas oficiais. O Cockpit só prepara
// o terminal e lê a identidade salva, sem copiar tokens para a interface.
const fs = require('fs');
const path = require('path');

const CHAVES = {
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI', 'GOOGLE_GENAI_USE_GCA', 'GOOGLE_APPLICATION_CREDENTIALS'],
  grok: ['XAI_API_KEY', 'GROK_CODE_XAI_API_KEY', 'GROK_API_KEY'],
};
function ambienteSemChaves(engine, base) {
  const env = { ...base };
  for (const key of CHAVES[engine] || []) delete env[key];
  return env;
}
function lerJson(file) {
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); return value && typeof value === 'object' ? value : {}; }
  catch { return {}; }
}
const aspas = value => "'" + String(value).replace(/'/g, "'\\''") + "'";

function criarContasCli({ HOME, pastaDados, acharBin, temBin, buildEnv, ehWindows = process.platform === 'win32' }) {
  function ambiente(engine, base = buildEnv()) {
    const env = ambienteSemChaves(engine, base);
    if (engine !== 'gemini') return env;
    const raiz = path.join(pastaDados(), 'contas-cli');
    const arquivo = path.join(raiz, 'gemini-conta-google.json');
    // Mantém as políticas existentes e muda apenas a autenticação deste processo.
    const original = base.GEMINI_CLI_SYSTEM_SETTINGS_PATH || (ehWindows
      ? 'C:\\ProgramData\\gemini-cli\\settings.json'
      : process.platform === 'darwin' ? '/Library/Application Support/GeminiCli/settings.json' : '/etc/gemini-cli/settings.json');
    const anterior = lerJson(original);
    const ajustes = { ...anterior, security: { ...anterior.security, auth: {
      ...anterior.security?.auth, selectedType: 'oauth-personal', enforcedType: 'oauth-personal', useExternal: false,
    } } };
    const texto = JSON.stringify(ajustes, null, 2) + '\n';
    fs.mkdirSync(raiz, { recursive: true });
    let atual = ''; try { atual = fs.readFileSync(arquivo, 'utf8'); } catch {}
    if (atual !== texto) fs.writeFileSync(arquivo, texto, { mode: 0o600 });
    env.GEMINI_CLI_SYSTEM_SETTINGS_PATH = arquivo;
    env.GEMINI_DEFAULT_AUTH_TYPE = 'oauth-personal';
    // ~/.gemini/.env e um .env do projeto não podem trocar o método por API.
    return env;
  }

  function ler(engine) {
    const instalado = temBin(engine), gemini = engine === 'gemini';
    let email = '', nome = '', salva = false, usandoApi = false;
    if (gemini) {
      const contas = lerJson(path.join(HOME, '.gemini', 'google_accounts.json'));
      email = typeof contas.active === 'string' ? contas.active : '';
      salva = !!email;
    } else {
      const todas = lerJson(path.join(HOME, '.grok', 'auth.json'));
      const lista = todas.auth_mode ? [todas] : Object.values(todas);
      const validas = lista.filter(c => c && typeof c === 'object' && typeof c.key === 'string' && c.key);
      usandoApi = validas.some(c => c.auth_mode === 'api_key');
      const conta = validas.find(c => ['oidc', 'external'].includes(c.auth_mode)
        && (!c.oidc_issuer || /^https:\/\/(auth|accounts)\.x\.ai(?:\/|$)/.test(c.oidc_issuer)));
      if (conta) {
        salva = true; email = typeof conta.email === 'string' ? conta.email : '';
        nome = [conta.first_name, conta.last_name].filter(v => typeof v === 'string').join(' ');
      }
    }
    return { entrou: instalado && salva, instalado, salvaLocalmente: salva, email, nome: nome || email,
      via: gemini ? 'Conta Google' : 'Conta Grok', plano: '', gratuito: true,
      sessao: null, semana: null, extra: null,
      motivo: !instalado ? 'O programa do ' + (gemini ? 'Gemini' : 'Grok') + ' ainda não está instalado.'
        : salva ? 'Conta salva neste Mac. O serviço confere o acesso ao começar a conversa.'
        : usandoApi ? 'Existe uma chave de API salva. Entre com sua conta para usar o acesso gratuito.'
        : gemini ? 'Entre com sua conta Google para usar a cota gratuita.'
        : 'Entre com sua conta Grok para experimentar o acesso gratuito.',
      limiteNota: gemini ? 'A cota gratuita é definida pelo Google.' : 'O teste gratuito e os limites são definidos pelo Grok.',
    };
  }

  function acao({ engine, acao, cwd }) {
    if (String(cwd || '').startsWith('vps:')) return { error: 'Este login fica no Mac. Abra uma pasta do Mac para entrar.' };
    const conta = ler(engine);
    if (acao === 'status') return { conta, texto: JSON.stringify({ loggedIn: conta.entrou, email: conta.email, estado: conta.salvaLocalmente ? 'salvo' : 'pendente' }) };
    if (!conta.instalado) return { error: conta.motivo };
    if (!['login', 'trocar', 'trocarCodigo', 'codigo', 'logout'].includes(acao)) return { error: 'Ação de conta desconhecida.' };
    const gemini = engine === 'gemini';
    const env = ambiente(engine);
    const pastaLogin = path.join(pastaDados(), 'contas-cli', 'login');
    fs.mkdirSync(pastaLogin, { recursive: true });
    const comando = [acharBin(engine)];
    if (gemini) {
      if (acao === 'logout') comando.push('--prompt-interactive', '/auth logout');
      else if (acao === 'trocar' || acao === 'trocarCodigo') comando.push('--prompt-interactive', '/auth');
    } else {
      comando.push('--no-auto-update', acao === 'logout' ? 'logout' : 'login');
      if (acao !== 'logout') comando.push('--oauth');
      if (acao === 'trocarCodigo' || acao === 'codigo') comando.push('--device-auth');
    }
    // Só os nomes das variáveis são retirados; nenhum segredo entra na linha do terminal.
    const ajustes = gemini ? { GEMINI_CLI_SYSTEM_SETTINGS_PATH: env.GEMINI_CLI_SYSTEM_SETTINGS_PATH, GEMINI_DEFAULT_AUTH_TYPE: 'oauth-personal' } : {};
    if (gemini && (acao === 'codigo' || acao === 'trocarCodigo')) ajustes.NO_BROWSER = 'true';
    let terminal;
    if (ehWindows) {
      const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
      terminal = 'cd /d ' + quote(pastaLogin) + ' && ' + [
        ...(CHAVES[engine] || []).map(k => 'set "' + k + '="'),
        ...Object.entries(ajustes).map(([k, v]) => 'set "' + k + '=' + v + '"'),
        comando.map(quote).join(' '),
      ].join(' && ');
    } else {
      terminal = 'cd ' + aspas(pastaLogin) + ' && env '
        + (CHAVES[engine] || []).map(k => '-u ' + k).join(' ') + ' '
        + Object.entries(ajustes).map(([k, v]) => k + '=' + aspas(v)).join(' ') + ' '
        + comando.map(aspas).join(' ');
    }
    return { terminal, titulo: (acao === 'logout' ? 'Sair do ' : 'Entrar no ') + (gemini ? 'Gemini' : 'Grok'),
      esperaLink: acao !== 'logout', confereDepois: true, naVps: false,
      orientacao: gemini ? 'Entre com sua conta Google no navegador. Depois da confirmação, feche este terminal.'
        : 'Entre com sua conta Grok no navegador. O login volta para o Cockpit ao terminar.',
    };
  }
  return { ler, acao, ambiente };
}
module.exports = { criarContasCli, ambienteSemChaves };
