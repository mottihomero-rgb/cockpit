/* ============ estado global ============ */
let cfg = {}, HOME = '';
let paneSeq = 0, focusPane = null;
const panes = new Map();     // id -> objeto do painel

const $ = (s, r = document) => r.querySelector(s);
/* logos oficiais (simple-icons) */
const LOGO = {
  claude: 'M4.7144 15.9555l4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z',
  codex: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
};
const ICONES = {"hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\" /> <path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\" /> <path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\" /> <path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\" />", "code-xml": "<path d=\"m18 16 4-4-4-4\" /> <path d=\"m6 8-4 4 4 4\" /> <path d=\"m14.5 4-5 16\" />", "clipboard-list": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /> <path d=\"M12 11h4\" /> <path d=\"M12 16h4\" /> <path d=\"M8 11h.01\" /> <path d=\"M8 16h.01\" />", "zap": "<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" />", "unlock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 9.9-1\" />", "upload": "<path d=\"M12 3v12\" /> <path d=\"m17 8-5-5-5 5\" /> <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" />", "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" /> <circle cx=\"9\" cy=\"9\" r=\"2\" /> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />", "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />", "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /> <circle cx=\"12\" cy=\"10\" r=\"3\" />", "eraser": "<path d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21\" /> <path d=\"m5.082 11.09 8.828 8.828\" />", "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /> <path d=\"M20 2v4\" /> <path d=\"M22 4h-4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" />", "brain": "<path d=\"M12 18V5\" /> <path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\" /> <path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\" /> <path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\" /> <path d=\"M18 18a4 4 0 0 0 2-7.464\" /> <path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\" /> <path d=\"M6 18a4 4 0 0 1-2-7.464\" /> <path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\" />", "sliders-horizontal": "<path d=\"M10 5H3\" /> <path d=\"M12 19H3\" /> <path d=\"M14 3v4\" /> <path d=\"M16 17v4\" /> <path d=\"M21 12h-9\" /> <path d=\"M21 19h-5\" /> <path d=\"M21 5h-7\" /> <path d=\"M8 10v4\" /> <path d=\"M8 12H3\" />", "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />", "arrow-left-right": "<path d=\"M8 3 4 7l4 4\" /> <path d=\"M4 7h16\" /> <path d=\"m16 21 4-4-4-4\" /> <path d=\"M20 17H4\" />", "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />", "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />", "plug": "<path d=\"M12 22v-5\" /> <path d=\"M15 8V2\" /> <path d=\"M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z\" /> <path d=\"M9 8V2\" />", "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /> <circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />", "log-out": "<path d=\"m16 17 5-5-5-5\" /> <path d=\"M21 12H9\" /> <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />", "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /> <circle cx=\"12\" cy=\"7\" r=\"4\" />", "file-code": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M10 12.5 8 15l2 2.5\" /> <path d=\"m14 12.5 2 2.5-2 2.5\" />", "file-text": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M10 9H8\" /> <path d=\"M16 13H8\" /> <path d=\"M16 17H8\" />", "braces": "<path d=\"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1\" /> <path d=\"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1\" />", "terminal": "<path d=\"M12 19h8\" /> <path d=\"m4 17 6-6-6-6\" />", "file": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />", "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />", "circle-help": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /> <path d=\"M12 17h.01\" />", "x": "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />", "check": "<path d=\"M20 6 9 17l-5-5\" />", "panel-left": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M9 3v18\" />", "chevron-right": "<path d=\"m9 18 6-6-6-6\" />", "chevron-down": "<path d=\"m6 9 6 6 6-6\" />", "arrow-up": "<path d=\"m5 12 7-7 7 7\" /> <path d=\"M12 19V5\" />", "square": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />", "rotate-cw": "<path d=\"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" />", "circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" />", "minus": "<path d=\"M5 12h14\" />", "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />", "search": "<path d=\"m21 21-4.34-4.34\" /> <circle cx=\"11\" cy=\"11\" r=\"8\" />", "star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />"};
const ico = (n) => '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONES[n] || '') + '</svg>';
const svgMotor = (eng) => '<svg viewBox="0 0 24 24" class="logo-motor"><path d="' + LOGO[eng === 'codex' ? 'codex' : 'claude'] + '"/></svg>';
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
marked.setOptions({ breaks: true, gfm: true });

const EF_PT = { minimal: 'Mínimo', low: 'Leve', medium: 'Médio', high: 'Alto',
  xhigh: 'Extra alto', max: 'Máximo', ultra: 'Ultra' };
const EF_DESC_PT = {
  minimal: 'O mais rápido, pensa quase nada',
  low: 'Resposta rápida, raciocínio leve',
  medium: 'Equilibra velocidade e profundidade',
  high: 'Pensa mais fundo em problemas difíceis',
  xhigh: 'Raciocínio bem mais profundo',
  max: 'Profundidade máxima + vários agentes em paralelo (workflows)',
  ultra: 'Consome a cota de uso mais rápido',
};

// esforço com que TODA conversa nova nasce (não muda quando você mexe na barra de um painel)
const EF_NOVO = 'medium';

// no Máximo o painel do Claude vira "ultracode". Em --print o CLI proíbe workflow por padrão,
// então a liberação vai como fala do usuário — é o que vence a regra de fábrica (testado).
const ULTRACODE_MSG = 'MODO ULTRACODE LIGADO PELO USUÁRIO: eu autorizo explicitamente, para esta e para todas as tarefas substantivas desta conversa, o uso da ferramenta Workflow (orquestração multi-agente) e de subagentes em paralelo. Busque a resposta mais completa e correta, não a mais rápida ou barata. Isso substitui qualquer regra em contrário sobre não usar workflows sem eu pedir. Continue pedindo meu aval apenas para gastar dinheiro, publicar/enviar para fora, ou apagar o que já funciona.\n\n---\n\n';

const MODELOS_CLAUDE = [
  { id: 'claude-opus-5[1m]', nome: 'Opus 5 (1M)', desc: 'O mais forte, com memória gigante',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'high', padrao: true },
  { id: 'claude-opus-5', nome: 'Opus 5', desc: 'O mais forte',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'high' },
  { id: 'claude-sonnet-5', nome: 'Sonnet 5', desc: 'Rápido e bom para o dia a dia',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'medium' },
  { id: 'claude-haiku-4-5-20251001', nome: 'Haiku 4.5', desc: 'O mais barato e veloz',
    efforts: ['low','medium','high'], padraoEffort: 'medium' },
];
let MODELOS_CODEX = null;   // vem do proprio Codex

function modelosDe(P) {
  if (P.engine === 'claude') return MODELOS_CLAUDE;
  return MODELOS_CODEX || [{ id: '', nome: 'padrão do Codex', desc: 'o que está no seu config', efforts: ['low','medium','high','xhigh'], padraoEffort: 'medium' }];
}
function modeloAtual(P) {
  const ms = modelosDe(P);
  return ms.find(m => m.id === P.model) || ms.find(m => m.padrao) || ms[0];
}
function esforcosDe(P) {
  const m = modeloAtual(P);
  const e = (m.efforts || []).map(x => (typeof x === 'string' ? { id: x, desc: EF_DESC_PT[x] || '' } : { id: x.id, desc: EF_DESC_PT[x.id] || x.desc || '' }));
  return e.length ? e : [{ id: 'medium', desc: '' }];
}

const TOOL_PT = {
  Read: 'Lendo arquivo', Write: 'Criando arquivo', Edit: 'Editando arquivo', Bash: 'Terminal',
  Glob: 'Procurando arquivos', Grep: 'Buscando no código', WebSearch: 'Pesquisando na web',
  WebFetch: 'Abrindo link', Task: 'Agente', TodoWrite: 'Lista de tarefas', Skill: 'Skill',
  NotebookEdit: 'Editando notebook', BashOutput: 'Saída do terminal',
};
function toolLabel(n) {
  if (TOOL_PT[n]) return TOOL_PT[n];
  if (n && n.startsWith('mcp__')) { const p = n.split('__'); return p[1] + (p[2] ? ' · ' + p[2] : ''); }
  return n || 'Ferramenta';
}
const shortPath = (p) => (p || '').replace(HOME, '~');
const nomePasta = (p) => {
  if (!p) return 'Pasta';
  if (p === HOME) return 'Pasta: Mac inteiro';
  return 'Pasta: ' + (p.split('/').pop() || p);
};

/* ============ painel ============ */
function piscar(P) {
  P.el.classList.remove('piscando');
  void P.el.offsetWidth;              // reinicia a animacao se clicar de novo
  P.el.classList.add('piscando');
  setTimeout(() => P.el.classList.remove('piscando'), 900);
}

function sairDaAbertura() {
  const bv = $('#boasvindas');
  if (bv) { bv.remove(); $('#panes').style.display = ''; }
}

function newPane(opts = {}) {
  sairDaAbertura();
  const id = 'p' + (++paneSeq);
  const el = $('#tplPane').content.firstElementChild.cloneNode(true);
  el.dataset.id = id;

  const P = {
    id, el,
    engine: opts.engine || cfg.lastEngine || 'codex',
    cwd: opts.cwd || cfg.defCwd || HOME,   // padrao: Mac inteiro
    model: opts.model || '',
    started: false, busy: false, queued: null, hist: [], passarContexto: null,
    titulo: opts.titulo || '', sessaoId: null, sessaoFile: '', anexos: [],
    envio: cfg.envioPadrao || 'fila',
    // conversa nova sempre nasce no intermediário; painel restaurado mantém o que estava salvo
    mode: opts.mode || cfg.defMode || 'bypass', effort: opts.effort || EF_NOVO,
    blocks: new Map(), tools: new Map(),
    chat: $('.pane-chat', el),
  };
  panes.set(id, P);

  // interruptor Claude / Codex
  $$('.ch-lado', el).forEach(bt => {
    $('span', bt).innerHTML = svgMotor(bt.dataset.motor);
    bt.addEventListener('click', () => trocarMotor(P, bt.dataset.motor));
  });
  try { new ResizeObserver(() => posicionarChave(P)).observe($('.p-chave', el)); } catch {}

  // modelo
  $('.p-model', el).addEventListener('click', (e) => { e.stopPropagation(); menuModelos(P); });

  // pasta
  const btnCwd = $('.p-cwd', el);
  btnCwd.addEventListener('click', async () => {
    const p = await window.api.pickFolder(P.cwd);
    if (!p) return;
    P.cwd = p; btnCwd.textContent = nomePasta(p);
    await window.api.paneStop({ paneId: id, engine: P.engine });
    P.started = false; setDot(P, 'off');
    if (focusPane === P) { loadTree(P.cwd); $('#tbTitle').textContent = shortPath(P.cwd) + '  ·  ' + (P.engine === 'codex' ? 'Codex' : 'Claude'); }
    note(P, 'Pasta: ' + shortPath(p)); savePanes();
  });

  $('.p-close', el).addEventListener('click', () => closePane(id));

  $('.pn-edit', el).innerHTML = ico('pencil');
  $('.pn-edit', el).addEventListener('click', () => renomearAqui(P));
  $('.pn-txt', el).addEventListener('dblclick', () => renomearAqui(P));

  // input
  const inp = $('.p-input', el);
  const grow = () => { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 190) + 'px'; };
  inp.addEventListener('input', grow);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(P); }
    if (e.key === 'Escape') { fecharMenus(); fecharModal(P); if (P.busy) window.api.paneInterrupt({ paneId: id, engine: P.engine }); }
  });
  // barra no comeco da linha abre o menu de acoes, e vai filtrando conforme digita
  inp.addEventListener('input', () => {
    const v = inp.value;
    if (v.startsWith('/') && !v.includes(' ')) {
      const busca = $('.p-modal .menu-search', el);
      if (busca) { busca.value = v.slice(1); busca.dispatchEvent(new Event('input')); }
      else { const t = v.slice(1); inp.value = ''; inp.style.height = 'auto'; menuSkills(P, t, true); }
    }
  });
  inp.addEventListener('focus', () => setFocus(P));
  el.addEventListener('mousedown', () => setFocus(P));
  // colar com cmd+V: imagem da area de transferencia ou arquivo copiado no Finder
  const colar = async (e) => {
    const dt = e.clipboardData;
    const temTexto = dt && [...(dt.items || [])].some(i => i.kind === 'string' && i.type === 'text/plain');
    const temArquivoNoEvento = dt && [...(dt.files || [])].length > 0;
    if (temArquivoNoEvento) {
      const fs2 = [...dt.files].map(f => f.path).filter(Boolean);
      if (fs2.length) { e.preventDefault(); setFocus(P); await anexar(P, fs2); return; }
    }
    const r = await window.api.colados();
    if (r && r.arquivos && r.arquivos.length) {
      e.preventDefault(); setFocus(P); await anexar(P, r.arquivos); return;
    }
    if (!temTexto) e.preventDefault();
  };
  el.addEventListener('paste', colar);   // um so: o evento do campo sobe ate aqui

  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('soltando'); });
  el.addEventListener('dragleave', () => el.classList.remove('soltando'));
  el.addEventListener('drop', async (e) => {
    e.preventDefault(); el.classList.remove('soltando');
    const fs = [...(e.dataTransfer.files || [])].map(f => f.path).filter(Boolean);
    if (fs.length) { setFocus(P); await anexar(P, fs); }
  });

  $('.p-send', el).addEventListener('click', () => send(P));
  $('.p-stop', el).addEventListener('click', () => window.api.paneInterrupt({ paneId: id, engine: P.engine }));

  // botao do modo (abre o menu de Modos)
  $('.p-modo', el).addEventListener('click', (e) => { e.stopPropagation(); menuModos(P); });

  $('.p-compactar', el).addEventListener('click', async (e) => {
    e.stopPropagation();
    if (P.busy) { avisoEnvio(P, 'Espere ele terminar para resumir a conversa.'); return; }
    const bt = $('.p-compactar', el);
    bt.classList.add('rodando');
    P.busy = true; setDot(P, 'busy'); trabalhando(P, 'resumindo a conversa');
    const r = await window.api.paneCompactar({ paneId: P.id, engine: P.engine });
    if (r && r.error) {
      P.busy = false; setDot(P, 'idle'); pararTrabalho(P);
      bt.classList.remove('rodando');
      avisoEnvio(P, 'Não deu para resumir: ' + r.error);
    }
  });

  const btEnvio = $('.p-modoenvio', el);
  const pintarEnvio = () => {
    const entra = P.envio === 'entra';
    btEnvio.innerHTML = ico(entra ? 'zap' : 'clipboard-list') + '<span>' + (entra ? 'Entra' : 'Fila') + '</span>';
    btEnvio.title = entra
      ? 'Se ele estiver trabalhando, sua mensagem entra no que está sendo feito agora'
      : 'Se ele estiver trabalhando, sua mensagem espera terminar para começar';
  };
  P.pintarEnvio = pintarEnvio;
  pintarEnvio();
  btEnvio.addEventListener('click', (e) => {
    e.stopPropagation();
    P.envio = P.envio === 'entra' ? 'fila' : 'entra';
    cfg.envioPadrao = P.envio; window.api.setConfig(cfg);
    pintarEnvio();
  });

  // botao +  (anexar)
  $('.p-plus', el).addEventListener('click', (e) => { e.stopPropagation(); menuAnexo(P); });
  // botao /  (comandos)
  $('.p-slash', el).addEventListener('click', (e) => { e.stopPropagation(); menuSkills(P); });

  btnCwd.textContent = nomePasta(P.cwd);
  fillModels(P); paintEngine(P); pintarModo(P);

  if (panes.size > 1) $('#panes').appendChild(makeSplitter());
  $('#panes').appendChild(el);
  setFocus(P);
  inp.focus();
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' }), 60);
  setTimeout(savePanes, 30);
  return P;
}

