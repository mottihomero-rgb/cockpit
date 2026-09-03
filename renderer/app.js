/* ============ estado global ============ */
let cfg = {}, HOME = '';
let paneSeq = 0, focusPane = null;
/* O iPhone roda este MESMO arquivo e fala com o MESMO processo principal do Mac. Como os dois
   contavam do zero, os dois criavam "p1", "p2"... e o telefone acabava mandando parar (ou
   religar) o chat que estava rodando no Mac. Um prefixo diferente por tela resolve. Estes ids
   nao sao gravados no config — sao so para esta sessao — entao mudar o formato e seguro.
   No Mac o prefixo fica VAZIO de proposito: os ids continuam p1, p2, t1... como sempre foram,
   e por isso recarregar a janela reaproveita os mesmos ids e o processo principal nao fica com
   chat e terminal orfaos rodando escondidos. Quem ganha prefixo e o telefone. */
const ESTA_TELA = (typeof window !== 'undefined' && window.SEM_ELECTRON)
  ? ('w' + Math.random().toString(36).slice(2, 7))
  : '';
const panes = new Map();     // id -> objeto do painel
// cada ABA e uma pasta de projeto; dentro dela ficam os chats lado a lado
let abaSeq = 0, abaAtiva = null;
const abas = new Map();      // aid -> { id, cwd, el, corpoEl, ordem: [paneId], ativo }

const $ = (s, r = document) => r.querySelector(s);
/* logos oficiais (simple-icons) */
const LOGO = {
  claude: 'M4.7144 15.9555l4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z',
  codex: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z',
};
const ICONES = {"hand": "<path d=\"M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2\" /> <path d=\"M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2\" /> <path d=\"M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8\" /> <path d=\"M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15\" />", "code-xml": "<path d=\"m18 16 4-4-4-4\" /> <path d=\"m6 8-4 4 4 4\" /> <path d=\"m14.5 4-5 16\" />", "clipboard-list": "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\" /> <path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\" /> <path d=\"M12 11h4\" /> <path d=\"M12 16h4\" /> <path d=\"M8 11h.01\" /> <path d=\"M8 16h.01\" />", "zap": "<path d=\"M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z\" />", "unlock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 9.9-1\" />", "upload": "<path d=\"M12 3v12\" /> <path d=\"m17 8-5-5-5 5\" /> <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" />", "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" /> <circle cx=\"9\" cy=\"9\" r=\"2\" /> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />", "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\" />", "map-pin": "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /> <circle cx=\"12\" cy=\"10\" r=\"3\" />", "eraser": "<path d=\"M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21\" /> <path d=\"m5.082 11.09 8.828 8.828\" />", "sparkles": "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\" /> <path d=\"M20 2v4\" /> <path d=\"M22 4h-4\" /> <circle cx=\"4\" cy=\"20\" r=\"2\" />", "brain": "<path d=\"M12 18V5\" /> <path d=\"M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4\" /> <path d=\"M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5\" /> <path d=\"M17.997 5.125a4 4 0 0 1 2.526 5.77\" /> <path d=\"M18 18a4 4 0 0 0 2-7.464\" /> <path d=\"M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517\" /> <path d=\"M6 18a4 4 0 0 1-2-7.464\" /> <path d=\"M6.003 5.125a4 4 0 0 0-2.526 5.77\" />", "sliders-horizontal": "<path d=\"M10 5H3\" /> <path d=\"M12 19H3\" /> <path d=\"M14 3v4\" /> <path d=\"M16 17v4\" /> <path d=\"M21 12h-9\" /> <path d=\"M21 19h-5\" /> <path d=\"M21 5h-7\" /> <path d=\"M8 10v4\" /> <path d=\"M8 12H3\" />", "lock": "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />", "arrow-left-right": "<path d=\"M8 3 4 7l4 4\" /> <path d=\"M4 7h16\" /> <path d=\"m16 21 4-4-4-4\" /> <path d=\"M20 17H4\" />", "folder-open": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\" />", "plus": "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />", "plug": "<path d=\"M12 22v-5\" /> <path d=\"M15 8V2\" /> <path d=\"M17 8a1 1 0 0 1 1 1v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1z\" /> <path d=\"M9 8V2\" />", "key-round": "<path d=\"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z\" /> <circle cx=\"16.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />", "log-out": "<path d=\"m16 17 5-5-5-5\" /> <path d=\"M21 12H9\" /> <path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\" />", "user": "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\" /> <circle cx=\"12\" cy=\"7\" r=\"4\" />", "file-code": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M10 12.5 8 15l2 2.5\" /> <path d=\"m14 12.5 2 2.5-2 2.5\" />", "file-text": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" /> <path d=\"M10 9H8\" /> <path d=\"M16 13H8\" /> <path d=\"M16 17H8\" />", "braces": "<path d=\"M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1\" /> <path d=\"M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1\" />", "terminal": "<path d=\"M12 19h8\" /> <path d=\"m4 17 6-6-6-6\" />", "file": "<path d=\"M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z\" /> <path d=\"M14 2v5a1 1 0 0 0 1 1h5\" />", "refresh-cw": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" /> <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" /> <path d=\"M8 16H3v5\" />", "circle-help": "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3\" /> <path d=\"M12 17h.01\" />", "x": "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />", "check": "<path d=\"M20 6 9 17l-5-5\" />", "panel-left": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M9 3v18\" />", "chevron-right": "<path d=\"m9 18 6-6-6-6\" />", "chevron-down": "<path d=\"m6 9 6 6 6-6\" />", "arrow-up": "<path d=\"m5 12 7-7 7 7\" /> <path d=\"M12 19V5\" />", "square": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />", "rotate-cw": "<path d=\"M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8\" /> <path d=\"M21 3v5h-5\" />", "circle": "<circle cx=\"12\" cy=\"12\" r=\"10\" />", "minus": "<path d=\"M5 12h14\" />", "pencil": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" /> <path d=\"m15 5 4 4\" />", "search": "<path d=\"m21 21-4.34-4.34\" /> <circle cx=\"11\" cy=\"11\" r=\"8\" />", "server": "<rect width=\"20\" height=\"8\" x=\"2\" y=\"2\" rx=\"2\" /> <rect width=\"20\" height=\"8\" x=\"2\" y=\"14\" rx=\"2\" /> <path d=\"M6 6h.01\" /> <path d=\"M6 18h.01\" />", "star": "<path d=\"M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z\" />"};
/* icones que faltavam para as coisas novas (copiar, ditar, mandar nos dois, guardar no vault) */
Object.assign(ICONES, {
  'copy': '<rect width="14" height="14" x="8" y="8" rx="2" ry="2" /> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />',
  'mic': '<path d="M12 19v3" /> <path d="M19 10v2a7 7 0 0 1-14 0v-2" /> <rect x="9" y="2" width="6" height="13" rx="3" />',
  'columns-2': '<rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M12 3v18" />',
  'book': '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />',
});
const ico = (n) => '<svg viewBox="0 0 24 24" class="ic" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONES[n] || '') + '</svg>';
const svgMotor = (eng) => '<svg viewBox="0 0 24 24" class="logo-motor"><path d="' + LOGO[eng === 'codex' ? 'codex' : 'claude'] + '"/></svg>';
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Resposta de IA e de conectores é conteúdo externo. HTML bruto nunca entra na janela.
const markdownSeguro = new marked.Renderer();
const escaparAtributo = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
markdownSeguro.html = () => '';
markdownSeguro.link = (href, title, text) => {
  if (!/^https?:\/\//i.test(String(href || ''))) return text;
  return '<a href="' + escaparAtributo(href) + '"' + (title ? ' title="' + escaparAtributo(title) + '"' : '') + '>' + text + '</a>';
};
markdownSeguro.image = (_href, _title, text) => text;
marked.setOptions({ breaks: true, gfm: true, renderer: markdownSeguro });

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
const EF_NOVO = 'xhigh';

// no Máximo o painel do Claude vira "ultracode". Em --print o CLI proíbe workflow por padrão,
// então a liberação vai como fala do usuário — é o que vence a regra de fábrica (testado).
// no modo "Entra" a mensagem cai no meio do trabalho. Em vez de atropelar, ele escolhe.
const ENTRA_MSG = 'ATENÇÃO: esta mensagem chegou enquanto você já estava trabalhando em outra coisa. '
  + 'VOCÊ DECIDE o que fazer com ela, e a primeira linha da sua resposta tem que dizer qual dos dois escolheu:\n'
  + '(a) "Faço agora" — se isso muda o rumo do que você está fazendo, corrige algo errado, ou perde a validade se esperar. '
  + 'Nesse caso pare o que estava fazendo e atenda.\n'
  + '(b) "Termino o que estou fazendo e já faço" — se o que você está fazendo continua valendo. '
  + 'Nesse caso termine primeiro e, ASSIM QUE TERMINAR, faça isto sem que eu precise repetir.\n'
  + 'Não pergunte qual eu prefiro: escolha e siga.\n\n--- o que eu pedi ---\n';

const ULTRACODE_MSG = 'MODO ULTRACODE LIGADO PELO USUÁRIO: eu autorizo explicitamente, para esta e para todas as tarefas substantivas desta conversa, o uso da ferramenta Workflow (orquestração multi-agente) e de subagentes em paralelo. Busque a resposta mais completa e correta, não a mais rápida ou barata. Isso substitui qualquer regra em contrário sobre não usar workflows sem eu pedir. Continue pedindo meu aval apenas para gastar dinheiro, publicar/enviar para fora, ou apagar o que já funciona.\n\n---\n\n';

const MODELOS_CLAUDE = [
  { id: 'claude-opus-5[1m]', nome: 'Opus 5 (1M)', desc: 'O mais forte, com memória gigante',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'xhigh', padrao: true },
  { id: 'claude-fable-5', nome: 'Fable 5', desc: 'O mais novo da casa',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'xhigh' },
  { id: 'claude-opus-5', nome: 'Opus 5', desc: 'O mais forte',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'xhigh' },
  { id: 'claude-sonnet-5', nome: 'Sonnet 5', desc: 'Rápido e bom para o dia a dia',
    efforts: ['low','medium','high','xhigh','max'], padraoEffort: 'xhigh' },
  { id: 'claude-haiku-4-5-20251001', nome: 'Haiku 4.5', desc: 'O mais barato e veloz',
    efforts: ['low','medium','high'], padraoEffort: 'high' },
];
let MODELOS_CODEX = null;   // vem do proprio Codex

function modelosDe(P) {
  if (P.engine === 'claude') return MODELOS_CLAUDE;
  // testar o TAMANHO, nao so se existe: quando o Codex esta fora do ar a chamada devolve lista
  // vazia, que e "verdadeira" em JS. Sem isto, ms[0] virava undefined e quebrava criar chat
  // do Codex e trocar de motor.
  return (MODELOS_CODEX && MODELOS_CODEX.length) ? MODELOS_CODEX
    : [{ id: '', nome: 'padrão do Codex', desc: 'o que está no seu config', efforts: ['low','medium','high','xhigh'], padraoEffort: 'medium' }];
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
const NA_VPS = (p) => /^vps:/i.test(String(p || ''));
const semPrefixo = (p) => String(p || '').replace(/^vps:/i, '');
const shortPath = (p) => (NA_VPS(p) ? 'VPS ' + semPrefixo(p) : String(p || '').replace(HOME, '~'));
const nomePasta = (p) => {
  if (!p) return 'Pasta';
  if (NA_VPS(p)) { const c = semPrefixo(p); return 'VPS: ' + (c.split('/').filter(Boolean).pop() || '/'); }
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

/* ============ abas de projeto (uma pasta por aba) ============ */

// nome curto do projeto que aparece na aba
function nomeProjeto(cwd) {
  if (NA_VPS(cwd)) { const c = semPrefixo(cwd); return c.split('/').filter(Boolean).pop() || 'VPS'; }
  if (!cwd || cwd === HOME) return 'Mac inteiro';
  return cwd.split('/').filter(Boolean).pop() || 'Mac inteiro';
}

// cria a aba de um projeto: uma pasta, e dentro dela os chats lado a lado
function novaAbaProjeto(cwd, indice) {
  const aid = 'a' + (++abaSeq);
  const el = $('#tplAba').content.firstElementChild.cloneNode(true);
  const corpoEl = $('#tplEspaco').content.firstElementChild.cloneNode(true);
  el.dataset.aid = aid; corpoEl.dataset.aid = aid;

  const A = { id: aid, cwd: cwd || HOME, el, corpoEl, ordem: [], ativo: null };
  abas.set(aid, A);

  $('.aba-x', el).addEventListener('click', (e) => { e.stopPropagation(); fecharAba(A); });
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('.aba-x')) return;
    ativarAbaProjeto(A);
    comecarArrasteAba(A, e);
  });
  el.addEventListener('dblclick', (e) => { if (!e.target.closest('.aba-x')) trocarPastaDaAba(A); });

  const lista = $('#abasLista');
  const alvo = (indice == null || indice >= lista.children.length) ? null : lista.children[indice];
  lista.insertBefore(el, alvo);
  $('#panes').appendChild(corpoEl);
  pintarAba(A);
  return A;
}

function abaDe(P) { return abas.get(P.aid); }

function pintarAba(A) {
  const n = A.ordem.length;
  const naVps = NA_VPS(A.cwd);
  A.el.classList.toggle('vps', naVps);
  $('.aba-ic', A.el).innerHTML = ico(naVps ? 'server' : 'folder');
  $('.aba-proj', A.el).textContent = nomeProjeto(A.cwd);
  $('.aba-tit', A.el).textContent = (naVps ? 'VPS · ' : '') + (n === 0 ? 'sem chat' : (n === 1 ? '1 chat' : n + ' chats'));
  A.el.title = shortPath(A.cwd) + '\n' + (n === 1 ? '1 chat aberto' : n + ' chats abertos');
  // a bolinha da aba mostra se algum chat dela esta trabalhando
  let estado = 'off';
  for (const pid of A.ordem) {
    const P = panes.get(pid); if (!P) continue;
    if (P.busy) { estado = 'busy'; break; }
    if (P.started) estado = 'idle';
  }
  $('.aba-dot', A.el).className = 'aba-dot dot ' + estado;
}

function pintarTodasAbas() { for (const A of abas.values()) pintarAba(A); }

function ativarAbaProjeto(A) {
  if (!A) return;
  abaAtiva = A;
  for (const B of abas.values()) {
    const on = B === A;
    B.el.classList.toggle('ativa', on);
    B.corpoEl.classList.toggle('oculta', !on);
  }
  if (A.el.classList.contains('nova')) A.el.classList.remove('nova');
  // o chat guardado pode ter mudado de aba: nesse caso ele levaria voce de volta para a outra
  if (A.ativo && !A.ordem.includes(A.ativo)) A.ativo = null;
  const P = panes.get(A.ativo) || panes.get(A.ordem[0]);
  if (P) setFocus(P);
  else { $('#tbTitle').textContent = shortPath(A.cwd); loadTree(A.cwd); }
  // chat que recebeu resposta com a aba escondida precisa voltar rolado pro fim
  for (const pid of A.ordem) {
    const q = panes.get(pid);
    if (q && q.precisaRolar) { q.precisaRolar = false; requestAnimationFrame(() => { q.chat.scrollTop = q.chat.scrollHeight; }); }
  }
  pintarMulti();          // a barra de baixo (modelo, modo, envio) segue a aba que abriu:
                          // sem isto, vir de uma aba de 3 chats deixava a de 1 chat comprimida
  lateralSegueAPasta();   // a lista de conversas segue o cliente da aba
}

async function fecharAba(A) {
  if (!A) return;
  // mesma regra do chat: fechar a aba inteira com trabalho rodando dentro pergunta antes
  const ocupados = A.ordem.map(id => panes.get(id)).filter(q => q && q.busy).length;
  if (ocupados) {
    const q = ocupados === 1 ? 'um chat desta aba está trabalhando' : ocupados + ' chats desta aba estão trabalhando';
    if (!confirm('Tem ' + q + '.\n\nFechar a aba joga fora o que eles estão fazendo. Fechar mesmo assim?')) return;
  }
  // A tela sai NA HORA; mandar parar os motores acontece por baixo, em paralelo.
  // Um por um e esperando cada um (o do Codex pode levar ate 1,5s) deixava a aba pendurada
  // na tela por varios segundos depois do clique no X.
  const paraParar = [];
  for (const pid of [...A.ordem]) {
    const P = panes.get(pid);
    if (!P) continue;
    paraParar.push({ pid, engine: P.engine });
    P.el.remove(); panes.delete(pid);
  }
  A.ordem = [];
  marcarAbertas();          // fechou a aba inteira: apaga a borda de todas as conversas dela
  Promise.all(paraParar.map(x => window.api.paneStop({ paneId: x.pid, engine: x.engine }).catch(() => {})));
  const lista = [...abas.values()];
  const i = lista.indexOf(A);
  A.el.remove(); A.corpoEl.remove(); abas.delete(A.id);
  if (focusPane && !panes.has(focusPane.id)) focusPane = null;
  const resto = [...abas.values()];
  if (!resto.length) { abaAtiva = null; telaNovaAba(true); }
  else ativarAbaProjeto(resto[Math.max(0, i - 1)] || resto[0]);
  savePanes();
}

// pasta nova = vida nova: a memoria, o historico e o trabalho passam a ser os da pasta,
// entao a conversa antiga (que era da pasta velha) nao vai junto
function conversaDaPastaNova(P, pasta) {
  // O processo antigo foi morto aqui. Sem zerar o "ocupado", o evento de fim de turno nunca
  // chega (nao ha mais processo pra manda-lo) e TODA mensagem seguinte fica presa em "na fila",
  // para sempre. E o que estava na fila morreu junto com o processo.
  P.busy = false; P.queued = null; escondePerm(P);
  pararTrabalho(P); limparPassos(P);
  P.sessaoId = null; P.sessaoFile = ''; P.resumeId = null;
  P.titulo = ''; P.nomeManual = false; P.hist = [];
  P.blocks.clear(); P.tools.clear();
  P.ultraAvisado = false;
  voltarVazio(P);
  pintarNome(P);
}

async function trocarPastaDaAba(A) {
  const p = await window.api.pickFolder(A.cwd);
  if (!p || p === A.cwd) return;
  A.cwd = p;
  pintarAba(A);
  // os chats dessa aba passam a viver na pasta nova
  for (const pid of A.ordem) {
    const P = panes.get(pid); if (!P) continue;
    await window.api.paneStop({ paneId: pid, engine: P.engine });
    P.cwd = p; P.started = false; setDot(P, 'off');
    $('.p-cwd', P.el).textContent = nomePasta(p);
    conversaDaPastaNova(P, p);
  }
  if (abaAtiva === A) { loadTree(p); const pn = $('#projName'); if (pn) pn.textContent = nomePasta(p); }
  lateralSegueAPasta();
  savePanes();
}

// tira o chat de onde esta e coloca em outra posicao (ou em outra aba)
function moverPane(P, A, indice) {
  const antiga = abaDe(P);
  if (antiga) {
    const i = antiga.ordem.indexOf(P.id);
    if (i >= 0) antiga.ordem.splice(i, 1);
    if (antiga.ativo === P.id) antiga.ativo = antiga.ordem[Math.max(0, i - 1)] || antiga.ordem[0] || null;
  }
  if (indice == null || indice >= A.ordem.length) A.ordem.push(P.id);
  else A.ordem.splice(indice, 0, P.id);
  P.aid = A.id;
  // mudou de projeto: o chat recomeca na pasta da aba nova
  if (antiga && antiga !== A && P.cwd !== A.cwd) {
    window.api.paneStop({ paneId: P.id, engine: P.engine });
    P.cwd = A.cwd; P.started = false; setDot(P, 'off');
    $('.p-cwd', P.el).textContent = nomePasta(P.cwd);
    conversaDaPastaNova(P, P.cwd);
  }
  remontarEspaco(A);
  if (antiga && antiga !== A) {
    if (!antiga.ordem.length) removerAbaVazia(antiga);
    else { remontarEspaco(antiga); pintarAba(antiga); }
  }
  pintarAba(A);
  if (abaAtiva !== A) ativarAbaProjeto(A);
  setFocus(P);
  lateralSegueAPasta();
  savePanes();
}

// tira da tela a aba que ficou sem chat (sem mexer em qual aba esta aberta)
function removerAbaVazia(A) {
  if (!A || A.ordem.length) return;
  A.el.remove(); A.corpoEl.remove(); abas.delete(A.id);
  if (abaAtiva === A) abaAtiva = null;
}

