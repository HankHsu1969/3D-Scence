// Procedural stylised humanoid: joint hierarchy, outfits (incl. sailor uniform), photo faces,
// simulated long hair, pleated skirt / coat tails that react to the legs
import * as THREE from 'three';
import { std, mesh, canvasTex, mulberry32 } from './utils.js';
import { faceTex, hairTex, bangsAlphaTex, plaidTex } from './tex-misc.js';
import { fabricMaterial, sailorCollar, cuffMaterial, shoe } from './uniform.js';

function lathe(profile, mat, sz = 0.72, seg = 24) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.scale(1, 1, sz);
  return new THREE.Mesh(g, mat);
}

// ---------------------------------------------------------------------------
// Photo faces (generated on H站) projected onto the front of the head
// ---------------------------------------------------------------------------
const FACES = { girl: ['face_girl', '#fcdcca'], woman: ['face_woman', '#f7d4c0'], man: ['face_man', '#f3d2ad'], old: ['face_grandma', '#f7d2b2'] };
const faceCache = {}, faceFallbacks = {};
function photoFace(key) {
  if (!faceCache[key]) {
    faceFallbacks[key] = [];
    const t = new THREE.TextureLoader().load(`assets/photo/${key}.webp`, undefined, undefined, () => faceFallbacks[key].forEach((f) => f()));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    faceCache[key] = t;
  }
  return faceCache[key];
}

function addFace(headMesh, style, skin) {
  const [key] = FACES[style] || FACES.girl;
  const geo = new THREE.SphereGeometry(0.1058, 40, 28, Math.PI / 2 - 1.25, 2.5, Math.PI * 0.2, Math.PI * 0.64);
  const p = geo.attributes.position, uv = geo.attributes.uv;
  // planar projection: image spans ~18cm, eyes at v=0.56, mouth near v=0.29
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) * 5.37, 0.56 + (p.getY(i) + 0.0046) * 5.85);
  const mat = new THREE.MeshStandardMaterial({ map: photoFace(key), roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const face = new THREE.Mesh(geo, mat);
  headMesh.add(face);
  faceFallbacks[key].push(() => { face.visible = false; headMesh.material.map = faceTex({ skin, style: style === 'woman' ? 'girl' : style }); headMesh.material.needsUpdate = true; });
  return face;
}

function hairCapTex(color) {
  const r = mulberry32(7);
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) {
      const x = r() * w, a = r() * 0.14;
      g.fillStyle = r() < 0.5 ? `rgba(255,240,235,${a})` : `rgba(0,0,0,${a * 1.6})`;
      g.fillRect(x, 0, 1 + r() * 1.5, h);
    }
    // angel-ring highlight with a strand-broken edge
    for (let x = 0; x < w; x += 2) {
      const y0 = h * (0.36 + 0.03 * Math.sin(x * 0.09) + r() * 0.02), y1 = y0 + h * (0.05 + r() * 0.05);
      const grd = g.createLinearGradient(0, y0, 0, y1);
      grd.addColorStop(0, 'rgba(210,215,255,0)'); grd.addColorStop(0.5, 'rgba(220,225,255,.32)'); grd.addColorStop(1, 'rgba(210,215,255,0)');
      g.fillStyle = grd; g.fillRect(x, y0, 2, y1 - y0);
    }
  }, { aniso: 8 });
}

