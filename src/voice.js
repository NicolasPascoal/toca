// Voz grátis do navegador: reconhecimento de fala (Chrome/Edge) e síntese de voz.
// Na próxima etapa dá pra trocar a síntese pela ElevenLabs sem mexer no resto.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// Dentro do app (Electron) o reconhecimento do Chrome não funciona: ele depende dos servidores do Google.
// Por isso o preferido é o Whisper local (tools/whisper): funciona nos dois e o áudio não sai do PC.
export const inApp = navigator.userAgent.includes('Electron');
const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
export const canListen = canRecord || (Boolean(Recognition) && !inApp);
let whisperReady = false;
export const sttReady = fetch('/api/agents').then((r) => r.json()).then((d) => (whisperReady = Boolean(d.whisper) && canRecord)).catch(() => false);
export const canSpeak = 'speechSynthesis' in window;

// Jeito de falar de cada um (tom e velocidade). A voz em si é a pt-BR que o sistema tiver.
// As vozes "Online (Natural)" da Microsoft (só no Edge) são as melhores de graça.
// A voz do Google fica de fora: é a mais robótica.
const STYLE = {
  alfred: { pitch: 0.9, rate: 0.93, prefer: ['Antonio Online', 'Antonio', 'Daniel'] },
  nexus: { pitch: 1.08, rate: 1.12, prefer: ['Antonio Online', 'Daniel', 'Antonio'] },
};

let voices = [];
function refreshVoices() { voices = canSpeak ? speechSynthesis.getVoices() : []; }
if (canSpeak) { refreshVoices(); speechSynthesis.onvoiceschanged = refreshVoices; }

function pickVoice(agentId) {
  const all = voices.filter((v) => v.lang?.toLowerCase().startsWith('pt'));
  const pt = all.filter((v) => !v.name.includes('Google'));
  if (!pt.length) pt.push(...all);
  const ptBR = pt.filter((v) => v.lang.toLowerCase() === 'pt-br');
  for (const name of STYLE[agentId]?.prefer ?? []) {
    const v = ptBR.find((x) => x.name.includes(name)) || pt.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return ptBR[0] || pt[0] || null;
}

// Tira markdown e [ações] do texto antes de falar
function speakable(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(?:acao|action):[^\]]+\]/gi, '')
    .replace(/[*_#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Voz do Piper (servidor local) com boca pelo volume real do áudio ----------
let audioCtx = null;
let current = null; // { source, raf, onLevel }

function stopAudio() {
  if (!current) return;
  try { current.source.stop(); } catch {}
  cancelAnimationFrame(current.raf);
  current.onLevel(0);
  current = null;
}

async function speakPiper(agentId, text, onLevel) {
  const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: agentId, text }) });
  if (!res.ok) throw new Error(`tts ${res.status}`);
  audioCtx ??= new AudioContext();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  const buffer = await audioCtx.decodeAudioData(await res.arrayBuffer());

  stopAudio();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  // Tocar um pouco mais devagar deixa a voz mais grave: é assim que o Alfred ganha voz de cavalheiro
  source.playbackRate.value = Number(res.headers.get('X-Voice-Pitch')) || 1;
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser).connect(audioCtx.destination);
  const data = new Uint8Array(analyser.fftSize);

  return new Promise((resolve) => {
    let smooth = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / data.length);
      smooth += (Math.min(1, rms * 5) - smooth) * 0.5;
      onLevel(smooth);
      current.raf = requestAnimationFrame(tick);
    };
    current = { source, raf: requestAnimationFrame(tick), onLevel };
    source.onended = () => { if (current?.source === source) { cancelAnimationFrame(current.raf); onLevel(0); current = null; } resolve(); };
    source.start();
  });
}

let piperOk = true; // se o Piper falhar uma vez, usa a voz do navegador

/**
 * Fala o texto com a voz do agente (Piper; se não der, a voz do navegador).
 * onLevel(0..1) é chamado a cada quadro com a "abertura da boca" para animar o personagem.
 */
