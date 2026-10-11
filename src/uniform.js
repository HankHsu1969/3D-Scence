// Japanese winter sailor uniform (セーラー服) parts: serge fabric, sailor collar with
// triple white piping, red scarf, striped cuffs, loafers.
import * as THREE from 'three';
import { std, mesh, canvasTex } from './utils.js';

const loader = new THREE.TextureLoader();
let fabricBase = null;
const fabricClones = [];
function fabricImage() {
  if (!fabricBase) {
    fabricBase = loader.load('assets/photo/fabric_navy.webp', () => fabricClones.forEach((t) => { t.needsUpdate = true; }), undefined, () => {
      // fallback: procedural twill
      const c = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = '#0f1424'; g.fillRect(0, 0, w, h);
        for (let i = -h; i < w; i += 3) { g.strokeStyle = `rgba(80,95,140,${0.12 + Math.random() * 0.08})`; g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
      }, { repeat: true });
      fabricBase.image = c.image; fabricBase.needsUpdate = true;
      fabricClones.forEach((t) => { t.needsUpdate = true; });
    });
    fabricBase.colorSpace = THREE.SRGBColorSpace;
    fabricBase.wrapS = fabricBase.wrapT = THREE.RepeatWrapping;
    fabricBase.anisotropy = 8;
  }
  return fabricBase;
}

export function fabricMaterial(rx = 4, ry = 4, extra = {}) {
  const t = fabricImage().clone(); t.repeat.set(rx, ry);
  if (t.image) t.needsUpdate = true; else fabricClones.push(t); // upload once the shared image arrives
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshPhysicalMaterial({
    map: t, color: new THREE.Color(1.55, 1.55, 1.7), roughness: 0.82, metalness: 0,
    sheen: 0.7, sheenRoughness: 0.45, sheenColor: new THREE.Color(0x6f80b8), ...extra,
  });
}

// --- torso surface parametrisation: (phi around, arc length s down from the neck ring) ---
function profilePath(profile) {
  // lathe profile is bottom->top; walk it from the neck ring downward, skipping r = 0 caps
  const pts = profile.filter(([r]) => r > 0.001).slice().reverse();
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, acc };
}
function surf(path, zs, phi, s, off, out) {
  const { pts, acc } = path;
  let i = 1;
  while (i < pts.length - 1 && acc[i] < s) i++;
  const t = THREE.MathUtils.clamp((s - acc[i - 1]) / (acc[i] - acc[i - 1]), 0, 1.5);
  const [r0, y0] = pts[i - 1], [r1, y1] = pts[i];
  const dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy) || 1;
  const nr = -dy / l, ny = dr / l; // outward normal of the profile (walking downward)
  const r = r0 + dr * t + nr * off, y = y0 + dy * t + ny * off;
  return out.set(Math.sin(phi) * r, y, -Math.cos(phi) * r * zs);
}

const S_MAX = 0.3;
// collar outline in (phi, s) for the right half (phi >= 0); mirrored for the left
const OUTER = [[0, 0.255], [0.95, 0.255], [1.06, 0.115], [1.5, 0.082], [2.1, 0.118], [Math.PI - 0.32, 0.182], [Math.PI, 0.212]];
const INNER = [[Math.PI, 0.168], [2.35, 0.1], [1.78, 0.03], [1.25, 0.014], [0, 0.014]];

