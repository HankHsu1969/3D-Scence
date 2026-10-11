// Store interior: gondola shelves with goods, drink fridges, open chilled case, magazines, freezers
import * as THREE from 'three';
import { std, glow, glowMap, boxAt, mesh, addBox, rand, randInt, noReflect, mulberry32 } from './utils.js';
import { productAtlas, bottleAtlas, magazineAtlas, bentoTex, onigiriTex, priceTagTex } from './tex-items.js';
import { hangingSignTex } from './tex-signs.js';

// material sampling a sub-tile of an atlas, chosen per instance via `aTile`
export function atlasMaterial(map, grid, params = {}, gridY = grid) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.55, ...params });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_MAP
        { vec2 o = vec2(mod(aTile, ${grid}.0), ${gridY}.0 - 1.0 - floor(aTile / ${grid}.0));
          vMapUv = (vMapUv + o) / vec2(${grid}.0, ${gridY}.0); }
        #endif
        #ifdef USE_EMISSIVEMAP
        { vec2 o = vec2(mod(aTile, ${grid}.0), ${gridY}.0 - 1.0 - floor(aTile / ${grid}.0));
          vEmissiveMapUv = (vEmissiveMapUv + o) / vec2(${grid}.0, ${gridY}.0); }
        #endif`);
  };
  m.customProgramCacheKey = () => `atlas${grid}x${gridY}`;
  return m;
}

// Collects instance transforms then builds a single InstancedMesh
class Batch {
  constructor(geo, mat, tiles = 16) { this.geo = geo; this.mat = mat; this.items = []; this.tiles = tiles; }
  add(x, y, z, sx, sy, sz, ry = 0, tile = -1, color = null) { this.items.push({ x, y, z, sx, sy, sz, ry, tile: tile < 0 ? randInt(0, this.tiles - 1) : tile, color }); }
  build(parent) {
    const n = this.items.length;
    const im = new THREE.InstancedMesh(this.geo, this.mat, n);
    const tile = new Float32Array(n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    this.items.forEach((it, i) => {
      q.setFromEuler(e.set(0, it.ry, 0)); s.set(it.sx, it.sy, it.sz); p.set(it.x, it.y, it.z);
      im.setMatrixAt(i, m.compose(p, q, s));
      tile[i] = it.tile;
      if (it.color) im.setColorAt(i, it.color);
    });
    this.geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 1));
    parent.add(im);
    return im;
  }
}

