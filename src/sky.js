// Night sky dome with drifting low clouds lit by the city, plus a PMREM environment map
import * as THREE from 'three';

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uTime;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.1; a*=0.5; } return s; }
      void main(){
        float y = vDir.y;
        vec3 top = vec3(0.010, 0.014, 0.030);
        vec3 mid = vec3(0.035, 0.045, 0.085);
        vec3 glow = vec3(0.16, 0.10, 0.12);
        vec3 col = mix(mid, top, smoothstep(0.05, 0.6, y));
        col += glow * exp(-max(y, 0.0) * 7.0) * 0.9;
        vec2 uv = vDir.xz / max(y + 0.25, 0.05);
        float c = fbm(uv * 0.9 + vec2(uTime * 0.012, uTime * 0.004));
        col += vec3(0.07, 0.06, 0.09) * smoothstep(0.35, 0.85, c) * smoothstep(0.0, 0.25, y + 0.05);
        col = max(col, vec3(0.0));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

export function createEnvMap(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 40), new THREE.MeshBasicMaterial({ color: 0x0b1222, side: THREE.BackSide }));
  env.add(room);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x050608 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -9.9; env.add(ground);
  const panel = (w, h, color, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; env.add(m);
  };
  panel(16, 5, new THREE.Color(1.0, 0.86, 0.66).multiplyScalar(3.0), 0, -4, -19.5);       // store windows
  panel(16, 1.5, new THREE.Color(1, 1, 1).multiplyScalar(4.0), 0, 0, -19.5);              // signboard
  panel(1.2, 6, new THREE.Color(1.0, 0.2, 0.55).multiplyScalar(3.0), 12, -2, 19.5);       // neon
  panel(1.2, 6, new THREE.Color(0.2, 0.8, 1.0).multiplyScalar(3.0), -10, -2, 19.5);
  panel(3, 3, new THREE.Color(0.6, 0.75, 1.0).multiplyScalar(2.0), 19.5, 6, 0, -Math.PI / 2); // street lamp
  panel(3, 3, new THREE.Color(0.6, 0.75, 1.0).multiplyScalar(2.0), -19.5, 6, 0, Math.PI / 2);
  panel(2, 2, new THREE.Color(1.0, 0.3, 0.15).multiplyScalar(2.0), 15, -6, 15);           // lantern
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}
