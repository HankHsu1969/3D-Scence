// Canvas-drawn surfaces: building facades, face, hair, fabric, droplets
import { canvasTex, roundRect, mulberry32, FONT_JP } from './utils.js';

// Upper-floor facade with windows. Returns color + emissive maps.
export function facadeTex({ w = 10, h = 9, floors = 3, base = '#5d6068', cols = 4, lit = 0.45, seed = 1, balcony = false, ppm = 40 }) {
  const W = Math.round(w * ppm), H = Math.round(h * ppm);
  const r = mulberry32(seed);
  const fh = H / floors;
  const wins = [];
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const cw = W / cols;
      const ww = cw * 0.58, wh = fh * (balcony ? 0.62 : 0.5);
      const x = c * cw + (cw - ww) / 2, y = f * fh + fh * 0.18;
      const on = r() < lit;
      const tone = r();
      const col = !on ? null : tone < 0.55 ? '#ffd7a0' : tone < 0.8 ? '#f4f1e6' : tone < 0.92 ? '#bcd7ff' : '#8fb6ff';
      wins.push({ x, y, ww, wh, on, col, curtain: r(), blind: r() < 0.3 });
    }
  }
  const draw = (g, emissive) => {
    g.fillStyle = emissive ? '#000' : base; g.fillRect(0, 0, W, H);
    if (!emissive) {
      // tile / panel lines
      g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 1;
      for (let y = 0; y < H; y += ppm * 0.25) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      // grime streaks from rain
      for (let i = 0; i < 40; i++) {
        const x = r() * W, y = r() * H * 0.8, l = 20 + r() * 120;
        const grd = g.createLinearGradient(0, y, 0, y + l);
        grd.addColorStop(0, 'rgba(0,0,0,.18)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.fillRect(x, y, 2 + r() * 4, l);
      }
      for (let f = 1; f < floors; f++) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, f * fh - 3, W, 6); }
    }
    for (const wd of wins) {
      if (emissive) {
        if (!wd.on) continue;
        g.fillStyle = wd.col; g.fillRect(wd.x, wd.y, wd.ww, wd.wh);
        // curtains darken parts
        g.fillStyle = 'rgba(0,0,0,.55)';
        if (wd.curtain < 0.5) { g.fillRect(wd.x, wd.y, wd.ww * 0.3, wd.wh); g.fillRect(wd.x + wd.ww * 0.75, wd.y, wd.ww * 0.25, wd.wh); }
        if (wd.blind) for (let y = wd.y; y < wd.y + wd.wh; y += 5) g.fillRect(wd.x, y, wd.ww, 2);
      } else {
        g.fillStyle = '#2a2f3a'; g.fillRect(wd.x - 3, wd.y - 3, wd.ww + 6, wd.wh + 6);
        g.fillStyle = wd.on ? wd.col : '#1a2232'; g.fillRect(wd.x, wd.y, wd.ww, wd.wh);
        g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(wd.x, wd.y, wd.ww, wd.wh * 0.3);
        g.fillStyle = '#3a3f4a'; g.fillRect(wd.x + wd.ww / 2 - 1, wd.y, 2, wd.wh);
      }
      if (balcony && !emissive) {
        g.fillStyle = '#9aa0aa'; g.fillRect(wd.x - 10, wd.y + wd.wh + 4, wd.ww + 20, fh * 0.14);
        g.fillStyle = 'rgba(0,0,0,.25)'; for (let x = wd.x - 10; x < wd.x + wd.ww + 10; x += 6) g.fillRect(x, wd.y + wd.wh + 4, 2, fh * 0.14);
      }
    }
  };
  return { map: canvasTex(W, H, (g) => draw(g, false)), emissiveMap: canvasTex(W, H, (g) => draw(g, true)) };
}

export function shutterTex() {
  return canvasTex(128, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 8) {
      const grd = g.createLinearGradient(0, y, 0, y + 8);
      grd.addColorStop(0, '#9aa1aa'); grd.addColorStop(0.5, '#c4cad2'); grd.addColorStop(1, '#6d737c');
      g.fillStyle = grd; g.fillRect(0, y, w, 8);
    }
  }, { repeat: true });
}