function makeSplitter() {
  const s = document.createElement('div');
  s.className = 'pane-split';
  s.title = 'Arraste para ajustar · clique duas vezes para deixar todos do mesmo tamanho';
  s.addEventListener('dblclick', (e) => {
    e.preventDefault(); e.stopPropagation();
    for (const q of panes.values()) q.el.style.flex = '';
    savePanes();
  });
  s.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const prev = s.previousElementSibling, next = s.nextElementSibling;
    if (!prev || !next) return;
    const startX = e.clientX, w1 = prev.getBoundingClientRect().width, w2 = next.getBoundingClientRect().width;
    const move = (ev) => {
      const d = ev.clientX - startX;
      const a = Math.max(280, w1 + d), b = Math.max(280, w2 - d);
      prev.style.flex = '0 0 ' + a + 'px'; next.style.flex = '0 0 ' + b + 'px';
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; savePanes(); };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });
  return s;
}

function savePanes() {
  cfg.panes = [...panes.values()].map(P => ({ engine: P.engine, cwd: P.cwd, model: P.model, mode: P.mode, effort: P.effort, titulo: P.titulo }));
  window.api.setConfig(cfg);
}

async function trocarMotor(P, novo) {
  if (novo === P.engine) return;
  const antigo = P.engine === 'codex' ? 'Codex' : 'Claude';
  await window.api.paneStop({ paneId: P.id, engine: P.engine });
  P.engine = novo; P.started = false; P.model = ''; P.resumeId = null;
  cfg.lastEngine = novo; window.api.setConfig(cfg);
  fillModels(P); paintEngine(P); pintarModo(P); setDot(P, 'off'); savePanes();

  // a conversa continua: o motor novo recebe o que já foi dito
  if (P.hist.length) P.passarContexto = montarContexto(P);
  marcaTroca(P, antigo, novo === 'codex' ? 'Codex' : 'Claude');
}

function montarContexto(P) {
  const LIM = 14000;
  const linhas = [];
  for (let i = P.hist.length - 1; i >= 0; i--) {
    const h = P.hist[i];
    const t = '### ' + h.quem + ':\n' + (h.texto || '').trim();
    if (linhas.join('\n\n').length + t.length > LIM) break;
    linhas.unshift(t);
  }
  return 'Estou continuando uma conversa que vinha sendo tocada por outro assistente, no mesmo computador '
    + 'e na mesma pasta. Abaixo está o que já foi conversado. Assuma o trabalho daqui em diante, '
    + 'sem recomeçar do zero e sem repetir o que já foi feito.\n\n'
    + '--- conversa até aqui ---\n' + linhas.join('\n\n') + '\n--- fim da conversa anterior ---\n\n'
    + 'Agora, o novo pedido:\n';
}

function marcaTroca(P, de, para) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'troca';
  d.innerHTML = '<span></span>';
  $('span', d).textContent = 'daqui em diante quem responde é o ' + para + ' (antes era o ' + de + ')';
  P.chat.appendChild(d); scroll(P, true);
}

function fillModels(P) {
  const ms = modelosDe(P);
  if (!ms.find(m => m.id === P.model)) P.model = (ms.find(m => m.padrao) || ms[0]).id;
  const ef = esforcosDe(P);
  if (!ef.find(e => e.id === P.effort)) P.effort = modeloAtual(P).padraoEffort || ef[Math.min(2, ef.length - 1)].id;
  $('.p-model', P.el).innerHTML = ico('brain') + '<span>' + modeloAtual(P).nome + '</span>';
}
function posicionarChave() {}   // o destaque do lado ativo é só CSS

function paintEngine(P) {
  const vazio = $('.pe-logo', P.el);
  if (vazio) vazio.innerHTML = svgMotor(P.engine);
  posicionarChave(P);
  P.el.classList.toggle('eng-codex', P.engine === 'codex');
  P.el.classList.toggle('eng-claude', P.engine === 'claude');
}
function setFocus(P) {
  if (focusPane === P) return;
  focusPane = P;
  for (const q of panes.values()) q.el.classList.toggle('focus', q === P);
  P.el.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  loadTree(P.cwd);
  $('#tbTitle').textContent = shortPath(P.cwd) + '  ·  ' + (P.engine === 'codex' ? 'Codex' : 'Claude');
  $('#projName').textContent = P.cwd === HOME ? 'Pasta: Mac inteiro' : ('Pasta: ' + (P.cwd.split('/').pop() || P.cwd));
}
async function closePane(id) {
  const P = panes.get(id); if (!P) return;
  if (panes.size === 1) { note(P, 'Este é o último painel.'); return; }
  await window.api.paneStop({ paneId: id, engine: P.engine });
  const sp = P.el.previousElementSibling || P.el.nextElementSibling;
  if (sp && sp.classList.contains('pane-split')) sp.remove();
  P.el.remove(); panes.delete(id);
  for (const q of panes.values()) q.el.style.flex = '';
  if (focusPane === P) setFocus([...panes.values()][0]);
  savePanes();
}
function pintarTokens(P) {
  pintarAnel(P);
  const el = $('.p-tokens', P.el);
  if (!P.tokens) { el.innerHTML = ''; return; }
  const usado = (P.tokens / 1000).toFixed(1) + 'k';
  if (P.janela) {
    const pct = Math.min(100, Math.round((P.tokens / P.janela) * 100));
    el.innerHTML = '<b></b><span class="tok-bar"><span class="tok-fill"></span></span>';
    $('b', el).textContent = usado + ' / ' + Math.round(P.janela / 1000) + 'k';
    $('.tok-fill', el).style.width = pct + '%';
    el.title = 'A conversa já ocupa ' + usado + ' das ' + Math.round(P.janela / 1000)
      + 'k palavras-token que cabem neste modelo (' + pct + '%). Quando enche, a conversa é resumida.';
  } else {
    el.innerHTML = '<b></b>';
    $('b', el).textContent = usado;
    el.title = 'Tamanho da conversa até agora.';
  }
}

function pintarAnel(P) {
  const bt = $('.p-compactar', P.el);
  if (!bt) return;
  const pct = (P.tokens && P.janela) ? Math.min(100, Math.round((P.tokens / P.janela) * 100)) : 0;
  // só aparece quando já vale a pena pensar nisso
  bt.classList.toggle('hidden', pct < 20);
  bt.classList.toggle('meio', pct >= 70 && pct < 90);
  bt.classList.toggle('cheio', pct >= 90);
  const volta = 2 * Math.PI * 15;
  $('.an-fio', bt).style.strokeDashoffset = String(volta - (volta * pct) / 100);

  bt.title = 'A conversa já ocupa ' + pct + '% do que cabe neste modelo.\n'
    + 'Clique para resumir e liberar espaço sem perder o fio.';
}

function setDot(P, state) {
  P.el.classList.toggle('ocupado', state === 'busy');
  $('.p-dot', P.el).className = 'p-dot dot ' + state;
  $('.p-stop', P.el).classList.toggle('hidden', state !== 'busy');
  $('.p-send', P.el).disabled = false;   // dá para enviar durante o trabalho: vai pela fila ou entra nele
}

/* ============ desenho das mensagens ============ */
function clearEmpty(P) { const e = $('.pane-empty', P.el); if (e) e.remove(); }

const soNome = (c) => String(c || '').split('/').pop();
function fraseDoPasso(nome, arg) {
  const a = String(arg || '').replace(/\s+/g, ' ').trim();
  const curto = a.length > 70 ? a.slice(0, 70) + '…' : a;
  switch (nome) {
    case 'Terminal': case 'Bash': return { txt: 'Rodando no terminal', det: curto };
    case 'Read': return { txt: 'Lendo', det: soNome(a) };
    case 'Write': return { txt: 'Criando o arquivo', det: soNome(a) };
    case 'Edit': case 'Editando arquivo': return { txt: 'Mexendo no arquivo', det: soNome(a) };
    case 'Grep': case 'Buscando no código': return { txt: 'Procurando no código', det: curto };
    case 'Glob': case 'Procurando arquivos': return { txt: 'Procurando arquivos', det: curto };
    case 'WebSearch': case 'Pesquisando na web': return { txt: 'Pesquisando na web', det: curto };
    case 'WebFetch': case 'Abrindo link': return { txt: 'Abrindo uma página', det: curto };
    case 'Task': case 'Agente': return { txt: 'Chamando um agente', det: curto };
    case 'TodoWrite': case 'Lista de tarefas': return { txt: 'Organizando as tarefas', det: '' };
    case 'Skill': return { txt: 'Usando a skill', det: curto };
    default: return { txt: toolLabel(nome), det: curto };
  }
}

function passo(P, frase, id) {
  if (!P.busy) return;
  clearEmpty(P);
  let box = P.passosEl;
  if (!box || !box.isConnected) {
    box = document.createElement('div');
    box.className = 'passos';
    P.chat.appendChild(box);
    P.passosEl = box;
  }
  const d = document.createElement('div');
  d.className = 'passo';
  d.innerHTML = '<span class="pa-pt"></span><span class="pa-t"></span><span class="pa-d"></span>';
  $('.pa-t', d).textContent = frase.txt;
  $('.pa-d', d).textContent = frase.det || '';
  if (id) d.dataset.id = id;
  box.appendChild(d);
  while (box.children.length > 8) box.firstChild.remove();
  P.chat.appendChild(box);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P);
}

function passoPronto(P, id, erro) {
  const box = P.passosEl;
  if (!box) return;
  const d = [...box.children].reverse().find(x => x.dataset.id === id);
  if (d) d.classList.add(erro ? 'erro' : 'ok');
}

function limparPassos(P) { if (P.passosEl) { P.passosEl.remove(); P.passosEl = null; } }

function trabalhando(P, oque) {
  if (!P.busy) return;              // terminou? entao nao mostra nada
  clearEmpty(P);
  let t = P.trabEl;
  if (!t || !t.isConnected) {
    t = document.createElement('div');
    t.className = 'trab';
    t.innerHTML = '<span class="trab-pts"><i></i><i></i><i></i></span><span class="trab-txt">trabalhando…</span>';
    P.chat.appendChild(t);
    P.trabEl = t;
  }
  $('.trab-txt', t).textContent = oque ? 'trabalhando… ' + oque : 'trabalhando…';
  P.chat.appendChild(t);            // mantem sempre no fim
  scroll(P);
}
function pararTrabalho(P) { if (P.trabEl) { P.trabEl.remove(); P.trabEl = null; } }
function atBottom(P) { return P.chat.scrollHeight - P.chat.scrollTop - P.chat.clientHeight < 100; }
function scroll(P, force) { if (force || atBottom(P)) P.chat.scrollTop = P.chat.scrollHeight; }

function userMsg(P, text, anexos) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'msg user';
  d.innerHTML = '<div class="msg-role"><span class="av"></span>Você</div>'
    + '<div class="msg-anx hidden"></div><div class="msg-body"></div>';
  pintarAvatar($('.av', d));
  if (anexos && anexos.length) {
    const cx = $('.msg-anx', d);
    cx.classList.remove('hidden');
    for (const a of anexos) cx.appendChild(fichaAnexo(a, false, null, P));
  }
  $('.msg-body', d).textContent = text;
  P.chat.appendChild(d); scroll(P, true);
  P.hist.push({ quem: 'Você', texto: text });
}
function pintarAvatar(el) {
  if (cfg.foto) el.innerHTML = '<img src="' + cfg.foto + '" alt="">';
  else el.innerHTML = ico('user');
}
function repintarAvatares() { $$('.msg.user .av').forEach(pintarAvatar); $('#fotoPrev') && pintarAvatar($('#fotoPrev')); }