// chat que vive na VPS nao tem Finder: pede o caminho num campo dentro do proprio chat
function pedirCaminhoVps(P) {
  const modal = $('.p-modal', P.el), cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  cx.className = 'modal-cx cx-vps';
  cx.onclick = (e) => e.stopPropagation();
  cx.innerHTML = '<div class="mo-top"><span class="mo-tit">Pasta na VPS</span><button class="mo-x">' + ico('x') + '</button></div>'
    + '<div class="mo-sub">Digite o caminho de lá. O chat vai para a aba dessa pasta.</div>'
    + '<input class="na-caminho" id="vpsCaminho" spellcheck="false">'
    + '<div class="na-atalhos" id="vpsAtalhos"></div>'
    + '<div class="mo-rodape"><button class="mo-btn destaque" id="vpsOk">Ir</button></div>';
  const inp = $('#vpsCaminho', cx);
  inp.value = semPrefixo(P.cwd);
  for (const cam of PASTAS_VPS) {
    const b = document.createElement('button');
    b.className = 'na-atalho'; b.textContent = cam;
    b.onclick = () => { inp.value = cam; inp.focus(); };
    $('#vpsAtalhos', cx).appendChild(b);
  }
  const ir = () => {
    const c = (inp.value || '').trim();
    fecharModal(P);
    if (!c) return;
    levarChatPara(P, 'vps:' + (c.startsWith('/') ? c : '/' + c));
  };
  $('#vpsOk', cx).onclick = ir;
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ir(); } });
  $('.mo-x', cx).onclick = () => fecharModal(P);
  modal.onclick = (e) => { if (e.target === modal) fecharModal(P); };
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

// trocar a pasta DE UM CHAT: ele se muda para a aba daquela pasta
async function mudarPastaDoChat(P) {
  if (NA_VPS(P.cwd)) return pedirCaminhoVps(P);
  const escolhida = await window.api.pickFolder(P.cwd);
  if (!escolhida || escolhida === P.cwd) return;
  return levarChatPara(P, escolhida);
}

async function levarChatPara(P, escolhida) {
  if (!escolhida || escolhida === P.cwd) return;
  const A0 = abaDe(P);
  const jaExiste = abaDoCaminho(escolhida, false);

  if (jaExiste && jaExiste === A0) {   // ja e a aba certa: so a subpasta do chat muda
    await window.api.paneStop({ paneId: P.id, engine: P.engine });
    P.cwd = escolhida; P.started = false; setDot(P, 'off');
    $('.p-cwd', P.el).textContent = nomePasta(escolhida);
    conversaDaPastaNova(P, escolhida);
    savePanes();
    return;
  }

  // este chat esta sozinho na aba e nao ha outra aba com essa pasta:
  // e mais simples a propria aba mudar de pasta do que criar outra
  if (!jaExiste && A0 && A0.ordem.length === 1) {
    A0.cwd = escolhida;
    await window.api.paneStop({ paneId: P.id, engine: P.engine });
    P.cwd = escolhida; P.started = false; setDot(P, 'off');
    $('.p-cwd', P.el).textContent = nomePasta(escolhida);
    pintarAba(A0);
    if (abaAtiva === A0) { loadTree(escolhida); const pn = $('#projName'); if (pn) pn.textContent = nomePasta(escolhida); setFocus(P); }
    conversaDaPastaNova(P, escolhida);
    lateralSegueAPasta();
    savePanes();
    return;
  }

  const destino = jaExiste || novaAbaProjeto(escolhida);
  moverPane(P, destino, null);
}

// redesenha os chats de uma aba na ordem certa, com os divisores entre eles
function remontarEspaco(A) {
  const guardado = new Map();
  for (const pid of A.ordem) {
    const P = panes.get(pid);
    if (P) guardado.set(pid, { flex: P.el.style.flex, min: P.el.style.minWidth });
  }
  A.corpoEl.innerHTML = '';
  A.ordem.forEach((pid, k) => {
    const P = panes.get(pid); if (!P) return;
    if (k > 0) A.corpoEl.appendChild(makeSplitter());
    A.corpoEl.appendChild(P.el);
    const g = guardado.get(pid) || {};
    P.el.style.flex = g.flex || '';
    P.el.style.minWidth = g.min || '';
  });
  pintarMulti();
}

function newPane(opts = {}) {
  const id = ESTA_TELA + 'p' + (++paneSeq);
  const el = $('#tplPane').content.firstElementChild.cloneNode(true);
  el.dataset.id = id;

  const A = opts.aba || abaAtiva || novaAbaProjeto(opts.cwd || cfg.defCwd || HOME);
  const P = {
    id, el, aid: A.id,
    engine: opts.engine || cfg.lastEngine || 'codex',
    cwd: opts.cwd || A.cwd,                // a pasta e a da aba
    model: opts.model || '',
    started: false, busy: false, queued: null, hist: [], passarContexto: null,
    titulo: opts.titulo || '', sessaoId: null, sessaoFile: '', anexos: [],
    envio: cfg.envioPadrao || 'fila',
    // conversa nova sempre nasce no Extra alto; painel restaurado mantém o que estava salvo
    mode: opts.mode || cfg.defMode || 'auto', effort: opts.effort || EF_NOVO,
    blocks: new Map(), tools: new Map(), execEl: null, trabTimer: null, trabOque: '',
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
  btnCwd.title = 'Trocar a pasta deste chat (ele vai para a aba dessa pasta)';
  btnCwd.addEventListener('click', () => mudarPastaDoChat(P));

  $('.p-close', el).addEventListener('click', () => closePane(id));

  // arrastar o chat pelo cabecalho para trocar de lugar na tela
  $('.pane-hd', el).addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;
    setFocus(P);
    comecarArrastePane(P, e);
  });

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
    const arquivos = dt ? [...(dt.files || [])].map(f => f.path).filter(Boolean) : [];
    if (arquivos.length) { e.preventDefault(); setFocus(P); await anexar(P, arquivos); return; }
    // Copiar do Excel, do Word ou de um site traz TEXTO e, junto, uma imagem da selecao.
    // Antes o codigo pegava a imagem e grudava um print fantasma na mensagem — e ainda por
    // cima gravava um PNG na pasta 'colados' a cada colagem. Havendo texto, texto ganha.
    if (temTexto) return;                 // deixa o navegador colar o texto, como sempre
    // so imagem: cancelar o padrao AGORA. Depois de um await ja e tarde, o navegador colou.
    e.preventDefault();
    const r = await window.api.colados();
    if (r && r.arquivos && r.arquivos.length) { setFocus(P); await anexar(P, r.arquivos); }
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


  const btEnvio = $('.p-modoenvio', el);
  const pintarEnvio = () => {
    const entra = P.envio === 'entra';
    btEnvio.innerHTML = ico(entra ? 'zap' : 'clipboard-list') + '<span>' + (entra ? 'Entra' : 'Fila') + '</span>';
    btEnvio.title = entra
      ? 'Se ele estiver trabalhando, sua mensagem chega na hora e ELE decide: atende agora ou assim que terminar'
      : 'Se ele estiver trabalhando, sua mensagem espera ele terminar para só então começar';
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

  // botao do microfone (ditar em vez de digitar)
  const btMic = document.createElement('button');
  btMic.className = 'cb p-mic'; btMic.title = 'Ditar (⌘⇧D)'; btMic.innerHTML = ico('mic');
  btMic.addEventListener('click', (e) => { e.stopPropagation(); alternarDitado(P); });
  $('.p-slash', el).insertAdjacentElement('afterend', btMic);

  btnCwd.textContent = nomePasta(P.cwd);
  fillModels(P); paintEngine(P); pintarModo(P); pintarUso(P); lerUso(P.engine);
  if (!opts.model) aplicarEscolhaDaPasta(P);   // esta pasta ja tem cerebro preferido?

  if (opts.indice == null || opts.indice >= A.ordem.length) A.ordem.push(id);
  else A.ordem.splice(opts.indice, 0, id);
  remontarEspaco(A);
  pintarAba(A);
  if (abaAtiva !== A) ativarAbaProjeto(A);
  setFocus(P);
  inp.focus();
  setTimeout(() => el.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' }), 60);
  setTimeout(savePanes, 30);
  return P;
}

// com mais de um grupo aberto o espaco aperta: a barra de baixo fica so com os icones
function pintarMulti() {
  const n = abaAtiva ? abaAtiva.ordem.length : 0;
  $('#panes').classList.toggle('multi', n > 1);
}

function makeSplitter() {
  const s = document.createElement('div');
  s.className = 'pane-split';
  s.title = 'Arraste para mudar o tamanho deste chat · clique duas vezes para deixar todos iguais';

  // dois cliques: todos voltam ao tamanho padrao, dividindo a tela por igual
  s.addEventListener('dblclick', (e) => {
    e.preventDefault(); e.stopPropagation();
    igualarChats();
  });

  // clicar e segurar: muda o tamanho SO do chat da esquerda; os outros se acomodam
  s.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const alvo = s.previousElementSibling;
    if (!alvo || !alvo.classList.contains('pane')) return;
    const x0 = e.clientX, w0 = alvo.getBoundingClientRect().width;
    const minimo = 300;
    const move = (ev) => {
      const largura = Math.max(minimo, w0 + (ev.clientX - x0));
      alvo.style.flex = '0 0 ' + Math.round(largura) + 'px';
      alvo.style.minWidth = '0';
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      savePanes();
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
  return s;
}

// devolve todos os chats da aba aberta ao tamanho padrao
function igualarChats() {
  const A = abaAtiva; if (!A) return;
  for (const pid of A.ordem) {
    const q = panes.get(pid);
    if (q) { q.el.style.flex = ''; q.el.style.minWidth = ''; }
  }
  A.corpoEl.scrollLeft = 0;
  savePanes();
}

let restaurando = false;
/* Abas que estavam no disco e que eu nao consegui remontar. Continuam sendo gravadas como
   estavam: sem isto, o primeiro salvamento depois de uma restauracao pela metade apagava do
   arquivo justamente as abas que faltaram — logo depois de o aviso dizer que nada foi perdido. */
let abasQueNaoVoltaram = [];
let clienteQueEstavaAberto = '';
function savePanes() {
  // todo vai-e-vem de chat passa por aqui: e o lugar certo pra acender/apagar a borda
  // das conversas que estao abertas na lista lateral
  marcarAbertas();
  if (restaurando) return;   // remontando a tela: nao gravar estado pela metade
  delete cfg.panes; delete cfg.grupos;
  const listaAbas = [...abas.values()];
  cfg.abas = listaAbas.map(A => ({
    cwd: A.cwd,
    ativo: Math.max(0, A.ordem.indexOf(A.ativo)),
    chats: A.ordem.map(pid => {
      const P = panes.get(pid); if (!P) return null;
      return {
        engine: P.engine, cwd: P.cwd, model: P.model, mode: P.mode, effort: P.effort,
        titulo: P.titulo, larg: P.el.style.flex || '',
        // guarda a conversa para ela voltar cheia, e nao uma caixa vazia
        sessao: P.sessaoId || P.resumeId || '',
        arquivo: P.sessaoFile || '',
      };
    }).filter(Boolean),
  })).filter(a => a.chats.length).concat(abasQueNaoVoltaram);
  cfg.abaAberta = Math.max(0, listaAbas.indexOf(abaAtiva));
  window.api.setConfig(cfg);
}

/* ============ voltar como estava ============ */
/* A trava "restaurando" impede o app de salvar enquanto monta as abas de volta. Antes ela so
   era desligada no caminho feliz: se qualquer coisa estourasse no meio, ela ficava ligada e o
   savePanes() nunca mais gravava nada — em silencio. O Homero trabalhava o dia inteiro e no
   dia seguinte caia na tela de "Nova aba". O finally garante que ela sempre desliga. */
/* Uma aba = uma pasta de cliente. O que esta gravado pode ter chat de outro cliente dentro
   (arrastado na mao, aberto pela lista antes desta regra existir, ou pasta trocada depois):
   ao voltar, cada chat vai para a aba do SEU cliente e duas abas do mesmo cliente viram uma so.
   E o que impede a tela de abrir com "Matheus Mota" segurando uma conversa da pasta do Mac. */
function agruparPorCliente(salvas) {
  const mapa = new Map();
  const grupos = [];
  for (const a of salvas) {
    const chats = a.chats || [];
    const iAtivo = Math.min(Math.max(0, a.ativo | 0), chats.length - 1);
    chats.forEach((c, i) => {
      const cwd = c.cwd || a.cwd || HOME;
      const cli = clienteDe(cwd) || cwd;
      let g = mapa.get(cli);
      if (!g) { g = { cwd: cli, ativo: 0, chats: [] }; mapa.set(cli, g); grupos.push(g); }
      g.chats.push(Object.assign({}, c, { cwd }));
      if (i === iAtivo) g.ativo = g.chats.length - 1;
    });
  }
  return grupos;
}

async function restaurarAbas() {
  const gravadas = Array.isArray(cfg.abas) ? cfg.abas.filter(a => a && a.chats && a.chats.length) : [];
  if (!gravadas.length) return false;
  // qual cliente estava na frente, para reabrir nele mesmo depois do reagrupamento
  const antes = gravadas[Math.min(Math.max(0, cfg.abaAberta | 0), gravadas.length - 1)];
  clienteQueEstavaAberto = antes ? (clienteDe(antes.cwd || HOME) || antes.cwd) : '';
  const salvas = agruparPorCliente(gravadas);
  if (!salvas.length) return false;
  restaurando = true;
  abasQueNaoVoltaram = salvas.slice();     // cada aba que remontar sai desta lista
  try {
    await restaurarAbasCorpo(salvas);
  } finally {
    restaurando = false;
  }
  savePanes();
  return true;
}

async function restaurarAbasCorpo(salvas) {
  const paraCarregar = [];
  for (const a of salvas) {
    // cada aba isolada: uma aba com problema nao pode derrubar as seguintes
    try {
    const A = novaAbaProjeto(a.cwd || HOME);
    a.chats.forEach((c, i) => {
      const P = newPane({
        engine: c.engine, aba: A, cwd: c.cwd || a.cwd,
        model: c.model, mode: c.mode, effort: c.effort, titulo: c.titulo,
      });
      if (c.larg) P.el.style.flex = c.larg;
      if (c.sessao) {
        P.resumeId = c.sessao;                       // a proxima mensagem continua a mesma conversa
        // Sem repor tambem o caminho do arquivo, o primeiro savePanes() apos abrir gravava
        // arquivo:"" por cima do caminho salvo. Na reabertura seguinte o chat voltava VAZIO,
        // mesmo com a conversa inteira intacta no disco.
        P.sessaoFile = c.arquivo || '';
        paraCarregar.push({ P, arquivo: c.arquivo || '', id: c.sessao, cwd: c.cwd || a.cwd });
      }
      pintarNome(P);
    });
    const iAtivo = Math.min(Math.max(0, a.ativo | 0), A.ordem.length - 1);
    const Pativo = panes.get(A.ordem[iAtivo]);
    if (Pativo) A.ativo = Pativo.id;
    // esta aba voltou: sai da lista das que precisam ser preservadas as cegas
    abasQueNaoVoltaram = abasQueNaoVoltaram.filter(x => x !== a);
    } catch (e) {
      console.error('nao consegui remontar a aba', a && a.cwd, e);
    }
  }

  const abertas = [...abas.values()];
  // depois do reagrupamento o numero da aba mudou de lugar: quem manda e o cliente que estava aberto
  const iCli = clienteQueEstavaAberto
    ? abertas.findIndex(A => clienteDe(A.cwd) === clienteQueEstavaAberto) : -1;
  const i = iCli >= 0 ? iCli : Math.min(Math.max(0, cfg.abaAberta | 0), abertas.length - 1);
  ativarAbaProjeto(abertas[i] || abertas[0]);

  // as conversas voltam com o que ja tinha sido dito, uma de cada vez para nao travar a tela
  for (const { P, arquivo, id, cwd } of paraCarregar) {
    note(P, 'Trazendo a conversa de volta…');
    try {
      // manda tambem id e pasta: quando o caminho se perdeu (config antigo), o main
      // reconstroi sozinho a partir deles em vez de devolver conversa vazia
      const msgs = await window.api.sessionHistory({ engine: P.engine, file: arquivo, id, cwd });
      const aviso = $('.note', P.chat); if (aviso) aviso.remove();
      for (const m of (msgs || [])) {
        if (m.role === 'user') userMsg(P, m.text);
        // a resposta tambem entra no historico da memoria da tela: e dele que sai o contexto
        // de emergencia quando a conversa cai e volta sem numero
        else if (m.role === 'bot') { const b = botBlock(P, 'r' + Math.random()); b.raw = m.text; b.el.innerHTML = marked.parse(m.text); P.hist.push({ quem: P.engine === 'codex' ? 'Codex' : 'Claude', texto: m.text }); }
        else if (m.role === 'tool') toolStart(P, 'r' + Math.random(), m.name, m.arg);
      }
      $$('.tool-st.run', P.el).forEach(x => { x.className = 'tool-st ok'; x.innerHTML = ico('check'); });
      // sem isto o "Escreva embaixo pra começar" ficava por cima da conversa que acabou de voltar
      if (msgs && msgs.length) { clearEmpty(P); note(P, '— daqui pra baixo é a conversa de agora —'); }
      scroll(P, true);
    } catch { note(P, 'Não consegui trazer o que já foi conversado. Pode continuar mesmo assim.', true); }
  }
  return true;
}

async function trocarMotor(P, novo) {
  // P.trocando trava o clique repetido: sem ele, clicar rapido nos dois lados fazia o segundo
  // clique ser engolido em silencio, e uma mensagem enviada nesse meio-tempo subia o motor errado.
  if (novo === P.engine || P.trocando) return;
  const antigo = P.engine === 'codex' ? 'Codex' : 'Claude';
  const velho = P.engine;
  P.trocando = true;
  // o estado e o desenho mudam JA, antes da ida ao processo principal: enquanto se esperava
  // o paneStop responder, o icone continuava marcando o motor antigo
  P.engine = novo; P.started = false; P.model = ''; P.resumeId = null;
  // o processo velho vai morrer: o chat deixa de estar ocupado e a fila morre com ele
  P.busy = false; P.queued = null; escondePerm(P);
  // try/finally: se qualquer coisa tropecar aqui no meio, a trava TEM de sair, senao o botao
  // de trocar de motor fica morto para sempre naquele chat
  try {
    pararTrabalho(P); limparPassos(P);
    fillModels(P); paintEngine(P); pintarModo(P); setDot(P, 'off');
    // O contexto e o recado da troca TEM de ficar prontos antes do await. Como o desenho ja
    // mudou, ele confia e escreve na hora; se estas duas linhas ficassem depois, a primeira
    // mensagem saia sem a conversa anterior e a seguinte levava tudo colado, fora de hora.
    if (P.hist.length) P.passarContexto = montarContexto(P);
    marcaTroca(P, antigo, novo === 'codex' ? 'Codex' : 'Claude');
    try { await window.api.paneStop({ paneId: P.id, engine: velho }); } catch {}
  } finally {
    P.trocando = false;
  }
  cfg.lastEngine = novo; window.api.setConfig(cfg);
  pintarUso(P); lerUso(P.engine); savePanes();   // nao zera o "ja fechei": ele nao pediu o aviso de volta
}

function montarContexto(P, retomada) {
  const LIM = 14000;
  const linhas = [];
  for (let i = P.hist.length - 1; i >= 0; i--) {
    const h = P.hist[i];
    const t = '### ' + h.quem + ':\n' + (h.texto || '').trim();
    if (linhas.join('\n\n').length + t.length > LIM) break;
    linhas.unshift(t);
  }
  // retomada = a conexao caiu e o numero da conversa se perdeu. Aqui o risco nao e recomecar do
  // zero: e pegar carona no resumo de OUTROS chats da mesma pasta, que o arranque injeta sozinho.
  if (retomada) {
    return 'ATENÇÃO: esta conversa caiu (limite de uso ou internet) e voltou como sessão nova. '
      + 'IGNORE qualquer resumo de trabalhos anteriores, memória do projeto ou contexto de outras '
      + 'conversas que tenha vindo no início desta sessão: NADA daquilo é o que estávamos fazendo. '
      + 'O trabalho desta conversa é EXCLUSIVAMENTE o que está abaixo. Se o que está abaixo não '
      + 'for suficiente para saber onde paramos, pergunte antes de agir — não invente nem retome '
      + 'trabalho de outro chat.\n\n'
      + '--- esta conversa até aqui ---\n' + linhas.join('\n\n') + '\n--- fim ---\n\n'
      + 'Agora, o novo pedido:\n';
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
  // A lista de modelos do Codex vem do proprio Codex e demora a chegar. Ate la, modelosDe()
  // devolve uma lista de faz-de-conta com um item so, e o modelo que ele tinha escolhido nao
  // estava nela: era apagado e o vazio ia parar no config. Enquanto a lista de verdade nao
  // chega, so pinta; nao decide nada. Quando ela chega, fillModels roda de novo (linha do
  // codexModels().then) e a escolha certa aparece.
  const listaReal = P.engine !== 'codex' || !!(MODELOS_CODEX && MODELOS_CODEX.length);
  if (listaReal && !ms.find(m => m.id === P.model)) P.model = (ms.find(m => m.padrao) || ms[0]).id;
  const ef = esforcosDe(P);
  if (listaReal && !ef.find(e => e.id === P.effort)) P.effort = modeloAtual(P).padraoEffort || ef[Math.min(2, ef.length - 1)].id;
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
  if (!P) return;
  const A = abaDe(P);
  if (A) { A.ativo = P.id; if (abaAtiva !== A) ativarAbaProjeto(A); }
  if (focusPane === P) return;
  focusPane = P;
  for (const q of panes.values()) q.el.classList.toggle('focus', q === P);
  loadTree(P.cwd);
  $('#tbTitle').textContent = shortPath(P.cwd) + '  ·  ' + (P.engine === 'codex' ? 'Codex' : 'Claude');
  const pn = $('#projName'); if (pn) pn.textContent = nomePasta(P.cwd);
}
/* Fechar um chat que esta TRABALHANDO joga a resposta fora e mata o comando no meio. Com o
   mouse ainda da pra perceber; com Cmd+W e um teclado no automatico, nao. Entao so pergunta
   quando ha trabalho em andamento — chat parado fecha direto, como sempre. */
/* Matar o motor deste chat sem deixar rastro. O processo morto NUNCA mais manda "terminou"
   (no Claude o close sai calado porque foi parada de proposito; no Codex o apontamento
   thread->painel some junto), entao quem zera o "ocupado", a fila e a tarja de permissao tem
   de ser a tela, aqui, na hora. Sem isto o chat ficava preso em "trabalhando..." para sempre
   e toda mensagem seguinte virava "Na fila". */
async function desligarMotor(P) {
  try { await window.api.paneStop({ paneId: P.id, engine: P.engine }); } catch {}
  P.started = false;
  P.busy = false;
  if (P.queued) { const cx = $('.p-input', P.el); if (cx && !cx.value) cx.value = P.queued; P.queued = null; }
  pararTrabalho(P); limparPassos(P);
  escondePerm(P);
  setDot(P, 'off');
}

async function closePane(id, semPerguntar) {
  const P = panes.get(id); if (!P) return;
  if (P.busy && !semPerguntar) {
    const nome = (P.titulo || '').trim().slice(0, 40) || 'este chat';
    if (!confirm('O ' + (P.engine === 'codex' ? 'Codex' : 'Claude') + ' está trabalhando em “' + nome + '”.\n\nFechar agora joga fora o que ele está fazendo. Fechar mesmo assim?')) return;
  }
  const A = abaDe(P);
  guardarFechado(P);   // fechou sem querer? dá para trazer de volta
  // terminal embutido aberto neste chat morre junto, senao sobra processo vivo escondido
  if (P.fecharTerminal) { const f = P.fecharTerminal; P.fecharTerminal = null; try { f(); } catch {} }
  // Parar o Codex pode levar ate 1,5s (ele espera o turn/interrupt) e na VPS vai por ssh.
  // O chat tem de sumir no clique: o processo principal termina de matar o turno sozinho.
  window.api.paneStop({ paneId: id, engine: P.engine }).catch(() => {});
  P.el.remove(); panes.delete(id);
  marcarAbertas();          // fechou o chat: a borda da conversa na lista apaga junto
  if (focusPane === P) focusPane = null;
  if (!A) return;
  const i = A.ordem.indexOf(id);
  if (i >= 0) A.ordem.splice(i, 1);
  if (A.ativo === id) A.ativo = A.ordem[Math.max(0, i - 1)] || A.ordem[0] || null;
  if (!A.ordem.length) { fecharAba(A); return; }   // aba sem chat nenhum some junto
  remontarEspaco(A);
  igualarChats();
  pintarAba(A);
  const viz = panes.get(A.ordem[Math.max(0, i - 1)]) || panes.get(A.ordem[0]);
  if (viz) setFocus(viz);
  savePanes();
}
function pintarTokens(P) {
  pintarAnel(P);
  const el = $('.p-tokens', P.el);
  if (!el) return;
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

async function compactarConversa(P) {
  if (P.busy) { avisoEnvio(P, 'Espere ele terminar para resumir a conversa.'); return; }
  P.busy = true; setDot(P, 'busy'); trabalhando(P, 'resumindo a conversa');
  const r = await window.api.paneCompactar({ paneId: P.id, engine: P.engine });
  if (r && r.error) {
    P.busy = false; setDot(P, 'idle'); pararTrabalho(P);
    avisoEnvio(P, 'Não deu para resumir: ' + r.error);
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
  { const A = abaDe(P); if (A) pintarAba(A); }
  $('.p-stop', P.el).classList.toggle('hidden', state !== 'busy');
  $('.p-send', P.el).disabled = false;   // dá para enviar durante o trabalho: vai pela fila ou entra nele
}

/* ============ desenho das mensagens ============ */
function clearEmpty(P) { const e = $('.pane-empty', P.el); if (e) e.remove(); }
// conversa zerada: volta o "Escreva embaixo pra começar" com o logo do motor certo
function voltarVazio(P) {
  P.chat.innerHTML = '<div class="pane-empty"><div class="pe-logo"></div>'
    + '<div class="pe-txt">Escreva embaixo pra começar</div></div>';
  paintEngine(P);
}

const soNome = (c) => String(c || '').split('/').pop();
function fraseDoPasso(nome, arg) {
  const a = String(arg || '').replace(/\s+/g, ' ').trim();
  const curto = a.length > 70 ? a.slice(0, 70) + '…' : a;
  const f = fraseCrua(nome, a, curto);
  f.cmd = String(arg || '').trim();          // o comando inteiro, pro bloco que abre
  return f;
}
function fraseCrua(nome, a, curto) {
  switch (nome) {
    case 'Terminal': case 'Bash': return { txt: 'Terminal', det: curto };
    case 'Read': return { txt: 'Lendo', det: soNome(a) };
    case 'Write': return { txt: 'Criando', det: soNome(a) };
    case 'Edit': case 'Editando arquivo': return { txt: 'Editando', det: soNome(a) };
    case 'Grep': case 'Buscando no código': return { txt: 'Buscando no código', det: curto };
    case 'Glob': case 'Procurando arquivos': return { txt: 'Procurando arquivos', det: curto };
    case 'WebSearch': case 'Pesquisando na web': return { txt: 'Pesquisando na web', det: curto };
    case 'WebFetch': case 'Abrindo link': return { txt: 'Abrindo a página', det: curto };
    case 'Task': case 'Agente': return { txt: 'Agente', det: curto };
    case 'TodoWrite': case 'Lista de tarefas': return { txt: 'Organizando as tarefas', det: '' };
    case 'Skill': return { txt: 'Usando a skill', det: curto };
    default: return { txt: toolLabel(nome), det: curto };
  }
}

/* ---- execucao: cartao de comandos, no layout do Claude Code na web ---- */
function grupoExec(P) {
  let g = P.execEl;
  if (!g || !g.isConnected) {
    g = document.createElement('div');
    g.className = 'exec';
    g.innerHTML = '<div class="exec-hd"><span class="exec-nm2"></span>'
      + '<span class="exec-cv">' + ico('chevron-right') + '</span></div>'
      + '<div class="exec-card"></div>';
    $('.exec-hd', g).addEventListener('click', () => {
      g.classList.toggle('aberto');
      scroll(P);
    });
    P.chat.appendChild(g);
    P.execEl = g;
  }
  return g;
}

function tituloGrupo(g) {
  const n = $('.exec-card', g).children.length;
  g.classList.toggle('solo', n === 1);
  $('.exec-nm2', g).textContent = n === 1
    ? 'Executado 1 comando'
    : 'Executado ' + n + ' comandos';
}

function passo(P, frase, id) {
  if (!P.busy) return;
  clearEmpty(P);
  const g = grupoExec(P);
  const card = $('.exec-card', g);
  const d = document.createElement('div');
  d.className = 'exec-it';
  if (id) d.dataset.id = id;
  d.innerHTML = '<div class="exec-t"><span class="exec-nm"></span>'
    + '<span class="exec-cv">' + ico('chevron-right') + '</span></div>'
    + '<div class="exec-bd"><div class="exec-cmd"><span class="exec-cifr">$&nbsp;</span>'
    + '<span class="exec-arg"></span></div><div class="exec-out"></div></div>';
  $('.exec-nm', d).textContent = frase.det ? frase.txt + ' · ' + frase.det : frase.txt;
  $('.exec-arg', d).textContent = frase.cmd || frase.det || frase.txt;
  $('.exec-t', d).addEventListener('click', () => { d.classList.toggle('aberto'); scroll(P); });
  card.appendChild(d);
  tituloGrupo(g);
  P.chat.appendChild(g);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P);
  return d;
}

function passoPronto(P, id, erro) {
  const g = P.execEl;
  if (!g) return;
  const d = [...$('.exec-card', g).children].reverse().find(x => x.dataset.id === id);
  if (d && erro) d.classList.add('erro');
}

function limparPassos(P) { P.execEl = null; }


function trabalhando(P, oque) {
  if (!P.busy) return;              // terminou? entao nao mostra nada
  clearEmpty(P);
  let t = P.trabEl;
  if (!t || !t.isConnected) {
    t = document.createElement('div');
    t.className = 'trab';
    t.innerHTML = '<span class="trab-ast">' + svgMotor(P.engine) + '</span><span class="trab-txt"></span>';
    P.chat.appendChild(t);
    P.trabEl = t;
    P.trabT0 = Date.now();
    clearInterval(P.trabTimer);
    P.trabTimer = setInterval(() => pintaTrab(P), 1000);
  }
  if (oque !== undefined) P.trabOque = oque || '';
  pintaTrab(P);
  P.chat.appendChild(t);            // mantem sempre no fim
  scroll(P);
}
function pintaTrab(P) {
  const t = P.trabEl;
  if (!t || !t.isConnected) { clearInterval(P.trabTimer); P.trabTimer = null; return; }
  const s = Math.max(0, Math.round((Date.now() - (P.trabT0 || Date.now())) / 1000));
  const tempo = s < 60 ? s + 's' : Math.floor(s / 60) + 'min ' + (s % 60) + 's';
  $('.trab-txt', t).textContent = tempo + ' · ' + (P.trabOque || 'trabalhando');
}
function pararTrabalho(P) {
  clearInterval(P.trabTimer); P.trabTimer = null;
  if (P.trabEl) { P.trabEl.remove(); P.trabEl = null; }
}
function atBottom(P) { return P.chat.scrollHeight - P.chat.scrollTop - P.chat.clientHeight < 100; }
function scroll(P, force) {
  // aba no fundo nao tem altura: guardo para rolar quando ela aparecer, e marco que chegou coisa nova
  const A = abaDe(P);
  if (A && abaAtiva !== A) {
    P.precisaRolar = true;
    A.el.classList.add('nova');
    return;
  }
  if (force || atBottom(P)) P.chat.scrollTop = P.chat.scrollHeight;
}

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
  // marca onde esta mensagem entra na fila de edições: é o que permite voltar no tempo
  d.dataset.edicoes = String((P.edicoes || []).length);
  d.dataset.hist = String(P.hist.length);
  botoesDaMinhaMensagem(P, d, text);
  P.chat.appendChild(d); scroll(P, true);
  P.hist.push({ quem: 'Você', texto: text });
}

/* ---- na minha própria mensagem: corrigir e mandar de novo, ou voltar no tempo ---- */
function botoesDaMinhaMensagem(P, d, texto) {
  const barra = barraDeAcoes(d);
  const bEdit = document.createElement('button');
  bEdit.className = 'msg-bt'; bEdit.title = 'Corrigir e mandar de novo'; bEdit.innerHTML = ico('pencil');
  bEdit.onclick = () => editarMinhaMensagem(P, d, texto);
  const bCopia = botaoCopiar('Copiar o que eu escrevi', () => texto);
  const bVolta = document.createElement('button');
  bVolta.className = 'msg-bt'; bVolta.title = 'Voltar no tempo até aqui'; bVolta.innerHTML = ico('rotate-cw');
  bVolta.onclick = () => menuVoltarNoTempo(P, d, texto);
  barra.appendChild(bCopia); barra.appendChild(bEdit); barra.appendChild(bVolta);
}

function editarMinhaMensagem(P, d, texto) {
  if ($('.msg-edita', d)) return;
  const corpo = $('.msg-body', d);
  const cx = document.createElement('div');
  cx.className = 'msg-edita';
  cx.innerHTML = '<textarea class="me-txt"></textarea>'
    + '<div class="me-bts"><button class="me-x">Cancelar</button>'
    + '<button class="me-ok destaque">Mandar de novo</button></div>';
  const ta = $('.me-txt', cx);
  ta.value = texto;
  corpo.style.display = 'none';
  d.insertBefore(cx, corpo.nextSibling);
  const fim = () => { cx.remove(); corpo.style.display = ''; };
  $('.me-x', cx).onclick = fim;
  $('.me-ok', cx).onclick = () => {
    const novo = ta.value.trim();
    fim();
    if (!novo) return;
    const inp = $('.p-input', P.el);
    inp.value = novo;
    inp.dispatchEvent(new Event('input'));
    send(P);
  };
  ta.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('.me-ok', cx).click(); }
    if (e.key === 'Escape') { e.preventDefault(); fim(); }
  });
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.style.height = Math.min(ta.scrollHeight + 4, 260) + 'px';
}

