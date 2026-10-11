// GPU rain streaks lit by nearby lights, ground splashes, and CPU drips from eaves & umbrella ribs
import * as THREE from 'three';
import { noReflect } from './utils.js';

const MAX_LIGHTS = 10, MAX_UMB = 10;

const COMMON = /* glsl */`
  uniform vec4 uStore; uniform vec4 uEave;
  uniform vec4 uUmb[${MAX_UMB}];
  uniform vec4 uLights[${MAX_LIGHTS}]; uniform vec3 uLightCol[${MAX_LIGHTS}];
  bool sheltered(vec3 p){
    if (p.x > uStore.x && p.x < uStore.y && p.z > uStore.z && p.z < uStore.w) return true;
    if (p.x > uEave.x && p.x < uEave.y && p.z > uEave.z && p.z < uEave.w && p.y < 2.9) return true;
    for (int i = 0; i < ${MAX_UMB}; i++) {
      vec4 u = uUmb[i];
      if (u.w > 0.0 && p.y < u.y && distance(p.xz, u.xz) < u.w) return true;
    }
    return false;
  }
  vec3 lightAt(vec3 p){
    vec3 L = vec3(0.10, 0.12, 0.17);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      vec3 d = p - uLights[i].xyz;
      L += uLightCol[i] * uLights[i].w / (1.0 + dot(d, d) * 0.45);
    }
    return L;
  }
  vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
`;