// Anime-style face painted on the head sphere (u=0.25 is the front)
export function faceTex({ skin = '#f3d2bf', eye = '#6b3a24', style = 'girl', blush = true } = {}) {
  return canvasTex(1024, 512, (g, W, H) => {
    g.fillStyle = skin; g.fillRect(0, 0, W, H);
    const cx = W * 0.25, ex = style === 'girl' ? 53 : 44;
    const ey = H * 0.545;
    const ew = style === 'girl' ? 26 : 18, eh = style === 'girl' ? 32 : 14;
    if (blush) {
      for (const s of [-1, 1]) {
        const grd = g.createRadialGradient(cx + s * 70, ey + 40, 2, cx + s * 70, ey + 40, 34);
        grd.addColorStop(0, 'rgba(240,120,130,.45)'); grd.addColorStop(1, 'rgba(240,120,130,0)');
        g.fillStyle = grd; g.fillRect(cx + s * 70 - 40, ey, 80, 80);
      }
    }
    for (const s of [-1, 1]) {
      const x = cx + s * ex;
      if (style === 'old') {
        g.strokeStyle = '#3a2a22'; g.lineWidth = 4; g.beginPath(); g.arc(x, ey + 4, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        g.strokeStyle = '#555'; g.lineWidth = 3; g.beginPath(); g.arc(x, ey, 22, 0, Math.PI * 2); g.stroke();
        continue;
      }
      // sclera
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, ey, ew, eh, 0, 0, Math.PI * 2); g.fill();
      // iris
      const grd = g.createLinearGradient(0, ey - eh, 0, ey + eh);
      grd.addColorStop(0, '#1d0f0a'); grd.addColorStop(0.55, eye); grd.addColorStop(1, '#e0a060');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x + s * 1, ey + 2, ew * 0.78, eh * 0.92, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#120806'; g.beginPath(); g.ellipse(x + s * 1, ey + 3, ew * 0.36, eh * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 6, ey - 8, 6, 7, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 7, ey + 9, 3, 0, Math.PI * 2); g.fill();
      // upper lash line
      g.strokeStyle = '#1a0e0a'; g.lineCap = 'round'; g.lineWidth = style === 'girl' ? 7 : 5;
      g.beginPath(); g.ellipse(x, ey + 3, ew + 3, eh + 2, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      if (style === 'girl') { g.beginPath(); g.moveTo(x + s * (ew + 2), ey - 8); g.lineTo(x + s * (ew + 10), ey - 14); g.stroke(); }
      g.lineWidth = 2; g.beginPath(); g.ellipse(x, ey, ew, eh, 0, Math.PI * 0.25, Math.PI * 0.75); g.stroke();
      // brows
      g.strokeStyle = style === 'girl' ? '#3a2318' : '#20140e'; g.lineWidth = style === 'girl' ? 4 : 7;
      g.beginPath(); g.moveTo(x - 18, ey - eh - 18 + (s > 0 ? 2 : 0)); g.quadraticCurveTo(x, ey - eh - 26, x + 18, ey - eh - 18 + (s < 0 ? 2 : 0)); g.stroke();
    }
    // nose & mouth
    g.fillStyle = 'rgba(180,110,90,.5)'; g.beginPath(); g.ellipse(cx, ey + 44, 3, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = style === 'girl' ? '#b85a52' : '#8a4a40'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - 12, ey + 72); g.quadraticCurveTo(cx, ey + 79, cx + 12, ey + 72); g.stroke();
  });
}

// Long hair curtain: strand streaks (color) + jagged tips (alpha). v=1 root, v=0 tips.
export function hairTex(color = '#1c1418') {
  const r = mulberry32(42);
  const strands = Array.from({ length: 70 }, () => ({ x: r(), len: 0.82 + r() * 0.18, wdt: 0.01 + r() * 0.025 }));
  const map = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      const x = r() * w; const a = r() * 0.12;
      g.fillStyle = r() < 0.5 ? `rgba(255,235,230,${a})` : `rgba(0,0,0,${a * 2})`;
      g.fillRect(x, 0, 1 + r() * 2, h);
    }
    // soft sheen band
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.12, 'rgba(190,200,255,.12)'); grd.addColorStop(0.2, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { aniso: 4 });
  const alphaMap = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h * 0.78);
    for (const s of strands) {
      const x = s.x * w, ww = s.wdt * w * 2;
      g.beginPath(); g.moveTo(x - ww, h * 0.7); g.lineTo(x + ww, h * 0.7); g.lineTo(x, h * s.len); g.closePath(); g.fill();
    }
  }, { srgb: false, aniso: 4 });
  return { map, alphaMap };
}

