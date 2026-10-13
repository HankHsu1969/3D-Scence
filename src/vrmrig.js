// VRM characters (@pixiv/three-vrm v3): loading, and a procedural animator that drives the
// normalized humanoid bones (walk/run cycle, two-bone arm IK, pedalling, idle life, blinks).
// Hair, skirt and accessories swing through the model's own spring bones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { clamp, lerp, damp } from './utils.js';

const fileCache = new Map();
export async function loadVRM(url, { outline = true } = {}) {
  if (!fileCache.has(url)) fileCache.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.arrayBuffer(); }));
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.parseAsync(await fileCache.get(url), '');
  const vrm = gltf.userData.vrm;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm); // VRM 0.x faces -Z; turn it to face +Z like VRM 1.0
  vrm.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!outline && m.isMToonMaterial && m.outlineWidthMode !== undefined) m.outlineWidthMode = 'none';
    }
  });
  return vrm;
}

const V = () => new THREE.Vector3();
const Q = () => new THREE.Quaternion();
const _a = V(), _b = V(), _c = V(), _d = V(), _e = V(), _t = V(), _p = V();
const _q1 = Q(), _q2 = Q(), _q3 = Q();

// rotate `bone` (in world space) so that direction `from` becomes `to`
function aimBone(bone, from, to) {
  _q1.setFromUnitVectors(from, to);
  bone.getWorldQuaternion(_q2);
  bone.parent.getWorldQuaternion(_q3);
  bone.quaternion.copy(_q3.invert().multiply(_q1.multiply(_q2)));
  bone.updateMatrixWorld(true);
}

// generic two-bone IK in world space with a pole hint for the elbow
export function twoBoneIK(upper, lower, end, target, pole) {
  const a = upper.getWorldPosition(_a), b = lower.getWorldPosition(_b), c = end.getWorldPosition(_c);
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = _d.subVectors(target, a);
  const dist = clamp(d.length(), 0.02, l1 + l2 - 1e-4);
  d.normalize();
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const A = Math.acos(cosA);
  const pd = _p.subVectors(pole, a);
  pd.addScaledVector(d, -pd.dot(d));
  if (pd.lengthSq() < 1e-8) pd.set(0, -1, 0);
  pd.normalize();
  const elbow = _e.copy(a).addScaledVector(d, Math.cos(A) * l1).addScaledVector(pd, Math.sin(A) * l1);
  aimBone(upper, _t.subVectors(b, a).normalize(), V().subVectors(elbow, a).normalize());
  const b2 = lower.getWorldPosition(V()), c2 = end.getWorldPosition(V());
  const goal = V().copy(a).addScaledVector(d, dist);
  aimBone(lower, c2.sub(b2).normalize(), goal.sub(b2).normalize());
}

const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const SEGS = ['Proximal', 'Intermediate', 'Distal'];

export class VRMRig {
  constructor(vrm) {
    this.vrm = vrm;
    this.root = new THREE.Group();
    this.root.add(vrm.scene);
    const hum = vrm.humanoid;
    this.n = (name) => hum.getNormalizedBoneNode(name);
    hum.resetNormalizedPose();
    vrm.scene.updateMatrixWorld(true);
    const wp = (name) => this.n(name).getWorldPosition(V());
    this.hipsRest = this.n('hips').position.clone();
    const lu = wp('leftUpperLeg'), ll = wp('leftLowerLeg'), lf = wp('leftFoot');
    this.thigh = lu.distanceTo(ll); this.shin = ll.distanceTo(lf);
    this.armLen = wp('leftUpperArm').distanceTo(wp('leftLowerArm')) + wp('leftLowerArm').distanceTo(wp('leftHand'));
    this.height = wp('head').y + 0.12;
    // facade expected by the rest of the game
    this.L = { hipY: wp('hips').y, thigh: this.thigh, shin: this.shin };
    this.scale = this.height / 1.55;
    this.head = this.n('head');
    this.chest = this.n('upperChest') || this.n('chest');
    this.arms = { L: { hand: this.n('leftHand') }, R: { hand: this.n('rightHand') } };
    this.hair = null; this.skirt = null;
    this.lookObj = new THREE.Object3D();
    if (vrm.lookAt) { vrm.lookAt.target = this.lookObj; vrm.lookAt.autoUpdate = true; }
    // VRM 0.x rigs are turned 180° by rotateVRM0, so their normalized bone frames have X and Z
    // flipped relative to the character; f corrects the sign of pitch/roll rotations
    this.f = vrm.meta?.metaVersion === '0' ? -1 : 1;
    this.blinkT = 1 + Math.random() * 3; this.blink = 0;
    this.prevCos = 0;
    this.springsReady = false;
  }