/* ---- voltar no tempo ----
   Desfazer o código é de verdade: cada edição guardou o antes e o depois, então basta
   aplicar o contrário, de trás para frente. Voltar a CONVERSA o motor não deixa (a sessão
   dele não anda para trás), então o que se faz é abrir um chat novo levando o que foi dito
   até aquele ponto — que é a ramificação. */
function menuVoltarNoTempo(P, d, texto) {
  const desde = Number(d.dataset.edicoes || 0);
  const feitas = (P.edicoes || []).slice(desde);
  const m = novoMenu(P);
  m.appendChild(tituloPopup('Voltar até aqui'));
  m.appendChild(subPopup('"' + texto.slice(0, 60).replace(/\s+/g, ' ') + (texto.length > 60 ? '…' : '') + '"'));
  m.appendChild(elItem({
    ic: 'rotate-cw',
    nome: 'Desfazer o código feito depois daqui',
    desc: feitas.length ? feitas.length + ' edição(ões) para desfazer' : 'nada foi editado depois desta mensagem',
  }, () => desfazerDaqui(P, feitas)));
  m.appendChild(elItem({
    ic: 'sparkles',
    nome: 'Ramificar a conversa a partir daqui',
    desc: 'abre um chat novo levando só o que foi dito até este ponto',
  }, () => ramificarDaqui(P, d)));
}

async function desfazerDaqui(P, feitas) {
  if (!feitas.length) { avisoEnvio(P, 'Nada foi editado depois dessa mensagem.'); return; }
  let ok = 0; const problemas = [];
  // de trás para frente: a última edição é a primeira a sair, senão o texto não bate mais
  for (let i = feitas.length - 1; i >= 0; i--) {
    const ed = feitas[i];
    for (let j = (ed.partes || []).length - 1; j >= 0; j--) {
      const p = ed.partes[j];
      const r = await window.api.desfazerEdicao({ arquivo: ed.arquivo, antes: p.antes, depois: p.depois });
      if (r && r.ok) ok++; else problemas.push(nomePasta(ed.arquivo) + ': ' + ((r && r.error) || 'erro'));
    }
  }
  avisoTemp(P, ok + ' mudança(s) desfeita(s)' + (problemas.length ? ' · ' + problemas.length + ' não deu: ' + problemas[0] : ''));
}

function ramificarDaqui(P, d) {
  const ate = Number(d.dataset.hist || 0);
  const pedaco = P.hist.slice(0, ate + 1);
  if (panes.size >= 12) { avisoEnvio(P, 'Feche um chat para abrir a ramificação.'); return; }
  const Q = novoChatNaAba(P.engine);
  if (!Q) return;
  Q.cwd = P.cwd;
  $('.p-cwd', Q.el).textContent = nomePasta(Q.cwd);
  Q.hist = pedaco.slice();
  Q.passarContexto = pedaco.map(h => '### ' + h.quem + ':\n' + (h.texto || '').trim()).join('\n\n');
  Q.titulo = 'Ramo de: ' + (P.titulo || 'conversa'); Q.nomeManual = true;
  pintarNome(Q);
  avisoTemp(Q, 'Este chat continua de onde aquela mensagem estava. O chat de origem segue intacto.');
  $('.p-input', Q.el).focus();
}
function pintarAvatar(el) {
  if (cfg.foto) el.innerHTML = '<img src="' + cfg.foto + '" alt="">';
  else el.innerHTML = ico('user');
}
function repintarAvatares() { $$('.msg.user .av').forEach(pintarAvatar); $('#fotoPrev') && pintarAvatar($('#fotoPrev')); }

function botBlock(P, key, semNome) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'msg bot' + (semNome ? ' emenda' : '');
  d.innerHTML = (semNome ? '' : '<div class="msg-role"><span class="av">' + svgMotor(P.engine) + '</span>'
    + (P.engine === 'codex' ? 'Codex' : 'Claude') + '</div>') + '<div class="msg-body"></div>';
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
  const depoisDeComando = P.execEl && P.execEl.isConnected;
  if (!b || P.blocks.get('respKey') !== key || depoisDeComando) {
    // texto que vem depois de comandos entra num bloco novo, abaixo do cartao
    if (b && !depoisDeComando) { b.raw = ''; b.el.innerHTML = ''; }
    else { b = botBlock(P, 'resp', depoisDeComando); }
    P.blocks.set('respKey', key);
    P.blocks.set('resp', b);
    P.execEl = null;                                  // proximo comando abre cartao novo
  }
  b.raw += text; b.el.innerHTML = marked.parse(b.raw);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P);
}
let ultimoPensar = 0;
function thinkDelta(P, text) {
  trabalhando(P, 'pensando');
  const agora = Date.now();
  if (agora - ultimoPensar > 8000) ultimoPensar = agora;
}
/* ---- buscar DENTRO da conversa aberta (⌘F) ----
   Conversa de tres horas so se navegava rolando. Aqui as ocorrencias sao marcadas de amarelo
   e o Enter pula de uma para a outra. Nao usa o buscador do Chrome porque ele procura na tela
   inteira: acharia coisa nos outros chats abertos ao lado. */
const NAO_ENTRAR = ['SCRIPT', 'STYLE', 'MARK', 'INPUT', 'TEXTAREA', 'BUTTON', 'SVG'];

function limparAchados(P) {
  if (!P.achados || !P.achados.length) { P.achados = null; return; }
  for (const m of P.achados) {
    const pai = m.parentNode;
    if (!pai) continue;
    pai.replaceChild(document.createTextNode(m.textContent), m);
    pai.normalize();
  }
  P.achados = null; P.achouI = -1;
}

function buscarNaConversa(P, termo) {
  limparAchados(P);
  const t = (termo || '').trim();
  const marcas = [];
  if (t) {
    const alvo = t.toLowerCase();
    const andar = (no) => {
      for (const f of [...no.childNodes]) {
        if (f.nodeType === 3) {
          const txt = f.textContent, baixo = txt.toLowerCase();
          let i = baixo.indexOf(alvo);
          if (i < 0) continue;
          const frag = document.createDocumentFragment();
          let ult = 0;
          while (i >= 0) {
            if (i > ult) frag.appendChild(document.createTextNode(txt.slice(ult, i)));
            const m = document.createElement('mark');
            m.className = 'acha'; m.textContent = txt.slice(i, i + t.length);
            frag.appendChild(m); marcas.push(m);
            ult = i + t.length;
            i = baixo.indexOf(alvo, ult);
          }
          if (ult < txt.length) frag.appendChild(document.createTextNode(txt.slice(ult)));
          f.parentNode.replaceChild(frag, f);
        } else if (f.nodeType === 1 && !NAO_ENTRAR.includes(f.tagName)) andar(f);
      }
    };
    andar(P.chat);
  }
  P.achados = marcas;
  P.achouI = marcas.length ? 0 : -1;
  irAoAchado(P, 0);
}

