// Register counter, hot snacks, oden, coffee, cigarette wall, ATM, Halloween island
import * as THREE from 'three';
import { std, glow, glowMap, boxAt, mesh, addBox, rand, canvasTex, FONT_JP, noReflect } from './utils.js';
import { cigWallTex, snackCaseTex } from './tex-items.js';
import { atmScreenTex, hangingSignTex, logoMark } from './tex-signs.js';

export function buildCounter(scene) {
  const g = new THREE.Group(); g.name = 'counter'; scene.add(g);
  const cx0 = 5.3, cx1 = 6.1, cz0 = -13.4, cz1 = -8.7, ccx = (cx0 + cx1) / 2, ccz = (cz0 + cz1) / 2, clen = cz1 - cz0;

  // counter body with brand stripe front
  const front = canvasTex(1024, 128, (c, w, h) => {
    c.fillStyle = '#f7f7f5'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#16306b'; c.fillRect(0, h - 40, w, 14);
    c.fillStyle = '#0f9c8c'; c.fillRect(0, h - 26, w, 12);
    c.fillStyle = '#f28a1e'; c.fillRect(0, h - 14, w, 14);
    logoMark(c, 80, 48, 30);
    c.fillStyle = '#16306b'; c.font = `900 40px ${FONT_JP}`; c.textBaseline = 'middle'; c.fillText('ほしぞらマート', 130, 50);
  });
  boxAt(g, cx1 - cx0, 0.95, clen, std(0xf2f2f0, 0.5), ccx, 0, ccz);
  mesh(new THREE.PlaneGeometry(clen, 0.95), std(0xffffff, 0.5, 0, { map: front }), cx0 - 0.005, 0.475, ccz, g, -Math.PI / 2);
  boxAt(g, cx1 - cx0 + 0.12, 0.04, clen + 0.1, std(0xb8bcc2, 0.25, 0.3), ccx - 0.04, 0.95, ccz);
  addBox(cx0 - 0.08, cx1, cz0, cz1, { maxY: 1.0 });
  // back counter + cigarette wall
  boxAt(g, 0.4, 0.9, clen, std(0xe0e0dc, 0.6), 6.8, 0, ccz);
  addBox(6.6, 7.0, cz0, cz1, { maxY: 1.0 });
  mesh(new THREE.PlaneGeometry(clen - 0.4, 1.25), glowMap(cigWallTex(), 0.9), 6.975, 1.85, ccz, g, -Math.PI / 2).userData.photo = { key: 'cigarettes' };

  // POS registers
  for (const z of [-10.1, -12.0]) {
    boxAt(g, 0.36, 0.1, 0.4, std(0x2a2d33, 0.4, 0.3), ccx + 0.05, 0.99, z);
    const scr = mesh(new THREE.PlaneGeometry(0.34, 0.24), glow(0x6fb6ff, 1.4), ccx + 0.12, 1.24, z, g, Math.PI / 2);
    scr.rotation.z = 0; scr.rotateX(-0.3);
    boxAt(g, 0.04, 0.26, 0.36, std(0x1b1d22, 0.4), ccx + 0.15, 1.08, z);
    const cust = mesh(new THREE.PlaneGeometry(0.16, 0.08), glow(0x9dff9d, 1.6), ccx - 0.12, 1.2, z, g, -Math.PI / 2);
    boxAt(g, 0.06, 0.12, 0.18, std(0x1b1d22, 0.4), ccx - 0.1, 1.09, z);
    boxAt(g, 0.12, 0.05, 0.08, std(0x2a2d33, 0.4), ccx - 0.25, 0.99, z + 0.32); // card terminal
  }

  // hot snack case
  const hs = new THREE.Group(); hs.position.set(ccx - 0.05, 0.99, -9.25); g.add(hs);
  boxAt(hs, 0.5, 0.06, 0.8, std(0x3a3f47, 0.4, 0.6), 0, 0, 0);
  boxAt(hs, 0.5, 0.06, 0.8, std(0x3a3f47, 0.4, 0.6), 0, 0.42, 0);
  const caseGlass = new THREE.MeshPhysicalMaterial({ color: 0xfff0e0, transparent: true, opacity: 0.18, roughness: 0.05, depthWrite: false });
  boxAt(hs, 0.48, 0.36, 0.78, caseGlass, 0, 0.06, 0);
  mesh(new THREE.PlaneGeometry(0.46, 0.76), glow(0xffa64d, 1.4), 0, 0.065, 0, hs).rotation.x = -Math.PI / 2;
  mesh(new THREE.PlaneGeometry(0.46, 0.76), glow(0xffd9a0, 2.5), 0, 0.415, 0, hs).rotation.x = Math.PI / 2;
  const fried = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.035, 1), std(0xb8661e, 0.55, 0, { emissive: 0x6a2a00, emissiveIntensity: 0.6 }), 18);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) { m4.makeScale(1, 0.8, 1.2).setPosition(rand(-0.18, 0.18), 0.1 + (i % 3) * 0.1, rand(-0.34, 0.34)); fried.setMatrixAt(i, m4); }
  hs.add(fried);
  mesh(new THREE.PlaneGeometry(0.78, 0.18), glowMap(snackCaseTex(), 1.2), -0.255, 0.56, 0, hs, -Math.PI / 2);

  // oden pot with steam
  const od = new THREE.Group(); od.position.set(ccx - 0.08, 0.99, -11.05); g.add(od);
  boxAt(od, 0.42, 0.16, 0.6, std(0xc8ccd2, 0.25, 0.9), 0, 0, 0);
  const broth = mesh(new THREE.PlaneGeometry(0.38, 0.56), std(0x7a4a1c, 0.15, 0, { emissive: 0x3a1a00, emissiveIntensity: 0.5 }), 0, 0.14, 0, od);
  broth.rotation.x = -Math.PI / 2;
  for (const x of [-0.06, 0.06]) boxAt(od, 0.01, 0.05, 0.56, std(0xc8ccd2, 0.25, 0.9), x, 0.11, 0);
  const egg = new THREE.SphereGeometry(0.025, 10, 8), daikon = new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14), konnyaku = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 3);
  for (let i = 0; i < 9; i++) {
    const kind = i % 3, x = -0.12 + (i % 3) * 0.12, z = -0.2 + Math.floor(i / 3) * 0.2;
    const m = kind === 0 ? mesh(egg, std(0xc89a5a, 0.35), x, 0.15, z, od) : kind === 1 ? mesh(daikon, std(0xd9b878, 0.4), x, 0.145, z, od) : mesh(konnyaku, std(0x55504a, 0.5), x, 0.145, z, od);
    if (kind === 0) m.scale.set(1, 0.8, 1.3);
  }
  const steamTex = canvasTex(64, 64, (c, w, h) => {
    const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = grd; c.fillRect(0, 0, w, h);
  });
  const steam = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0.0, color: 0xfff4e8 }));
    s.userData.phase = i / 6; od.add(s); steam.push(s); noReflect(s);
  }
  mesh(new THREE.PlaneGeometry(0.5, 0.14), glowMap(hangingSignTex('おでん', '#c0281e'), 1.2), -0.215, 0.3, 0, od, -Math.PI / 2);

  // coffee machine
  const cm = new THREE.Group(); cm.position.set(ccx - 0.05, 0.99, -12.9); g.add(cm);
  boxAt(cm, 0.42, 0.62, 0.42, std(0x1a1b1f, 0.35, 0.4), 0, 0, 0);
  mesh(new THREE.PlaneGeometry(0.2, 0.14), glow(0xffb05a, 1.8), -0.212, 0.45, 0, cm, -Math.PI / 2);
  boxAt(cm, 0.12, 0.04, 0.2, std(0x777b82, 0.3, 0.8), -0.22, 0.04, 0);
  for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.08, 12), std(0xf4f0e8, 0.6), -0.05, 0.66 + i * 0.012, 0.28, cm);

  // ATM (right of the entrance)
  const atm = new THREE.Group(); atm.position.set(6.6, 0, -7.85); atm.rotation.y = -Math.PI / 2; g.add(atm);
  boxAt(atm, 0.9, 1.3, 0.7, std(0xe9ebee, 0.4, 0.2), 0, 0, 0);
  boxAt(atm, 0.9, 0.35, 0.72, std(0x16306b, 0.5), 0, 1.65, 0);
  const atmSign = canvasTex(256, 96, (c, w, h) => {
    c.fillStyle = '#16306b'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = '900 56px "Segoe UI", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ATM', 90, h / 2 + 2);
    c.fillStyle = '#f28a1e'; c.font = `900 22px ${FONT_JP}`; c.fillText('24時間', 200, h / 2 + 2);
  });
  mesh(new THREE.PlaneGeometry(0.88, 0.33), glowMap(atmSign, 1.6), 0, 1.825, 0.365, atm);
  boxAt(atm, 0.06, 0.4, 0.75, std(0xc5c9cf, 0.4, 0.3), -0.45, 1.3, 0);
  boxAt(atm, 0.06, 0.4, 0.75, std(0xc5c9cf, 0.4, 0.3), 0.45, 1.3, 0);
  const scr = mesh(new THREE.PlaneGeometry(0.42, 0.3), glowMap(atmScreenTex(), 1.1), 0, 1.18, 0.33, atm);
  scr.rotation.x = -0.45;
  boxAt(atm, 0.84, 0.03, 0.2, std(0x9aa0a8, 0.3, 0.6), 0, 0.95, 0.4);
  mesh(new THREE.PlaneGeometry(0.12, 0.012), glow(0x5ad1ff, 3), 0.28, 1.05, 0.352, atm);
  addBox(6.25, 7.0, -8.3, -7.4, { maxY: 2.0 });

  // Halloween island
  const hw = new THREE.Group(); hw.position.set(3.0, 0, -11.5); g.add(hw);
  boxAt(hw, 1.0, 0.7, 2.0, std(0x2a1838, 0.8), 0, 0, 0);
  boxAt(hw, 1.04, 0.05, 2.04, std(0xf28a1e, 0.7), 0, 0.7, 0);
  const pumpkinGeo = new THREE.SphereGeometry(0.12, 16, 12);
  const pp = pumpkinGeo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); const a = Math.atan2(v.z, v.x); const k = 1 + 0.08 * Math.cos(a * 8); v.x *= k; v.z *= k; v.y *= 0.78; pp.setXYZ(i, v.x, v.y, v.z); }
  pumpkinGeo.computeVertexNormals();
  const pMat = std(0xf07a12, 0.55, 0, { emissive: 0x401800, emissiveIntensity: 0.3 });
  [[-0.25, -0.6, 1.0], [0.22, -0.2, 0.8], [-0.2, 0.3, 0.9], [0.25, 0.65, 1.2]].forEach(([x, z, s]) => {
    const p = mesh(pumpkinGeo, pMat, x, 0.82 * 1 + 0.02, z, hw); p.scale.setScalar(s);
    mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.06, 6), std(0x3b5a1e, 0.8), x, 0.83 + 0.1 * s, z, hw);
  });
  // big jack-o'-lantern
  const jack = mesh(pumpkinGeo, pMat, 0, 1.0, 0.05, hw); jack.scale.setScalar(2.1);
  const face = canvasTex(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#ffd04a';
    c.beginPath(); c.moveTo(70, 30); c.lineTo(100, 70); c.lineTo(40, 70); c.fill();
    c.beginPath(); c.moveTo(186, 30); c.lineTo(216, 70); c.lineTo(156, 70); c.fill();
    c.beginPath(); c.moveTo(40, 88); for (let i = 0; i <= 8; i++) c.lineTo(40 + i * 22, i % 2 ? 100 : 86); c.lineTo(216, 112); c.lineTo(40, 112); c.fill();
  });
  const fm = mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: face, transparent: true, color: new THREE.Color(3, 2.2, 1) }), -0.255, 1.0, 0.05, hw, -Math.PI / 2);
  const hsign = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#2a1838'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#f28a1e'; c.font = `900 70px ${FONT_JP}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ハロウィン', w / 2, h / 2 + 4);
  });
  for (const s of [-1, 1]) mesh(new THREE.PlaneGeometry(0.9, 0.22), glowMap(hsign, 1.3), s * 0.53, 0.45, 0, hw, s * Math.PI / 2);
  addBox(2.45, 3.55, -12.55, -10.45, { maxY: 1.2 });

  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });

  return {
    update(t) {
      for (const s of steam) {
        const k = (t * 0.35 + s.userData.phase) % 1;
        s.position.set(Math.sin(t + s.userData.phase * 9) * 0.05, 0.18 + k * 0.5, (s.userData.phase - 0.5) * 0.4);
        s.scale.setScalar(0.08 + k * 0.25);
        s.material.opacity = Math.sin(k * Math.PI) * 0.35;
      }
    },
  };
}
