import * as THREE from 'three';

// ---------- deterministic random ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rng = mulberry32(20261011);
export const rand = (a = 0, b = 1) => a + (b - a) * rng();
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(rng() * arr.length)];

// ---------- math ----------
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
export const angleDamp = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));

// ---------- fonts ----------
export const FONT_JP = '"Noto Sans JP","Yu Gothic","Meiryo","Hiragino Sans",sans-serif';
export const FONT_SERIF = '"Noto Serif JP","Yu Mincho","Hiragino Mincho ProN",serif';

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, { srgb = true, repeat = false, aniso = 8, flipY = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.flipY = flipY;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// draw text that fits a max width
export function fitText(g, text, x, y, maxW, size, font, weight = 700) {
  let s = size;
  g.font = `${weight} ${s}px ${font}`;
  while (g.measureText(text).width > maxW && s > 6) { s -= 1; g.font = `${weight} ${s}px ${font}`; }
  g.fillText(text, x, y);
  return s;
}

// vertical Japanese text (one glyph per line)
export function vText(g, text, cx, top, size, gap, font, weight = 900) {
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  [...text].forEach((ch, i) => {
    if (ch === 'ー') { g.save(); g.translate(cx, top + i * (size + gap) + size / 2); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }
    else g.fillText(ch, cx, top + i * (size + gap) + size / 2);
  });
}

// ---------- layers ----------
export const LAYER_NOREFLECT = 1;
export function noReflect(obj) { obj.traverse((o) => o.layers.set(LAYER_NOREFLECT)); return obj; }

// ---------- materials ----------
export function std(color, roughness = 0.6, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}
// unlit glowing material (values > 1 feed the bloom)
export function glow(color, intensity = 2, extra = {}) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({ color: c, ...extra });
}
export function glowMap(map, intensity = 2, extra = {}) {
  return new THREE.MeshBasicMaterial({ map, color: new THREE.Color(intensity, intensity, intensity), ...extra });
}

// ---------- mesh helpers ----------
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, ry = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  if (parent) parent.add(m);
  return m;
}
// box whose bottom sits at y
export function boxAt(parent, w, h, d, mat, x, y, z, ry = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  parent.add(m);
  return m;
}
export function cylAt(parent, rt, rb, h, mat, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}

// ---------- colliders ----------
// 2D boxes for walking (xz) + 3D for camera
export const colliders = [];
export const circles = [];
export function addBox(minX, maxX, minZ, maxZ, { minY = 0, maxY = 3, cam = true, walk = true, tag = '' } = {}) {
  const b = { minX, maxX, minZ, maxZ, minY, maxY, cam, walk, tag };
  colliders.push(b);
  return b;
}
export function addBoxC(x, z, w, d, opts) { return addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, opts); }
export function addCircle(x, z, r) { circles.push({ x, z, r }); }

// rotated box collider (approximate by AABB of rotated rectangle)
export function addRotBox(x, z, w, d, ry, opts) {
  const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
  const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
  return addBox(x - hw, x + hw, z - hd, z + hd, opts);
}

// ---------- catenary wire ----------
export function wireCurve(a, b, sag = 0.6, seg = 24) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts);
}
