// Bonecos provisórios do Alfred e do Nexus (Fase 1).
// Na Fase 2 eles viram modelos VRM do VRoid com animações do Mixamo; a interface (update/summon/dismiss) continua a mesma.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
const lerp = THREE.MathUtils.lerp;

function part(geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Membro com articulação no meio (braço: ombro/cotovelo, perna: quadril/joelho). Pivô no topo.
function limb(len, radius, upperMat, lowerMat = upperMat, endMat = null) {
  const root = new THREE.Group();
  const upper = part(new THREE.CapsuleGeometry(radius, len / 2 - radius, 4, 10), upperMat, 0, -len / 4, 0);
  const joint = new THREE.Group(); joint.position.y = -len / 2;
  const lower = part(new THREE.CapsuleGeometry(radius * 0.9, len / 2 - radius, 4, 10), lowerMat, 0, -len / 4, 0);
  const end = new THREE.Group(); end.position.y = -len / 2;
  if (endMat) end.add(part(new THREE.SphereGeometry(radius * 1.05, 10, 8), endMat));
  joint.add(lower, end);
  root.add(upper, joint);
  return { root, joint, end };
}

// Corpo genérico com origem no quadril, olhando para +z.
function makeFigure({ skin, top, pants, shoes }) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body); // respira
  body.add(part(new THREE.CapsuleGeometry(0.17, 0.32, 6, 12), top, 0, 0.3, 0)); // tronco
  body.add(part(new THREE.CapsuleGeometry(0.15, 0.06, 4, 10), pants, 0, 0.02, 0)); // quadril
  const neck = new THREE.Group(); neck.position.y = 0.62; body.add(neck);
  neck.add(part(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), skin, 0, 0.02, 0));
  const head = new THREE.Group(); head.position.y = 0.17; neck.add(head);
  head.add(part(new THREE.SphereGeometry(0.13, 20, 16), skin));
  // olhos
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  head.add(part(new THREE.SphereGeometry(0.015, 8, 6), eyeMat, -0.045, 0.02, 0.118), part(new THREE.SphereGeometry(0.015, 8, 6), eyeMat, 0.045, 0.02, 0.118));
  // boca: uma elipse escura que abre e fecha enquanto ele fala
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), new THREE.MeshBasicMaterial({ color: 0x3a1512 }));
  mouth.position.set(0, -0.068, 0.112);
  mouth.scale.set(1, 0.15, 0.4);
  head.add(mouth);
  const armL = limb(0.56, 0.05, top, top, skin); armL.root.position.set(-0.22, 0.52, 0);
  const armR = limb(0.56, 0.05, top, top, skin); armR.root.position.set(0.22, 0.52, 0);
  const legL = limb(0.86, 0.07, pants, pants); legL.root.position.set(-0.09, 0, 0);
  const legR = limb(0.86, 0.07, pants, pants); legR.root.position.set(0.09, 0, 0);
  legL.end.add(part(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoes, 0, -0.02, 0.05));
  legR.end.add(part(new THREE.BoxGeometry(0.1, 0.07, 0.22), shoes, 0, -0.02, 0.05));
  body.add(armL.root, armR.root);
  g.add(legL.root, legR.root);
  return {
    group: g, body, neck, head, armL, armR, legL, legR, mouth,
    setMouth(level) { mouth.scale.y = 0.15 + level * 0.9; },
  };
}

// Aplica uma pose: { armR: [ombroX, ombroZ, cotoveloX], ... , head: [x, y] }
function applyPose(f, pose) {
  const set = (l, v) => { if (!v) return; l.root.rotation.x = v[0]; l.root.rotation.z = v[1] ?? 0; l.joint.rotation.x = v[2] ?? 0; };
  set(f.armL, pose.armL); set(f.armR, pose.armR); set(f.legL, pose.legL); set(f.legR, pose.legR);
  if (pose.head) { f.head.rotation.x = pose.head[0]; f.head.rotation.y = pose.head[1]; }
}

function blendPose(a, b, k) {
  const out = {};
  for (const key of Object.keys(a)) out[key] = a[key].map((v, i) => lerp(v, b[key]?.[i] ?? v, k));
  return out;
}

