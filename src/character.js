// Character controller: procedural walk/run cycle, arm IK, umbrella handling, poses for NPC jobs
import * as THREE from 'three';
import { createHumanoid, deformSkirt } from './humanoid.js';
import { Umbrella } from './umbrella.js';
import { VRMRig } from './vrmrig.js';
import { clamp, lerp, smoothstep, damp, canvasTex, noReflect } from './utils.js';

const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3();
const Q1 = new THREE.Quaternion(), M1 = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);

// Two-bone arm IK solved in the chest's local space
export function solveArmIK(arm, target, pole) {
  const S = arm.shoulder.position;
  const L1 = arm.len1, L2 = arm.len2;
  const d = V1.subVectors(target, S);
  const dist = clamp(d.length(), 0.05, L1 + L2 - 1e-3);
  const dn = d.normalize();
  const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
  const A = Math.acos(cosA);
  const n = V2.crossVectors(dn, pole).normalize();
  if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
  const perp = V3.crossVectors(n, dn);
  const u = V4.copy(dn).multiplyScalar(Math.cos(A)).addScaledVector(perp, Math.sin(A)).normalize();
  const yAxis = u.clone().negate();
  const xAxis = n.clone();
  const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis);
  M1.makeBasis(xAxis, yAxis, zAxis);
  arm.shoulder.quaternion.setFromRotationMatrix(M1);
  // forearm direction in shoulder space
  const elbowPos = S.clone().addScaledVector(u, L1);
  const f = new THREE.Vector3().copy(target).sub(elbowPos).normalize();
  f.applyQuaternion(Q1.copy(arm.shoulder.quaternion).invert());
  arm.elbow.rotation.set(Math.atan2(-f.z, -f.y), 0, 0);
}

// planar leg IK (sagittal plane), target relative to the hip joint in hips space
function solveLegIK(leg, L, dz, dy) {
  const L1 = L.thigh, L2 = L.shin;
  const dist = clamp(Math.hypot(dz, dy), 0.1, L1 + L2 - 1e-3);
  const k = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
  const base = Math.atan2(dz, -dy);
  const th = base + Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  leg.hip.rotation.x = -th; leg.knee.rotation.x = k; leg.ankle.rotation.x = -(th - k) * 0.7;
}

