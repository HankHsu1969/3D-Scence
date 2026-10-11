// Street furniture: vending machines, bins, umbrella stand, postbox, curve mirror, poles & lamps, taxi
import * as THREE from 'three';
import { std, glow, glowMap, boxAt, mesh, canvasTex, noReflect, FONT_JP } from './utils.js';
import { vendingTex } from './tex-items.js';
import { trashLabelTex, taxiTex, kuushaTex } from './tex-signs.js';
import { acUnitTex } from './tex-misc.js';
import { closedUmbrella, tubeBetween } from './props.js';

export function createVending(color = '#c62d24') {
  const g = new THREE.Group();
  const { map, emissiveMap } = vendingTex(color);
  const body = std(new THREE.Color(color), 0.4, 0.3);
  const front = new THREE.MeshStandardMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.25 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.83, 0.75), [body, body, body, body, front, body]);
  m.position.y = 0.915; m.castShadow = true; g.add(m);
  m.userData.photo = { key: color === '#c62d24' ? 'vending_red' : 'vending_blue', vending: true };
  boxAt(g, 1.04, 0.06, 0.78, std(0x222222, 0.6), 0, 0, 0);
  // glass sheen over the display
  const sheen = mesh(new THREE.PlaneGeometry(0.92, 1.0), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.02, depthWrite: false, envMapIntensity: 2 }), 0, 1.33, 0.378, g);
  return g;
}

export function createTrashBins() {
  const g = new THREE.Group();
  const lab = trashLabelTex();
  const colors = [0xc0392b, 0x2471a3, 0x229954];
  colors.forEach((c, i) => {
    const x = (i - 1) * 0.5;
    boxAt(g, 0.46, 0.9, 0.42, std(0xe8e8e4, 0.5), x, 0, 0);
    boxAt(g, 0.48, 0.06, 0.44, std(c, 0.5), x, 0.9, 0);
    const t = lab.clone(); t.needsUpdate = true; t.repeat.set(1 / 3, 1); t.offset.set(i / 3, 0);
    mesh(new THREE.PlaneGeometry(0.44, 0.075), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), x, 0.78, 0.212, g);
    const hole = mesh(i === 0 ? new THREE.PlaneGeometry(0.22, 0.12) : new THREE.CircleGeometry(0.06, 16), std(0x080808, 1), x, 0.6, 0.212, g);
  });
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createUmbrellaStand() {
  const g = new THREE.Group();
  const steel = std(0xb9bec6, 0.3, 0.8);
  boxAt(g, 0.9, 0.05, 0.3, steel, 0, 0.0, 0);
  boxAt(g, 0.9, 0.04, 0.3, steel, 0, 0.5, 0);
  for (const x of [-0.43, 0.43]) for (const z of [-0.13, 0.13]) boxAt(g, 0.025, 0.55, 0.025, steel, x, 0, z);
  const cols = [[0xe9f1fa, true], [0xe9f1fa, true], [0x1a2440, false], [0xe9f1fa, true], [0x8a1c2a, false], [0xe9f1fa, true]];
  cols.forEach(([c, clear], i) => {
    const u = closedUmbrella(c, clear);
    u.position.set(-0.36 + i * 0.145, 0.02, (i % 2 ? 0.05 : -0.05));
    u.rotation.set((i % 2 ? 0.08 : -0.06), i * 1.3, (i % 3 - 1) * 0.06);
    g.add(u);
  });
  return g;
}

