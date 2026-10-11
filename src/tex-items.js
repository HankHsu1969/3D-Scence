// Canvas-drawn goods: product packages, bottles, magazines, vending machines, bento
import { canvasTex, roundRect, fitText, FONT_JP, mulberry32 } from './utils.js';

const R = mulberry32(777);
const rr = (a, b) => a + (b - a) * R();

const PRODUCTS = [
  ['うまチップス', '#f2c230', '#c0281e'], ['チョコバー', '#5a2d14', '#f4d7a8'], ['カップ麺', '#e83a2e', '#ffffff'],
  ['せんべい', '#8a5a2b', '#f5e6c4'], ['フルーツグミ', '#e94f9c', '#ffffff'], ['バタークッキー', '#2a5fb0', '#ffe9a8'],
  ['のり塩', '#2f8a3c', '#ffffff'], ['カレーヌードル', '#f2a219', '#5a2d14'], ['きのこ山', '#6b3e1e', '#ffe08a'],
  ['ミルクキャンディ', '#ffffff', '#2a5fb0'], ['焼そば', '#ffcf2e', '#1c1c1c'], ['ポップコーン', '#e8402f', '#fff3a0'],
  ['ティッシュ', '#bfe3f2', '#1d4e89'], ['洗剤', '#38b6e8', '#ffffff'], ['うどん', '#f7f1df', '#b0261c'], ['のど飴', '#3fae6a', '#ffffff'],
];

export function productAtlas() {
  return canvasTex(1024, 1024, (g) => {
    const s = 256;
    PRODUCTS.forEach(([name, bg, fg], i) => {
      const x = (i % 4) * s, y = Math.floor(i / 4) * s;
      g.fillStyle = bg; g.fillRect(x, y, s, s);
      // decorative bands and bursts
      g.fillStyle = fg; g.globalAlpha = 0.25; g.fillRect(x, y + s * 0.72, s, s * 0.1); g.globalAlpha = 1;
      g.fillStyle = fg; g.beginPath(); g.arc(x + s * 0.5, y + s * 0.42, s * 0.22, 0, Math.PI * 2); g.globalAlpha = 0.35; g.fill(); g.globalAlpha = 1;
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, name, x + s / 2, y + s * 0.42, s - 24, 48, FONT_JP, 900);
      g.font = `700 24px ${FONT_JP}`; g.fillText(['新発売', '期間限定', 'NEW', '大容量', 'お得'][i % 5], x + s / 2, y + s * 0.18);
      g.fillStyle = '#ffffff'; roundRect(g, x + s * 0.62, y + s * 0.84, s * 0.34, s * 0.12, 6); g.fill();
      g.fillStyle = '#c0281e'; g.font = `900 22px Arial`; g.fillText('¥' + (100 + i * 18), x + s * 0.79, y + s * 0.9);
    });
  });
}

const DRINKS = [
  ['緑茶', '#2f8a3c', '#e9f5d0'], ['ほうじ茶', '#8a4b22', '#f3e1c4'], ['天然水', '#7fc8f0', '#ffffff'], ['コーラ', '#b0160e', '#ffffff'],
  ['ブラック', '#1b1b1b', '#d9b26a'], ['カフェラテ', '#c79a6a', '#ffffff'], ['オレンジ', '#f28a1e', '#ffffff'], ['スポーツ', '#2a6fd6', '#ffffff'],
  ['麦茶', '#c78a2c', '#fff7dc'], ['ミルクティー', '#e9cfa8', '#7a3b16'], ['サイダー', '#7ad3f5', '#0d4a8a'], ['エナジー', '#1e1e1e', '#9be22e'],
  ['いちごミルク', '#f6b6c8', '#c0281e'], ['レモン', '#f5e04a', '#2f8a3c'], ['ビール', '#d9a82e', '#ffffff'], ['ジャスミン', '#cfe8b8', '#2f6a3c'],
];
export const DRINK_COLORS = DRINKS.map((d) => d[1]);