// Bangs: alpha with pointed strands at the bottom
export function bangsAlphaTex() {
  const r = mulberry32(9);
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h * 0.45);
    const n = 15;
    for (let i = 0; i < n; i++) {
      const x0 = (i / n) * w, x1 = ((i + 1) / n) * w;
      const tip = h * (0.78 + r() * 0.2) * (i === 0 || i === n - 1 ? 1.08 : 1);
      g.beginPath(); g.moveTo(x0 - 6, h * 0.44); g.lineTo(x1 + 6, h * 0.44);
      g.quadraticCurveTo(x1 - (x1 - x0) * 0.2, tip * 0.85, (x0 + x1) / 2 + (r() - 0.5) * 10, tip);
      g.quadraticCurveTo(x0 + (x1 - x0) * 0.2, tip * 0.85, x0 - 6, h * 0.44); g.fill();
    }
  }, { srgb: false });
}

export function plaidTex(base = '#1d2a4a', band = '#2e4a3a', line = '#b8322a') {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.55; g.fillStyle = band;
    g.fillRect(0, 40, w, 40); g.fillRect(40, 0, 40, h);
    g.globalAlpha = 0.9; g.fillStyle = line; g.fillRect(0, 98, w, 3); g.fillRect(98, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 20, w, 1); g.fillRect(20, 0, 1, h);
    g.globalAlpha = 1;
  }, { repeat: true });
}

// transparent droplets for umbrella canopy & glass
export function dropletsTex(count = 260, seed = 5) {
  const r = mulberry32(seed);
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < count; i++) {
      const x = r() * w, y = r() * h, rad = 2 + r() * r() * 9;
      const grd = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
      grd.addColorStop(0, 'rgba(255,255,255,.95)'); grd.addColorStop(0.35, 'rgba(220,235,255,.35)');
      grd.addColorStop(0.85, 'rgba(255,255,255,.12)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.beginPath(); g.ellipse(x, y, rad, rad * (1 + r() * 0.4), 0, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: true });
}

// glass rain streaks for windows (alpha)
export function glassStreakTex() {
  const r = mulberry32(31);
  return canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, l = 30 + r() * 160;
      const grd = g.createLinearGradient(0, y, 0, y + l);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.8, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,.8)');
      g.fillStyle = grd; g.fillRect(x, y, 1.5 + r() * 1.5, l);
      g.beginPath(); g.arc(x + 1, y + l, 2.5, 0, Math.PI * 2); g.fill();
    }
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(255,255,255,${0.15 + r() * 0.4})`; g.beginPath(); g.arc(r() * w, r() * h, 0.6 + r() * 1.8, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: true });
}

export function laundryInteriorTex() {
  return canvasTex(1024, 384, (g, w, h) => {
    g.fillStyle = '#e9f2fb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfdced'; g.fillRect(0, h * 0.75, w, h * 0.25);
    for (let i = 0; i < 7; i++) {
      const x = 40 + i * 140;
      g.fillStyle = '#f7f9fc'; roundRect(g, x, 70, 110, 220, 10); g.fill();
      g.strokeStyle = '#9fb3c8'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#5d7590'; g.beginPath(); g.arc(x + 55, 190, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#a9c4e0'; g.beginPath(); g.arc(x + 55, 190, 30, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2b88d8'; g.fillRect(x + 20, 90, 70, 20);
    }
    g.fillStyle = '#ffcf2e'; g.fillRect(0, 0, w, 40);
    g.fillStyle = '#16306b'; g.font = `900 28px ${FONT_JP}`; g.textAlign = 'center'; g.fillText('乾燥機 10分 100円', w / 2, 30);
  });
}

export function shojiTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffd9a0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#4a2a14';
    for (let x = 0; x <= w; x += 42) g.fillRect(x - 3, 0, 6, h);
    for (let y = 0; y <= h; y += 64) g.fillRect(0, y - 3, w, 6);
  });
}

export function acUnitTex() {
  return canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = '#d9dcd8'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a5d60'; g.beginPath(); g.arc(46, 48, 34, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c8cbc7'; g.lineWidth = 2;
    for (let r = 8; r < 34; r += 6) { g.beginPath(); g.arc(46, 48, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#b5b8b4'; g.fillRect(90, 10, 30, 76);
  });
}
