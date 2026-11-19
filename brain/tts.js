// Voz local e grátis com o Piper (tools/piper). Gera um WAV por fala.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PIPER_DIR = resolve(ROOT, 'tools', 'piper');
const PIPER_EXE = resolve(PIPER_DIR, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
const VOICES_DIR = resolve(PIPER_DIR, 'voices');

export const piperAvailable = () => existsSync(PIPER_EXE);

/** Gera a fala e devolve um Buffer WAV. voice = { model, lengthScale? } */
export async function synthesize(text, voice) {
  const model = resolve(VOICES_DIR, `${voice.model}.onnx`);
  if (!piperAvailable() || !existsSync(model)) throw new Error(`voz ${voice.model} não encontrada`);
  const out = resolve(tmpdir(), `toca-${randomUUID()}.wav`);
  const args = ['--model', model, '--output_file', out, '--sentence_silence', String(voice.sentenceSilence ?? 0.15)];
  if (voice.lengthScale) args.push('--length_scale', String(voice.lengthScale));

  await new Promise((ok, fail) => {
    const p = spawn(PIPER_EXE, args, { cwd: dirname(PIPER_EXE), windowsHide: true });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 && existsSync(out) ? ok() : fail(new Error(`piper saiu com ${code}: ${err.slice(-300)}`))));
    p.stdin.end(text.replace(/\s+/g, ' ').trim() + '\n', 'utf8');
  });

  try { return await readFile(out); } finally { rm(out, { force: true }); }
}

export function voiceInfo(voice) {
  try { return JSON.parse(readFileSync(resolve(VOICES_DIR, `${voice.model}.onnx.json`), 'utf8')).audio; } catch { return null; }
}