export function bottleAtlas() {
  return canvasTex(1024, 1024, (g) => {
    const s = 256;
    DRINKS.forEach(([name, bg, fg], i) => {
      const x = (i % 4) * s, y = Math.floor(i / 4) * s;
      g.fillStyle = bg; g.fillRect(x, y, s, s);
      g.fillStyle = fg; g.globalAlpha = 0.3; g.fillRect(x, y + s * 0.15, s, s * 0.05); g.fillRect(x, y + s * 0.8, s, s * 0.05); g.globalAlpha = 1;
      g.save(); g.translate(x + s / 2, y + s / 2);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      // label wraps around: repeat text twice so it is visible from all sides
      for (const ox of [-s * 0.25, s * 0.25]) {
        g.save(); g.translate(ox, 0); g.rotate(-Math.PI / 2);
        fitText(g, name, 0, 0, s * 0.62, 46, FONT_JP, 900); g.restore();
      }
      g.restore();
    });
  });
}

const MAGS = [
  ['週刊 少年ブレイブ', '#e8402f'], ['月刊 星空', '#16306b'], ['猫の手帖', '#f2c230'], ['東京グルメ', '#c0281e'],
  ['カメラ日和', '#2f8a3c'], ['クルマ通信', '#1b1b1b'], ['ファッションNOW', '#e94f9c'], ['旅と鉄道', '#2a6fd6'],
];
export function magazineAtlas() {
  return canvasTex(1024, 640, (g) => {
    const w = 256, h = 320;
    MAGS.forEach(([title, c], i) => {
      const x = (i % 4) * w, y = Math.floor(i / 4) * h;
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, '#f6f2ea'); grd.addColorStop(1, c);
      g.fillStyle = grd; g.fillRect(x, y, w, h);
      g.fillStyle = c; g.fillRect(x, y, w, 70);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, title, x + w / 2, y + 36, w - 20, 40, FONT_JP, 900);
      // cover "photo"
      g.fillStyle = `hsl(${rr(0, 360)},45%,${rr(45, 70)}%)`; g.beginPath(); g.ellipse(x + w / 2, y + 190, 70, 90, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = `700 20px ${FONT_JP}`;
      g.fillText('特集 秋の夜長に', x + w / 2, y + 296);
    });
  });
}