function irAoAchado(P, passo) {
  const lista = P.achados || [];
  const cx = $('.pb-conta', P.el);
  if (!lista.length) { if (cx) cx.textContent = P.buscaTermo ? 'nada' : ''; return; }
  P.achouI = ((P.achouI + passo) % lista.length + lista.length) % lista.length;
  lista.forEach((m, i) => m.classList.toggle('agora', i === P.achouI));
  lista[P.achouI].scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (cx) cx.textContent = (P.achouI + 1) + ' de ' + lista.length;
}

function abrirBuscaConversa(P) {
  if (!P) return;
  let barra = $('.p-busca', P.el);
  if (!barra) {
    barra = document.createElement('div');
    barra.className = 'p-busca';
    barra.innerHTML = '<span class="pb-ic">' + ico('search') + '</span>'
      + '<input class="pb-inp" placeholder="Buscar nesta conversa…" spellcheck="false">'
      + '<span class="pb-conta"></span>'
      + '<button class="pb-bt" data-vai="-1" title="Anterior">' + ico('chevron-down') + '</button>'
      + '<button class="pb-bt pb-baixo" data-vai="1" title="Próximo">' + ico('chevron-down') + '</button>'
      + '<button class="pb-bt pb-x" title="Fechar (Esc)">' + ico('x') + '</button>';
    P.chat.parentElement.insertBefore(barra, P.chat);
    const inp = $('.pb-inp', barra);
    let timer = 0;
    inp.addEventListener('input', () => {
      clearTimeout(timer);
      P.buscaTermo = inp.value;
      timer = setTimeout(() => buscarNaConversa(P, inp.value), 160);
    });
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); irAoAchado(P, e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') { e.preventDefault(); fecharBuscaConversa(P); }
    });
    $$('.pb-bt[data-vai]', barra).forEach(b => b.onclick = () => irAoAchado(P, Number(b.dataset.vai)));
    $('.pb-x', barra).onclick = () => fecharBuscaConversa(P);
  }
  barra.classList.remove('hidden');
  const inp = $('.pb-inp', barra);
  inp.focus(); inp.select();
}

function fecharBuscaConversa(P) {
  const barra = $('.p-busca', P.el);
  if (barra) barra.classList.add('hidden');
  P.buscaTermo = '';
  limparAchados(P);
  $('.p-input', P.el).focus();
}

/* ---- o cerebro preferido de cada pasta ----
   Cliente pesado merece Opus, rascunho nao. Escolher na mao toda vez fazia ele cair no modelo
   errado e queimar limite a toa. A escolha fica colada na PASTA (e no motor), nao no chat. */
function chaveDaPasta(P) { return (P.cwd || '') + '|' + P.engine; }
function lembrarEscolhaDaPasta(P) {
  if (!P.cwd) return;
  cfg.porPasta = cfg.porPasta || {};
  cfg.porPasta[chaveDaPasta(P)] = { model: P.model || '', effort: P.effort || '' };
  window.api.setConfig(cfg);
}
function aplicarEscolhaDaPasta(P) {
  const g = cfg.porPasta && cfg.porPasta[chaveDaPasta(P)];
  if (!g) return false;
  if (g.model && modelosDe(P).some(m => m.id === g.model)) P.model = g.model;
  if (g.effort && esforcosDe(P).some(e => e.id === g.effort)) P.effort = g.effort;
  fillModels(P);
  return true;
}

/* ---- a mesma pergunta nos dois motores (⌘D) ----
   Dava para abrir Claude e Codex lado a lado, mas a pergunta era digitada duas vezes. */
async function perguntarAosDois(P) {
  const inp = $('.p-input', P.el);
  const texto = inp.value.trim();
  if (!texto) { avisoEnvio(P, 'Escreva a pergunta primeiro — ela vai para os dois.'); return; }
  const outro = P.engine === 'codex' ? 'claude' : 'codex';
  const A = abaDe(P);
  let Q = A ? A.ordem.map(id => panes.get(id)).find(q => q && q !== P && q.engine === outro) : null;
  if (!Q) {
    if (panes.size >= 12) { avisoEnvio(P, 'Feche um chat para abrir o outro motor.'); return; }
    Q = novoChatNaAba(outro);
    if (!Q) return;
    Q.cwd = P.cwd;                       // os dois olham a MESMA pasta, senao a resposta muda
    $('.p-cwd', Q.el).textContent = nomePasta(Q.cwd);
    aplicarEscolhaDaPasta(Q);
  }
  const outroInp = $('.p-input', Q.el);
  outroInp.value = texto;
  outroInp.dispatchEvent(new Event('input'));
  await send(P);
  await send(Q);
  setFocus(P);
}

/* ---- guardar a conversa no Obsidian ----
   Texto mora no vault, nao no chat. Copiar e colar na mao dava tanto trabalho que nunca ia. */
async function salvarConversaNoVault(P) {
  if (!P.hist.length) { avisoEnvio(P, 'Esta conversa ainda está vazia.'); return; }
  const linhas = P.hist.map(h => '## ' + (h.quem === 'Você' ? 'Homero' : h.quem) + '\n\n' + (h.texto || '').trim());
  const r = await window.api.salvarNoVault({
    titulo: (P.titulo || 'Conversa do Cockpit').trim(),
    cwd: P.cwd,
    motor: P.engine === 'codex' ? 'Codex' : 'Claude',
    texto: linhas.join('\n\n'),
  });
  if (!r || r.error) { avisoEnvio(P, 'Não deu para salvar: ' + ((r && r.error) || 'erro')); return; }
  avisoTemp(P, 'Guardado no Obsidian em ' + r.curto);
}

/* ---- ditar em vez de digitar ----
   Roda no proprio Mac (whisper.cpp), sem internet e sem custo. Aperta, fala, solta. */
const DITADO = { rec: null, pedacos: [], P: null };
async function alternarDitado(P) {
  if (DITADO.rec && DITADO.P === P) { pararDitado(); return; }
  if (DITADO.rec) pararDitado();
  let fluxo;
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    avisoEnvio(P, 'Não consegui usar o microfone. Libere em Ajustes do Sistema › Privacidade › Microfone.');
    return;
  }
  DITADO.pedacos = []; DITADO.P = P;
  DITADO.rec = new MediaRecorder(fluxo);
  DITADO.rec.ondataavailable = (e) => { if (e.data && e.data.size) DITADO.pedacos.push(e.data); };
  DITADO.rec.onstop = async () => {
    fluxo.getTracks().forEach(t => t.stop());
    const bt = $('.p-mic', P.el);
    if (bt) { bt.classList.remove('gravando'); bt.classList.add('pensando'); }
    const blob = new Blob(DITADO.pedacos, { type: 'audio/webm' });
    DITADO.rec = null; DITADO.pedacos = []; DITADO.P = null;
    if (blob.size < 2000) { if (bt) bt.classList.remove('pensando'); return; }
    const b64 = await new Promise(ok => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1] || '');
      fr.readAsDataURL(blob);
    });
    const r = await window.api.ditar({ audio: b64 });
    if (bt) bt.classList.remove('pensando');
    if (!r || r.error) { avisoEnvio(P, 'Não entendi o áudio: ' + ((r && r.error) || 'erro')); return; }
    const inp = $('.p-input', P.el);
    inp.value = (inp.value ? inp.value.replace(/\s*$/, ' ') : '') + (r.texto || '').trim();
    inp.dispatchEvent(new Event('input'));
    inp.focus();
  };
  DITADO.rec.start();
  const bt = $('.p-mic', P.el);
  if (bt) bt.classList.add('gravando');
  avisoEnvio(P, 'Gravando. Clique no microfone de novo (ou ⌘⇧D) quando terminar de falar.');
}
function pararDitado() {
  if (DITADO.rec && DITADO.rec.state !== 'inactive') DITADO.rec.stop();
}

/* ---- avisar quando a resposta fica pronta ----
   So avisa se ele NAO estiver na janela e se a espera tiver valido a pena (menos de 8s ele
   ainda esta olhando a tela; recado nessa hora e barulho). */
const ESPERA_PRA_AVISAR = 8000;
function avisarQueTerminou(P) {
  if (!P.busy || !P.comecouEm) return;
  const demorou = Date.now() - P.comecouEm;
  P.comecouEm = 0;
  if (demorou < ESPERA_PRA_AVISAR || document.hasFocus()) return;
  const b = P.blocks.get('resp');
  const resposta = (b && b.raw ? b.raw : '').replace(/[#*`>_-]/g, ' ').replace(/\s+/g, ' ').trim();
  const onde = (P.titulo || nomePasta(P.cwd) || 'Cockpit').slice(0, 50);
  window.api.avisarPronto({
    paneId: P.id,
    titulo: (P.engine === 'codex' ? 'Codex' : 'Claude') + ' terminou · ' + onde,
    texto: resposta || 'A resposta está pronta.',
  });
}

/* ---- copiar com um clique: a resposta inteira e cada bloco de codigo ----
   Antes nao havia botao nenhum: a unica saida era arrastar o mouse pelo texto. */
async function copiarTexto(txt, botao) {
  // quem copia e o processo principal: dentro do app o clipboard do navegador as vezes e
  // barrado, e um botao de copiar que as vezes nao copia e pior do que nao ter botao
  try { await window.api.copiar(txt); }
  catch { try { await navigator.clipboard.writeText(txt); } catch { return; } }
  if (!botao) return;
  const antes = botao.innerHTML;
  botao.innerHTML = ico('check');
  botao.classList.add('copiou');
  setTimeout(() => { botao.innerHTML = antes; botao.classList.remove('copiou'); }, 1400);
}
function botaoCopiar(titulo, pegarTexto) {
  const b = document.createElement('button');
  b.className = 'bt-copiar'; b.title = titulo; b.innerHTML = ico('copy');
  b.addEventListener('click', (e) => { e.stopPropagation(); copiarTexto(pegarTexto(), b); });
  return b;
}
/* a barrinha de ações mora no PÉ da mensagem, dentro do bloco de texto — não flutuando por cima */
function barraDeAcoes(msg) {
  let barra = $('.msg-acoes', msg);
  if (!barra) {
    barra = document.createElement('div');
    barra.className = 'msg-acoes';
    msg.appendChild(barra);
  }
  return barra;
}

function botoesDeCopia(b) {
  const msg = b.el.closest('.msg');
  if (msg && !$('.bt-copiar.da-msg', msg)) {
    const bt = botaoCopiar('Copiar a resposta', () => b.raw || b.el.innerText);
    bt.classList.add('da-msg');
    barraDeAcoes(msg).appendChild(bt);
  }
  // cada innerHTML novo joga fora os botoes de codigo antigos: refazer sempre
  for (const pre of b.el.querySelectorAll('pre')) {
    if ($('.bt-copiar', pre)) continue;
    pre.classList.add('com-copia');
    pre.appendChild(botaoCopiar('Copiar o código', () => (pre.querySelector('code') || pre).innerText));
  }
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
  const depoisDeComando = P.execEl && P.execEl.isConnected;
  if (!b || P.blocks.get('respKey') !== key || depoisDeComando) {
    if (b && !depoisDeComando) { b.raw = ''; b.el.innerHTML = ''; }
    else { b = botBlock(P, 'resp', depoisDeComando); }
    P.blocks.set('respKey', key); P.blocks.set('resp', b);
    P.execEl = null;
  }
  b.raw = text; b.el.innerHTML = marked.parse(text);
  linkarArquivos(P, b.el); marcarLinksWeb(b.el); botoesDeCopia(b);
  if (P.trabEl) P.chat.appendChild(P.trabEl);
  scroll(P);
  const quem = P.engine === 'codex' ? 'Codex' : 'Claude';
  const ult = P.hist[P.hist.length - 1];
  if (ult && ult.quem === quem) ult.texto = text; else P.hist.push({ quem, texto: text });
}
/* ============ antes e depois de cada edição ============
   O motor mexe no arquivo e a tela mostrava só o nome dele. Aqui a mudança aparece pintada:
   vermelho o que saiu, verde o que entrou — e um botão que desfaz aquele pedaço. */

/* diff por linhas. LCS puro estoura em arquivo grande (matriz N×M), então acima do teto
   a tela mostra os dois blocos inteiros em vez de casar linha a linha. */
const DIFF_TETO = 500;
function linhasDoDiff(antes, depois) {
  const a = String(antes || '').split('\n');
  const b = String(depois || '').split('\n');
  if (a.length > DIFF_TETO || b.length > DIFF_TETO) {
    return [...a.filter((_, i) => i < DIFF_TETO).map(t => ({ t: '-', txt: t })),
            ...b.filter((_, i) => i < DIFF_TETO).map(t => ({ t: '+', txt: t }))];
  }
  // tabela do maior pedaço em comum
  const m = a.length, n = b.length;
  const tab = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      tab[i][j] = a[i] === b[j] ? tab[i + 1][j + 1] + 1 : Math.max(tab[i + 1][j], tab[i][j + 1]);
    }
  }
  const saida = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { saida.push({ t: ' ', txt: a[i] }); i++; j++; }
    else if (tab[i + 1][j] >= tab[i][j + 1]) { saida.push({ t: '-', txt: a[i] }); i++; }
    else { saida.push({ t: '+', txt: b[j] }); j++; }
  }
  while (i < m) saida.push({ t: '-', txt: a[i++] });
  while (j < n) saida.push({ t: '+', txt: b[j++] });
  return saida;
}

/* patch unificado (o Codex às vezes já manda pronto) vira as mesmas linhas coloridas */
function linhasDoPatch(patch) {
  return String(patch || '').split('\n')
    .filter(l => !/^(diff |index |--- |\+\+\+ )/.test(l))
    .map(l => l.startsWith('+') ? { t: '+', txt: l.slice(1) }
            : l.startsWith('-') ? { t: '-', txt: l.slice(1) }
            : l.startsWith('@@') ? { t: '@', txt: l }
            : { t: ' ', txt: l.replace(/^ /, '') });
}

/* esconde o miolo que ninguém precisa ver: 3 linhas de contexto em volta de cada mudança */
const CONTEXTO = 3;
function comContexto(linhas) {
  const perto = new Set();
  linhas.forEach((l, i) => {
    if (l.t === ' ') return;
    for (let k = i - CONTEXTO; k <= i + CONTEXTO; k++) if (k >= 0 && k < linhas.length) perto.add(k);
  });
  const saida = [];
  let pulando = 0;
  linhas.forEach((l, i) => {
    if (perto.has(i)) {
      if (pulando) { saida.push({ t: '@', txt: '⋯ ' + pulando + ' linha' + (pulando > 1 ? 's' : '') + ' sem mudança' }); pulando = 0; }
      saida.push(l);
    } else pulando++;
  });
  if (pulando) saida.push({ t: '@', txt: '⋯ ' + pulando + ' linha' + (pulando > 1 ? 's' : '') + ' sem mudança' });
  return saida;
}

function cartaoDeDiff(P, ed) {
  const cx = document.createElement('div');
  cx.className = 'dif';
  const nome = (ed.arquivo || '').split('/').pop();
  const partes = ed.patch ? [{ patch: ed.patch }] : (ed.partes || []);
  let mais = 0, menos = 0;
  const corpos = [];

  for (const p of partes) {
    const cru = p.patch ? linhasDoPatch(p.patch) : linhasDoDiff(p.antes, p.depois);
    for (const l of cru) { if (l.t === '+') mais++; else if (l.t === '-') menos++; }
    const bloco = document.createElement('div');
    bloco.className = 'dif-bloco';
    for (const l of comContexto(cru)) {
      const linha = document.createElement('div');
      linha.className = 'dl ' + (l.t === '+' ? 'mais' : l.t === '-' ? 'menos' : l.t === '@' ? 'pula' : 'igual');
      linha.textContent = (l.t === '@' ? '' : l.t === ' ' ? '  ' : l.t + ' ') + l.txt;
      bloco.appendChild(linha);
    }
    if (!p.patch && ed.arquivo) {
      const bt = document.createElement('button');
      bt.className = 'dif-desfaz';
      bt.textContent = 'Desfazer esta mudança';
      bt.onclick = async () => {
        bt.disabled = true; bt.textContent = 'desfazendo…';
        const r = await window.api.desfazerEdicao({ arquivo: ed.arquivo, antes: p.antes, depois: p.depois });
        if (r && r.ok) { bt.textContent = 'desfeito'; bt.classList.add('feito'); bloco.classList.add('desfeito'); }
        else { bt.disabled = false; bt.textContent = 'não deu: ' + ((r && r.error) || 'erro'); bt.classList.add('falhou'); }
      };
      bloco.appendChild(bt);
    }
    corpos.push(bloco);
  }

  const cab = document.createElement('div');
  cab.className = 'dif-hd';
  cab.innerHTML = '<span class="dif-nm"></span><span class="dif-cnt"></span>'
    + '<button class="dif-abrir" title="Abrir o arquivo">' + ico('file-text') + '</button>';
  $('.dif-nm', cab).textContent = (ed.novo ? 'criou ' : '') + nome;
  $('.dif-nm', cab).title = ed.arquivo || '';
  $('.dif-cnt', cab).innerHTML = '<b class="v">+' + mais + '</b> <b class="r">−' + menos + '</b>';
  $('.dif-abrir', cab).onclick = (e) => { e.stopPropagation(); verArquivo(P, ed.arquivo); };
  cab.addEventListener('click', () => cx.classList.toggle('fechado'));
  cx.appendChild(cab);
  for (const c of corpos) cx.appendChild(c);
  // Quem nasce fechado é o PASSO que segura este cartão (ver toolStart). Fechar o cartão aqui
  // também obrigaria a dois cliques para ver a mesma coisa. Aberto, um clique basta — e o
  // cabeçalho continua servindo de interruptor para quem quiser recolher só o diff.
  return cx;
}

/* ---- lista de tarefas: era só a frase "Organizando as tarefas" ---- */
function cartaoDeTarefas(tarefas) {
  const cx = document.createElement('div');
  cx.className = 'tar';
  for (const t of tarefas) {
    const st = String(t.status || '');
    const l = document.createElement('div');
    l.className = 'tar-l ' + (st === 'completed' ? 'ok' : st === 'in_progress' ? 'agora' : 'espera');
    l.innerHTML = '<span class="tar-ic"></span><span class="tar-t"></span>';
    $('.tar-ic', l).innerHTML = st === 'completed' ? ico('check') : st === 'in_progress' ? ico('circle') : '';
    $('.tar-t', l).textContent = (st === 'in_progress' && t.activeForm) ? t.activeForm : (t.content || '');
    cx.appendChild(l);
  }
  return cx;
}