export async function speak(agentId, text, onLevel = () => {}) {
  const clean = speakable(text);
  if (!clean) return;
  if (piperOk) {
    try { return await speakPiper(agentId, clean, onLevel); } catch (err) {
      console.warn('Piper indisponível, usando a voz do navegador:', err.message);
      piperOk = false;
    }
  }
  return speakBrowser(agentId, clean, onLevel);
}

function speakBrowser(agentId, clean, onLevel) {
  return new Promise((resolve) => {
    if (!canSpeak) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const style = STYLE[agentId] ?? {};
    u.lang = 'pt-BR';
    u.voice = pickVoice(agentId);
    u.pitch = style.pitch ?? 1;
    u.rate = style.rate ?? 1;

    // A síntese do navegador não dá o volume do áudio, então a boca segue as sílabas:
    // a cada palavra (evento boundary) ela abre e vai fechando.
    let open = 0, talking = true, raf = 0;
    const tick = () => {
      open *= 0.82;
      const wobble = talking ? 0.25 + Math.random() * 0.35 : 0;
      onLevel(Math.min(1, Math.max(open, talking ? wobble * 0.6 : 0)));
      raf = requestAnimationFrame(tick);
    };
    u.onboundary = () => { open = 0.7 + Math.random() * 0.3; };
    const done = () => { talking = false; cancelAnimationFrame(raf); onLevel(0); resolve(); };
    u.onend = done;
    u.onerror = done;
    raf = requestAnimationFrame(tick);
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() { stopAudio(); if (canSpeak) speechSynthesis.cancel(); }

/**
 * Segura para falar: start() começa a ouvir, stop() termina e devolve o texto.
 * onPartial(texto) mostra o que está sendo entendido em tempo real.
 */
export function createListener(onPartial = () => {}) {
  if (!canListen) return null;
  const web = createWebSpeechListener(onPartial);
  const local = createWhisperListener(onPartial);
  let using = null;
  return {
    start() { using = whisperReady ? local : web; using?.start(); },
    stop() { return using ? using.stop() : Promise.resolve(''); },
  };
}

// ---------- Whisper local: grava, converte para WAV 16 kHz mono e manda para /api/stt ----------
function createWhisperListener(onPartial) {
  let recorder = null, stream = null, chunks = [], starting = null;

  async function toWav16k(blob) {
    const ctx = new AudioContext();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
    str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    return { wav: new Blob([buf], { type: 'audio/wav' }), seconds: decoded.duration };
  }

  return {
    start() {
      chunks = [];
      starting = navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
        .then((s) => {
          stream = s;
          recorder = new MediaRecorder(s);
          recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
          recorder.start();
        })
        .catch((err) => { console.warn('Microfone indisponível:', err.message); recorder = null; });
    },
    async stop() {
      await starting;
      if (!recorder) return '';
      const done = new Promise((r) => { recorder.onstop = r; });
      recorder.stop();
      await done;
      stream.getTracks().forEach((t) => t.stop());
      recorder = null;
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
      if (!blob.size) return '';
      onPartial('transcrevendo…');
      try {
        const { wav, seconds } = await toWav16k(blob);
        if (seconds < 0.4) return '';
        const res = await fetch('/api/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
        return res.ok ? (await res.json()).text ?? '' : '';
      } catch (err) {
        console.warn('Falha na transcrição:', err.message);
        return '';
      }
    },
  };
}

// ---------- Reconhecimento do Chrome/Edge (reserva, quando o Whisper não está instalado) ----------
function createWebSpeechListener(onPartial) {
  if (!Recognition || inApp) return null;
  let rec = null, finalText = '', resolveStop = null;

  return {
    start() {
      finalText = '';
      rec = new Recognition();
      rec.lang = 'pt-BR';
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        let interim = '';
        finalText = '';
        for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
        onPartial((finalText + ' ' + interim).trim());
      };
      rec.onend = () => { resolveStop?.(finalText.trim()); resolveStop = null; };
      rec.onerror = () => {};
      rec.start();
    },
    stop() {
      return new Promise((resolve) => {
        if (!rec) return resolve('');
        resolveStop = resolve;
        rec.stop();
      });
    },
  };
}
