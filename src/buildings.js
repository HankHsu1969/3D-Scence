// Neighbourhood buildings: facades, izakaya, coin laundry, ramen shop, house, skyline
import * as THREE from 'three';
import { std, glow, glowMap, boxAt, mesh, addBox, canvasTex, rand, randInt, pick, noReflect, FONT_JP } from './utils.js';
import { facadeTex, shutterTex, laundryInteriorTex, shojiTex } from './tex-misc.js';
import { verticalSignTex, lanternTex, norenTex, laundrySignTex, ramenSignTex, shopSignTex } from './tex-signs.js';
import { createACUnit } from './props2.js';

let seed = 100;

// Generic block. side: +1 = front faces +z (north row), -1 = front faces -z (south row)
export function building(parent, { x0, x1, z0, z1, h, side, color = '#62656d', floors, cols, lit = 0.45, groundH = 3.3, balcony = false }) {
  const g = new THREE.Group(); parent.add(g);
  const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const wall = std(new THREE.Color(color), 0.85);
  boxAt(g, w, h, d, wall, cx, 0, cz);
  const frontZ = side > 0 ? z1 : z0;
  const upperH = h - groundH;
  const f = facadeTex({ w, h: upperH, floors: floors || Math.max(1, Math.round(upperH / 3)), cols: cols || Math.max(2, Math.round(w / 3.2)), base: color, lit, seed: seed++, balcony });
  const fm = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.8 });
  const fp = mesh(new THREE.PlaneGeometry(w, upperH), fm, cx, groundH + upperH / 2, frontZ + side * 0.01, g, side > 0 ? 0 : Math.PI);
  fp.userData.photo = { key: balcony ? 'facade_apartment' : 'facade_mixed', w, h: upperH };
  // parapet + rooftop clutter
  boxAt(g, w + 0.2, 0.4, d + 0.2, std(0x4a4c52, 0.9), cx, h, cz);
  if (w > 6) {
    boxAt(g, 1.6, 1.2, 1.6, std(0x8a8d92, 0.6, 0.4), cx + rand(-w / 4, w / 4), h + 0.4, cz);
    mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), std(0x9aa0a6, 0.5, 0.5), cx - w / 3, h + 1.1, cz, g);
  }
  // ground floor slab band
  boxAt(g, w + 0.06, 0.25, 0.3, std(0x3a3c42, 0.7), cx, groundH - 0.1, frontZ + side * 0.15);
  addBox(x0, x1, z0, z1, { maxY: h + 1 });
  return { g, frontZ, cx, w, groundH };
}

export function shutterFront(parent, cx, w, frontZ, side, h = 2.8) {
  const t = shutterTex(); t.repeat.set(w / 1.0, h / 1.4);
  const m = mesh(new THREE.PlaneGeometry(w - 0.3, h), std(0xffffff, 0.45, 0.6, { map: t }), cx, h / 2, frontZ + side * 0.02, parent, side > 0 ? 0 : Math.PI);
  boxAt(parent, w - 0.2, 0.35, 0.35, std(0x7a7f86, 0.5, 0.6), cx, h, frontZ + side * 0.17);
  m.userData.photo = { key: 'shutters', w: w - 0.3, h };
  return m;
}

export function verticalSign(parent, x, y, z, text, opts, ry = 0) {
  const tex = verticalSignTex(text, opts);
  const hgt = (tex.image.height / tex.image.width) * 0.55;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  boxAt(g, 0.12, hgt + 0.08, 0.6, std(0x222222, 0.6), 0, -0.04, 0);
  for (const s of [-1, 1]) mesh(new THREE.PlaneGeometry(0.55, hgt), glowMap(tex, opts.glow || 2.0), s * 0.065, hgt / 2, 0, g, s * Math.PI / 2);
  for (const yy of [0.1, hgt - 0.1]) boxAt(g, 0.04, 0.04, 0.5, std(0x444444, 0.5, 0.6), 0, yy, -0.5);
  return g;
}

function lantern(parent, x, y, z, text) {
  const pts = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(0.03 + Math.sin(t * Math.PI) * 0.2, t * 0.62)); }
  const lg = new THREE.LatheGeometry(pts, 20);
  const l = mesh(lg, glowMap(lanternTex(text), 1.7), x, y, z, parent);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), std(0x111111, 0.6), x, y, z, parent);
  mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), std(0x111111, 0.6), x, y + 0.62, z, parent);
  return l;
}

