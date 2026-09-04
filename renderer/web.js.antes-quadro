/* Ponte para o telefone: o mesmo window.api, só que falando por WebSocket com o Mac. */
(function () {
  window.SEM_ELECTRON = true;   // estamos no telefone, pelo navegador
  const pend = new Map();
  const ouvintes = {};
  let seq = 0, ws = null, fila = [];

  function ligar() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => { document.body.classList.remove('sem-mac'); fila.forEach(t => ws.send(t)); fila = []; };
    ws.onclose = () => { document.body.classList.add('sem-mac'); setTimeout(ligar, 1500); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.tipo === 'resposta') {
        const p = pend.get(m.id);
        if (p) { pend.delete(m.id); m.erro ? p.rej(new Error(m.erro)) : p.res(m.resposta); }
      } else if (m.tipo === 'evento') {
        (ouvintes[m.canal] || []).forEach(f => f(m.dados));
      }
    };
  }
  ligar();

  const chamar = (nome, arg) => new Promise((res, rej) => {
    const id = ++seq;
    pend.set(id, { res, rej });
    const txt = JSON.stringify({ tipo: 'chamada', id, nome, arg });
    if (ws && ws.readyState === 1) ws.send(txt); else fila.push(txt);
    setTimeout(() => { if (pend.has(id)) { pend.delete(id); rej(new Error('o Mac não respondeu')); } }, 120000);
  });

  window.api = {
    getConfig: () => chamar('config:get'),
    // O telefone roda o MESMO app.js do Mac, inclusive o savePanes(). Como cada tela guarda a
    // sua copia do config e grava o arquivo inteiro, um Safari aberto no iPhone desde ontem
    // escrevia o retrato de ontem por cima e as abas do Mac sumiam. O telefone le, mas nao
    // manda: quem manda nas abas e o Mac.
    setConfig: () => Promise.resolve(true),
    home: () => chamar('sys:home'),
    // no telefone estas tres nao existem: quem abre janela do sistema e o Mac. Responder na
    // hora evita o toque ficar 2 minutos esperando uma resposta que nunca vem.
    pickFolder: () => { alert('No iPhone use o campo de caminho ou os atalhos: a janela de pastas só abre no Mac.'); return Promise.resolve(null); },
    listDir: (d) => chamar('fs:list', d),
    readFile: (f) => chamar('fs:read', f),
    openPath: (p) => chamar('shell:open', p),
    abrirLink: (u) => { window.open(u, '_blank'); return Promise.resolve(); },
    paneStart: (o) => chamar('pane:start', o),
    paneSend: (o) => chamar('pane:send', o),
    paneSteer: (o) => chamar('pane:steer', o),
    paneCompactar: (o) => chamar('pane:compactar', o),
    paneInterrupt: (o) => chamar('pane:interrupt', o),
    paneStop: (o) => chamar('pane:stop', o),
    approve: (o) => chamar('pane:approve', o),
    codexModels: () => chamar('codex:models'),
    codexApiStatus: () => chamar('codex:api-status'),
    codexApiKey: () => Promise.resolve({ error: 'Guarde a chave pelo Mac.' }),
    codexApiTest: () => Promise.resolve({ error: 'Teste a chave pelo Mac.' }),
    codexApiConfig: () => Promise.resolve({ error: 'Altere o uso por créditos pelo Mac.' }),
    sessionsClaude: (r) => chamar('sessions:claude', r),
    sessionsCodex: (r) => chamar('sessions:codex', r),
    sessionHistory: (o) => chamar('sessions:history', o),
    sessionTitulo: (o) => chamar('sessions:titulo', o),
    buscarConversas: (o) => chamar('sessions:buscar', o),
    renomear: (o) => chamar('sessao:renomear', o),
    skills: (e) => chamar('skills:list', e),
    pickFiles: () => Promise.resolve([]),
    pickPhoto: () => Promise.resolve(null),
    // erro interno do processo principal so chega na janela do Mac; aqui e so pra a tela
    // nao ter de checar se a funcao existe
    onErroApp: () => {},
    anexoLer: (f) => chamar('anexo:ler', f),
    colados: () => Promise.resolve({ arquivos: [] }),
    verArquivo: (f) => chamar('arquivo:ver', f),
    contaLer: (e) => chamar('conta:ler', e),
    usoLer: (e) => chamar('uso:ler', e),
    mcpList: (e) => chamar('mcp:list', e),
    mcpAcao: (o) => chamar('mcp:acao', o),
    auth: (o) => chamar('auth:acao', o),
    // terminal
    termRun: (o) => chamar('term:run', o),
    termInput: (o) => chamar('term:input', o),
    termResize: (o) => chamar('term:resize', o),
    termKill: (o) => chamar('term:kill', o),
    onTermEvent: (cb) => { (ouvintes['term:event'] = ouvintes['term:event'] || []).push(cb); },
    // no telefone nao faz sentido mexer no servidor nem abrir janela do Mac
    webEstado: () => Promise.resolve({ ligado: true, endereco: location.origin, senha: '' }),
    webLigar: () => Promise.resolve({ ligado: true, endereco: location.origin, senha: '' }),
    openUrl: (u) => { window.open(u, '_blank'); return Promise.resolve(); },
    onPaneEvent: (cb) => { (ouvintes['pane:event'] = ouvintes['pane:event'] || []).push(cb); },
    onMenu: () => {},
  };
})();