// ---------------------------------------------------------------------------
// Verlet hair curtain attached around the back/sides of the head
// ---------------------------------------------------------------------------
export class HairSim {
  constructor(head, { color, cols = 16, rows = 10, length = 0.56, frontLength = 0.42, range = 0.74 * Math.PI, rootR = 0.108 }) {
    this.head = head; this.cols = cols; this.rows = rows;
    this.colliders = [];
    this.rest = []; this.P = []; this.prev = []; this.seg = [];
    for (let c = 0; c < cols; c++) {
      const th = THREE.MathUtils.lerp(-range, range, c / (cols - 1));
      const front = Math.abs(th) / range;
      const L = THREE.MathUtils.lerp(length, frontLength, Math.pow(front, 3));
      const seg = L / (rows - 1);
      this.seg.push(seg);
      const col = [];
      for (let i = 0; i < rows; i++) {
        const s = i * seg;
        const R = rootR + 0.012 + 0.055 * THREE.MathUtils.smoothstep(s, 0.0, 0.22) + 0.012 * front;
        col.push(new THREE.Vector3(Math.sin(th) * R, 0.13 - s * 0.98, -Math.cos(th) * R));
      }
      this.rest.push(col);
      this.P.push(col.map(() => new THREE.Vector3()));
      this.prev.push(col.map(() => new THREE.Vector3()));
    }
    const n = cols * rows;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let c = 0; c < cols; c++) for (let i = 0; i < rows; i++) {
      const k = c * rows + i;
      uv[k * 2] = c / (cols - 1); uv[k * 2 + 1] = 1 - i / (rows - 1);
      if (c < cols - 1 && i < rows - 1) { const a = k, b = k + 1, d = k + rows, e = k + rows + 1; idx.push(a, b, d, b, e, d); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const { map, alphaMap } = hairTex(color);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ map, alphaMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0x9aa0c8), sheenRoughness: 0.35 }));
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.initialized = false;
    this.acc = 0;
    this.wind = new THREE.Vector3();
  }
  reset() {
    this.head.updateWorldMatrix(true, false);
    const m = this.head.matrixWorld;
    for (let c = 0; c < this.cols; c++) for (let i = 0; i < this.rows; i++) {
      this.P[c][i].copy(this.rest[c][i]).applyMatrix4(m); this.prev[c][i].copy(this.P[c][i]);
    }
    this.initialized = true;
  }
  update(dt, time) {
    if (!this.initialized) this.reset();
    this.acc = Math.min(this.acc + dt, 0.1);
    const h = 1 / 60;
    const m = this.head.matrixWorld;
    const restW = new THREE.Vector3(), d = new THREE.Vector3(), cw = new THREE.Vector3();
    const cols = this.colliders.map((c) => ({ p: c.offset.clone().applyMatrix4(c.obj.matrixWorld), r: c.r }));
    while (this.acc >= h) {
      this.acc -= h;
      for (let c = 0; c < this.cols; c++) {
        const P = this.P[c], prev = this.prev[c], rest = this.rest[c], seg = this.seg[c];
        P[0].copy(rest[0]).applyMatrix4(m); prev[0].copy(P[0]);
        for (let i = 1; i < this.rows; i++) {
          const p = P[i];
          d.subVectors(p, prev[i]).multiplyScalar(0.93);
          prev[i].copy(p);
          p.add(d);
          p.y -= 6.0 * h * h;
          p.addScaledVector(this.wind, h * (i / this.rows) * Math.sin(time * 1.7 + c * 0.6) * 0.5);
          restW.copy(rest[i]).applyMatrix4(m);
          p.lerp(restW, 0.16 * Math.pow(1 - i / this.rows, 1.6) + 0.012);
        }
        for (let i = 1; i < this.rows; i++) {
          const p = P[i];
          d.subVectors(p, P[i - 1]);
          p.copy(P[i - 1]).addScaledVector(d, seg / (d.length() || 1e-6));
          for (const col of cols) {
            cw.subVectors(p, col.p);
            const dl = cw.length();
            if (dl < col.r) p.copy(col.p).addScaledVector(cw, col.r / (dl || 1e-6));
          }
        }
      }
    }
    const pos = this.mesh.geometry.attributes.position.array;
    for (let c = 0; c < this.cols; c++) for (let i = 0; i < this.rows; i++) {
      const k = (c * this.rows + i) * 3, p = this.P[c][i];
      pos[k] = p.x; pos[k + 1] = p.y; pos[k + 2] = p.z;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }
}

