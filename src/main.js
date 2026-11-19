import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildRoom } from './room.js';
import { buildCharacters } from './characters.js';
import { speak, stopSpeaking, createListener, canListen, sttReady, inApp } from './voice.js';
import { showBoard, hideBoard, boardOpen } from './board.js';

// ---------- Renderizador ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
app.appendChild(renderer.domElement);

const labels = new CSS2DRenderer();
labels.setSize(window.innerWidth, window.innerHeight);
labels.domElement.className = 'labels';
app.appendChild(labels.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120b08);
scene.fog = new THREE.Fog(0x120b08, 7, 14);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 50);
const HOME = { pos: new THREE.Vector3(0.3, 1.8, 5.0), target: new THREE.Vector3(0.3, 0.95, -1.0) };
camera.position.copy(HOME.pos);
const camTarget = HOME.target.clone();
const desired = { pos: HOME.pos.clone(), target: HOME.target.clone() };

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.6, 0.82));
composer.addPass(new OutputPass());

// ---------- Sala e personagens ----------
const room = buildRoom(scene);
const characters = buildCharacters(scene);
const byId = Object.fromEntries(characters.map((c) => [c.id, c]));

// Falas prontas (custo zero, latência zero)
const LINES = {
  alfred: {
    noKey: 'Perdão, senhor, mas ainda não me deram a chave da casa. Configure a ANTHROPIC_API_KEY no arquivo ponto env.',
    failed: 'Minhas desculpas, senhor. Algo saiu do lugar enquanto eu trabalhava.',
    thinking: 'Um momento, senhor…',
  },
  nexus: {
    noKey: 'Ih, chefe, tô sem a chave da API. Coloca a ANTHROPIC_API_KEY no ponto env que eu resolvo.',
    failed: 'Deu ruim aqui, chefe. Tenta de novo?',
    thinking: 'Pera, tô vendo aqui…',
  },
};

// Plaquinha com o nome e balão de fala de cada um
for (const c of characters) {
  const el = document.createElement('div');
  el.className = 'tag';
  el.innerHTML = `<div class="bubble"></div><span class="name">${c.name}</span>`;
  const tag = new CSS2DObject(el);
  scene.add(tag); // acompanha a cabeça a cada quadro (ele anda, deita, senta)
  c.tagObj = tag;
  c.tag = el;
  c.busy = false;    // esperando o cérebro
  c.result = null;   // resposta pronta esperando ser entregue
  c.bubble = el.querySelector('.bubble');
  el.addEventListener('click', (e) => { e.stopPropagation(); summon(c); });
}

// ---------- Escolher um agente: clique, teclas 1/2 ou dizer o nome ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let active = null;
let hovered = null;

function isChild(root, obj) { for (let o = obj; o; o = o.parent) if (o === root) return true; return false; }
function pick(ev) {
  pointer.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObjects(characters.map((c) => c.root), true)) {
    const c = characters.find((ch) => isChild(ch.root, hit.object));
    if (c) return c;
  }
  return null;
}

renderer.domElement.addEventListener('pointermove', (ev) => {
  const c = pick(ev);
  if (c !== hovered) {
    hovered?.tag.classList.remove('hover');
    hovered = c;
    hovered?.tag.classList.add('hover');
    renderer.domElement.style.cursor = c ? 'pointer' : 'default';
  }
});
renderer.domElement.addEventListener('click', (ev) => {
  const c = pick(ev);
  if (c) summon(c); else dismiss();
});

const hud = document.getElementById('hud-sub');
const IDLE_HINT = canListen
  ? 'Segure Espaço e fale ("Alfred, …") ou clique em um agente'
  : 'Clique em um agente ou escreva abaixo ("Nexus, …")';
hud.textContent = IDLE_HINT;

function frameCamera(c) {
  const focus = c.focus();
  const toCam = new THREE.Vector3().subVectors(HOME.pos, focus).setY(0).normalize();
  desired.target.copy(focus);
  desired.pos.copy(focus).addScaledVector(toCam, 1.9).setY(focus.y + 0.45);
}

function summon(c, { greet = true } = {}) {
  if (active === c) { if (c.result) deliver(c); return; }
  if (active) dismiss(true);
  active = c;
  c.summon();
  frameCamera(c);
  c.tag.classList.add('talking');
  input.placeholder = `Fale com o ${c.name}…`;
  hud.textContent = `${c.name} está te ouvindo · Esc para dispensar`;
  if (c.result) deliver(c);                       // tinha terminado uma tarefa: entrega agora
  else if (c.busy) say(c, c.busyLine);            // ainda trabalhando
  else if (greet) say(c, c.greeting);
}