function toolStart(P, id, name, arg, extra) {
  const d = passo(P, fraseDoPasso(name, arg), id);
  if (!d) return;
  P.tools.set(id, { el: d, out: $('.exec-out', d), buf: '' });
  const ex = extra || {};
  // Nada nasce aberto. O passo mostra só a frase do que está fazendo; o conteúdo (diff,
  // saída do comando, lista de tarefas) só aparece se ele clicar.
  if (ex.edicao) {
    const alvo = $('.exec-out', d);
    alvo.textContent = '';
    alvo.appendChild(cartaoDeDiff(P, ex.edicao));
    d.classList.add('tem-dif');
    P.tools.get(id).semTexto = true;            // o resultado cru não sobrescreve o diff
    P.edicoes = P.edicoes || [];
    P.edicoes.push(ex.edicao);                  // guardado para o "voltar no tempo"
  }
  if (ex.tarefas && ex.tarefas.length) {
    const alvo = $('.exec-out', d);
    alvo.textContent = '';
    alvo.appendChild(cartaoDeTarefas(ex.tarefas));
    P.tools.get(id).semTexto = true;
  }
}
function toolOutput(P, id, text) {
  const t = P.tools.get(id); if (!t || t.semTexto) return;
  t.buf += text;
  if (t.buf.length > 20000) t.buf = t.buf.slice(-20000);
  t.out.textContent = t.buf;
}
function toolEnd(P, id, output, isErr) {
  passoPronto(P, id, isErr);
  const t = P.tools.get(id); if (!t) return;
  if (t.semTexto && !isErr) return;      // o diff (ou a lista de tarefas) vale mais que o texto cru
  let txt = (output || t.buf || '').toString().trim();
  if (txt.length > 20000) txt = txt.slice(0, 20000) + '\n… (cortado)';
  t.out.textContent = txt;
  if (t.el.classList.contains('aberto')) scroll(P);
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
      const r = await window.api.paneSteer({ paneId: P.id, engine: P.engine, text: ENTRA_MSG + envio });
      if (nota) nota.textContent = r && r.ok
        ? 'Entregue no meio do trabalho. Ele escolhe se atende agora ou ao terminar.'
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
      /* O FIO da conversa (o id que vai no --resume) nao pode ser jogado fora enquanto o motor
         novo nao confirmar que abriu. Antes ele era zerado no instante em que o processo subia:
         se esse processo morresse antes de abrir a conversa — que e exatamente o que acontece
         quando o limite de uso ainda nao voltou ou a internet ainda esta fora — o id sumia para
         sempre. A mensagem seguinte entao subia um chat DO ZERO, e como o arranque injeta a
         memoria da PASTA (trabalhos de outros chats do mesmo cliente), o "continue" saia
         continuando o trabalho de outra conversa. O fio agora so e solto em 'sessao-sumiu'. */
      const fio = P.sessaoId || P.resumeId || null;
      P.resumeId = fio;          // guardado ate o motor confirmar que reabriu esta conversa
      P.sessaoId = null;         // sessaoId = conversa do processo VIVO; volta no evento 'sessao'
      // Rede de seguranca: sem fio e com conversa na tela, o chat nasceria cego e pegaria carona
      // na memoria de outro chat. Vai junto o que foi dito AQUI, e a ordem de ignorar o resto.
      // O contexto vai junto em silencio: a tarja vermelha aparecia no comeco de quase todo chat
      // e nao pedia nada dele. O comportamento continua igual, so o recado saiu da tela.
      if (!fio && P.hist.length && !P.passarContexto) {
        P.passarContexto = montarContexto(P, true);
        console.log('[cockpit] sem fio: mandei o contexto desta conversa junto');
      }
      await window.api.paneStart({ paneId: P.id, engine: P.engine, cwd: P.cwd, model: P.model || undefined, approval: modoDe(P).id, effort: esforcoDe(P), resumeId: fio || undefined });
      P.started = true; P.ultraAvisado = false;   // processo novo: liberar o ultracode de novo
    } catch (e) {
      setDot(P, 'off'); note(P, 'Não consegui ligar: ' + (e && e.message || e), true); return;
    }
  }
  P.busy = true; P.comecouEm = Date.now(); setDot(P, 'busy');
  P.blocks.clear(); pararTrabalho(P); limparPassos(P); trabalhando(P);
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
  try {
    const ok = await window.api.paneSend({ paneId: P.id, engine: P.engine, text: envio, effort: P.engine === 'codex' ? esforcoDe(P) : undefined });
    // false = o motor caiu antes de receber. Sem isto o chat ficava em "trabalhando..."
    // para sempre, esperando uma resposta que nunca vem.
    if (ok === false) {
      // P.started TEM de voltar a false, senao o proximo envio pula o religar e repete
      // a mesma frase para sempre. (No Claude o engine-down ja faz isso; no Codex nao vem.)
      P.started = false; P.resumeId = P.sessaoId || P.resumeId;
      P.busy = false; setDot(P, 'off'); pararTrabalho(P); limparPassos(P);
      note(P, 'O motor não estava no ar e a mensagem não chegou. Manda de novo que ele religa.', true);
      const cx = $('.p-input', P.el); if (cx && !cx.value) cx.value = text;
    }
  }
  catch (e) { P.busy = false; setDot(P, 'idle'); note(P, 'Falhou: ' + (e && e.message || e), true); }
}

/* ============ eventos vindos do motor ============ */
/* Erros que antes morriam calados agora aparecem. Vale para os dois lados:
   o processo principal manda "app:erro", e aqui na tela pegamos o que estoura no renderer.
   Sem isto, um tropeco no meio de desenhar a resposta deixava o chat preso em "trabalhando"
   para sempre, sem nenhuma pista do que houve. */
/* Arrastar um arquivo e soltar em qualquer lugar que NAO seja a caixa de texto fazia a janela
   navegar para o arquivo e a tela do Cockpit sumir. Aqui a pagina inteira recusa o "soltar";
   quem aceita de verdade e so a caixa de texto, que trata o evento antes deste. */
document.addEventListener('dragover', (e) => {
  if (e.defaultPrevented) return;                 // a caixa de texto ja aceitou este arrasto
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'none';
});
document.addEventListener('drop', (e) => { if (!e.defaultPrevented) e.preventDefault(); });

let ultimoAvisoMain = 0;
if (window.api.onErroApp) {
  window.api.onErroApp((p) => {
    console.error('erro no processo principal:', p);
    // um erro em laco mandaria uma tarja por segundo e entupiria o chat: no maximo uma a cada 15s
    const agora = Date.now();
    if (agora - ultimoAvisoMain < 15000) return;
    ultimoAvisoMain = agora;
    try {
      const alvo = focusPane || panes.values().next().value;
      if (alvo) avisoTemp(alvo, (p && p.texto) || 'Erro interno.');
    } catch {}
  });
}
let ultimoAvisoErro = 0;
window.addEventListener('error', (e) => {
  console.error('erro na tela:', e && (e.error || e.message));
  // no maximo um aviso a cada 15s, senao um erro em laco enche o chat de tarja
  const agora = Date.now();
  if (agora - ultimoAvisoErro < 15000) return;
  ultimoAvisoErro = agora;
  try {
    const alvo = focusPane || panes.values().next().value;
    if (alvo) avisoTemp(alvo, 'Deu um erro na tela: ' + ((e && (e.message || (e.error && e.error.message))) || 'sem detalhe') + '. Se algo travou, feche e abra o chat.');
  } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('promessa rejeitada na tela:', e && e.reason);
});

window.api.onPaneEvent((ev) => {
  const P = panes.get(ev.paneId); if (!P) return;
  switch (ev.kind) {
    case 'busy': P.busy = true; setDot(P, 'busy'); trabalhando(P); break;
    // o motor abriu (ou reabriu) a conversa: este id passa a ser o fio guardado
    case 'sessao': {
      const mudou = P.sessaoId !== ev.id;
      P.sessaoId = ev.id; P.resumeId = ev.id; P.sessaoFile = ev.file || '';
      // grava o fio no disco NA HORA. Antes so ia junto do proximo salvamento por outro motivo:
      // fechar o app logo depois de a conversa nascer perdia o numero dela, e ao reabrir o chat
      // voltava sem fio — a mesma armadilha de continuar o trabalho de outra conversa.
      if (mudou) savePanes();
      break;
    }
    // o Claude disse que essa conversa nao existe mais: agora sim o fio se solta
    case 'sessao-sumiu':
      P.sessaoId = null; P.resumeId = null; P.fioSolto = Date.now();
      note(P, 'Esta conversa não existe mais no Claude. A próxima mensagem começa uma nova, levando junto o que já foi dito aqui.', true);
      savePanes();
      break;
    case 'text-delta': textDelta(P, ev.id, ev.text); break;
    case 'think-delta': thinkDelta(P, ev.text); break;
    case 'text-final': textFinal(P, ev.id, ev.text); break;
    case 'tool-start': toolStart(P, ev.id, ev.name, ev.arg, { edicao: ev.edicao, tarefas: ev.tarefas }); break;
    case 'tool-output': toolOutput(P, ev.id, ev.text); break;
    case 'tool-end': toolEnd(P, ev.id, ev.output, ev.error); break;
    case 'compactou': avisoEnvio(P, 'Conversa resumida. O que importa foi mantido.'); break;
    case 'tokens':
      if (ev.janela) P.janela = ev.janela;
      P.tokens = ev.total || 0;
      pintarTokens(P);
      break;
    case 'janela': P.janela = ev.total; pintarTokens(P); break;
    case 'note': note(P, ev.text, ev.error); break;
    case 'turn-end':
      avisarQueTerminou(P);
      P.busy = false; escondePerm(P);          // o pedido morre junto com o turno
      setDot(P, 'idle'); P.blocks.clear(); pararTrabalho(P); limparPassos(P);
      setTimeout(() => { if (!P.busy) { pararTrabalho(P); limparPassos(P); } }, 400);
      // nao zera mais o histCache aqui: zerar trocava a lista por "Carregando..." e derrubava
      // busca, filtro e favorito ate a releitura terminar. O loadHist ja sobrescreve o cache.
      setTimeout(() => lerUsoAposResposta(P.engine), 1500);
      setTimeout(() => buscarNome(P), 1200);
      if (lateralAberta(P.engine)) loadHist(P.engine, true);
      if (P.queued) { const q = P.queued; P.queued = null;
        setTimeout(async () => {
          P.busy = true; setDot(P, 'busy');
          try {
            const ok = await window.api.paneSend({ paneId: P.id, engine: P.engine, text: q, effort: P.engine === 'codex' ? esforcoDe(P) : undefined });
            // se a mensagem da fila nao foi entregue, o chat NAO pode ficar preso em
            // "trabalhando" para sempre: destrava e avisa, com o texto de volta na caixa
            if (ok === false) throw new Error('nao foi entregue');
          } catch (e) {
            // sem zerar o "started" o proximo envio pula o religar e cai na MESMA tarja para
            // sempre: no Claude quem zerava era o engine-down; no Codex nao vem engine-down.
            P.busy = false; P.started = false;
            setDot(P, 'off'); pararTrabalho(P); limparPassos(P);
            note(P, 'A mensagem que estava na fila não foi enviada. Ela voltou para a caixa: é só mandar de novo.', true);
            const cx = $('.p-input', P.el); if (cx && !cx.value) { cx.value = q; }
          }
        }, 150); }
      break;
    case 'engine-down': {
      // Guardar o FIO da conversa. Sem isto, a proxima mensagem subia um motor novo sem
      // --resume e comecava outra conversa do zero, calada: a tela continuava mostrando tudo
      // que foi dito, entao parecia que ele tinha ficado burro. Na aba da VPS, onde a ssh cai
      // sozinha, isso acontecia direto.
      // O fio NUNCA se solta numa queda: se este processo abriu a conversa, o id dele manda;
      // se caiu antes de abrir, vale o que ja estava guardado. Soltar aqui (como antes) fazia
      // a conversa se perder justamente na segunda queda seguida — limite que ainda nao voltou.
      P.resumeId = P.sessaoId || P.resumeId || null;
      P.started = false; P.busy = false;
      // O motor morreu: o que estava na fila morreu junto. Guardado, ele disparava sozinho no
      // proximo fim de turno — uma pergunta velha respondida do nada, minutos depois. Volta
      // para a caixa em vez de sumir.
      if (P.queued) { const cx = $('.p-input', P.el); if (cx && !cx.value) cx.value = P.queued; P.queued = null; }
      escondePerm(P);
      setDot(P, 'off'); pararTrabalho(P); limparPassos(P);
      // se o aviso de "esta conversa nao existe mais" acabou de sair, nao repetir outro recado
      // dizendo a mesma coisa com outras palavras
      if (!(P.fioSolto && Date.now() - P.fioSolto < 5000)) {
        note(P, P.resumeId
          ? 'A conexão caiu. A próxima mensagem religa e CONTINUA esta mesma conversa.'
          : 'A conexão caiu antes de a conversa ficar salva. A próxima mensagem começa uma nova.', true);
      }
      savePanes();
      break;
    }
    case 'approval': showApproval(P, ev); break;
  }
});

/* O pedido de permissao vale so enquanto AQUELE turno daquele motor esta vivo. Sem apagar a
   tarja no fim do turno, na queda e na troca de motor, ela ficava pendurada pedindo autorizacao
   para um processo que ja morreu — e responder "sim" ali derrubava o chat que estava no lugar. */
function escondePerm(P) {
  const bar = P && P.el && $('.pane-perm', P.el);
  if (bar) bar.classList.add('hidden');
}

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
  if (!$('#tree')) return;   // a coluna de arquivos foi tirada da tela
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
/* O Codex nao tem "Plano" nem "Editar automaticamente". Antes, um modo que nao existia no
   outro motor caia no ULTIMO da lista — que e "Sem pedir permissao", o mais perigoso. Ou seja:
   por um chat no modo mais seguro e trocar pro Codex ligava o modo mais solto, calado.
   Agora cai no equivalente seguro, e no pior caso no primeiro da lista, que e "Manual". */
const MODO_EQUIVALENTE = { 'auto-edit': 'auto', plan: 'manual' };
const modoDe = (P) => {
  const lista = MODOS[P.engine] || MODOS.claude;
  return lista.find(m => m.id === P.mode)
      || lista.find(m => m.id === MODO_EQUIVALENTE[P.mode])
      || lista.find(m => m.id === 'manual')
      || lista[0];
};

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
  lembrarEscolhaDaPasta(P);
  if (P.engine === 'claude' && P.started) await desligarMotor(P);
  savePanes();
}

function avisoEnvio(P, txt) {
  clearEmpty(P);
  const d = document.createElement('div');
  d.className = 'envio-nota';
  d.textContent = txt;
  P.chat.appendChild(d);
  if (P.execEl) P.chat.appendChild(P.execEl);
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
  if (lateralAberta(P.engine)) paintHist(P.engine, lista);
}

function pintarNome(P) {
  const barra = $('.pane-nome', P.el);
  const t = (P.titulo || '').trim();
  barra.classList.toggle('vazio', !t);
  $('.pn-txt', barra).textContent = t;
  barra.title = t;
  const A = abaDe(P); if (A) pintarAba(A);
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
        if (lateralAberta(P.engine)) loadHist(P.engine, true); }
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
  // NAO grava o resultado de volta em P.mode. Gravando, um chat do Claude no modo "Plano"
  // que passasse pelo Codex (que nao tem Plano) perdia a escolha para sempre: voltava para o
  // Claude em "Manual". Agora P.mode guarda o que ELE escolheu, e o equivalente do motor
  // atual e usado so na hora de pintar e de subir o motor.
  const m = modoDe(P);
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
  // a explicação continua existindo; quando a lista é de uma linha só, ela vira o balão do mouse
  if (desc) {
    const e = document.createElement('div'); e.className = 'mi-d'; e.textContent = desc;
    $('.mi-txt', d).appendChild(e);
    d.title = nome + ' — ' + desc;
  }
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