  // grip point between the wrist and the base of the middle finger
  grip(side, out = V()) {
    const h = this.n(`${side}Hand`).getWorldPosition(out);
    const m = this.n(`${side}MiddleProximal`);
    if (m) h.lerp(m.getWorldPosition(V()), 0.7);
    return h;
  }

  curl(side, amount) {
    const s = (side === 'left' ? -1 : 1) * this.f;
    for (const f of FINGERS) SEGS.forEach((seg, i) => {
      const b = this.n(`${side}${f}${seg}`);
      if (b) b.rotation.z = s * amount * [1.0, 1.15, 0.8][i];
    });
    const th = this.n(`${side}ThumbProximal`) || this.n(`${side}ThumbMetacarpal`);
    if (th) th.rotation.y = -s * amount * 0.4;
  }

  _expressions(c, dt) {
    const em = this.vrm.expressionManager;
    if (!em) return;
    this.blinkT -= dt;
    if (this.blinkT < 0) { this.blinkT = 2.5 + Math.random() * 3.5; this.blink = 0.001; }
    if (this.blink > 0) { this.blink += dt / 0.16; if (this.blink >= 1) this.blink = 0; }
    em.setValue('blink', this.blink > 0 ? Math.sin(this.blink * Math.PI) : 0);
    const talk = (c.talkT || 0) > 0 ? 0.35 + 0.35 * Math.abs(Math.sin(c.time * 14)) : 0;
    em.setValue('aa', talk);
    if (c.mood) em.setValue(c.mood, c.moodAmount ?? 0.3);
  }

  _refresh() {
    this.root.updateMatrix(); this.root.updateWorldMatrix(true, false);
    this.vrm.scene.updateWorldMatrix(false, false);
    this.vrm.humanoid.normalizedHumanBonesRoot.updateMatrixWorld(true);
  }

