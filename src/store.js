// Convenience store shell: walls, glass front, auto door, fascia sign, eave, ceiling lights
import * as THREE from 'three';
import { std, glow, glowMap, boxAt, mesh, addBox, noReflect, LAYER_NOREFLECT } from './utils.js';
import { signboardTex, pylonTex, posterTex, matTex } from './tex-signs.js';
import { glassStreakTex } from './tex-misc.js';

export const STORE = { minX: -7, maxX: 7, minZ: -16, maxZ: -6.5, ceil: 3.0, doorX0: 3.2, doorX1: 5.2 };

export function buildStore(scene) {
  const g = new THREE.Group(); g.name = 'store';
  scene.add(g);
  const S = STORE;
  const wallOut = std(0xdedcd6, 0.8);
  const wallIn = std(0xf2f1ec, 0.9);
  const alu = std(0xb9bec6, 0.35, 0.8);
  const darkAlu = std(0x3a3f47, 0.4, 0.7);

  // --- exterior shell ---
  boxAt(g, 0.2, 4.3, S.maxZ - S.minZ + 0.2, wallOut, S.minX - 0.1, 0, (S.minZ + S.maxZ) / 2 - 0.1);
  boxAt(g, 0.2, 4.3, S.maxZ - S.minZ + 0.2, wallOut, S.maxX + 0.1, 0, (S.minZ + S.maxZ) / 2 - 0.1);
  boxAt(g, S.maxX - S.minX + 0.4, 4.3, 0.2, wallOut, 0, 0, S.minZ - 0.1);
  boxAt(g, S.maxX - S.minX + 0.6, 0.25, S.maxZ - S.minZ + 0.6, std(0x9a9a98, 0.9), 0, 4.3, (S.minZ + S.maxZ) / 2 - 0.1); // roof slab
  // inner wall skins
  const skinL = mesh(new THREE.PlaneGeometry(S.maxZ - S.minZ, S.ceil), wallIn, S.minX + 0.01, S.ceil / 2, (S.minZ + S.maxZ) / 2, g, Math.PI / 2);
  const skinR = mesh(new THREE.PlaneGeometry(S.maxZ - S.minZ, S.ceil), wallIn, S.maxX - 0.01, S.ceil / 2, (S.minZ + S.maxZ) / 2, g, -Math.PI / 2);
  const skinB = mesh(new THREE.PlaneGeometry(S.maxX - S.minX, S.ceil), wallIn, 0, S.ceil / 2, S.minZ + 0.01, g);
  skinL.receiveShadow = skinR.receiveShadow = skinB.receiveShadow = true;
  // ceiling
  const ceil = mesh(new THREE.PlaneGeometry(S.maxX - S.minX, S.maxZ - S.minZ), std(0xf4f4f0, 0.9), 0, S.ceil, (S.minZ + S.maxZ) / 2, g);
  ceil.rotation.x = Math.PI / 2;
  // header above glass (inside + outside)
  boxAt(g, S.maxX - S.minX, S.ceil - 2.7 + 0.05, 0.18, wallIn, 0, 2.7, S.maxZ - 0.09);

  // colliders: walls (door gap kept open)
  addBox(S.minX - 0.25, S.minX + 0.05, S.minZ - 0.2, S.maxZ + 0.05, { maxY: 4.4 });
  addBox(S.maxX - 0.05, S.maxX + 0.25, S.minZ - 0.2, S.maxZ + 0.05, { maxY: 4.4 });
  addBox(S.minX - 0.2, S.maxX + 0.2, S.minZ - 0.25, S.minZ + 0.05, { maxY: 4.4 });
  addBox(S.minX, S.doorX0, S.maxZ - 0.12, S.maxZ + 0.08, { maxY: 4.4, tag: 'glass' });
  addBox(S.doorX1, S.maxX, S.maxZ - 0.12, S.maxZ + 0.08, { maxY: 4.4, tag: 'glass' });
  addBox(S.minX, S.maxX, S.maxZ - 0.3, S.maxZ + 0.1, { minY: 2.65, maxY: 4.4, walk: false }); // header (camera only)
  addBox(S.minX, S.maxX, S.minZ, S.maxZ, { minY: S.ceil - 0.05, maxY: 4.6, walk: false });      // ceiling (camera only)

  // --- glass front ---
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdfeaf5, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.1, envMapIntensity: 1.5, depthWrite: false });
  const streak = glassStreakTex(); streak.repeat.set(3, 1);
  const streakMat = new THREE.MeshBasicMaterial({ map: streak, transparent: true, opacity: 0.55, depthWrite: false, color: 0xcfe0ff });
  const glassPane = (x0, x1, y0 = 0.08, y1 = 2.7) => {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
    mesh(new THREE.PlaneGeometry(w, h), glassMat, cx, y0 + h / 2, S.maxZ, g);
    const st = mesh(new THREE.PlaneGeometry(w, h), streakMat, cx, y0 + h / 2, S.maxZ + 0.01, g);
    st.material = streakMat.clone(); st.material.map = streak.clone(); st.material.map.repeat.set(w / 3, h / 2.6); st.material.map.needsUpdate = true;
    noReflect(st);
  };
  glassPane(S.minX, S.doorX0); glassPane(S.doorX1, S.maxX);
  // mullions + sill
  for (const x of [S.minX + 0.04, -4.6, -2.2, 0.6, S.doorX0, S.doorX1, S.maxX - 0.04]) boxAt(g, 0.08, 2.7, 0.14, alu, x, 0, S.maxZ);
  boxAt(g, S.maxX - S.minX, 0.1, 0.2, darkAlu, 0, 0, S.maxZ);
  boxAt(g, S.maxX - S.minX, 0.08, 0.16, alu, 0, 2.66, S.maxZ);

  // window posters (facing outward)
  const posters = [['oden', -6.2], ['karaage', -5.4], ['baito', 1.5], ['coffee', 2.3], ['atm', 6.1]];
  const quad = { oden: 0, karaage: 1, baito: 2, coffee: 3 };
  for (const [kind, x] of posters) {
    const p = mesh(new THREE.PlaneGeometry(0.62, 0.62), glowMap(posterTex(kind), 1.15), x, 1.85, S.maxZ - 0.025, g);
    if (quad[kind] !== undefined) p.userData.photo = { key: 'posters', q: quad[kind] };
  }

  // --- automatic sliding door ---
  const doorGroup = new THREE.Group(); g.add(doorGroup);
  const panels = [];
  const stickerTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d'); x.fillStyle = '#16306b'; x.fillRect(0, 0, 256, 64);
    x.fillStyle = '#fff'; x.font = '900 34px "Noto Sans JP", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('自動ドア', 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  for (const side of [-1, 1]) {
    const p = new THREE.Group();
    const w = (S.doorX1 - S.doorX0) / 2;
    mesh(new THREE.PlaneGeometry(w - 0.06, 2.5), glassMat, 0, 1.33, 0, p);
    boxAt(p, w, 0.06, 0.06, alu, 0, 0.05, 0); boxAt(p, w, 0.06, 0.06, alu, 0, 2.58, 0);
    boxAt(p, 0.05, 2.6, 0.06, alu, -w / 2 + 0.025, 0.05, 0); boxAt(p, 0.05, 2.6, 0.06, alu, w / 2 - 0.025, 0.05, 0);
    mesh(new THREE.PlaneGeometry(0.4, 0.1), new THREE.MeshBasicMaterial({ map: stickerTex }), 0, 1.25, 0.012, p);
    const cx = (S.doorX0 + S.doorX1) / 2 + side * w / 2;
    p.position.set(cx, 0, S.maxZ - 0.04 + side * 0.03);
    p.userData = { closedX: cx, openX: cx + side * (w - 0.05) };
    doorGroup.add(p); panels.push(p);
  }
  boxAt(g, S.doorX1 - S.doorX0 + 0.1, 0.18, 0.22, darkAlu, (S.doorX0 + S.doorX1) / 2, 2.62, S.maxZ); // door header w/ sensor
  mesh(new THREE.SphereGeometry(0.03, 8, 6), glow(0x66ff88, 3), (S.doorX0 + S.doorX1) / 2, 2.6, S.maxZ + 0.12, g);
  // entrance mat
  const mat = mesh(new THREE.PlaneGeometry(2.0, 1.0), std(0xffffff, 0.95, 0, { map: matTex() }), 4.2, 0.012, -7.2, g);
  mat.rotation.x = -Math.PI / 2; mat.receiveShadow = true;

  // --- eave + fascia sign ---
  boxAt(g, S.maxX - S.minX + 0.6, 0.12, 1.5, std(0x2a2d33, 0.6), 0, 2.88, S.maxZ + 0.75);
  addBox(S.minX - 0.3, S.maxX + 0.3, S.maxZ, S.maxZ + 1.5, { minY: 2.85, maxY: 3.05, walk: false });
  const sign = boxAt(g, S.maxX - S.minX + 0.6, 1.15, 0.35, std(0xf4f4f4, 0.5), 0, 3.0, S.maxZ + 0.1);
  const signFace = mesh(new THREE.PlaneGeometry(S.maxX - S.minX + 0.5, 1.08), glowMap(signboardTex(), 2.2), 0, 3.575, S.maxZ + 0.28, g);
  // fascia side caps
  for (const sx of [-1, 1]) mesh(new THREE.PlaneGeometry(0.34, 1.08), glow(0xffffff, 1.6), sx * (S.maxX + 0.31), 3.575, S.maxZ + 0.1, g, sx * Math.PI / 2);
  // eave downlights
  const dl = new THREE.InstancedMesh(new THREE.CircleGeometry(0.09, 16), glow(0xfff1d8, 6), 7);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 7; i++) {
    m4.makeRotationX(Math.PI / 2).setPosition(-6 + i * 2, 2.875, S.maxZ + 0.9);
    dl.setMatrixAt(i, m4);
  }
  g.add(dl);

  // --- ceiling light strips ---
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(1.25, 0.05, 0.16), glow(0xfff8ee, 3.2), 40);
  let n = 0;
  for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 6; iz++) {
    m4.makeTranslation(-5.6 + ix * 2.8, S.ceil - 0.03, -7.6 - iz * 1.5);
    lights.setMatrixAt(n++, m4);
  }
  lights.count = n;
  g.add(lights);

  // --- lights ---
  const down = new THREE.RectAreaLight(0xfff3e2, 1.6, 13, 9);
  down.position.set(0, S.ceil - 0.06, -11.2); down.rotation.x = -Math.PI / 2; g.add(down);
  const spill = new THREE.RectAreaLight(0xffe0b0, 1.8, 13.6, 2.4);
  spill.position.set(0, 1.45, S.maxZ + 0.05); spill.rotation.y = Math.PI; g.add(spill);
  const fasciaLight = new THREE.RectAreaLight(0xe8f0ff, 0.9, 14, 0.8);
  fasciaLight.position.set(0, 3.5, S.maxZ + 0.4); fasciaLight.rotation.y = Math.PI; fasciaLight.rotation.x = -0.5; g.add(fasciaLight);
  const shadowSpot = new THREE.SpotLight(0xffd9a8, 55, 22, 0.95, 0.7, 1.6);
  shadowSpot.position.set(0.5, 2.7, -11.5);
  shadowSpot.target.position.set(0.5, 0, -2.0);
  shadowSpot.castShadow = true;
  shadowSpot.shadow.mapSize.set(1024, 1024);
  shadowSpot.shadow.bias = -0.0008; shadowSpot.shadow.normalBias = 0.03;
  shadowSpot.shadow.camera.near = 1; shadowSpot.shadow.camera.far = 22;
  g.add(shadowSpot, shadowSpot.target);
  // VRM (MToon) characters ignore RectAreaLights, so the deep end of the store gets point fills
  for (const [x, z] of [[-3.2, -12.8], [3.0, -12.2]]) {
    const fill = new THREE.PointLight(0xfff1dc, 9, 9, 1.5);
    fill.position.set(x, 2.75, z); g.add(fill);
  }

  // --- pylon sign ---
  const pyl = new THREE.Group(); pyl.position.set(8.1, 0, -4.9); g.add(pyl);
  boxAt(pyl, 0.22, 5.2, 0.22, std(0x3a3f47, 0.5, 0.6), 0, 0, 0);
  boxAt(pyl, 1.5, 1.85, 0.4, std(0xffffff, 0.5), 0, 5.0, 0);
  const pt = pylonTex();
  for (const s of [-1, 1]) mesh(new THREE.PlaneGeometry(1.42, 1.78), glowMap(pt, 2.0), 0, 5.925, s * 0.205, pyl, s > 0 ? 0 : Math.PI);
  addBox(7.95, 8.25, -5.05, -4.75, { maxY: 7 });

  // --- staff door & restroom sign on back wall ---
  boxAt(g, 0.95, 2.1, 0.06, std(0x8c96a3, 0.5, 0.3), 5.6, 0, S.minZ + 0.03);
  const staff = document.createElement('canvas'); staff.width = 256; staff.height = 64;
  { const x = staff.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#333'; x.font = '900 30px Arial'; x.textAlign = 'center'; x.fillText('STAFF ONLY', 128, 42); }
  const st = new THREE.CanvasTexture(staff); st.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(0.6, 0.15), new THREE.MeshBasicMaterial({ map: st }), 5.6, 1.7, S.minZ + 0.07, g);

  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  // door logic
  let open = 0;
  const center = new THREE.Vector2((S.doorX0 + S.doorX1) / 2, S.maxZ);
  const state = { open: 0, justOpened: false };
  state.update = (dt, actors) => {
    let near = false;
    for (const a of actors) {
      const dx = a.x - center.x, dz = a.z - center.y;
      if (Math.abs(dx) < 1.6 && Math.abs(dz) < 2.2) { near = true; break; }
    }
    const prev = open;
    open = THREE.MathUtils.clamp(open + (near ? dt * 1.8 : -dt * 1.2), 0, 1);
    const e = open * open * (3 - 2 * open);
    for (const p of panels) p.position.x = THREE.MathUtils.lerp(p.userData.closedX, p.userData.openX, e);
    state.justOpened = prev === 0 && open > 0;
    state.open = open;
  };
  state.panels = panels;
  return state;
}
