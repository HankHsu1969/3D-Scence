// NPCs: clerk, shoppers, street walkers with umbrellas, an umbrella-wielding cyclist, a taxi
import * as THREE from 'three';
import { Character } from './character.js';
import { collide } from './player.js';
import { createBicycle } from './props.js';
import { createTaxi } from './props2.js';
import { magazineAtlas } from './tex-items.js';
import { glow, std, rand, pick, damp, angleDamp, clamp, lerp } from './utils.js';

const OUTFITS = {
  salaryman: { scale: 1.1, face: 'man', hair: { style: 'short', color: '#151515' }, top: { kind: 'suit', color: '#1e2433', inner: '#eef1f5', accent: '#7a1c22' }, bottom: { kind: 'pants', color: '#1e2433' }, shoes: '#111111', bag: 'briefcase' },
  officeLady: { scale: 1.0, face: 'woman', hair: { style: 'bob', color: '#3a2418' }, top: { kind: 'coat', color: '#c8a77e', inner: '#f6f1ea' }, bottom: { kind: 'pants', color: '#2b2b33' }, shoes: '#2a1a12', bag: 'shoulder' },
  student: { scale: 1.06, face: 'man', hair: { style: 'short', color: '#20160f' }, top: { kind: 'hoodie', color: '#3b4f6e', inner: '#ffffff' }, bottom: { kind: 'pants', color: '#2a2e38' }, shoes: '#e8e8e8', shoeKind: 'sneaker', bag: 'backpack' },
  grandma: { scale: 0.93, face: 'old', hair: { style: 'bun', color: '#b9b6b2' }, top: { kind: 'coat', color: '#6b4a73', inner: '#e8e0d4' }, bottom: { kind: 'pants', color: '#3d3540' }, shoes: '#3a2a20', bag: 'tote' },
  youngWoman: { scale: 0.99, face: 'woman', hair: { style: 'long', color: '#5a3a24' }, top: { kind: 'coat', color: '#e9e4da', inner: '#ffffff' }, bottom: { kind: 'skirt', color: '#5a3b3b' }, legs: { sock: '#1a1a1a' }, shoes: '#1a1a1a', bag: 'shoulder' },
  clerk: { scale: 1.04, face: 'man', hair: { style: 'short', color: '#2a1d14' }, top: { kind: 'clerk', color: '#1b8f86', inner: '#f4f6f8' }, bottom: { kind: 'pants', color: '#22252c' }, shoes: '#111111' },
  reader: { scale: 1.05, face: 'man', hair: { style: 'short', color: '#111111' }, top: { kind: 'hoodie', color: '#6b2f2f', inner: '#222' }, bottom: { kind: 'pants', color: '#3b4a5e' }, shoes: '#dddddd', shoeKind: 'sneaker', glasses: true, bag: 'backpack' },
  atm: { scale: 1.0, face: 'woman', hair: { style: 'bob', color: '#111111' }, top: { kind: 'coat', color: '#2f3b52', inner: '#ddd' }, bottom: { kind: 'pants', color: '#1f1f26' }, shoes: '#111' },
  phoneGuy: { scale: 1.08, face: 'man', hair: { style: 'short', color: '#1a1410' }, top: { kind: 'suit', color: '#3a3d44', inner: '#f0f0f0', accent: '#1d3a7a' }, bottom: { kind: 'pants', color: '#3a3d44' }, shoes: '#111' },
  browser: { scale: 1.0, face: 'woman', hair: { style: 'long', color: '#2a1a14' }, top: { kind: 'hoodie', color: '#b9c7d6', inner: '#fff' }, bottom: { kind: 'pants', color: '#3b3f4a' }, shoes: '#f2f2f2', shoeKind: 'sneaker' },
  cyclist: { scale: 1.02, face: 'woman', hair: { style: 'bob', color: '#24160f' }, top: { kind: 'coat', color: '#8a9a6a', inner: '#fff' }, bottom: { kind: 'pants', color: '#2e3340' }, shoes: '#3a2a20' },
};

