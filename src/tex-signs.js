// Canvas-drawn signage: store sign, neon verticals, lanterns, posters, road text
import { canvasTex, roundRect, fitText, vText, FONT_JP, FONT_SERIF } from './utils.js';

const NAVY = '#16306b', TEAL = '#0f9c8c', ORANGE = '#f28a1e';

function star(g, cx, cy, r1, r2, n = 5) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + (i * Math.PI) / n;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

export function logoMark(g, cx, cy, r) {
  g.fillStyle = NAVY; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = ORANGE; star(g, cx, cy - r * 0.05, r * 0.62, r * 0.27); g.fill();
  g.strokeStyle = TEAL; g.lineWidth = r * 0.12; g.beginPath(); g.arc(cx, cy, r * 0.88, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
}

// Main fascia band of the convenience store
export function signboardTex() {
  return canvasTex(2048, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#e8eef6');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // stripes
    g.fillStyle = NAVY; g.fillRect(0, h - 58, w, 22);
    g.fillStyle = TEAL; g.fillRect(0, h - 36, w, 18);
    g.fillStyle = ORANGE; g.fillRect(0, h - 18, w, 18);
    logoMark(g, 150, 98, 70);
    g.fillStyle = NAVY; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = `900 112px ${FONT_JP}`; g.fillText('ほしぞらマート', 250, 104);
    g.font = `800 46px "Segoe UI", Arial, sans-serif`; g.fillStyle = TEAL;
    g.fillText('HOSHIZORA MART', 1130, 82);
    g.fillStyle = ORANGE; g.font = `900 64px "Segoe UI", Arial, sans-serif`;
    g.fillText('24h', 1560, 82);
    g.fillStyle = '#5a6a86'; g.font = `700 30px ${FONT_JP}`;
    g.fillText('いつでも、あなたの夜空に。', 1130, 140);
    logoMark(g, 1900, 98, 70);
  });
}

