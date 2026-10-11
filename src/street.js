// Street layout: wet ground, neighbouring buildings, poles & wires, furniture, signs
import * as THREE from 'three';
import { std, glow, glowMap, boxAt, mesh, addBox, addCircle, addRotBox, wireCurve, canvasTex, rand, noReflect, FONT_JP } from './utils.js';
import { createGroundMaterial } from './reflection.js';
import { stopTex } from './tex-signs.js';
import { building, shutterFront, verticalSign, izakaya, coinLaundry, ramenShop, house, skyline } from './buildings.js';
import { createVending, createTrashBins, createUmbrellaStand, createPostbox, createCurveMirror, createPole, createACUnit } from './props2.js';
import { createBicycle } from './props.js';

export function buildStreet(scene, refl) {
  const g = new THREE.Group(); g.name = 'street'; scene.add(g);
  const animated = { noren: [], cones: [], red: [], lanterns: [] };

  // ---------- ground ----------
  const groundMat = createGroundMaterial(refl, { stopMap: stopTex() });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  g.add(ground);
  refl.hide.push(ground);

  // ---------- north row (fronts face +z at z = -6.5) ----------
  const A = building(g, { x0: -26, x1: -12, z0: -20, z1: -6.5, h: 13.5, side: 1, color: '#6b6560', floors: 3, lit: 0.5 });
  shutterFront(g, -22.5, 6, A.frontZ, 1);
  const cleaning = canvasTex(512, 96, (c, w, h) => { c.fillStyle = '#1d5fae'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `900 56px ${FONT_JP}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('クリーニング', w / 2, h / 2 + 3); });
  mesh(new THREE.PlaneGeometry(3.2, 0.6), glowMap(cleaning, 1.2), -22.5, 3.0, A.frontZ + 0.2, g);
  // small closed shop with lit vending corner
  shutterFront(g, -15.5, 6, A.frontZ, 1);
  verticalSign(g, -12.4, 4.2, -6.2, 'カラオケ', { bg: '#14031a', fg: '#ff4fd8', border: '#7a2bff', sub: 'KARAOKE', glow: 2.4 }, 0);
  verticalSign(g, -19.0, 4.6, -6.2, 'スナック夢', { bg: '#0a1020', fg: '#7df9ff', border: '#ff3b8d', glow: 2.2 }, 0);
  const neonPink = new THREE.PointLight(0xff3fbf, 6, 9, 1.8); neonPink.position.set(-12.4, 5.5, -5.4); g.add(neonPink);

  // apron wall behind vending machines (between building A and store)
  boxAt(g, 4.6, 1.2, 0.2, std(0x8f8e88, 0.9), -9.6, 0, -7.4);
  addBox(-11.9, -7.3, -7.5, -7.3, { maxY: 1.3 });
  const vm1 = createVending('#c62d24'); vm1.position.set(-8.3, 0, -6.85); g.add(vm1);
  const vm2 = createVending('#1f6fb8'); vm2.position.set(-9.4, 0, -6.85); g.add(vm2);
  const vm3 = createVending('#f2f2f2'); vm3.position.set(-10.5, 0, -6.85); g.add(vm3);
  addBox(-11.0, -7.8, -7.25, -6.45, { maxY: 1.9 });
  const vmLight = new THREE.PointLight(0xd8ecff, 7, 6, 1.8); vmLight.position.set(-9.4, 1.6, -5.6); g.add(vmLight);
  // recycle bin beside the machines
  const can = mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.8, 14), std(0x2a6fd6, 0.5), -7.6, 0.4, -6.2, g); addCircle(-7.6, -6.2, 0.25);

  const B = building(g, { x0: 9.5, x1: 21, z0: -18, z1: -6.5, h: 10.5, side: 1, color: '#504a48', floors: 2, lit: 0.55 });
  const iz = izakaya(g, B); animated.noren.push(...iz.noren);
  verticalSign(g, 9.8, 4.0, -6.2, '居酒屋', { bg: '#1a0604', fg: '#ffdf7a', border: '#ff5a2a', glow: 2.2 }, 0);
  verticalSign(g, 20.6, 4.4, -6.2, 'BAR月', { bg: '#04121a', fg: '#9fe8ff', border: '#2bd1ff', glow: 2.2 }, 0);
  const C = building(g, { x0: 21, x1: 34, z0: -19, z1: -6.5, h: 16, side: 1, color: '#7a7d84', floors: 4, lit: 0.4, balcony: true });
  shutterFront(g, 27.5, 12, C.frontZ, 1);
  const W = building(g, { x0: -42, x1: -26, z0: -20, z1: -6.5, h: 18, side: 1, color: '#585c66', floors: 5, lit: 0.42, balcony: true });
  shutterFront(g, -34, 15, W.frontZ, 1);
  // alley clutter between store and izakaya
  for (const [z, y] of [[-8, 0], [-11, 0], [-11, 0.62]]) { const ac = createACUnit(); ac.position.set(9.3, y, z); ac.rotation.y = -Math.PI / 2; g.add(ac); }
  addBox(8.9, 9.5, -11.4, -7.6, { maxY: 1.3 });
  for (let i = 0; i < 3; i++) boxAt(g, 0.45, 0.3, 0.35, std([0x2471a3, 0xf2c230, 0xc0281e][i], 0.6), 7.7, i * 0.3, -14);
  addBox(7.45, 7.95, -14.2, -13.8, { maxY: 1 });
  mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.2, 8), std(0x777777, 0.5, 0.6), 7.35, 2.1, -9.5, g);

  // ---------- south row (fronts face -z at z = 5.6) ----------
  const D = building(g, { x0: -36, x1: -20, z0: 5.6, z1: 18, h: 15, side: -1, color: '#6d6a66', floors: 4, lit: 0.5, balcony: true });
  shutterFront(g, -28, 14, D.frontZ, -1);
  const L = building(g, { x0: -20, x1: -12, z0: 5.6, z1: 15, h: 7.5, side: -1, color: '#9a9690', floors: 1, lit: 0.6 });
  coinLaundry(g, L);
  const S1 = building(g, { x0: -12, x1: -6.5, z0: 5.6, z1: 15, h: 9.5, side: -1, color: '#7b6f66', floors: 2, lit: 0.5 });
  shutterFront(g, -9.25, 5.5, S1.frontZ, -1);
  verticalSign(g, -6.8, 3.8, 5.3, 'くすり', { bg: '#062a10', fg: '#ffffff', border: '#3fe07a', glow: 2.0 }, Math.PI);
  const S2 = building(g, { x0: -6.5, x1: -1.5, z0: 5.6, z1: 15, h: 8.5, side: -1, color: '#5f6470', floors: 2, lit: 0.3 });
  shutterFront(g, -4, 5, S2.frontZ, -1);
  verticalSign(g, -1.8, 3.6, 5.3, '整骨院', { bg: '#f4f4f4', fg: '#16306b', border: '#2a6fd6', glow: 1.3 }, Math.PI);
  // alley gap with a lone vending machine
  const vm4 = createVending('#2f8a3c'); vm4.position.set(-0.2, 0, 6.1); vm4.rotation.y = Math.PI; g.add(vm4);
  addBox(-0.7, 0.3, 5.7, 6.5, { maxY: 1.9 });
  boxAt(g, 3, 2.2, 0.15, std(0x8f8e88, 0.9), -0.0, 0, 7.6);
  const R = building(g, { x0: 1.5, x1: 10, z0: 5.6, z1: 15, h: 9, side: -1, color: '#4f4a46', floors: 2, lit: 0.5 });
  const rs = ramenShop(g, R); animated.noren.push(...rs.noren);
  house(g, { x0: 10, x1: 20, zFront: 5.6 });
  const E = building(g, { x0: 20, x1: 36, z0: 5.6, z1: 18, h: 13, side: -1, color: '#6a7078', floors: 3, lit: 0.25 });
  shutterFront(g, 28, 15, E.frontZ, -1);
  const sky = skyline(g); animated.red = sky.red;

  // ---------- utility poles, lamps, wires ----------
  const poles = [];
  const addPole = (x, z, lamp, transformer, ry) => {
    const p = createPole({ lamp, transformer }); p.position.set(x, 0, z); p.rotation.y = ry; g.add(p);
    addCircle(x, z, 0.25); poles.push(p);
    if (p.userData.head) animated.cones.push(p.userData.head.children.find((c) => c.material && c.material.uniforms));
    return p;
  };
  addPole(-17, -4.1, true, false, 0);
  addPole(12.2, -4.1, true, true, 0);
  addPole(-27, 4.1, true, true, Math.PI);
  addPole(-3.2, 4.1, true, false, Math.PI);
  addPole(22, 4.1, false, false, Math.PI);
  addPole(36, -4.1, false, true, 0);
  addPole(-40, -4.1, false, false, 0);
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x050506 });
  const wire = (a, b, sag) => { const c = wireCurve(a, b, sag); const m = new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.012, 4), wireMat); g.add(m); noReflect(m); };
  const top = (p, dy, dx = 0) => new THREE.Vector3(p.position.x + dx, 9.1 + dy, p.position.z);
  const north = poles.filter((p) => p.position.z < 0).sort((a, b) => a.position.x - b.position.x);
  const south = poles.filter((p) => p.position.z > 0).sort((a, b) => a.position.x - b.position.x);
  for (const row of [north, south]) for (let i = 0; i < row.length - 1; i++) for (const [dy, dx, sag] of [[0.14, -0.7, 0.5], [0.14, 0.25, 0.55], [-0.56, -0.25, 0.7], [-0.56, 0.7, 0.8], [-2.0, 0, 0.9]]) wire(top(row[i], dy, dx), top(row[i + 1], dy, dx), sag);
  // crossings over the road
  for (const [a, b] of [[1, 1], [0, 0], [2, 2]]) if (north[a] && south[b]) for (const dy of [0.14, -0.56]) wire(top(north[a], dy), top(south[b], dy), 0.6);
  // service drops to buildings
  wire(top(north[1], -2.0), new THREE.Vector3(-6.8, 4.2, -6.6), 0.4);
  wire(top(north[2], -2.0), new THREE.Vector3(10.5, 6.5, -6.6), 0.4);
  wire(top(south[1], -2.0), new THREE.Vector3(-14, 6.8, 5.7), 0.4);
  wire(top(south[2], -2.0), new THREE.Vector3(4, 7.2, 5.7), 0.4);

  // ---------- store frontage furniture ----------
  const bikes = [];
  const bikeCols = [0xb8c4cf, 0x8fc1e0, 0xe8b4c8, 0x2a2d33, 0xd8d0b8];
  for (let i = 0; i < 5; i++) {
    const b = createBicycle({ color: bikeCols[i], withUmbrella: i === 2 });
    const x = -6.2 + i * 0.78, z = -5.35, ry = Math.PI / 2 + rand(-0.12, 0.12);
    b.position.set(x, 0, z); b.rotation.y = ry; g.add(b); bikes.push(b);
    addRotBox(x, z - 0.05, 0.4, 1.7, 0, { maxY: 1.1 });
  }
  for (let i = 0; i < 2; i++) {
    const b = createBicycle({ color: [0x9b2a2a, 0xc8ccd2][i], basket: i === 0 });
    b.position.set(-18 + i * 0.8, 0, 6.3); b.rotation.y = -Math.PI / 2 + rand(-0.1, 0.1); g.add(b);
    addRotBox(b.position.x, 6.3, 0.4, 1.7, 0, { maxY: 1.1 });
  }
  const bins = createTrashBins(); bins.position.set(-0.6, 0, -6.28); g.add(bins);
  addBox(-1.4, 0.2, -6.5, -6.05, { maxY: 1 });
  const stand = createUmbrellaStand(); stand.position.set(6.0, 0, -6.22); g.add(stand);
  addBox(5.5, 6.5, -6.4, -6.05, { maxY: 0.9 });
  const post = createPostbox(); post.position.set(-12.6, 0, -5.9); g.add(post); addBox(-12.85, -12.35, -6.1, -5.7, { maxY: 1.4 });
  const mirror = createCurveMirror(); mirror.position.set(-15.6, 0, 4.25); mirror.rotation.y = Math.PI + 0.5; g.add(mirror); addCircle(-15.6, 4.25, 0.12);

  // 止まれ sign (inverted triangle)
  const stop = new THREE.Group(); stop.position.set(13.6, 0, -4.15); g.add(stop);
  mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.6, 8), std(0xd8dde3, 0.3, 0.8), 0, 1.3, 0, stop);
  const triTex = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(0, 20); c.lineTo(w, 20); c.lineTo(w / 2, h - 10); c.fill();
    c.fillStyle = '#d0141c'; c.beginPath(); c.moveTo(18, 30); c.lineTo(w - 18, 30); c.lineTo(w / 2, h - 30); c.fill();
    c.fillStyle = '#fff'; c.font = `900 50px ${FONT_JP}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('止まれ', w / 2, 92);
  });
  mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshStandardMaterial({ map: triTex, transparent: true, alphaTest: 0.5, roughness: 0.4, side: THREE.DoubleSide }), 0, 2.4, 0.04, stop, -Math.PI / 2);
  addCircle(13.6, -4.15, 0.1);

  // manholes
  const mh = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(64, 64, 63, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#4a4a4a'; c.lineWidth = 3;
    for (let r = 12; r < 60; r += 10) { c.beginPath(); c.arc(64, 64, r, 0, Math.PI * 2); c.stroke(); }
    for (let a = 0; a < 12; a++) { c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + Math.cos(a / 12 * 6.28) * 60, 64 + Math.sin(a / 12 * 6.28) * 60); c.stroke(); }
  });
  for (const [x, z] of [[-6, 1.2], [8, -1.5], [-22, 0.8]]) {
    const m = mesh(new THREE.CircleGeometry(0.32, 24), std(0xffffff, 0.3, 0.7, { map: mh, polygonOffset: true, polygonOffsetFactor: -2 }), x, 0.004, z, g);
    m.rotation.x = -Math.PI / 2; refl.hide.push(m);
  }

  // world bounds (invisible walls at street ends)
  addBox(-48, -44, -8, 8, { maxY: 6, cam: false });
  addBox(44, 48, -8, 8, { maxY: 6, cam: false });

  g.traverse((o) => { if (o.isMesh && o !== ground) { o.receiveShadow = o.receiveShadow || false; } });
  for (const v of [vm1, vm2, vm3, vm4]) v.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return { ground, groundMat, animated, bikes };
}