// ---------------------------------------------------------------- Alfred
function makeAlfred() {
  // Visual da referência (assets/referencias/alfred-turnaround.jpg):
  // blazer de tweed cinza, camisa creme, gravata-borboleta roxa, cinto e sapatos marrons,
  // cabelo castanho ondulado, óculos redondos dourados e bigode farto.
  const skin = mat(0xf0c9a8);
  const tweed = mat(0x8c8782, { roughness: 1 });
  const f = makeFigure({ skin, top: tweed, pants: mat(0x2b2726, { roughness: 0.8 }), shoes: mat(0x7a4522, { roughness: 0.35 }) });
  const cream = mat(0xf0dcae);
  f.body.add(part(new THREE.BoxGeometry(0.13, 0.34, 0.02), cream, 0, 0.4, 0.165)); // camisa
  [-1, 1].forEach((s) => { // lapelas do blazer
    const lapel = part(new THREE.BoxGeometry(0.05, 0.26, 0.02), mat(0x7d7873, { roughness: 1 }), s * 0.085, 0.43, 0.17);
    lapel.rotation.z = s * 0.25; f.body.add(lapel);
  });
  const purple = mat(0x5e4a6a, { roughness: 0.9 });
  [-1, 1].forEach((s) => { // gravata-borboleta (duas asas + nó)
    const wing = part(new THREE.ConeGeometry(0.035, 0.07, 4), purple, s * 0.035, 0.575, 0.18);
    wing.rotation.z = s * Math.PI / 2; f.body.add(wing);
  });
  f.body.add(part(new THREE.BoxGeometry(0.025, 0.03, 0.03), purple, 0, 0.575, 0.185));
  f.body.add(part(new THREE.CylinderGeometry(0.168, 0.168, 0.035, 20), mat(0x6b3b1c, { roughness: 0.5 }), 0, 0.1, 0)); // cinto
  // cabelo castanho volumoso e ondulado
  const hairMat = mat(0x5a3a22, { roughness: 1 });
  f.head.add(part(new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.1), hairMat, 0, 0.02, -0.01));
  [[-0.1, 0.08, 0.04], [0.1, 0.08, 0.04], [-0.06, 0.13, 0.06], [0.05, 0.135, 0.07], [0, 0.1, -0.09], [-0.12, 0.02, -0.04], [0.12, 0.02, -0.04], [0.13, 0.1, 0.0], [-0.13, 0.1, 0.0]]
    .forEach(([x, y, z]) => f.head.add(part(new THREE.SphereGeometry(0.055, 10, 8), hairMat, x, y, z)));
  // bigode farto (duas pontas)
  [-1, 1].forEach((s) => {
    const m = part(new THREE.CapsuleGeometry(0.018, 0.06, 4, 8), hairMat, s * 0.035, -0.04, 0.122);
    m.rotation.z = s * 1.25; f.head.add(m);
  });
  f.mouth.position.y = -0.078; // a boca fica logo abaixo do bigode
  // óculos redondos dourados
  const gold = mat(0xc9a24a, { metalness: 0.9, roughness: 0.25 });
  [-1, 1].forEach((s) => f.head.add(part(new THREE.TorusGeometry(0.032, 0.004, 6, 20), gold, s * 0.045, 0.02, 0.13)));
  f.head.add(part(new THREE.BoxGeometry(0.03, 0.005, 0.005), gold, 0, 0.025, 0.135));
  // nariz
  f.head.add(part(new THREE.SphereGeometry(0.025, 10, 8), skin, 0, -0.005, 0.13));
  // copo de whisky na mão direita
  const glass = new THREE.Group();
  glass.add(part(new THREE.CylinderGeometry(0.035, 0.03, 0.08, 14), mat(0xdfe8ee, { transparent: true, opacity: 0.35, roughness: 0.05 })));
  glass.add(part(new THREE.CylinderGeometry(0.031, 0.028, 0.04, 14), mat(0xc77a1e, { roughness: 0.2, emissive: 0x3a1a00 }), 0, -0.018, 0));
  glass.position.set(0, -0.04, 0.03);
  f.armR.end.add(glass);

  const seated = { legL: [-1.5, 0.08, 1.45], legR: [-1.5, -0.08, 1.45], armL: [-0.35, 0.15, -0.9], armR: [-0.3, -0.1, -1.6], head: [0.05, 0.25] };
  const sip = { ...seated, armR: [-0.9, -0.25, -2.35], head: [-0.15, 0.1] };
  const attentive = { ...seated, armR: [-0.15, -0.35, -0.5], armL: [-0.4, 0.1, -0.7], head: [0, 0.55] };
  const desk = { legL: [-1.5, 0.1, 1.5], legR: [-1.5, -0.1, 1.5], armL: [-1.2, 0.12, -0.6], armR: [-1.2, -0.12, -0.6], head: [0.38, 0] };

  let nextSip = 4, sipT = -1;
  const home = { pos: new THREE.Vector3(2.55, 0.52, 0.15), rotY: -0.85, rotZ: 0 };
  const c = makeController(f, {
    id: 'alfred', name: 'Alfred',
    greeting: 'Pois não, senhor? Permita-me pousar o copo.',
    workLine: 'Deixe comigo, senhor. Vou à mesa cuidar disso.',
    doneLine: 'Senhor, terminei.',
    busyLine: 'Ainda estou cuidando daquilo, senhor. Só mais um instante.',
    home: { ...home, pose: seated },
    work: { pos: new THREE.Vector3(-2.55, 0.53, -1.55), rotY: Math.PI, rotZ: 0, pose: desk },
    // de pé na frente da poltrona -> passa na frente da mesinha -> ao lado da cadeira da mesa
    route: [new THREE.Vector3(2.14, STAND_Y, 0.51), new THREE.Vector3(0.9, STAND_Y, 0.6), new THREE.Vector3(-1.9, STAND_Y, -0.5), new THREE.Vector3(-1.95, STAND_Y, -1.55)],
    idlePose(dt, attentiveNow) {
      if (attentiveNow) { sipT = -1; return attentive; }
      nextSip -= dt;
      if (nextSip <= 0 && sipT < 0) sipT = 0;
      if (sipT < 0) return seated;
      sipT += dt;
      const k = Math.sin(Math.min(sipT / 2.6, 1) * Math.PI); // sobe, bebe, desce
      if (sipT > 2.6) { sipT = -1; nextSip = 6 + Math.random() * 6; }
      return blendPose(seated, sip, THREE.MathUtils.smoothstep(k, 0, 1));
    },
    workPose(t) {
      // digitando no notebook, com uma olhada de vez em quando
      const glance = Math.max(0, Math.sin(t * 0.4)) ** 8;
      return {
        ...desk,
        armL: [desk.armL[0] + Math.sin(t * 14) * 0.05, desk.armL[1], desk.armL[2]],
        armR: [desk.armR[0] + Math.sin(t * 14 + 1.7) * 0.05, desk.armR[1], desk.armR[2]],
        head: [desk.head[0] - glance * 0.3, glance * 0.4],
      };
    },
    onPlace(place) { glass.visible = place === 'home'; }, // pousa o copo ao sair, pega de volta ao chegar
    breathe: 1.6,
  });
  return c;
}