/* ---- menu de Modos ---- */
function menuModos(P) {
  const m = novoMenu(P);
  m.appendChild(tituloPopup('Modos'));
  m.appendChild(subPopup('O que ele pode fazer sem te perguntar.'));

  for (const mo of MODOS[P.engine]) {
    m.appendChild(elItem({ ic: mo.ic, nome: mo.nome, desc: mo.desc, on: mo.id === modoDe(P).id }, async () => {
      P.mode = mo.id; cfg.defMode = mo.id; window.api.setConfig(cfg); pintarModo(P);
      await desligarMotor(P);
      note(P, 'Modo: ' + mo.nome + ' — ' + mo.desc.toLowerCase() + '. O que estava em andamento parou aqui.');
      savePanes();
    }));
  }
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
        lembrarEscolhaDaPasta(P);        // esta pasta passa a nascer com este cérebro
        await desligarMotor(P); savePanes();
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

/* ---- puxar a aba aberta do navegador para dentro da conversa ---- */
async function puxarAbaDoNavegador(P) {
  const r = await window.api.abaDoNavegador();
  if (!r || r.error) { avisoEnvio(P, (r && r.error) || 'não consegui falar com o navegador'); return; }
  inserirNoInput(P, r.titulo ? r.titulo + ' — ' + r.url : r.url);
}

/* ---- o que manda no comportamento do Claude, numa tela só ---- */
async function janelaConfiguracao(P) {
  fecharMenus();
  const modal = $('.p-modal', P.el), cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  modal.onclick = (e) => { if (e.target === modal) fecharModal(P); };
  cx.onclick = (e) => e.stopPropagation();
  const topo = '<div class="mo-top"><span class="mo-tit">Configurar o Claude</span>'
    + '<button class="mo-x">' + ico('x') + '</button></div>';
  cx.innerHTML = topo + '<div class="mo-carregando">Lendo os arquivos de configuração…</div>';
  $('.mo-x', cx).onclick = () => fecharModal(P);

  const c = await window.api.configClaude();
  if (modal.classList.contains('hidden')) return;
  if (!c || c.error) { cx.innerHTML = topo + '<div class="mo-sub">Não consegui ler: ' + ((c && c.error) || 'erro') + '</div>'; $('.mo-x', cx).onclick = () => fecharModal(P); return; }

  const kb = (n) => n ? Math.max(1, Math.round(n / 1024)) + ' KB' : 'vazio';
  const linha = (rot, valor, acao) => '<div class="cf-l"><span class="cf-r">' + rot + '</span>'
    + '<span class="cf-v">' + valor + '</span>'
    + (acao ? '<button class="cf-bt" data-abrir="' + acao + '">abrir</button>' : '') + '</div>';

  cx.innerHTML = topo
    + '<div class="mo-sub">O que está valendo hoje. Mexer nestes arquivos muda o Claude em <b>todos</b> os projetos, então a edição é por sua conta: clique em abrir.</div>'
    + '<div class="cf">'
    + '<div class="cf-sec">Memória</div>'
    + linha('Regras globais', kb(c.memoria.global.tamanho), c.memoria.global.caminho)
    + linha('Mapa da casa', kb(c.memoria.casa.tamanho), c.memoria.casa.caminho)
    + '<div class="cf-sec">Agentes e skills</div>'
    + linha('Agentes', c.agentes.length ? c.agentes.length + ': ' + c.agentes.slice(0, 6).join(', ') + (c.agentes.length > 6 ? '…' : '') : 'nenhum', '')
    + linha('Skills instaladas', String(c.skills), '')
    + '<div class="cf-sec">Automação e permissões</div>'
    + linha('Hooks ligados', c.hooks.length ? c.hooks.join(', ') : 'nenhum', '')
    + linha('Modo padrão', String(c.permissoes.modo), '')
    + linha('Regras de permissão', c.permissoes.liberado + ' liberadas · ' + c.permissoes.negado + ' negadas · ' + c.permissoes.pergunta + ' perguntam', c.arquivoAjustes)
    + '</div>';
  $('.mo-x', cx).onclick = () => fecharModal(P);
  $$('.cf-bt', cx).forEach(b => b.onclick = () => window.api.openPath(b.dataset.abrir));
}

/* ---- modo foco: só a pergunta e a resposta ----
   Os passos do motor (comandos, leituras, buscas) são muitos e roubam a atenção. Este botão
   esconde tudo isso de uma vez, na tela inteira, e fica lembrado. */
function alternarFoco() {
  const ligado = !document.body.classList.contains('foco');
  document.body.classList.toggle('foco', ligado);
  cfg.foco = ligado; window.api.setConfig(cfg);
  for (const P of panes.values()) scroll(P, true);
  return ligado;
}

/* ---- reabrir o último chat fechado ---- */
const fechadosRecentes = [];
function guardarFechado(P) {
  if (!P.resumeId && !P.sessaoId && !P.hist.length) return;   // chat vazio não vale guardar
  fechadosRecentes.push({
    engine: P.engine, cwd: P.cwd, titulo: P.titulo,
    resumeId: P.sessaoId || P.resumeId || '', arquivo: P.sessaoFile || '',
    aid: P.aid,
  });
  if (fechadosRecentes.length > 20) fechadosRecentes.shift();
}
async function reabrirUltimoFechado() {
  const f = fechadosRecentes.pop();
  if (!f) { if (focusPane) avisoTemp(focusPane, 'Nenhum chat fechado nesta sessão.'); return; }
  if (panes.size >= 12) { if (focusPane) avisoEnvio(focusPane, 'Feche um chat para reabrir o anterior.'); return; }
  if (f.resumeId) {
    await openSession({ id: f.resumeId, engine: f.engine, cwd: f.cwd, title: f.titulo || '', file: f.arquivo }, null);
    return;
  }
  const A = abas.get(f.aid) || abaAtiva;
  const Q = newPane({ engine: f.engine, aba: A, cwd: f.cwd, titulo: f.titulo });
  if (Q) setFocus(Q);
}

/* ---- as skills que ele mais usa sobem para o topo ---- */
const QUANTAS_FAVORITAS = 8;
function contarUsoDeSkill(nome) {
  if (!nome) return;
  cfg.usoSkills = cfg.usoSkills || {};
  cfg.usoSkills[nome] = (cfg.usoSkills[nome] || 0) + 1;
  window.api.setConfig(cfg);
}
function maisUsadas(skills) {
  const uso = cfg.usoSkills || {};
  return skills
    .filter(sk => uso[sk.name])
    .sort((a, b) => uso[b.name] - uso[a.name])
    .slice(0, QUANTAS_FAVORITAS);
}

/* ---- menu do / (ações, modelo e comandos) ---- */
async function menuSkills(P, filtroInicial, focar) {
  const m = novoMenu(P);
  m.classList.add('menu-1linha');   // uma linha por item; a explicação vira o balão do mouse
  m.appendChild(tituloPopup('Ações e comandos'));
  const busca = document.createElement('input');
  busca.className = 'menu-search';
  busca.placeholder = 'Filtrar ações…';
  m.appendChild(busca);
  const corpo = document.createElement('div');
  m.appendChild(corpo);

  /* A ORDEM aqui e a ordem na tela: a secao nasce quando muda de nome. Antes as linhas estavam
     misturadas (Contexto, Chat, Contexto de novo…) e "Contexto" aparecia tres vezes no mesmo
     menu. Agora vem tudo junto por secao, com Modelo e Conta no topo — que e o que ele mais
     abre o menu para mexer. */
  const acoes = [
    { sec: 'Modelo', ic: 'brain', nome: 'Trocar modelo…', tag: modeloAtual(P).nome, act: () => menuModelos(P) },
    { sec: 'Modelo', ic: 'sliders-horizontal', nome: 'Esforço', tag: EF_PT[P.effort] || P.effort, act: () => menuModelos(P) },
    { sec: 'Modelo', ic: 'lock', nome: 'Modos de permissão', tag: modoDe(P).nome, act: () => menuModos(P) },
    { sec: 'Modelo', ic: 'arrow-left-right', nome: 'Trocar de motor', tag: P.engine === 'codex' ? 'Codex' : 'Claude', desc: 'continua a mesma conversa com o outro', act: () => trocarMotor(P, P.engine === 'codex' ? 'claude' : 'codex') },
    // Eram cinco linhas aqui (trocar conta, entrar com codigo, logout, conta, ver conta) e as
    // cinco levavam ao mesmo lugar. Ficou UMA: a janela da conta ja tem todos esses botoes.
    { sec: 'Conta', ic: 'user', nome: 'conta', desc: 'quem está entrado, limite de uso, trocar ou sair' + (NA_VPS(P.cwd) ? ' · na VPS' : ''), act: () => janelaConta(P) },
    { sec: 'Contexto', ic: 'upload', nome: 'Anexar arquivo…', act: () => menuAnexo(P) },
    { sec: 'Contexto', ic: 'folder', nome: 'Mencionar a pasta deste painel', act: () => inserirNoInput(P, P.cwd) },
    { sec: 'Contexto', ic: 'eraser', nome: 'Limpar a tela', desc: 'a conversa continua', act: () => { P.chat.innerHTML = ''; P.blocks.clear(); P.tools.clear(); } },
    { sec: 'Contexto', ic: 'sparkles', nome: 'Começar conversa nova', act: () => novaConversa(P.engine) },
    { sec: 'Contexto', ic: 'file-text', nome: 'Resumir a conversa', desc: 'libera espaço sem perder o fio', act: () => compactarConversa(P) },
    { sec: 'Contexto', ic: 'search', nome: 'Buscar nesta conversa', desc: '⌘F', act: () => abrirBuscaConversa(P) },
    { sec: 'Contexto', ic: 'lock', nome: 'Modo foco', desc: 'esconde os passos, deixa só pergunta e resposta · ⌘⇧F', tag: document.body.classList.contains('foco') ? 'ligado' : '', act: () => alternarFoco() },
    { sec: 'Contexto', ic: 'plug', nome: 'Puxar a aba aberta do navegador', desc: 'manda o endereço e o título da aba de agora', act: () => puxarAbaDoNavegador(P) },
    { sec: 'Contexto', ic: 'book', nome: 'Salvar no Obsidian', desc: 'vira nota no vault, na pasta do cliente', act: () => salvarConversaNoVault(P) },
    { sec: 'Contexto', ic: 'mic', nome: 'Ditar', desc: 'falar em vez de digitar · ⌘⇧D', act: () => alternarDitado(P) },
    { sec: 'Chat', ic: 'plus', nome: 'Abrir outro chat nesta aba', act: () => { if (panes.size < 12) novoChatNaAba(P.engine); } },
    { sec: 'Chat', ic: 'rotate-cw', nome: 'Reabrir o último chat fechado', desc: '⌘⇧W', act: () => reabrirUltimoFechado() },
    { sec: 'Chat', ic: 'columns-2', nome: 'Perguntar aos dois motores', desc: 'a mesma pergunta no Claude e no Codex · ⌘D', act: () => perguntarAosDois(P) },
    { sec: 'Painel', ic: 'folder-open', nome: 'Trocar a pasta deste painel', tag: nomePasta(P.cwd), act: () => $('.p-cwd', P.el).click() },
    { sec: 'Painel', ic: 'sliders-horizontal', nome: 'Configurar o Claude', desc: 'memória, agentes, hooks e permissões', act: () => janelaConfiguracao(P) },
    { sec: 'Painel', ic: 'terminal', nome: 'terminal', desc: 'rodar comandos aqui dentro, sem abrir o Terminal do Mac', act: () => janelaTerminal(P, 'cd ' + JSON.stringify(P.cwd) + ' 2>/dev/null; exec ${SHELL:-/bin/zsh} -l', 'Terminal — ' + nomePasta(P.cwd)) },
    { sec: 'Conectores', ic: 'plug', nome: 'conectores', desc: 'ver, reconectar ou adicionar um conector', act: () => janelaConectores(P) },
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
    const usarSkill = (sk) => {
      const inp = $('.p-input', P.el);
      if (inp.value.startsWith('/') && !inp.value.includes(' ')) inp.value = '';
      contarUsoDeSkill(sk.name);
      inserirNoInput(P, '/' + sk.name);
    };
    // Sao 382 skills e o menu so mostra 150, em ordem fixa: as que ele usa todo dia podiam nem
    // aparecer. Agora as mais usadas sobem para o topo, com secao propria.
    if (!q) {
      const favoritas = maisUsadas(skills);
      if (favoritas.length) {
        corpo.appendChild(elSecao('As que você mais usa'));
        for (const sk of favoritas) corpo.appendChild(elItem({ ic: '/', nome: sk.name, desc: sk.desc }, () => usarSkill(sk)));
      }
    }
    const vis = (q ? [...porNome, ...porDesc] : skills).slice(0, 150);
    if (vis.length) {
      corpo.appendChild(elSecao('Comandos e skills' + (skills.length ? ' (' + skills.length + ')' : '')));
      for (const sk of vis) corpo.appendChild(elItem({ ic: '/', nome: sk.name, desc: sk.desc }, () => usarSkill(sk)));
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
  // se havia um terminal aberto nesta janelinha, encerrar o processo antes de fechar
  if (P && P.fecharTerminal) { const f = P.fecharTerminal; P.fecharTerminal = null; f(); return; }
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
    await desligarMotor(P);
  };
}

/* ---- terminal embutido: roda o comando aqui dentro, sem abrir o Terminal do Mac ---- */
let termSeq = 0;
const termsVivos = new Map();
const REG_LINK = /https?:\/\/[^\s"'<>)\]]+/g;
/* O CLI escreve o link como "hyperlink de terminal" (OSC 8): o endereco vem DUAS vezes,
   coladinho, com codigos de escape no meio. Sem limpar isso, o que a gente pescava era um
   endereco grudado no outro — link quebrado. */
const semEscapes = (s) => s
  .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, ' ')
  .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, ' ')
  .replace(/\x1b[@-Z\\-_]/g, ' ');

window.api.onTermEvent(({ id, kind, data, code }) => {
  const t = termsVivos.get(id);
  if (!t) return;
  if (kind === 'data') { t.term.write(data); t.viu(data); }
  if (kind === 'exit') {
    t.vivo = false;
    t.term.write('\r\n\x1b[90m— terminou' + (code ? ' (código ' + code + ')' : ', tudo certo') + ' —\x1b[0m\r\n');
  }
});

function janelaTerminal(P, linha, titulo, aoFechar, opcoes) {
  const op = opcoes || {};
  fecharMenus();
  const modal = $('.p-modal', P.el), cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  cx.className = 'modal-cx cx-term';
  cx.onclick = (e) => e.stopPropagation();

  const id = ESTA_TELA + 't' + (++termSeq);
  cx.innerHTML =
    '<div class="mo-top"><span class="mo-tit"></span><button class="mo-x">' + ico('x') + '</button></div>'
    + '<div class="mo-sub">' + (op.abrirSozinho
        ? 'O próprio Claude/Codex abre o navegador. <b>Não feche esta janela até terminar lá</b> — fechar aqui cancela a entrada. Se o navegador não abrir, clique em <b>Abrir link</b> aqui embaixo.'
        : 'Rodando aqui dentro do Cockpit. Se pedir para escolher ou colar algo, clique na tela preta e digite.') + '</div>'
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
      const achou = semEscapes(this.buf).match(REG_LINK);
      if (!achou) return;
      const limpos = achou.map(x => x.replace(/[.,;]+$/, ''));
      // o CLI imprime o endereco do servidorzinho local ANTES do link de entrar.
      // O que interessa e o de fora: localhost aqui so serve para o navegador voltar.
      const deFora = limpos.filter(x => !/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(x));
      const u = deFora.length ? deFora[deFora.length - 1] : limpos[limpos.length - 1];
      if (txtLink.textContent === u) return;
      txtLink.textContent = u; elLink.classList.add('ver');
      // Aqui o Cockpit TAMBEM abria o navegador. So que o `claude auth login` ja diz
      // "Opening browser to sign in..." e o `codex login` faz o mesmo: davam duas abas
      // iguais toda vez. Quem abre e o CLI; aqui fica so o botao, para quando ele falhar.
      if (op.abrirSozinho) elLink.classList.add('destaque');
    },
  };
  termsVivos.set(id, reg);
  $('button', elLink).onclick = () => window.api.openUrl(txtLink.textContent);

  const fechar = () => {
    P.fecharTerminal = null;              // evita voltar aqui pelo fecharModal
    window.api.termKill({ id });
    try { term.dispose(); } catch {}
    termsVivos.delete(id);
    cx.className = 'modal-cx';
    fecharModal(P);
    aoFechar && aoFechar();
  };
  // O Esc chamava fecharModal direto e pulava o termKill: a janela sumia da tela e o comando
  // continuava rodando escondido, para sempre. Agora o fecharModal sabe encerrar o terminal.
  P.fecharTerminal = fechar;
  modal.onclick = (e) => { if (e.target === modal) fechar(); };
  $('.mo-x', cx).onclick = fechar;
  $('#tmFecha', cx).onclick = fechar;
  $('#tmCancela', cx).onclick = () => { window.api.termInput({ id, data: '\x03' }); term.focus(); };

  window.api.termRun({ id, linha, cols: 92, rows: 22 }).then((r) => {
    if (r && r.error) term.write('\r\n\x1b[31m[não consegui rodar: ' + r.error + ']\x1b[0m\r\n');
  });
  setTimeout(() => term.focus(), 60);
}


/* ============ conta e limite fixos na barra lateral ============ */
const contaCache = { claude: null, codex: null };

async function pintarContaLateral(engine, forcar) {
  const cx = $('.side-conta[data-conta="' + engine + '"]');
  if (!cx) return;
  if (!contaCache[engine] || forcar) {
    if (!contaCache[engine]) cx.innerHTML = '<div class="sc-vazio">vendo a conta…</div>';
    contaCache[engine] = await window.api.contaLer(engine);
  }
  const c = contaCache[engine];
  const motor = engine === 'codex' ? 'Codex' : 'Claude';
  if (!c || !c.entrou) {
    cx.innerHTML = '<div class="sc-vazio">Sem conta do ' + motor + ' neste Mac. <button class="sc-link">Entrar</button></div>';
    $('.sc-link', cx).onclick = () => { const P = focusPane; if (P) contaAcao(P, 'login'); };
    return;
  }
  const semDado = !c.sessao && !c.semana;
  const barra = (titulo, j) => {
    if (!j) return '<div class="sc-us"><div class="sc-top"><span>' + titulo + '</span><b>—</b></div></div>';
    const pct = Math.min(100, Math.max(0, j.pct || 0));
    const cor = pct >= 90 ? 'perto' : pct >= 70 ? 'meio' : '';
    // "zera em X" vai na MESMA linha do titulo: em linha propria era uma terceira altura
    // so para tres palavrinhas, e a coluna toda ficava alta a toa
    return '<div class="sc-us"><div class="sc-top"><span>' + titulo
      + (j.reseta ? ' <i class="sc-zera">zera ' + quandoFuturo(j.reseta) + '</i>' : '')
      + '</span><b>' + pct + '%</b></div>'
      + '<div class="sc-bar"><span class="sc-fill ' + cor + '" style="width:' + pct + '%"></span></div></div>';
  };
  cx.innerHTML = '<div class="sc-cab"><span class="sc-av"></span>'
    + '<span class="sc-txt"><b class="sc-n"></b><span class="sc-e"></span></span>'
    + (c.plano ? '<span class="sc-plano"></span>' : '')
    + '<button class="sc-re" title="Atualizar agora"></button></div>'
    + '<div class="sc-rot">Limite de uso</div>'
    + barra('Sessão de agora', c.sessao)
    + barra('Semana', c.semana)
    // dizer O QUE houve: "limitado" e muita consulta em pouco tempo (passa sozinho),
    // e bem diferente de nao conseguir ler
    + (semDado
        ? (c.limitado
            ? '<div class="sc-pe sc-aviso">o Claude está limitando as consultas agora · volta sozinho em alguns minutos</div>'
            : '<div class="sc-pe sc-aviso">não consegui ler agora · clique em ↻ para tentar de novo</div>')
        : '');
  $('.sc-av', cx).innerHTML = svgMotor(engine);
  $('.sc-n', cx).textContent = c.nome || c.email || '';
  $('.sc-e', cx).textContent = c.email || '';
  // quando a conta nao tem nome, o de cima ja e o e-mail: a segunda linha era o mesmo texto
  $('.sc-e', cx).classList.toggle('repetido', !c.nome || c.nome === c.email);
  if (c.plano) $('.sc-plano', cx).textContent = c.plano;
  $('.sc-re', cx).innerHTML = ico('refresh-cw');
  $('.sc-re', cx).onclick = (e) => { e.stopPropagation(); pintarContaLateral(engine, true); };
  $('.sc-cab', cx).onclick = () => {
    // abre a conta do LADO da coluna que esta aberto, e usa qualquer chat como moldura da
    // janelinha (antes nao acontecia nada quando nenhum chat estava em foco)
    // a janelinha nasce DENTRO de um chat: tem de ser um que esteja na tela, senao o clique
    // parece nao fazer nada (ela abre escondida atras da aba que nao esta aberta)
    const naAba = abaAtiva ? abaAtiva.ordem.map(id => panes.get(id)).filter(Boolean) : [];
    const P = naAba.find(q => q.engine === engine) || (focusPane && naAba.includes(focusPane) ? focusPane : naAba[0])
           || [...panes.values()].find(q => q.engine === engine) || focusPane || panes.values().next().value;
    if (P) janelaConta(P, engine);
  };
}

/* O 2o argumento diz de QUAL motor e a conta. Sem ele, clicar no cartao da conta do Claude
   na coluna da esquerda abria a conta do CODEX sempre que o chat em foco fosse do Codex. */