export class NPCSystem {
  constructor(scene, rain, say) {
    this.scene = scene; this.rain = rain; this.say = say;
    this.list = [];
    this.walkers = [];
    // --- clerk ---
    this.clerk = this.spawn('clerk', 6.5, -11.0, -Math.PI / 2, null, 'clerk');
    // --- shoppers ---
    const reader = this.spawn('reader', -3.6, -7.5, 0, null, 'read');
    const mt = magazineAtlas(); const tex = mt.clone(); tex.needsUpdate = true; tex.repeat.set(0.25, 0.5); tex.offset.set(0.25, 0.5);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.28, 0.01), [std(0xf4f0e8, 0.8), std(0xf4f0e8, 0.8), std(0xf4f0e8, 0.8), std(0xf4f0e8, 0.8), std(0xffffff, 0.5, 0, { map: tex }), std(0xf8f6f0, 0.9)]);
    mag.position.set(0, -0.02, 0.27); mag.rotation.x = 0.64; reader.h.chest.add(mag);
    const atm = this.spawn('atm', 5.85, -7.85, Math.PI / 2, null, 'atm');
    atm.reachT = 0;
    const browser = this.spawn('browser', -2, -14.5, Math.PI / 2, null, 'walk');
    browser.route = { type: 'patrol', pts: [[-5.6, -14.55], [2.6, -14.55]], i: 1, wait: 0, stopYaw: Math.PI };
    // salaryman on the phone under the eave, umbrella folded
    const phone = this.spawn('phoneGuy', -6.4, -5.65, 0.3, { kind: 'black', color: 0x15161a }, 'phone');
    phone.wantOpen = false; phone.open = 0;
    const ph = new THREE.Group();
    ph.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.008), std(0x111111, 0.3, 0.5)));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.135), glow(0xbfe0ff, 2.2)); scr.position.z = -0.005; scr.rotation.y = Math.PI; ph.add(scr);
    phone.attachToHand('L', ph, [0, -0.07, 0.03], [0.3, 0, 0]);
    phone.talkT = 4;

    // --- street walkers ---
    const plan = [
      ['salaryman', { kind: 'black', color: 0x15161a, radius: 0.55 }, 3.1, 1.35],
      ['officeLady', { kind: 'solid', color: 0x8a1c2a, radius: 0.5 }, -4.4, 1.2],
      ['student', { kind: 'clear', radius: 0.5 }, 4.7, 1.45],
      ['grandma', { kind: 'solid', color: 0x5a3a6e, radius: 0.48 }, 4.2, 0.75],
      ['youngWoman', { kind: 'clear', radius: 0.5 }, -3.2, 1.15],
      ['salaryman', { kind: 'solid', color: 0x1d2c4a, radius: 0.55 }, -4.8, 1.4],
    ];
    plan.forEach(([kind, umb, lane, speed], i) => {
      const dir = i % 2 ? 1 : -1;
      const x = rand(-34, 34);
      const c = this.spawn(kind, x, lane, dir > 0 ? Math.PI / 2 : -Math.PI / 2, umb, 'walk');
      c.route = { type: 'street', lane, dir, speed, laneOffset: 0 };
      c.speed = speed;
      this.walkers.push(c);
    });

    // --- cyclist with umbrella (傘さし運転) ---
    this.bike = createBicycle({ color: 0xe8b4c8 });
    scene.add(this.bike);
    this.bike.position.set(-30, 0, -2.25);
    this.bikeSpeed = 3.6; this.bikeYaw = 0; this.bellT = 0;
    this.rider = this.spawn('cyclist', 0, 0, 0, { kind: 'clear', radius: 0.5 }, 'ride');
    this.rider.bike = this.bike;

    // --- taxi ---
    this.taxi = createTaxi(); scene.add(this.taxi);
    this.taxiState = { x: -70, dir: 1, speed: 9, wait: 3, lane: -1.25 };
    this.taxi.visible = false;
  }

  spawn(kind, x, z, yaw, umbrella, mode) {
    const c = new Character(this.scene, OUTFITS[kind], { umbrella, mode });
    c.kind = kind; c.pos.set(x, 0, z); c.yaw = yaw; c._prevYaw = yaw;
    c.onStep = (ankle, run) => { if (Math.random() < 0.3) { const p = ankle.getWorldPosition(new THREE.Vector3()); p.y = 0.01; this.rain.splashBurst(p, 2, 0.25 + run * 0.3); } };
    this.list.push(c);
    return c;
  }

  update(dt, t, player, playerPlace, prevPlace) {
    const pp = player.pos;
    // clerk greeting / bowing
    const clerk = this.clerk;
    if (playerPlace === '店內' && prevPlace !== '店內') { this.say(clerk, 'いらっしゃいませ〜！', 2.6); clerk.bowT = 1.2; }
    if (playerPlace !== '店內' && prevPlace === '店內') { this.say(clerk, 'ありがとうございました〜', 2.6); clerk.bowT = 1.2; }
    clerk.bowT = Math.max(0, (clerk.bowT || 0) - dt);
    clerk.bow = damp(clerk.bow, clerk.bowT > 0.3 ? 0.45 : 0, 6, dt);
    // clerk looks at the player when inside
    if (playerPlace === '店內') clerk.lookTarget = clamp(Math.atan2(pp.x - clerk.pos.x, pp.z - clerk.pos.z) - clerk.yaw, -1, 1);

    for (const c of this.list) {
      if (c.mode === 'atm') { c.reachT += dt; c.reach = 0.5 + 0.5 * Math.sin(c.reachT * 1.3) * (Math.sin(c.reachT * 0.37) > 0 ? 1 : 0.2); }
      if (c.mode === 'phone') {
        c.talkT -= dt;
        if (c.talkT < 0) { c.talkT = rand(7, 12); this.say(c, pick(['はい、はい…', '申し訳ございません…', '今から戻ります', 'え、明日ですか？']), 2.2); }
      }
      if (c.route?.type === 'patrol') this.patrol(c, dt);
      if (c.route?.type === 'street') this.walkStreet(c, dt, pp);
      // everyone keeps umbrellas open outdoors except the phone guy under the eave
      if (c.umbrella && c.mode === 'walk') c.wantOpen = !(c.pos.z < -6.45 && Math.abs(c.pos.x) < 7);
    }

    this.updateBike(dt, pp);
    this.updateTaxi(dt, pp);
    for (const c of this.list) c.update(dt, t);
  }

  patrol(c, dt) {
    const r = c.route;
    if (r.wait > 0) { r.wait -= dt; c.speed = damp(c.speed, 0, 6, dt); c.yaw = angleDamp(c.yaw, r.stopYaw, 4, dt); return; }
    const [tx, tz] = r.pts[r.i];
    const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.3 || Math.random() < dt * 0.08) { r.i = (r.i + 1) % r.pts.length; r.wait = rand(2, 6); return; }
    c.yaw = angleDamp(c.yaw, Math.atan2(dx, dz), 5, dt);
    c.speed = damp(c.speed, 0.9, 3, dt);
    c.pos.x += Math.sin(c.yaw) * c.speed * dt; c.pos.z += Math.cos(c.yaw) * c.speed * dt;
    collide(c.pos, 0.25);
  }

  walkStreet(c, dt, pp) {
    const r = c.route;
    if (Math.abs(c.pos.x) > 40) { r.dir = -Math.sign(c.pos.x); }
    // steer around the player & other walkers
    let avoid = 0;
    const ahead = (ox, oz, rad) => {
      const dx = ox - c.pos.x, dz = oz - c.pos.z;
      const along = dx * r.dir;
      if (along > 0 && along < 3.0 && Math.abs(dz) < rad) avoid += (dz >= 0 ? -1 : 1) * (1 - along / 3.0) * 1.2;
    };
    ahead(pp.x, pp.z, 1.1);
    for (const o of this.walkers) if (o !== c) ahead(o.pos.x, o.pos.z, 1.0);
    r.laneOffset = damp(r.laneOffset, clamp(avoid, -1.2, 1.2), 2.5, dt);
    const targetZ = r.lane + r.laneOffset;
    const desiredYaw = Math.atan2(r.dir, (targetZ - c.pos.z) * 0.8);
    c.yaw = angleDamp(c.yaw, desiredYaw, 4, dt);
    const near = Math.hypot(pp.x - c.pos.x, pp.z - c.pos.z);
    c.speed = damp(c.speed, near < 0.9 ? 0.3 : r.speed, 3, dt);
    c.pos.x += Math.sin(c.yaw) * c.speed * dt; c.pos.z += Math.cos(c.yaw) * c.speed * dt;
    collide(c.pos, 0.25);
    if (c.kind === 'grandma' && near < 2.2 && !c.saidT) { this.say(c, 'あらあら、すごい雨ねぇ', 2.5); c.saidT = 20; }
    if (c.saidT) c.saidT = Math.max(0, c.saidT - dt);
  }

  updateBike(dt, pp) {
    const b = this.bike;
    const ahead = pp.x - b.position.x;
    const blocking = ahead > 0 && ahead < 6 && Math.abs(pp.z - b.position.z) < 1.0;
    this.bellT = Math.max(0, this.bellT - dt);
    if (blocking && this.bellT === 0) { this.bellT = 6; this.say(this.rider, 'チリンチリン♪', 1.6); this.onBell?.(b.position); }
    this.bikeSpeed = damp(this.bikeSpeed, blocking && ahead < 3 ? 0.6 : 3.6, 2, dt);
    b.position.x += this.bikeSpeed * dt;
    b.position.z = -2.25 + Math.sin(b.position.x * 0.15) * 0.08;
    if (b.position.x > 46) b.position.x = -46;
    b.rotation.y = 0; b.rotation.x = Math.sin(performance.now() * 0.0013) * 0.02;
    const { wheels, crank, R } = b.userData;
    for (const w of wheels) w.rotation.z -= (this.bikeSpeed / R) * dt;
    crank.rotation.z -= (this.bikeSpeed / R) * dt * 0.55;
    b.updateMatrixWorld(true);
    // seat the rider: root on the saddle, facing the bike's +x
    const r = this.rider;
    r.pos.copy(b.localToWorld(new THREE.Vector3(-0.24, 0.92 - r.h.L.hipY * r.h.scale, 0)));
    r.yaw = Math.PI / 2; r._prevYaw = r.yaw;
  }

  updateTaxi(dt, pp) {
    const s = this.taxiState, car = this.taxi;
    if (s.wait > 0) {
      s.wait -= dt; car.visible = false;
      if (s.wait <= 0) { s.dir = Math.random() < 0.55 ? 1 : -1; s.lane = s.dir > 0 ? -1.25 : 1.25; s.x = -62 * s.dir; s.speed = 9; car.visible = true; }
      return;
    }
    // brake for the player or anyone on the road ahead
    let block = false;
    const check = (x, z) => { const ahead = (x - s.x) * s.dir; if (ahead > 2 && ahead < 11 && Math.abs(z - s.lane) < 1.4) block = true; };
    check(pp.x, pp.z);
    for (const w of this.walkers) check(w.pos.x, w.pos.z);
    check(this.bike.position.x, this.bike.position.z);
    const target = block ? 0 : 9;
    s.speed = damp(s.speed, target, block ? 3.5 : 0.8, dt);
    s.x += s.speed * s.dir * dt;
    car.position.set(s.x, 0, s.lane);
    car.rotation.y = s.dir > 0 ? 0 : Math.PI;
    const braking = block || s.speed < 2;
    for (const tl of car.userData.tail) tl.material.color.setRGB(braking ? 6 : 1.5, braking ? 0.3 : 0.08, braking ? 0.15 : 0.04);
    car.userData.tailLight.intensity = braking ? 10 : 2;
    for (const w of car.userData.wheels) w.rotation.y -= (s.speed / 0.31) * dt;
    if (Math.abs(s.x) > 64) { s.wait = rand(6, 14); }
    this.taxiNear = Math.abs(s.x - pp.x) < 25 && car.visible ? s.speed : 0;
  }

  umbrellas() {
    const out = [];
    for (const c of this.list) {
      const top = c.umbrellaTop;
      if (top) out.push({ x: top.x, y: top.y, z: top.z, r: 0.5 * c.open });
    }
    return out;
  }
}
