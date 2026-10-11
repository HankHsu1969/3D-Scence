// Planar reflection (y = 0) + procedural wet ground material with puddles & rain ripples
import * as THREE from 'three';
import { LAYER_NOREFLECT } from './utils.js';

export class PlanarReflection {
  constructor(renderer, scale = 0.5) {
    this.renderer = renderer;
    this.scale = scale;
    this.camera = new THREE.PerspectiveCamera();
    this.camera.layers.set(0);
    this.textureMatrix = new THREE.Matrix4();
    this.rt = new THREE.WebGLRenderTarget(16, 16, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.hide = []; // meshes hidden during the reflection pass (ground)
    this._n = new THREE.Vector3(0, 1, 0);
    this._p = new THREE.Vector3();
    this._plane = new THREE.Plane();
    this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
    this._view = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this._look = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
  }
  setSize(w, h) {
    this.rt.setSize(Math.max(16, Math.floor(w * this.scale)), Math.max(16, Math.floor(h * this.scale)));
  }
  update(scene, camera) {
    const { _n: normal, _p: refPos, _view: view, _target: target, _rot: rot, _look: look, _camPos: camPos } = this;
    const vc = this.camera;
    camPos.setFromMatrixPosition(camera.matrixWorld);
    view.subVectors(refPos, camPos);
    if (view.dot(normal) > 0) return;
    view.reflect(normal).negate().add(refPos);
    rot.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rot).add(camPos);
    target.subVectors(refPos, look).reflect(normal).negate().add(refPos);
    vc.position.copy(view);
    vc.up.set(0, 1, 0).applyMatrix4(rot).reflect(normal);
    vc.lookAt(target);
    vc.far = camera.far; vc.near = camera.near;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);

    // oblique near plane clipping
    this._plane.setFromNormalAndCoplanarPoint(normal, refPos).applyMatrix4(vc.matrixWorldInverse);
    const clip = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const pm = vc.projectionMatrix.elements, q = this._q;
    q.x = (Math.sign(clip.x) + pm[8]) / pm[0];
    q.y = (Math.sign(clip.y) + pm[9]) / pm[5];
    q.z = -1.0;
    q.w = (1.0 + pm[10]) / pm[14];
    clip.multiplyScalar(2.0 / clip.dot(q));
    pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1.0 - 0.003; pm[14] = clip.w;
    vc.projectionMatrixInverse.copy(vc.projectionMatrix).invert();

    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevShadow = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    for (const m of this.hide) m.visible = false;
    r.setRenderTarget(this.rt);
    r.clear();
    r.render(scene, vc);
    for (const m of this.hide) m.visible = true;
    r.setRenderTarget(prevRT);
    r.shadowMap.autoUpdate = prevShadow;
  }
}

// GLSL helpers shared by the ground shader
const NOISE = /* glsl */`
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec2 h22(vec2 p){ float n = h21(p); return vec2(n, h21(p+n)); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
// rain ripples: returns height-gradient (xz) of expanding rings
vec2 ripples(vec2 uv, float t){
  vec2 grad = vec2(0.0);
  for(int layer=0; layer<2; layer++){
    vec2 p = uv * (layer==0 ? 2.2 : 3.1) + float(layer)*7.31;
    vec2 cell = floor(p);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 c = cell + vec2(i,j);
      vec2 rnd = h22(c);
      vec2 center = c + 0.15 + rnd*0.7;
      float period = 0.9 + rnd.x*0.6;
      float tt = fract(t/period + rnd.y);
      vec2 d = p - center; float dist = length(d);
      float radius = tt * 0.55;
      float x = (dist - radius) * 28.0;
      float ring = sin(x) * exp(-x*x*0.08) * (1.0-tt) * (1.0-tt);
      grad += (dist > 0.001 ? d/dist : vec2(0.0)) * ring * step(dist, 0.62);
    }
  }
  return grad;
}
`;