// ---------------------------------------------------------------- Nexus
function makeNexus() {
  const skin = mat(0x8d5a3b);
  const f = makeFigure({ skin, top: mat(0x6a3fb0, { roughness: 1 }), pants: mat(0x2b2f3a, { roughness: 1 }), shoes: mat(0xf2f2f2, { roughness: 0.5 }) });
  // boné com aba, cordão dourado, capuz
  const capMat = mat(0xc0392b, { roughness: 0.9 });
  f.head.add(part(new THREE.SphereGeometry(0.138, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), capMat, 0, 0.025, 0));
  const brim = part(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 20, 1, false, 0, Math.PI), capMat, 0, 0.06, 0.1);
  brim.rotation.y = Math.PI / 2; f.head.add(brim);
  f.body.add(part(new THREE.TorusGeometry(0.11, 0.008, 6, 24), mat(0xe6b422, { metalness: 0.9, roughness: 0.25 }), 0, 0.5, 0.12));
  f.body.add(part(new THREE.TorusGeometry(0.13, 0.04, 8, 20, Math.PI), mat(0x5a3399, { roughness: 1 }), 0, 0.6, -0.08));
  // celular nas mãos, com a tela acesa
  const phone = new THREE.Group();
  phone.add(part(new THREE.BoxGeometry(0.075, 0.15, 0.01), mat(0x111111, { roughness: 0.3 })));
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x7fd6ff });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.135), screenMat);
  screen.position.z = -0.006; screen.rotation.y = Math.PI; phone.add(screen);
  const phoneLight = new THREE.PointLight(0x7fd6ff, 0.35, 0.6, 2);
  phoneLight.position.z = -0.08; phone.add(phoneLight);
  phone.position.set(0.03, -0.05, 0.05);
  phone.rotation.set(0.2, 0, 0.3);
  f.armR.end.add(phone);

  // deitado de lado no sofá, cabeça no braço direito, um joelho dobrado
  const lying = { legL: [-0.7, 0, 1.2], legR: [-0.15, 0, 0.25], armL: [-1.15, 0.2, -1.2], armR: [-1.25, -0.15, -1.05], head: [0.15, 0.2] };
  const hype = { ...lying, armL: [-1.4, 0.4, -1.5], armR: [-1.5, -0.35, -1.4], legL: [-0.9, 0, 1.5] };
  const attentive = { ...lying, armR: [-0.4, -0.2, -0.6], armL: [-0.6, 0.3, -0.9], head: [0.1, 0.7] };
  // trabalhando: sentado no sofá, curvado no celular
  const hunched = { legL: [-1.45, 0.12, 1.5], legR: [-1.45, -0.12, 1.5], armL: [-0.95, 0.3, -1.35], armR: [-0.95, -0.3, -1.35], head: [0.5, 0] };

  let hypeT = -1, nextHype = 5;
  const tint = new THREE.Color();
  const c = makeController(f, {
    id: 'nexus', name: 'Nexus',
    greeting: 'Fala, chefe! Pera, só vou pausar aqui… pode mandar.',
    workLine: 'Suave, chefe. Deixa que eu levanto isso aqui rapidão.',
    doneLine: 'Chefe! Já era, tá pronto.',
    busyLine: 'Pera, chefe, ainda tô naquela parada. Já te falo.',
    home: { pos: new THREE.Vector3(0.3, 0.78, -1.5), rotY: 0, rotZ: -Math.PI / 2, pose: lying },
    work: { pos: new THREE.Vector3(0.05, 0.6, -1.6), rotY: 0, rotZ: 0, pose: hunched },
    route: [], // não sai do sofá: só senta
    idlePose(dt, attentiveNow, t) {
      if (attentiveNow) { hypeT = -1; return attentive; }
      f.armR.joint.rotation.z = Math.sin(t * 18) * 0.03; // polegares no celular
      nextHype -= dt;
      if (nextHype <= 0 && hypeT < 0) hypeT = 0;
      if (hypeT < 0) return lying;
      hypeT += dt;
      const k = Math.abs(Math.sin(hypeT * 6)) * (1 - Math.min(hypeT / 1.5, 1));
      if (hypeT > 1.5) { hypeT = -1; nextHype = 7 + Math.random() * 8; }
      return blendPose(lying, hype, k);
    },
    workPose(t) {
      return { ...hunched, armL: [hunched.armL[0] + Math.sin(t * 20) * 0.04, hunched.armL[1], hunched.armL[2]], armR: [hunched.armR[0] + Math.sin(t * 20 + 2) * 0.04, hunched.armR[1], hunched.armR[2]] };
    },
    onFrame(t, state) {
      // tela piscando com o jogo; trabalhando, fica fixa em azul de planilha
      if (state.place === 'work') tint.set(0x9fd8ff); else tint.setHSL((t * 0.15) % 1, 0.7, 0.65 + Math.sin(t * 13) * 0.05);
      screenMat.color.copy(tint); phoneLight.color.copy(tint);
      phoneLight.intensity = state.attentive ? 0.05 : state.place === 'work' ? 0.6 : 0.35;
    },
    breathe: 2.1,
  });
  return c;
}