// ---------------------------------------------------------------------------
// Pleated skirt / coat tails whose hem is pushed out by the thighs every frame
// ---------------------------------------------------------------------------
function buildSkirt(mat, { rTop = 0.125, rBot = 0.25, h = 0.36, pleats = 24, depth = 0.09, zs = 0.84 } = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, Math.max(48, pleats * 4), 5, true);
  geo.translate(0, -h / 2, 0);
  const pos = geo.attributes.position;
  const base = new Float32Array(pos.count * 3), col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(x, z), t = -y / h;
    const tri = pleats ? Math.abs(((a / (Math.PI * 2)) * pleats % 1 + 1) % 1 - 0.5) * 2 - 0.5 : 0;
    base[i * 3] = a; base[i * 3 + 1] = y; base[i * 3 + 2] = Math.hypot(x, z) * (1 + depth * tri * t);
    const shade = 1 - (0.5 - tri) * 0.55 * Math.min(1, t * 1.6);  // inner folds darker
    col.set([shade, shade, shade], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, mat.clone());
  m.material.vertexColors = true;
  m.userData = { base, h, zs };
  m.castShadow = true;
  return m;
}

export function deformSkirt(skirt, thighL, thighR, flare) {
  const { base, h, zs } = skirt.userData;
  const pos = skirt.geometry.attributes.position;
  const legs = [[0.085, thighL], [-0.085, thighR]];
  for (let i = 0; i < pos.count; i++) {
    const a = base[i * 3], y = base[i * 3 + 1];
    let r = base[i * 3 + 2] * (1 + flare * (-y / h));
    const sa = Math.sin(a), ca = Math.cos(a);
    const depth = Math.max(0, -y - 0.045);
    for (const [lx, th] of legs) {
      const lz = Math.tan(THREE.MathUtils.clamp(th, -1.2, 1.2)) * depth;
      const dl2 = sa * sa + ca * ca * zs * zs;
      const need = (lx * sa + lz * ca * zs) / dl2 + 0.075 / Math.sqrt(dl2);
      if (need > r - 0.04) r += Math.max(0, need - r + 0.04) * 0.9;
    }
    pos.setXYZ(i, sa * r, y, ca * r * zs);
  }
  pos.needsUpdate = true;
  skirt.geometry.computeVertexNormals();
}