async function janelaConta(P, motorPedido) {
  fecharMenus();
  const eng = motorPedido || P.engine;
  const modal = $('.p-modal', P.el), cx = $('.modal-cx', modal);
  modal.classList.remove('hidden');
  modal.onclick = (e) => { if (e.target === modal) fecharModal(P); };
  cx.onclick = (e) => e.stopPropagation();
  const motor = eng === 'codex' ? 'Codex' : 'Claude';
  const topo = '<div class="mo-top"><span class="mo-tit">Conta do ' + motor + '</span>'
    + '<button class="mo-x">' + ico('x') + '</button></div>';
  cx.innerHTML = topo + '<div class="mo-carregando">Vendo a conta e o quanto já foi usado…</div>';
  $('.mo-x', cx).onclick = () => fecharModal(P);

  const c = await window.api.contaLer(eng);
  if (modal.classList.contains('hidden')) return;
  if (!c || !c.entrou) {
    cx.innerHTML = topo + '<div class="mo-sub">Você não está entrado no ' + motor + ' neste Mac.</div>'
      + '<div class="mo-rodape"><button class="mo-btn" id="ctCodigo">Entrar com código</button>'
      + '<button class="mo-btn destaque" id="ctEntrar">Entrar</button></div>';
    $('.mo-x', cx).onclick = () => fecharModal(P);
    $('#ctEntrar', cx).onclick = () => { fecharModal(P); contaAcao(P, 'login'); };
    $('#ctCodigo', cx).onclick = () => { fecharModal(P); contaAcao(P, 'trocarCodigo'); };
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
    // tudo que antes eram cinco linhas soltas no menu "/" mora aqui, junto de quem esta entrado
    + '<div class="mo-rodape">'
    + (NA_VPS(P.cwd) ? '<button class="mo-btn" id="ctVps">Ver a conta da VPS</button>' : '')
    + '<button class="mo-btn" id="ctCodigo">Entrar com código</button>'
    + '<button class="mo-btn" id="ctTrocar">Trocar de conta</button>'
    + '<button class="mo-btn" id="ctSair">Sair</button></div>';

  $('.mo-x', cx).onclick = () => fecharModal(P);
  $('.ct-av', cx).innerHTML = svgMotor(eng);
  $('.ct-n', cx).textContent = c.nome || c.email;
  $('.ct-e', cx).textContent = c.email + (c.via ? '  ·  ' + c.via : '');
  if (c.plano) $('.ct-plano', cx).textContent = c.plano;
  $('#ctTrocar', cx).onclick = () => { fecharModal(P); contaAcao(P, 'trocar'); };
  $('#ctSair', cx).onclick = () => { fecharModal(P); contaAcao(P, 'logout'); };
  $('#ctCodigo', cx).onclick = () => { fecharModal(P); contaAcao(P, 'trocarCodigo'); };
  // o cartao acima le a conta DESTE Mac; com o chat na VPS quem responde e o servidor
  if ($('#ctVps', cx)) $('#ctVps', cx).onclick = () => { fecharModal(P); contaAcao(P, 'status'); };
}

/* ---------- aviso de limite do plano, em cima da caixa de texto ----------
   Fica escondido. So aparece sozinho quando passa de um dos dois pontos abaixo,
   e o x fecha. Fechado, so volta se subir mais USO_DENOVO pontos ou se o ciclo zerar. */
const USO_AVISO_SESSAO = 90;
const USO_AVISO_SEMANA = 50;
const USO_DENOVO = 5;
const USO_INTERVALO = 300000;      // relê no maximo de 5 em 5 minutos
const USO = { claude: null, codex: null };
/* O "ja fechei este aviso" mora aqui, por MOTOR — antes ficava em cada chat, entao com 3 chats
   abertos apareciam 3 tarjas iguais e ele tinha de fechar uma por uma. E quando a leitura do
   limite falhava (rede, 429, token), o codigo antigo APAGAVA o "fechado" e a tarja renascia
   sozinha na leitura seguinte. Agora falha de leitura so esconde; nao esquece. */
const USO_FECHADO = { claude: null, codex: null };
const USO_QUANDO = { claude: 0, codex: 0 };
const USO_LENDO = { claude: false, codex: false };

async function lerUso(engine, forcar) {
  if (!window.api || !window.api.usoLer) return;
  if (USO_LENDO[engine]) return;
  if (!forcar && Date.now() - (USO_QUANDO[engine] || 0) < USO_INTERVALO) return;
  USO_LENDO[engine] = true;
  try {
    const u = await window.api.usoLer(engine);
    USO[engine] = u || null;
  } catch {}
  USO_QUANDO[engine] = Date.now();
  USO_LENDO[engine] = false;
  for (const P of panes.values()) if (P.engine === engine) pintarUso(P);
  // Zerar o cache aqui obrigava o cartao da conta a chamar de novo a parte PESADA
  // ("claude auth status", 25s de teto, mais outra consulta ao limite) a cada fim de resposta,
  // a cada chat novo e a cada 5 minutos. Isso fazia o painel piscar e, pior, batia tanto na
  // consulta de limite que a Anthropic passava a responder 429. Os numeros novos ja estao em
  // USO[engine]: da pra atualizar o cartao sem chamar nada.
  const cc = contaCache[engine], uu = USO[engine];
  if (cc && uu) { cc.sessao = uu.sessao || cc.sessao; cc.semana = uu.semana || cc.semana; cc.limitado = !!uu.limitado; }
  pintarContaLateral(engine);
}

const usoPct = (j) => j ? Math.min(100, Math.max(0, Math.round(j.pct || 0))) : null;

function esconderUso(P) {
  const faixa = $('.p-uso', P.el);
  if (faixa) { faixa.className = 'p-uso hidden'; faixa.innerHTML = ''; }
}

function pintarUso(P) {
  const faixa = $('.p-uso', P.el);
  if (!faixa) return;
  const u = USO[P.engine];
  if (!u) return esconderUso(P);       // leitura falhou: escondo, mas NAO esqueco o que ele fechou
  const ps = usoPct(u.sessao), pw = usoPct(u.semana);

  const passou = (ps !== null && ps >= USO_AVISO_SESSAO) || (pw !== null && pw >= USO_AVISO_SEMANA);
  if (!passou) { USO_FECHADO[P.engine] = null; esconderUso(P); return; }   // voltou ao normal

  // ja foi fechado neste patamar: so reaparece se piorar de verdade
  const f = USO_FECHADO[P.engine];
  if (f && (ps === null || ps < f.sessao + USO_DENOVO) && (pw === null || pw < f.semana + USO_DENOVO)) { esconderUso(P); return; }

  const naSessao = ps !== null && ps >= USO_AVISO_SESSAO;
  const zera = naSessao ? u.sessao : u.semana;
  faixa.className = 'p-uso aviso';
  faixa.innerHTML = '<span class="uso-ic">▲</span>'
    + '<span class="uso-alerta">' + (naSessao ? 'Limite da sessão chegando' : 'Metade do limite da semana') + '</span>'
    + '<span class="uso-pt">·</span>'
    + '<span>Sessão <b>' + (ps === null ? '—' : ps + '%') + '</b></span>'
    + '<span class="uso-pt">·</span>'
    + '<span>Semana <b>' + (pw === null ? '—' : pw + '%') + '</b></span>'
    + (zera && zera.reseta ? '<span class="uso-pt">·</span><span class="uso-zera">zera ' + quandoFuturo(zera.reseta) + '</span>' : '')
    + '<span class="uso-gap"></span>'
    + '<button class="uso-x" title="Fechar este aviso">✕</button>';
  faixa.title = 'Plano do ' + (P.engine === 'codex' ? 'Codex' : 'Claude') + ': '
    + 'sessão ' + (ps === null ? 'sem dado' : ps + '%') + ', semana ' + (pw === null ? 'sem dado' : pw + '%') + '.';
  $('.uso-x', faixa).onclick = (e) => { e.stopPropagation(); fecharUso(P); };
}

function fecharUso(P) {
  const u = USO[P.engine];
  if (!u) return esconderUso(P);
  const ps = usoPct(u.sessao), pw = usoPct(u.semana);
  USO_FECHADO[P.engine] = { sessao: ps === null ? 999 : ps, semana: pw === null ? 999 : pw };
  // um X so: fechar num chat cala o aviso em TODOS os chats do mesmo motor
  for (const q of panes.values()) if (q.engine === P.engine) esconderUso(q);
}

// acabou de responder: o gasto mudou, mas sem repetir a leitura a toda hora
function lerUsoAposResposta(engine) {
  if (Date.now() - (USO_QUANDO[engine] || 0) < 45000) return;
  lerUso(engine, true);
}

function usoDeTodos(forcar) {
  for (const e of new Set([...panes.values()].map(p => p.engine))) lerUso(e, forcar);
}
setInterval(() => usoDeTodos(false), USO_INTERVALO);

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

// o Claude devolve JSON, o Codex devolve uma frase: os dois viram { dentro, quem }
function lerStatusConta(txt) {
  const t = String(txt || '').trim();
  if (!t) return { dentro: false, quem: '' };
  try {
    const j = JSON.parse(t);
    const quem = j.email || j.account || j.organization || j.authMethod || '';
    return { dentro: j.loggedIn === true, quem: String(quem) };
  } catch {}
  if (/not logged in|não logado|no credentials|logged out|not authenticated/i.test(t)) return { dentro: false, quem: '' };
  const email = (t.match(/[\w.+-]+@[\w-]+\.[\w.]+/) || [])[0] || '';
  return { dentro: true, quem: email || t.split('\n')[0].slice(0, 80) };
}

async function contaAcao(P, acao) {
  const r = await window.api.auth({ engine: P.engine, acao, cwd: P.cwd });
  if (!r) return;
  if (r.error) return note(P, 'Não consegui: ' + r.error, true);
  if (acao === 'status') { avisoTemp(P, (r.texto || 'sem resposta').split('\n').slice(0, 4).join(' · ')); return; }
  if (!r.terminal) return;

  janelaTerminal(P, r.terminal, r.titulo || 'Conta', async () => {
    // todo chat do mesmo motor recomeca, senao continua falando pela conta velha
    for (const q of panes.values()) {
      if (q.engine !== P.engine) continue;
      await desligarMotor(q); q.resumeId = null;
    }
    if (!r.confereDepois) { avisoTemp(P, 'Pronto. Mande uma mensagem para começar de novo.'); return; }
    avisoTemp(P, 'Conferindo qual conta ficou…');
    const st = await window.api.auth({ engine: P.engine, acao: 'status', cwd: P.cwd });
    const txt = ((st && st.texto) || '').trim();
    const r2 = lerStatusConta(txt);
    if (r2.dentro) {
      avisoTemp(P, 'Conta trocada' + (r2.quem ? ': ' + r2.quem : '.'));
      USO_FECHADO[P.engine] = null; lerUso(P.engine, true);
      // trocou de conta: aqui SIM vale reler o cartao inteiro, pro e-mail e o plano mudarem
      contaCache[P.engine] = null; pintarContaLateral(P.engine, true);
    } else {
      avisoTemp(P, 'A entrada não terminou. Tente de novo e não feche a janela até o navegador confirmar. Se o navegador não abrir, use "entrar com código".', true);
    }
  }, { abrirSozinho: !!r.esperaLink && !r.naVps });
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

/* Teste unico e certo de "a lista de conversas esta na frente dele".
   O que ganha 'hidden' quando a coluna fecha e o #sidebar; a .side-view do Claude nunca
   nascia com 'hidden', entao o teste antigo dava SEMPRE verdadeiro e o app relia milhares de
   arquivos de conversa a cada resposta, mesmo com a coluna fechada. Era a engasgada de todo
   fim de resposta. */
function lateralAberta(engine) {
  // no telefone a lateral e uma gaveta por cima: quem diz se esta aberta e a classe do body,
  // porque o #sidebar nunca ganha 'hidden'. Sem isto o telefone relia a lista a cada resposta.
  if (window.SEM_ELECTRON) { if (!document.body.classList.contains('gaveta')) return false; }
  else if ($('#sidebar').classList.contains('hidden')) return false;
  const v = $('.side-view[data-view="h' + engine + '"]');
  return !!v && !v.classList.contains('hidden');
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
// filtro de pasta da lista lateral: '' = Mac inteiro, 'ABA' = acompanha a aba, ou o caminho de um cliente
const filtroPasta = { claude: 'ABA', codex: 'ABA' };

// cada pasta dentro daqui e um cliente (funcao porque o HOME so chega no boot)
const PROJETOS = () => HOME + '/Desktop/Projetos-claude';

// sem cache de proposito: cliente novo aparece na hora que a pasta e criada
async function lerClientes() {
  if (!window.api || !window.api.listDir) return [];
  try {
    const r = await window.api.listDir(PROJETOS());
    return (r && r.entries) ? r.entries.filter(e => e.dir).map(e => ({ nome: e.name, path: e.path })) : [];
  } catch { return []; }
}

// o caminho esta dentro da pasta alvo (ou e ela mesma)?
function dentroDe(cwd, alvo) {
  if (!cwd || !alvo) return false;
  return cwd === alvo || cwd.startsWith(alvo.replace(/\/+$/, '') + '/');
}
/* De qualquer caminho, descobre de qual cliente ele e — e o que define em qual aba a conversa
   mora. Uma subpasta do cliente (Adsure/paginas/checkout) continua sendo Adsure, senao cada
   subpasta abria uma aba nova e a lista lateral nao achava nada.
   Pasta fora de Projetos-claude devolve ela mesma, e nao vazio: vazio queria dizer "Mac
   inteiro", entao uma aba dessas despejava TODAS as conversas do computador na lista. */
function clienteDe(cwd) {
  const raiz = PROJETOS();
  if (!dentroDe(cwd, raiz)) return cwd || '';
  const primeiro = cwd.slice(raiz.length + 1).split('/').filter(Boolean)[0];
  return primeiro ? raiz + '/' + primeiro : raiz;
}
// a aba onde este caminho deve morar: a do cliente dele. Cria se ainda nao existir.
function abaDoCaminho(cwd, criar) {
  const alvo = clienteDe(cwd);
  const achada = [...abas.values()].find(x => clienteDe(x.cwd) === alvo);
  if (achada) return achada;
  return criar ? novaAbaProjeto(alvo || cwd) : null;
}

function pastaDoFiltro(engine) {
  const f = filtroPasta[engine];
  if (f === 'ABA') return abaAtiva ? clienteDe(abaAtiva.cwd) : '';
  return f;
}
function filtrarPorPasta(engine, lista) {
  const alvo = pastaDoFiltro(engine);
  if (!alvo) return lista;
  return lista.filter(s => dentroDe(s.cwd, alvo));
}
function pintarBotaoFiltro(engine) {
  const bt = $('.side-filtro[data-filtro="' + engine + '"]');
  if (!bt) return;
  const alvo = pastaDoFiltro(engine);
  $('.sf-txt', bt).textContent = alvo ? nomeProjeto(alvo) : 'Mac inteiro';
  bt.classList.toggle('on', !!alvo);
}
// a lista do filtro: Mac inteiro, acompanhar a aba, e um item por cliente
async function pintarPastas(engine) {
  const cx = $('.side-pastas[data-pastas="' + engine + '"]');
  if (!cx) return;
  const lista = histCache[engine] || [];
  const clientes = await lerClientes();
  const f = filtroPasta[engine];
  const daAba = abaAtiva ? clienteDe(abaAtiva.cwd) : '';
  cx.innerHTML = '';
  const item = (rotulo, valor, extra, ligado) => {
    const b = document.createElement('button');
    b.className = 'sp-item' + (ligado ? ' on' : '');
    b.innerHTML = '<span class="sp-n"></span><span class="sp-q"></span>';
    $('.sp-n', b).textContent = rotulo;
    $('.sp-q', b).textContent = extra || '';
    b.onclick = () => {
      filtroPasta[engine] = valor;
      cx.classList.add('hidden');
      pintarBotaoFiltro(engine);
      if (histCache[engine]) paintHist(engine, histCache[engine]);
    };
    cx.appendChild(b);
  };
  item('Mac inteiro', '', String(lista.length), f === '');
  item('Acompanha a aba' + (daAba ? ' · ' + nomeProjeto(daAba) : ''), 'ABA', '', f === 'ABA');
  for (const c of clientes) {
    const n = lista.filter(s => dentroDe(s.cwd, c.path)).length;
    item(c.nome, c.path, String(n), f === c.path);
  }
}

// a coluna lateral acompanha a pasta da aba aberta
function lateralSegueAPasta() {
  for (const eng of ['claude', 'codex']) {
    if (filtroPasta[eng] !== 'ABA') continue;
    pintarBotaoFiltro(eng);
    if (histCache[eng]) paintHist(eng, histCache[eng]);
  }
}

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

/* ---- conversa que esta aberta em algum chat ganha borda da cor do motor ----
   laranja = Claude, azul = Codex. Fechou o chat, a borda some. A cor vem do motor do CHAT
   (e nao do item da lista) porque o painel pode ter trocado de motor no meio do caminho. */
function motorQueAbriu(id, arquivo) {
  if (!id) return null;
  for (const P of panes.values()) {
    if (P.resumeId !== id && P.sessaoId !== id) continue;
    // O Codex repete o MESMO numero de conversa em varios arquivos (cada vez que ela e
    // retomada nasce outro). So pelo numero, abrir uma acendia a borda de 17 linhas iguais.
    if (P.sessaoFile && arquivo && P.sessaoFile !== arquivo) continue;
    return P.engine;
  }
  return null;
}
function pintarAberta(d) {
  const eng = motorQueAbriu(d.dataset.sid, d.dataset.sfile);
  d.classList.toggle('aberta', !!eng);
  d.classList.toggle('ab-claude', eng === 'claude');
  d.classList.toggle('ab-codex', eng === 'codex');
}
function marcarAbertas() {
  document.querySelectorAll('.hist-item[data-sid]').forEach(pintarAberta);
}

function linhaConversa(s, termo, trecho) {
  const d = document.createElement('div');
  d.className = 'hist-item' + (trecho ? ' com-trecho' : '');
  d.dataset.sid = s.id;
  d.dataset.sfile = s.file || '';
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
  pintarAberta(d);
  return d;
}

/* Cada desenho da lista ganha um numero. Como a busca dentro das conversas demora segundos,
   dava tempo de outro desenho comecar (mais uma letra digitada, troca de aba, fim de resposta):
   quando o antigo acordava, despejava os resultados VELHOS por cima do desenho novo e a lista
   aparecia duplicada e misturada. Agora o desenho velho percebe que ficou para tras e desiste. */
const pintaVez = { claude: 0, codex: 0 };

async function paintHist(engine, listaCrua) {
  const minhaVez = ++pintaVez[engine];
  const box = $(engine === 'claude' ? '#histClaude' : '#histCodex');
  const termo = (buscaAtual[engine] || '').toLowerCase().trim();
  pintarBotaoFiltro(engine);
  const list = filtrarPorPasta(engine, listaCrua);
  box.innerHTML = '';
  if (!listaCrua.length) { box.innerHTML = '<div class="hist-load">Nenhuma conversa ainda.</div>'; return; }
  if (!list.length) {
    box.innerHTML = '<div class="hist-load">Nenhuma conversa nesta pasta.</div>';
    return;
  }

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

  const r = await window.api.buscarConversas({ engine, termo, itens: resto.map(s => ({ id: s.id, file: s.file })) });
  if (minhaVez !== pintaVez[engine]) return;   // ja tem um desenho mais novo: este morreu
  // o main passou a devolver { achados, parcial }; a versao antiga devolvia so a lista
  const achados = Array.isArray(r) ? r : ((r && r.achados) || []);
  const parcial = (r && !Array.isArray(r) && r.parcial) || null;
  aviso.remove();
  if (!achados.length) {
    if (!porNome.length) box.innerHTML = '<div class="hist-load">Nada com “' + termo + '”.</div>';
    // o aviso de "olhei so as mais recentes" vale mesmo quando ja houve acerto pelo nome
    if (parcial) box.appendChild(Object.assign(document.createElement('div'), {
      className: 'hist-load',
      textContent: 'Olhei as ' + parcial.vistos + ' conversas mais recentes de ' + parcial.total + '. Escreva mais palavras para achar nas antigas.',
    }));
    return;
  }
  box.appendChild(Object.assign(document.createElement('div'), { className: 'hist-cab', textContent: 'dentro da conversa' }));
  for (const a of achados) {
    const s = resto.find(x => x.id === a.id);
    if (s) box.appendChild(linhaConversa(s, termo, a.trecho));
  }
  // nunca cortar em silencio: se a busca parou no meio, ele precisa saber
  if (parcial) {
    box.appendChild(Object.assign(document.createElement('div'), {
      className: 'hist-load',
      textContent: 'Olhei as ' + parcial.vistos + ' conversas mais recentes de ' + parcial.total + '. Pode haver mais nas antigas.',
    }));
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
  if (panes.size < 12) {
    // a conversa abre na aba do cliente dela, mesmo que tenha nascido numa subpasta
    const A = abaDoCaminho(s.cwd, true);
    P = newPane({ engine: s.engine, aba: A, cwd: s.cwd, titulo: s.title });
  } else {
    P = [...panes.values()].find(q => !q.busy && !q.hist.length) || [...panes.values()].find(q => !q.busy);
    if (!P) { const q = focusPane; if (q) avisoTemp(q, 'Todos os painéis estão ocupados. Feche um para abrir esta conversa.'); return; }
  }
  document.body.classList.remove('gaveta');
  document.querySelectorAll('.hist-item').forEach(x => x.classList.remove('on'));
  if (el) el.classList.add('on');

  await window.api.paneStop({ paneId: P.id, engine: P.engine });
  escondePerm(P);
  P.engine = s.engine; P.cwd = s.cwd; P.resumeId = s.id; P.sessaoId = null; P.started = false; P.busy = false; P.model = '';
  P.sessaoFile = s.file || '';   // guardado para a conversa voltar cheia quando reabrir o app
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
    else if (m.role === 'bot') { const b = botBlock(P, 'h' + Math.random()); b.raw = m.text; b.el.innerHTML = marked.parse(m.text); botoesDeCopia(b); P.hist.push({ quem: P.engine === 'codex' ? 'Codex' : 'Claude', texto: m.text }); }
    else if (m.role === 'tool') { toolStart(P, 'h' + Math.random(), m.name, m.arg); }
  }
  document.querySelectorAll('.tool-st').forEach(x => { if (x.classList.contains('run')) { x.className = 'tool-st ok'; x.innerHTML = ico('check'); } });
  note(P, '— daqui pra baixo é a conversa de agora —');
  scroll(P, true);
  $('.p-input', P.el).focus();
}

async function novaConversa(engine) {
  const P = panes.size < 12 ? novoChatNaAba(engine) : focusPane;
  if (!P) return;
  document.body.classList.remove('gaveta');   // no celular, sai da lista e mostra a conversa nova
  await window.api.paneStop({ paneId: P.id, engine: P.engine });
  escondePerm(P);
  // sessaoId TEM de zerar junto: se ficar o da conversa anterior, uma queda de conexao faria
  // o "religar" voltar para a conversa velha em vez desta nova
  P.engine = engine; P.resumeId = null; P.sessaoId = null; P.started = false; P.titulo = ''; P.hist = [];
  P.effort = EF_NOVO; P.ultraAvisado = false;   // conversa nova sempre volta ao Extra alto
  P.blocks.clear(); P.tools.clear(); voltarVazio(P); pintarNome(P);
  fillModels(P); paintEngine(P); setDot(P, 'off'); setFocus(P);
  marcarAbertas();          // a conversa que estava aqui deixou de estar aberta
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

$$('.side-filtro').forEach(bt => bt.addEventListener('click', (e) => {
  e.stopPropagation();
  const eng = bt.dataset.filtro;
  const cx = $('.side-pastas[data-pastas="' + eng + '"]');
  const abrindo = cx.classList.contains('hidden');
  $$('.side-pastas').forEach(x => x.classList.add('hidden'));
  if (abrindo) { pintarPastas(eng); cx.classList.remove('hidden'); }
}));
document.addEventListener('click', (e) => {
  if (e.target.closest('.side-pastas') || e.target.closest('.side-filtro')) return;
  $$('.side-pastas').forEach(x => x.classList.add('hidden'));
});

document.querySelectorAll('[data-reload]').forEach(b =>
  b.addEventListener('click', () => loadHist(b.dataset.reload, true)));
document.querySelectorAll('[data-new]').forEach(b =>
  b.addEventListener('click', () => novaConversa(b.dataset.new)));

/* ============ arrastar: chats dentro da aba, e abas entre si ============ */

// pega um chat pelo cabecalho e leva para outra posicao (ou para outra aba)
function comecarArrastePane(P, e0) {
  const x0 = e0.clientX, y0 = e0.clientY;
  let ativo = false, fantasma = null, marca = null, alvo = null;

  const move = (ev) => {
    if (!ativo) {
      if (Math.abs(ev.clientX - x0) < 6 && Math.abs(ev.clientY - y0) < 6) return;
      ativo = true;
      document.body.classList.add('arrastando-aba');
      P.el.classList.add('saindo');
      fantasma = document.createElement('div');
      fantasma.className = 'aba-fantasma';
      fantasma.innerHTML = '<span class="aba-ic">' + svgMotor(P.engine) + '</span><span class="ft-n"></span>';
      $('.ft-n', fantasma).textContent = P.titulo || 'Conversa nova';
      document.body.appendChild(fantasma);
      marca = document.createElement('div');
      marca.className = 'aba-marca'; marca.style.display = 'none';
      document.body.appendChild(marca);
    }
    fantasma.style.left = (ev.clientX + 13) + 'px';
    fantasma.style.top = (ev.clientY - 15) + 'px';
    alvo = alvoDoPane(ev, P);
    pintarAlvoPane(alvo, marca);
  };

  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    document.body.classList.remove('arrastando-aba');
    if (fantasma) fantasma.remove();
    if (marca) marca.remove();
    P.el.classList.remove('saindo');
    if (ativo && alvo) soltarPane(P, alvo);
  };

  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

// onde o chat vai cair: entre dois chats da tela, ou em cima de outra aba
function alvoDoPane(ev, P) {
  const sob = document.elementFromPoint(ev.clientX, ev.clientY);
  if (!sob) return null;

  // largou em cima de uma aba de projeto: o chat muda de projeto
  const abaEl = sob.closest('#abasTopo .aba');
  if (abaEl) {
    const A = abas.get(abaEl.dataset.aid);
    if (!A) return null;
    const r = abaEl.getBoundingClientRect();
    return { tipo: 'outraAba', A, x: r.left, y: r.top, h: r.height };
  }

  const A = abaAtiva;
  if (!A || !sob.closest('.espaco')) return null;
  const vivos = A.ordem.map(id => panes.get(id)).filter(Boolean);
  let indice = vivos.length, x = 0;
  const r0 = A.corpoEl.getBoundingClientRect();
  for (let k = 0; k < vivos.length; k++) {
    const r = vivos[k].el.getBoundingClientRect();
    if (ev.clientX < r.left + r.width / 2) { indice = k; x = r.left; break; }
    x = r.right;
  }
  if (indice === vivos.length) x = vivos.length ? vivos[vivos.length - 1].el.getBoundingClientRect().right : r0.left;
  return { tipo: 'fila', A, indice, x, y: r0.top, h: r0.height };
}

function pintarAlvoPane(alvo, marca) {
  if (!marca) return;
  if (!alvo) { marca.style.display = 'none'; return; }
  marca.style.display = '';
  marca.style.left = (alvo.x - 1) + 'px';
  marca.style.top = alvo.y + 'px';
  marca.style.height = alvo.h + 'px';
}

function soltarPane(P, alvo) {
  const A0 = abaDe(P);
  if (alvo.tipo === 'outraAba') {
    if (alvo.A === A0) return;
    moverPane(P, alvo.A, null);
    return;
  }
  let idx = alvo.indice;
  if (A0 === alvo.A) {
    const cur = A0.ordem.indexOf(P.id);
    if (idx > cur) idx--;
    if (idx === cur) return;
  }
  moverPane(P, alvo.A, idx);
}

// arrastar a propria aba de projeto para trocar a ordem no topo
function comecarArrasteAba(A, e0) {
  const x0 = e0.clientX;
  let ativo = false, fantasma = null, marca = null, indice = null;

  const move = (ev) => {
    if (!ativo) {
      if (Math.abs(ev.clientX - x0) < 5) return;
      ativo = true;
      document.body.classList.add('arrastando-aba');
      A.el.classList.add('saindo');
      fantasma = document.createElement('div');
      fantasma.className = 'aba-fantasma';
      fantasma.innerHTML = '<span class="aba-ic">' + ico('folder') + '</span><span class="ft-n"></span>';
      $('.ft-n', fantasma).textContent = nomeProjeto(A.cwd);
      document.body.appendChild(fantasma);
      marca = document.createElement('div');
      marca.className = 'aba-marca'; marca.style.display = 'none';
      document.body.appendChild(marca);
    }
    fantasma.style.left = (ev.clientX + 13) + 'px';
    fantasma.style.top = (ev.clientY - 15) + 'px';

    const lista = $('#abasLista');
    const els = [...lista.children];
    const r0 = lista.getBoundingClientRect();
    indice = els.length; let x = 0;
    for (let k = 0; k < els.length; k++) {
      const r = els[k].getBoundingClientRect();
      if (ev.clientX < r.left + r.width / 2) { indice = k; x = r.left; break; }
      x = r.right;
    }
    if (indice === els.length) x = els.length ? els[els.length - 1].getBoundingClientRect().right : r0.left;
    marca.style.display = '';
    marca.style.left = (x - 1) + 'px';
    marca.style.top = r0.top + 'px';
    marca.style.height = r0.height + 'px';
  };

  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    document.body.classList.remove('arrastando-aba');
    if (fantasma) fantasma.remove();
    if (marca) marca.remove();
    A.el.classList.remove('saindo');
    if (!ativo || indice == null) return;
    const lista = $('#abasLista');
    const els = [...lista.children];
    const cur = els.indexOf(A.el);
    let idx = indice;
    if (idx > cur) idx--;
    if (idx === cur) return;
    lista.insertBefore(A.el, lista.children[idx] || null);
    // a ordem do Map segue a ordem da tela, para o cmd+1..9 bater
    const novaOrdem = [...lista.children].map(el => abas.get(el.dataset.aid)).filter(Boolean);
    abas.clear();
    for (const B of novaOrdem) abas.set(B.id, B);
    savePanes();
  };

  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

/* ============ tela do meio: nova conversa ============ */
const naEstado = { motor: 'claude', pasta: '', onde: 'mac' };

function telaNovaAba(obrigatoria) {
  const el = $('#novaAba');
  naEstado.motor = (cfg.lastEngine === 'codex') ? 'codex' : 'claude';
  naEstado.pasta = '';
  naEstado.onde = 'mac';
  naPintar();
  el.dataset.travada = obrigatoria ? '1' : '';
  el.classList.remove('hidden');
  setTimeout(() => $('#naOk').focus(), 40);
}

function fecharNovaAba() {
  const el = $('#novaAba');
  if (el.dataset.travada === '1') return;
  el.classList.add('hidden');
}

function naPintar() {
  const naVps = naEstado.onde === 'vps';
  $$('.na-motor').forEach(b => b.classList.toggle('on', b.dataset.motor === naEstado.motor));
  $$('.na-onde').forEach(b => b.classList.toggle('on', b.dataset.onde === naEstado.onde));
  $('#naPasta').classList.toggle('hidden', naVps);
  $('#naRemoto').classList.toggle('hidden', !naVps);
  $('#naEscolhida').classList.toggle('hidden', naVps || !naEstado.pasta);
  $('#naPastaNome').textContent = naEstado.pasta ? shortPath(naEstado.pasta) : '';
  $('#naDica').textContent = naVps
    ? 'Ele roda dentro da VPS, na conta e no disco de lá.'
    : (naEstado.pasta
        ? 'Ele começa dentro dessa pasta, mas continua enxergando o Mac inteiro.'
        : 'Sem pasta escolhida, ele abre no Mac inteiro.');
  $('#naDois').classList.toggle('hidden', false);
  $('.na-cx').style.setProperty('--accent', 'var(--' + naEstado.motor + ')');
}

// atalhos das pastas que ele mais usa na VPS, para nao precisar digitar
const PASTAS_VPS = ['/opt/adsure', '/opt/adsure/wa', '/root', '/home/homero', '/var/www'];
function naPintarAtalhos() {
  const cx = $('#naAtalhos');
  if (!cx || cx.children.length) return;
  for (const p of PASTAS_VPS) {
    const b = document.createElement('button');
    b.className = 'na-atalho'; b.textContent = p;
    b.onclick = () => { $('#naCaminho').value = p; $('#naCaminho').focus(); };
    cx.appendChild(b);
  }
}

function naConfirmar(dois) {
  let cwd;
  if (naEstado.onde === 'vps') {
    const p = ($('#naCaminho').value || '').trim() || '/opt/adsure';
    cwd = 'vps:' + (p.startsWith('/') ? p : '/' + p);
  } else {
    cwd = naEstado.pasta || HOME;
  }
  const el = $('#novaAba');
  el.dataset.travada = ''; el.classList.add('hidden');
  const A = novaAbaProjeto(cwd);
  if (dois) {
    const P = newPane({ engine: 'claude', aba: A });
    newPane({ engine: 'codex', aba: A });
    setFocus(P);
    setTimeout(() => $('.p-input', P.el).focus(), 80);
    return;
  }
  const P = newPane({ engine: naEstado.motor, aba: A });
  cfg.lastEngine = naEstado.motor; window.api.setConfig(cfg);
  setTimeout(() => $('.p-input', P.el).focus(), 80);
}

// chat novo dentro da aba que esta aberta (mesma pasta, sem perguntar nada)
function novoChatNaAba(engine) {
  if (!abaAtiva) { telaNovaAba(); return; }
  if (panes.size >= 12) {
    if (focusPane) avisoTemp(focusPane, 'Já são 12 chats abertos. Feche um para abrir outro.', true);
    return;
  }
  const P = newPane({ engine: engine || (focusPane && focusPane.engine) || cfg.lastEngine || 'claude', aba: abaAtiva });
  igualarChats();
  setTimeout(() => $('.p-input', P.el).focus(), 60);
  return P;
}

$$('.na-motor').forEach(b => b.addEventListener('click', () => { naEstado.motor = b.dataset.motor; naPintar(); }));
$$('.na-onde').forEach(b => b.addEventListener('click', () => {
  naEstado.onde = b.dataset.onde; naPintarAtalhos(); naPintar();
  if (naEstado.onde === 'vps') setTimeout(() => $('#naCaminho').focus(), 40);
}));
$('#naPasta').addEventListener('click', async () => {
  // aba nova abre direto na pasta dos projetos do Claude (quem resolve o caminho e o main)
  const p = await window.api.pickFolder(naEstado.pasta || '');
  if (!p) return;
  naEstado.pasta = p; naPintar();
});
$('#naPastaX').addEventListener('click', () => { naEstado.pasta = ''; naPintar(); });
$('#naOk').addEventListener('click', () => naConfirmar(false));
$('#naCaminho').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); naConfirmar(false); } });
$('#naDois').addEventListener('click', () => naConfirmar(true));
$('#novaAba').addEventListener('mousedown', (e) => { if (e.target.id === 'novaAba') fecharNovaAba(); });