  animate(c, dt, lod = 0) {
    const n = this.n, root = this.root, vrm = this.vrm, f = this.f;
    vrm.humanoid.resetNormalizedPose();
    const ph = c.phase;
    const sp = c.mode === 'walk' ? c.speed : 0;
    const amp = clamp(sp / 1.25, 0, 1);
    const runK = clamp((sp - 1.7) / 1.9, 0, 1);
    const breathe = Math.sin(c.time * 2.1);
    root.position.copy(c.pos);
    root.rotation.set(0, c.yaw, clamp(-c.yawVel * sp * 0.025, -0.18, 0.18));

    // ---------- legs ----------
    const hips = n('hips');
    let ext = this.thigh + this.shin;
    if (c.mode === 'ride' && c.bike) {
      const crank = c.bike.userData.crank.rotation.z;
      for (const [side, off] of [['right', 0], ['left', Math.PI]]) {
        const a = crank + off;
        const dz = Math.sin(a) * 0.17 + 0.2, dy = -Math.cos(a) * 0.17 - (this.L.hipY - 0.33);
        const L1 = this.thigh, L2 = this.shin;
        const dist = clamp(Math.hypot(dz, dy), 0.1, L1 + L2 - 1e-3);
        const k = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
        const th = Math.atan2(dz, -dy) + Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
        n(`${side}UpperLeg`).rotation.x = -th * f; n(`${side}LowerLeg`).rotation.x = k * f; n(`${side}Foot`).rotation.x = -(th - k) * 0.7 * f;
      }
      hips.rotation.x = 0.12 * f;
    } else {
      const legPose = (p) => {
        const thW = 0.42 * Math.sin(p), knW = 0.06 + 0.8 * Math.pow(Math.max(0, Math.cos(p + 0.45)), 2);
        const thR = 0.66 * Math.sin(p) + 0.12, knR = 0.28 + 1.55 * Math.pow(Math.max(0, Math.cos(p + 0.7)), 1.4);
        return [lerp(thW, thR, runK) * amp, lerp(knW, knR, runK) * amp + (1 - amp) * 0.03];
      };
      ext = 0;
      const legs = [['left', ...legPose(ph), ph], ['right', ...legPose(ph + Math.PI), ph + Math.PI]];
      for (const [side, th, kn, p] of legs) {
        n(`${side}UpperLeg`).rotation.x = -th * f;
        n(`${side}LowerLeg`).rotation.x = kn * f;
        n(`${side}Foot`).rotation.x = (-(th - kn) * 0.82 + 0.28 * amp * Math.max(0, -Math.sin(p)) * Math.max(0, Math.cos(p + 2.2))) * f;
        ext = Math.max(ext, this.thigh * Math.cos(th) + this.shin * Math.cos(th - kn));
      }
      hips.rotation.set(0.05 * runK * amp * f, -0.12 * Math.sin(ph) * amp * (1 - 0.3 * runK), 0.035 * Math.sin(ph) * amp * f);
      const c0 = Math.cos(ph);
      if (amp > 0.3 && c.onStep) {
        if (this.prevCos > 0 && c0 <= 0) c.onStep(n('leftFoot'), runK);
        if (this.prevCos < 0 && c0 >= 0) c.onStep(n('rightFoot'), runK);
      }
      this.prevCos = c0;
    }
    hips.position.copy(this.hipsRest);
    hips.position.y += (ext - this.thigh - this.shin) + runK * amp * 0.03 * Math.max(0, Math.sin(2 * ph - 0.6)) - (1 - amp) * 0.004 * (breathe + 1);

    // ---------- torso & head ----------
    const lean = lerp(0.04, 0.22, runK) * amp + (c.mode === 'ride' ? 0.2 : 0);
    n('spine').rotation.set((lean * 0.6 + c.bow * 0.6) * f, 0.17 * Math.sin(ph) * amp, -0.02 * Math.sin(ph) * amp * f);
    const chest = n('chest'); if (chest) chest.rotation.set((lean * 0.4 + c.bow * 0.4 + breathe * 0.012) * f, 0, 0);
    let headPitch = -lean * 0.65;
    if (c.mode === 'read' || c.mode === 'phone') headPitch += 0.45;
    if (c.mode === 'clerk') headPitch += 0.06;
    const neck = n('neck'); if (neck) neck.rotation.x = headPitch * 0.5 * f;
    n('head').rotation.set((headPitch * 0.5 + c.lookPitch) * f, -(hips.rotation.y + n('spine').rotation.y) * 0.85 + c.lookYaw, Math.sin(c.time * 0.7) * 0.02 * f);

    // ---------- arms (IK toward targets expressed in the character's frame) ----------
    this._refresh();
    const yawQ = _q1.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw).clone();
    const fromShoulder = (side, x, y, z) => n(`${side}UpperArm`).getWorldPosition(V()).add(V().set(x, y, z).applyQuaternion(yawQ));
    const pole = (side, x, y, z) => fromShoulder(side, x, y, z);
    const L = this.armLen;
    const free = (side) => {
      const s = side === 'left' ? 1 : -1, sw = side === 'left' ? -1 : 1; // arm swings opposite its leg
      const carry = side === 'left' && c.carry ? 0.45 : 1;
      const swing = sw * Math.sin(ph) * amp * carry;
      const walk = [s * 0.07, -L * 0.95 + 0.04 * Math.abs(swing), swing * 0.2];
      const run = [s * 0.1, -L * 0.6, 0.1 + swing * 0.26];
      const k = runK * carry;
      const tgt = fromShoulder(side, lerp(walk[0], run[0], k), lerp(walk[1], run[1], k) + breathe * 0.004, lerp(walk[2], run[2], k));
      twoBoneIK(n(`${side}UpperArm`), n(`${side}LowerArm`), n(`${side}Hand`), tgt, pole(side, s * 0.25, -0.3, -0.5));
      this.curl(side, c.carry && side === 'left' ? 1.0 : 0.35);
    };
    const reachTo = (side, x, y, z, grip = 0.9, px = 0.3, py = -0.4, pz = -0.3) => {
      const s = side === 'left' ? 1 : -1;
      twoBoneIK(n(`${side}UpperArm`), n(`${side}LowerArm`), n(`${side}Hand`), fromShoulder(side, x, y, z), pole(side, s * px, py, pz));
      this.curl(side, grip);
    };
    const os = c.openSmooth;
    switch (c.mode) {
      case 'read': reachTo('left', -0.1, -0.3, 0.3, 0.6); reachTo('right', 0.1, -0.3, 0.3, 0.6); break;
      case 'phone': reachTo('left', -0.12, -0.2, 0.26, 0.9); break;
      case 'clerk': reachTo('left', -0.04, -0.36 + c.bow * 0.15, 0.32, 0.2); reachTo('right', 0.04, -0.36 + c.bow * 0.15, 0.32, 0.2); break;
      case 'atm': reachTo('right', lerp(-0.06, 0.05, c.reach), lerp(-L * 0.9, -0.15, c.reach), lerp(0.05, 0.42, c.reach), 0.5); free('left'); break;
      case 'ride': {
        const g = c.bike.localToWorld(V().set(0.28, 1.02, -0.3));
        twoBoneIK(n('leftUpperArm'), n('leftLowerArm'), n('leftHand'), g, pole('left', 0.3, -0.3, -0.3)); this.curl('left', 1.0);
        break;
      }
      default: free('left');
    }
    if (c.umbrella) {
      if (c.mode === 'ride') reachTo('right', 0.06, -0.22, 0.28, 1.1, 0.35, -0.4, -0.2);
      else reachTo('right', lerp(-0.05, 0.08, os), lerp(-L * 0.9, -0.17 + 0.006 * Math.sin(2 * ph), os), lerp(0.06, 0.2, os), 1.1, 0.4, lerp(-0.1, -0.5, os), lerp(-0.5, -0.15, os));
    } else if (c.mode === 'walk' || c.mode === 'idle' || c.mode === 'phone') free('right');

    this._refresh();
    // eyes follow a point ahead (or whatever the NPC logic aims them at)
    if (c.lookAtWorld) this.lookObj.position.copy(c.lookAtWorld);
    else this.lookObj.position.copy(n('head').getWorldPosition(V())).add(V().set(Math.sin(c.yaw + c.lookYaw) * 2, -0.2, Math.cos(c.yaw + c.lookYaw) * 2));
    if (lod > 0) { // far away: pose only — no springs, expressions or eye tracking
      vrm.humanoid.update();
      this.springsReady = false;
    } else {
      this._expressions(c, dt);
      // springs read raw-bone world matrices: apply the pose and refresh them first
      vrm.humanoid.update(); vrm.scene.updateMatrixWorld(true);
      if (!this.springsReady) { vrm.update(0); vrm.springBoneManager?.reset(); this.springsReady = true; }
      vrm.update(Math.min(dt, 1 / 30));
    }
    return { runK, amp, hipLift: hips.position.y - this.hipsRest.y };
  }
}