function botBlock(P, key) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'msg bot';
  d.innerHTML = '<div class="msg-role"><span class="av">' + svgMotor(P.engine) + '</span>'
    + (P.engine === 'codex' ? 'Codex' : 'Claude') + '</div><div class="msg-body"></div>';
  P.chat.appendChild(d);
  const b = { el: $('.msg-body', d), raw: '' };
  P.blocks.set(key, b); scroll(P);
  return b;
}
function thinkBlock(P) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'think'; d.innerHTML = '<div class="think-in"></div>';
  P.chat.appendChild(d);
  const b = { el: $('.think-in', d), raw: '' };
  P.blocks.set('__think', b); scroll(P);
  return b;
}
function textDelta(P, key, text) {
  let b = P.blocks.get('resp');
  if (!b || P.blocks.get('respKey') !== key) {
    if (b) { b.raw = ''; b.el.innerHTML = ''; }        // reaproveita o mesmo bloco
    else { b = botBlock(P, 'resp'); }
    P.blocks.set('respKey', key);
    P.blocks.set('resp', b);
  }
  b.raw += text; b.el.innerHTML = marked.parse(b.raw);
  if (P.passosEl) P.chat.insertBefore(P.passosEl, b.el.parentElement);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P);
}
let ultimoPensar = 0;
function thinkDelta(P, text) {
  trabalhando(P, 'pensando');
  const agora = Date.now();
  if (agora - ultimoPensar > 8000) { ultimoPensar = agora; passo(P, { txt: 'Pensando no problema', det: '' }); }
}
function marcarLinksWeb(el) {
  for (const a of el.querySelectorAll('a[href^="http"]')) {
    a.classList.add('link-web');
    a.title = 'abre no seu navegador';
  }
}

function linkarArquivos(P, el) {
  const re = /(\/(?:Users|tmp|private|Volumes)\/[^\s"'<>)]+\.[A-Za-z0-9]{1,6})/g;
  const andar = (no) => {
    for (const filho of [...no.childNodes]) {
      if (filho.nodeType === 3) {
        const txt = filho.textContent;
        if (!re.test(txt)) { re.lastIndex = 0; continue; }
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let ult = 0, m;
        while ((m = re.exec(txt))) {
          if (m.index > ult) frag.appendChild(document.createTextNode(txt.slice(ult, m.index)));
          const caminho = m[1];                       // guarda o valor: o m muda no proximo laço
          const a = document.createElement('a');
          a.className = 'arquivo'; a.textContent = caminho; a.href = '#';
          a.title = 'abre aqui dentro';
          a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); verArquivo(P, caminho); };
          frag.appendChild(a);
          ult = m.index + caminho.length;
        }
        if (ult < txt.length) frag.appendChild(document.createTextNode(txt.slice(ult)));
        filho.replaceWith(frag);
      } else if (filho.nodeType === 1 && !['A', 'PRE', 'CODE'].includes(filho.tagName)) andar(filho);
    }
  };
  andar(el);
}

function textFinal(P, key, text) {
  if (!text || !text.trim()) return;
  let b = P.blocks.get('resp');
  if (!b || P.blocks.get('respKey') !== key) {
    if (b) { b.raw = ''; b.el.innerHTML = ''; }
    else { b = botBlock(P, 'resp'); }
    P.blocks.set('respKey', key); P.blocks.set('resp', b);
  }
  b.raw = text; b.el.innerHTML = marked.parse(text);
  linkarArquivos(P, b.el); marcarLinksWeb(b.el);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P);
  const quem = P.engine === 'codex' ? 'Codex' : 'Claude';
  const ult = P.hist[P.hist.length - 1];
  if (ult && ult.quem === quem) ult.texto = text; else P.hist.push({ quem, texto: text });
}
function toolStart(P, id, name, arg) {
  passo(P, fraseDoPasso(name, arg), id);
  return;
  /* eslint-disable no-unreachable */
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'tool';
  d.innerHTML = '<div class="tool-in"><div class="tool-hd"><span class="tool-ico">' + ico('chevron-right') + '</span>'
    + '<span class="tool-nm"></span><span class="tool-ar"></span><span class="tool-st run"></span></div>'
    + '<div class="tool-bd hidden"></div></div>';
  $('.tool-nm', d).textContent = toolLabel(name);
  $('.tool-ar', d).textContent = (arg || '').replace(/\n/g, ' ⏎ ').slice(0, 300);
  const bd = $('.tool-bd', d), icoEl = $('.tool-ico', d);
  $('.tool-hd', d).addEventListener('click', () => {
    bd.classList.toggle('hidden');
    icoEl.innerHTML = bd.classList.contains('hidden') ? ico('chevron-right') : ico('chevron-down');
  });
  P.chat.appendChild(d);
  P.tools.set(id, { el: d, body: bd, st: $('.tool-st', d), buf: '' });
  scroll(P);
}
function toolOutput(P, id, text) { return;
  const t = P.tools.get(id); if (!t) return;
  t.buf += text;
  if (t.buf.length > 20000) t.buf = t.buf.slice(-20000);
  t.body.textContent = t.buf;
}
function toolEnd(P, id, output, isErr) { passoPronto(P, id, isErr); return;
  const t = P.tools.get(id); if (!t) return;
  t.st.className = 'tool-st ' + (isErr ? 'err' : 'ok');
  t.st.innerHTML = isErr ? ico('x') : ico('check');
  let txt = (output || t.buf || '').toString().trim();
  if (txt.length > 20000) txt = txt.slice(0, 20000) + '\n… (cortado)';
  t.body.textContent = txt || '(sem saída)';
  scroll(P);
}
function note(P, text, isErr) {
  if (!isErr) return;                 // a tela mostra so pergunta, trabalhando e resposta
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'note err';
  d.textContent = text;
  P.chat.appendChild(d); scroll(P, true);
}

/* ============ envio ============ */
async function send(P) {
  const inp = $('.p-input', P.el);
  const text = inp.value.trim();
  if (!text) return;

  if (P.busy) {
    const anx = P.anexos.slice(); P.anexos = []; pintarAnexos(P);
    inp.value = ''; inp.style.height = 'auto';
    userMsg(P, text, anx);
    let envio = text;
    if (anx.length) envio += '\n\nArquivos que anexei (abra cada um antes de responder):\n' + anx.map(a => '- ' + a.path).join('\n');
    if (P.envio === 'entra') {
      const nota = avisoEnvio(P, 'Mandando para dentro do trabalho…');
      const r = await window.api.paneSteer({ paneId: P.id, engine: P.engine, text: envio });
      if (nota) nota.textContent = r && r.ok
        ? 'Entrou no trabalho que ele já está fazendo.'
        : 'Não deu para entrar agora, então ficou na fila.';
      if (!(r && r.ok)) P.queued = envio;
    } else {
      P.queued = envio;
      avisoEnvio(P, 'Na fila. Começa assim que ele terminar.');
    }
    return;
  }
  const anexos = P.anexos.slice();
  P.anexos = []; pintarAnexos(P);
  inp.value = ''; inp.style.height = 'auto';
  userMsg(P, text, anexos);
  if (!P.titulo) { P.titulo = text.replace(/\s+/g, ' ').slice(0, 70); pintarNome(P); }

  if (!P.started) {
    setDot(P, 'busy');
    note(P, P.engine === 'codex' ? 'Ligando o Codex…' : 'Ligando o Claude…');
    try {
      await window.api.paneStart({ paneId: P.id, engine: P.engine, cwd: P.cwd, model: P.model || undefined, approval: P.mode, effort: esforcoDe(P), resumeId: P.resumeId || undefined });
      P.started = true; P.resumeId = null; P.ultraAvisado = false;   // processo novo: liberar o ultracode de novo
    } catch (e) {
      setDot(P, 'off'); note(P, 'Não consegui ligar: ' + (e && e.message || e), true); return;
    }
  }
  P.busy = true; setDot(P, 'busy'); P.blocks.clear(); pararTrabalho(P); limparPassos(P); trabalhando(P);
  subirNaLista(P);
  let envio = text;
  if (anexos.length) {
    envio += '\n\nArquivos que anexei (abra cada um antes de responder):\n'
      + anexos.map(a => '- ' + a.path).join('\n');
  }
  if (P.passarContexto) { envio = P.passarContexto + text; P.passarContexto = null; }
  // Máximo no Claude = ultracode: uma vez por processo, a liberação vai grudada na mensagem
  if (P.engine === 'claude' && esforcoDe(P) === 'max' && !P.ultraAvisado) {
    envio = ULTRACODE_MSG + envio; P.ultraAvisado = true;
    avisoEnvio(P, 'Esforço máximo: liberei os workflows (vários agentes em paralelo).');
  }
  try { await window.api.paneSend({ paneId: P.id, engine: P.engine, text: envio, effort: P.engine === 'codex' ? esforcoDe(P) : undefined }); }
  catch (e) { P.busy = false; setDot(P, 'idle'); note(P, 'Falhou: ' + (e && e.message || e), true); }
}

/* ============ eventos vindos do motor ============ */
window.api.onPaneEvent((ev) => {
  const P = panes.get(ev.paneId); if (!P) return;
  switch (ev.kind) {
    case 'busy': P.busy = true; setDot(P, 'busy'); trabalhando(P); break;
    case 'sessao': P.sessaoId = ev.id; P.sessaoFile = ev.file || ''; break;
    case 'text-delta': textDelta(P, ev.id, ev.text); break;
    case 'think-delta': thinkDelta(P, ev.text); break;
    case 'text-final': textFinal(P, ev.id, ev.text); break;
    case 'tool-start': toolStart(P, ev.id, ev.name, ev.arg); break;
    case 'tool-output': toolOutput(P, ev.id, ev.text); break;
    case 'tool-end': toolEnd(P, ev.id, ev.output, ev.error); break;
    case 'compactou': $('.p-compactar', P.el).classList.remove('rodando'); avisoEnvio(P, 'Conversa resumida. O que importa foi mantido.'); break;
    case 'tokens':
      if (ev.janela) P.janela = ev.janela;
      P.tokens = ev.total || 0;
      pintarTokens(P);
      break;
    case 'janela': P.janela = ev.total; pintarTokens(P); break;
    case 'note': note(P, ev.text, ev.error); break;
    case 'turn-end':
      P.busy = false; setDot(P, 'idle'); P.blocks.clear(); pararTrabalho(P); limparPassos(P);
      $('.p-compactar', P.el).classList.remove('rodando');
      setTimeout(() => { if (!P.busy) { pararTrabalho(P); limparPassos(P); } }, 400);
      histCache[P.engine] = null;
      setTimeout(() => buscarNome(P), 1200);
      if (!$('.side-view[data-view="h' + P.engine + '"]').classList.contains('hidden')) loadHist(P.engine, true);
      if (P.queued) { const q = P.queued; P.queued = null;
        setTimeout(async () => { P.busy = true; setDot(P, 'busy'); await window.api.paneSend({ paneId: P.id, engine: P.engine, text: q, effort: P.engine === 'codex' ? esforcoDe(P) : undefined }); }, 150); }
      break;
    case 'engine-down': P.started = false; P.busy = false; setDot(P, 'off'); pararTrabalho(P); limparPassos(P); note(P, 'A conexão caiu. A próxima mensagem religa.', true); break;
    case 'approval': showApproval(P, ev); break;
  }
});

function showApproval(P, ev) {
  const bar = $('.pane-perm', P.el);
  $('.pp-txt', bar).textContent = ev.title + '\n' + (ev.detail || '') + (ev.reason ? '\n' + ev.reason : '');
  bar.classList.remove('hidden');
  const done = (allow) => { bar.classList.add('hidden'); window.api.approve({ key: ev.key, allow }); };
  $('.pp-yes', bar).onclick = () => done(true);
  $('.pp-no', bar).onclick = () => done(false);
}

/* ============ arvore de arquivos ============ */
const expanded = new Set();
let treeGen = 0;
async function loadTree(dir) {
  const gen = ++treeGen;                    // cancela um carregamento anterior ainda em andamento
  $('#projName').textContent = dir === HOME ? 'Pasta: Mac inteiro' : ('Pasta: ' + (dir.split('/').pop() || dir));
  const box = $('#tree'); box.innerHTML = '';
  await level(dir, box, 0, gen);
}
async function level(dir, container, depth, gen) {
  if (gen !== undefined && gen !== treeGen) return;
  const r = await window.api.listDir(dir);
  if (gen !== undefined && gen !== treeGen) return;
  if (r.error) { container.innerHTML = '<div class="hint" style="padding:6px 14px">' + r.error + '</div>'; return; }
  for (const e of r.entries) {
    const n = document.createElement('div');
    n.className = 'node ' + (e.dir ? 'd' : 'f');
    n.style.paddingLeft = (8 + depth * 12) + 'px';
    const open = expanded.has(e.path);
    n.innerHTML = '<span class="chev">' + (e.dir ? (open ? ico('chevron-down') : ico('chevron-right')) : '') + '</span>'
      + '<span class="ico">' + (e.dir ? ico('folder') : icon(e.name)) + '</span><span class="nm"></span>';
    $('.nm', n).textContent = e.name;
    container.appendChild(n);
    if (e.dir) {
      const kids = document.createElement('div'); container.appendChild(kids);
      if (open) await level(e.path, kids, depth + 1, gen);
      n.addEventListener('click', async () => {
        if (expanded.has(e.path)) { expanded.delete(e.path); kids.innerHTML = ''; $('.chev', n).innerHTML = ico('chevron-right'); }
        else { expanded.add(e.path); $('.chev', n).innerHTML = ico('chevron-down'); await level(e.path, kids, depth + 1); }
      });
    } else {
      n.addEventListener('click', () => {
        if (!focusPane) return;
        const inp = $('.p-input', focusPane.el);
        inp.value = (inp.value ? inp.value + ' ' : '') + e.path;
        inp.focus();
      });
      n.addEventListener('dblclick', () => window.api.openPath(e.path));
    }
  }
}
function icon(name) {
  const x = name.split('.').pop().toLowerCase();
  if (['js','mjs','ts','tsx','jsx','py','html','css'].includes(x)) return ico('file-code');
  if (['json','yml','yaml','toml'].includes(x)) return ico('braces');
  if (['md','txt'].includes(x)) return ico('file-text');
  if (['png','jpg','jpeg','gif','svg','webp'].includes(x)) return ico('image');
  if (['sh','zsh','bash'].includes(x)) return ico('terminal');
  return ico('file');
}

