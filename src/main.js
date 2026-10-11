// Entry: renderer, scene assembly, game loop, UI
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { LAYER_NOREFLECT, std, clamp } from './utils.js';
import { createSky, createEnvMap } from './sky.js';
import { PlanarReflection } from './reflection.js';
import { buildStreet } from './street.js';
import { buildStore } from './store.js';
import { buildInterior } from './interior.js';
import { buildCounter } from './counter.js';
import { Rain } from './rain.js';
import { Character } from './character.js';
import { PlayerController } from './player.js';
import { NPCSystem } from './npcs.js';
import { AudioFX } from './audio.js';
import { createPost } from './post.js';
import { loadPhotoAssets, applyPhotoAssets } from './assets.js';

const $ = (id) => document.getElementById(id);
// yield so the bar can paint; the timeout keeps loading going in background tabs (rAF is paused there)
const progress = (p) => {
  $('loadFill').style.width = `${Math.round(p * 100)}%`;
  return new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 60); });
};

async function waitFonts() {
  try {
    await Promise.race([
      Promise.all(['900 40px "Noto Sans JP"', '700 40px "Noto Sans JP"', '900 40px "Noto Serif JP"'].map((f) => document.fonts.load(f, 'あ漢ア'))),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch { /* fall back to system fonts */ }
}

const loadTimes = []; let lastT = 0;
const T = (label) => { const n = performance.now(); loadTimes.push(`${label} ${Math.round(n - lastT)}ms`); lastT = n; };

async function init() {
  T('boot');
  await progress(0.05);
  const canvas = $('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // fixed "smooth" quality: lower render scale, no shadow maps, lighter reflections and rain
  const quality = { pr: 0.85 };
  renderer.setPixelRatio(quality.pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a1220, 0.021);
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.08, 700);
  camera.layers.enable(LAYER_NOREFLECT);
  camera.position.set(2, 2, 6);

  // start downloading photo textures immediately; apply each one as soon as the scene exists
  const photoQueue = []; let sceneReady = false;
  const assetsP = loadPhotoAssets((name, tex) => (sceneReady ? applyPhotoAssets(scene, { [name]: tex }) : photoQueue.push([name, tex])));

  await waitFonts();
  T('fonts');
  await progress(0.15);

  const sky = createSky(); scene.add(sky);
  scene.environment = createEnvMap(renderer);
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0x2a3b5c, 0x07080c, 0.55));

  const refl = new PlanarReflection(renderer, 0.3);
  const street = buildStreet(scene, refl);
  T('street');
  await progress(0.35);
  const door = buildStore(scene);
  T('store');
  await progress(0.5);
  buildInterior(scene);
  const counter = buildCounter(scene);
  T('interior');
  await progress(0.65);
  const rain = new Rain(scene, { count: 7000, splashCount: 1000 });
  const audio = new AudioFX();

  // speech bubbles
  const bubbles = [];
  const say = (char, text, dur = 2.5) => {
    const old = bubbles.find((b) => b.char === char); if (old) { old.el.remove(); bubbles.splice(bubbles.indexOf(old), 1); }
    const el = document.createElement('div'); el.className = 'bubble'; el.textContent = text; $('bubbles').appendChild(el);
    bubbles.push({ char, el, t: dur });
  };

  const npcs = new NPCSystem(scene, rain, say);
  npcs.onBell = () => audio.bell();
  T('npcs');
  await progress(0.8);

  // the heroine: long hair, cardigan, pleated skirt, clear vinyl umbrella
  const girl = new Character(scene, { bag: 'school', hairpin: true }, { umbrella: { kind: 'clear', radius: 0.52 } });
  girl.pos.set(1.6, 0, 1.2); girl.yaw = Math.PI; girl._prevYaw = girl.yaw;
  girl.onStep = (ankle, run) => {
    const p = ankle.getWorldPosition(new THREE.Vector3()); p.y = 0.01;
    const inside = ctrl.place === '店內';
    if (!inside) rain.splashBurst(p, 3 + Math.round(run * 4), 0.35 + run * 0.45);
    audio.step(run, inside);
  };
  const ctrl = new PlayerController(girl, camera, canvas);
  ctrl.camYaw = 0.35; ctrl.camPitch = 0.22;

  // convenience-store bag (appears after paying at the register)
  const bag = new THREE.Group();
  const bagMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf6f6f2, roughness: 0.55, transparent: true, opacity: 0.92 }));
  bagMesh.scale.set(1.1, 1.0, 0.6); bagMesh.position.y = -0.2; bag.add(bagMesh);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), std(0xf6f6f2, 0.6)); h.position.set(s * 0.03, -0.05, 0); bag.add(h); }
  bag.visible = false;
  girl.attachToHand('L', bag, [0.04, -0.06, 0.07]);

  // lights feeding the rain shader
  const lightList = [
    [new THREE.Vector3(0, 1.6, -5.8), new THREE.Color(1.0, 0.82, 0.6), 3.2],
    [new THREE.Vector3(-3.5, 1.6, -5.8), new THREE.Color(1.0, 0.82, 0.6), 2.2],
    [new THREE.Vector3(4.2, 1.6, -5.8), new THREE.Color(1.0, 0.82, 0.6), 2.2],
    [new THREE.Vector3(0, 3.5, -5.6), new THREE.Color(0.85, 0.9, 1.0), 2.5],
    [new THREE.Vector3(-9.4, 1.4, -5.8), new THREE.Color(0.75, 0.88, 1.0), 1.6],
    [new THREE.Vector3(14, 1.9, -5.6), new THREE.Color(1.0, 0.35, 0.15), 1.6],
    [new THREE.Vector3(-12.4, 5.0, -5.6), new THREE.Color(1.0, 0.25, 0.75), 1.4],
    [new THREE.Vector3(-16, 1.6, 5.4), new THREE.Color(0.8, 0.9, 1.0), 1.8],
  ];
  scene.updateMatrixWorld(true);
  for (const c of street.animated.cones) {
    const p = c.parent.getWorldPosition(new THREE.Vector3());
    if (lightList.length < 10) lightList.push([p.setY(5.6), new THREE.Color(0.65, 0.8, 1.0), 1.8]);
  }
  rain.setLights(lightList);

  const post = createPost(renderer, scene, camera);
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(quality.pr); renderer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    post.setSize(w, h, quality.pr);
    refl.setSize(w * quality.pr, h * quality.pr);
  };
  addEventListener('resize', resize); resize();

  // photo textures that already arrived (the rest stream in later; canvas art shows until then)
  T('setup');
  sceneReady = true;
  for (const [n, t] of photoQueue) { try { applyPhotoAssets(scene, { [n]: t }); } catch (e) { console.warn('photo asset', n, e); } }
  await progress(0.9);
  // compile shaders up front (in parallel where supported) so the first frame doesn't hitch
  try { await renderer.compileAsync(scene, camera); } catch (e) { console.warn('shader precompile skipped', e); }
  T('shaders');
  console.info('[load]', loadTimes.join(' | '));
  await progress(1);

  // ---------- UI ----------
  // the cover turns from a loading screen into the title screen
  $('coverLoad').classList.add('hidden');
  $('coverEnter').classList.remove('hidden');
  const touch = matchMedia('(pointer: coarse)').matches;
  $('startBtn').onclick = () => {
    $('cover').classList.add('leaving'); setTimeout(() => $('cover').classList.add('hidden'), 1200);
    $('hud').classList.remove('hidden');
    if (touch) { $('joy').classList.remove('hidden'); $('runBtn').classList.remove('hidden'); }
    ctrl.enabled = true; audio.start(); canvas.focus();
  };
  let toastT = 0;
  const toast = (msg, t = 2) => { $('toast').textContent = msg; $('toast').classList.add('show'); toastT = t; };
  let hudHidden = false, muted = false, paid = false;
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyH') { hudHidden = !hudHidden; $('hud').classList.toggle('hidden', hudHidden); }
    if (e.code === 'KeyM') { muted = !muted; audio.setEnabled(!muted); toast(muted ? '音效：關' : '音效：開'); }
    if (e.code === 'KeyE' && nearCounter() && !paid) {
      paid = true; audio.register(); bag.visible = true;
      say(npcs.clerk, 'ありがとうございます！', 2.4); npcs.clerk.bowT = 1.0;
      toast('買好了！拿著便利商店的袋子走回雨中吧');
    }
  });
  const nearCounter = () => girl.pos.x > 4.0 && girl.pos.x < 5.3 && girl.pos.z < -8.6 && girl.pos.z > -13.4;

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let t = 0, prevPlace = ctrl.place, fpsAcc = 0, fpsN = 0, hintShown = false;
  const tmp = new THREE.Vector3();
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    ctrl.update(dt);
    const place = ctrl.place;
    girl.update(dt, t);
    npcs.update(dt, t, girl, place, prevPlace);
    if (place !== prevPlace) $('hudPlace').textContent = place;
    prevPlace = place;

    door.update(dt, [girl.pos, ...npcs.list.filter((c) => c.mode === 'walk').map((c) => c.pos)]);
    if (door.justOpened) audio.chime();
    counter.update(t);

    // rain shelter from all open umbrellas + drips from rib tips
    const umbs = npcs.umbrellas();
    const top = girl.umbrellaTop; if (top) umbs.unshift({ x: top.x, y: top.y, z: top.z, r: 0.52 * girl.open });
    rain.setUmbrellas(umbs);
    const sources = [];
    for (const c of [girl, ...npcs.list]) {
      if (!c.umbrella || c.open < 0.8 || c.pos.distanceToSquared(camera.position) > 400) continue;
      c.umbrella.group.updateMatrixWorld();
      for (const tip of c.umbrella.tips) sources.push(tmp.copy(tip).applyMatrix4(c.umbrella.group.matrixWorld).clone());
    }
    rain.update(dt, t, camera, sources);

    // ambience animation
    street.groundMat.userData.uniforms.uTime.value = t;
    sky.material.uniforms.uTime.value = t;
    sky.position.copy(camera.position);
    for (const c of street.animated.cones) if (c) c.material.uniforms.uTime.value = t;
    street.animated.noren.forEach((n, i) => { n.rotation.x = Math.sin(t * 1.6 + i * 0.9) * 0.06 + Math.sin(t * 3.1 + i) * 0.02; });
    street.animated.red.forEach((r, i) => { r.visible = Math.sin(t * 2.4 + i * 1.7) > 0.2; });

    // interaction hints
    if (nearCounter() && !paid && !hintShown) { toast('按 E 結帳', 2.5); hintShown = true; }
    if (!nearCounter()) hintShown = false;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('show'); }

    audio.update({
      inside: place === '店內', umbrellaOpen: girl.open > 0.6,
      carProximity: npcs.taxiNear ? clamp(1 - Math.abs(npcs.taxiState.x - girl.pos.x) / 25, 0, 1) * (npcs.taxiNear / 9) : 0,
      storeDist: Math.hypot(girl.pos.x - 4.2, girl.pos.z + 6.5),
      // distance to the dripping edge of the store's eave (z = -5.05, x in ±7.3)
      eaveDist: Math.hypot(Math.max(0, Math.abs(girl.pos.x) - 7.3), girl.pos.z + 5.05),
    });

    // bubbles follow heads
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.t -= dt;
      b.char.h.head.getWorldPosition(tmp); tmp.y += 0.42;
      const dist = tmp.distanceTo(camera.position);
      tmp.project(camera);
      const vis = tmp.z < 1 && dist < 28;
      b.el.style.left = `${(tmp.x * 0.5 + 0.5) * innerWidth}px`;
      b.el.style.top = `${(-tmp.y * 0.5 + 0.5) * innerHeight}px`;
      b.el.style.opacity = vis ? String(clamp(b.t * 2, 0, 1)) : '0';
      if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); }
    }

    camera.updateMatrixWorld();
    refl.update(scene, camera);
    post.render(t);

    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { $('hudStat').textContent = `${Math.round(fpsN / fpsAcc)} fps`; fpsAcc = 0; fpsN = 0; }
  }
  // keep the loop alive even if one frame throws
  let errShown = false;
  function frame() {
    try { tick(); } catch (e) { if (!errShown) { console.error(e); errShown = true; } }
    requestAnimationFrame(frame);
  }
  frame();
  window.__scene = { scene, camera, renderer, girl, ctrl, npcs, refl, post, rain, street, audio };
}

init().catch((e) => {
  console.error(e);
  $('loadText').textContent = '載入失敗：' + e.message;
});
