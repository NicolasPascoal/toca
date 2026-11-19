# Roadmap da Toca

O que já está pronto e o que falta fazer.

## Pronto

- [x] **Fase 0 · Cérebros:** Alfred (code review) e Nexus (financeiro) no Claude Agent SDK, com sessão persistente e permissões por agente (`brain/`, `agents/`)
- [x] **Fase 1 · A sala:** sala 3D com lareira, chuva, quadro, mesa e os bonecos provisórios (`src/room.js`, `src/characters.js`)
- [x] **Fase 3 · Voz e conversa:** microfone (Whisper local ou reconhecimento do navegador), voz própria com Piper, boca pelo volume do áudio, quadro de relatórios, pedido de permissão
- [x] **Fase 4 · Trabalho de verdade:** tarefas longas em segundo plano, Alfred vai à mesa e Nexus senta no sofá, aviso com "plim" quando termina
- [x] **Fase 5 · App de desktop:** Electron com bandeja e atalhos Ctrl+Alt+T / A / N

## Depende do Nicolas

- [ ] Colocar a `ANTHROPIC_API_KEY` no `.env` e testar os cérebros de verdade (`npm run agente`)
- [ ] Trazer o Alfred original do outro notebook (`~/.claude/agents/alfred.md` ou similar) e juntar com `agents/alfred.md`
- [ ] Definir as integrações do Nexus com o iPhone (ex.: automação de Transação do app Atalhos)
- [ ] Escolher como o Alfred pega o código para revisar (ver "Code review" abaixo)
- [ ] Deixar o repositório privado antes de o Nexus ter dados financeiros

## Próximo: Toca no Umbrel (app web)

O servidor é um notebook com 16 GB de RAM rodando umbrelOS, acessado pelo Tailscale.

- [ ] Empacotar em Docker (`Dockerfile` + `docker-compose.yml`) com Piper e whisper.cpp para Linux
- [ ] Login com senha (a Toca deixa de ser só `localhost`)
- [ ] Escolha do microfone na tela: "Google (melhor)" ou "Whisper (privado)"
- [ ] Instalável como app pelo navegador (PWA) no notebook e no iPhone
- [ ] HTTPS pelo Tailscale (`tailscale serve`): o microfone só funciona com HTTPS
- [ ] Testar o contêiner no Docker Desktop e depois subir no Umbrel
- [ ] Decidir se o app Electron continua ou sai (com PWA ele pode ficar desnecessário)

## Nexus

- [ ] Projetar o "sistema do Nexus": serviço separado no Umbrel que recebe os dados do iPhone, guarda num banco e expõe ferramentas para o agente
- [ ] Ligar o Nexus a esse sistema (servidor MCP no Agent SDK, ou OpenClaw)
- [ ] Notificações de volta para o iPhone (ex.: "estourou o orçamento de delivery")
- [ ] Ajustar a voz do Nexus (mais jovem e descontraído), como foi feito com o Alfred

## Code review do Alfred no servidor

- [ ] Opção 1: revisar o que sobe para o GitHub (branch ou PR em rascunho) com token só de leitura
- [ ] Opção 2: repositório git no Umbrel como segundo remoto (`git push umbrel minha-branch`) para revisar antes de publicar
- [ ] Opção 3 (rápida): gancho `pre-push` que manda o diff para o Alfred

## Cérebro por agente

- [ ] Cada agente escolhe o próprio cérebro em `agents.json`: Claude Agent SDK (Alfred) ou OpenClaw (Nexus, se for o caso); referência de como chamar o OpenClaw no Incarna (`server.js`, `/v1/chat/completions` com `model: openclaw/<id>`)
- [ ] Ollama só para tarefas pequenas e privadas, se fizer falta

## Visual (quando der vontade)

- [ ] Trocar os bonecos por modelos 3D de verdade (referência em `assets/referencias/`); geradores grátis testados estouraram limite, retomar quando houver opção boa
- [ ] Deixar o Piper sempre carregado (fala começa mais rápido) e o Whisper também (whisper-server)
- [ ] Ciclo dia/noite seguindo o relógio, música ambiente