/* ============ menus (mesma cara do VSCode, em português) ============ */
const MODOS = {
  claude: [
    { id: 'manual',    ic: 'hand', nome: 'Manual',                 desc: 'Pergunta antes de cada ação' },
    { id: 'auto-edit', ic: 'code-xml', nome: 'Editar automaticamente', desc: 'Mexe nos arquivos sozinho e pergunta o resto' },
    { id: 'plan',      ic: 'clipboard-list', nome: 'Plano',                  desc: 'Só estuda e mostra o plano, não altera nada' },
    { id: 'auto',      ic: 'zap', nome: 'Auto',                   desc: 'Segue sozinho no que é seguro e para no que é arriscado' },
    { id: 'bypass',    ic: 'unlock', nome: 'Sem pedir permissão',    desc: 'Faz tudo sem perguntar, inclusive o que é perigoso' },
  ],
  codex: [
    { id: 'manual',    ic: 'hand', nome: 'Manual',                 desc: 'Pergunta antes de cada ação' },
    { id: 'auto',      ic: 'zap', nome: 'Auto',                   desc: 'Segue sozinho no que é seguro e para no que é arriscado' },
    { id: 'bypass',    ic: 'unlock', nome: 'Sem pedir permissão',    desc: 'Faz tudo sem perguntar, inclusive o que é perigoso' },
  ],
};
const esforcoDe = (P) => P.effort;
const modoDe = (P) => (MODOS[P.engine].find(m => m.id === P.mode) || MODOS[P.engine][MODOS[P.engine].length - 1]);

/* ---- barra de esforço: trilho contínuo, arrasta com ímã e volta no encaixe ---- */
const clamp01 = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (a, b, v) => { const x = clamp01((v - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const entre = (a, b, t) => a + (b - a) * t;

function barraEsforco(P) {
  const lista = esforcosDe(P);
  const ULT = lista.length - 1;

  const box = document.createElement('div');
  box.className = 'ef-blk';
  box.innerHTML =
    '<div class="ef-top">' +
      '<div class="ef-tit">Esforço <span class="ef-stage">' +
        '<span class="ef-out"></span><span class="ef-cur"></span></span></div>' +
      '<div class="ef-helpwrap"><button class="ef-help" type="button" aria-label="o que é isso">' +
        ico('circle-help') + '</button>' +
        '<div class="ef-tip">Quanto mais alto, mais tempo ele pensa antes de responder. O último nível gasta a sua cota bem mais rápido.</div>' +
      '</div>' +
    '</div>' +
    '<div class="ef-axis"><span>mais rápido</span><span>mais esperto</span></div>' +
    '<div class="ef-shell">' +
      '<div class="ef-track"><div class="ef-fill"></div><canvas class="ef-px"></canvas>' +
      '<div class="ef-ticks">' + lista.map(() => '<span class="ef-tick"></span>').join('') + '</div></div>' +
      '<div class="ef-thumb" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="' + ULT + '"></div>' +
    '</div>';

  const shell = $('.ef-shell', box), thumb = $('.ef-thumb', box);
  const cur = $('.ef-cur', box), out = $('.ef-out', box);
  const track = $('.ef-track', box), cv = $('.ef-px', box);

  let valor = Math.max(0, lista.findIndex(e => e.id === P.effort));
  let ix = Math.round(valor);
  let arrastando = false, amostras = [], frameMola = 0, framePx = 0, revelar = 0, ultraDesde = 0;

  const nome = (i) => EF_PT[lista[i].id] || lista[i].id;

  function trocaRotulo(novoTxt, pFrente) {
    const antes = cur.textContent;
    if (!antes) { cur.textContent = novoTxt; return; }
    out.textContent = antes; cur.textContent = novoTxt;
    cur.style.setProperty('--sobe', pFrente ? '3px' : '-3px');
    out.style.setProperty('--sai', pFrente ? '-3px' : '3px');
    cur.classList.add('preparando'); out.classList.remove('saindo');
    void cur.getBoundingClientRect();
    requestAnimationFrame(() => { cur.classList.remove('preparando'); out.classList.add('saindo'); });
    setTimeout(() => { out.textContent = ''; out.classList.remove('saindo'); }, 210);
  }

  function pintar(v) {
    valor = clamp01(v, 0, ULT);
    box.style.setProperty('--ef-prog', String(ULT ? valor / ULT : 0));
    const novoIx = Math.round(valor);
    if (novoIx !== ix) { const frente = novoIx > ix; ix = novoIx; trocaRotulo(nome(ix), frente); }
    else if (!cur.textContent) cur.textContent = nome(ix);
    box.classList.toggle('ultra', ix === ULT);
    thumb.title = nome(ix) + (lista[ix].desc ? ' — ' + lista[ix].desc : '');
    thumb.setAttribute('aria-valuenow', String(ix));
    thumb.setAttribute('aria-valuetext', nome(ix));
  }

  // ímã: perto de um encaixe, puxa para ele
  function ima(v) {
    const perto = Math.round(v), d = v - perto, dist = Math.abs(d);
    if (dist < 0.001 || dist > 0.5) return v;
    const t = 1 - dist / 0.5;
    return v - d * (0.68 + 0.42 * t) * t * t;
  }

  function encaixar() {
    const alvo = Math.round(valor);
    if (Math.abs(alvo - valor) < 0.001) { aplicar(alvo); return; }
    let vel = 0;
    if (amostras.length >= 2) {
      const a = amostras[0], b = amostras[amostras.length - 1];
      vel = clamp01((b.v - a.v) / Math.max((b.t - a.t) / 1000, 0.016), -8, 8);
    }
    cancelAnimationFrame(frameMola);
    let pos = valor, tAnt = performance.now();
    const passo = (t) => {
      const dt = Math.min((t - tAnt) / 1000, 0.032); tAnt = t;
      vel += (-920 * (pos - alvo) - 40 * vel) * dt;
      pos = clamp01(pos + vel * dt, 0, ULT);
      pintar(pos);
      if (Math.abs(pos - alvo) < 0.001 && Math.abs(vel) < 0.01) { frameMola = 0; aplicar(alvo); return; }
      frameMola = requestAnimationFrame(passo);
    };
    frameMola = requestAnimationFrame(passo);
  }

  async function aplicar(i) { pintar(i); await trocarEsforco(P, lista[i].id); }

  const valorDoX = (clientX) => {
    const r = shell.getBoundingClientRect();
    const larg = 22;                                   // largura do puxador
    const util = Math.max(1, r.width - larg);
    return clamp01(((clientX - r.left - larg / 2) / util) * ULT, 0, ULT);
  };
  const comecar = (e) => {
    e.preventDefault(); e.stopPropagation();
    cancelAnimationFrame(frameMola);
    arrastando = true; box.classList.add('pegando');
    amostras = [{ t: performance.now(), v: valor }];
    pintar(ima(valorDoX(e.clientX)));
    const mover = (ev) => {
      const v = ima(valorDoX(ev.clientX));
      const agora = performance.now();
      amostras.push({ t: agora, v });
      amostras = amostras.filter(a => agora - a.t < 90).slice(-5);
      pintar(v);
    };
    const soltar = () => {
      window.removeEventListener('mousemove', mover);
      window.removeEventListener('mouseup', soltar);
      arrastando = false; box.classList.remove('pegando');
      encaixar();
    };
    window.addEventListener('mousemove', mover);
    window.addEventListener('mouseup', soltar);
  };
  shell.addEventListener('mousedown', comecar);
  thumb.addEventListener('keydown', (e) => {
    const alvos = { ArrowLeft: ix - 1, ArrowDown: ix - 1, ArrowRight: ix + 1, ArrowUp: ix + 1, Home: 0, End: ULT };
    if (!(e.key in alvos)) return;
    e.preventDefault(); aplicar(clamp01(alvos[e.key], 0, ULT));
  });
  box.addEventListener('mousedown', e => e.stopPropagation());
  $('.ef-help', box).addEventListener('click', (e) => { e.stopPropagation(); $('.ef-helpwrap', box).classList.toggle('aberto'); });

  /* ---- campo de pixels do último nível, na cor do painel ---- */
  let accent = [110, 168, 254];
  function lerAccent() {
    const c = getComputedStyle(P.el).getPropertyValue('--accent').trim();
    const m = c.match(/#([0-9a-f]{6})/i);
    if (m) accent = [parseInt(m[1].slice(0,2),16), parseInt(m[1].slice(2,4),16), parseInt(m[1].slice(4,6),16)];
  }
  function limparPixels() {
    const ctx = cv.getContext('2d'); if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  }
  function medirCanvas() {
    const r = track.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    return true;
  }
  function desenhar(t) {
    const ctx = cv.getContext('2d'); if (!ctx || !cv.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const L = cv.width / dpr, A = cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, L, A);
    const nivel = ULT ? valor / ULT : 0;          // 0 = apagado, 1 = no talo
    if (nivel <= 0.001) return;
    const forcaNivel = Math.pow(nivel, 0.85);
    const frente = 1 - revelar;
    const cel = L < 240 ? 4 : 5, vao = 1;
    const cols = Math.ceil(L / cel), lins = Math.ceil(A / cel);
    const passado = Math.max(0, t - ultraDesde);
    const fluxoBruto = passado / 4000;
    const fluxo = Math.floor(fluxoBruto) + suave(0, 1, fluxoBruto - Math.floor(fluxoBruto));
    const frio = [58, 58, 62];
    const quente = [Math.min(255, accent[0] + 60), Math.min(255, accent[1] + 60), Math.min(255, accent[2] + 60)];

    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, L, A, 8); ctx.clip();
    for (let li = 0; li < lins; li++) {
      for (let co = 0; co < cols; co++) {
        const x = co * cel, y = li * cel;
        const nx = (x + cel / 2) / L;
        // acende so ate onde o puxador chegou, com a beirada suave
        const ateAqui = 1 - suave(nivel - 0.07, nivel + 0.03, nx);
        if (ateAqui <= 0.002) continue;
        const alfa = suave(frente - 0.1, frente + 0.07, nx) * ateAqui;
        if (alfa <= 0.002) continue;
        const quanto = suave(0.1, 0.9, nx / Math.max(nivel, 0.15));
        const forca = suave(0.04, 0.4, nx / Math.max(nivel, 0.15)) * forcaNivel;
        const h1 = Math.abs(Math.sin(co * 12.9898 + li * 78.233) * 43758.5453) % 1;
        const h2 = Math.abs(Math.sin(co * 7.13 + li * 19.41) * 19341.731) % 1;
        const h3 = Math.abs(Math.sin(co * 31.17 + li * 11.93) * 28437.123) % 1;
        const periodo = 500 + h2 * 1500;
        const tl = passado + h3 * periodo;
        const ciclo = Math.floor(tl / periodo), prog = (tl % periodo) / periodo;
        const hc = Math.abs(Math.sin(co * 17.17 + li * 41.73 + ciclo * 13.11) * 24634.6345) % 1;
        const hl = Math.abs(Math.sin(co * 5.37 + li * 29.11 + ciclo * 7.43) * 17391.443) % 1;
        const centro = 0.2 + hc * 0.55, larg = 0.09 + hl * 0.08;
        const d = (prog - centro) / larg;
        const pulso = Math.exp(-d * d * 1.45) * (hc > 0.12 ? 1 : 0.26);
        const fase = (nx + fluxo + li * 0.06 + h1 * 0.02) * Math.PI * 2;
        const onda = Math.pow(0.5 + 0.5 * Math.cos(fase), 5);
        const brilho = Math.max(pulso * (0.48 + onda * 0.58), onda * (0.38 + h1 * 0.28));
        const base = [entre(frio[0], accent[0], quanto), entre(frio[1], accent[1], quanto), entre(frio[2], accent[2], quanto)];
        const mistura = clamp01(brilho * (0.5 + hc * 0.35), 0, 1);
        ctx.globalAlpha = alfa * forca * clamp01(0.62 + brilho * 0.3, 0, 1);
        ctx.fillStyle = 'rgb(' + Math.round(entre(base[0], quente[0], mistura)) + ' '
          + Math.round(entre(base[1], quente[1], mistura)) + ' '
          + Math.round(entre(base[2], quente[2], mistura)) + ')';
        ctx.fillRect(x + vao / 2, y + vao / 2, cel - vao, cel - vao);
      }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  let ultimoQuadro = 0;
  function loopPixels() {
    if (framePx) return;
    lerAccent();
    if (!medirCanvas()) { setTimeout(loopPixels, 60); return; }
    const passo = (t) => {
      if (!box.isConnected) { framePx = 0; return; }
      if (t - ultimoQuadro >= 33) {
        ultimoQuadro = t;
        revelar = suave(0, 1, (t - ultraDesde) / 900);
        desenhar(t);
      }
      framePx = requestAnimationFrame(passo);
    };
    framePx = requestAnimationFrame(passo);
  }

  pintar(valor);
  cur.textContent = nome(ix);
  ultraDesde = performance.now();
  setTimeout(loopPixels, 30);
  return box;
}

async function trocarEsforco(P, id) {
  // vale só para este painel: conversa nova continua nascendo em EF_NOVO
  P.effort = id; P.ultraAvisado = false;
  if (P.engine === 'claude' && P.started) {
    await window.api.paneStop({ paneId: P.id, engine: P.engine });
    P.started = false; setDot(P, 'off');
  }
  savePanes();
}

function avisoEnvio(P, txt) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'envio-nota';
  d.textContent = txt;
  P.chat.appendChild(d);
  if (P.passosEl) P.chat.appendChild(P.passosEl);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P, true);
  setTimeout(() => d.remove(), 9000);
  return d;
}

function subirNaLista(P) {
  const id = P.sessaoId || P.resumeId;
  const lista = histCache[P.engine];
  if (!id || !lista) return;
  const i = lista.findIndex(s => s.id === id);
  if (i < 0) return;
  lista[i].when = Date.now();
  lista.unshift(lista.splice(i, 1)[0]);
  const aba = $('.side-view[data-view="h' + P.engine + '"]');
  if (aba && !aba.classList.contains('hidden')) paintHist(P.engine, lista);
}

function pintarNome(P) {
  const barra = $('.pane-nome', P.el);
  const t = (P.titulo || '').trim();
  barra.classList.toggle('vazio', !t);
  $('.pn-txt', barra).textContent = t;
  barra.title = t;
}

function renomearAqui(P) {
  const barra = $('.pane-nome', P.el);
  if ($('.pn-input', barra)) return;
  const txt = $('.pn-txt', barra), lapis = $('.pn-edit', barra);
  const inp = document.createElement('input');
  inp.className = 'pn-input';
  inp.value = P.titulo || '';
  txt.style.display = 'none'; lapis.style.display = 'none';
  barra.insertBefore(inp, txt);
  inp.focus(); inp.select();
  let pronto = false;
  const fim = async (salvar) => {
    if (pronto) return; pronto = true;
    const novo = inp.value.trim();
    inp.remove(); txt.style.display = ''; lapis.style.display = '';
    if (salvar && novo && novo !== P.titulo) {
      P.titulo = novo; P.nomeManual = true; pintarNome(P); savePanes();
      const id = P.sessaoId || P.resumeId;
      if (id) { await window.api.renomear({ engine: P.engine, id, nome: novo });
        histCache[P.engine] = null;
        const aba = $('.side-view[data-view="h' + P.engine + '"]');
        if (aba && !aba.classList.contains('hidden')) loadHist(P.engine, true); }
    }
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); fim(true); }
    if (e.key === 'Escape') { e.stopPropagation(); fim(false); }
  });
  inp.addEventListener('blur', () => fim(true));
}