export function createPostbox() {
  const g = new THREE.Group();
  const red = std(0xc8161d, 0.35, 0.2);
  boxAt(g, 0.42, 0.95, 0.34, red, 0, 0.25, 0);
  const top = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.34, 20, 1, false, 0, Math.PI), red, 0, 1.2, 0, g);
  top.rotation.set(Math.PI / 2, 0, Math.PI / 2, 'ZYX');
  boxAt(g, 0.16, 0.25, 0.16, std(0x333333, 0.6), 0, 0, 0);
  mesh(new THREE.PlaneGeometry(0.28, 0.035), std(0x111111, 1), 0, 1.0, 0.171, g);
  const lab = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8161d'; c.font = `900 64px ${FONT_JP}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('〒', w / 2, 52);
    c.font = `900 24px Arial`; c.fillText('POST', w / 2, 104);
  });
  mesh(new THREE.PlaneGeometry(0.16, 0.16), std(0xffffff, 0.5, 0, { map: lab }), 0, 0.72, 0.171, g);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createCurveMirror() {
  const g = new THREE.Group();
  const orange = std(0xf07a12, 0.45, 0.2);
  mesh(new THREE.CylinderGeometry(0.04, 0.045, 3.0, 10), orange, 0, 1.5, 0, g);
  const head = new THREE.Group(); head.position.set(0, 3.1, 0.05); head.rotation.x = 0.25; g.add(head);
  mesh(new THREE.TorusGeometry(0.33, 0.035, 8, 32), orange, 0, 0, 0, head);
  const mirror = mesh(new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, 0.38), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.04, envMapIntensity: 1.6 }), 0, 0, -0.83, head);
  mirror.rotation.x = Math.PI / 2;
  mesh(new THREE.CircleGeometry(0.33, 24), std(0xf07a12, 0.5), 0, 0, -0.03, head).rotation.y = Math.PI;
  return g;
}

// Concrete utility pole; optional street lamp arm pointing toward +z (local)
export function createPole({ lamp = false, transformer = false, height = 9.5 } = {}) {
  const g = new THREE.Group();
  const conc = std(0x8d8f8c, 0.85);
  mesh(new THREE.CylinderGeometry(0.13, 0.19, height, 12), conc, 0, height / 2, 0, g);
  const stripe = canvasTex(64, 256, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#111' : '#f5c400'; c.save(); c.translate(0, i * 32); c.transform(1, -0.5, 0, 1, 0, 0); c.fillRect(-20, 0, w + 40, 32); c.restore(); } });
  mesh(new THREE.CylinderGeometry(0.195, 0.195, 1.8, 12, 1, true), std(0xffffff, 0.6, 0, { map: stripe }), 0, 0.9, 0, g);
  const steel = std(0x5a5d62, 0.5, 0.7);
  for (const y of [height - 0.4, height - 1.1]) {
    boxAt(g, 1.6, 0.08, 0.08, steel, 0, y, 0);
    for (const x of [-0.7, -0.25, 0.25, 0.7]) mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 8), std(0xe8e4dc, 0.4), x, y + 0.14, 0, g);
  }
  if (transformer) {
    mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 14), std(0x9ba0a6, 0.5, 0.4), 0.38, height - 2.4, 0, g);
    mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.7, 14), std(0x9ba0a6, 0.5, 0.4), -0.38, height - 2.4, 0, g);
  }
  // step bolts
  for (let y = 2.0; y < height - 2; y += 0.45) mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), steel, 0, y, 0, g).rotation.z = (Math.round(y / 0.45) % 2 ? 1 : -1) * Math.PI / 2;
  let light = null, head = null;
  if (lamp) {
    const arm = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 5.6, 0), new THREE.Vector3(0, 6.2, 0.5), new THREE.Vector3(0, 6.3, 1.4)]);
    mesh(new THREE.TubeGeometry(arm, 12, 0.035, 6), steel, 0, 0, 0, g);
    head = new THREE.Group(); head.position.set(0, 6.25, 1.5); g.add(head);
    boxAt(head, 0.22, 0.08, 0.55, std(0x3a3d42, 0.5, 0.5), 0, 0, 0);
    const lens = mesh(new THREE.PlaneGeometry(0.18, 0.45), glow(0xcfe2ff, 9), 0, -0.002, 0, head); lens.rotation.x = Math.PI / 2;
    light = new THREE.PointLight(0xa8c8ff, 38, 16, 1.7);
    light.position.set(0, -0.15, 0); head.add(light);
    // fake volumetric cone
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 2.4, 6.1, 24, 1, true), coneMaterial(0x9cc2ff));
    cone.position.set(0, -3.1, 0); head.add(cone); noReflect(cone);
  }
  g.userData = { light, head };
  return g;
}