// Entrega o resultado de uma tarefa: fala + quadro
async function deliver(c) {
  const r = c.result;
  c.result = null;
  c.tag.classList.remove('done');
  if (r.error) return say(c, r.error);
  if (r.board) showBoard(c.name, r.board);
  await say(c, r.speech || 'Pronto. Deixei tudo no quadro.');
}

// Plim! quando alguém termina
let chimeCtx = null;
function chime() {
  try {
    chimeCtx ??= new AudioContext();
    const now = chimeCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const o = chimeCtx.createOscillator(), g = chimeCtx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0, now + i * 0.14);
      g.gain.linearRampToValueAtTime(0.12, now + i * 0.14 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.9);
      o.connect(g).connect(chimeCtx.destination);
      o.start(now + i * 0.14); o.stop(now + i * 0.14 + 1);
    });
  } catch {}
}

function dismiss(silent = false) {
  if (!active) return;
  stopSpeaking();
  active.setMouth(0);
  active.dismiss();
  active.tag.classList.remove('talking');
  active = null;
  input.placeholder = 'Escreva: "Alfred, revisa meu último commit"';
  if (!silent) {
    desired.pos.copy(HOME.pos); desired.target.copy(HOME.target);
    hud.textContent = IDLE_HINT;
  }
}

// Balão com digitação + voz + boca mexendo
function typeOut(el, text) {
  const id = (el._typing = (el._typing ?? 0) + 1);
  let i = 0;
  const step = () => {
    if (id !== el._typing) return;
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(step, 22);
  };
  step();
}
function say(c, text) {
  typeOut(c.bubble, text);
  return speak(c.id, text, (level) => c.setMouth(level));
}
function status(c, text) {
  c.bubble._typing = (c.bubble._typing ?? 0) + 1;
  c.bubble.innerHTML = '';
  const s = document.createElement('span');
  s.className = 'status';
  s.textContent = text;
  c.bubble.append(s);
}

// Descobre com quem é a conversa: "Alfred, ..." / "nexus: ..."
function route(text) {
  // aceita variações comuns da transcrição ("Alfredo", "Álfred", "Nexo", "Néxus"...)
  const m = text.trim().match(/^(?:ei|ô|oi|olá|fala)?[\s,]*(alfredo|álfred|alfred|alfréd|nexus|néxus|nexos|nexo)\b[\s,:.!-]*(.*)$/is);
  if (m) return { c: byId[/^[aá]/i.test(m[1]) ? 'alfred' : 'nexus'], text: m[2].trim() };
  return { c: active, text: text.trim() };
}

// ---------- Conversa com o cérebro (stream SSE de /api/ask) ----------
async function talk(rawText) {
  if (!rawText.trim()) return;
  const { c, text } = route(rawText);
  if (!c) { hud.textContent = 'Com quem? Comece com o nome: "Alfred, …" ou "Nexus, …"'; return; }
  if (active !== c) summon(c, { greet: !text && !c.busy });
  if (!text) return;
  if (c.busy) { say(c, c.busyLine); return; }

  c.busy = true;
  stopSpeaking();
  status(c, LINES[c.id].thinking);
  let thinkingTimer = setTimeout(() => speak(c.id, LINES[c.id].thinking, (l) => c.setMouth(l)), 1200);
  let working = null; // promessa da ida até o posto de trabalho

  // Primeira ferramenta usada = tarefa de verdade: ele avisa, sai e vai trabalhar.
  // Você fica livre para falar com outro agente enquanto isso.
  const startWork = () => {
    if (working) return;
    clearTimeout(thinkingTimer);
    c.tag.classList.add('working');
    c.workStartedAt = performance.now();
    say(c, c.workLine);
    working = c.goWork();
    setTimeout(() => {
      if (active === c) dismiss();
      hud.textContent = `${c.name} está trabalhando · ${IDLE_HINT}`;
    }, 2200);
  };

  // Resposta pronta: se ele estava trabalhando, volta pro lugar e avisa; senão responde na hora
  const finish = async (result) => {
    clearTimeout(thinkingTimer);
    if (!working) { c.result = result; return deliver(c); }
    await working;
    await c.goHome();
    c.tag.classList.remove('working');
    c.result = result;
    c.tag.classList.add('done');
    chime();
    if (!active && !listening) { summon(c, { greet: false }); }
    else {
      say(c, c.doneLine);
      hud.textContent = `${c.name} terminou · clique nele (ou aperte ${characters.indexOf(c) + 1}) para ver`;
    }
  };

  try {
    const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent: c.id, text }) });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, sep); buf = buf.slice(sep + 2);
        const event = chunk.match(/^event: (.+)$/m)?.[1];
        const data = JSON.parse(chunk.match(/^data: (.+)$/m)?.[1] ?? '{}');
        if (event === 'activity') {
          startWork();
          // deixa a fala "deixa comigo" aparecer antes de trocar pelo status
          const wait = Math.max(0, 2500 - (performance.now() - c.workStartedAt));
          setTimeout(() => { if (c.busy) status(c, `… ${data.text}`); }, wait);
        }
        if (event === 'permission') await askPermission(c, data);
        if (event === 'reply') await finish({ speech: data.speech, board: data.board });
        if (event === 'error') {
          if (data.code !== 'no_key') console.warn('Erro do agente:', data.message);
          await finish({ error: data.code === 'no_key' ? LINES[c.id].noKey : LINES[c.id].failed });
        }
      }
    }
  } catch (err) {
    console.warn(err);
    await finish({ error: LINES[c.id].failed });
  } finally {
    c.busy = false;
  }
}