async function buscarNome(P) {
  if (P.engine !== 'claude' || !P.sessaoId || P.nomeManual) return;
  const t = await window.api.sessionTitulo({ engine: 'claude', file: P.sessaoFile, id: P.sessaoId });
  if (t && t !== P.titulo) { P.titulo = t; pintarNome(P); savePanes(); }
}

function pintarModo(P) {
  const m = modoDe(P);
  P.mode = m.id;
  $('.modo-ic', P.el).innerHTML = ico(m.ic);
  $('.modo-nome', P.el).textContent = m.nome;
}

function fecharMenus() {
  for (const P of panes.values()) {
    const m = $('.p-modal', P.el);
    if (m && m.classList.contains('como-menu')) { m.classList.add('hidden'); m.classList.remove('como-menu'); $('.modal-cx', m).innerHTML = ''; }
  }
}
document.addEventListener('click', fecharMenus);

// link de site sempre abre no navegador do Mac, nunca dentro do app
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (a.classList.contains('arquivo') || href.startsWith('#')) return;
  e.preventDefault(); e.stopPropagation();
  if (/^https?:\/\//i.test(href)) window.api.abrirLink(href);
  else if (href.startsWith('file://')) window.api.abrirLink(decodeURIComponent(href.replace('file://', '')));
  else if (href.startsWith('/')) window.api.abrirLink(href);
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // dentro do terminal embutido, Esc é do terminal, não fecha a janelinha
  const dentroTerm = document.activeElement && document.activeElement.closest && document.activeElement.closest('.term-wrap');
  if (dentroTerm) return;
  const visorAberto = [...panes.values()].some(P => !$('.p-visor', P.el).classList.contains('hidden'));
  if (visorAberto) { fecharVisor(); return; }
  const popupAberto = [...panes.values()].some(P => !$('.p-modal', P.el).classList.contains('hidden'));
  if (popupAberto) { fecharMenus(); for (const P of panes.values()) fecharModal(P); return; }
  // sem popup: para o que a IA estiver fazendo
  const alvo = (focusPane && focusPane.busy) ? [focusPane] : [...panes.values()].filter(P => P.busy);
  for (const P of alvo) window.api.paneInterrupt({ paneId: P.id, engine: P.engine });
});

function novoMenu(P) {
  fecharMenus();
  const modal = $('.p-modal', P.el);
  modal.classList.remove('hidden');
  modal.classList.add('como-menu');
  modal.onclick = (e) => { if (e.target === modal) fecharMenus(); };
  const cx = $('.modal-cx', modal);
  cx.className = 'modal-cx';
  cx.innerHTML = '';
  cx.onclick = (e) => e.stopPropagation();
  return cx;
}
function elItem({ ic, nome, desc, tag, on }, aoClicar) {
  const d = document.createElement('div');
  d.className = 'mi' + (on ? ' on' : '');
  d.innerHTML = '<div class="mi-ic"></div><div class="mi-txt"><div class="mi-n"></div></div>'
    + (on ? '<div class="mi-ck">' + ico('check') + '</div>' : (tag ? '<div class="mi-tag"></div>' : ''));
  $('.mi-ic', d).innerHTML = ic ? (ICONES[ic] ? ico(ic) : '<span class="ic-txt">' + ic + '</span>') : '';
  $('.mi-n', d).textContent = nome;
  if (desc) { const e = document.createElement('div'); e.className = 'mi-d'; e.textContent = desc; $('.mi-txt', d).appendChild(e); }
  if (tag && !on) $('.mi-tag', d).textContent = tag;
  d.addEventListener('click', () => { fecharMenus(); aoClicar && aoClicar(); });
  return d;
}
function subPopup(txt) {
  const d = document.createElement('div');
  d.className = 'mo-sub';
  d.textContent = txt;
  return d;
}
function tituloPopup(txt, dica) {
  const d = document.createElement('div');
  d.className = 'mo-top';
  d.innerHTML = '<span class="mo-tit"></span><button class="mo-x">' + ico('x') + '</button>';
  $('.mo-tit', d).textContent = txt;
  $('.mo-x', d).onclick = () => fecharMenus();
  if (dica) { const e = document.createElement('div'); e.className = 'mo-sub'; e.textContent = dica; d.dataset.temSub = '1'; }
  return d;
}
function elSecao(txt) { const d = document.createElement('div'); d.className = 'menu-secao'; d.textContent = txt; return d; }
function elLinha() { const d = document.createElement('div'); d.className = 'menu-linha'; return d; }

/* ---- menu de Modos + barrinha de esforço ---- */
function menuModos(P) {
  const m = novoMenu(P);
  m.appendChild(tituloPopup('Modos'));
  m.appendChild(subPopup('O que ele pode fazer sem te perguntar.'));

  for (const mo of MODOS[P.engine]) {
    m.appendChild(elItem({ ic: mo.ic, nome: mo.nome, desc: mo.desc, on: mo.id === P.mode }, async () => {
      P.mode = mo.id; cfg.defMode = mo.id; window.api.setConfig(cfg); pintarModo(P);
      await window.api.paneStop({ paneId: P.id, engine: P.engine });
      P.started = false; setDot(P, 'off');
      note(P, 'Modo: ' + mo.nome + ' — ' + mo.desc.toLowerCase() + '.');
      savePanes();
    }));
  }
  m.appendChild(elLinha());

  m.appendChild(barraEsforco(P));
}

/* ---- menu de modelos (no cabeçalho) ---- */
async function menuModelos(P) {
  const m = novoMenu(P);
  const pintar = () => {
    m.innerHTML = '';
    m.appendChild(tituloPopup('Modelo'));
    m.appendChild(subPopup('Qual cérebro este painel vai usar, e quanto ele deve pensar.'));
    for (const mo of modelosDe(P)) {
      m.appendChild(elItem({ nome: mo.nome, desc: mo.desc, on: mo.id === P.model }, async () => {
        P.model = mo.id;
        const ef = esforcosDe(P);
        if (!ef.find(e => e.id === P.effort)) P.effort = mo.padraoEffort || ef[0].id;
        fillModels(P);
        await window.api.paneStop({ paneId: P.id, engine: P.engine });
        P.started = false; setDot(P, 'off'); savePanes();
      }));
    }
    m.appendChild(elLinha());
    m.appendChild(barraEsforco(P));
  };
  pintar();
  if (P.engine === 'codex' && !MODELOS_CODEX) {
    MODELOS_CODEX = (await window.api.codexModels()) || null;
    if (MODELOS_CODEX && MODELOS_CODEX.length) { fillModels(P); pintar(); }
  }
}

/* ---- menu do + ---- */
function menuAnexo(P) {
  const m = novoMenu(P);
  m.appendChild(tituloPopup('Anexar'));
  m.appendChild(subPopup('Manda o caminho do arquivo junto com a sua mensagem.'));
  const itens = [
    { ic: 'upload', nome: 'Enviar do computador', desc: 'escolher arquivos', act: 'file' },
    { ic: 'image', nome: 'Enviar imagem', desc: 'png, jpg, webp', act: 'image' },
    { ic: 'folder', nome: 'Adicionar pasta', desc: 'manda o caminho da pasta', act: 'folder' },
    { ic: 'map-pin', nome: 'Pasta deste painel', desc: shortPath(P.cwd), act: 'cwd' },
  ];
  for (const i of itens) m.appendChild(elItem(i, async () => {
    if (i.act === 'cwd') return inserirNoInput(P, P.cwd);
    const files = await window.api.pickFiles(i.act);
    if (files && files.length) {
      if (i.act === 'folder') inserirNoInput(P, files.join(' '));
      else await anexar(P, files);
    }
  }));
}