export function buildInterior(scene) {
  const g = new THREE.Group(); g.name = 'interior'; scene.add(g);
  const white = std(0xf3f3f0, 0.6);
  const grey = std(0xc9ccd0, 0.5, 0.3);
  const dark = std(0x30343b, 0.5, 0.5);
  const shelfMat = std(0xe6e8ea, 0.45, 0.2);
  const tagTex = priceTagTex(); tagTex.wrapS = THREE.RepeatWrapping;

  const prodGeo = new THREE.BoxGeometry(1, 1, 1); prodGeo.translate(0, 0.5, 0);
  const products = new Batch(prodGeo, atlasMaterial(productAtlas(), 4, { roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.06 }));
  products.mat.emissiveMap = products.mat.map;

  // ---------- gondola shelves ----------
  const gondola = (cx, z0, z1) => {
    const len = z1 - z0, cz = (z0 + z1) / 2;
    boxAt(g, 0.95, 0.14, len, dark, cx, 0, cz);
    boxAt(g, 0.06, 1.5, len, std(0xdfe2e6, 0.6), cx, 0.14, cz);
    boxAt(g, 1.0, 0.04, len + 0.04, white, cx, 1.64, cz);
    for (const side of [-1, 1]) {
      for (const y of [0.14, 0.5, 0.86, 1.22]) {
        boxAt(g, 0.44, 0.025, len, shelfMat, cx + side * 0.25, y, cz);
        const tag = mesh(new THREE.PlaneGeometry(len, 0.035), new THREE.MeshBasicMaterial({ map: tagTex }), cx + side * 0.475, y - 0.005, cz, g, side * Math.PI / 2);
        tag.material = tag.material.clone(); tag.material.map = tagTex.clone(); tag.material.map.repeat.set(len / 1.6, 1); tag.material.map.needsUpdate = true;
        noReflect(tag);
        // fill shelf with goods
        let z = z0 + 0.03;
        const maxH = y > 1.2 ? 0.3 : 0.31;
        while (z < z1 - 0.1) {
          const w = rand(0.07, 0.16), h = rand(0.1, maxH), d = rand(0.2, 0.36), t = randInt(0, 15);
          const facings = randInt(1, 3);
          for (let k = 0; k < facings && z + w < z1 - 0.02; k++) {
            products.add(cx + side * (0.46 - d / 2), y + 0.025, z + w / 2, w, h, d, side * Math.PI / 2, t);
            z += w + 0.008;
          }
          z += 0.01;
        }
      }
    }
    addBox(cx - 0.5, cx + 0.5, z0, z1, { maxY: 1.7 });
  };
  gondola(-4.3, -13.6, -9.4);
  gondola(-1.8, -13.6, -9.4);
  gondola(0.7, -13.6, -9.4);

  // ---------- ice cream chest freezers (gondola endcaps) ----------
  for (const cx of [-4.3, -1.8]) {
    boxAt(g, 1.0, 0.8, 0.6, std(0xf6f6f6, 0.4), cx, 0, -9.0);
    const lid = mesh(new THREE.PlaneGeometry(0.94, 0.54), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }), cx, 0.805, -9.0, g);
    lid.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 14; i++) products.add(cx + rand(-0.4, 0.4), 0.62, -9.0 + rand(-0.2, 0.2), 0.08, 0.06, 0.14, rand(0, 3), randInt(0, 15));
    mesh(new THREE.PlaneGeometry(0.9, 0.12), glowMap(hangingSignTex('アイスクリーム', '#2a6fd6'), 1.2), cx, 0.65, -8.69, g);
    addBox(cx - 0.5, cx + 0.5, -9.3, -8.7, { maxY: 0.85 });
  }

  // ---------- reach-in drink fridges on the back wall ----------
  const fz = -16, depth = 0.75, fx0 = -6.7, doors = 12, dw = 0.8;
  const fridgeFront = fz + depth;
  const fBody = std(0x23262c, 0.5, 0.4), fcx = fx0 + (doors * dw) / 2;
  boxAt(g, doors * dw, 0.16, depth, fBody, fcx, 0, fz + depth / 2);
  boxAt(g, doors * dw, 0.25, depth, fBody, fcx, 2.08, fz + depth / 2);
  boxAt(g, 0.06, 2.33, depth, fBody, fx0 - 0.03, 0, fz + depth / 2);
  boxAt(g, 0.06, 2.33, depth, fBody, fx0 + doors * dw + 0.03, 0, fz + depth / 2);
  mesh(new THREE.PlaneGeometry(doors * dw, 2.0), glow(0xeaf4ff, 1.6), fx0 + (doors * dw) / 2, 1.12, fz + 0.06, g).userData.photo = { key: 'fridge', rx: 2 };
  boxAt(g, doors * dw, 0.32, 0.1, glowMap(hangingSignTex('つめたい飲みもの', '#2a6fd6'), 1.3), fx0 + (doors * dw) / 2, 2.32, fridgeFront - 0.05);
  const bottleProfile = [[0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.14], [0.03, 0.165], [0.014, 0.195], [0.013, 0.215], [0.0, 0.215]].map(([x, y]) => new THREE.Vector2(x, y));
  const bottleGeo = new THREE.LatheGeometry(bottleProfile, 12);
  const bottleMat = atlasMaterial(bottleAtlas(), 4, { roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 0.45 });
  bottleMat.emissiveMap = bottleMat.map;
  const bottles = new Batch(bottleGeo, bottleMat);
  const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 12); canGeo.translate(0, 0.061, 0);
  const canMat = atlasMaterial(bottleAtlas(), 4, { roughness: 0.3, metalness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.4 });
  canMat.emissiveMap = canMat.map;
  const cans = new Batch(canGeo, canMat);
  const glassDoor = new THREE.MeshPhysicalMaterial({ color: 0xe8f2ff, transparent: true, opacity: 0.12, roughness: 0.03, depthWrite: false, envMapIntensity: 1.2 });
  for (let d = 0; d < doors; d++) {
    const x0 = fx0 + d * dw;
    boxAt(g, 0.04, 2.1, 0.06, std(0x9aa0a8, 0.3, 0.8), x0, 0.1, fridgeFront);
    mesh(new THREE.PlaneGeometry(dw - 0.05, 1.96), glassDoor, x0 + dw / 2, 1.12, fridgeFront + 0.01, g);
    boxAt(g, 0.02, 0.6, 0.04, std(0xd0d4da, 0.3, 0.9), x0 + dw - 0.08, 0.9, fridgeFront + 0.04); // handle
    mesh(new THREE.PlaneGeometry(0.015, 1.9), glow(0xffffff, 4), x0 + 0.03, 1.12, fridgeFront - 0.03, g);
    const tile = randInt(0, 15);
    for (let s = 0; s < 5; s++) {
      const y = 0.18 + s * 0.38;
      boxAt(g, dw - 0.04, 0.015, depth - 0.12, std(0xdfe4ea, 0.4, 0.3), x0 + dw / 2, y - 0.015, fz + depth / 2);
      const isCan = s === 4 || (s === 0 && d % 3 === 0);
      const t = (tile + s * 3) % 16;
      const count = isCan ? 10 : 9;
      for (let i = 0; i < count; i++) {
        const x = x0 + 0.06 + i * ((dw - 0.12) / (count - 1));
        for (let row = 0; row < 2; row++) {
          const z = fridgeFront - 0.1 - row * 0.12;
          if (isCan) cans.add(x, y, z, 1, 1, 1, rand(0, 6), (t + (i > 4 ? 1 : 0)) % 16);
          else bottles.add(x, y, z, 1, 1, 1, rand(-0.4, 0.4), (t + (i > 5 ? 2 : 0)) % 16);
        }
      }
    }
  }
  addBox(fx0, fx0 + doors * dw, fz, fridgeFront + 0.05, { maxY: 2.4 });

  // ---------- open chilled multideck on the left wall: onigiri / bento ----------
  const cx = -6.62, cz0 = -15.2, cz1 = -8.0, clen = cz1 - cz0, ccz = (cz0 + cz1) / 2;
  boxAt(g, 0.8, 0.55, clen, std(0x2b2f36, 0.5, 0.4), cx + 0.02, 0, ccz);
  boxAt(g, 0.12, 2.1, clen, std(0x3a3f47, 0.5, 0.4), cx - 0.32, 0, ccz);
  boxAt(g, 0.8, 0.12, clen, std(0x2b2f36, 0.5, 0.4), cx + 0.02, 2.0, ccz);
  mesh(new THREE.PlaneGeometry(clen, 0.05), glow(0xffffff, 5), cx + 0.41, 1.98, ccz, g, Math.PI / 2).rotation.x = 0;
  mesh(new THREE.PlaneGeometry(clen, 1.4), glow(0xf2f6ff, 1.1), cx - 0.25, 1.25, ccz, g, Math.PI / 2);
  const oniGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.035, 3); oniGeo.rotateX(Math.PI / 2); oniGeo.rotateZ(Math.PI);
  const oniMat = new THREE.MeshStandardMaterial({ map: onigiriTex(), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.15 });
  oniMat.emissiveMap = oniMat.map;
  const onigiri = new THREE.InstancedMesh(oniGeo, oniMat, 400);
  const bentoGeo = new THREE.BoxGeometry(1, 1, 1); bentoGeo.translate(0, 0.5, 0);
  const bentoMat = atlasMaterial(bentoTex(), 2, { roughness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.12 });
  bentoMat.emissiveMap = bentoMat.map;
  const bento = new Batch(bentoGeo, bentoMat, 4);
  let oi = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  [0.55, 0.92, 1.29, 1.66].forEach((y, level) => {
    boxAt(g, 0.55, 0.02, clen, std(0xdfe4ea, 0.4, 0.3), cx + 0.1, y, ccz);
    mesh(new THREE.PlaneGeometry(clen, 0.035), new THREE.MeshBasicMaterial({ map: tagTex }), cx + 0.381, y - 0.01, ccz, g, Math.PI / 2);
    for (let z = cz0 + 0.08; z < cz1 - 0.08;) {
      if (level >= 2) { // onigiri rows
        for (let r = 0; r < 3 && oi < 400; r++) {
          q.setFromEuler(e.set(-0.25, Math.PI / 2, 0, 'YXZ'));
          m4.compose(new THREE.Vector3(cx + 0.3 - r * 0.12, y + 0.06, z), q, new THREE.Vector3(1, 1, 1));
          onigiri.setMatrixAt(oi++, m4);
        }
        z += 0.12;
      } else {
        const w = rand(0.16, 0.22);
        for (let r = 0; r < 2; r++) bento.add(cx + 0.24 - r * 0.2, y + 0.02 + r * 0.0, z + w / 2, w - 0.01, 0.05, 0.19, Math.PI / 2, randInt(0, 3));
        z += w;
      }
    }
  });
  onigiri.count = oi; g.add(onigiri);
  addBox(cx - 0.4, cx + 0.42, cz0, cz1, { maxY: 2.1 });
  const hs = mesh(new THREE.PlaneGeometry(1.6, 0.4), glowMap(hangingSignTex('おにぎり・お弁当', '#0f9c8c'), 1.3), cx + 0.43, 2.3, ccz, g, Math.PI / 2);

  // ---------- magazine rack along the front window ----------
  const mz = -6.86, mx0 = -6.7, mx1 = 1.2, mlen = mx1 - mx0;
  boxAt(g, mlen, 0.5, 0.36, std(0x2b2f36, 0.5, 0.4), (mx0 + mx1) / 2, 0, mz);
  const magGeo = new THREE.BoxGeometry(1, 1, 1);
  const magMat = atlasMaterial(magazineAtlas(), 4, { roughness: 0.45, emissive: 0xffffff, emissiveIntensity: 0.08 }, 2);
  magMat.emissiveMap = magMat.map;
  const mags = new Batch(magGeo, magMat, 8);
  for (let tier = 0; tier < 3; tier++) {
    const y = 0.55 + tier * 0.22, z = mz - 0.12 + tier * 0.1;
    const shelf = boxAt(g, mlen, 0.02, 0.18, std(0xd8dade, 0.4, 0.4), (mx0 + mx1) / 2, y - 0.02, z);
    for (let x = mx0 + 0.15; x < mx1 - 0.12; x += 0.25) {
      const mm = mags.add(x, y + 0.14, z - 0.03, 0.21, 0.28, 0.012, 0, randInt(0, 7));
    }
  }
  // tilt magazines back a little
  mags.items.forEach((it) => { it.ry = Math.PI; });
  addBox(mx0, mx1, -7.1, -6.6, { maxY: 1.2 });

  // ---------- hanging aisle signs ----------
  const signs = [['お菓子', -3.05, '#f28a1e'], ['カップ麺・食品', -0.55, '#c0281e'], ['日用品', 1.95, '#2f8a3c']];
  for (const [t, x, c] of signs) {
    const tex = hangingSignTex(t, c);
    for (const s of [-1, 1]) mesh(new THREE.PlaneGeometry(1.4, 0.35), glowMap(tex, 1.2), x, 2.45, -11.5 + s * 0.01, g, s > 0 ? 0 : Math.PI);
    for (const dx of [-0.6, 0.6]) boxAt(g, 0.01, 0.38, 0.01, grey, x + dx, 2.62, -11.5);
  }

  const builtProducts = products.build(g);
  builtProducts.userData.photo = { key: 'products', atlas: true };
  bottles.build(g); cans.build(g); bento.build(g);
  mags.build(g).userData.photo = { key: 'magazines', atlas: true };
  noReflect(builtProducts);
  g.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
  return g;
}
