# Cockpit

Codex e Claude lado a lado, numa tela só, com acesso a tudo no Mac.

App de mesa (Electron) que abre vários painéis de terminal com agentes de IA rodando ao mesmo tempo. Dá pra falar com cada um, ver o gasto de tokens de cada conversa e continuar do celular pelo navegador.

## O que tem dentro

- **Painéis lado a lado** — Claude Code e Codex abertos juntos, cada um no seu terminal
- **Histórico de conversa** — as sessões ficam salvas e dá pra voltar nelas
- **Medidor de tokens** — mostra quanto da janela de contexto já foi usada
- **Acesso pelo celular** — liga um servidor local protegido por senha e você continua do iPhone, na mesma rede ou via Tailscale

## Instalar

Baixe o app pronto na aba [Releases](../../releases) (macOS).

## Rodar a partir do código

```bash
npm install
npm start
```

Precisa de Node.js 18+ e do Claude Code e/ou Codex CLI já instalados na máquina.

## Gerar o app

```bash
npm run build
```

O resultado sai na pasta `dist/`.

## Segurança

O acesso pelo celular é desligado por padrão. Quando ligado, gera uma senha aleatória a cada instalação e escuta só na rede local (ou só no Tailscale, se você marcar). Nada de senha ou chave fica dentro deste repositório — as configurações ficam na pasta de dados do app, no seu computador.

## Licença

MIT — Homero Motti