/* ---- menu do / (ações, modelo e comandos) ---- */
async function menuSkills(P, filtroInicial, focar) {
  const m = novoMenu(P);
  m.appendChild(tituloPopup('Ações e comandos'));
  const busca = document.createElement('input');
  busca.className = 'menu-search';
  busca.placeholder = 'Filtrar ações…';
  m.appendChild(busca);
  const corpo = document.createElement('div');
  m.appendChild(corpo);

  const acoes = [
    { sec: 'Contexto', ic: 'upload', nome: 'Anexar arquivo…', act: () => menuAnexo(P) },
    { sec: 'Contexto', ic: 'folder', nome: 'Mencionar a pasta deste painel', act: () => inserirNoInput(P, P.cwd) },
    { sec: 'Contexto', ic: 'eraser', nome: 'Limpar a tela', desc: 'a conversa continua', act: () => { P.chat.innerHTML = ''; P.blocks.clear(); P.tools.clear(); } },
    { sec: 'Contexto', ic: 'sparkles', nome: 'Começar conversa nova', act: () => novaConversa(P.engine) },
    { sec: 'Modelo', ic: 'brain', nome: 'Trocar modelo…', tag: modeloAtual(P).nome, act: () => menuModelos(P) },
    { sec: 'Modelo', ic: 'sliders-horizontal', nome: 'Esforço', tag: EF_PT[P.effort] || P.effort, act: () => menuModelos(P) },
    { sec: 'Modelo', ic: 'lock', nome: 'Modos de permissão', tag: modoDe(P).nome, act: () => menuModos(P) },
    { sec: 'Modelo', ic: 'arrow-left-right', nome: 'Trocar de motor', tag: P.engine === 'codex' ? 'Codex' : 'Claude', desc: 'continua a mesma conversa com o outro', act: () => trocarMotor(P, P.engine === 'codex' ? 'claude' : 'codex') },
    { sec: 'Painel', ic: 'folder-open', nome: 'Trocar a pasta deste painel', tag: nomePasta(P.cwd), act: () => $('.p-cwd', P.el).click() },
    { sec: 'Painel', ic: 'plus', nome: 'Abrir outro painel ao lado', act: () => { if (panes.size < 12) newPane({ engine: P.engine, cwd: P.cwd }); } },
    { sec: 'Conectores', ic: 'plug', nome: 'conectores', desc: 'ver, reconectar ou adicionar um conector', act: () => janelaConectores(P) },
    { sec: 'Painel', ic: 'terminal', nome: 'terminal', desc: 'rodar comandos aqui dentro, sem abrir o Terminal do Mac', act: () => janelaTerminal(P, 'cd ' + JSON.stringify(P.cwd) + ' 2>/dev/null; exec ${SHELL:-/bin/zsh} -l', 'Terminal — ' + nomePasta(P.cwd)) },
    { sec: 'Conta', ic: 'key-round', nome: 'login', desc: 'trocar a conta ' + (P.engine === 'codex' ? 'do Codex' : 'do Claude'), act: () => contaAcao(P, 'login') },
    { sec: 'Conta', ic: 'log-out', nome: 'logout', desc: 'sair da conta atual', act: () => contaAcao(P, 'logout') },
    { sec: 'Conta', ic: 'user', nome: 'conta', desc: 'quem está entrado e quanto do limite já foi', act: () => janelaConta(P) },
  ];

  let skills = [];
  const pintar = (f) => {
    corpo.innerHTML = '';
    const q = (f || '').toLowerCase().replace(/^\//, '');
    let secAtual = '';
    for (const a of acoes) {
      if (q && !a.nome.toLowerCase().includes(q)) continue;
      if (a.sec !== secAtual) { secAtual = a.sec; corpo.appendChild(elSecao(a.sec)); }
      corpo.appendChild(elItem(a, () => {
        const inp = $('.p-input', P.el);
        if (inp.value.startsWith('/') && !inp.value.includes(' ')) { inp.value = ''; inp.style.height = 'auto'; }
        a.act();
      }));
    }
    // quem bate no nome vem antes de quem so bate na descricao
    const porNome = skills.filter(sk => q && sk.name.toLowerCase().includes(q));
    const porDesc = q ? skills.filter(sk => !sk.name.toLowerCase().includes(q) && (sk.desc || '').toLowerCase().includes(q)) : skills;
    const vis = (q ? [...porNome, ...porDesc] : skills).slice(0, 150);
    if (vis.length) {
      corpo.appendChild(elSecao('Comandos e skills' + (skills.length ? ' (' + skills.length + ')' : '')));
      for (const sk of vis) corpo.appendChild(elItem({ ic: '/', nome: sk.name, desc: sk.desc }, () => {
        const inp = $('.p-input', P.el);
        if (inp.value.startsWith('/') && !inp.value.includes(' ')) inp.value = '';
        inserirNoInput(P, '/' + sk.name);
      }));
    } else if (!corpo.children.length) {
      corpo.innerHTML = '<div class="menu-empty">Nada encontrado.</div>';
    }
  };
  busca.value = filtroInicial || '';
  pintar(busca.value);
  busca.addEventListener('input', () => pintar(busca.value));
  if (filtroInicial === undefined || focar) setTimeout(() => { busca.focus(); busca.setSelectionRange(busca.value.length, busca.value.length); }, 30);
  skills = (await window.api.skills(P.engine)) || [];
  pintar(busca.value);
}

/* ---- janelinha de conectores, no meio da conversa ---- */
const nomeLimpo = (n) => String(n || '').replace(/^claude\.ai\s+/i, '').replace(/^mcp[-_ ]/i, '').trim();

function fecharModal(P) {
  const m = $('.p-modal', P.el);
  m.classList.add('hidden'); $('.modal-cx', m).innerHTML = '';
}

async function janelaConectores(P) {
  fecharMenus();
  const modal = $('.p-modal', P.el);
  const cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  modal.onclick = (e) => { if (e.target === modal) fecharModal(P); };
  cx.onclick = (e) => e.stopPropagation();

  const motor = P.engine === 'codex' ? 'Codex' : 'Claude';
  const cabeca = () =>
    '<div class="mo-top"><span class="mo-tit">Conectores</span><button class="mo-x">' + ico('x') + '</button></div>'
    + '<div class="mo-sub">Serviços ligados ao ' + motor + ' neste Mac.</div>';

  cx.innerHTML = cabeca() + '<div class="mo-carregando">Verificando conectores…</div>';
  $('.mo-x', cx).onclick = () => fecharModal(P);

  const lista = await window.api.mcpList(P.engine);
  if (!modal || modal.classList.contains('hidden')) return;

  if (lista && lista.error) {
    cx.innerHTML = cabeca() + '<div class="mo-erro">' + lista.error + '</div>';
    $('.mo-x', cx).onclick = () => fecharModal(P);
    return;
  }

  const pintar = (arr) => {
    const linhas = arr.map((c, i) => {
      const classe = c.precisaEntrar ? 'falta' : (c.ligado ? 'ok' : 'off');
      return '<div class="co" data-i="' + i + '">'
        + '<span class="co-pt ' + classe + '"></span>'
        + '<span class="co-txt"><span class="co-n"></span><span class="co-s"></span></span>'
        + '<button class="co-bt ' + (c.precisaEntrar ? 'destaque' : 'some') + '" data-ac="login">'
        + (c.precisaEntrar ? 'Entrar' : 'Reconectar') + '</button>'
        + '<button class="co-bt some" data-ac="remove">Tirar</button>'
        + '</div>';
    }).join('');
    cx.innerHTML = cabeca()
      + '<div class="mo-lista">' + (linhas || '<div class="mo-carregando">Nenhum conector ainda.</div>') + '</div>'
      + '<div class="mo-rodape"><button class="mo-btn destaque" id="btAdd">Adicionar conector</button>'
      + '<button class="mo-btn" id="btRe">Atualizar</button></div>';
    $('.mo-x', cx).onclick = () => fecharModal(P);
    $$('.co', cx).forEach((el) => {
      const c = arr[Number(el.dataset.i)];
      $('.co-n', el).textContent = nomeLimpo(c.nome);
      $('.co-s', el).textContent = c.precisaEntrar ? 'precisa entrar' : c.status;
      el.title = c.nome + (c.alvo ? '\n' + c.alvo : '');
      $$('.co-bt', el).forEach(bt => bt.onclick = async () => {
        const ac = bt.dataset.ac;
        if (ac === 'remove' && !confirm('Tirar o conector "' + c.nome + '" do ' + motor + '?')) return;
        bt.textContent = '…';
        const r = await window.api.mcpAcao({ engine: P.engine, acao: ac, nome: c.nome });
        if (r && r.error) { bt.textContent = 'erro'; alert(r.error); return; }
        if (r && r.terminal) janelaTerminal(P, r.terminal, r.titulo || nomeLimpo(c.nome), () => janelaConectores(P));
        else janelaConectores(P);
      });
    });
    $('#btRe', cx).onclick = () => janelaConectores(P);
    $('#btAdd', cx).onclick = () => formConector(P);
  };
  pintar(lista || []);
}

function formConector(P) {
  const cx = $('.p-modal .modal-cx', P.el);
  const motor = P.engine === 'codex' ? 'Codex' : 'Claude';
  cx.innerHTML =
    '<div class="mo-top"><span class="mo-tit">Adicionar conector</span><button class="mo-x">' + ico('x') + '</button></div>'
    + '<div class="mo-sub">Cole o endereço que o serviço te deu. Se for um programa que roda aqui no Mac, use o campo de baixo.</div>'
    + '<div class="mo-form">'
    + '<input id="cnNome" placeholder="Nome curto, ex: notion">'
    + '<input id="cnUrl" placeholder="Endereço, ex: https://mcp.notion.com/mcp">'
    + '<div class="mo-dica">ou, se for um programa local:</div>'
    + '<input id="cnCmd" placeholder="Comando, ex: npx -y @alguem/mcp-server">'
    + '</div>'
    + '<div class="mo-erro" id="cnErro" style="display:none"></div>'
    + '<div class="mo-rodape"><button class="mo-btn destaque" id="cnOk">Adicionar no ' + motor + '</button>'
    + '<button class="mo-btn" id="cnVolta">Voltar</button></div>';
  $('.mo-x', cx).onclick = () => fecharModal(P);
  $('#cnVolta', cx).onclick = () => janelaConectores(P);
  setTimeout(() => $('#cnNome', cx).focus(), 40);
  $('#cnOk', cx).onclick = async () => {
    const nome = $('#cnNome', cx).value.trim();
    const url = $('#cnUrl', cx).value.trim();
    const comando = $('#cnCmd', cx).value.trim();
    const erro = $('#cnErro', cx);
    if (!nome || (!url && !comando)) { erro.style.display = 'block'; erro.textContent = 'Preciso do nome e do endereço (ou do comando).'; return; }
    $('#cnOk', cx).textContent = 'adicionando…';
    const r = await window.api.mcpAcao({ engine: P.engine, acao: 'add', nome, url, comando });
    if (r && r.error) { erro.style.display = 'block'; erro.textContent = r.error; $('#cnOk', cx).textContent = 'Tentar de novo'; return; }
    fecharModal(P);
    avisoTemp(P, 'Conector "' + nome + '" adicionado. Vale na próxima conversa deste painel.');
    await window.api.paneStop({ paneId: P.id, engine: P.engine });
    P.started = false; setDot(P, 'off');
  };
}

/* ---- terminal embutido: roda o comando aqui dentro, sem abrir o Terminal do Mac ---- */
let termSeq = 0;
const termsVivos = new Map();
const REG_LINK = /https?:\/\/[^\s"'<>)\]]+/g;

window.api.onTermEvent(({ id, kind, data, code }) => {
  const t = termsVivos.get(id);
  if (!t) return;
  if (kind === 'data') { t.term.write(data); t.viu(data); }
  if (kind === 'exit') {
    t.vivo = false;
    t.term.write('\r\n\x1b[90m— terminou' + (code ? ' (código ' + code + ')' : ', tudo certo') + ' —\x1b[0m\r\n');
  }
});

function janelaTerminal(P, linha, titulo, aoFechar) {
  fecharMenus();
  const modal = $('.p-modal', P.el), cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  cx.className = 'modal-cx cx-term';
  cx.onclick = (e) => e.stopPropagation();

  const id = 't' + (++termSeq);
  cx.innerHTML =
    '<div class="mo-top"><span class="mo-tit"></span><button class="mo-x">' + ico('x') + '</button></div>'
    + '<div class="mo-sub">Rodando aqui dentro do Cockpit. Se pedir para escolher ou colar algo, clique na tela preta e digite.</div>'
    + '<div class="term-wrap"><div class="term-tela"></div></div>'
    + '<div class="term-link"><span class="mono"></span><button>Abrir link</button></div>'
    + '<div class="mo-rodape"><button class="mo-btn" id="tmCancela">Cancelar</button>'
    + '<button class="mo-btn destaque" id="tmFecha">Fechar</button></div>';
  $('.mo-tit', cx).textContent = titulo || 'Terminal';

  const term = new Terminal({
    cols: 92, rows: 22, fontSize: 12, lineHeight: 1.25, cursorBlink: true, scrollback: 4000,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    theme: { background: '#141416', foreground: '#dcdcdc', cursor: '#d8bd8a', selectionBackground: '#ffffff30' },
  });
  term.open($('.term-tela', cx));
  term.onData((d) => window.api.termInput({ id, data: d }));

  const elLink = $('.term-link', cx), txtLink = $('.mono', elLink);
  const reg = {
    term, buf: '', vivo: true,
    viu(d) {
      this.buf = (this.buf + d).slice(-8000);
      const achou = this.buf.match(REG_LINK);
      if (!achou) return;
      const u = achou[achou.length - 1].replace(/[.,;]+$/, '');
      if (txtLink.textContent === u) return;
      txtLink.textContent = u; elLink.classList.add('ver');
    },
  };
  termsVivos.set(id, reg);
  $('button', elLink).onclick = () => window.api.openUrl(txtLink.textContent);

  const fechar = () => {
    window.api.termKill({ id });
    try { term.dispose(); } catch {}
    termsVivos.delete(id);
    cx.className = 'modal-cx';
    fecharModal(P);
    aoFechar && aoFechar();
  };
  modal.onclick = (e) => { if (e.target === modal) fechar(); };
  $('.mo-x', cx).onclick = fechar;
  $('#tmFecha', cx).onclick = fechar;
  $('#tmCancela', cx).onclick = () => { window.api.termInput({ id, data: '\x03' }); term.focus(); };

  window.api.termRun({ id, linha, cols: 92, rows: 22 }).then((r) => {
    if (r && r.error) term.write('\r\n\x1b[31m[não consegui rodar: ' + r.error + ']\x1b[0m\r\n');
  });
  setTimeout(() => term.focus(), 60);
}

async function janelaConta(P) {
  fecharMenus();
  const modal = $('.p-modal', P.el), cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  modal.onclick = (e) => { if (e.target === modal) fecharModal(P); };
  cx.onclick = (e) => e.stopPropagation();
  const motor = P.engine === 'codex' ? 'Codex' : 'Claude';
  const topo = '<div class="mo-top"><span class="mo-tit">Conta do ' + motor + '</span>'
    + '<button class="mo-x">' + ico('x') + '</button></div>';
  cx.innerHTML = topo + '<div class="mo-carregando">Vendo a conta e o quanto já foi usado…</div>';
  $('.mo-x', cx).onclick = () => fecharModal(P);

  const c = await window.api.contaLer(P.engine);
  if (modal.classList.contains('hidden')) return;
  if (!c || !c.entrou) {
    cx.innerHTML = topo + '<div class="mo-sub">Você não está entrado no ' + motor + ' neste Mac.</div>'
      + '<div class="mo-rodape"><button class="mo-btn destaque" id="ctEntrar">Entrar</button></div>';
    $('.mo-x', cx).onclick = () => fecharModal(P);
    $('#ctEntrar', cx).onclick = () => { fecharModal(P); contaAcao(P, 'login'); };
    return;
  }

  const barra = (titulo, j) => {
    if (!j) return '';
    const pct = Math.min(100, Math.max(0, j.pct || 0));
    const cor = pct >= 90 ? 'perto' : pct >= 70 ? 'meio' : '';
    return '<div class="us">'
      + '<div class="us-top"><span>' + titulo + '</span><b>' + pct + '%</b></div>'
      + '<div class="us-bar"><span class="us-fill ' + cor + '" style="width:' + pct + '%"></span></div>'
      + '<div class="us-pe">' + (j.reseta ? 'zera ' + quandoFuturo(j.reseta) : 'sem prazo informado') + '</div>'
      + '</div>';
  };

  const extra = c.extra && c.extra.teto
    ? '<div class="us-extra">' + (c.extra.ligado
        ? 'Crédito extra ligado: ' + c.extra.usado + ' de ' + c.extra.teto + ' ' + c.extra.moeda
        : 'Crédito extra desligado') + '</div>'
    : '';

  cx.innerHTML = topo
    + '<div class="ct-cab"><div class="ct-av"></div><div class="ct-txt">'
    + '<div class="ct-n"></div><div class="ct-e"></div></div>'
    + (c.plano ? '<span class="ct-plano"></span>' : '') + '</div>'
    + '<div class="mo-sub" style="margin-top:12px">Limite de uso</div>'
    + (c.sessao ? barra('Sessão de agora', c.sessao)
       : '<div class="us"><div class="us-top"><span>Sessão de agora</span><b>—</b></div>'
         + '<div class="us-pe">sem uso registrado na janela curta agora</div></div>')
    + barra('Semana', c.semana)
    + (!c.sessao && !c.semana ? '<div class="mo-sub">Não consegui ler o limite agora.</div>' : '')
    + extra
    + '<div class="mo-rodape"><button class="mo-btn" id="ctTrocar">Trocar de conta</button>'
    + '<button class="mo-btn" id="ctSair">Sair</button></div>';

  $('.mo-x', cx).onclick = () => fecharModal(P);
  $('.ct-av', cx).innerHTML = svgMotor(P.engine);
  $('.ct-n', cx).textContent = c.nome || c.email;
  $('.ct-e', cx).textContent = c.email + (c.via ? '  ·  ' + c.via : '');
  if (c.plano) $('.ct-plano', cx).textContent = c.plano;
  $('#ctTrocar', cx).onclick = () => { fecharModal(P); contaAcao(P, 'login'); };
  $('#ctSair', cx).onclick = () => { fecharModal(P); contaAcao(P, 'logout'); };
}

function quandoFuturo(ms) {
  const d = ms - Date.now();
  if (d <= 0) return 'já zerou';
  const min = Math.round(d / 60000);
  if (min < 60) return 'em ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return 'em ' + h + 'h';
  const dias = Math.round(h / 24);
  return 'em ' + dias + (dias === 1 ? ' dia' : ' dias');
}

async function contaAcao(P, acao) {
  const r = await window.api.auth({ engine: P.engine, acao });
  if (!r) return;
  if (r.error) return note(P, 'Não consegui: ' + r.error, true);
  if (acao === 'status') { avisoTemp(P, (r.texto || 'sem resposta').split('\n').slice(0, 4).join(' · ')); return; }
  if (r.terminal) {
    janelaTerminal(P, r.terminal, r.titulo || 'Conta', async () => {
      avisoTemp(P, 'Pronto. Mande uma mensagem para o painel começar de novo com a conta certa.');
      await window.api.paneStop({ paneId: P.id, engine: P.engine });
      P.started = false; setDot(P, 'off');
    });
  }
}

function avisoTemp(P, texto) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'note'; d.textContent = texto;
  P.chat.appendChild(d); scroll(P, true);
  setTimeout(() => d.remove(), 12000);
}

const IMG_EXT = ['png','jpg','jpeg','gif','webp','bmp','heic','svg'];
const TIPO_ICO = (ext) => {
  if (IMG_EXT.includes(ext)) return 'image';
  if (['pdf','doc','docx','txt','md','rtf','pages'].includes(ext)) return 'file-text';
  if (['mp3','wav','m4a','ogg','aac','flac'].includes(ext)) return 'file';
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return 'file';
  if (['js','ts','py','html','css','json','sh','yml','yaml'].includes(ext)) return 'file-code';
  return 'file';
};
const tamanhoBonito = (b) => {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB';
  return (b / 1024 / 1024).toFixed(1) + ' MB';
};

async function anexar(P, caminhos) {
  for (const c of caminhos) {
    if (P.anexos.some(a => a.path === c)) continue;
    const a = await window.api.anexoLer(c);
    if (a) P.anexos.push(a);
  }
  pintarAnexos(P);
}

function fichaAnexo(a, comX, aoTirar, P) {
  const d = document.createElement('div');
  d.className = 'anx' + (P ? ' clicavel' : '');
  if (P) d.onclick = (e) => { if (!e.target.closest('.anx-x')) verArquivo(P, a.path); };
  d.title = a.path;
  d.innerHTML = '<div class="anx-mini"></div><div class="anx-txt">'
    + '<span class="anx-n"></span><span class="anx-s"></span></div>'
    + (comX ? '<button class="anx-x">' + ico('x') + '</button>' : '');
  const mini = $('.anx-mini', d);
  if (a.mini) { const img = document.createElement('img'); img.src = a.mini; mini.appendChild(img); }
  else mini.innerHTML = ico(TIPO_ICO(a.ext || ''));
  $('.anx-n', d).textContent = a.nome;
  $('.anx-s', d).textContent = [(a.ext || '').toUpperCase(), tamanhoBonito(a.bytes)].filter(Boolean).join(' · ');
  if (comX) $('.anx-x', d).onclick = () => aoTirar(a);
  return d;
}

function pintarAnexos(P) {
  const barra = $('.p-anexos', P.el);
  barra.innerHTML = '';
  barra.classList.toggle('hidden', !P.anexos.length);
  for (const a of P.anexos) {
    barra.appendChild(fichaAnexo(a, true, (x) => {
      P.anexos = P.anexos.filter(y => y.path !== x.path);
      pintarAnexos(P);
    }));
  }
}

function inserirNoInput(P, txt) {
  const inp = $('.p-input', P.el);
  const sep = inp.value && !inp.value.endsWith(' ') ? ' ' : '';
  inp.value += sep + txt;
  inp.focus();
  inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 190) + 'px';
}

