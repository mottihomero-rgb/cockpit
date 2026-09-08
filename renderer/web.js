/* Ponte para o telefone: o mesmo window.api, só que falando por WebSocket com o Mac. */
(function () {
  window.SEM_ELECTRON = true;   // estamos no telefone, pelo navegador
  const pend = new Map();
  const ouvintes = {};
  let seq = 0, ws = null, fila = [], religar = null;
  let jaConectou = false;

  function encerrarPedido(id, erro, resposta) {
    const p = pend.get(id);
    if (!p) return;
    pend.delete(id); clearTimeout(p.timer);
    fila = fila.filter(x => x.id !== id);
    erro ? p.rej(new Error(erro)) : p.res(resposta);
  }

  function ligar() {
    clearTimeout(religar);
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => {
      document.body.classList.remove('sem-mac');
      fila.forEach(x => { if (pend.has(x.id)) ws.send(x.txt); }); fila = [];
      const reconectou = jaConectou; jaConectou = true;
      window.dispatchEvent(new CustomEvent('cockpit:conectado', { detail: { reconectou } }));
    };
    ws.onclose = (ev) => {
      document.body.classList.add('sem-mac');
      // Nunca repetir um envio que talvez já tenha chegado ao Mac.
      for (const id of [...pend.keys()]) encerrarPedido(id, 'A conexão com o Mac caiu. Confira a conversa antes de enviar de novo.');
      if (ev.code === 1008 && /sessao/.test(ev.reason || '')) {
        window.dispatchEvent(new CustomEvent('cockpit:salvar-rascunhos'));
        location.replace('/'); return;
      }
      religar = setTimeout(ligar, 1500);
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.tipo === 'resposta') {
        encerrarPedido(m.id, m.erro, m.resposta);
      } else if (m.tipo === 'evento') {
        (ouvintes[m.canal] || []).forEach(f => f(m.dados));
      }
    };
  }
  ligar();

  const chamar = (nome, arg) => new Promise((res, rej) => {
    const id = ++seq;
    const timer = setTimeout(() => encerrarPedido(id, 'O Mac não respondeu.'), 120000);
    pend.set(id, { res, rej, timer });
    const txt = JSON.stringify({ tipo: 'chamada', id, nome, arg });
    if (ws && ws.readyState === 1) ws.send(txt); else fila.push({ id, txt });
  });

  window.addEventListener('online', ligar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ligar(); });

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
    paneRespond: (o) => chamar('pane:respond', o),
    paneSettings: (o) => chamar('pane:settings', o),
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
    /* R2: o app.js e o MESMO arquivo nos dois. Sem estas duas linhas, abrir a coluna do
       ACP no iPhone morria num TypeError e derrubava o boot da tela inteira. */
    sessionsCli: (engine) => chamar('sessions:cli', engine),
    sessionsAcp: () => chamar('sessions:acp'),
    acpConfig: (o) => chamar('acp:config', o),
    sessionHistory: (o) => chamar('sessions:history', o),
    sessionTitulo: (o) => chamar('sessions:titulo', o),
    buscarConversas: (o) => chamar('sessions:buscar', o),
    renomear: (o) => chamar('sessao:renomear', o),
    /* Apagar conversa manda arquivo do Mac para a Lixeira: o main nem expoe o canal ao Wi-Fi, e
       aqui a resposta sai na hora, com o tipo certo, para o toque nao ficar 2 minutos esperando.
       Sem esta linha o app.js (o MESMO arquivo nos dois) morreria num TypeError. */
    apagarSessao: () => Promise.resolve({ error: 'Apagar conversa só funciona no Mac.' }),
    // ramificar de verdade é só criar conversa nova: vai pelo mesmo cano
    sessaoFork: (o) => chamar('sessao:fork', o),
    skills: (e) => chamar('skills:list', e),
    /* prompts salvos e busca de arquivo do "@": os dois moram no Mac e vem pelo mesmo cano.
       Sem estas duas linhas o menu "/" do telefone morria inteiro num TypeError — o app.js e
       o MESMO arquivo nos dois, e o catch de dentro nao segura erro sincrono. */
    promptsLer: () => chamar('prompts:ler'),
    promptsSalvar: (l) => chamar('prompts:salvar', l),
    buscarArquivos: (o) => chamar('fs:buscarArquivos', o),
    pickFiles: () => Promise.resolve([]),
    pickPhoto: () => Promise.resolve(null),
    // erro interno do processo principal so chega na janela do Mac; aqui e so pra a tela
    // nao ter de checar se a funcao existe
    onErroApp: () => {},
    anexoLer: (f) => chamar('anexo:ler', f),
    colados: () => Promise.resolve({ arquivos: [] }),
    // foto tirada no telefone tambem vira arquivo: quem grava e o Mac, no mesmo colados/
    imagemSalvar: (o) => chamar('imagem:salvar', o),
    /* Recortar a tela esconde a janela do MAC e abre uma tela preta por cima de tudo la. Um
       toque aqui deixaria isso preso a quilometros de distancia: o main nem expoe o canal, e
       aqui a resposta sai na hora com o tipo certo. O item nem aparece no menu do telefone. */
    recortarTela: () => Promise.resolve({ error: 'Recortar a tela só funciona no Mac.' }),
    // este é só leitura: quem passa a Vision na imagem é o Mac, e o texto volta pelo mesmo cano
    ocrLer: (o) => chamar('ocr:ler', o),
    // o quadro branco funciona no iPhone/iPad igual ao Mac: quem grava o PNG e o JSON e o Mac
    quadroSalvar: (o) => chamar('quadro:salvar', o),
    quadroRascunhoGravar: (o) => chamar('quadro:rascunhoGravar', o),
    quadroRascunhoLer: () => chamar('quadro:rascunhoLer'),
    verArquivo: (f) => chamar('arquivo:ver', f),
    // quem fala com a VPS e sempre o Mac: aqui e so o mesmo cano de pedido
    verArquivoVps: (f) => chamar('arquivo:verVps', f),
    sessionsClaudeRemoto: (r) => chamar('sessions:claudeRemoto', r),
    sessionHistoryRemoto: (o) => chamar('sessions:historyRemoto', o),
    termLinhaShell: (cwd) => chamar('term:linhaShell', cwd),
    contaLer: (e) => chamar('conta:ler', e),
    usoLer: (e) => chamar('uso:ler', e),
    /* Trocar a conta do Mac por um toque no telefone é exatamente o que não pode acontecer: o
       main já barra os cinco, e aqui a resposta sai na hora, com o tipo certo, para o menu não
       ficar 2 minutos esperando. Sem estas linhas o app.js (o MESMO arquivo nos dois) morreria
       num TypeError e derrubaria o boot do celular. */
    contasListar: () => Promise.resolve([]),
    contasDisponivel: () => Promise.resolve({ ok: false, motivo: 'Trocar de conta só funciona no Mac.' }),
    contasSalvar: () => Promise.resolve({ error: 'Guarde a conta pelo Mac.' }),
    contasTrocar: () => Promise.resolve({ error: 'Trocar de conta só funciona no Mac.' }),
    contasEsquecer: () => Promise.resolve({ error: 'Esqueça a conta pelo Mac.' }),
    codexReiniciar: () => Promise.resolve({ error: 'Reiniciar o Codex só funciona no Mac.' }),
    // este é só leitura: o telefone pode ver os Apps da conta igual ao Mac
    codexApps: () => chamar('codex:apps'),
    /* leva 10: as tres sao leitura pura e vao pelo mesmo cano do Wi-Fi. A Torre no telefone
       mostra os mesmos chats do Mac, e o chip do git some sozinho em pasta sem repositorio. */
    agentesClaude: () => chamar('agentes:claude'),
    gitStatus: (o) => chamar('git:status', o),
    gitDiff: (o) => chamar('git:diff', o),
    motoresVersoes: () => chamar('motores:versoes'),
    motoresDisponiveis: () => chamar('motores:disponiveis'),
    /* leva 11: no telefone ele VÊ quais robôs do Mac pararam (é leitura, vai pelo mesmo cano),
       mas não dispara nenhum — o main nem expõe esse canal ao Wi-Fi (R1). A resposta sai aqui
       na hora, com o tipo certo, senão o app.js (que é o MESMO arquivo nos dois) morreria num
       TypeError e derrubaria o boot do celular. */
    rotinasListar: () => chamar('rotinas:listar'),
    rotinasDisparar: () => Promise.resolve({ error: 'Disparar uma rotina só funciona no Mac.' }),
    mcpList: (e) => chamar('mcp:list', e),
    mcpAcao: (o) => chamar('mcp:acao', o),
    auth: (o) => chamar('auth:acao', o),
    // terminal
    termRun: (o) => chamar('term:run', o),
    termInput: (o) => chamar('term:input', o),
    termResize: (o) => chamar('term:resize', o),
    termKill: (o) => chamar('term:kill', o),
    onTermEvent: (cb) => { (ouvintes['term:event'] = ouvintes['term:event'] || []).push(cb); },
    // quem mostra aviso do sistema e' o Mac. Responder aqui na hora evita o TypeError que
    // derruba o boot do telefone (o app.js e' o MESMO arquivo nos dois).
    avisarAgente: () => Promise.resolve({ ok: false }),
    // atalho global é do teclado do MAC: o telefone não liga nem desliga isso. Responder aqui
    // na hora evita o TypeError que derrubaria o boot (o app.js é o MESMO arquivo nos dois).
    atalhosEstado: () => Promise.resolve({ falhos: [] }),
    atalhosLigar: () => Promise.resolve({ falhos: [] }),
    /* Caixa de entrada: a pasta e os arquivos moram no MAC, e o main nem expõe os três canais
       ao Wi-Fi (R1). Aqui as respostas saem na hora, com o tipo certo, para o app.js — que é o
       MESMO arquivo nos dois — não morrer num TypeError e derrubar o boot do telefone.
       O onInbox existe e não faz nada: aviso de arquivo que está no Mac não serve aqui. */
    inboxConsumir: () => Promise.resolve({ error: 'A caixa de entrada é do Mac.' }),
    inboxPasta: () => Promise.resolve(null),
    inboxOuvindo: () => Promise.resolve({ ok: false }),
    onInbox: () => {},
    // no telefone nao faz sentido mexer no servidor nem abrir janela do Mac
    webEstado: () => Promise.resolve({ ligado: true, endereco: location.origin, senha: '' }),
    webLigar: () => Promise.resolve({ ligado: true, endereco: location.origin, senha: '' }),
    openUrl: (u) => { window.open(u, '_blank'); return Promise.resolve(); },
    onPaneEvent: (cb) => { (ouvintes['pane:event'] = ouvintes['pane:event'] || []).push(cb); },
    onCodexEvent: (cb) => { (ouvintes['codex:event'] = ouvintes['codex:event'] || []).push(cb); },
    onMenu: () => {},
  };
})();
