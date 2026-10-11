// Umbrellas (open/close animated) and mamachari bicycles
import * as THREE from 'three';
import { std, mesh, glow } from './utils.js';

const _up = new THREE.Vector3(0, 1, 0);
export function tubeBetween(a, b, r, mat, parent, seg = 8) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  if (parent) parent.add(m);
  return m;
}

// cheap closed umbrella (for stands / NPC props)
export function closedUmbrella(color = 0xe9f1fa, clear = true) {
  const g = new THREE.Group();
  const mat = clear
    ? new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, roughness: 0.15, envMapIntensity: 1.5 })
    : std(color, 0.6);
  const fold = new THREE.CylinderGeometry(0.008, 0.045, 0.55, 8, 1, true);
  mesh(fold, mat, 0, 0.42, 0, g).scale.set(1, 1, 0.8);
  mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.85, 6), std(0xdddddd, 0.3, 0.5), 0, 0.42, 0, g);
  const path = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0.84, 0), new THREE.Vector3(0, 0.98, 0), new THREE.Vector3(0.08, 0.93, 0));
  mesh(new THREE.TubeGeometry(path, 10, 0.012, 6), clear ? std(0xf4f4f4, 0.3) : std(0x3a2416, 0.4), 0, 0, 0, g);
  return g;
}