// ---------------------------------------------------------------------------
// Accessories
// ---------------------------------------------------------------------------
function addBag(h, kind) {
  const leather = new THREE.MeshPhysicalMaterial({ color: kind === 'briefcase' ? 0x16120f : kind === 'shoulder' ? 0x7a4a2a : 0x2b3446, roughness: 0.45, clearcoat: 0.4 });
  const metal = std(0xc9b27a, 0.3, 0.9);
  if (kind === 'briefcase') {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.38, 0.27, 0.07), leather, 0, -0.2, 0, g);
    mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), leather, 0, -0.06, 0, g);
    mesh(new THREE.BoxGeometry(0.03, 0.02, 0.075), metal, 0.08, -0.08, 0, g); mesh(new THREE.BoxGeometry(0.03, 0.02, 0.075), metal, -0.08, -0.08, 0, g);
    g.rotation.y = Math.PI / 2;
    h.arms.L.hand.add(g); g.position.set(0, -0.04, 0);
  } else if (kind === 'shoulder') {
    const g = new THREE.Group(); g.position.set(0.19, 0.02, 0.03); h.hips.add(g);
    mesh(new THREE.BoxGeometry(0.07, 0.2, 0.26), leather, 0, 0, 0, g);
    mesh(new THREE.BoxGeometry(0.075, 0.07, 0.262), leather, 0.002, 0.07, 0, g).rotation.z = 0.04;
    const strap = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 6), leather, -0.02, 0.32, 0.03, h.chest);
    strap.rotation.z = 0.62; strap.position.set(0.0, 0.05, 0.11);
  } else if (kind === 'backpack') {
    const g = new THREE.Group(); g.position.set(0, 0.07, -0.16); h.chest.add(g);
    mesh(new THREE.BoxGeometry(0.3, 0.38, 0.13), leather, 0, 0, 0, g);
    mesh(new THREE.BoxGeometry(0.24, 0.16, 0.05), leather, 0, -0.08, -0.085, g);
    for (const s of [-1, 1]) { const st = mesh(new THREE.BoxGeometry(0.035, 0.36, 0.012), leather, s * 0.1, 0.08, 0.12, h.chest); st.rotation.x = 0.1; }
  } else if (kind === 'school') {
    // navy nylon school bag carried by its handles, with an emblem and a little charm
    const navy = new THREE.MeshPhysicalMaterial({ color: 0x1a2238, roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color(0x8090c0) });
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.36, 0.26, 0.09), navy, 0, -0.2, 0, g);
    mesh(new THREE.BoxGeometry(0.362, 0.08, 0.094), navy, 0, -0.1, 0, g);
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.045, 0.007, 6, 12, Math.PI), navy, 0, -0.07, s * 0.012, g);
    const emblem = mesh(new THREE.CircleGeometry(0.026, 20), std(0xd8b45a, 0.3, 0.8), 0.09, -0.21, 0.047, g);
    mesh(new THREE.BoxGeometry(0.36, 0.006, 0.092), std(0xf4f4f0, 0.6), 0, -0.135, 0, g);
    const charm = new THREE.Group(); charm.position.set(-0.17, -0.12, 0.05); g.add(charm);
    mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.05, 4), std(0xd8b45a, 0.3, 0.8), 0, -0.025, 0, charm);
    mesh(new THREE.SphereGeometry(0.018, 12, 10), std(0xf6b6c8, 0.5), 0, -0.06, 0, charm);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.007, 6, 6), std(0xf6b6c8, 0.5), s * 0.012, -0.045, 0, charm);
    g.rotation.y = Math.PI / 2;
    h.arms.L.hand.add(g); g.position.set(0, -0.03, 0);
    h.carry = g;
  } else if (kind === 'tote') {
    const g = new THREE.Group();
    mesh(new THREE.BoxGeometry(0.3, 0.26, 0.11), std(0xb8a68a, 0.85), 0, -0.22, 0, g);
    mesh(new THREE.TorusGeometry(0.06, 0.007, 6, 12, Math.PI), std(0x6b4a2a, 0.6), 0, -0.09, 0, g);
    g.rotation.y = Math.PI / 2; h.arms.L.hand.add(g);
  }
}

