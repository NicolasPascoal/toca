# Toca

A sala aconchegante dos agentes. O Alfred (code review) fica na poltrona com o whisky, e o Nexus (financeiro) fica esparramado no sofá jogando no celular.

## Rodar a sala (Fase 1)

```bash
npm install
npm run dev
```

Abra http://localhost:5520 no Chrome ou no Edge.

- **Chamar:** clique no agente, aperte 1 (Alfred) / 2 (Nexus), ou comece a frase com o nome.
- **Falar:** segure Espaço (ou o botão 🎙), fale e solte. Ex.: "Alfred, revisa meu último commit".
- **Escrever:** use a caixa embaixo.
- O agente responde falando (voz grátis do navegador) com a boca mexendo. Relatórios longos abrem no quadro.
- Se ele pedir para rodar um comando, aparece Autorizar / Negar.
- **Tarefas longas:** quando o agente começa a usar ferramentas, ele avisa ("Deixe comigo, senhor"), vai pro posto de trabalho (Alfred na mesa, Nexus senta no sofá) e o balão mostra o que ele está fazendo. Enquanto isso você pode falar com o outro. Quando termina, ele volta pro lugar, toca um "plim" e entrega o resultado (ou fica com "· pronto" na plaquinha até você chamar).
- Esc fecha o quadro ou dispensa o agente.

### Vozes (Piper, grátis e local)

As vozes ficam em `tools/piper/voices` (fora do git): `faber`, `cadu` e `jeff`, todas pt-BR. Amostras em `tools/amostras/`. Para trocar a voz de alguém, mude `voice.model` em `agents/agents.json`; `lengthScale` maior = fala mais devagar. Se o Piper não estiver lá, a sala usa a voz do navegador.

Obs.: o Piper 2023 não lê os fonemas de várias letras dos arquivos de voz mais novos; esses itens foram removidos dos `.onnx.json` (não afetam o português).

O mesmo `npm run dev` sobe a API dos cérebros (`brain/api.js`); a chave do `.env` fica só no servidor e só responde para o localhost.

## App de desktop (Fase 5)

```bash
npm run app
```

Abre a Toca numa janela própria e deixa um ícone de lareira na bandeja (perto do relógio). Fechar a janela só esconde.

| Atalho (de qualquer lugar do Windows) | O que faz |
|---|---|
| Ctrl+Alt+T | Mostra/esconde a sala (se estiver ocupado, tenta Ctrl+Alt+Espaço e depois Ctrl+Shift+Espaço) |
| Ctrl+Alt+A | Chama o Alfred |
| Ctrl+Alt+N | Chama o Nexus |

No menu da bandeja dá pra marcar "Abrir junto com o Windows" (abre escondido, só na bandeja).

### Microfone (Whisper, grátis e local)

A transcrição usa o whisper.cpp com o modelo `ggml-small-q5_1` (em `tools/whisper`, fora do git), no app e no navegador: o áudio não sai do PC. Leva uns 4 a 6 segundos para uma frase curta. Se o Whisper não estiver lá, o navegador usa o reconhecimento do Chrome/Edge (que envia o áudio ao Google) e o app esconde o microfone.

## Falar com os cérebros pelo terminal (Fase 0)

1. Copie `.env.example` para `.env` e coloque a sua `ANTHROPIC_API_KEY` (crie em https://platform.claude.com; a cobrança é por uso).
2. Rode `npm run agente`.
3. Escreva, por exemplo, `alfred: revisa o último commit do repositório X` ou `nexus: quanto eu gastei com delivery esse mês?`.

Comandos: `/trocar nexus`, `/esquecer` (zera a memória do agente atual), `/sair`.

## Onde fica cada coisa

| Caminho | O que é |
|---|---|
| `agents/agents.json` | Lista de agentes: modelo, esforço, pasta de trabalho, ferramentas permitidas e lugar na sala |
| `agents/*.md` | Personalidade e regras de cada agente |
| `brain/brain.js` | Cérebro: chama o Claude Agent SDK, guarda a sessão de cada agente e separa a fala do quadro |
| `brain/cli.js` | Conversa pelo terminal |
| `src/room.js` | A sala: móveis, lareira, janela com chuva, luzes |
| `src/characters.js` | Bonecos provisórios (na Fase 2 viram VRM do VRoid) |
| `src/main.js` | Câmera, clique para chamar, balões de fala, pós-processamento |

## Créditos

O plano de voz, sincronia de boca e quadro (próximas fases) se inspira no [Incarna](https://github.com/andrewsegas/incarna), de Andrews Egas (MIT). O código que vier de lá vai manter o aviso de copyright original.