export function coneMaterial(color, strength = 0.11) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uStrength: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vW;
      void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz);
        vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uTime; uniform float uStrength; varying vec3 vN; varying vec3 vV; varying float vY; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float edge = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.6);
        float fall = pow(clamp(vY, 0.0, 1.0), 1.4);
        float streak = 0.75 + 0.25*h(floor(vec2(vW.x*40.0 + vW.z*40.0, vW.y*3.0 + uTime*30.0)));
        gl_FragColor = vec4(uColor * edge * fall * uStrength * streak, 1.0);
      }`,
  });
}

export function createACUnit() {
  const g = new THREE.Group();
  const tex = acUnitTex();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.3), [std(0xd9dcd8, 0.6), std(0xd9dcd8, 0.6), std(0xd9dcd8, 0.6), std(0xd9dcd8, 0.6), std(0xffffff, 0.6, 0, { map: tex }), std(0xd9dcd8, 0.6)]);
  m.position.y = 0.3; g.add(m);
  return g;
}

// Black Japanese taxi with fender mirrors, roof lamp and 空車 sign. Faces +x.
export function createTaxi() {
  const g = new THREE.Group();
  const paint = std(0x0b0c10, 0.25, 0.7, { envMapIntensity: 1.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0f18, roughness: 0.05, metalness: 0.5, envMapIntensity: 1.6 });
  const chrome = std(0xd8dde3, 0.15, 1.0);
  boxAt(g, 4.5, 0.62, 1.68, paint, 0, 0.3, 0);
  boxAt(g, 4.56, 0.12, 1.7, chrome, 0, 0.26, 0);
  // cabin
  const cab = new THREE.Group(); cab.position.set(-0.25, 0.92, 0); g.add(cab);
  const cabGeo = new THREE.BoxGeometry(2.3, 0.56, 1.5);
  const cp = cabGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) { if (cp.getY(i) > 0) { cp.setX(i, cp.getX(i) * 0.82); cp.setZ(i, cp.getZ(i) * 0.9); } }
  cabGeo.computeVertexNormals();
  const cabin = new THREE.Mesh(cabGeo, glass); cabin.position.y = 0.28; cab.add(cabin);
  boxAt(cab, 1.9, 0.04, 1.36, paint, 0, 0.56, 0);
  for (const x of [-0.35, 0.4]) boxAt(cab, 0.07, 0.5, 1.48, paint, x, 0.03, 0);
  // roof lamp
  const lamp = boxAt(cab, 0.42, 0.2, 0.22, glowMap(taxiTex(), 1.8), 0.1, 0.6, 0);
  // 空車 sign behind windshield
  const ks = mesh(new THREE.PlaneGeometry(0.22, 0.11), glowMap(kuushaTex(), 2.2), 0.86, 0.12, 0.42, cab, Math.PI / 2);
  ks.rotation.z = 0;
  // fender mirrors
  for (const s of [-1, 1]) {
    tubeBetween(new THREE.Vector3(1.6, 0.92, s * 0.7), new THREE.Vector3(1.6, 1.08, s * 0.76), 0.008, chrome, g);
    boxAt(g, 0.05, 0.08, 0.1, paint, 1.6, 1.06, s * 0.78);
  }
  // wheels
  const wheels = [];
  for (const x of [-1.45, 1.4]) for (const s of [-1, 1]) {
    const w = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.2, 18), std(0x111111, 0.8), x, 0.31, s * 0.77, g);
    w.rotation.x = Math.PI / 2; wheels.push(w);
    mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.21, 12), chrome, x, 0.31, s * 0.77, g).rotation.x = Math.PI / 2;
  }
  // lights
  const head = [], tail = [];
  for (const s of [-1, 1]) {
    head.push(mesh(new THREE.BoxGeometry(0.04, 0.12, 0.3), glow(0xfff4dc, 8), 2.26, 0.68, s * 0.6, g));
    tail.push(mesh(new THREE.BoxGeometry(0.04, 0.14, 0.32), glow(0xff1a0a, 1.5), -2.26, 0.7, s * 0.6, g));
    mesh(new THREE.BoxGeometry(0.03, 0.08, 0.14), glow(0xffa020, 1.4), 2.26, 0.5, s * 0.72, g);
  }
  mesh(new THREE.BoxGeometry(0.03, 0.08, 1.0), glow(0x223355, 1.0), 2.27, 0.55, 0, g); // grille glint
  const spot = new THREE.SpotLight(0xfff0d8, 60, 30, 0.5, 0.5, 1.4);
  spot.position.set(2.3, 0.7, 0); spot.target.position.set(12, 0, 0);
  g.add(spot, spot.target);
  const tailLight = new THREE.PointLight(0xff2010, 2, 6, 2); tailLight.position.set(-2.6, 0.7, 0); g.add(tailLight);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  g.userData = { wheels, tail, tailLight, spot };
  return g;
}