export class Rain {
  constructor(scene, { count = 16000, splashCount = 1600 } = {}) {
    this.uniforms = {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(34, 14, 34) }, uWind: { value: new THREE.Vector2(1.2, 0.5) },
      uStore: { value: new THREE.Vector4(-7.1, 7.1, -16.1, -6.45) },
      uEave: { value: new THREE.Vector4(-7.4, 7.4, -6.5, -5.05) },
      uUmb: { value: Array.from({ length: MAX_UMB }, () => new THREE.Vector4()) },
      uLights: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector4()) },
      uLightCol: { value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector3()) },
      uIntensity: { value: 1.0 },
    };
    this.lightCount = 0;

    // ---------- streaks ----------
    const quad = new THREE.InstancedBufferGeometry();
    quad.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
    quad.setIndex([0, 1, 2, 2, 1, 3]);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seeds[i] = Math.random();
    quad.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    quad.instanceCount = count;
    this.streakMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec4 aSeed; uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; uniform vec2 uWind;
        varying vec2 vUv; varying vec3 vCol; varying float vFade;
        ${COMMON}
        void main(){
          float speed = 8.5 + aSeed.w * 3.5;
          vec3 base = uCam - uBox * 0.5;
          vec3 p;
          p.xz = base.xz + mod(aSeed.xz * uBox.xz - base.xz, uBox.xz);
          p.y = mod(aSeed.y * uBox.y - uTime * speed, uBox.y) - 0.3 + max(uCam.y - 5.0, 0.0);
          p.xz += uWind * (p.y / speed);
          vec3 dir = normalize(vec3(uWind.x, -speed, uWind.y));
          vec3 toCam = normalize(uCam - p);
          vec3 side = normalize(cross(dir, toCam));
          float camDist = distance(p, uCam);
          float len = (0.35 + 0.35 * aSeed.w);
          float wid = 0.009 * (1.0 + camDist * 0.04);
          vec3 w = p + side * position.x * wid - dir * position.y * len;
          if (p.y < 0.0 || sheltered(p)) w = vec3(0.0, -50.0, 0.0);
          vUv = position.xy;
          vCol = lightAt(p);
          vFade = smoothstep(uBox.x * 0.5, uBox.x * 0.25, length(p.xz - uCam.xz)) * smoothstep(0.4, 2.0, camDist);
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uIntensity; varying vec2 vUv; varying vec3 vCol; varying float vFade;
        void main(){
          // clamp: MSAA can extrapolate varyings slightly outside the quad (pow of a negative = NaN)
          float a = clamp(1.0 - abs(vUv.x) * 2.0, 0.0, 1.0);
          a *= pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.3) * smoothstep(0.0, 0.06, vUv.y);
          gl_FragColor = vec4(vCol * a * vFade * 0.55 * uIntensity, 1.0);
        }`,
    });
    this.streaks = new THREE.Mesh(quad, this.streakMat);
    this.streaks.frustumCulled = false;
    scene.add(noReflect(this.streaks));

    // ---------- splashes ----------
    const sq = new THREE.InstancedBufferGeometry();
    sq.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0], 3));
    sq.setIndex([0, 1, 2, 2, 1, 3]);
    const ss = new Float32Array(splashCount * 3);
    for (let i = 0; i < splashCount * 3; i++) ss[i] = Math.random();
    sq.setAttribute('aSeed', new THREE.InstancedBufferAttribute(ss, 3));
    sq.instanceCount = splashCount;
    this.splashMat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute vec3 aSeed; uniform float uTime; uniform vec3 uCam;
        varying vec2 vUv; varying vec3 vCol; varying float vK;
        ${COMMON}
        void main(){
          float period = 0.4 + aSeed.z * 0.35;
          float tt = uTime / period + aSeed.x * 17.0;
          float cyc = floor(tt); vK = fract(tt);
          vec2 rnd = hash22(vec2(cyc * 1.37, aSeed.y * 311.0));
          vec2 xz = uCam.xz + (rnd - 0.5) * 30.0;
          vec3 p = vec3(xz.x, 0.0, xz.y);
          float s = 0.07 + vK * 0.1;
          vec3 right = normalize(vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]));
          vec3 w = p + right * position.x * s * 2.0 + vec3(0.0, position.y * s * 1.1, 0.0);
          if (sheltered(p + vec3(0.0, 0.5, 0.0)) || distance(p, uCam) > 16.0) w = vec3(0.0, -50.0, 0.0);
          vUv = position.xy;
          vCol = lightAt(p + vec3(0.0, 0.3, 0.0));
          gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uIntensity; varying vec2 vUv; varying vec3 vCol; varying float vK;
        void main(){
          float a = 0.0;
          for (int i = 0; i < 5; i++) {
            float ang = (float(i) - 2.0) * 0.38;
            vec2 c = vec2(sin(ang) * vK * 0.44, (vK * 1.25 - vK * vK * 1.15) * cos(ang) * 0.85 + 0.04);
            a += smoothstep(0.055, 0.0, length(vUv - c));
          }
          float ring = smoothstep(0.05, 0.0, abs(length(vec2(vUv.x, vUv.y * 4.0)) - vK * 0.48)) * step(vUv.y, 0.06);
          a = (a + ring * 0.6) * (1.0 - vK);
          gl_FragColor = vec4(max(vCol * a * 0.9 * uIntensity, 0.0), 1.0);
        }`,
    });
    this.splashes = new THREE.Mesh(sq, this.splashMat);
    this.splashes.frustumCulled = false;
    scene.add(noReflect(this.splashes));

    // ---------- CPU drips (eave edge + umbrella ribs + foot splashes) ----------
    this.maxDrips = 600;
    this.drips = [];
    this.dripMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.006, 0.07, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.82, 1.0), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), this.maxDrips);
    this.dripMesh.frustumCulled = false;
    this.dripMesh.count = 0;
    scene.add(noReflect(this.dripMesh));
    this.eaveAcc = 0;
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._up = new THREE.Vector3(0, 1, 0);
  }

  setLights(list) {
    list.slice(0, MAX_LIGHTS).forEach(([pos, col, w], i) => {
      this.uniforms.uLights.value[i].set(pos.x, pos.y, pos.z, w);
      this.uniforms.uLightCol.value[i].set(col.r, col.g, col.b);
    });
  }
  setUmbrellas(list) {
    const arr = this.uniforms.uUmb.value;
    for (let i = 0; i < MAX_UMB; i++) {
      const u = list[i];
      if (u) arr[i].set(u.x, u.y, u.z, u.r); else arr[i].set(0, 0, 0, 0);
    }
  }
  drip(pos, vel, size = 1) {
    if (this.drips.length >= this.maxDrips) this.drips.shift();
    this.drips.push({ p: pos.clone(), v: vel.clone(), s: size, life: 3 });
  }
  splashBurst(pos, n = 6, strength = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = (0.6 + Math.random()) * strength;
      this.drip(pos, new THREE.Vector3(Math.cos(a) * r * 0.9, (1.0 + Math.random() * 1.2) * strength, Math.sin(a) * r * 0.9), 0.4);
    }
  }
  update(dt, t, camera, dripSources) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCam.value.copy(camera.position);
    // eave drips
    this.eaveAcc += dt * 26;
    while (this.eaveAcc > 1) {
      this.eaveAcc -= 1;
      const x = -7.25 + Math.random() * 14.5;
      if (Math.abs(x - camera.position.x) < 22) this.drip(new THREE.Vector3(x, 2.86, -5.02 + Math.random() * 0.03), new THREE.Vector3(0, -0.5, 0));
    }
    // umbrella rib drips
    for (const src of dripSources) {
      if (Math.random() < dt * 2.2) this.drip(src, new THREE.Vector3(0, -0.3, 0));
    }
    const m = this._m, q = this._q, s = this._s;
    let n = 0;
    for (let i = this.drips.length - 1; i >= 0; i--) {
      const d = this.drips[i];
      d.v.y -= 9.8 * dt;
      d.p.addScaledVector(d.v, dt);
      d.life -= dt;
      if (d.p.y < 0 || d.life < 0) {
        if (d.s > 0.9 && d.p.y < 0 && Math.random() < 0.5) { d.p.y = 0.01; this.splashBurst(d.p, 2, 0.35); }
        this.drips.splice(i, 1); continue;
      }
      const sp = d.v.length();
      q.setFromUnitVectors(this._up, sp > 0.01 ? new THREE.Vector3().copy(d.v).divideScalar(sp) : this._up);
      s.set(d.s, Math.min(1.6, 0.4 + sp * 0.12) * d.s, d.s);
      m.compose(d.p, q, s);
      if (n < this.maxDrips) this.dripMesh.setMatrixAt(n++, m);
    }
    this.dripMesh.count = n;
    this.dripMesh.instanceMatrix.needsUpdate = true;
  }
}