// Region-based wet ground: asphalt road, concrete pavement, glossy tiles inside the store.
export function createGroundMaterial(refl, opts) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.25 });
  const uniforms = {
    uReflMap: { value: refl.rt.texture },
    uReflMatrix: { value: refl.textureMatrix },
    uTime: { value: 0 },
    uStore: { value: new THREE.Vector4(-7, 7, -16, -6.5) }, // minX, maxX, minZ, maxZ
    uRoad: { value: new THREE.Vector2(-3.5, 3.5) },
    uStopMap: { value: opts.stopMap },
    uStopRect: { value: new THREE.Vector4(10.2, 12.6, -2.6, -0.6) }, // x0,x1,z0,z1
    uReflBoost: { value: 1.0 },
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat4 uReflMatrix; varying vec4 vReflCoord; varying vec3 vWPos;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 gWP = modelMatrix * vec4(transformed, 1.0); vWPos = gWP.xyz; vReflCoord = uReflMatrix * gWP;`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uReflMap; uniform sampler2D uStopMap; uniform float uTime; uniform float uReflBoost;
        uniform vec4 uStore; uniform vec2 uRoad; uniform vec4 uStopRect;
        varying vec4 vReflCoord; varying vec3 vWPos;
        ${NOISE}
        float gPuddle; float gWet; float gRegion; float gReflK; vec2 gRip; float gGloss;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 P = vWPos.xz;
          bool inStore = P.x > uStore.x && P.x < uStore.y && P.y > uStore.z && P.y < uStore.w;
          bool onRoad = P.y > uRoad.x && P.y < uRoad.y;
          vec3 col; float n = fbm(P*0.9); float fine = vnoise(P*18.0);
          if (inStore) {
            // 60cm glossy tiles
            vec2 tg = abs(fract(P/0.6) - 0.5);
            float grout = smoothstep(0.485, 0.495, max(tg.x, tg.y));
            vec2 tid = floor(P/0.6);
            col = mix(vec3(0.80,0.80,0.78) * (0.95 + 0.05*h21(tid)), vec3(0.45,0.45,0.44), grout);
            gRegion = 2.0; gWet = 0.0;
            // wet footprints near the entrance
            float near = smoothstep(2.6, 0.0, length((P - vec2(4.2, -7.0))*vec2(0.7,1.0)));
            gPuddle = smoothstep(0.55, 0.75, fbm(P*2.5)) * near;
            gGloss = 1.0;
          } else if (onRoad) {
            col = vec3(0.075,0.078,0.085) * (0.7 + 0.5*n) * (0.85 + 0.3*fine);
            // patched asphalt
            col *= 1.0 - 0.25*smoothstep(0.62, 0.64, vnoise(P*0.25 + 3.0));
            // white edge lines (pedestrian strips)
            float edge = step(abs(abs(P.y) - 2.75), 0.06);
            // crosswalk stripes at x = -14
            float cw = step(abs(P.x + 14.0), 2.0) * step(0.5, fract(P.y/0.9)) * step(abs(P.y), 3.0);
            // stop line before the crosswalk-like marking
            float stopL = step(abs(P.x - 13.3), 0.15) * step(P.y, 0.0) * step(-2.7, P.y);
            float paint = max(max(edge * (1.0 - step(abs(P.x + 14.0), 2.1)), cw), stopL);
            // 止まれ text
            vec2 suv = (P - uStopRect.xz) / (uStopRect.yw - uStopRect.xz);
            if (suv.x > 0.0 && suv.x < 1.0 && suv.y > 0.0 && suv.y < 1.0) {
              paint = max(paint, texture2D(uStopMap, vec2(suv.y, suv.x)).a);
            }
            paint *= 0.75 + 0.25*fine;
            col = mix(col, vec3(0.78,0.78,0.74), paint);
            gRegion = 0.0;
            float side = smoothstep(2.2, 3.4, abs(P.y));
            gPuddle = smoothstep(0.52, 0.64, fbm(P*0.32 + 11.0) + side*0.12 - paint*0.15);
            gWet = 1.0; gGloss = 0.0;
          } else {
            // concrete pavement + gutter strips at the road edge
            float gutter = step(abs(abs(P.y) - 3.7), 0.2);
            vec2 slab = abs(fract(P/vec2(1.5, 1.5)) - 0.5);
            float joint = smoothstep(0.48, 0.495, max(slab.x, slab.y));
            col = vec3(0.30,0.30,0.31) * (0.8 + 0.35*n) * (0.9 + 0.2*fine);
            col = mix(col, col*0.4, joint);
            if (gutter > 0.5) {
              float grate = step(0.6, fract(P.x*5.0)) * step(abs(abs(P.y)-3.7), 0.08);
              col = mix(vec3(0.24,0.24,0.25)*(0.8+0.3*n), vec3(0.01), grate);
            }
            gRegion = 1.0;
            gPuddle = smoothstep(0.58, 0.7, fbm(P*0.45 + 4.0)) * (1.0 - gutter);
            gWet = 0.85; gGloss = 0.0;
          }
          col = mix(col, col*0.55, gPuddle*0.8*gWet);   // water darkens
          diffuseColor.rgb = col;
          gRip = (inStore) ? vec2(0.0) : ripples(P, uTime) * (0.25 + 0.75*gPuddle);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = gRegion > 1.5 ? mix(0.16, 0.05, gPuddle) : mix(mix(0.42, 0.55, gRegion), 0.04, gPuddle);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          float k = gRegion > 1.5 ? 0.0 : 0.35;
          vec3 nW = normalize(vec3(-gRip.x*k, 1.0, -gRip.y*k) + vec3((vnoise(vWPos.xz*30.0)-0.5)*0.04*(1.0-gPuddle), 0.0, 0.0));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 V = normalize(cameraPosition - vWPos);
          float fres = 0.04 + 0.96*pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
          vec2 baseUV = vReflCoord.xy / vReflCoord.w;
          vec2 dist = gRip * (gRegion > 1.5 ? 0.0 : 0.018);
          vec3 sharp = textureLod(uReflMap, baseUV + dist, 0.0).rgb;
          // streaky blurred reflection for wet asphalt / concrete
          vec3 streak = vec3(0.0); float wsum = 0.0;
          for (int i = -3; i <= 3; i++) {
            float fi = float(i); float w = exp(-fi*fi*0.18);
            streak += textureLod(uReflMap, baseUV + dist + vec2(0.0, fi*0.016), 3.5).rgb * w; wsum += w;
          }
          streak /= wsum;
          vec3 refl; float amt;
          if (gRegion > 1.5) { refl = mix(textureLod(uReflMap, baseUV, 1.5).rgb, sharp, gPuddle); amt = mix(0.32, 0.8, gPuddle); }
          else { refl = mix(streak, sharp, gPuddle); amt = gWet * mix(0.5, 1.0, gPuddle); }
          float f = mix(fres, 1.0, gRegion > 1.5 ? 0.25 : 0.5);
          outgoingLight = outgoingLight * (1.0 - amt*f*0.6) + refl * amt * f * uReflBoost;
        }
        #include <opaque_fragment>`);
  };
  return mat;
}