let blobTex = null;
function blob() {
  blobTex ||= canvasTex(64, 64, (g) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  }, { srgb: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return noReflect(m);
}

export class Character {
  constructor(scene, opts = {}, { umbrella = null, mode = 'walk', vrm = null } = {}) {
    this.scene = scene;
    if (vrm) { this.vrm = vrm; this.h = new VRMRig(vrm); } // real rigged model
    else this.h = createHumanoid(opts);                      // procedural fallback
    scene.add(this.h.root);
    if (this.h.hair) scene.add(this.h.hair.mesh);
    this.attached = [];
    this.talkT = 0; this.openSmooth = 1;
    this.umbrella = umbrella ? new Umbrella(umbrella) : null;
    if (this.umbrella) { scene.add(this.umbrella.group); this.umbrella.group.traverse((o) => { if (o.isMesh) o.castShadow = true; }); }
    this.blob = blob(); scene.add(this.blob);
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.yawVel = 0; this.speed = 0; this.phase = Math.random() * 6; this.time = Math.random() * 10;
    this.mode = mode;
    this.open = 1; this.wantOpen = true;
    this.lookYaw = 0; this.lookPitch = 0; this.lookT = 0; this.lookTarget = 0;
    this.bow = 0; this.reach = 0;
    this.prevCos = 0;
    this.onStep = null;
    this.bike = null; // for riding
    this.props = {};
    this._prevYaw = 0;
  }

  attachToHand(side, obj, pos = [0, -0.07, 0.02], rot = [0, 0, 0], vrmPos = null) {
    (this._attachLog ||= []).push(['attachToHand', [side, obj, pos, rot, vrmPos]]);
    if (this.vrm) {
      if (vrmPos) pos = vrmPos; // follow the grip point in world space, oriented with the body
      this.scene.add(obj); this.attached.push({ side: side === 'L' ? 'left' : 'right', obj, pos: new THREE.Vector3(...pos), rot: new THREE.Euler(...rot) });
      if (side === 'L' && obj.userData.carry !== false) this.carry = true;
      return obj;
    }
    const hand = this.h.arms[side].hand;
    obj.position.set(...pos); obj.rotation.set(...rot); hand.add(obj);
    return obj;
  }

  // props held against the chest (e.g. a magazine); vrmPos is used on VRM bodies
  attachToChest(obj, pos, rot = [0, 0, 0], vrmPos = pos) {
    (this._attachLog ||= []).push(['attachToChest', [obj, pos, rot, vrmPos]]);
    obj.position.set(...(this.vrm ? vrmPos : pos)); obj.rotation.set(...rot);
    this.h.chest.add(obj);
    return obj;
  }

  // swap the procedural body for a loaded VRM, keeping state and re-attaching props
  swapBody(vrm) {
    this.scene.remove(this.h.root);
    if (this.h.hair) this.scene.remove(this.h.hair.mesh);
    for (const a of this.attached) this.scene.remove(a.obj);
    this.vrm = vrm; this.h = new VRMRig(vrm); this.scene.add(this.h.root);
    const log = this._attachLog || []; this._attachLog = []; this.attached = []; this.carry = false;
    for (const [fn, args] of log) this[fn](...args);
  }

  update(dt, t) {
    if (this.vrm) return this._updateVRM(dt);
    const h = this.h, L = h.L;
    this.time += dt;
    const root = h.root;
    // turning lean
    const yawRate = (this.yaw - this._prevYaw) / Math.max(dt, 1e-4); this._prevYaw = this.yaw;
    this.yawVel = damp(this.yawVel, clamp(yawRate, -6, 6), 8, dt);
    root.position.copy(this.pos);
    root.rotation.set(0, this.yaw, 0);
    const sp = this.mode === 'walk' ? this.speed : 0;
    const amp = clamp(sp / 1.25, 0, 1);
    const runK = clamp((sp - 1.7) / 1.9, 0, 1);
    const stride = lerp(1.3, 2.35, runK) * h.scale;
    this.phase += (sp / stride) * Math.PI * 2 * dt;
    const ph = this.phase;
    const breathe = Math.sin(this.time * 2.1);

    // ---------- legs ----------
    const legPose = (p) => {
      const thW = 0.42 * Math.sin(p), knW = 0.06 + 0.8 * Math.pow(Math.max(0, Math.cos(p + 0.45)), 2);
      const thR = 0.66 * Math.sin(p) + 0.12, knR = 0.28 + 1.55 * Math.pow(Math.max(0, Math.cos(p + 0.7)), 1.4);
      const th = lerp(thW, thR, runK) * amp, kn = lerp(knW, knR, runK) * amp + (1 - amp) * 0.03;
      return [th, kn];
    };
    let hipY = L.hipY;
    if (this.mode === 'ride' && this.bike) {
      // pedalling: legs follow the cranks
      const crank = this.bike.userData.crank.rotation.z;
      h.hips.position.set(0, L.hipY, 0);
      for (const [key, off] of [['R', 0], ['L', Math.PI]]) {
        const a = crank + off;
        // pedal in bike space (bike +x is forward) -> character space (+z forward)
        const pz = Math.sin(a) * 0.17 + 0.2, py = -Math.cos(a) * 0.17 - 0.62;
        solveLegIK(h.legs[key], L, pz, py);
      }
      h.hips.rotation.set(0.15, 0, 0);
    } else {
      const [thL, knL] = legPose(ph), [thR, knR] = legPose(ph + Math.PI);
      const legs = [[h.legs.L, thL, knL, ph], [h.legs.R, thR, knR, ph + Math.PI]];
      let ext = 0;
      for (const [leg, th, kn, p] of legs) {
        leg.hip.rotation.set(-th, 0, 0);
        leg.knee.rotation.x = kn;
        leg.ankle.rotation.x = -(th - kn) * 0.82 + 0.28 * amp * Math.max(0, -Math.sin(p)) * Math.max(0, Math.cos(p + 2.2));
        ext = Math.max(ext, L.thigh * Math.cos(th) + L.shin * Math.cos(th - kn) + L.ankle);
      }
      hipY = ext + runK * amp * 0.03 * Math.max(0, Math.sin(2 * ph - 0.6)) - (1 - amp) * 0.004 * (breathe + 1);
      h.hips.position.y = hipY;
      h.hips.rotation.set(0.05 * runK * amp, -0.12 * Math.sin(ph) * amp * (1 - 0.3 * runK), 0.035 * Math.sin(ph) * amp);
      if (h.skirt) deformSkirt(h.skirt, thL, thR, 0.05 * amp + 0.12 * runK * amp + 0.03 * Math.abs(this.yawVel) * amp);
      // step events
      const c = Math.cos(ph);
      if (amp > 0.3) {
        if (this.prevCos > 0 && c <= 0 && this.onStep) this.onStep(h.legs.L.ankle, runK);
        if (this.prevCos < 0 && c >= 0 && this.onStep) this.onStep(h.legs.R.ankle, runK);
      }
      this.prevCos = c;
    }

    // ---------- torso & head ----------
    const lean = lerp(0.04, 0.22, runK) * amp;
    h.spine.rotation.set(lean + this.bow + (this.mode === 'ride' ? 0.25 : 0), 0.17 * Math.sin(ph) * amp, -0.02 * Math.sin(ph) * amp);
    root.rotation.z = clamp(-this.yawVel * sp * 0.025, -0.18, 0.18);
    h.chest.scale.set(1 + breathe * 0.008, 1 + breathe * 0.01, 1 + breathe * 0.012);
    // idle glances
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookT = 2 + Math.random() * 4; this.lookTarget = (Math.random() - 0.5) * (amp > 0.5 ? 0.4 : 1.1); }
    this.lookYaw = damp(this.lookYaw, this.lookTarget, 3, dt);
    let headPitch = -lean * 0.65 - (this.mode === 'ride' ? 0.2 : 0);
    if (this.mode === 'read' || this.mode === 'phone') headPitch += 0.42;
    if (this.mode === 'clerk') headPitch += 0.08;
    h.neck.rotation.set(headPitch * 0.5, 0, 0);
    h.head.rotation.set(headPitch * 0.5 + this.lookPitch, -(h.hips.rotation.y + h.spine.rotation.y) * 0.85 + (this.mode === 'walk' || this.mode === 'idle' ? this.lookYaw : this.lookYaw * 0.3), Math.sin(this.time * 0.7) * 0.02);

    // ---------- arms ----------
    const armA = lerp(0.32, 0.9, runK) * amp;
    const freeArm = (key, sign) => {
      const a = h.arms[key], s = key === 'L' ? 1 : -1;
      const carry = key === 'L' && h.carry ? 0.5 : 1; // a bag in hand damps the swing
      a.shoulder.quaternion.identity();
      a.shoulder.rotation.set(sign * armA * carry * Math.sin(ph) - 0.12 * runK * carry, 0, s * (0.09 + (carry < 1 ? 0.06 : 0) + 0.1 * runK + 0.015 * breathe));
      a.elbow.rotation.set(-(0.18 + lerp(0.15, 1.35, runK) * amp * carry + 0.25 * amp * carry * Math.max(0, -sign * Math.sin(ph))), 0, 0);
    };
    root.updateMatrixWorld(true);
    const o = this.open, os = smoothstep(0.15, 0.85, o);
    switch (this.mode) {
      case 'read':
        solveArmIK(h.arms.L, V1.set(0.07, -0.02, 0.26).clone(), new THREE.Vector3(1, -1, -0.4));
        solveArmIK(h.arms.R, V1.set(-0.07, -0.02, 0.26).clone(), new THREE.Vector3(-1, -1, -0.4));
        break;
      case 'phone':
        solveArmIK(h.arms.L, V1.set(0.03, 0.04, 0.24).clone(), new THREE.Vector3(1, -1, -0.3));
        break;
      case 'clerk':
        solveArmIK(h.arms.L, V1.set(0.16, -0.24 + this.bow * 0.2, 0.3).clone(), new THREE.Vector3(1, -0.5, -0.5));
        solveArmIK(h.arms.R, V1.set(-0.16, -0.24 + this.bow * 0.2, 0.3).clone(), new THREE.Vector3(-1, -0.5, -0.5));
        break;
      case 'atm': {
        const r = this.reach;
        solveArmIK(h.arms.R, V1.set(lerp(-0.18, -0.04, r), lerp(-0.2, 0.08, r), lerp(0.18, 0.4, r)).clone(), new THREE.Vector3(-1, -1, -0.3));
        freeArm('L', 1);
        break;
      }
      case 'ride': {
        const grip = this.bike.localToWorld(V2.set(0.28, 1.02, -0.3).clone());
        solveArmIK(h.arms.L, h.chest.worldToLocal(grip.clone()), new THREE.Vector3(1, -0.6, -0.4));
        break;
      }
      default:
        freeArm('L', 1);
    }
    if (this.umbrella) {
      const target = new THREE.Vector3().lerpVectors(new THREE.Vector3(-0.2, -0.4, 0.07), new THREE.Vector3(-0.115, 0.05 + 0.008 * Math.sin(2 * ph), 0.165), os);
      if (this.mode === 'ride') target.set(-0.1, 0.1, 0.28);
      solveArmIK(h.arms.R, target, new THREE.Vector3(-1, lerp(-0.2, -0.8, os), lerp(-1, -0.3, os)));
    } else if (this.mode === 'walk' || this.mode === 'idle' || this.mode === 'phone') freeArm('R', -1);
    root.updateMatrixWorld(true);

    if (this.umbrella) {
      this.open = damp(this.open, this.wantOpen ? 1 : 0, 4.5, dt);
      this._placeUmbrella(h.arms.R.hand.localToWorld(V1.set(0, -0.04, 0.01)).clone(), runK, amp, os, 1.96 * h.scale);
    }

    // ---------- hair & shadow ----------
    if (h.hair) {
      h.hair.wind.set(0.4, 0, 0.2);
      h.hair.update(dt, this.time);
    }
    this.blob.position.set(this.pos.x, 0.012, this.pos.z);
    this.blob.scale.setScalar(h.scale * (1 - 0.15 * (hipY - L.hipY) / 0.05));
  }

  // shared by both rigs: orient the umbrella from the grip toward a point above the head
  _placeUmbrella(grip, runK, amp, os, topH) {
    const u = this.umbrella;
    u.update(this.open);
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const top = this.pos.clone().add(V3.set(0, topH, 0)).addScaledVector(fwd, 0.16 * runK * amp + 0.05 * amp).addScaledVector(right, 0.07);
    if (this.mode === 'ride') top.addScaledVector(fwd, 0.1);
    const openDir = top.sub(grip).normalize();
    const closedDir = fwd.clone().multiplyScalar(0.42).add(V4.set(0, -1, 0)).normalize();
    const dir = closedDir.lerp(openDir, os).normalize();
    dir.x += Math.sin(this.time * 1.3) * 0.015 * (0.4 + amp); dir.z += Math.cos(this.time * 1.1) * 0.015 * (0.4 + amp); dir.normalize();
    const xd = this.pos.clone().setY(grip.y).sub(grip); xd.addScaledVector(dir, -xd.dot(dir));
    if (xd.lengthSq() < 1e-6) xd.set(1, 0, 0);
    xd.normalize();
    const zd = new THREE.Vector3().crossVectors(xd, dir);
    M1.makeBasis(xd, dir, zd);
    u.group.quaternion.setFromRotationMatrix(M1);
    u.group.position.copy(grip);
  }

  _updateVRM(dt) {
    this.time += dt;
    this.talkT = Math.max(0, this.talkT - dt);
    const yawRate = (this.yaw - this._prevYaw) / Math.max(dt, 1e-4); this._prevYaw = this.yaw;
    this.yawVel = damp(this.yawVel, clamp(yawRate, -6, 6), 8, dt);
    const sp = this.mode === 'walk' ? this.speed : 0;
    const runK0 = clamp((sp - 1.7) / 1.9, 0, 1);
    this.phase += (sp / (lerp(1.3, 2.35, runK0) * this.h.scale)) * Math.PI * 2 * dt;
    if (this.umbrella) this.open = damp(this.open, this.wantOpen ? 1 : 0, 4.5, dt);
    this.openSmooth = smoothstep(0.15, 0.85, this.open);
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookT = 2 + Math.random() * 4; this.lookTarget = (Math.random() - 0.5) * (sp > 0.6 ? 0.4 : 1.0); }
    this.lookYaw = damp(this.lookYaw, this.lookTarget, 3, dt);
    const { runK, amp, hipLift } = this.h.animate(this, dt, this.lod || 0);
    if (this.umbrella) this._placeUmbrella(this.h.grip('right'), runK, amp, this.openSmooth, this.h.height + 0.42);
    const yq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    for (const a of this.attached) {
      a.obj.position.copy(this.h.grip(a.side)).add(a.pos.clone().applyQuaternion(yq));
      a.obj.quaternion.copy(yq).multiply(new THREE.Quaternion().setFromEuler(a.rot));
    }
    this.blob.position.set(this.pos.x, 0.012, this.pos.z);
    this.blob.scale.setScalar(this.h.scale * (1 - 0.15 * hipLift / 0.05));
  }

  // world positions of rib tips (for drips)
  dripPoints(out) {
    if (!this.umbrella || this.open < 0.8) return 0;
    const g = this.umbrella.group;
    let n = 0;
    for (const tip of this.umbrella.tips) { out[n] = (out[n] || new THREE.Vector3()).copy(tip).applyMatrix4(g.matrixWorld); n++; }
    return n;
  }

  get umbrellaTop() {
    if (!this.umbrella || this.open < 0.6) return null;
    return V1.set(0, this.umbrella.shaftLen, 0).applyMatrix4(this.umbrella.group.matrixWorld);
  }
}
