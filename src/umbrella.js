// Umbrella with a domed, rib-scalloped canopy that folds open/closed.
// Origin = grip point on the J handle; the shaft runs along +Y.
import * as THREE from 'three';
import { std, mesh } from './utils.js';
import { dropletsTex } from './tex-misc.js';

let _drops = null;
const dropsTex = () => (_drops ||= (() => { const t = dropletsTex(320, 7); t.repeat.set(3, 1); return t; })());

export class Umbrella {
  constructor({ kind = 'clear', color = 0x1a1a1a, radius = 0.5 } = {}) {
    this.group = new THREE.Group();
    this.clear = kind === 'clear';
    this.ribs = 8; this.seg = 8; this.rings = 8;
    this.len = radius * 1.15;     // rib length
    this.shaftLen = 0.82;
    this.open = -1;
    const N = this.ribs * this.seg;
    const vCount = (N + 1) * (this.rings + 1);
    const pos = new Float32Array(vCount * 3), uv = new Float32Array(vCount * 2), idx = [];
    for (let j = 0; j <= this.rings; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      uv[k * 2] = (i / N) * 3; uv[k * 2 + 1] = j / this.rings;
      if (i < N && j < this.rings) { const a = k, b = k + 1, c = k + N + 1, d = k + N + 2; idx.push(a, c, b, b, c, d); }
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geo.setIndex(idx);

    const canopyMat = this.clear
      ? new THREE.MeshPhysicalMaterial({ color: 0xeef5ff, transparent: true, opacity: 0.3, roughness: 0.06, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.4, clearcoat: 1, clearcoatRoughness: 0.05 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide });
    this.canopy = new THREE.Mesh(this.geo, canopyMat);
    this.canopy.renderOrder = 2; this.canopy.frustumCulled = false;
    this.group.add(this.canopy);
    if (this.clear) {
      const dm = new THREE.MeshStandardMaterial({ map: dropsTex(), transparent: true, roughness: 0.04, side: THREE.DoubleSide, depthWrite: false, opacity: 0.8, envMapIntensity: 2 });
      const drops = new THREE.Mesh(this.geo, dm); drops.renderOrder = 3; drops.frustumCulled = false;
      this.group.add(drops);
    }
    this.ribMat = this.clear ? std(0xf3f5f7, 0.35, 0.2) : std(0x1c1c1c, 0.4, 0.6);
    this.rimMat = this.clear ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.9 }) : this.ribMat;
    this.ribMeshes = [];
    for (let r = 0; r < this.ribs; r++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), this.ribMat); m.frustumCulled = false; this.group.add(m); this.ribMeshes.push(m); }
    this.rim = new THREE.Mesh(new THREE.BufferGeometry(), this.rimMat); this.rim.frustumCulled = false; this.group.add(this.rim);
    this.tipBeads = [];
    for (let r = 0; r < this.ribs; r++) this.tipBeads.push(mesh(new THREE.SphereGeometry(0.008, 6, 4), this.ribMat, 0, 0, 0, this.group));
    // stretchers (thin) as lines
    this.linePos = new Float32Array(this.ribs * 6);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    this.lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: this.clear ? 0xdfe6ee : 0x222222, transparent: true, opacity: 0.55 }));
    this.lines.frustumCulled = false; this.group.add(this.lines);

    // shaft, top cap, handle
    const shaftMat = std(this.clear ? 0xf0f2f4 : 0x2a2a2a, 0.3, this.clear ? 0.2 : 0.7);
    mesh(new THREE.CylinderGeometry(0.0065, 0.0065, this.shaftLen + 0.04, 8), shaftMat, 0, this.shaftLen / 2, 0, this.group);
    mesh(new THREE.CylinderGeometry(0.003, 0.008, 0.07, 8), shaftMat, 0, this.shaftLen + 0.05, 0, this.group);
    mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.018, 14), this.clear ? std(0xffffff, 0.35) : shaftMat, 0, this.shaftLen + 0.005, 0, this.group);
    const handleMat = this.clear ? new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, roughness: 0.25, transmission: 0, transparent: true, opacity: 0.92, clearcoat: 0.6 }) : std(0x3a2416, 0.35);
    const path = new THREE.CurvePath();
    path.add(new THREE.LineCurve3(new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0, -0.08, 0)));
    path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.08, 0), new THREE.Vector3(0, -0.165, 0), new THREE.Vector3(0.05, -0.155, 0)));
    path.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.05, -0.155, 0), new THREE.Vector3(0.088, -0.145, 0), new THREE.Vector3(0.082, -0.1, 0)));
    mesh(new THREE.TubeGeometry(path, 24, 0.0135, 10), handleMat, 0, 0, 0, this.group);
    this.runner = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.045, 10), this.clear ? std(0xffffff, 0.4) : shaftMat, 0, 0.5, 0, this.group);
    this.tips = Array.from({ length: this.ribs }, () => new THREE.Vector3());
    this.prof = Array.from({ length: this.rings + 1 }, () => ({ h: 0, y: 0 }));
    this.update(1);
  }

  // rib profile: angle from the downward shaft axis eases from near-horizontal at the
  // ferrule to steeper at the rim, giving the classic dome.
  _profile(o) {
    const t0 = THREE.MathUtils.lerp(0.05, 1.52, o), t1 = THREE.MathUtils.lerp(0.035, 0.78, o);
    const ds = this.len / this.rings;
    let h = 0, y = this.shaftLen;
    for (let j = 0; j <= this.rings; j++) {
      this.prof[j].h = h; this.prof[j].y = y;
      const th = THREE.MathUtils.lerp(t0, t1, Math.pow((j + 0.5) / this.rings, 1.3));
      h += Math.sin(th) * ds; y -= Math.cos(th) * ds;
    }
  }

  _pt(j, phi, out) {
    const o = this.open, t = j / this.rings, p = this.prof[j];
    const between = 1 - Math.abs(Math.cos((this.ribs / 2) * phi)); // 0 on ribs, 1 mid-panel
    const fold = 1 + (1 - o) * 1.1 * (0.6 - between);              // folded fabric bulges when closed
    const h = p.h * (1 - 0.055 * o * between * t) * Math.max(0.2, fold);
    out.set(Math.cos(phi) * h, p.y + 0.02 * o * between * t * t, Math.sin(phi) * h);
    return out;
  }

  update(open) {
    if (Math.abs(open - this.open) < 1e-4) return;
    this.open = open;
    this._profile(open);
    const N = this.ribs * this.seg, pos = this.geo.attributes.position.array, v = new THREE.Vector3();
    for (let j = 0; j <= this.rings; j++) for (let i = 0; i <= N; i++) {
      this._pt(j, (i / N) * Math.PI * 2, v);
      const k = (j * (N + 1) + i) * 3;
      pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    // rib tubes, rim tape, tip beads
    for (let r = 0; r < this.ribs; r++) {
      const phi = (r / this.ribs) * Math.PI * 2, pts = [];
      for (let j = 0; j <= this.rings; j++) pts.push(this._pt(j, phi, new THREE.Vector3()).multiplyScalar(0.995).setY(this.prof[j].y - 0.004));
      this.ribMeshes[r].geometry.dispose();
      this.ribMeshes[r].geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0032, 5);
      this.tips[r].copy(pts[pts.length - 1]);
      this.tipBeads[r].position.copy(this.tips[r]);
    }
    const rimPts = [];
    for (let i = 0; i < N; i++) rimPts.push(this._pt(this.rings, (i / N) * Math.PI * 2, new THREE.Vector3()));
    this.rim.geometry.dispose();
    this.rim.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), N, this.clear ? 0.0055 : 0.003, 5, true);
    // runner slides along the shaft; stretchers go from runner to mid-rib
    const runnerY = THREE.MathUtils.lerp(0.3, 0.6, open);
    this.runner.position.y = runnerY;
    const L = this.linePos, a = new THREE.Vector3();
    for (let r = 0; r < this.ribs; r++) {
      this._pt(Math.round(this.rings * 0.45), (r / this.ribs) * Math.PI * 2, a);
      L.set([0, runnerY, 0, a.x * 0.98, a.y - 0.005, a.z * 0.98], r * 6);
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}