// ---------------------------------------------------------------------------
// Mamachari (city bicycle). Origin on the ground under the bottom bracket.
// ---------------------------------------------------------------------------
export function createBicycle({ color = 0xb8c4cf, basket = true, withUmbrella = false } = {}) {
  const g = new THREE.Group();
  const frame = std(color, 0.35, 0.6);
  const chrome = std(0xd8dde3, 0.15, 1.0);
  const black = std(0x111111, 0.7);
  const R = 0.33, wheelBase = 1.08;
  const front = new THREE.Vector3(wheelBase * 0.52, R, 0), rear = new THREE.Vector3(-wheelBase * 0.48, R, 0);
  const wheels = [];
  for (const c of [front, rear]) {
    const w = new THREE.Group(); w.position.copy(c); g.add(w); wheels.push(w);
    mesh(new THREE.TorusGeometry(R, 0.022, 8, 32), black, 0, 0, 0, w);
    mesh(new THREE.TorusGeometry(R - 0.03, 0.008, 6, 32), chrome, 0, 0, 0, w);
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 10), chrome, 0, 0, 0, w).rotation.x = Math.PI / 2;
    const sp = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, s = i % 2 ? 0.03 : -0.03;
      sp.push(0, 0, s, Math.cos(a) * (R - 0.03), Math.sin(a) * (R - 0.03), 0);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    w.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xc8cdd3 })));
    // fender
    const fender = mesh(new THREE.TorusGeometry(R + 0.04, 0.03, 4, 20, Math.PI * 0.9), chrome, 0, 0, 0, g);
    fender.position.copy(c); fender.rotation.z = c === front ? 0.25 : Math.PI * 0.12; fender.scale.z = 0.5;
  }
  const bb = new THREE.Vector3(0, 0.3, 0);
  const seatTop = new THREE.Vector3(-0.2, 0.86, 0);
  const head = new THREE.Vector3(0.42, 0.88, 0), headLow = new THREE.Vector3(0.46, 0.72, 0);
  // step-through curved down tube
  const down = new THREE.QuadraticBezierCurve3(headLow, new THREE.Vector3(0.12, 0.25, 0), bb);
  mesh(new THREE.TubeGeometry(down, 16, 0.024, 8), frame, 0, 0, 0, g);
  tubeBetween(bb, seatTop, 0.022, frame, g);
  tubeBetween(head, headLow, 0.026, frame, g);
  tubeBetween(bb, rear, 0.014, frame, g).position.z += 0.0;
  tubeBetween(new THREE.Vector3(-0.17, 0.75, 0), rear, 0.013, frame, g);
  tubeBetween(headLow, front, 0.016, chrome, g);
  // handlebar (swept back)
  const hb = new THREE.CatmullRomCurve3([new THREE.Vector3(0.28, 1.02, -0.3), new THREE.Vector3(0.4, 1.0, -0.15), new THREE.Vector3(0.44, 0.98, 0), new THREE.Vector3(0.4, 1.0, 0.15), new THREE.Vector3(0.28, 1.02, 0.3)]);
  mesh(new THREE.TubeGeometry(hb, 20, 0.012, 6), chrome, 0, 0, 0, g);
  tubeBetween(head, new THREE.Vector3(0.44, 0.98, 0), 0.015, chrome, g);
  for (const s of [-1, 1]) mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.1, 8), black, 0.28, 1.02, s * 0.32, g).rotation.x = Math.PI / 2;
  // saddle
  const saddle = mesh(new THREE.SphereGeometry(0.1, 12, 8), std(0x2a1d16, 0.6), seatTop.x - 0.02, seatTop.y + 0.04, 0, g);
  saddle.scale.set(1.4, 0.35, 0.9);
  // crank + pedals
  const crank = new THREE.Group(); crank.position.copy(bb); g.add(crank);
  mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 20), chrome, 0, 0, 0.05, crank).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.rotation.z = s > 0 ? 0 : Math.PI; crank.add(arm);
    mesh(new THREE.BoxGeometry(0.02, 0.17, 0.015), chrome, 0, -0.085, s * 0.08, arm);
    mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), black, 0, -0.17, s * 0.12, arm);
  }
  // chain guard
  const cg = mesh(new THREE.BoxGeometry(0.5, 0.1, 0.01), frame, -0.2, 0.31, 0.07, g); cg.rotation.z = 0.02;
  // rear carrier
  tubeBetween(new THREE.Vector3(-0.15, 0.78, 0.07), new THREE.Vector3(-0.6, 0.78, 0.07), 0.008, chrome, g);
  tubeBetween(new THREE.Vector3(-0.15, 0.78, -0.07), new THREE.Vector3(-0.6, 0.78, -0.07), 0.008, chrome, g);
  tubeBetween(new THREE.Vector3(-0.6, 0.78, 0), rear, 0.008, chrome, g);
  // basket (wire box)
  if (basket) {
    const bk = new THREE.Group(); bk.position.set(0.62, 0.86, 0); g.add(bk);
    const bw = 0.32, bh = 0.24, bd = 0.36, pts = [];
    for (let i = 0; i <= 6; i++) { const x = -bw / 2 + (i / 6) * bw; pts.push(x, 0, -bd / 2, x, bh, -bd / 2, x, 0, bd / 2, x, bh, bd / 2); }
    for (let i = 0; i <= 6; i++) { const z = -bd / 2 + (i / 6) * bd; pts.push(-bw / 2, 0, z, -bw / 2, bh, z, bw / 2, 0, z, bw / 2, bh, z); }
    for (const y of [0, bh * 0.5, bh]) pts.push(-bw / 2, y, -bd / 2, bw / 2, y, -bd / 2, -bw / 2, y, bd / 2, bw / 2, y, bd / 2, -bw / 2, y, -bd / 2, -bw / 2, y, bd / 2, bw / 2, y, -bd / 2, bw / 2, y, bd / 2);
    const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    bk.add(new THREE.LineSegments(bgeo, new THREE.LineBasicMaterial({ color: 0x9aa2ab })));
    mesh(new THREE.BoxGeometry(bw, 0.005, bd), std(0x8a929b, 0.4, 0.8), 0, 0, 0, bk);
  }
  // headlamp + reflector
  mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.06, 10), chrome, 0.62, 0.62, 0, g).rotation.z = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.01, 0.05, 0.07), glow(0xff2a1a, 1.2), -0.66, 0.66, 0, g);
  // center stand
  tubeBetween(new THREE.Vector3(-0.38, 0.3, 0.08), new THREE.Vector3(-0.48, 0.0, 0.12), 0.01, chrome, g);
  tubeBetween(new THREE.Vector3(-0.38, 0.3, -0.08), new THREE.Vector3(-0.48, 0.0, -0.12), 0.01, chrome, g);
  if (withUmbrella) {
    const u = closedUmbrella(); u.position.set(0.3, 0.12, -0.32); u.rotation.z = -0.15; g.add(u);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData = { wheels, crank, R };
  return g;
}
