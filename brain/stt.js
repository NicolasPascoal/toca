// Transcrição local e grátis com o whisper.cpp (tools/whisper). Recebe WAV 16 kHz mono.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir, cpus } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WHISPER_EXE = resolve(ROOT, 'tools', 'whisper', 'bin', 'Release', 'whisper-cli.exe');
const MODEL = resolve(ROOT, 'tools', 'whisper', 'models', 'ggml-small-q5_1.bin');

export const whisperAvailable = () => existsSync(WHISPER_EXE) && existsSync(MODEL);

export async function transcribe(wav) {
  if (!whisperAvailable()) throw new Error('whisper não instalado');
  const file = resolve(tmpdir(), `toca-${randomUUID()}.wav`);
  await writeFile(file, wav);
  try {
    const text = await new Promise((ok, fail) => {
      const threads = String(Math.min(8, cpus().length || 4)); // 8 núcleos: ~25% mais rápido que o padrão (4)
      const args = ['-m', MODEL, '-l', 'pt', '-nt', '-np', '-t', threads, '--prompt', 'Conversa com Alfred e Nexus.', '-f', file];
      const p = spawn(WHISPER_EXE, args, { cwd: dirname(WHISPER_EXE), windowsHide: true });
      let out = '', err = '';
      p.stdout.on('data', (d) => { out += d; });
      p.stderr.on('data', (d) => { err += d; });
      p.on('error', fail);
      p.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`whisper saiu com ${code}: ${err.slice(-300)}`))));
    });
    return text
      .split('\n')
      .map((l) => l.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim()) // tira [BLANK_AUDIO], (música) etc.
      .filter(Boolean)
      .join(' ')
      .trim();
  } finally {
    rm(file, { force: true });
  }
}