// ---------------------------------------------------------------- controle de movimento (comum aos dois)
// Lugares: 'home' (sofá/poltrona), 'work' (posto de trabalho) ou 'moving'.
// A troca de lugar é uma fila de passos: ajustar pose/posição ou andar até um ponto.
const STAND_Y = 0.9; // altura do quadril em pé (a origem do boneco é o quadril)
const WALK_SPEED = 0.85;
const STAND = { legL: [0, 0.03, 0.05], legR: [0, -0.03, 0.05], armL: [0.05, 0.1, -0.15], armR: [0.05, -0.1, -0.15], head: [0, 0] };

function walkPose(p) {
  const s = Math.sin(p);
  return {
    legL: [-0.5 * s, 0.03, 0.55 * Math.max(0, s)],
    legR: [0.5 * s, -0.03, 0.55 * Math.max(0, -s)],
    armL: [0.4 * s, 0.1, -0.25],
    armR: [-0.4 * s, -0.1, -0.25],
    head: [0.05, 0],
  };
}

const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

function makeController(f, cfg) {
  const root = new THREE.Group();
  root.add(f.group);
  root.position.copy(cfg.home.pos);
  root.rotation.y = cfg.home.rotY;
  f.group.rotation.z = cfg.home.rotZ;
  const cur = JSON.parse(JSON.stringify(cfg.home.pose));
  applyPose(f, cur);

  const state = { place: 'home', attentive: false };
  const queue = [];
  let walkPhase = 0;
  let resolveMove = null;
  let destination = 'home';
  const target = { pos: cfg.home.pos.clone(), rotY: cfg.home.rotY, rotZ: cfg.home.rotZ };

  function planTo(dest) {
    const from = dest === 'work' ? cfg.home : cfg.work;
    const to = dest === 'work' ? cfg.work : cfg.home;
    const route = dest === 'work' ? cfg.route : [...cfg.route].reverse();
    const steps = [];
    if (route.length) {
      steps.push({ type: 'pose', pos: route[0], rotY: from.rotY, rotZ: 0, pose: STAND, dur: 0.9 }); // levanta
      for (const p of route.slice(1)) steps.push({ type: 'walk', to: p });
    }
    steps.push({ type: 'pose', pos: to.pos, rotY: to.rotY, rotZ: to.rotZ, pose: to.pose, dur: 1.0 }); // senta/deita
    return steps;
  }

  function go(dest) {
    if (state.place === dest && !queue.length) return Promise.resolve();
    queue.length = 0;
    queue.push(...planTo(dest));
    destination = dest;
    state.place = 'moving';
    state.attentive = false;
    cfg.onPlace?.('moving');
    return new Promise((r) => { resolveMove = r; });
  }

  return {
    id: cfg.id, name: cfg.name, greeting: cfg.greeting, workLine: cfg.workLine, doneLine: cfg.doneLine, busyLine: cfg.busyLine,
    root, head: f.head, mouth: f.mouth, setMouth: f.setMouth,
    get place() { return state.place; },
    focus() { return f.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.28, 0)); },
    summon() { if (state.place === 'home') state.attentive = true; },
    dismiss() { state.attentive = false; },
    goWork() { return go('work'); },
    goHome() { return go('home'); },
    update(dt, t) {
      f.body.scale.y = 1 + Math.sin(t * (cfg.breathe ?? 1.8)) * 0.008;
      let poseTarget;
      let k = 6;
      const step = queue[0];
      if (step?.type === 'pose') {
        step.t = (step.t ?? 0) + dt;
        target.pos.copy(step.pos); target.rotY = step.rotY; target.rotZ = step.rotZ;
        poseTarget = step.pose;
        root.position.lerp(target.pos, 1 - Math.exp(-6 * dt));
        if (step.t >= step.dur) queue.shift();
      } else if (step?.type === 'walk') {
        const d = new THREE.Vector3(step.to.x - root.position.x, 0, step.to.z - root.position.z);
        const dist = d.length();
        const move = WALK_SPEED * dt;
        target.rotY = Math.atan2(d.x, d.z);
        walkPhase += dt * 7;
        poseTarget = walkPose(walkPhase);
        k = 14;
        if (dist <= move) { root.position.set(step.to.x, STAND_Y, step.to.z); queue.shift(); }
        else root.position.addScaledVector(d.normalize(), move);
        root.position.y = STAND_Y + Math.abs(Math.sin(walkPhase)) * 0.025;
      } else {
        if (state.place === 'moving') {
          state.place = destination;
          cfg.onPlace?.(destination);
          resolveMove?.(); resolveMove = null;
        }
        const spot = state.place === 'work' ? cfg.work : cfg.home;
        root.position.lerp(spot.pos, 1 - Math.exp(-6 * dt));
        target.rotY = spot.rotY; target.rotZ = spot.rotZ;
        poseTarget = state.place === 'work' ? cfg.workPose(t) : cfg.idlePose(dt, state.attentive, t);
      }

      root.rotation.y += angleDiff(root.rotation.y, target.rotY) * (1 - Math.exp(-6 * dt));
      f.group.rotation.z += (target.rotZ - f.group.rotation.z) * (1 - Math.exp(-5 * dt));
      const a = 1 - Math.exp(-k * dt);
      for (const key of Object.keys(cur)) cur[key] = cur[key].map((v, i) => v + ((poseTarget[key]?.[i] ?? v) - v) * a);
      applyPose(f, cur);
      cfg.onFrame?.(t, state);
    },
  };
}

export function buildCharacters(scene) {
  const characters = [makeAlfred(), makeNexus()];
  characters.forEach((c) => scene.add(c.root));
  return characters;
}
