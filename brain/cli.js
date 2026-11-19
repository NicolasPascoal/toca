// Conversa com os agentes da Toca pelo terminal (Fase 0, antes da sala 3D).
// Uso:  npm run agente            -> escolhe com "alfred: ..." ou "nexus: ..."
//       /trocar nexus  /esquecer  /sair
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { loadAgents, ask, forgetSession } from './brain.js';

const agents = loadAgents();
const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
let current = agents[0];

const rl = readline.createInterface({ input: stdin, output: stdout });

if (!process.env.ANTHROPIC_API_KEY) {
  console.log('\n⚠  ANTHROPIC_API_KEY não está definida. Crie uma chave em https://platform.claude.com e coloque no arquivo .env.\n');
}

console.log(`\n🛋  Toca — agentes: ${agents.map((a) => `${a.name} (${a.role})`).join(', ')}`);
console.log('Escreva "nexus: sua mensagem" para falar com alguém, /trocar <nome>, /esquecer (zera a memória), /sair.\n');

while (true) {
  const line = (await rl.question(`você → ${current.name}: `)).trim();
  if (!line) continue;
  if (line === '/sair') break;
  if (line.startsWith('/trocar')) {
    const id = line.split(/\s+/)[1]?.toLowerCase();
    if (byId[id]) current = byId[id];
    else console.log(`Não conheço "${id}". Opções: ${Object.keys(byId).join(', ')}`);
    continue;
  }
  if (line === '/esquecer') { forgetSession(current.id); console.log(`${current.name} esqueceu a conversa.\n`); continue; }

  let text = line;
  const m = line.match(/^(\w+)\s*[:,]\s*(.+)$/s);
  if (m && byId[m[1].toLowerCase()]) { current = byId[m[1].toLowerCase()]; text = m[2]; }

  try {
    const reply = await ask(current, text, {
      onActivity: (what) => console.log(`   … ${current.name} está ${what}`),
      askPermission: async (tool, input) => {
        const detail = tool === 'Bash' ? input.command : JSON.stringify(input);
        const ans = await rl.question(`   ${current.name} pede permissão para ${tool}: ${detail}\n   Autoriza? (s/n) `);
        return ans.trim().toLowerCase().startsWith('s');
      },
    });
    console.log(`\n${current.name}: ${reply.speech}\n`);
    if (reply.board) console.log(`┌─ quadro ─────────────────\n${reply.board}\n└──────────────────────────\n`);
    console.log(`   (custo: US$ ${reply.costUsd?.toFixed(4) ?? '?'})\n`);
  } catch (err) {
    console.log(`\n✖ ${current.name} tropeçou: ${err.message}\n`);
  }
}
rl.close();
