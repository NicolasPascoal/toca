// A sala: paredes, móveis, lareira, janela com chuva e luzes quentes.
// Tudo feito com formas simples por enquanto; na Fase 2 dá pra trocar por modelos .glb.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Assoalho de tábuas de madeira
function woodTexture() {
  const t = canvasTexture(1024, 1024, (g, w, h) => {
    const rows = 8;
    for (let r = 0; r < rows; r++) {
      const y = (r * h) / rows;
      let x = -Math.random() * 300;
      while (x < w) {
        const len = 260 + Math.random() * 260;
        const l = 26 + Math.random() * 10;
        g.fillStyle = `hsl(${24 + Math.random() * 8}, ${45 + Math.random() * 10}%, ${l}%)`;
        g.fillRect(x, y, len, h / rows);
        g.strokeStyle = 'rgba(0,0,0,0.12)';
        for (let i = 0; i < 6; i++) {
          const yy = y + Math.random() * (h / rows);
          g.beginPath(); g.moveTo(x, yy); g.lineTo(x + len, yy + (Math.random() - 0.5) * 6); g.stroke();
        }
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.fillRect(x, y, 3, h / rows);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(0, y, w, 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

// Papel de parede com listras discretas
function wallTexture() {
  const t = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#5a3f33'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(255,220,180,0.05)'; g.fillRect(x, 0, 28, h); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  return t;
}

function boardTexture() {
  return canvasTexture(1024, 640, (g, w, h) => {
    g.fillStyle = '#9b7653'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(60,35,15,${Math.random() * 0.25})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    g.fillStyle = '#f6edd9'; g.font = 'bold 64px Georgia'; g.fillText('Quadro', 60, 100);
    const notes = [['#ffe27a', 'review do PR'], ['#9fe1cb', 'gastos do mês'], ['#f5c4b3', 'ideias']];
    notes.forEach(([c, txt], i) => {
      const x = 80 + i * 300, y = 190 + (i % 2) * 60;
      g.save(); g.translate(x + 120, y + 120); g.rotate((Math.random() - 0.5) * 0.12);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-114, -114, 240, 240);
      g.fillStyle = c; g.fillRect(-120, -120, 240, 240);
      g.fillStyle = '#3a2a1a'; g.font = '34px Georgia'; g.fillText(txt, -100, -40);
      g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, -105, 10, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  });
}

export function buildRoom(scene) {
  const updaters = [];
  const W = 8, D = 6, H = 3;

  // Chão, paredes e teto
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0xffffff, { map: woodTexture(), roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'chao';
  scene.add(floor);

  const wallMat = mat(0xffffff, { map: wallTexture() });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(0, H / 2, -D / 2); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
  left.position.set(-W / 2, H / 2, 0); left.rotation.y = Math.PI / 2; left.receiveShadow = true; scene.add(left);
  const right = left.clone(); right.position.x = W / 2; right.rotation.y = -Math.PI / 2; scene.add(right);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x2a1c16));
  ceiling.position.y = H; ceiling.rotation.x = Math.PI / 2; scene.add(ceiling);

  // Rodapé
  const trim = mat(0x2b1a12);
  scene.add(box(W, 0.12, 0.03, trim, 0, 0.06, -D / 2 + 0.015));
  scene.add(box(0.03, 0.12, D, trim, -W / 2 + 0.015, 0.06, 0));
  scene.add(box(0.03, 0.12, D, trim, W / 2 - 0.015, 0.06, 0));

  // Tapete
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), mat(0x7a2e22, { roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.scale.set(1.4, 1, 1); rug.position.set(0.4, 0.005, -0.3); rug.receiveShadow = true;
  scene.add(rug);
  const rugInner = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.32, 48), mat(0xd9a441, { roughness: 1 }));
  rugInner.rotation.x = -Math.PI / 2; rugInner.scale.set(1.4, 1, 1); rugInner.position.set(0.4, 0.007, -0.3);
  scene.add(rugInner);

  // ---------- Janela com chuva (centro da parede do fundo) ----------
  const win = new THREE.Group();
  win.position.set(-0.2, 1.65, -D / 2 + 0.02);
  const nightSky = canvasTexture(256, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#0b1830'); grd.addColorStop(1, '#1d3350');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0a0f1a';
    for (let i = 0; i < 9; i++) { const bw = 20 + Math.random() * 30, bh = 40 + Math.random() * 110; g.fillRect(i * 30, h - bh, bw, bh); }
    g.fillStyle = '#f7d27a';
    for (let i = 0; i < 25; i++) g.fillRect(Math.random() * w, h - Math.random() * 90, 3, 4);
  });
  win.add(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ map: nightSky })));
  const frameMat = mat(0x3b2416);
  win.add(box(1.75, 0.08, 0.1, frameMat, 0, 0.64, 0.03), box(1.75, 0.08, 0.1, frameMat, 0, -0.64, 0.03));
  win.add(box(0.08, 1.36, 0.1, frameMat, -0.84, 0, 0.03), box(0.08, 1.36, 0.1, frameMat, 0.84, 0, 0.03));
  win.add(box(0.04, 1.2, 0.06, frameMat, 0, 0, 0.03), box(1.6, 0.04, 0.06, frameMat, 0, 0.1, 0.03));
  win.add(box(1.9, 0.06, 0.25, frameMat, 0, -0.69, 0.1)); // parapeito
  // gotas de chuva
  const DROPS = 220;
  const rainPos = new Float32Array(DROPS * 6);
  const rainSpeed = new Float32Array(DROPS);
  for (let i = 0; i < DROPS; i++) {
    const x = (Math.random() - 0.5) * 1.55, y = (Math.random() - 0.5) * 1.15;
    rainPos.set([x, y, 0.01, x - 0.01, y - 0.06, 0.01], i * 6);
    rainSpeed[i] = 0.8 + Math.random() * 0.8;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  win.add(new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0x9fb8d8, transparent: true, opacity: 0.45 })));
  updaters.push((dt) => {
    for (let i = 0; i < DROPS; i++) {
      const o = i * 6;
      rainPos[o + 1] -= rainSpeed[i] * dt; rainPos[o + 4] -= rainSpeed[i] * dt;
      if (rainPos[o + 4] < -0.58) {
        const x = (Math.random() - 0.5) * 1.55;
        rainPos[o] = x; rainPos[o + 3] = x - 0.01; rainPos[o + 1] = 0.58; rainPos[o + 4] = 0.52;
      }
    }
    rainGeo.attributes.position.needsUpdate = true;
  });
  scene.add(win);
  const moon = new THREE.DirectionalLight(0x6f8fc8, 0.35);
  moon.position.set(-0.2, 2.2, -4); moon.target.position.set(0.5, 0, 0.5);
  scene.add(moon, moon.target);

  // ---------- Lareira (direita do fundo) ----------
  const fire = new THREE.Group();
  fire.position.set(2.6, 0, -D / 2 + 0.3);
  const stone = mat(0x6b5d55, { roughness: 1 });
  // pilares, verga e fundo (a boca fica aberta para ver o fogo)
  fire.add(box(0.3, 1.15, 0.6, stone, -0.65, 0.575, 0), box(0.3, 1.15, 0.6, stone, 0.65, 0.575, 0));
  fire.add(box(1.0, 0.38, 0.6, stone, 0, 0.96, 0));
  fire.add(box(1.0, 0.77, 0.1, mat(0x120a07), 0, 0.385, -0.25)); // fundo escuro
  fire.add(box(1.7, 0.06, 0.8, stone, 0, 0.03, 0.1)); // base
  fire.add(box(1.9, 0.1, 0.75, mat(0x3b2416), 0, 1.2, 0.05)); // cornija
  fire.add(box(1.1, 1.8, 0.4, stone, 0, 2.1, -0.1)); // chaminé
  // lenha e chamas
  const log = mat(0x3a2414);
  [-0.15, 0.15].forEach((x, i) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), log);
    l.rotation.z = Math.PI / 2; l.rotation.y = i ? 0.4 : -0.4; l.position.set(x * 0.5, 0.14, 0.12); fire.add(l);
  });
  const flames = [];
  const flameColors = [0xff5a14, 0xff8a1e, 0xffc23a];
  for (let i = 0; i < 7; i++) {
    const c = flameColors[i % 3];
    const f = new THREE.Mesh(
      new THREE.ConeGeometry(0.07 + Math.random() * 0.05, 0.3 + Math.random() * 0.2, 8),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 }),
    );
    f.position.set((Math.random() - 0.5) * 0.45, 0.3, 0.12 + (Math.random() - 0.5) * 0.15);
    f.userData = { base: f.position.y, phase: Math.random() * 10, s: 0.8 + Math.random() * 0.5 };
    flames.push(f); fire.add(f);
  }
  // brasas subindo
  const EMBERS = 40;
  const emberPos = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) emberPos.set([(Math.random() - 0.5) * 0.5, 0.2 + Math.random() * 0.6, 0.15], i * 3);
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  fire.add(new THREE.Points(emberGeo, new THREE.PointsMaterial({ color: 0xffa040, size: 0.02, transparent: true, opacity: 0.9 })));
  const fireLight = new THREE.PointLight(0xff7a2a, 9, 9, 1.6);
  fireLight.position.set(0, 0.55, 0.6);
  fireLight.castShadow = true; fireLight.shadow.mapSize.set(1024, 1024); fireLight.shadow.bias = -0.002;
  fire.add(fireLight);
  // objetos na cornija
  fire.add(box(0.12, 0.35, 0.12, mat(0x2f4a2a), -0.6, 1.42, 0.05)); // garrafa
  fire.add(box(0.3, 0.25, 0.05, mat(0xc9a86a, { metalness: 0.6, roughness: 0.4 }), 0.5, 1.38, -0.1)); // porta-retrato
  updaters.push((dt, t) => {
    flames.forEach((f) => {
      const { base, phase, s } = f.userData;
      const k = 0.75 + 0.35 * Math.sin(t * 9 * s + phase) * Math.sin(t * 4.3 + phase);
      f.scale.set(1, k, 1); f.position.y = base + (k - 1) * 0.12;
    });
    fireLight.intensity = 8 + Math.sin(t * 11) * 1.2 + Math.sin(t * 23.7) * 0.8 + Math.random() * 0.6;
    for (let i = 0; i < EMBERS; i++) {
      emberPos[i * 3 + 1] += dt * (0.2 + (i % 5) * 0.06);
      emberPos[i * 3] += Math.sin(t * 2 + i) * dt * 0.05;
      if (emberPos[i * 3 + 1] > 0.85) { emberPos[i * 3 + 1] = 0.2; emberPos[i * 3] = (Math.random() - 0.5) * 0.5; }
    }
    emberGeo.attributes.position.needsUpdate = true;
  });
  scene.add(fire);

  // ---------- Quadro na parede (esquerda do fundo) ----------
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06), mat(0xffffff, { map: boardTexture(), roughness: 1 }));
  board.position.set(-2.55, 1.75, -D / 2 + 0.05);
  scene.add(board);
  scene.add(box(1.8, 1.16, 0.03, mat(0x3b2416), -2.55, 1.75, -D / 2 + 0.015));

  // ---------- Mesa de trabalho (esquerda) ----------
  const desk = new THREE.Group();
  desk.position.set(-2.55, 0, -2.2);
  const deskWood = mat(0x4a2c1a, { roughness: 0.6 });
  desk.add(box(1.6, 0.06, 0.75, deskWood, 0, 0.76, 0));
  [[-0.74, -0.32], [0.74, -0.32], [-0.74, 0.32], [0.74, 0.32]].forEach(([x, z]) => desk.add(box(0.06, 0.76, 0.06, deskWood, x, 0.38, z)));
  // notebook
  desk.add(box(0.42, 0.02, 0.3, mat(0x2a2a2e, { metalness: 0.5 }), 0.1, 0.8, 0.05));
  const screen = box(0.42, 0.28, 0.015, mat(0x2a2a2e), 0.1, 0.94, -0.1);
  screen.rotation.x = -0.25; desk.add(screen);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.24), new THREE.MeshBasicMaterial({ color: 0x5aa0ff }));
  glow.position.set(0.1, 0.94, -0.09); glow.rotation.x = -0.25; desk.add(glow);
  // luminária de mesa
  desk.add(box(0.03, 0.4, 0.03, mat(0x222222), -0.6, 0.98, -0.15));
  const deskShade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.14, 16, 1, true), mat(0x2a6b4a, { side: THREE.DoubleSide }));
  deskShade.position.set(-0.6, 1.2, -0.15); desk.add(deskShade);
  const deskLight = new THREE.PointLight(0xffc77a, 1.6, 2.5, 2);
  deskLight.position.set(-0.6, 1.12, -0.15); desk.add(deskLight);
  // cadeira
  desk.add(box(0.5, 0.06, 0.5, deskWood, 0, 0.47, 0.65), box(0.5, 0.55, 0.05, deskWood, 0, 0.75, 0.88));
  scene.add(desk);

  // ---------- Sofá (centro) — lugar do Nexus ----------
  const sofa = new THREE.Group();
  sofa.position.set(0.1, 0, -1.55);
  const fabric = mat(0x3f5a6b, { roughness: 1 });
  sofa.add(box(2.4, 0.3, 0.95, fabric, 0, 0.25, 0)); // base
  sofa.add(box(2.3, 0.14, 0.8, mat(0x4b6a7d, { roughness: 1 }), 0, 0.46, 0.05)); // assento
  sofa.add(box(2.4, 0.55, 0.22, fabric, 0, 0.67, -0.38)); // encosto
  sofa.add(box(0.22, 0.42, 0.95, fabric, -1.2, 0.5, 0), box(0.22, 0.42, 0.95, fabric, 1.2, 0.5, 0)); // braços
  const pillow = box(0.42, 0.36, 0.14, mat(0xd9a441, { roughness: 1 }), 0.9, 0.68, -0.2);
  pillow.rotation.set(-0.3, 0, 0.25); sofa.add(pillow);
  scene.add(sofa);

  // Mesinha de centro com o whisky
  const table = new THREE.Group();
  table.position.set(0.3, 0, -0.35);
  const tableWood = mat(0x5a3520, { roughness: 0.5 });
  table.add(box(1.1, 0.05, 0.6, tableWood, 0, 0.42, 0));
  [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]].forEach(([x, z]) => table.add(box(0.05, 0.42, 0.05, tableWood, x, 0.21, z)));
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.26, 12), mat(0x8a4b12, { transparent: true, opacity: 0.85, roughness: 0.2 }));
  bottle.position.set(0.32, 0.58, 0.05); bottle.castShadow = true; table.add(bottle);
  table.add(box(0.25, 0.04, 0.18, mat(0x7a2e22), -0.25, 0.47, 0.05)); // livro
  scene.add(table);

  // ---------- Poltrona de couro (direita) — lugar do Alfred ----------
  const chair = new THREE.Group();
  chair.position.set(2.55, 0, 0.15);
  chair.rotation.y = -0.85;
  const leather = mat(0x5a2614, { roughness: 0.45 });
  chair.add(box(1.0, 0.3, 0.9, leather, 0, 0.25, 0));
  chair.add(box(0.8, 0.12, 0.75, mat(0x6a2e19, { roughness: 0.45 }), 0, 0.46, 0.05));
  chair.add(box(1.0, 0.75, 0.2, leather, 0, 0.75, -0.37));
  chair.add(box(0.18, 0.45, 0.9, leather, -0.46, 0.55, 0), box(0.18, 0.45, 0.9, leather, 0.46, 0.55, 0));
  scene.add(chair);

  // Abajur de chão entre sofá e poltrona
  const lamp = new THREE.Group();
  lamp.position.set(1.55, 0, -2.25);
  lamp.add(box(0.3, 0.03, 0.3, mat(0x1c1c1c), 0, 0.015, 0), box(0.03, 1.55, 0.03, mat(0xb08a4a, { metalness: 0.7, roughness: 0.3 }), 0, 0.8, 0));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.3, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3d9a6, emissive: 0xffb45a, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  shade.position.y = 1.6; lamp.add(shade);
  const lampLight = new THREE.PointLight(0xffb866, 4, 6, 1.8);
  lampLight.position.y = 1.5; lampLight.castShadow = true; lampLight.shadow.mapSize.set(512, 512); lampLight.shadow.bias = -0.003;
  lamp.add(lampLight);
  scene.add(lamp);

  // Estante na parede esquerda
  const shelf = new THREE.Group();
  shelf.position.set(-3.8, 0, 0.2);
  shelf.rotation.y = Math.PI / 2;
  const shelfWood = mat(0x3b2416);
  shelf.add(box(1.4, 2.0, 0.05, shelfWood, 0, 1.0, -0.17));
  shelf.add(box(0.05, 2.0, 0.35, shelfWood, -0.7, 1.0, 0), box(0.05, 2.0, 0.35, shelfWood, 0.7, 1.0, 0));
  const bookColors = [0x7a2e22, 0x2f4a2a, 0x1f3550, 0xb08a4a, 0x5a3f33, 0x8a5a2a];
  [0.05, 0.55, 1.05, 1.55, 1.98].forEach((y, row) => {
    shelf.add(box(1.4, 0.04, 0.35, shelfWood, 0, y, 0));
    if (row === 4) return;
    let x = -0.65;
    while (x < 0.6) {
      const bw = 0.04 + Math.random() * 0.05, bh = 0.28 + Math.random() * 0.14;
      const b = box(bw, bh, 0.24, mat(bookColors[Math.floor(Math.random() * bookColors.length)]), x + bw / 2, y + 0.02 + bh / 2, 0.02);
      if (Math.random() < 0.08) b.rotation.z = 0.25;
      shelf.add(b);
      x += bw + 0.005;
    }
  });
  scene.add(shelf);

  // Plantas
  function plant(x, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.scale.setScalar(s);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 16), mat(0xa0522d)));
    g.children[0].position.y = 0.15;
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.06, 10, 8), mat(0x2f6b3a));
      leaf.position.set((Math.random() - 0.5) * 0.3, 0.4 + Math.random() * 0.45, (Math.random() - 0.5) * 0.3);
      leaf.castShadow = true; g.add(leaf);
    }
    scene.add(g);
  }
  plant(3.6, -2.6, 1.1);
  plant(-1.35, -2.6, 0.9);
  plant(-3.6, -2.5, 0.8);

  // Luz ambiente bem baixa e quente
  scene.add(new THREE.HemisphereLight(0xffcf9e, 0x1a0f0a, 0.35));

  return {
    update(dt, t) { updaters.forEach((u) => u(dt, t)); },
    seats: {
      sofa: { position: new THREE.Vector3(0.1, 0.55, -1.5) },
      poltrona: { position: new THREE.Vector3(2.55, 0.52, 0.15), rotationY: -0.85 },
    },
  };
}