function collarTexture() {
  const W = 1280, H = 512;
  const P = ([phi, s]) => [((phi / (Math.PI * 2)) + 0.5) * W, (s / S_MAX) * H];
  const half = (sign) => [...OUTER, ...INNER].map(([p, s]) => P([p * sign, s]));
  return canvasTex(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    // red scarf strip peeking along the inner V edge
    for (const sign of [1, -1]) {
      g.strokeStyle = '#b3141f'; g.lineWidth = 30; g.lineCap = 'round';
      g.beginPath(); INNER.slice(0, 3).forEach((q, i) => { const [x, y] = P([q[0] * sign, q[1] + 0.006]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    }
    const outline = new Path2D();
    for (const sign of [1, -1]) { const pts = half(sign); outline.moveTo(...pts[0]); pts.slice(1).forEach((p) => outline.lineTo(...p)); outline.closePath(); }
    g.fillStyle = '#16203c'; g.fill(outline);
    // subtle weave
    g.save(); g.clip(outline);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
    // triple white piping along the outer edge: concentric strokes clipped to the collar
    const edge = new Path2D();
    for (const sign of [1, -1]) { OUTER.forEach((q, i) => { const [x, y] = P([q[0] * sign, q[1]]); i ? edge.lineTo(x, y) : edge.moveTo(x, y); }); }
    g.lineJoin = 'round';
    [[88, '#f4f4f0'], [76, '#16203c'], [64, '#f4f4f0'], [52, '#16203c'], [40, '#f4f4f0'], [28, '#16203c']].forEach(([w, c]) => { g.strokeStyle = c; g.lineWidth = w; g.stroke(edge); });
    g.restore();
  }, { aniso: 8 });
}

export function sailorCollar(chest, profile, zs) {
  const path = profilePath(profile);
  const NU = 128, NV = 22, sMin = 0.004, sMax = 0.262;
  const pos = new Float32Array((NU + 1) * (NV + 1) * 3), uv = new Float32Array((NU + 1) * (NV + 1) * 2), idx = [];
  const v = new THREE.Vector3();
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const phi = -Math.PI + (i / NU) * Math.PI * 2, s = sMin + (j / NV) * (sMax - sMin);
    surf(path, zs, phi, s, 0.007 + 0.006 * (s / sMax), v);
    const k = j * (NU + 1) + i;
    pos.set([v.x, v.y, v.z], k * 3);
    uv.set([i / NU, 1 - s / S_MAX], k * 2);
    if (i < NU && j < NV) { const a = k, b = k + 1, c = k + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ map: collarTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color(0x7080b0), sheenRoughness: 0.5 });
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  chest.add(m);
  // scarf knot + tails at the V tip
  const tip = surf(path, zs, Math.PI, 0.19, 0.016, new THREE.Vector3());
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc0161f, roughness: 0.42, sheen: 0.8, sheenColor: new THREE.Color(0xff6060), side: THREE.DoubleSide });
  const knot = new THREE.Group(); knot.position.copy(tip); knot.rotation.x = -0.25; knot.scale.setScalar(0.82); chest.add(knot);
  mesh(new THREE.SphereGeometry(0.017, 12, 8), red, 0, 0, 0.004, knot).scale.set(1.15, 0.9, 0.6);
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.016, 0.006, 6, 12), red, s * 0.022, 0.002, 0.0, knot);
    loop.scale.set(1.2, 0.75, 0.6); loop.rotation.z = s * 0.25;
    const tailShape = new THREE.Shape(); tailShape.moveTo(-0.016, 0); tailShape.lineTo(0.016, 0); tailShape.lineTo(0.022, -0.115); tailShape.lineTo(0, -0.098); tailShape.lineTo(-0.022, -0.115); tailShape.closePath();
    const tail = mesh(new THREE.ShapeGeometry(tailShape), red, s * 0.01, -0.006, 0.006, knot);
    tail.rotation.set(-0.12, s * 0.15, s * 0.2);
  }
  return m;
}

// navy sleeve with three white stripes near the cuff
export function cuffMaterial() {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#16203c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    g.fillStyle = '#f4f4f0';
    for (const y of [0.80, 0.84, 0.88]) g.fillRect(0, y * h, w, 0.022 * h);
  });
  return new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color(0x7080b0) });
}

// Loafer / sneaker built from simple parts; origin at the ankle joint
export function shoe(kind = 'loafer', color = '#4a2c1a') {
  const g = new THREE.Group();
  const upper = kind === 'sneaker' ? std(color, 0.7) : new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 });
  const soleMat = std(kind === 'sneaker' ? 0xf2f2f2 : 0x1a1210, 0.7);
  const body = mesh(new THREE.CapsuleGeometry(0.041, 0.125, 6, 12), upper, 0, -0.038, 0.045, g);
  body.rotation.x = Math.PI / 2; body.scale.set(1, 1, 0.72);
  const sole = mesh(new THREE.BoxGeometry(0.084, 0.016, 0.22), soleMat, 0, -0.066, 0.045, g);
  if (kind === 'loafer') {
    mesh(new THREE.BoxGeometry(0.07, 0.024, 0.05), soleMat, 0, -0.06, -0.035, g); // heel
    const strap = mesh(new THREE.BoxGeometry(0.086, 0.012, 0.026), upper, 0, -0.012, 0.075, g); strap.rotation.x = 0.25;
  } else {
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.05, 0.004, 0.006), std(0xffffff, 0.6), 0, -0.005 - i * 0.002, 0.06 + i * 0.022, g).rotation.x = 0.35;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