export function izakaya(parent, b) {
  const { cx, w, frontZ } = b; const s = 1; // north row, faces +z
  const g = new THREE.Group(); parent.add(g);
  const wood = std(0x3b2516, 0.8);
  mesh(new THREE.PlaneGeometry(w - 0.2, 3.1), wood, cx, 1.55, frontZ + 0.02, g);
  for (let x = cx - w / 2 + 0.3; x < cx + w / 2; x += 0.18) boxAt(g, 0.04, 3.0, 0.04, std(0x2a180c, 0.8), x, 0, frontZ + 0.05);
  // shoji doors glowing
  const sj = shojiTex(); sj.wrapS = THREE.RepeatWrapping; sj.repeat.set(3, 1);
  mesh(new THREE.PlaneGeometry(3.0, 2.1), glowMap(sj, 1.25), cx - 1.0, 1.05, frontZ + 0.08, g);
  boxAt(g, 3.2, 0.12, 0.12, wood, cx - 1.0, 2.1, frontZ + 0.1);
  // shop sign above door
  const sign = shopSignTex('炭火焼鳥 とり吉', '#1a120c', '#f1e3c4', 1024, 160, '"Noto Serif JP", serif');
  mesh(new THREE.PlaneGeometry(4.2, 0.65), glowMap(sign, 1.3), cx - 1.0, 2.75, frontZ + 0.12, g);
  // noren strips
  const nt = norenTex('とり吉');
  const noren = [];
  for (let i = 0; i < 3; i++) {
    const t = nt.clone(); t.needsUpdate = true; t.repeat.set(1 / 3, 1); t.offset.set(i / 3, 0);
    const p = new THREE.Group(); p.position.set(cx - 2.0 + i * 1.0, 2.05, frontZ + 0.22); g.add(p);
    mesh(new THREE.PlaneGeometry(0.97, 0.75), std(0xffffff, 0.9, 0, { map: t, side: THREE.DoubleSide }), 0, -0.375, 0, p);
    noren.push(p);
  }
  boxAt(g, 3.2, 0.04, 0.04, std(0x222222, 0.5, 0.5), cx - 1.0, 2.04, frontZ + 0.22);
  // lanterns
  const lanterns = [lantern(g, cx - 2.9, 1.55, frontZ + 0.4, '焼鳥'), lantern(g, cx + 0.9, 1.55, frontZ + 0.4, '酒')];
  const light = new THREE.PointLight(0xff5a2a, 9, 8, 1.8); light.position.set(cx - 1, 1.9, frontZ + 1.0); g.add(light);
  // menu board + crates
  boxAt(g, 0.6, 0.9, 0.06, std(0x111111, 0.7), cx + 2.0, 0.15, frontZ + 0.5).rotation.x = -0.12;
  const menu = canvasTex(128, 192, (c, ww, hh) => { c.fillStyle = '#111'; c.fillRect(0, 0, ww, hh); c.fillStyle = '#fff'; c.font = `700 18px ${FONT_JP}`; ['本日のおすすめ', 'ねぎま 180', 'つくね 200', '皮 160', '生ビール 480', 'ハイボール 390'].forEach((t, i) => c.fillText(t, 10, 26 + i * 28)); });
  mesh(new THREE.PlaneGeometry(0.5, 0.75), glowMap(menu, 0.9), cx + 2.0, 0.62, frontZ + 0.54, g).rotation.x = -0.12;
  for (let i = 0; i < 3; i++) boxAt(g, 0.45, 0.3, 0.35, std([0xc0281e, 0x2471a3, 0xf2c230][i], 0.6), cx + 3.2, i * 0.3, frontZ + 0.3);
  addBox(cx + 1.6, cx + 3.5, frontZ, frontZ + 0.65, { maxY: 1.2 });
  return { noren, lanterns, light };
}

export function coinLaundry(parent, b) {
  const { cx, w, frontZ } = b; const s = -1; // south row, faces -z
  const g = new THREE.Group(); parent.add(g);
  mesh(new THREE.PlaneGeometry(w - 0.6, 2.6), glowMap(laundryInteriorTex(), 1.6), cx, 1.35, frontZ - 0.03, g, Math.PI).userData.photo = { key: 'laundry' };
  mesh(new THREE.PlaneGeometry(w - 0.6, 2.6), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.03, depthWrite: false }), cx, 1.35, frontZ - 0.08, g, Math.PI);
  for (let x = cx - w / 2 + 0.3; x <= cx + w / 2 - 0.2; x += (w - 0.6) / 3) boxAt(g, 0.08, 2.7, 0.1, std(0xb9bec6, 0.35, 0.8), x, 0, frontZ - 0.08);
  mesh(new THREE.PlaneGeometry(w - 0.4, 0.62), glowMap(laundrySignTex(), 1.8), cx, 2.95, frontZ - 0.12, g, Math.PI);
  const light = new THREE.RectAreaLight(0xdfeeff, 1.2, w - 1, 2.4);
  light.position.set(cx, 1.4, frontZ - 0.1); g.add(light); // faces -z by default
  return { light };
}