// ---------------------------------------------------------------------------
// Humanoid builder
// ---------------------------------------------------------------------------
export function createHumanoid(o = {}) {
  const opt = {
    scale: 1, face: 'girl',
    hair: { style: 'long', color: '#17121a' },
    top: { kind: 'sailor', color: '#16203c', inner: '#f4f4f2' },
    bottom: { kind: 'skirt', color: '#16203c', pleated: 'navy' },
    legs: { sock: '#141a2c' }, shoes: '#3e2416', shoeKind: 'loafer', ...o,
  };
  const kind = opt.top.kind;
  const sailor = kind === 'sailor';
  const skinHex = (FACES[opt.face] || FACES.girl)[1];
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); body.scale.setScalar(opt.scale);
  const skin = new THREE.MeshPhysicalMaterial({ color: skinHex, roughness: 0.55, sheen: 0.25, sheenColor: new THREE.Color(0xffb0a0) });
  const topMat = sailor ? fabricMaterial(5, 3) : new THREE.MeshPhysicalMaterial({ color: opt.top.color, roughness: 0.85, sheen: 0.4, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.6 });
  const innerMat = std(opt.top.inner || '#f4f4f2', 0.7);
  const isSkirt = opt.bottom.kind === 'skirt';
  let bottomMat;
  if (isSkirt) bottomMat = opt.bottom.pleated === 'navy' ? fabricMaterial(9, 2, { side: THREE.DoubleSide }) : std(0xffffff, 0.8, 0, { map: (() => { const t = plaidTex(opt.bottom.color); t.repeat.set(3, 1.2); return t; })(), side: THREE.DoubleSide });
  else bottomMat = new THREE.MeshPhysicalMaterial({ color: opt.bottom.color, roughness: 0.8, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) });
  const sockMat = isSkirt ? new THREE.MeshPhysicalMaterial({ color: opt.legs.sock, roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0x6070a0) }) : bottomMat;
  const male = opt.face === 'man' || opt.face === 'old' && opt.male;
  const W = opt.face === 'man' ? 1.1 : 1.0;

  const L = { thigh: 0.38, shin: 0.37, ankle: 0.065, upper: 0.25, fore: 0.23, hipY: 0.815 };
  const hips = new THREE.Group(); hips.position.y = L.hipY; body.add(hips);
  mesh(new THREE.SphereGeometry(0.13 * W, 18, 12), isSkirt ? innerMat : bottomMat, 0, 0.02, 0, hips).scale.set(1.05, 0.75, 0.8);

  // ---------- legs ----------
  const legs = {};
  // calf measured downward from the knee: full under the knee, slim at the ankle
  const calfProfile = (r) => [[0, 0], [r * 0.92, 0], [r, 0.08], [r * 1.02, 0.13], [r * 0.85, 0.24], [r * 0.66, 0.33], [r * 0.62, 0.37], [0, 0.37]];
  for (const side of [1, -1]) {
    const hip = new THREE.Group(); hip.position.set(side * 0.085 * W, 0, 0); hips.add(hip);
    const tr = isSkirt ? 0.062 : 0.07 * W;
    const th = new THREE.Mesh(new THREE.CylinderGeometry(tr, tr * 0.78, L.thigh, 16), isSkirt ? skin : bottomMat); th.position.y = -L.thigh / 2; hip.add(th);
    const knee = new THREE.Group(); knee.position.y = -L.thigh; hip.add(knee);
    mesh(new THREE.SphereGeometry(tr * 0.8, 14, 10), isSkirt ? skin : bottomMat, 0, 0, 0, knee);
    const calf = lathe(calfProfile(isSkirt ? 0.05 : 0.06 * W), isSkirt ? skin : bottomMat, 0.92, 16);
    calf.rotation.x = Math.PI; calf.position.y = 0; knee.add(calf);
    if (isSkirt) { // knee-high socks over the calf
      const r = 0.05;
      const sock = lathe([[0, 0.05], [r * 0.99 + 0.003, 0.05], [r * 1.02 + 0.003, 0.13], [r * 0.85 + 0.003, 0.24], [r * 0.66 + 0.003, 0.33], [r * 0.62 + 0.003, 0.37], [0, 0.37]], sockMat, 0.92, 16);
      sock.rotation.x = Math.PI; knee.add(sock);
      const band = mesh(new THREE.TorusGeometry(r + 0.003, 0.0035, 6, 18), sockMat, 0, -0.052, 0, knee); band.rotation.x = Math.PI / 2; band.scale.set(1, 0.92, 1);
    }
    const ankle = new THREE.Group(); ankle.position.y = -L.shin; knee.add(ankle);
    ankle.add(shoe(opt.shoeKind, opt.shoes));
    legs[side > 0 ? 'L' : 'R'] = { hip, knee, ankle };
  }

  let skirt = null;
  if (isSkirt) {
    skirt = buildSkirt(bottomMat, sailor ? { rTop: 0.128, rBot: 0.265, h: 0.4, pleats: 28, depth: 0.1, zs: 0.84 } : { zs: 0.86 });
    skirt.position.y = 0.075; hips.add(skirt);
  } else if (kind === 'coat') { // long coat tails
    skirt = buildSkirt(topMat, { rTop: 0.15 * W, rBot: 0.24 * W, h: 0.48, pleats: 0, depth: 0, zs: 0.82 });
    skirt.material.side = THREE.DoubleSide; skirt.position.y = 0.08; hips.add(skirt);
  } else if (kind === 'suit') { // jacket hem
    skirt = buildSkirt(topMat, { rTop: 0.14 * W, rBot: 0.16 * W, h: 0.14, pleats: 0, depth: 0, zs: 0.8 });
    skirt.material.side = THREE.DoubleSide; skirt.position.y = 0.09; hips.add(skirt);
  }

  // ---------- torso ----------
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  const abProfile = sailor
    ? [[0, -0.085], [0.188, -0.085], [0.17, -0.045], [0.135, 0.03], [0.118, 0.1], [0.122, 0.18], [0.13, 0.24], [0, 0.24]]
    : [[0.0, -0.06], [0.118 * W, -0.06], [0.108 * W, 0.06], [0.114 * W, 0.18], [0.122 * W, 0.24], [0, 0.24]];
  const abdomen = lathe(abProfile, kind === 'clerk' ? innerMat : topMat, sailor ? 0.8 : male ? 0.78 : 0.72);
  if (sailor) abdomen.material = topMat;
  spine.add(abdomen);
  const chest = new THREE.Group(); chest.position.y = 0.2; spine.add(chest);
  const female = opt.face === 'girl' || opt.face === 'woman';
  const baseProfile = opt.face === 'man'
    ? [[0, -0.04], [0.125, -0.04], [0.14, 0.06], [0.15, 0.14], [0.15, 0.19], [0.12, 0.24], [0.05, 0.26], [0, 0.26]]
    : [[0, -0.04], [0.118, -0.04], [0.132, 0.06], [0.137, 0.12], [0.13, 0.18], [0.1, 0.235], [0.045, 0.252], [0, 0.252]];
  const loose = kind === 'cardigan' || kind === 'coat' || kind === 'sailor' ? 1.06 : 1;
  const torsoProfile = baseProfile.map(([r, y]) => [r * loose * (opt.face === 'man' ? 1.05 : 1), y]);
  const zsT = opt.face === 'man' ? 0.75 : 0.72;
  const torso = lathe(torsoProfile, topMat, zsT);
  if (female) { // gentle bust shaping
    const p = torso.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), z = p.getZ(i), x = p.getX(i);
      if (z > 0) { const k = Math.exp(-Math.pow((y - 0.11) / 0.055, 2)) * Math.exp(-Math.pow((Math.abs(x) - 0.06) / 0.06, 2)); p.setZ(i, z + k * 0.022); }
    }
    torso.geometry.computeVertexNormals();
  }
  chest.add(torso);
  if (sailor) sailorCollar(chest, torsoProfile, zsT);
  if (kind === 'suit' || kind === 'coat' || kind === 'clerk' || kind === 'cardigan') {
    const tz = loose * (opt.face === 'man' ? 1.05 : 1);
    const v = new THREE.Shape(); v.moveTo(-0.048, 0); v.lineTo(0.048, 0); v.lineTo(0, -0.15); v.closePath();
    mesh(new THREE.ShapeGeometry(v), innerMat, 0, 0.25, 0.071 * tz, chest).rotation.x = -0.3;
    const lapel = std(new THREE.Color(opt.top.color).multiplyScalar(0.7), 0.8);
    for (const s of [-1, 1]) {
      const c = new THREE.Shape(); c.moveTo(0, 0); c.lineTo(s * 0.06, -0.01); c.lineTo(s * 0.012, -0.16); c.closePath();
      const lm = mesh(new THREE.ShapeGeometry(c), lapel, s * 0.042, 0.248, 0.078 * tz, chest); lm.rotation.set(-0.3, s * -0.35, 0);
      lm.material = lapel.clone(); lm.material.side = THREE.DoubleSide;
    }
  }
  if (kind === 'suit') { const tie = mesh(new THREE.BoxGeometry(0.022, 0.15, 0.006), std(opt.top.accent || '#7a1c22', 0.5), 0, 0.17, 0.106, chest); tie.rotation.x = -0.28; }
  if (kind === 'clerk') {
    const vest = lathe(torsoProfile.map(([r, y]) => [r * 1.07, y]).slice(0, 6).concat([[0, 0.2]]), std('#1b8f86', 0.75), 0.74);
    chest.add(vest);
    mesh(new THREE.BoxGeometry(0.05, 0.02, 0.005), std(0xffffff, 0.4), 0.06, 0.16, 0.106, chest);
  }
  if (kind === 'hoodie') {
    const hood = mesh(new THREE.TorusGeometry(0.09, 0.04, 8, 16), topMat, 0, 0.24, -0.03, chest); hood.rotation.x = Math.PI / 2 - 0.4;
    mesh(new THREE.BoxGeometry(0.16, 0.08, 0.02), topMat, 0, -0.02, 0.1, chest);
    for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 5), std(0xeeeeee, 0.6), s * 0.025, 0.17, 0.1, chest);
  }

  // ---------- neck & head ----------
  const neck = new THREE.Group(); neck.position.y = 0.245; chest.add(neck);
  mesh(new THREE.CylinderGeometry(0.034, 0.038, 0.09, 12), skin, 0, 0.03, 0, neck);
  const head = new THREE.Group(); head.position.y = 0.064; neck.add(head);
  const headMesh = mesh(new THREE.SphereGeometry(0.105, 40, 28), new THREE.MeshPhysicalMaterial({ color: skinHex, roughness: 0.55, sheen: 0.25, sheenColor: new THREE.Color(0xffb0a0) }), 0, 0.1, 0, head);
  headMesh.scale.set(opt.face === 'man' ? 1.0 : 0.98, 1.08, 1.02);
  addFace(headMesh, opt.face, skinHex);
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.022, 10, 8), skin, s * 0.102, 0.095, -0.005, head).scale.set(0.5, 1, 0.8);

  // ---------- hair ----------
  const hs = opt.hair.style;
  const capTex = hairCapTex(opt.hair.color);
  const hairMat = new THREE.MeshPhysicalMaterial({ map: capTex, roughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color(0x9aa0c8), sheenRoughness: 0.35 });
  let hair = null;
  if (hs !== 'none') {
    const cap = mesh(new THREE.SphereGeometry(0.114, 32, 18, 0, Math.PI * 2, 0, Math.PI * (hs === 'short' ? 0.56 : 0.6)), hairMat, 0, 0.105, -0.004, head);
    cap.rotation.x = -0.42; cap.scale.set(1.0, 1.08, 1.04);
    const bangLen = hs === 'short' ? 0.3 : hs === 'bun' ? 0.36 : 0.46;
    const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.119, 28, 12, Math.PI / 2 - 1.05, 2.1, Math.PI * 0.08, Math.PI * bangLen),
      new THREE.MeshPhysicalMaterial({ map: capTex, roughness: 0.4, alphaMap: bangsAlphaTex(), alphaTest: 0.5, side: THREE.DoubleSide, sheen: 0.5, sheenColor: new THREE.Color(0x9aa0c8) }));
    bangs.position.set(0, 0.1, 0.0); bangs.scale.set(1.0, 1.08, 1.05); head.add(bangs);
    if (hs === 'short') { const back = mesh(new THREE.SphereGeometry(0.113, 24, 14), hairMat, 0, 0.088, -0.02, head); back.scale.set(1.03, 0.95, 1.0); }
    if (hs === 'bun') { mesh(new THREE.SphereGeometry(0.05, 14, 10), hairMat, 0, 0.19, -0.08, head); const back = mesh(new THREE.SphereGeometry(0.112, 24, 14), hairMat, 0, 0.09, -0.02, head); back.scale.set(1.02, 0.92, 1.0); }
    if (hs === 'long' || hs === 'bob') {
      hair = new HairSim(head, { color: opt.hair.color, length: hs === 'long' ? 0.56 : 0.2, frontLength: hs === 'long' ? 0.42 : 0.17, rows: hs === 'long' ? 10 : 5 });
      hair.colliders.push({ obj: head, offset: new THREE.Vector3(0, 0.1, 0), r: 0.118 });
      hair.colliders.push({ obj: neck, offset: new THREE.Vector3(0, 0.0, -0.01), r: 0.07 });
      hair.colliders.push({ obj: chest, offset: new THREE.Vector3(0, 0.12, -0.01), r: 0.145 });
      hair.colliders.push({ obj: chest, offset: new THREE.Vector3(0.12, 0.2, 0), r: 0.08 });
      hair.colliders.push({ obj: chest, offset: new THREE.Vector3(-0.12, 0.2, 0), r: 0.08 });
      hair.colliders.push({ obj: spine, offset: new THREE.Vector3(0, 0.05, -0.02), r: 0.13 });
    }
  }
  if (opt.hairpin) { // crossed pins on the left side of the bangs
    for (const [c, a] of [[0xd8303a, 0.6], [0xf4f4f0, -0.6]]) {
      const pin = mesh(new THREE.BoxGeometry(0.036, 0.0055, 0.004), std(c, 0.35, 0.2), 0.057, 0.168, 0.088, head);
      pin.rotation.set(-0.5, 0.55, a);
    }
  }
  if (opt.glasses) {
    const gm = std(0x111111, 0.3, 0.6);
    for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.022, 0.004, 6, 16), gm, s * 0.035, 0.1, 0.103, head);
  }

  // ---------- arms ----------
  const arms = {};
  const cuff = sailor ? cuffMaterial() : null;
  for (const side of [1, -1]) {
    const lo = kind === 'cardigan' || kind === 'coat' || kind === 'hoodie' || sailor ? 1.12 : 1;
    const sleeveMat = kind === 'clerk' ? innerMat : topMat;
    const shoulder = new THREE.Group(); shoulder.position.set(side * (opt.face === 'man' ? 0.175 : 0.155), 0.2, 0); chest.add(shoulder);
    mesh(new THREE.SphereGeometry(0.054 * W * lo, 16, 12), topMat, 0, -0.005, 0, shoulder);
    const ua = new THREE.Mesh(new THREE.CylinderGeometry(0.047 * W * lo, 0.042 * W * lo, L.upper, 16), sleeveMat); ua.position.y = -L.upper / 2; shoulder.add(ua);
    const elbow = new THREE.Group(); elbow.position.y = -L.upper; shoulder.add(elbow);
    mesh(new THREE.SphereGeometry(0.042 * W * lo, 14, 10), sleeveMat, 0, 0, 0, elbow);
    const fa = new THREE.Mesh(new THREE.CylinderGeometry(0.041 * W * lo, 0.045 * W * lo, L.fore - 0.02, 16), cuff || sleeveMat); fa.position.y = -(L.fore - 0.02) / 2; elbow.add(fa);
    if (kind === 'cardigan') mesh(new THREE.TorusGeometry(0.043 * lo, 0.008, 6, 14), topMat, 0, -L.fore + 0.03, 0, elbow).rotation.x = Math.PI / 2;
    const hand = new THREE.Group(); hand.position.y = -L.fore; elbow.add(hand);
    mesh(new THREE.SphereGeometry(0.034 * W, 12, 10), skin, 0, -0.035, 0.005, hand).scale.set(0.72, 1.2, 0.5);
    const thumb = mesh(new THREE.CapsuleGeometry(0.009, 0.025, 3, 6), skin, -side * 0.018, -0.03, 0.016, hand); thumb.rotation.set(0.4, 0, -side * 0.5);
    arms[side > 0 ? 'L' : 'R'] = { shoulder, elbow, hand, len1: L.upper, len2: L.fore + 0.035 };
  }

  const h = { root, body, hips, spine, chest, neck, head, legs, arms, skirt, hair, L, opt, scale: opt.scale };
  if (opt.bag) addBag(h, opt.bag);
  root.traverse((ob) => { if (ob.isMesh) ob.castShadow = true; });
  return h;
}
