// Input, third-person camera with collision, player movement & world collision
import * as THREE from 'three';
import { colliders, circles, clamp, damp, angleDamp, lerp } from './utils.js';

export function collide(pos, r) {
  for (let it = 0; it < 2; it++) {
    for (const b of colliders) {
      if (!b.walk) continue;
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r; }
      else {
        const l = pos.x - b.minX, rr = b.maxX - pos.x, t = pos.z - b.minZ, bt = b.maxZ - pos.z, m = Math.min(l, rr, t, bt);
        if (m === l) pos.x = b.minX - r; else if (m === rr) pos.x = b.maxX + r; else if (m === t) pos.z = b.minZ - r; else pos.z = b.maxZ + r;
      }
    }
    for (const c of circles) {
      const dx = pos.x - c.x, dz = pos.z - c.z, rr = r + c.r, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2); pos.x = c.x + (dx / d) * rr; pos.z = c.z + (dz / d) * rr; }
    }
  }
}

// ray (origin o, dir d normalized) vs camera colliders: nearest hit distance
function rayHit(o, d, maxT) {
  let best = maxT;
  for (const b of colliders) {
    if (!b.cam) continue;
    let t0 = 0, t1 = best;
    const mins = [b.minX, b.minY, b.minZ], maxs = [b.maxX, b.maxY, b.maxZ], oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
    let ok = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dd[k]) < 1e-8) { if (oo[k] < mins[k] || oo[k] > maxs[k]) { ok = false; break; } continue; }
      let a = (mins[k] - oo[k]) / dd[k], c = (maxs[k] - oo[k]) / dd[k];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
      if (t0 > t1) { ok = false; break; }
    }
    if (ok && t0 > 0.0 && t0 < best) best = t0;
  }
  return best;
}

export class PlayerController {
  constructor(char, camera, dom) {
    this.char = char; this.camera = camera; this.dom = dom;
    this.keys = new Set();
    this.camYaw = Math.PI; this.camPitch = 0.28; this.dist = 4.6; this.targetDist = 4.6;
    this.target = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.lastDrag = -10; this.time = 0;
    this.joy = { x: 0, y: 0, active: false };
    this.touchRun = false;
    this.enabled = false;
    this._bind();
  }
  _bind() {
    addEventListener('keydown', (e) => { this.keys.add(e.code); if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    this.dom.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; this.dom.setPointerCapture(e.pointerId); });
    this.dom.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      this.camYaw -= dx * 0.0055; this.camPitch = clamp(this.camPitch + dy * 0.004, -0.15, 1.25);
      this.lastDrag = this.time;
    });
    const end = (e) => { if (drag && drag.id === e.pointerId) drag = null; };
    this.dom.addEventListener('pointerup', end); this.dom.addEventListener('pointercancel', end);
    this.dom.addEventListener('wheel', (e) => { this.targetDist = clamp(this.targetDist * (1 + e.deltaY * 0.0012), 1.6, 10); e.preventDefault(); }, { passive: false });
    // touch joystick
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    if (joy) {
      const move = (e) => {
        const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let x = (e.clientX - cx) / (r.width / 2), y = (e.clientY - cy) / (r.height / 2);
        const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
        this.joy.x = x; this.joy.y = y; knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`;
      };
      joy.addEventListener('pointerdown', (e) => { this.joy.active = true; joy.setPointerCapture(e.pointerId); move(e); e.stopPropagation(); });
      joy.addEventListener('pointermove', (e) => { if (this.joy.active) move(e); });
      const stop = () => { this.joy.active = false; this.joy.x = this.joy.y = 0; knob.style.transform = ''; };
      joy.addEventListener('pointerup', stop); joy.addEventListener('pointercancel', stop);
      const run = document.getElementById('runBtn');
      run.addEventListener('pointerdown', (e) => { this.touchRun = !this.touchRun; run.classList.toggle('on', this.touchRun); e.stopPropagation(); });
    }
  }

  get place() {
    const p = this.char.pos;
    if (p.x > -7 && p.x < 7 && p.z < -6.45 && p.z > -16) return '店內';
    if (p.x > -7.4 && p.x < 7.4 && p.z > -6.45 && p.z < -5.05) return '屋簷下';
    return '街道';
  }

  update(dt) {
    this.time += dt;
    const c = this.char;
    let ix = 0, iz = 0;
    if (this.enabled) {
      const k = this.keys;
      if (k.has('KeyW') || k.has('ArrowUp')) iz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) iz -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
      if (this.joy.active) { ix += this.joy.x; iz -= this.joy.y; }
    }
    const il = Math.hypot(ix, iz);
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchRun;
    const inside = this.place === '店內';
    const maxSp = running ? (inside ? 2.6 : 3.7) : 1.45;
    let targetSp = 0;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    if (il > 0.05) {
      ix /= Math.max(1, il); iz /= Math.max(1, il);
      const dx = fx * iz + rx * ix, dz = fz * iz + rz * ix;
      const targetYaw = Math.atan2(dx, dz);
      c.yaw = angleDamp(c.yaw, targetYaw, running ? 9 : 11, dt);
      targetSp = maxSp * Math.min(1, il);
    }
    c.speed = damp(c.speed, targetSp, targetSp > c.speed ? 5.5 : 7, dt);
    if (c.speed < 0.02) c.speed = 0;
    // move along facing (slightly blended toward input for responsiveness)
    const prev = c.pos.clone();
    c.pos.x += Math.sin(c.yaw) * c.speed * dt;
    c.pos.z += Math.cos(c.yaw) * c.speed * dt;
    collide(c.pos, 0.27);
    // if blocked, reduce speed so the run cycle doesn't moonwalk
    const actual = c.pos.distanceTo(prev) / Math.max(dt, 1e-4);
    if (c.speed > 0.3 && actual < c.speed * 0.4) c.speed = damp(c.speed, actual, 6, dt);
    c.wantOpen = !inside;

    // ---------- camera ----------
    if (c.speed > 1.0 && this.time - this.lastDrag > 1.6) {
      this.camYaw = angleDamp(this.camYaw, c.yaw + Math.PI, 0.5 * (c.speed / 3.7), dt);
    }
    this.dist = damp(this.dist, this.targetDist, 6, dt);
    const tgt = new THREE.Vector3(c.pos.x, c.pos.y + 1.32, c.pos.z);
    this.target.lerp(tgt, 1 - Math.exp(-10 * dt));
    if (this.target.lengthSq() === 0) this.target.copy(tgt);
    const cp = Math.cos(this.camPitch);
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
    let d = this.dist;
    if (inside) d = Math.min(d, 3.4);
    const hit = rayHit(this.target, dir, d + 0.25);
    d = Math.max(0.6, Math.min(d, hit - 0.25));
    const pos = this.target.clone().addScaledVector(dir, d);
    pos.y = Math.max(0.25, pos.y);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target.x, this.target.y + 0.05, this.target.z);
  }
}
