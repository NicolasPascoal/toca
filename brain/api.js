// API da Toca, rodando dentro do servidor do Vite (um só `npm run dev`).
//   GET  /api/agents              -> lista de agentes (sem segredos)
//   POST /api/ask {agent, text}   -> stream SSE: activity | permission | reply | error
//   POST /api/permission {id, allow}
import { loadAgents, ask } from './brain.js';
import { synthesize, piperAvailable } from './tts.js';
import { transcribe, whisperAvailable } from './stt.js';

function readRaw(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { req.destroy(); reject(new Error('áudio grande demais')); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const pending = new Map(); // pedidos de permissão esperando o Nicolas
let nextId = 1;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export function tocaApi() {
  return async (req, res, next) => {
    const url = req.url.split('?')[0];
    if (!url.startsWith('/api/')) return next();

    // Só aceita chamadas da própria máquina
    const ip = req.socket.remoteAddress || '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return json(res, 403, { error: 'só localhost' });

    try {
      if (req.method === 'GET' && url === '/api/agents') {
        return json(res, 200, {
          hasKey: Boolean(process.env.ANTHROPIC_API_KEY),
          piper: piperAvailable(),
          whisper: whisperAvailable(),
          agents: loadAgents().map(({ id, name, role, seat, voice }) => ({ id, name, role, seat, voice: voice?.model ?? null })),
        });
      }

      if (req.method === 'POST' && url === '/api/stt') {
        const wav = await readRaw(req, 25 * 1024 * 1024);
        return json(res, 200, { text: await transcribe(wav) });
      }

      if (req.method === 'POST' && url === '/api/tts') {
        const { agent: agentId, text } = await readJson(req);
        const agent = loadAgents().find((a) => a.id === agentId);
        if (!agent?.voice || !text?.trim()) return json(res, 400, { error: 'agente sem voz ou texto vazio' });
        const wav = await synthesize(text.slice(0, 2000), agent.voice);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Voice-Pitch', String(agent.voice.pitch ?? 1)); // <1 = mais grave (e um pouco mais lento)
        return res.end(wav);
      }

      if (req.method === 'POST' && url === '/api/permission') {
        const { id, allow } = await readJson(req);
        pending.get(id)?.(Boolean(allow));
        pending.delete(id);
        return json(res, 200, { ok: true });
      }

      if (req.method === 'POST' && url === '/api/ask') {
        const { agent: agentId, text } = await readJson(req);
        const agent = loadAgents().find((a) => a.id === agentId);
        if (!agent || !text?.trim()) return json(res, 400, { error: 'agente ou texto faltando' });

        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

        if (!process.env.ANTHROPIC_API_KEY) {
          send('error', { code: 'no_key', message: 'ANTHROPIC_API_KEY não configurada no .env' });
          return res.end();
        }

        let closed = false;
        res.on('close', () => { closed = true; });
        try {
          const reply = await ask(agent, text, {
            onActivity: (what) => !closed && send('activity', { text: what }),
            askPermission: (tool, input) => new Promise((resolve) => {
              const id = String(nextId++);
              pending.set(id, resolve);
              send('permission', { id, tool, detail: tool === 'Bash' ? input.command : JSON.stringify(input) });
              setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve(false); } }, 120_000);
            }),
          });
          if (!closed) send('reply', reply);
        } catch (err) {
          if (!closed) send('error', { code: 'agent_failed', message: err.message });
        }
        return res.end();
      }

      return json(res, 404, { error: 'rota desconhecida' });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  };
}