/* ============ visualizador de arquivo ============ */
function fecharVisor() { $$('.p-visor').forEach(v => { v.classList.add('hidden'); $('.visor-corpo', v).innerHTML = ''; }); }

async function verArquivo(P, caminho) {
  const v = $('.p-visor', P.el);
  const corpo = $('.visor-corpo', v);
  v.classList.remove('hidden');
  v.onclick = (e) => { if (e.target === v) fecharVisor(); };
  $('.visor-nome', v).textContent = caminho.split('/').pop();
  $('.visor-x', v).innerHTML = ico('x');
  $('.visor-x', v).onclick = fecharVisor;
  $('.visor-abrir', v).innerHTML = ico('upload');
  $('.visor-abrir', v).onclick = () => window.api.openPath(caminho);
  corpo.innerHTML = '<div class="visor-vazio">abrindo…</div>';

  const a = await window.api.verArquivo(caminho);
  if (!a || a.erro) { corpo.innerHTML = '<div class="visor-vazio">Não consegui abrir.<br>' + ((a && a.erro) || '') + '</div>'; return; }
  $('.visor-nome', v).textContent = a.nome + '  ·  ' + tamanhoBonito(a.bytes);
  if (a.tipo === 'imagem') { corpo.innerHTML = ''; const i = document.createElement('img'); i.src = a.dados; corpo.appendChild(i); }
  else if (a.tipo === 'texto') { corpo.innerHTML = '<pre></pre>'; $('pre', corpo).textContent = a.dados; }
  else corpo.innerHTML = '<div class="visor-vazio">Este tipo não abre aqui dentro.<br>Use o botão do canto para abrir no Mac.</div>';
}

/* ============ conversas recentes ============ */
const histCache = { claude: null, codex: null };

function grupoDoTempo(ms) {
  if (!ms) return 'Sem data';
  const agora = new Date();
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const d = ms;
  if (d >= hoje) return 'Hoje';
  if (d >= hoje - 86400000) return 'Ontem';
  if (d >= hoje - 7 * 86400000) return 'Últimos 7 dias';
  if (d >= hoje - 30 * 86400000) return 'Últimos 30 dias';
  const dt = new Date(d);
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  return meses[dt.getMonth()] + (dt.getFullYear() !== agora.getFullYear() ? ' de ' + dt.getFullYear() : '');
}

function quando(ms) {
  if (!ms) return '';
  const d = Math.max(0, Date.now() - ms);
  const min = Math.round(d / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return h + 'h';
  const dias = Math.round(h / 24);
  return dias + (dias === 1 ? ' dia' : ' dias');
}

async function loadHist(engine, force) {
  const box = $(engine === 'claude' ? '#histClaude' : '#histCodex');
  if (histCache[engine]) paintHist(engine, histCache[engine]);   // mostra o que ja tem
  else box.innerHTML = '<div class="hist-load">Carregando…</div>';
  const r = engine === 'claude' ? await window.api.sessionsClaude(!!cfg.verRobos) : await window.api.sessionsCodex(!!cfg.verRobos);
  if (r && r.error) { box.innerHTML = '<div class="hist-load">Não consegui ler: ' + r.error + '</div>'; return; }
  histCache[engine] = r || [];
  paintHist(engine, histCache[engine]);
}

const buscaAtual = { claude: '', codex: '' };

const chaveFav = (s) => s.engine + ':' + s.id;
const ehFavorita = (s) => Array.isArray(cfg.favoritos) && cfg.favoritos.includes(chaveFav(s));
function trocarFavorita(s) {
  if (!Array.isArray(cfg.favoritos)) cfg.favoritos = [];
  const k = chaveFav(s);
  const i = cfg.favoritos.indexOf(k);
  if (i >= 0) cfg.favoritos.splice(i, 1); else cfg.favoritos.unshift(k);
  window.api.setConfig(cfg);
}

function marcarTermo(el, texto, termo) {
  el.textContent = '';
  const i = termo ? texto.toLowerCase().indexOf(termo) : -1;
  if (i < 0) { el.textContent = texto; return; }
  el.appendChild(document.createTextNode(texto.slice(0, i)));
  const m = document.createElement('span'); m.className = 'hi-marca';
  m.textContent = texto.slice(i, i + termo.length);
  el.appendChild(m);
  el.appendChild(document.createTextNode(texto.slice(i + termo.length)));
}

function linhaConversa(s, termo, trecho) {
  const d = document.createElement('div');
  d.className = 'hist-item' + (trecho ? ' com-trecho' : '');
  d.innerHTML = '<span class="hi-w"></span><span class="hi-t"></span>'
    + (trecho ? '<span class="hi-trecho"></span>' : '')
    + '<button class="hi-fav" title="Deixar no topo"></button>'
    + '<button class="hi-edit" title="Renomear"></button>';
  marcarTermo($('.hi-t', d), s.title, trecho ? '' : termo);
  $('.hi-w', d).textContent = quando(s.when);
  if (trecho) marcarTermo($('.hi-trecho', d), trecho, termo);
  $('.hi-edit', d).innerHTML = ico('pencil');
  const favorita = ehFavorita(s);
  const bf = $('.hi-fav', d);
  bf.innerHTML = ico('star');
  bf.classList.toggle('on', favorita);
  bf.title = favorita ? 'Tirar do topo' : 'Deixar no topo';
  d.classList.toggle('favorita', favorita);
  bf.addEventListener('click', async (e) => {
    e.stopPropagation();
    trocarFavorita(s);
    histCache[s.engine] && paintHist(s.engine, histCache[s.engine]);
  });
  d.title = s.title + '\n' + s.cwd;
  d.addEventListener('click', (e) => { if (!e.target.closest('.hi-edit')) openSession(s, d); });
  $('.hi-edit', d).addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('.pn-input', d)) return;
    const alvo = $('.hi-t', d), lapis = $('.hi-edit', d);
    const inp = document.createElement('input');
    inp.className = 'pn-input';
    inp.value = s.title;
    alvo.style.display = 'none'; lapis.style.display = 'none';
    d.insertBefore(inp, alvo);
    inp.focus(); inp.select();
    let pronto = false;
    const fim = async (salvar) => {
      if (pronto) return; pronto = true;
      const novo = inp.value.trim();
      inp.remove(); alvo.style.display = ''; lapis.style.display = '';
      if (!salvar || !novo || novo === s.title) return;
      await window.api.renomear({ engine: s.engine, id: s.id, nome: novo });
      s.title = novo;
      alvo.textContent = novo;
      d.title = novo + '\n' + s.cwd;
      histCache[s.engine] = null;
      for (const P of panes.values()) if (P.resumeId === s.id || P.sessaoId === s.id) { P.titulo = novo; P.nomeManual = true; pintarNome(P); }
    };
    inp.onclick = (ev) => ev.stopPropagation();
    inp.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); fim(true); }
      if (ev.key === 'Escape') fim(false);
    });
    inp.addEventListener('blur', () => fim(true));
  });
  return d;
}

async function paintHist(engine, list) {
  const box = $(engine === 'claude' ? '#histClaude' : '#histCodex');
  const termo = (buscaAtual[engine] || '').toLowerCase().trim();
  box.innerHTML = '';
  if (!list.length) { box.innerHTML = '<div class="hist-load">Nenhuma conversa ainda.</div>'; return; }

  if (!termo) {
    const favs = list.filter(ehFavorita);
    if (favs.length) {
      box.appendChild(Object.assign(document.createElement('div'), { className: 'hist-cab', textContent: 'Favoritas' }));
      for (const s of favs) box.appendChild(linhaConversa(s, ''));
    }
    const restantes = list.filter(s => !ehFavorita(s));
    let grupoAtual = '';
    for (const s of restantes) {
      const g = grupoDoTempo(s.when);
      if (g !== grupoAtual) {
        grupoAtual = g;
        box.appendChild(Object.assign(document.createElement('div'), { className: 'hist-cab', textContent: g }));
      }
      box.appendChild(linhaConversa(s, ''));
    }
    return;
  }

  const porNome = list.filter(s => s.title.toLowerCase().includes(termo));
  const resto = list.filter(s => !porNome.includes(s));
  if (porNome.length) {
    box.appendChild(Object.assign(document.createElement('div'), { className: 'hist-cab', textContent: 'no nome' }));
    for (const s of porNome) box.appendChild(linhaConversa(s, termo));
  }
  const aviso = document.createElement('div');
  aviso.className = 'hist-load';
  aviso.textContent = 'procurando dentro das conversas…';
  box.appendChild(aviso);

  const achados = await window.api.buscarConversas({ engine, termo, itens: resto.map(s => ({ id: s.id, file: s.file })) });
  aviso.remove();
  if (!achados.length) {
    if (!porNome.length) box.innerHTML = '<div class="hist-load">Nada com “' + termo + '”.</div>';
    return;
  }
  box.appendChild(Object.assign(document.createElement('div'), { className: 'hist-cab', textContent: 'dentro da conversa' }));
  for (const a of achados) {
    const s = resto.find(x => x.id === a.id);
    if (s) box.appendChild(linhaConversa(s, termo, a.trecho));
  }
}

