/* Só o telefone: instalação, teclado, rascunhos e atualização do histórico do Mac.
   Não grava o config do desktop e não liga nenhum motor para ler uma conversa. */
(function () {
  if (!window.SEM_ELECTRON) return;
  let pronto = false, atualizando = false;
  let reabrindo = false;
  const selos = new WeakMap();
  const chaveRascunhos = 'cockpit:rascunhos';
  const sessao = P => P.sessaoId || P.resumeId || '';

  function altura() {
    if (window.visualViewport && window.visualViewport.scale !== 1) return;
    document.documentElement.style.setProperty('--altura-app', (window.visualViewport?.height || innerHeight) + 'px');
  }
  altura();
  window.visualViewport?.addEventListener('resize', altura);
  window.addEventListener('resize', altura);

  function mostrarConversa() {
    requestAnimationFrame(() => {
      if (!focusPane || !matchMedia('(max-width: 820px), (pointer: coarse) and (max-width: 1100px)').matches) return;
      const corpo = abaDe(focusPane)?.corpoEl;
      if (!corpo) return;
      const deslocamento = focusPane.el.getBoundingClientRect().left - corpo.getBoundingClientRect().left;
      corpo.scrollTo({ left: corpo.scrollLeft + deslocamento, behavior: 'instant' });
      if (pronto && !reabrindo) guardarConversa();
    });
  }
  window.addEventListener('cockpit:foco', mostrarConversa);

  function guardarConversa() {
    if (!pronto || reabrindo || !focusPane) return;
    const P = focusPane;
    try {
      if (sessao(P)) sessionStorage.setItem('cockpit:ultima-conversa', JSON.stringify({
        id: sessao(P), engine: P.engine, cwd: P.cwd, file: P.sessaoFile || '', title: P.titulo || '', remoto: NA_VPS(P.cwd),
      }));
      else sessionStorage.removeItem('cockpit:ultima-conversa');
    } catch {}
  }

  function guardarRascunhos() {
    if (!pronto) return;
    guardarConversa();
    const itens = [...panes.values()].map((P, indice) => ({
      engine: P.engine, cwd: P.cwd, sessao: sessao(P), indice,
      texto: P.el.querySelector('.p-input')?.value || '', anexos: P.anexos || [],
    })).filter(x => x.texto || x.anexos.length);
    try { sessionStorage.setItem(chaveRascunhos, JSON.stringify(itens)); } catch {}
  }
  function reporRascunhos() {
    let itens = [];
    try { itens = JSON.parse(sessionStorage.getItem(chaveRascunhos) || '[]'); } catch {}
    for (const [indice, P] of [...panes.values()].entries()) {
      const item = itens.find(x => x.engine === P.engine && x.cwd === P.cwd
        && (x.sessao ? x.sessao === sessao(P) : !sessao(P) && x.indice === indice));
      const campo = P.el.querySelector('.p-input');
      if (!item || !campo || campo.value) continue;
      campo.value = item.texto;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      if (item.anexos?.length && !P.anexos.length) anexar(P, item.anexos).catch(() => {});
    }
  }
  document.addEventListener('input', e => { if (e.target.matches('.p-input')) guardarRascunhos(); });
  window.addEventListener('pagehide', guardarRascunhos);
  window.addEventListener('cockpit:salvar-rascunhos', guardarRascunhos);

  async function atualizar() {
    if (!pronto || document.hidden || atualizando || document.body.classList.contains('sem-mac')) return;
    const P = focusPane;
    // Um painel com motor próprio recebe os eventos em tempo real. Nunca substituir
    // sua resposta por uma leitura parcial de disco, nem reiniciar esse motor.
    if (!P || P.started || P.busy || !sessao(P) || restaurando) return;
    const id = sessao(P), engine = P.engine;
    atualizando = true;
    try {
      const msgs = (engine === 'claude' && NA_VPS(P.cwd))
        ? await window.api.sessionHistoryRemoto({ id })
        : await window.api.sessionHistory({ engine, file: P.sessaoFile, id, cwd: P.cwd });
      if (P.started || P.busy || !panes.has(P.id) || sessao(P) !== id || P.engine !== engine || !Array.isArray(msgs) || !msgs.length) return;
      const selo = JSON.stringify(msgs);
      if (selos.get(P) === selo) return;
      const topo = P.chat.scrollTop;
      const noFim = P.chat.scrollHeight - topo - P.chat.clientHeight < 100;
      P.hist = []; P.blocks.clear(); P.tools.clear(); P.execEl = null; P.rolagem = null;
      P.chat.replaceChildren();
      for (const m of msgs) renderizarHistorico(P, m);
      selos.set(P, selo);
      if (noFim) scroll(P, true); else P.chat.scrollTop = topo;
    } catch { /* a ponte já mostra a conexão caída; preservar o histórico atual */ }
    finally { atualizando = false; }
  }

  function voltou() {
    if (!pronto || document.hidden) return;
    atualizar();
    for (const engine of ['claude', 'codex', 'acp', 'gemini', 'grok']) {
      if (lateralAberta(engine)) loadHist(engine, true).catch(() => {});
    }
  }
  window.addEventListener('cockpit:pronto', async () => {
    pronto = true; reabrindo = true;
    try {
      const ultima = JSON.parse(sessionStorage.getItem('cockpit:ultima-conversa') || 'null');
      if (ultima?.id && ultima.cwd && ['claude', 'codex', 'acp', 'gemini', 'grok'].includes(ultima.engine)) await openSession(ultima);
    } catch { /* o histórico completo continua disponível na gaveta */ }
    finally { reabrindo = false; }
    reporRascunhos(); mostrarConversa(); voltou();
  });
  window.addEventListener('cockpit:conectado', voltou);
  window.addEventListener('pageshow', voltou);
  document.addEventListener('visibilitychange', voltou);
  // Resposta terminada em outra tela: trazer do MESMO histórico. Sem cópia separada.
  window.api.onPaneEvent(ev => {
    if (!panes.has(ev.paneId) && ev.kind === 'turn-end') setTimeout(atualizar, 500);
  });

  const gaveta = document.getElementById('btnGaveta');
  new MutationObserver(() => gaveta?.setAttribute('aria-expanded', String(document.body.classList.contains('gaveta'))))
    .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const instalar = document.getElementById('btnInstalar');
  const dialogo = document.getElementById('instalarApp');
  const standalone = matchMedia('(display-mode: standalone)');
  function modoApp() { instalar.hidden = standalone.matches || navigator.standalone === true; }
  modoApp(); standalone.addEventListener('change', modoApp);
  instalar.addEventListener('click', () => dialogo.showModal());
  document.getElementById('fecharInstalar').addEventListener('click', () => dialogo.close());
})();