export function pylonTex() {
  return canvasTex(512, 640, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = NAVY; g.fillRect(0, h - 120, w, 40);
    g.fillStyle = TEAL; g.fillRect(0, h - 80, w, 40);
    g.fillStyle = ORANGE; g.fillRect(0, h - 40, w, 40);
    logoMark(g, w / 2, 170, 120);
    g.fillStyle = NAVY; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 64px ${FONT_JP}`; g.fillText('ほしぞら', w / 2, 360);
    g.font = `900 64px ${FONT_JP}`; g.fillText('マート', w / 2, 432);
    g.fillStyle = ORANGE; g.font = `900 48px "Segoe UI", Arial`; g.fillText('OPEN 24H', w / 2, 500);
  });
}

// Neon-ish vertical protruding sign (突き出し看板)
export function verticalSignTex(text, { bg = '#101010', fg = '#ffffff', border = '#ff3b8d', sub = '', font = FONT_JP, size = 92 } = {}) {
  const chars = [...text].length;
  const h = Math.max(512, 120 + chars * (size + 14) + (sub ? 80 : 0));
  return canvasTex(160, h, (g, w, hh) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, hh);
    g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, hh - 16);
    g.fillStyle = fg;
    vText(g, text, w / 2, 50, size, 14, font);
    if (sub) {
      g.font = `700 26px ${FONT_JP}`; g.fillStyle = border; g.textAlign = 'center';
      g.fillText(sub, w / 2, hh - 50);
    }
  });
}

// Red paper lantern (wrapped around a lathe)
export function lanternTex(text = '焼鳥') {
  return canvasTex(512, 512, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#5a0d06'); grd.addColorStop(0.15, '#d8301c'); grd.addColorStop(0.5, '#ff5a2e');
    grd.addColorStop(0.85, '#d8301c'); grd.addColorStop(1, '#5a0d06');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,10,0,.35)'; g.lineWidth = 2;
    for (let y = 20; y < h; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#140604';
    for (const cx of [w * 0.25, w * 0.75]) vText(g, text, cx, h * 0.5 - [...text].length * 60, 108, 10, FONT_SERIF);
  });
}

export function norenTex(text = 'とり吉') {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#1b2a4a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, 0, 1, h);
    g.fillStyle = '#f2ecdf'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text];
    chars.forEach((c, i) => { g.font = `900 120px ${FONT_SERIF}`; g.fillText(c, (w / chars.length) * (i + 0.5), h * 0.52); });
    g.fillStyle = '#0c1424';
    for (let i = 1; i < chars.length; i++) g.fillRect((w / chars.length) * i - 3, 40, 6, h);
  });
}

const POSTERS = {
  oden: (g, w, h) => {
    g.fillStyle = '#fff4dc'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0281e'; g.fillRect(0, 0, w, 120);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 72px ${FONT_JP}`; g.fillText('おでん', w / 2, 62);
    g.fillStyle = '#5a2d0c'; g.font = `900 46px ${FONT_JP}`; g.fillText('はじめました', w / 2, 170);
    // bowl
    g.fillStyle = '#7a3b16'; g.beginPath(); g.ellipse(w / 2, 330, 150, 70, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#d9a54a'; g.beginPath(); g.ellipse(w / 2, 330, 150, 34, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f5f0e0'; g.beginPath(); g.arc(w / 2 - 60, 300, 36, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#b8742e'; g.fillRect(w / 2 + 10, 270, 60, 50);
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.moveTo(w / 2 - 10, 250); g.lineTo(w / 2 + 30, 310); g.lineTo(w / 2 - 50, 310); g.fill();
    g.fillStyle = '#c0281e'; g.font = `900 40px ${FONT_JP}`; g.fillText('全品 ¥100〜', w / 2, 450);
  },
  karaage: (g, w, h) => {
    g.fillStyle = '#ffd23a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7261e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 40px ${FONT_JP}`; g.fillText('新発売！', w / 2, 52);
    g.font = `900 84px ${FONT_JP}`; g.fillText('からあげ', w / 2, 140);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = ['#c06a1c', '#d98a2b', '#b45c16'][i % 3];
      g.beginPath(); g.ellipse(130 + (i % 3) * 120, 280 + Math.floor(i / 3) * 80, 58, 44, i, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#d7261e'; g.font = `900 64px ${FONT_JP}`; g.fillText('¥238', w / 2, 455);
  },
  baito: (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0f9c8c'; g.fillRect(0, 0, w, 140);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 56px ${FONT_JP}`; g.fillText('アルバイト', w / 2, 52);
    g.font = `900 44px ${FONT_JP}`; g.fillText('募集中！', w / 2, 108);
    g.fillStyle = '#16306b'; g.font = `700 34px ${FONT_JP}`;
    ['深夜 時給 1,450円〜', '週2日・1日4h〜OK', '学生・主婦 歓迎', '未経験でも安心♪'].forEach((t, i) => g.fillText(t, w / 2, 210 + i * 62));
    g.fillStyle = '#f28a1e'; g.font = `900 30px ${FONT_JP}`; g.fillText('お気軽にスタッフまで', w / 2, 470);
  },
  atm: (g, w, h) => {
    g.fillStyle = '#16306b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 120px "Segoe UI", Arial`; g.fillText('ATM', w / 2, 150);
    g.font = `700 40px ${FONT_JP}`; g.fillText('24時間 ご利用OK', w / 2, 270);
    g.fillStyle = '#f28a1e'; g.font = `900 36px ${FONT_JP}`; g.fillText('ほしぞら銀行', w / 2, 360);
    g.fillStyle = '#9fc1ff'; g.font = `500 28px ${FONT_JP}`; g.fillText('各種カード使えます', w / 2, 430);
  },
  coffee: (g, w, h) => {
    g.fillStyle = '#2b1a12'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e8c79a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 52px ${FONT_JP}`; g.fillText('いれたて', w / 2, 70);
    g.font = `900 92px "Georgia", serif`; g.fillText('COFFEE', w / 2, 160);
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(170, 230); g.lineTo(342, 230); g.lineTo(320, 420); g.lineTo(192, 420); g.fill();
    g.fillStyle = '#7b4a2a'; g.fillRect(180, 280, 152, 40);
    g.fillStyle = '#e8c79a'; g.font = `900 48px ${FONT_JP}`; g.fillText('S ¥120', w / 2, 470);
  },
};
export function posterTex(kind) { return canvasTex(512, 512, POSTERS[kind]); }

export function hangingSignTex(text, color = '#16306b') {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.fillStyle = color; g.fillRect(0, 0, 26, h); g.fillRect(w - 26, 0, 26, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, text, w / 2, h / 2 + 4, w - 80, 68, FONT_JP, 900);
  });
}

export function stopTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.scale(1, 1.6);
    g.font = `900 150px ${FONT_JP}`; g.fillText('止まれ', w / 2, h / 2 / 1.6 + 6);
    g.restore();
  }, { srgb: true });
}

export function trashLabelTex() {
  return canvasTex(768, 128, (g, w, h) => {
    const items = [['もえるゴミ', '#c0392b'], ['ペットボトル', '#2471a3'], ['かん・びん', '#229954']];
    items.forEach(([t, c], i) => {
      g.fillStyle = c; g.fillRect(i * 256, 0, 256, h);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      fitText(g, t, i * 256 + 128, h / 2, 230, 44, FONT_JP, 900);
    });
  });
}

export function matTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#20314f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3b5a8c'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#c9d8f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 64px ${FONT_JP}`; g.fillText('いらっしゃいませ', w / 2, h / 2);
  });
}

export function atmScreenTex() {
  return canvasTex(256, 192, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#2f6fd6'); grd.addColorStop(1, '#173f8f');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 20px ${FONT_JP}`; g.fillText('いらっしゃいませ', w / 2, 28);
    const btn = ['お引出し', 'お預入れ', '残高照会', 'お振込み'];
    btn.forEach((t, i) => {
      const x = 14 + (i % 2) * 120, y = 50 + Math.floor(i / 2) * 64;
      g.fillStyle = '#f5f8ff'; roundRect(g, x, y, 108, 52, 8); g.fill();
      g.fillStyle = '#173f8f'; g.font = `900 20px ${FONT_JP}`; g.fillText(t, x + 54, y + 33);
    });
  });
}

export function taxiTex() {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#ffe9a0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0281e'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 46px "Segoe UI", Arial`; g.fillText('TAXI', w / 2, h / 2 + 2);
  });
}
export function kuushaTex() {
  return canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = '#100'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff2a1a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 44px ${FONT_JP}`; g.fillText('空車', w / 2, h / 2 + 2);
  });
}

export function laundrySignTex() {
  return canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = '#0a7fd1'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 92px ${FONT_JP}`; g.fillText('コインランドリー', w / 2 - 80, h / 2 + 4);
    g.fillStyle = '#ffe14a'; g.font = `900 80px "Segoe UI", Arial`; g.fillText('24H', w - 110, h / 2 + 4);
  });
}

export function ramenSignTex() {
  return canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = '#f1e3c4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9c1b14'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 120px ${FONT_SERIF}`; g.fillText('らーめん 夜舟', w / 2, h / 2 + 6);
  });
}

export function shopSignTex(text, bg, fg, w = 1024, h = 160, font = FONT_JP) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    fitText(g, text, w / 2, h / 2 + 4, w - 60, h * 0.62, font, 900);
  });
}