// O agente pede permissão para usar uma ferramenta (ex.: o Alfred rodar um comando)
const permBox = document.getElementById('permission');
function askPermission(c, { id, tool, detail }) {
  return new Promise((resolve) => {
    permBox.querySelector('.perm-text').textContent = `${c.name} quer usar ${tool}:`;
    permBox.querySelector('code').textContent = detail;
    permBox.classList.add('open');
    say(c, c.id === 'alfred' ? 'Senhor, permite que eu execute um comando?' : 'Chefe, posso rodar uma parada aqui?');
    const answer = async (allow) => {
      permBox.classList.remove('open');
      await fetch('/api/permission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, allow }) });
      resolve();
    };
    permBox.querySelector('.allow').onclick = () => answer(true);
    permBox.querySelector('.deny').onclick = () => answer(false);
  });
}

// ---------- Entrada: digitar ou segurar Espaço para falar ----------
const form = document.getElementById('composer');
const input = document.getElementById('composer-input');
const micBtn = document.getElementById('mic');
form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; talk(t); });

const listener = createListener((partial) => { input.value = partial; });
let listening = false;
async function startListening() {
  if (!listener || listening) return;
  listening = true;
  stopSpeaking();
  micBtn.classList.add('on');
  input.value = '';
  input.placeholder = 'Ouvindo…';
  listener.start();
}
async function stopListening() {
  if (!listening) return;
  listening = false;
  micBtn.classList.remove('on');
  const text = await listener.stop();
  input.value = '';
  input.placeholder = active ? `Fale com o ${active.name}…` : 'Escreva: "Alfred, revisa meu último commit"';
  if (text) talk(text);
}
if (!listener) micBtn.hidden = true;
// no app, sem o Whisper instalado não há como ouvir: esconde o microfone
sttReady.then((whisper) => { if (!whisper && inApp) micBtn.hidden = true; });
micBtn.addEventListener('pointerdown', startListening);
micBtn.addEventListener('pointerup', stopListening);
micBtn.addEventListener('pointerleave', stopListening);

window.addEventListener('keydown', (e) => {
  if (e.target === input) { if (e.key === 'Escape') input.blur(); return; }
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); startListening(); }
  if (e.key === 'Escape') { if (boardOpen()) hideBoard(); else dismiss(); }
  if (e.key === '1') summon(characters[0]);
  if (e.key === '2') summon(characters[1]);
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space' && e.target !== input) stopListening(); });

// ---------- Loop ----------
const timer = new THREE.Timer();
function frame(now) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = timer.getElapsed();
  room.update(dt, t);
  characters.forEach((c) => {
    c.update(dt, t);
    c.head.getWorldPosition(c.tagObj.position).y += 0.32; // plaquinha sempre acima da cabeça
  });

  camera.position.x = THREE.MathUtils.damp(camera.position.x, desired.pos.x + Math.sin(t * 0.21) * 0.06, 2.5, dt);
  camera.position.y = THREE.MathUtils.damp(camera.position.y, desired.pos.y + Math.sin(t * 0.33) * 0.03, 2.5, dt);
  camera.position.z = THREE.MathUtils.damp(camera.position.z, desired.pos.z, 2.5, dt);
  camTarget.lerp(desired.target, 1 - Math.exp(-3 * dt));
  camera.lookAt(camTarget);

  composer.render();
  labels.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  labels.setSize(window.innerWidth, window.innerHeight);
});

window.__toca = { scene, camera, characters, summon, dismiss, talk };
