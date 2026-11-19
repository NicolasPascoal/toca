// O "cérebro" da Toca: cada personagem é um agente do Claude Agent SDK.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AGENTS_DIR = resolve(ROOT, 'agents');
const SESSIONS_FILE = resolve(ROOT, 'data', 'sessions.json');

const BOARD_MARK = '---quadro---';

// "${VAR:-padrão}" -> valor da variável de ambiente ou o padrão
function expandEnv(value) {
  return value.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, name, fallback = '') => process.env[name] || fallback);
}

export function loadAgents() {
  const { agents } = JSON.parse(readFileSync(resolve(AGENTS_DIR, 'agents.json'), 'utf8'));
  return agents.map((a) => ({
    ...a,
    cwd: resolve(ROOT, expandEnv(a.cwd)),
    systemPrompt: readFileSync(resolve(AGENTS_DIR, a.persona), 'utf8'),
  }));
}

function loadSessions() {
  if (!existsSync(SESSIONS_FILE)) return {};
  try { return JSON.parse(readFileSync(SESSIONS_FILE, 'utf8')); } catch { return {}; }
}

function saveSession(agentId, sessionId) {
  const sessions = loadSessions();
  sessions[agentId] = sessionId;
  mkdirSync(dirname(SESSIONS_FILE), { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

export function forgetSession(agentId) {
  const sessions = loadSessions();
  delete sessions[agentId];
  mkdirSync(dirname(SESSIONS_FILE), { recursive: true });
  writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

// Separa a fala (o que o personagem diz em voz alta) do quadro (relatório em markdown).
export function splitReply(text) {
  const i = text.indexOf(BOARD_MARK);
  if (i === -1) return { speech: text.trim(), board: '' };
  return { speech: text.slice(0, i).trim(), board: text.slice(i + BOARD_MARK.length).trim() };
}

/**
 * Manda uma mensagem para um agente e devolve { speech, board, costUsd, sessionId }.
 * - onActivity(texto): chamado quando o agente usa uma ferramenta (para o balão de status).
 * - askPermission(tool, input): Promise<boolean>, chamado para ferramentas em "askTools".
 */
export async function ask(agent, text, { onActivity = () => {}, askPermission = async () => false } = {}) {
  mkdirSync(agent.cwd, { recursive: true });
  const resume = loadSessions()[agent.id];

  const run = query({
    prompt: text,
    options: {
      model: agent.model,
      effort: agent.effort,
      cwd: agent.cwd,
      systemPrompt: agent.systemPrompt,
      allowedTools: agent.allowedTools,
      disallowedTools: agent.disallowedTools,
      settingSources: [], // não herda configurações do seu Claude Code: cada personagem é isolado
      permissionMode: 'default',
      ...(resume ? { resume } : {}),
      canUseTool: async (toolName, input) => {
        if (!agent.askTools.includes(toolName)) {
          return { behavior: 'deny', message: `${agent.name} não tem permissão para usar ${toolName}.` };
        }
        const ok = await askPermission(toolName, input);
        return ok ? { behavior: 'allow', updatedInput: input } : { behavior: 'deny', message: 'O Nicolas não autorizou.' };
      },
    },
  });

  let finalText = '';
  for await (const msg of run) {
    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'tool_use') onActivity(describeTool(block.name, block.input));
      }
    }
    if (msg.type === 'result') {
      if (msg.session_id) saveSession(agent.id, msg.session_id);
      if (msg.subtype !== 'success') throw new Error(`O agente parou: ${msg.subtype}`);
      finalText = msg.result;
      return { ...splitReply(finalText), costUsd: msg.total_cost_usd, sessionId: msg.session_id };
    }
  }
  return { ...splitReply(finalText), costUsd: 0, sessionId: resume };
}

// Texto curto do que o agente está fazendo, para o balão de status na sala.
function describeTool(name, input = {}) {
  switch (name) {
    case 'Read': return `lendo ${input.file_path ?? 'um arquivo'}`;
    case 'Grep': return `procurando "${input.pattern ?? ''}"`;
    case 'Glob': return `listando ${input.pattern ?? 'arquivos'}`;
    case 'Bash': return `rodando ${String(input.command ?? '').slice(0, 60)}`;
    case 'WebSearch': return `pesquisando "${input.query ?? ''}"`;
    case 'WebFetch': return `abrindo ${input.url ?? 'uma página'}`;
    default: return `usando ${name}`;
  }
}