// Vending machine front: lit display of drinks, buttons, slot
export function vendingTex(body = '#c62d24') {
  const draw = (g, w, h, emissive) => {
    g.fillStyle = emissive ? '#000' : body; g.fillRect(0, 0, w, h);
    // logo strip
    if (!emissive) { g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 40px ${FONT_JP}`; g.fillText('つめた〜い / あったか〜い', w / 2, 34); }
    // display window
    const dx = 26, dy = 64, dw = w - 52, dh = 560;
    g.fillStyle = emissive ? '#ccd8e6' : '#e8f1fb'; g.fillRect(dx, dy, dw, dh);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const cx = dx + 18 + col * ((dw - 36) / 6) + (dw - 36) / 12, cy = dy + 30 + row * 136;
        const d = DRINKS[(row * 6 + col * 5 + 3) % DRINKS.length];
        if (emissive) { g.fillStyle = '#fff'; g.fillRect(cx - 26, cy - 10, 52, 120); continue; }
        g.fillStyle = d[1]; roundRect(g, cx - 18, cy, 36, 86, 8); g.fill();
        g.fillStyle = '#eee'; g.fillRect(cx - 8, cy - 10, 16, 12);
        g.fillStyle = d[2]; g.fillRect(cx - 18, cy + 30, 36, 18);
        g.fillStyle = '#1b1b1b'; g.font = `700 16px Arial`; g.textAlign = 'center'; g.fillText('¥' + (110 + ((row + col) % 4) * 20), cx, cy + 104);
        g.fillStyle = (row + col) % 3 === 0 ? '#e33' : '#36f'; g.fillRect(cx - 10, cy + 112, 20, 8);
      }
    }
    // lower panel
    g.fillStyle = emissive ? '#000' : '#202020'; g.fillRect(dx, 650, dw, 120);
    if (emissive) { g.fillStyle = '#4af'; g.fillRect(dx + dw - 120, 670, 90, 30); }
    else {
      g.fillStyle = '#0a0a0a'; g.fillRect(dx + 20, 670, 140, 80);
      g.fillStyle = '#4af'; g.fillRect(dx + dw - 120, 670, 90, 30);
      g.fillStyle = '#ccc'; g.fillRect(dx + dw - 110, 715, 70, 30);
    }
    // dispensing slot
    g.fillStyle = emissive ? '#000' : '#111'; g.fillRect(dx + 40, 820, dw - 80, 120);
    if (!emissive) { g.fillStyle = '#333'; g.fillRect(dx + 46, 826, dw - 92, 40); }
  };
  return {
    map: canvasTex(512, 1024, (g, w, h) => draw(g, w, h, false)),
    // emissive = the lit display window only (same artwork, everything else black)
    emissiveMap: canvasTex(512, 1024, (g, w, h) => {
      draw(g, w, h, false);
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, 64); g.fillRect(0, 624, w, h - 624);
      g.fillRect(0, 64, 26, 560); g.fillRect(w - 26, 64, 26, 560);
      g.fillStyle = '#4af'; g.fillRect(w - 146, 670, 90, 30);
    }),
  };
}

export function cigWallTex() {
  return canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#1d1d22'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 24; col++) {
        const x = 8 + col * 42, y = 10 + row * 62;
        g.fillStyle = ['#e9e9e9', '#2a5fb0', '#c0281e', '#1b1b1b', '#d9b26a', '#2f8a3c', '#7b5ea7'][(row * 7 + col * 3) % 7];
        g.fillRect(x, y, 34, 46);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 4, y + 30, 26, 6);
        g.fillStyle = '#ffd23a'; g.fillRect(x, y + 50, 34, 8);
      }
    }
  });
}

export function bentoTex() {
  return canvasTex(512, 512, (g) => {
    const s = 256;
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * s, y = Math.floor(i / 2) * s;
      g.fillStyle = '#1b1b1b'; g.fillRect(x, y, s, s);
      g.fillStyle = '#f7f5ee'; g.fillRect(x + 12, y + 12, s * 0.5, s - 24); // rice
      g.fillStyle = '#c0281e'; g.beginPath(); g.arc(x + s * 0.3, y + s * 0.5, 14, 0, 7); g.fill(); // umeboshi
      const foods = [['#b8742e', '#f2c230', '#3fae6a'], ['#d98a2b', '#e83a2e', '#7ab648'], ['#6b3e1e', '#ffcf2e', '#e94f9c'], ['#c06a1c', '#f5e04a', '#2f8a3c']][i];
      foods.forEach((c, k) => { g.fillStyle = c; g.beginPath(); g.ellipse(x + s * 0.76, y + 50 + k * 70, 46, 30, k, 0, 7); g.fill(); });
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, s, 30);
    }
  });
}

export function onigiriTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#f8f6f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#121a12'; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = '#c0281e'; g.fillRect(w * 0.35, h * 0.05, w * 0.3, h * 0.1);
  });
}

export function snackCaseTex() {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#c0281e'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 64px ${FONT_JP}`; g.fillText('ホットスナック', w / 2, h / 2 + 4);
  });
}

export function priceTagTex() {
  return canvasTex(512, 32, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 5 === 0 ? '#ffd23a' : '#ffffff'; g.fillRect(i * 32 + 2, 2, 28, h - 4);
      g.fillStyle = '#c0281e'; g.font = `900 16px Arial`; g.textAlign = 'center'; g.fillText('¥' + (98 + i * 20), i * 32 + 16, 22);
    }
  });
}
