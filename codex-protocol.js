'use strict';

// Adaptação do protocolo app-server. Funções puras para poder conferir o contrato
// sem ligar o motor, consumir cota ou alterar a configuração do usuário.
const path = require('path');

function decodeOutput(value, encoded = false) {
  if (Array.isArray(value)) return Buffer.from(value).toString('utf8');
  if (typeof value !== 'string') return '';
  if (!encoded) return value;
  const compact = value.replace(/\s/g, '');
  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1) return value;
  const bytes = Buffer.from(compact, 'base64');
  if (bytes.toString('base64').replace(/=+$/, '') !== compact.replace(/=+$/, '')) return value;
  return bytes.toString('utf8');
}

function normalizeSettings(previous = {}, changes = {}) {
  const result = { ...previous };
  for (const key of ['model', 'cwd', 'approval', 'effort', 'serviceTier', 'experimentalContext', 'collaborationMode']) {
    if (changes[key] !== undefined && changes[key] !== null) result[key] = changes[key];
  }
  result.serviceTier = result.serviceTier === 'fast' ? 'priority' : (['default', 'priority'].includes(result.serviceTier) ? result.serviceTier : '');
  const mode = typeof result.collaborationMode === 'object' ? result.collaborationMode.mode : result.collaborationMode;
  result.collaborationMode = mode === 'plan' || result.approval === 'plan' ? 'plan' : 'default';
  result.experimentalContext = result.experimentalContext === true;
  result.contextMode = result.experimentalContext ? 'experimental' : 'standard';
  return result;
}

function threadConfig(settings) {
  return {
    'features.context_management.experimental_mode': settings.experimentalContext === true,
    ...(settings.effort ? { model_reasoning_effort: settings.effort } : {}),
  };
}

function sandboxPolicy(sandbox, cwd) {
  if (sandbox === 'danger-full-access') return { type: 'dangerFullAccess' };
  if (sandbox === 'read-only') return { type: 'readOnly' };
  return { type: 'workspaceWrite', writableRoots: cwd ? [cwd] : [], networkAccess: false };
}

function turnSettings(settings, policy) {
  const result = {
    ...(settings.model ? { model: settings.model } : {}),
    ...(settings.effort ? { effort: settings.effort } : {}),
    ...(settings.cwd ? { cwd: settings.cwd } : {}),
    approvalPolicy: policy.policy,
    sandboxPolicy: sandboxPolicy(policy.sandbox, settings.cwd),
    ...(settings.serviceTier ? { serviceTier: settings.serviceTier } : {}),
  };
  if (settings.model) result.collaborationMode = {
    mode: settings.collaborationMode || 'default',
    settings: { model: settings.model, reasoning_effort: settings.effort || null, developer_instructions: null },
  };
  return result;
}

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
function userInput(text, attachments = [], { fs, destination = 'local' } = {}) {
  const input = [];
  if (typeof text === 'string' && text.trim()) input.push({ type: 'text', text });
  for (const file of attachments || []) {
    if (!file || typeof file.path !== 'string' || !file.path) throw new Error('Anexo sem caminho. Cole ou anexe o arquivo novamente.');
    const ext = path.extname(file.path).slice(1).toLowerCase();
    const mime = IMAGE_MIME[ext];
    if (mime) {
      if (!fs || !fs.existsSync(file.path)) throw new Error('Não encontrei a imagem: ' + path.basename(file.path));
      if (destination === 'local') input.push({ type: 'localImage', path: path.resolve(file.path) });
      else {
        // O caminho do Mac não existe na VPS. A imagem segue no próprio pedido.
        const stat = fs.statSync(file.path);
        if (stat.size > 20 * 1024 * 1024) throw new Error('A imagem é grande demais para enviar à VPS (máximo 20 MB).');
        input.push({ type: 'image', url: 'data:' + mime + ';base64,' + fs.readFileSync(file.path).toString('base64') });
      }
    } else {
      if (destination !== 'local' && !file.path.startsWith(destination + ':')) {
        throw new Error('Este arquivo está no Mac. Envie para um chat local ou anexe o caminho do arquivo na VPS.');
      }
      const filePath = destination === 'local' ? file.path : file.path.slice(destination.length + 1);
      // Preserva a lista já montada por versões antigas da interface.
      if (!(text || '').includes(file.path)) input.push({ type: 'text', text: 'Arquivo anexado pelo usuário: ' + filePath });
    }
  }
  if (!input.length) throw new Error('Escreva uma mensagem ou anexe um arquivo.');
  return input;
}

function answersFor(questions, answers, allowEmpty = false) {
  const result = {};
  for (const q of questions || []) {
    let value = answers && answers[q.id];
    if (value && !Array.isArray(value) && typeof value === 'object') value = value.answers;
    if (typeof value === 'string') value = [value];
    value = Array.isArray(value) ? value.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [];
    if (!value.length && !allowEmpty) throw new Error('Responda à pergunta: ' + (q.header || q.question || q.id));
    result[q.id] = { answers: value };
  }
  if (!Object.keys(result).length && !allowEmpty) throw new Error('Este pedido não tem perguntas válidas.');
  return result;
}

