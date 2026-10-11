// Post-processing: bloom, cinematic grade (vignette, grain, chromatic fringe), tone mapping
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + off).b;
      // split-tone: cool shadows, warm highlights (linear HDR)
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 cool = vec3(0.82, 0.95, 1.18), warm = vec3(1.08, 1.0, 0.9);
      col *= mix(cool, warm, smoothstep(0.05, 1.2, lum));
      col += vec3(0.004, 0.007, 0.014);              // lifted, bluish blacks
      col *= 1.0 - smoothstep(0.12, 0.62, r2) * 0.55; // vignette
      col += (h(vUv * uRes + fract(uTime) * 91.7) - 0.5) * 0.018 * (0.4 + lum);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

// guards the bloom chain against stray NaN/Inf pixels and clamps fireflies
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: GradeShader.vertexShader,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || any(isinf(c))) c = vec3(0.0);
      gl_FragColor = vec4(clamp(c, 0.0, 48.0), 1.0); }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 2 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(SanitizeShader));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.32, 1.8);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return {
    composer, bloom, grade,
    setSize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); grade.uniforms.uRes.value.set(w * pr, h * pr); },
    render(t) { grade.uniforms.uTime.value = t; composer.render(); },
  };
}