export function ramenShop(parent, b) {
  const { cx, w, frontZ } = b;
  const g = new THREE.Group(); parent.add(g);
  mesh(new THREE.PlaneGeometry(w - 0.4, 3.0), std(0x2a1a12, 0.8), cx, 1.5, frontZ - 0.02, g, Math.PI);
  const rw = mesh(new THREE.PlaneGeometry(3.2, 2.0), glow(0xffffff, 1.3), cx + 1.2, 1.15, frontZ - 0.05, g, Math.PI);
  rw.userData.photo = { key: 'ramen' };
  for (let x = cx - 0.4; x <= cx + 2.8; x += 0.8) boxAt(g, 0.05, 2.1, 0.06, std(0x1a100a, 0.7), x, 0.1, frontZ - 0.07);
  mesh(new THREE.PlaneGeometry(w - 0.8, 0.8), glowMap(ramenSignTex(), 1.4), cx, 2.75, frontZ - 0.1, g, Math.PI);
  const nt = norenTex('らーめん');
  const noren = [];
  for (let i = 0; i < 4; i++) {
    const t = nt.clone(); t.needsUpdate = true; t.repeat.set(1 / 4, 1); t.offset.set(i / 4, 0);
    const p = new THREE.Group(); p.position.set(cx + 2.4 - i * 0.8, 2.15, frontZ - 0.2); p.rotation.y = Math.PI; g.add(p);
    mesh(new THREE.PlaneGeometry(0.78, 0.7), std(0xb02418, 0.9, 0, { map: t, side: THREE.DoubleSide }), 0, -0.35, 0, p);
    noren.push(p);
  }
  lantern(g, cx - 1.6, 1.6, frontZ - 0.35, 'ら');
  const light = new THREE.PointLight(0xffb070, 7, 7, 1.8); light.position.set(cx + 1, 1.8, frontZ - 1.0); g.add(light);
  return { noren, light };
}

export function house(parent, { x0, x1, zFront, depth = 7 }) {
  const g = new THREE.Group(); parent.add(g);
  const w = x1 - x0, cx = (x0 + x1) / 2, z0 = zFront + 1.6, z1 = z0 + depth;
  boxAt(g, w - 1, 5.6, depth, std(0xd8cdb8, 0.9), cx, 0, (z0 + z1) / 2);
  const f = facadeTex({ w: w - 1, h: 5.6, floors: 2, cols: 3, base: '#d8cdb8', lit: 0.5, seed: 77 });
  mesh(new THREE.PlaneGeometry(w - 1, 5.6), new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.9 }), cx, 2.8, z0 - 0.01, g, Math.PI);
  // gable roof
  const shape = new THREE.Shape(); shape.moveTo(-depth / 2 - 0.5, 0); shape.lineTo(depth / 2 + 0.5, 0); shape.lineTo(0, 2.2); shape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: w - 0.4, bevelEnabled: false });
  const roof = new THREE.Mesh(roofGeo, std(0x3a3f4a, 0.55, 0.3)); roof.rotation.y = Math.PI / 2; roof.position.set(x0 + 0.2, 5.6, (z0 + z1) / 2); g.add(roof);
  // block wall + gate light
  const block = std(0x9b9a94, 0.95);
  boxAt(g, (w - 2) / 2, 1.3, 0.15, block, x0 + (w - 2) / 4, 0, zFront + 0.1);
  boxAt(g, (w - 2) / 2, 1.3, 0.15, block, x1 - (w - 2) / 4, 0, zFront + 0.1);
  mesh(new THREE.SphereGeometry(0.1, 12, 8), glow(0xffe1a8, 4), cx - 1.1, 1.45, zFront + 0.1, g);
  mesh(new THREE.SphereGeometry(0.1, 12, 8), glow(0xffe1a8, 4), cx + 1.1, 1.45, zFront + 0.1, g);
  const plate = canvasTex(128, 64, (c, ww, hh) => { c.fillStyle = '#e8e2d2'; c.fillRect(0, 0, ww, hh); c.fillStyle = '#222'; c.font = `900 34px "Noto Serif JP", serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('佐藤', ww / 2, hh / 2 + 2); });
  mesh(new THREE.PlaneGeometry(0.3, 0.15), std(0xffffff, 0.6, 0, { map: plate }), cx - 1.4, 1.0, zFront + 0.0, g, Math.PI);
  addBox(x0, x1, zFront, z1, { maxY: 8 });
  const ac = createACUnit(); ac.position.set(x1 - 1.2, 0, zFront + 0.6); ac.rotation.y = Math.PI; g.add(ac);
  return g;
}

// distant skyline (instanced boxes with lit windows)
export function skyline(parent) {
  const f = facadeTex({ w: 12, h: 24, floors: 8, cols: 4, base: '#2b2e36', lit: 0.35, seed: 999, ppm: 16 });
  f.map.wrapS = f.map.wrapT = f.emissiveMap.wrapS = f.emissiveMap.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.9 });
  const spots = [];
  for (let x = -90; x <= 90; x += rand(9, 14)) spots.push([x, -42 - rand(0, 20)]);
  for (let x = -90; x <= 90; x += rand(9, 14)) spots.push([x, 36 + rand(0, 20)]);
  for (let z = -30; z <= 30; z += 12) { spots.push([-70 - rand(0, 10), z]); spots.push([70 + rand(0, 10), z]); }
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach(([x, z], i) => { m.makeScale(rand(8, 13), rand(12, 38), rand(8, 13)).setPosition(x, 0, z); im.setMatrixAt(i, m); });
  parent.add(im);
  // a few blinking aviation lights on tall roofs
  const red = [];
  for (let i = 0; i < 6; i++) { const r = mesh(new THREE.SphereGeometry(0.25, 8, 6), glow(0xff2a1a, 6), rand(-80, 80), rand(30, 40), i % 2 ? -55 : 48, parent); red.push(r); }
  return { red };
}