/* ============ interface geral ============ */
// o + da barra de cima saiu: quem abre chat novo e o "+ chat" da barra de abas
$('#btnNovaAba').addEventListener('click', () => telaNovaAba());
$('#btnNovoChat').addEventListener('click', () => novoChatNaAba());
const btPasta = $('#btnPickFolder');
if (btPasta) btPasta.addEventListener('click', () => { if (abaAtiva) trocarPastaDaAba(abaAtiva); });
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

/* A foto e mostrada num circulo de 20 a 30 pixels, mas era guardada no tamanho original: a
   foto atual ocupa 2,2 MB dentro do config.json, que e reescrito dezenas de vezes por dia e
   ainda viaja inteiro ate o iPhone. Reduzir para 256px deixa o arquivo em alguns KB sem
   nenhuma diferenca na tela. */
function encolherFoto(dataUrl, lado = 256) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = lado;
        const g = c.getContext('2d');
        // JPEG nao tem transparencia: sem pintar o fundo antes, PNG transparente vira PRETO
        g.fillStyle = '#ffffff'; g.fillRect(0, 0, lado, lado);
        const m = Math.min(img.width, img.height);          // corta quadrado pelo centro
        g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, lado, lado);
        ok(c.toDataURL('image/jpeg', 0.88));
      } catch { ok(dataUrl); }
    };
    img.onerror = () => ok(dataUrl);
    img.src = dataUrl;
  });
}

$('#btnFoto').addEventListener('click', async () => {
  const r = await window.api.pickPhoto();
  if (!r) return;
  if (r.error) { alert(r.error); return; }
  cfg.foto = await encolherFoto(r.dataUrl); await window.api.setConfig(cfg); repintarAvatares();
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
  const fechada = $('#sidebar').classList.contains('hidden');
  // clicar no icone que ja esta aberto fecha a coluna; se estava fechada, abre e carrega
  if (b.classList.contains('active') && !fechada) return toggleSidebar();
  $('#sidebar').classList.remove('hidden'); $('#dragbar').classList.remove('hidden');
  document.querySelectorAll('.act').forEach(x => x.classList.toggle('active', x === b));
  document.querySelectorAll('.side-view').forEach(x => x.classList.toggle('hidden', x.dataset.view !== v));
  abrirVistaLateral(v);
  encostarAbas();
}));

function abrirVistaLateral(v) {
  if (v === 'hclaude') { loadHist('claude'); pintarContaLateral('claude', true); }
  if (v === 'hcodex') { loadHist('codex'); pintarContaLateral('codex', true); }
}

// enquanto a coluna estiver aberta, o limite se atualiza sozinho de 2 em 2 minutos
setInterval(() => {
  if ($('#sidebar').classList.contains('hidden')) return;
  const vista = $$('.side-view').find(v => !v.classList.contains('hidden'));
  if (!vista) return;
  const eng = vista.dataset.view === 'hcodex' ? 'codex' : (vista.dataset.view === 'hclaude' ? 'claude' : null);
  if (!eng) return;
  lerUso(eng, true);                       // relê a fonte, e o lerUso repinta a lateral
}, 120000);
function toggleSidebar() {
  $('#sidebar').classList.toggle('hidden'); $('#dragbar').classList.toggle('hidden');
  sincronizarIconesLaterais();
  // abrindo pelo atalho de teclado, a vista que aparece precisa carregar a lista: antes
  // abria mostrando o que estivesse velho em cache, ou nada
  if (!$('#sidebar').classList.contains('hidden')) {
    const v = $$('.side-view').find(x => !x.classList.contains('hidden'));
    // sem forcar: abrir pelo atalho nao pode disparar um "claude auth status" novo toda vez
    if (v && v.dataset.view === 'hclaude') { loadHist('claude'); pintarContaLateral('claude'); }
    if (v && v.dataset.view === 'hcodex') { loadHist('codex'); pintarContaLateral('codex'); }
  }
  encostarAbas();
}

/* O icone aceso na barrinha da esquerda tem de dizer a verdade: so fica marcado quando a
   coluna esta ABERTA, e so o do lado que esta a mostra. Antes o "active" vinha escrito no
   HTML e nunca saia, entao o Claude aparecia selecionado com a coluna fechada, e continuava
   selecionado depois de fechar. */
function sincronizarIconesLaterais() {
  const fechada = $('#sidebar').classList.contains('hidden');
  const vista = fechada ? null : (($$('.side-view').find(v => !v.classList.contains('hidden')) || {}).dataset || {}).view;
  $$('.act').forEach(x => x.classList.toggle('active', !!vista && x.dataset.view === vista));
}

// a primeira aba comeca no fim da coluna da esquerda, aberta ou fechada
function encostarAbas() {
  // no telefone a lateral e uma gaveta por cima: as abas ficam encostadas na esquerda
  if (window.SEM_ELECTRON || window.innerWidth < 700) {
    document.documentElement.style.setProperty('--recuo-abas', '0px');
    return;
  }
  const barra = $('#activitybar'), lateral = $('#sidebar'), puxador = $('#dragbar');
  let x = barra ? barra.getBoundingClientRect().width : 48;
  if (lateral && !lateral.classList.contains('hidden')) {
    x += lateral.getBoundingClientRect().width;
    if (puxador && !puxador.classList.contains('hidden')) x += puxador.getBoundingClientRect().width;
  }
  document.documentElement.style.setProperty('--recuo-abas', Math.round(x) + 'px');
}

(() => {
  let drag = false;
  $('#dragbar').addEventListener('mousedown', () => { drag = true; document.body.style.cursor = 'col-resize'; });
  window.addEventListener('mousemove', (e) => { if (drag) { $('#sidebar').style.width = Math.min(480, Math.max(160, e.clientX - 48)) + 'px'; encostarAbas(); } });
  window.addEventListener('mouseup', () => { drag = false; document.body.style.cursor = ''; });
})();

document.addEventListener('keydown', (e) => {
  // cmd+1..9 pula de ABA de projeto; com shift, pula de chat dentro da aba
  if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
    const n = Number(e.key) - 1;
    if (e.shiftKey) {
      const A = abaAtiva; if (!A) return;
      const P = panes.get(A.ordem[n]);
      if (P) { e.preventDefault(); setFocus(P); $('.p-input', P.el).focus(); }
    } else {
      const A = [...abas.values()][n];
      if (A) { e.preventDefault(); ativarAbaProjeto(A); }
    }
  }
  // Esc fecha a tela de conversa nova (a nao ser que nao haja nenhuma aba aberta)
  if (e.key === 'Escape' && !$('#novaAba').classList.contains('hidden')) { e.stopPropagation(); fecharNovaAba(); }
  // Enter confirma direto: sem pasta escolhida, abre no Mac inteiro
  if (e.key === 'Enter' && !$('#novaAba').classList.contains('hidden')) { e.preventDefault(); naConfirmar(false); }
}, true);

window.addEventListener('resize', () => { for (const P of panes.values()) paintEngine(P); encostarAbas(); });

window.api.onMenu((a) => {
  // clicou no recado do sistema: traz a aba e o chat que ficaram prontos para a frente
  if (a.startsWith('ir:')) {
    const P = panes.get(a.slice(3));
    if (!P) return;
    const A = abaDe(P);
    if (A && A !== abaAtiva) ativarAbaProjeto(A);
    setFocus(P); piscar(P);
    $('.p-input', P.el).focus();
    return;
  }
  if (a === 'foco') { const on = alternarFoco(); if (focusPane) avisoTemp(focusPane, on ? 'Modo foco ligado: só pergunta e resposta.' : 'Modo foco desligado.'); return; }
  if (a === 'reabrirFechado') return reabrirUltimoFechado();
  if (a === 'buscarNaConversa') return abrirBuscaConversa(focusPane);
  if (a === 'perguntarAosDois') return focusPane && perguntarAosDois(focusPane);
  if (a === 'ditar') return focusPane && alternarDitado(focusPane);
  if (a === 'salvarVault') return focusPane && salvarConversaNoVault(focusPane);
  if (a === 'newPane') novoChatNaAba();
  else if (a === 'newTab') telaNovaAba();
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
      abrirVistaLateral(v);
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
  document.body.classList.toggle('foco', !!cfg.foco);   // o modo foco continua como ele deixou
  $('#verLine').textContent = 'Cockpit 1.0 · uma aba por projeto, chats lado a lado dentro dela';
  repintarAvatares();
  const noTelefone = !!window.SEM_ELECTRON;
  if (!noTelefone) window.api.codexModels().then(ms => { if (ms && ms.length) { MODELOS_CODEX = ms; for (const P of panes.values()) if (P.engine === 'codex') fillModels(P); } });
  // icones da tela de conversa nova
  $('#naIcClaude').innerHTML = svgMotor('claude');
  $('#naIcCodex').innerHTML = svgMotor('codex');
  $('#naDoisA').innerHTML = svgMotor('claude');
  $('#naDoisB').innerHTML = svgMotor('codex');
  $('.na-pasta-ic').innerHTML = ico('folder-open');
  $('#naPastaX').innerHTML = ico('x');
  // barra de icones aparece, a lateral comeca fechada
  $('#sidebar').classList.add('hidden'); $('#dragbar').classList.add('hidden');
  sincronizarIconesLaterais();
  encostarAbas();
  // volta com as abas e os chats de antes; so se nao houver nada e que pergunta o que abrir
  let voltou = false;
  try { voltou = await restaurarAbas(); }
  catch (e) {
    // as abas sumirem sem explicacao e o pior dos mundos: melhor dizer o que houve
    voltou = false;
    console.error('nao consegui restaurar as abas:', e);
    setTimeout(() => alert('Não consegui trazer suas abas de antes.\n\nMotivo: ' + ((e && e.message) || e) + '\n\nO trabalho não foi apagado: ele está em ~/Library/Application Support/cockpit/config.json'), 300);
  }
  if (!voltou) telaNovaAba(true);
})();