async function openSession(s, el) {
  // ja esta aberta em algum painel? so pisca e leva voce ate ela
  const aberta = [...panes.values()].find(q => q.resumeId === s.id || q.sessaoId === s.id);
  if (aberta) {
    document.querySelectorAll('.hist-item').forEach(x => x.classList.remove('on'));
    if (el) el.classList.add('on');
    setFocus(aberta);
    piscar(aberta);
    $('.p-input', aberta.el).focus();
    return;
  }
  // cada conversa da lista abre no seu proprio painel, sem atropelar o que ja esta rolando
  let P = null;
  if (panes.size < 12) P = newPane({ engine: s.engine, cwd: s.cwd, titulo: s.title });
  else {
    P = [...panes.values()].find(q => !q.busy && !q.hist.length) || [...panes.values()].find(q => !q.busy);
    if (!P) { const q = focusPane; if (q) avisoTemp(q, 'Todos os painéis estão ocupados. Feche um para abrir esta conversa.'); return; }
  }
  sairDaAbertura();
  document.body.classList.remove('gaveta');
  document.querySelectorAll('.hist-item').forEach(x => x.classList.remove('on'));
  if (el) el.classList.add('on');

  await window.api.paneStop({ paneId: P.id, engine: P.engine });
  P.engine = s.engine; P.cwd = s.cwd; P.resumeId = s.id; P.started = false; P.busy = false; P.model = '';
  P.titulo = s.title || ''; P.hist = [];
  P.blocks.clear(); P.tools.clear(); P.chat.innerHTML = '';
  fillModels(P); paintEngine(P); setDot(P, 'off');
  $('.p-cwd', P.el).textContent = nomePasta(P.cwd);
  pintarModo(P); pintarNome(P);
  setFocus(P); savePanes();

  note(P, 'Conversa: ' + s.title);
  const msgs = await window.api.sessionHistory({ engine: s.engine, file: s.file });
  for (const m of (msgs || [])) {
    if (m.role === 'user') userMsg(P, m.text);
    else if (m.role === 'bot') { const b = botBlock(P, 'h' + Math.random()); b.raw = m.text; b.el.innerHTML = marked.parse(m.text); }
    else if (m.role === 'tool') { toolStart(P, 'h' + Math.random(), m.name, m.arg); }
  }
  document.querySelectorAll('.tool-st').forEach(x => { if (x.classList.contains('run')) { x.className = 'tool-st ok'; x.innerHTML = ico('check'); } });
  note(P, '— daqui pra baixo é a conversa de agora —');
  scroll(P, true);
  $('.p-input', P.el).focus();
}

async function novaConversa(engine) {
  const P = panes.size < 12 ? newPane({ engine, cwd: cfg.defCwd || HOME }) : focusPane;
  if (!P) return;
  document.body.classList.remove('gaveta');   // no celular, sai da lista e mostra a conversa nova
  await window.api.paneStop({ paneId: P.id, engine: P.engine });
  P.engine = engine; P.resumeId = null; P.started = false; P.titulo = ''; P.hist = [];
  P.effort = EF_NOVO; P.ultraAvisado = false;   // conversa nova sempre volta ao intermediário
  P.chat.innerHTML = ''; P.blocks.clear(); P.tools.clear(); pintarNome(P);
  fillModels(P); paintEngine(P); setDot(P, 'off'); setFocus(P);
  $('.p-input', P.el).focus();
}

$$('.side-busca').forEach(inp => {
  let timer = 0;
  inp.addEventListener('input', () => {
    const eng = inp.dataset.busca;
    buscaAtual[eng] = inp.value;
    clearTimeout(timer);
    timer = setTimeout(() => { if (histCache[eng]) paintHist(eng, histCache[eng]); }, 260);
  });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); inp.value = ''; buscaAtual[inp.dataset.busca] = '';
      if (histCache[inp.dataset.busca]) paintHist(inp.dataset.busca, histCache[inp.dataset.busca]); }
  });
});

document.querySelectorAll('[data-reload]').forEach(b =>
  b.addEventListener('click', () => loadHist(b.dataset.reload, true)));
document.querySelectorAll('[data-new]').forEach(b =>
  b.addEventListener('click', () => novaConversa(b.dataset.new)));

/* ============ interface geral ============ */
$('#btnAddPane').addEventListener('click', () => { if (panes.size < 12) newPane(); });
$('#btnPickFolder').addEventListener('click', async () => {
  if (!focusPane) return;
  $('.p-cwd', focusPane.el).click();
});
function aplicarTema(t) {
  document.documentElement.setAttribute('data-tema', t || 'escuro');
  $$('.tema-bt').forEach(b => b.classList.toggle('on', b.dataset.tema === (t || 'escuro')));
}
$$('.tema-bt').forEach(b => b.addEventListener('click', async () => {
  cfg.tema = b.dataset.tema;
  aplicarTema(cfg.tema);
  await window.api.setConfig(cfg);
}));

async function pintarWeb(st) {
  const box = $('#webInfo');
  if (!box) return;                      // no telefone essa parte dos ajustes nem existe
  if (!st || !st.ligado) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = 'No iPhone, abra: <b class="mono">' + st.endereco + '</b><br>Senha: <b class="mono">' + st.senha + '</b>';
}
if ($('#chkWeb')) {
  $('#chkWeb').addEventListener('change', async (e) => {
    const st = await window.api.webLigar(e.target.checked);
    if (st && st.error) { alert('Não consegui abrir: ' + st.error); e.target.checked = false; return; }
    pintarWeb(st);
  });
}

$('#chkRobos').addEventListener('change', async (e) => {
  cfg.verRobos = e.target.checked;
  await window.api.setConfig(cfg);
  histCache.claude = null; histCache.codex = null;
  const aberta = $$('.side-view').find(v => !v.classList.contains('hidden'));
  if (aberta && aberta.dataset.view === 'hclaude') loadHist('claude', true);
  if (aberta && aberta.dataset.view === 'hcodex') loadHist('codex', true);
});

$('#btnFoto').addEventListener('click', async () => {
  const r = await window.api.pickPhoto();
  if (!r) return;
  if (r.error) { alert(r.error); return; }
  cfg.foto = r.dataUrl; await window.api.setConfig(cfg); repintarAvatares();
});
$('#btnFotoTirar').addEventListener('click', async () => {
  delete cfg.foto; await window.api.setConfig(cfg); repintarAvatares();
});

$('#btnDefCwd').addEventListener('click', async () => {
  const p = await window.api.pickFolder(cfg.defCwd || HOME);
  if (!p) return;
  cfg.defCwd = p; await window.api.setConfig(cfg); $('#defCwd').textContent = p;
});

document.querySelectorAll('.act').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.view;
  if (b.classList.contains('active')) return toggleSidebar();   // clicar no icone ja aberto fecha
  $('#sidebar').classList.remove('hidden'); $('#dragbar').classList.remove('hidden');
  document.querySelectorAll('.act').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.side-view').forEach(x => x.classList.toggle('hidden', x.dataset.view !== v));
  $('#sidebar').classList.remove('hidden'); $('#dragbar').classList.remove('hidden');
  if (v === 'hclaude') loadHist('claude');
  if (v === 'hcodex') loadHist('codex');
}));
function toggleSidebar() { $('#sidebar').classList.toggle('hidden'); $('#dragbar').classList.toggle('hidden'); }

(() => {
  let drag = false;
  $('#dragbar').addEventListener('mousedown', () => { drag = true; document.body.style.cursor = 'col-resize'; });
  window.addEventListener('mousemove', (e) => { if (drag) $('#sidebar').style.width = Math.min(480, Math.max(160, e.clientX - 48)) + 'px'; });
  window.addEventListener('mouseup', () => { drag = false; document.body.style.cursor = ''; });
})();

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && /^[1-5]$/.test(e.key)) {
    const arr = [...panes.values()];
    const P = arr[Number(e.key) - 1];
    if (P) { e.preventDefault(); setFocus(P); $('.p-input', P.el).focus(); }
  }
});

window.addEventListener('resize', () => { for (const P of panes.values()) paintEngine(P); });

window.api.onMenu((a) => {
  if (a === 'newPane') { if (panes.size < 12) newPane(); }
  else if (a === 'closePane' && focusPane) closePane(focusPane.id);
  else if (a === 'pickFolder' && focusPane) $('.p-cwd', focusPane.el).click();
  else if (a === 'toggleSidebar') toggleSidebar();
  else if (a === 'clearPane' && focusPane) {
    focusPane.chat.innerHTML = ''; focusPane.blocks.clear(); focusPane.tools.clear();
    note(focusPane, 'Tela limpa. A conversa continua de onde estava.');
  }
});

/* ============ boot ============ */
(async function boot() {
  $('#svgClaude').innerHTML = '<path d="' + LOGO.claude + '"/>';
  $('#svgCodex').innerHTML = '<path d="' + LOGO.codex + '"/>';
  HOME = await window.api.home();
  cfg = await window.api.getConfig();
  cfg.defCwd = cfg.defCwd || HOME;
  $('#defCwd').textContent = cfg.defCwd;
  $('#chkRobos').checked = !!cfg.verRobos;
  if (window.api.webEstado) { const st = await window.api.webEstado(); if ($('#chkWeb')) $('#chkWeb').checked = !!(st && st.ligado); pintarWeb(st); }
  // no telefone: a lateral vira gaveta
  const bg = $('#btnGaveta');
  if (bg) {
    // no telefone a gaveta so serve com a lista de conversas junto
    let vistaTelefone = null;   // a ultima aba que ele escolheu no celular
    document.querySelectorAll('.act').forEach(a => a.addEventListener('click', () => { vistaTelefone = a.dataset.view; }));
    const abrirLista = () => {
      // no celular ele abre a gaveta para trocar de conversa, entao ja mostro as conversas
      const alvo = vistaTelefone || ('h' + ((focusPane && focusPane.engine) || 'claude'));
      const b = document.querySelector('.act[data-view="' + alvo + '"]') || document.querySelector('.act[data-view="hclaude"]');
      if (!b) return;
      const v = b.dataset.view;
      document.querySelectorAll('.act').forEach(x => x.classList.toggle('active', x === b));
      document.querySelectorAll('.side-view').forEach(x => x.classList.toggle('hidden', x.dataset.view !== v));
      $('#sidebar').classList.remove('hidden');
      if (v === 'hclaude') loadHist('claude');
      if (v === 'hcodex') loadHist('codex');
    };
    bg.addEventListener('click', () => {
      const abriu = !document.body.classList.contains('gaveta');
      document.body.classList.toggle('gaveta', abriu);
      if (abriu) abrirLista();
    });
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('gaveta')) return;
      if (e.target.closest('#sidebar') || e.target.closest('#activitybar') || e.target.closest('#btnGaveta')) return;
      document.body.classList.remove('gaveta');
    });
    $$('.hist-item, .new-chat').forEach(() => {});
  }
  aplicarTema(cfg.tema);
  $('#verLine').textContent = 'Cockpit 1.0 · até 12 painéis lado a lado';
  repintarAvatares();
  const noTelefone = !!window.SEM_ELECTRON;
  if (!noTelefone) window.api.codexModels().then(ms => { if (ms && ms.length) { MODELOS_CODEX = ms; for (const P of panes.values()) if (P.engine === 'codex') fillModels(P); } });
  // tela de abertura: escolher com quem vai trabalhar
  $('#bvClaude').innerHTML = svgMotor('claude');
  $('#bvCodex').innerHTML = svgMotor('codex');
  $('#bvDoisA').innerHTML = svgMotor('claude');
  $('#bvDoisB').innerHTML = svgMotor('codex');
  // barra de icones aparece, a lateral comeca fechada, e a area de paineis fica fora do caminho
  $('#sidebar').classList.add('hidden'); $('#dragbar').classList.add('hidden');
  $('#panes').style.display = 'none';
  const comecar = (quais) => {
    sairDaAbertura();
    for (const m of quais) newPane({ engine: m, cwd: cfg.defCwd || HOME });
    setFocus([...panes.values()][0]);
    setTimeout(() => { const P = [...panes.values()][0]; if (P) $('.p-input', P.el).focus(); }, 120);
  };
  $$('.bv-bt[data-motor]').forEach(b => b.addEventListener('click', () => comecar([b.dataset.motor])));
  $('.bv-dois').addEventListener('click', () => comecar(['claude', 'codex']));
  document.addEventListener('keydown', function abertura(e) {
    if (!$('#boasvindas')) { document.removeEventListener('keydown', abertura); return; }
    if (e.key === '1') comecar(['claude']);
    if (e.key === '2') comecar(['codex']);
    if (e.key === 'Enter') comecar(['claude', 'codex']);
  });
})();
