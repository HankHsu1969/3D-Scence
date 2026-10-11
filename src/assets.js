// Photo-real textures generated on Higgsfield (H站, GPT Image 2). Meshes tagged with
// userData.photo get their canvas artwork swapped for these; missing files keep the canvas art.
import * as THREE from 'three';

const FILES = ['skyline', 'facade_apartment', 'facade_mixed', 'shutters', 'laundry', 'ramen', 'fridge',
  'cigarettes', 'posters', 'magazines', 'products', 'vending_red', 'vending_blue'];

// real-world size (m) that one image covers, used to set texture repeat
const SPAN = { facade_apartment: [16, 12], facade_mixed: [12, 9], shutters: [6.5, 2.8] };

export function loadPhotoAssets() {
  const loader = new THREE.TextureLoader();
  return Promise.all(FILES.map((name) => new Promise((resolve) => {
    loader.load(`assets/photo/${name}.jpg`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      resolve([name, t]);
    }, undefined, () => resolve([name, null]));
  }))).then((pairs) => Object.fromEntries(pairs));
}

function variant(tex, { repeat = [1, 1], offset = [0, 0], wrap = true } = {}) {
  const t = tex.clone();
  if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat); t.offset.set(...offset);
  t.needsUpdate = true;
  return t;
}

// emissive mask for vending machines: only the upper display window glows
function vendingEmissive(tex) {
  const img = tex.image, c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.fillStyle = '#000';
  g.fillRect(0, c.height * 0.6, c.width, c.height * 0.4);
  g.fillRect(0, 0, c.width * 0.06, c.height); g.fillRect(c.width * 0.94, 0, c.width * 0.06, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export function applyPhotoAssets(scene, A) {
  const quads = [[0, 0.5], [0.5, 0.5], [0, 0], [0.5, 0]]; // TL, TR, BL, BR of a 2x2 sheet
  const vend = {};
  scene.traverse((o) => {
    const p = o.userData.photo;
    if (!p || !o.material) return;
    const tex = A[p.key];
    if (!tex) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (p.atlas) {
      // instanced atlases keep their per-instance tile shader, only the image changes
      for (const m of mats) { m.map = tex; if (m.emissiveMap) m.emissiveMap = tex; m.needsUpdate = true; }
      return;
    }
    if (p.vending) {
      const m = mats[4];
      vend[p.key] ||= vendingEmissive(tex);
      m.map = tex; m.emissiveMap = vend[p.key]; m.emissiveIntensity = 1.5; m.needsUpdate = true;
      return;
    }
    let t;
    if (SPAN[p.key]) t = variant(tex, { repeat: [p.w / SPAN[p.key][0], p.h / SPAN[p.key][1]] });
    else if (p.q !== undefined) t = variant(tex, { repeat: [0.5, 0.5], offset: quads[p.q], wrap: false });
    else t = variant(tex, { repeat: [p.rx || 1, 1] });
    for (const m of mats) {
      m.map = t;
      if (m.emissiveMap !== undefined && m.emissive) { m.emissiveMap = t; }
      m.needsUpdate = true;
    }
    if (p.key.startsWith('facade')) { mats[0].emissiveIntensity = 1.0; mats[0].color.setScalar(0.75); }
  });

  // distant skyline backdrop wrapped around the city, fading into the sky dome at the top
  if (A.skyline) {
    const t = A.skyline.clone(); t.wrapS = THREE.MirroredRepeatWrapping; t.repeat.set(6, 1); t.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: t } }, transparent: true, depthWrite: false, side: THREE.BackSide, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; varying vec2 vUv;
        void main(){
          vec2 uv = vec2(vUv.x * 6.0, vUv.y);
          vec3 c = texture2D(map, uv).rgb;
          float a = smoothstep(1.0, 0.68, vUv.y);
          gl_FragColor = vec4(c * 0.75, a);
          #include <colorspace_fragment>
        }`,
    });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(160, 160, 90, 64, 1, true), mat);
    cyl.position.y = 90 / 2 - 22; cyl.renderOrder = -9; cyl.frustumCulled = false;
    cyl.name = 'skylineBackdrop';
    scene.add(cyl);
    cyl.onBeforeRender = (r, s, cam) => { cyl.position.x = cam.position.x; cyl.position.z = cam.position.z; };
  }
}