function validateContent(schema, content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw new Error('Preencha os dados solicitados.');
  for (const key of schema && schema.required || []) {
    if (content[key] === undefined || content[key] === null || content[key] === '') throw new Error('Preencha o campo: ' + key);
  }
  for (const [key, value] of Object.entries(content)) {
    const spec = schema && schema.properties && schema.properties[key];
    if (!spec) {
      if (schema && schema.additionalProperties === false) throw new Error('Campo não solicitado: ' + key);
      continue;
    }
    if (spec.type === 'string' && typeof value !== 'string' || spec.type === 'boolean' && typeof value !== 'boolean' || spec.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value)) || spec.type === 'integer' && !Number.isInteger(value) || spec.type === 'array' && !Array.isArray(value)) throw new Error('Valor inválido no campo: ' + key);
    if (spec.enum && !spec.enum.includes(value)) throw new Error('Escolha uma opção válida: ' + key);
    if (typeof value === 'string' && (spec.minLength != null && value.length < spec.minLength || spec.maxLength != null && value.length > spec.maxLength)) throw new Error('Tamanho inválido no campo: ' + key);
    if (typeof value === 'number' && (spec.minimum != null && value < spec.minimum || spec.maximum != null && value > spec.maximum)) throw new Error('Número fora do limite: ' + key);
  }
  return content;
}

function requestResponse(request, data) {
  if (request.kind === 'input') return { answers: answersFor(request.questions, data.answers, data.action === 'cancel') };
  if (request.kind === 'elicitation') {
    const action = data.action;
    if (!['accept', 'decline', 'cancel'].includes(action)) throw new Error('Escolha confirmar ou cancelar.');
    return { action, ...(action === 'accept' && request.mode !== 'url' ? { content: validateContent(request.schema, data.content) } : { content: null }) };
  }
  if (request.kind === 'perm') return { permissions: data.allow === true ? request.permissions || {} : {}, scope: 'turn' };
  if (request.kind === 'cmd' || request.kind === 'file') return {
    decision: request.legacy
      ? (data.allow === true ? 'approved' : { denied: { rejection: 'Negado pelo usuário' } })
      : (data.allow === true ? 'accept' : 'decline'),
  };
  throw new Error('Tipo de pedido não suportado.');
}

function imageData(item) {
  const raw = item.result || '';
  let url = '';
  if (/^data:image\/(png|jpeg|webp|gif);base64,/i.test(raw) || /^https?:\/\//i.test(raw)) url = raw;
  else if (raw && /^[A-Za-z0-9+/\s]+={0,2}$/.test(raw)) url = 'data:image/png;base64,' + raw.replace(/\s/g, '');
  return { id: item.id, path: item.savedPath || '', url, prompt: item.revisedPrompt || '', status: item.status || '', error: item.failure || null };
}

function historyItem(item) {
  if (!item) return null;
  if (item.type === 'userMessage') {
    const text = (item.content || []).filter(x => x.type === 'text').map(x => x.text || '').join('\n');
    const attachments = (item.content || []).filter(x => ['localImage', 'image', 'localAudio', 'audio'].includes(x.type)).map(x => ({ path: x.path || '', url: x.url || '', nome: x.path ? path.basename(x.path) : 'Imagem anexada', mini: /^data:image\//.test(x.url || '') ? x.url : undefined }));
    return { role: 'user', text, attachments, anexos: attachments };
  }
  if (item.type === 'agentMessage') return { role: 'bot', text: item.text || '', phase: item.phase || '' };
  if (item.type === 'plan') return { role: 'plan', kind: 'plan', text: item.text || '', id: item.id };
  if (item.type === 'imageGeneration') return { role: 'image', kind: 'generated-image', ...imageData(item) };
  if (item.type === 'commandExecution') return { role: 'tool', name: 'Terminal', arg: item.command || '', output: item.aggregatedOutput || '' };
  if (item.type === 'fileChange') return { role: 'tool', name: 'Editando arquivo', arg: (item.changes || []).map(x => x.path || '').join(', ') };
  if (item.type === 'webSearch') return { role: 'tool', name: 'Pesquisando na web', arg: item.query || '' };
  if (item.type === 'mcpToolCall' || item.type === 'dynamicToolCall') return { role: 'tool', name: [item.server, item.tool].filter(Boolean).join(' · '), arg: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {}), output: item.result ? JSON.stringify(item.result) : '' };
  if (item.type === 'collabAgentToolCall') return { role: 'tool', name: 'Time de agentes', arg: item.prompt || item.tool || '' };
  if (item.type === 'functionCallOutput') return { role: 'tool', name: item.name || 'Ferramenta', arg: '', output: typeof item.output === 'string' ? item.output : JSON.stringify(item.output) };
  return null;
}

module.exports = { decodeOutput, normalizeSettings, threadConfig, turnSettings, userInput, answersFor, requestResponse, imageData, historyItem };
