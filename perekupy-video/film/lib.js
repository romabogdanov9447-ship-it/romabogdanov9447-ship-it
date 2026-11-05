import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE, RoundedBoxGeometry, mergeGeometries };

// ---------- palette ----------
export const C = {
  night: 0x070b18, navy: 0x0c1430, deep: 0x111a3a, graphite: 0x1b2130,
  blue: 0x3d7bff, cyan: 0x37d4ff, green: 0x2ee59d, red: 0xff4d5e, orange: 0xff9f43,
  gold: 0xffc857, white: 0xf3f6ff,
};

// ---------- math / timing ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const eio = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const eout = (t) => 1 - Math.pow(1 - t, 3);
export const ein = (t) => t * t * t;
export const eback = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const eelastic = (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
// progress of t inside [a,b] with easing
export const P = (t, a, b, e = eio) => e(clamp((t - a) / (b - a)));
// keyframe interpolation. keys: [[time, value|array], ...]
export function seq(t, keys, e = eio) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) {
      const k = e(clamp((t - t0) / (t1 - t0)));
      if (Array.isArray(v0)) return v0.map((x, j) => lerp(x, v1[j], k));
      return lerp(v0, v1, k);
    }
  }
  return keys[keys.length - 1][1];
}
// smooth handheld noise
export function wob(t, amp = 1, f = 1, seed = 0) {
  return amp * (Math.sin(t * 1.3 * f + seed) * 0.5 + Math.sin(t * 2.1 * f + seed * 1.7) * 0.3 + Math.sin(t * 3.7 * f + seed * 2.3) * 0.2);
}
export function setCam(cam, pos, tgt, t = 0, shake = 0.012) {
  cam.position.set(pos[0] + wob(t, shake, 1, 1), pos[1] + wob(t, shake, 1, 4), pos[2] + wob(t, shake * 0.5, 1, 7));
  cam.lookAt(tgt[0] + wob(t, shake * 0.6, 0.8, 9), tgt[1] + wob(t, shake * 0.6, 0.8, 3), tgt[2]);
}
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }

// ---------- materials ----------
export function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.55, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, transparent: o.transparent ?? false, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide, map: o.map ?? null, emissiveMap: o.emap ?? null, flatShading: o.flat ?? false });
}
export function phys(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: o.r ?? 0.35, metalness: o.m ?? 0, clearcoat: o.cc ?? 0.6, clearcoatRoughness: o.ccr ?? 0.25, sheen: o.sheen ?? 0, sheenColor: new THREE.Color(o.sheenColor ?? 0xffffff), sheenRoughness: 0.6, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 1, transparent: o.transparent ?? false, opacity: o.opacity ?? 1, map: o.map ?? null });
}
export function glow(color, intensity = 3, o = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: o.transparent ?? false, opacity: o.opacity ?? 1, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !(o.add || o.transparent), side: o.side ?? THREE.FrontSide, toneMapped: false, map: o.map ?? null, fog: o.fog ?? true });
}
export const rbox = (w, h, d, r = 0.04, seg = 4) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = shadow; if (parent) parent.add(m); return m;
}
export function group(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }

// ---------- canvas textures ----------
export function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const o = { canvas, ctx, tex, w, h, draw(fn) { ctx.clearRect(0, 0, w, h); fn(ctx, w, h); tex.needsUpdate = true; } };
  if (draw) o.draw(draw);
  return o;
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
export const F = (wgt, px) => `${wgt} ${px}px Inter, sans-serif`;
let _glowTex;
export function glowTex() {
  if (_glowTex) return _glowTex;
  _glowTex = canvasTex(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }).tex;
  return _glowTex;
}
export function halo(color, size, intensity = 1.5, parent = null) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(color).multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  s.scale.set(size, size, 1); if (parent) parent.add(s); return s;
}
// floating bokeh dust
export function dust(parent, n, box, color = 0x6f9bff, size = 0.04, seed = 3) {
  const r = rng(seed); const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * box[0]; pos[i * 3 + 1] = r() * box[1]; pos[i * 3 + 2] = (r() - 0.5) * box[2]; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ size, map: glowTex(), color: new THREE.Color(color).multiplyScalar(1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
  const p = new THREE.Points(g, m); parent.add(p); return p;
}

// ---------- fonts / 3D text ----------
export let FONT = null, FONT_B = null;
export async function loadFonts() {
  const l = new TTFLoader(); l.reversed = true;
  const buf = await (await fetch('../Inter-ExtraBold.otf')).arrayBuffer();
  FONT = new Font(l.parse(buf));
  const buf2 = await (await fetch('../Inter-Bold.otf')).arrayBuffer();
  FONT_B = new Font(l.parse(buf2));
  await document.fonts.load(F(800, 40)); await document.fonts.load(F(600, 40)); await document.fonts.load(F(900, 40));
}
export function text3D(str, o = {}) {
  const geo = new TextGeometry(str, { font: o.bold ? FONT_B : FONT, size: o.size ?? 0.2, depth: o.depth ?? 0.05, curveSegments: 6, bevelEnabled: true, bevelThickness: o.bevel ?? 0.012, bevelSize: o.bevelSize ?? 0.006, bevelSegments: 3 });
  geo.computeBoundingBox(); const bb = geo.boundingBox;
  const ax = o.align === 'left' ? -bb.min.x : o.align === 'right' ? -bb.max.x : -(bb.min.x + bb.max.x) / 2;
  geo.translate(ax, -(bb.min.y + bb.max.y) / 2, -(o.depth ?? 0.05) / 2);
  const front = o.front ?? phys(o.color ?? 0xffffff, { r: 0.25, m: 0.1, e: o.emissive ?? 0, ei: o.ei ?? 1 });
  const side = o.side ?? phys(o.sideColor ?? 0x2a3550, { r: 0.3, m: 0.7 });
  const m = new THREE.Mesh(geo, [front, side]); m.castShadow = true; m.receiveShadow = true;
  m.userData.width = bb.max.x - bb.min.x; return m;
}

// ---------- phone ----------
export function makePhone(o = {}) {
  const w = o.w ?? 0.075, h = o.h ?? 0.152, d = o.d ?? 0.009;
  const g = new THREE.Group();
  const bodyMat = phys(o.color ?? 0x2b2f3a, { r: 0.28, m: 0.85, cc: 0.4 });
  mesh(rbox(w, h, d, d * 0.48, 4), bodyMat, 0, 0, 0, g);
  // glass front
  mesh(rbox(w * 0.985, h * 0.99, d * 0.2, 0.004, 2), phys(0x05070c, { r: 0.08, cc: 1 }), 0, 0, d * 0.42, g);
  const scrW = w * 0.92, scrH = h * 0.955;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(scrW, scrH), new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false }));
  screen.position.z = d * 0.53; g.add(screen);
  // dynamic island
  mesh(new THREE.CapsuleGeometry(w * 0.06, w * 0.18, 4, 8), std(0x000000, { r: 0.2 }), 0, h * 0.44, d * 0.535, g, false).rotation.z = Math.PI / 2;
  // back camera module
  const cam = group(g, -w * 0.25, h * 0.34, -d * 0.5);
  mesh(rbox(w * 0.44, w * 0.44, d * 0.3, w * 0.09, 3), phys(o.color ?? 0x2b2f3a, { r: 0.2, m: 0.8 }), 0, 0, -d * 0.1, cam);
  const lensMat = phys(0x0a0d14, { r: 0.05, m: 0.3, cc: 1 }), ringMat = phys(0x9aa0aa, { r: 0.2, m: 1 });
  [[-0.1, 0.1], [-0.1, -0.1], [0.1, 0]].forEach(([x, y]) => {
    const ring = mesh(new THREE.CylinderGeometry(w * 0.085, w * 0.085, d * 0.45, 24), ringMat, x * w, y * w, -d * 0.3, cam); ring.rotation.x = Math.PI / 2;
    const lens = mesh(new THREE.SphereGeometry(w * 0.065, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lensMat, x * w, y * w, -d * 0.52, cam); lens.rotation.x = -Math.PI / 2;
  });
  g.userData = { screen, w: scrW, h: scrH, d };
  g.setScreen = (tex, intensity = 1) => { screen.material.map = tex; screen.material.color.setScalar(intensity); screen.material.needsUpdate = true; };
  return g;
}

// ---------- UI drawing for screens ----------
export function drawProductIcon(c, kind, x, y, s, hue = 210) {
  c.save(); c.translate(x, y); c.scale(s / 100, s / 100);
  const grad = (a, b) => { const g = c.createLinearGradient(-50, -50, 50, 50); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
  if (kind === 'iphone') {
    c.fillStyle = grad('#9a948a', '#5d5a55'); rr(c, -26, -48, 52, 96, 12); c.fill();
    c.fillStyle = grad('#6d6a64', '#3e3c39'); rr(c, -22, -42, 26, 26, 7); c.fill();
    c.fillStyle = '#111'; [[-14, -34], [-14, -22], [-3, -28]].forEach(([a, b]) => { c.beginPath(); c.arc(a, b, 5, 0, 7); c.fill(); });
  } else if (kind === 'phone') {
    c.fillStyle = grad(`hsl(${hue},40%,55%)`, `hsl(${hue},40%,25%)`); rr(c, -26, -48, 52, 96, 12); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(-12, -32, 7, 0, 7); c.fill(); c.beginPath(); c.arc(-12, -14, 7, 0, 7); c.fill();
  } else if (kind === 'headphones') {
    c.strokeStyle = `hsl(${hue},30%,70%)`; c.lineWidth = 10; c.beginPath(); c.arc(0, 5, 36, Math.PI, 0); c.stroke();
    c.fillStyle = grad(`hsl(${hue},30%,75%)`, `hsl(${hue},30%,40%)`); rr(c, -48, 0, 22, 40, 10); c.fill(); rr(c, 26, 0, 22, 40, 10); c.fill();
  } else if (kind === 'console') {
    c.fillStyle = grad('#f5f6fa', '#b9bdc9'); rr(c, -22, -48, 30, 96, 10); c.fill(); c.fillStyle = '#1b1f2b'; rr(c, 4, -40, 14, 80, 5); c.fill();
    c.fillStyle = grad('#f5f6fa', '#b9bdc9'); rr(c, 14, -48, 12, 96, 6); c.fill();
  } else if (kind === 'gamepad') {
    c.fillStyle = grad('#3a3f52', '#1a1d29'); c.beginPath(); c.ellipse(0, 0, 46, 28, 0, 0, 7); c.fill();
    c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(22, -6, 5, 0, 7); c.fill(); c.fillStyle = '#4dd2ff'; c.beginPath(); c.arc(30, 3, 5, 0, 7); c.fill();
    c.fillStyle = '#c9cfdf'; c.fillRect(-30, -4, 20, 7); c.fillRect(-23.5, -11, 7, 20);
  } else if (kind === 'sneaker') {
    c.fillStyle = grad('#ffffff', '#c7ccd9'); c.beginPath(); c.moveTo(-48, 20); c.lineTo(-44, -10); c.quadraticCurveTo(-30, -26, -14, -14); c.lineTo(20, 0); c.quadraticCurveTo(48, 6, 48, 20); c.closePath(); c.fill();
    c.fillStyle = `hsl(${hue},70%,55%)`; c.fillRect(-48, 18, 96, 8);
  } else if (kind === 'laptop') {
    c.fillStyle = grad('#c8ccd6', '#7d828f'); rr(c, -42, -36, 84, 54, 6); c.fill(); c.fillStyle = '#10182c'; rr(c, -36, -30, 72, 42, 3); c.fill();
    c.fillStyle = grad('#d9dce4', '#9ca1ad'); rr(c, -50, 18, 100, 8, 3); c.fill();
  } else if (kind === 'watch') {
    c.fillStyle = `hsl(${hue},40%,40%)`; rr(c, -14, -50, 28, 100, 8); c.fill();
    c.fillStyle = grad('#3a3f4c', '#0e1118'); rr(c, -24, -28, 48, 56, 12); c.fill(); c.fillStyle = `hsl(${hue},90%,60%)`; c.beginPath(); c.arc(0, 0, 12, 0, 5); c.lineWidth = 4; c.strokeStyle = c.fillStyle; c.stroke();
  } else if (kind === 'camera') {
    c.fillStyle = grad('#2c303b', '#11141b'); rr(c, -46, -26, 92, 58, 8); c.fill(); c.fillRect(-30, -34, 26, 10);
    c.fillStyle = '#555c6b'; c.beginPath(); c.arc(4, 4, 22, 0, 7); c.fill(); c.fillStyle = '#0a0c12'; c.beginPath(); c.arc(4, 4, 14, 0, 7); c.fill();
  } else if (kind === 'tablet') {
    c.fillStyle = grad('#a6abb8', '#5c616e'); rr(c, -38, -48, 76, 96, 8); c.fill(); c.fillStyle = '#152043'; rr(c, -33, -43, 66, 86, 4); c.fill();
  } else { // box
    c.fillStyle = grad('#d6a66b', '#9c6f3e'); c.fillRect(-40, -30, 80, 64); c.fillStyle = '#b98a52'; c.fillRect(-40, -30, 80, 12); c.fillStyle = '#e9d3a9'; c.fillRect(-6, -30, 12, 64);
  }
  c.restore();
}
const fmt = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ');
export { fmt };
// listing card UI (like a classified ad)
export function drawListing(c, w, h, o = {}) {
  const s = w / 600;
  c.save(); c.scale(s, s); const W = 600, H = h / s;
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, o.dark ? '#141c33' : '#f4f6fb'); bg.addColorStop(1, o.dark ? '#0c1226' : '#e6eaf3');
  c.fillStyle = bg; rr(c, 0, 0, W, H, 36); c.fill();
  // photo area
  const ph = Math.min(H * 0.48, 420);
  const pg = c.createLinearGradient(0, 0, 0, ph); pg.addColorStop(0, '#2a3557'); pg.addColorStop(1, '#141b33');
  c.fillStyle = pg; rr(c, 24, 24, W - 48, ph, 26); c.fill();
  c.save(); c.globalAlpha = 0.35; const rg = c.createRadialGradient(W / 2, ph / 2, 10, W / 2, ph / 2, 260); rg.addColorStop(0, '#5f8bff'); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(24, 24, W - 48, ph); c.restore();
  drawProductIcon(c, o.kind ?? 'iphone', W / 2, 24 + ph / 2, ph * 0.72, o.hue ?? 210);
  const tx = 40; let y = ph + 80;
  c.fillStyle = o.dark ? '#ffffff' : '#141a2b'; c.font = F(800, 46); c.textAlign = 'left';
  c.fillText(o.title ?? 'iPhone 15 Pro, 256 ГБ', tx, y); y += 70;
  if (o.oldPrice) { c.fillStyle = '#8a93a8'; c.font = F(600, 34); c.fillText(o.oldPrice, tx, y); const mw = c.measureText(o.oldPrice).width; c.fillRect(tx, y - 12, mw, 4); y += 62; }
  c.fillStyle = o.priceColor ?? '#18b26b'; c.font = F(900, 64); c.fillText(o.price ?? '55 000 ₽', tx, y); y += 56;
  c.fillStyle = '#8a93a8'; c.font = F(600, 30); c.fillText(o.meta ?? 'Москва · 4 минуты назад', tx, y); y += 40;
  if (o.button) {
    const by = H - 130; c.fillStyle = o.buttonColor ?? '#2f7bff'; rr(c, 30, by, W - 60, 96, 30); c.fill();
    c.fillStyle = '#fff'; c.font = F(800, 40); c.textAlign = 'center'; c.fillText(o.button, W / 2, by + 62);
  }
  if (o.dim) { c.fillStyle = `rgba(10,14,28,${o.dim})`; rr(c, 0, 0, W, H, 36); c.fill(); }
  if (o.stamp) {
    c.save(); c.translate(W / 2, H * 0.42); c.rotate(-0.22); const sk = o.stampK ?? 1; c.scale(sk, sk); c.globalAlpha = Math.min(1, 2.2 - sk); c.strokeStyle = '#ff3b4f'; c.lineWidth = 12; c.fillStyle = 'rgba(255,59,79,0.18)';
    rr(c, -230, -64, 460, 128, 22); c.fill(); c.stroke(); c.fillStyle = '#ff3b4f'; c.font = F(900, 70); c.textAlign = 'center'; c.fillText(o.stamp, 0, 25); c.restore();
  }
  c.restore();
}
// generic phone app screen with a feed of listings
export function drawFeed(c, w, h, scroll = 0, o = {}) {
  const s = w / 600; c.save(); c.scale(s, s); const H = h / s;
  c.fillStyle = '#0e1426'; c.fillRect(0, 0, 600, H);
  const kinds = ['phone', 'sneaker', 'laptop', 'headphones', 'console', 'watch', 'camera', 'tablet', 'gamepad', 'box'];
  const prices = ['18 500 ₽', '7 900 ₽', '42 000 ₽', '12 300 ₽', '31 000 ₽', '9 400 ₽', '27 500 ₽', '22 000 ₽', '4 800 ₽', '2 500 ₽'];
  const rowH = 260;
  for (let i = -1; i < 12; i++) {
    const y = 150 + i * rowH - (scroll % (rowH * 10));
    const k = ((i % 10) + 10) % 10;
    c.fillStyle = '#18213b'; rr(c, 24, y, 552, rowH - 24, 26); c.fill();
    c.fillStyle = '#243058'; rr(c, 40, y + 16, 200, rowH - 56, 18); c.fill();
    drawProductIcon(c, kinds[k], 140, y + rowH / 2 - 12, 150, (k * 47) % 360);
    c.fillStyle = '#e8ecf8'; c.font = F(700, 32); c.textAlign = 'left'; c.fillText(['Смартфон', 'Кроссовки', 'Ноутбук', 'Наушники', 'Приставка', 'Часы', 'Камера', 'Планшет', 'Геймпад', 'Коробка'][k], 262, y + 70);
    c.fillStyle = '#ffffff'; c.font = F(900, 42); c.fillText(prices[k], 262, y + 130);
    c.fillStyle = '#7d87a3'; c.font = F(600, 24); c.fillText('2 часа назад', 262, y + 180);
  }
  c.fillStyle = '#0b1020'; c.fillRect(0, 0, 600, 130); c.fillStyle = '#ffffff'; c.font = F(800, 40); c.textAlign = 'left'; c.fillText(o.header ?? 'Объявления', 36, 92);
  c.restore();
}
export function drawNotification(c, w, h, a = 1) {
  const s = w / 600; c.save(); c.scale(s, s); const H = h / s;
  const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1838'); bg.addColorStop(1, '#050913'); c.fillStyle = bg; c.fillRect(0, 0, 600, H);
  c.fillStyle = 'rgba(255,255,255,0.92)'; c.font = F(300, 150); c.textAlign = 'center'; c.font = F(600, 160); c.fillText('7:00', 300, 330);
  c.font = F(600, 34); c.fillStyle = 'rgba(255,255,255,0.7)'; c.fillText('Среда, 4 ноября', 300, 160);
  c.globalAlpha = a; c.save(); c.translate(0, (1 - a) * -40);
  c.fillStyle = 'rgba(40,52,90,0.92)'; rr(c, 28, 420, 544, 230, 40); c.fill();
  c.fillStyle = '#2ee59d'; rr(c, 56, 450, 70, 70, 18); c.fill(); c.fillStyle = '#06261a'; c.font = F(900, 46); c.fillText('П', 91, 502);
  c.textAlign = 'left'; c.fillStyle = '#9fb0d8'; c.font = F(700, 28); c.fillText('ПЕРЕКУПЫ · сейчас', 146, 478);
  c.fillStyle = '#ffffff'; c.font = F(800, 36); c.fillText('Найдена выгодная сделка', 146, 522);
  c.font = F(600, 32); c.fillStyle = '#d6def5'; c.fillText('iPhone 15 Pro — 55 000 ₽', 56, 578); c.fillStyle = '#2ee59d'; c.fillText('−31% от рынка', 56, 622);
  c.restore(); c.restore();
}

// ---------- character ----------
export function makeCharacter(o = {}) {
  const skin = phys(o.skin ?? 0xf0bf98, { r: 0.6, cc: 0.05, sheen: 0.4, sheenColor: 0xffd0b0 });
  const shirt = phys(o.shirt ?? 0x2a6fdb, { r: 0.85, cc: 0, sheen: 0.6, sheenColor: 0xffffff });
  const pants = phys(o.pants ?? 0x23293a, { r: 0.9, cc: 0, sheen: 0.3 });
  const shoeM = phys(o.shoes ?? 0xf2f2f2, { r: 0.5, cc: 0.3 });
  const hairM = phys(o.hair ?? 0x2b1a12, { r: 0.6, cc: 0.2, sheen: 0.5 });
  const root = new THREE.Group();
  const J = {};
  J.hips = group(root, 0, 0.8, 0);
  mesh(new THREE.SphereGeometry(0.17, 24, 16), pants, 0, 0.02, 0, J.hips).scale.set(1.12, 0.75, 0.85);
  // legs
  for (const side of [1, -1]) {
    const k = side > 0 ? 'l' : 'r';
    const leg = J[k + 'Leg'] = group(J.hips, 0.1 * side, -0.02, 0);
    mesh(new THREE.CapsuleGeometry(0.082, 0.24, 6, 14), pants, 0, -0.18, 0, leg);
    const knee = J[k + 'Knee'] = group(leg, 0, -0.38, 0);
    mesh(new THREE.CapsuleGeometry(0.07, 0.24, 6, 14), pants, 0, -0.17, 0, knee);
    const shoe = mesh(rbox(0.14, 0.1, 0.27, 0.045), shoeM, 0, -0.37, 0.045, knee);
    mesh(rbox(0.145, 0.03, 0.275, 0.012), std(0x222633, { r: 0.8 }), 0, -0.41, 0.045, knee);
    J[k + 'Shoe'] = shoe;
  }
  // torso
  J.torso = group(J.hips, 0, 0.02, 0);
  const tor = mesh(new THREE.CapsuleGeometry(0.2, 0.24, 8, 20), shirt, 0, 0.27, 0, J.torso); tor.scale.set(1.1, 1, 0.8);
  if (o.hoodie !== false) { const hood = mesh(new THREE.TorusGeometry(0.12, 0.05, 10, 24), shirt, 0, 0.5, -0.04, J.torso); hood.rotation.x = Math.PI / 2 + 0.35;
    const str = std(0xe8e8e8, { r: 0.7 }); mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12), str, 0.045, 0.38, 0.155, J.torso); mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12), str, -0.045, 0.38, 0.155, J.torso); }
  if (o.jacket) { const jm = phys(o.jacket, { r: 0.6, cc: 0.3 }); const jk = mesh(new THREE.CapsuleGeometry(0.205, 0.23, 8, 20, 1), jm, 0, 0.26, -0.012, J.torso); jk.scale.set(1.13, 1.02, 0.8); mesh(rbox(0.1, 0.36, 0.05, 0.02), shirt, 0, 0.3, 0.16, J.torso); }
  mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.1, 16), skin, 0, 0.56, 0, J.torso);
  // head
  J.head = group(J.torso, 0, 0.6, 0);
  const headM = mesh(new THREE.SphereGeometry(0.21, 40, 30), skin, 0, 0.19, 0, J.head); headM.scale.set(1, 1.06, 0.98);
  // ears
  for (const s of [1, -1]) mesh(new THREE.SphereGeometry(0.048, 16, 12), skin, 0.205 * s, 0.18, -0.01, J.head).scale.set(0.5, 1, 0.8);
  // nose
  mesh(new THREE.SphereGeometry(0.03, 16, 12), phys(new THREE.Color(o.skin ?? 0xf0bf98).multiplyScalar(0.94), { r: 0.6, cc: 0.05 }), 0, 0.15, 0.205, J.head).scale.set(1, 0.9, 1);
  // eyes
  J.eyes = []; J.lids = [];
  const white = phys(0xffffff, { r: 0.2, cc: 1 }), iris = phys(o.eyes ?? 0x3b2a1e, { r: 0.1, cc: 1 }), pupil = std(0x05050a, { r: 0.1 });
  for (const s of [1, -1]) {
    const eg = group(J.head, 0.075 * s, 0.215, 0.168); eg.scale.set(1, 1.18, 0.62);
    mesh(new THREE.SphereGeometry(0.05, 24, 18), white, 0, 0, 0, eg, false);
    const ir = group(eg, 0, 0, 0);
    mesh(new THREE.SphereGeometry(0.03, 20, 14), iris, 0, 0, 0.032, ir, false).scale.set(1, 1, 0.5);
    mesh(new THREE.SphereGeometry(0.017, 14, 10), pupil, 0, 0, 0.043, ir, false).scale.set(1, 1, 0.5);
    mesh(new THREE.SphereGeometry(0.0075, 8, 6), glow(0xffffff, 2), 0.01, 0.012, 0.05, ir, false);
    const lid = mesh(new THREE.SphereGeometry(0.054, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0, 0, eg, false);
    J.eyes.push(ir); J.lids.push(lid);
  }
  // brows
  J.brows = [];
  for (const s of [1, -1]) { const b = mesh(new THREE.CapsuleGeometry(0.012, 0.055, 4, 8), hairM, 0.078 * s, 0.3, 0.188, J.head, false); b.rotation.z = Math.PI / 2 - 0.12 * s; J.brows.push(b); }
  // mouth
  J.mouth = group(J.head, 0, 0.088, 0.19);
  const mouthGeo = new THREE.TorusGeometry(0.04, 0.0105, 8, 20, Math.PI);
  const mouth = mesh(mouthGeo, std(0x6b2a2a, { r: 0.5 }), 0, 0, 0, J.mouth, false); mouth.rotation.z = Math.PI; mouth.rotation.x = -0.25;
  J.mouthOpen = mesh(new THREE.SphereGeometry(0.03, 16, 10), std(0x3a0f12, { r: 0.6 }), 0, 0.004, 0.0, J.mouth, false); J.mouthOpen.scale.set(1.1, 0.05, 0.4);
  // hair
  const hs = o.hairStyle ?? 'short';
  if (hs === 'short' || hs === 'pony' || hs === 'messy') {
    const cap = mesh(new THREE.SphereGeometry(0.222, 32, 20, 0, Math.PI * 2, 0, 1.35), hairM, 0, 0.2, -0.012, J.head); cap.rotation.x = -0.35; cap.scale.set(1.02, 1.08, 1.03);
    const tufts = hs === 'messy' ? [[0, 0.37, 0.12, 0.09], [0.09, 0.36, 0.1, 0.075], [-0.1, 0.36, 0.1, 0.075], [0.05, 0.4, 0.02, 0.08], [-0.06, 0.39, 0.03, 0.08]] : [[0.02, 0.36, 0.13, 0.085], [0.11, 0.34, 0.1, 0.07], [-0.09, 0.345, 0.11, 0.075]];
    for (const [x, y, z, r] of tufts) mesh(new THREE.SphereGeometry(r, 16, 12), hairM, x, y, z, J.head).scale.set(1.2, 0.7, 1);
    if (hs === 'pony') { mesh(new THREE.SphereGeometry(0.1, 16, 12), hairM, 0, 0.3, -0.22, J.head).scale.set(0.8, 1.3, 0.9); mesh(new THREE.CapsuleGeometry(0.065, 0.18, 6, 12), hairM, 0, 0.12, -0.28, J.head).rotation.x = 0.4;
      for (const s of [1, -1]) mesh(new THREE.CapsuleGeometry(0.07, 0.2, 6, 12), hairM, 0.19 * s, 0.12, -0.03, J.head); }
  } else if (hs === 'cap') {
    const cm = phys(o.capColor ?? 0x222222, { r: 0.6 });
    const cap = mesh(new THREE.SphereGeometry(0.226, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), cm, 0, 0.23, 0, J.head); cap.scale.set(1, 0.85, 1);
    const visor = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.02, 24, 1, false, -Math.PI / 2, Math.PI), cm, 0, 0.25, 0.12, J.head); visor.scale.set(1, 1, 1.1); visor.rotation.x = 0.12;
    mesh(new THREE.SphereGeometry(0.2, 16, 12), hairM, 0, 0.17, -0.04, J.head).scale.set(1.06, 0.8, 1.02);
  } else if (hs === 'bald') {
    mesh(new THREE.SphereGeometry(0.215, 24, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.3), hairM, 0, 0.2, -0.01, J.head);
  }
  if (o.beard) { const bm = phys(o.beard, { r: 0.8 }); const b = mesh(new THREE.SphereGeometry(0.19, 24, 16, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), bm, 0, 0.17, 0.015, J.head); b.scale.set(1.04, 1.05, 1.05);
    mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), bm, 0, 0.115, 0.205, J.head).rotation.z = Math.PI / 2; }
  if (o.glasses) { const gm = phys(0x111111, { r: 0.3, m: 0.5 }); for (const s of [1, -1]) mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 24), gm, 0.075 * s, 0.215, 0.215, J.head, false); mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05), gm, 0, 0.222, 0.22, J.head, false).rotation.z = Math.PI / 2; }
  // arms
  for (const side of [1, -1]) {
    const k = side > 0 ? 'l' : 'r';
    const arm = J[k + 'Arm'] = group(J.torso, 0.255 * side, 0.46, 0);
    mesh(new THREE.SphereGeometry(0.075, 16, 12), shirt, 0, 0, 0, arm);
    mesh(new THREE.CapsuleGeometry(0.066, 0.2, 6, 14), o.jacket ? phys(o.jacket, { r: 0.6, cc: 0.3 }) : shirt, 0, -0.15, 0, arm);
    const el = J[k + 'Elbow'] = group(arm, 0, -0.3, 0);
    mesh(new THREE.CapsuleGeometry(0.058, 0.18, 6, 14), o.jacket ? phys(o.jacket, { r: 0.6, cc: 0.3 }) : shirt, 0, -0.12, 0, el);
    const hand = J[k + 'Hand'] = group(el, 0, -0.29, 0);
    mesh(new THREE.SphereGeometry(0.068, 18, 14), skin, 0, 0, 0, hand).scale.set(0.95, 1.1, 0.72);
    mesh(new THREE.CapsuleGeometry(0.024, 0.04, 4, 8), skin, -0.055 * side, 0.02, 0.025, hand).rotation.z = 0.6 * side;
  }
  root.traverse((m) => { if (m.isMesh && m.castShadow === undefined) m.castShadow = true; });
  root.J = J;
  // pose helper: values are rotation triplets or numbers (x rotation)
  root.pose = (p) => {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'blink') { J.lids.forEach((l) => (l.rotation.x = lerp(0.25, 1.62, v))); continue; }
      if (k === 'look') { J.eyes.forEach((e) => { e.position.x = v[0] * 0.012; e.position.y = v[1] * 0.012; }); continue; }
      if (k === 'smile') { J.mouth.scale.set(1 + v * 0.15, lerp(0.35, 1.2, v), 1); continue; }
      if (k === 'talk') { J.mouthOpen.scale.y = lerp(0.05, 0.75, v); continue; }
      if (k === 'brow') { J.brows.forEach((b) => (b.position.y = 0.3 + v * 0.025)); continue; }
      if (k === 'y') { J.hips.position.y = 0.8 + v; continue; }
      const j = J[k]; if (!j) continue;
      if (typeof v === 'number') j.rotation.x = v; else j.rotation.set(v[0], v[1], v[2]);
    }
  };
  root.pose({ blink: 0, smile: 0.5, talk: 0, lArm: [0, 0, 0.12], rArm: [0, 0, -0.12], lElbow: -0.15, rElbow: -0.15 });
  return root;
}
export const blinkAt = (t, seed = 0) => { const p = (t + seed) % 3.3; return p < 0.14 ? Math.sin((p / 0.14) * Math.PI) : 0; };
export const talkAt = (t, on = 1) => on * clamp(0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 6.3 + 1), 0, 1);

// ---------- environment pieces ----------
export function skyTex(top, mid, bottom, stars = 0) {
  return canvasTex(256, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.6, mid); g.addColorStop(1, bottom); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const r = rng(7); for (let i = 0; i < stars; i++) { c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`; c.fillRect(r() * w, r() * h * 0.5, 1.2, 1.2); }
  }).tex;
}
export function windowsTex(seed = 1, lit = 0.3, cols = 6, rows = 14, warm = true) {
  return canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#0b1022'; c.fillRect(0, 0, w, h); const r = rng(seed);
    const cw = w / cols, ch = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const on = r() < lit; c.fillStyle = on ? (warm && r() < 0.7 ? `hsl(${35 + r() * 15},90%,${55 + r() * 20}%)` : `hsl(${200 + r() * 30},70%,${60 + r() * 15}%)`) : '#141b33';
      c.fillRect(i * cw + cw * 0.18, j * ch + ch * 0.2, cw * 0.64, ch * 0.6);
    }
  }).tex;
}
export function makeBuilding(w, h, d, seed, lit = 0.35) {
  const tex = windowsTex(seed, lit); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(w / 1.6)), Math.max(1, Math.round(h / 3)));
  const m = new THREE.MeshStandardMaterial({ color: 0x1a2240, roughness: 0.7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.85, map: tex });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.y = h / 2; return b;
}

// blanket: deformed plane draped over a body
export function makeBlanket(mat, W = 1.7, L = 1.9, bodyFn) {
  const g = new THREE.PlaneGeometry(W + 0.5, L, 70, 70); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = 0.06 + (bodyFn ? bodyFn(x, z) : 0);
    y += Math.sin(x * 9 + z * 3) * 0.008 + Math.sin(z * 7 - x * 2) * 0.01;
    const over = Math.abs(x) - W / 2; if (over > 0) y -= over * 2.4 - Math.sin(z * 10) * 0.01 * over * 10;
    p.setY(i, y);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}

// ---------- bedroom ----------
export function makeBedroom(o = {}) {
  const scene = new THREE.Scene();
  const root = group(scene);
  const wallM = std(0x18213f, { r: 0.9 }), floorM = phys(0x2a2236, { r: 0.45, cc: 0.4 });
  const floor = mesh(new THREE.PlaneGeometry(9, 9), floorM, 0, 0, 0, root); floor.rotation.x = -Math.PI / 2;
  // planks
  const plank = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#3a2c3c'; c.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { c.fillStyle = `hsl(${290 + i * 3},14%,${19 + (i * 37 % 7)}%)`; c.fillRect(0, i * 64, w, 62); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, i * 64 + 62, w, 2); c.fillRect(((i * 173) % 512), i * 64, 2, 64); } });
  plank.tex.wrapS = plank.tex.wrapT = THREE.RepeatWrapping; plank.tex.repeat.set(4, 4); floorM.map = plank.tex; floorM.color.set(0xffffff);
  // back wall with window hole: build from 4 boxes
  const bw = group(root, 0, 0, -2.6);
  const wx0 = -0.05, wx1 = 1.45, wy0 = 1.1, wy1 = 2.55;
  mesh(new THREE.BoxGeometry(9, 3.2, 0.2), wallM, 0, 1.6, -0.1, bw).scale.set(1, 1, 1);
  bw.children[0].visible = false;
  mesh(new THREE.BoxGeometry(4.5 + wx0, 3.2, 0.2), wallM, (-4.5 + wx0) / 2, 1.6, 0, bw);
  mesh(new THREE.BoxGeometry(4.5 - wx1, 3.2, 0.2), wallM, (4.5 + wx1) / 2, 1.6, 0, bw);
  mesh(new THREE.BoxGeometry(wx1 - wx0, wy0, 0.2), wallM, (wx0 + wx1) / 2, wy0 / 2, 0, bw);
  mesh(new THREE.BoxGeometry(wx1 - wx0, 3.2 - wy1, 0.2), wallM, (wx0 + wx1) / 2, (3.2 + wy1) / 2, 0, bw);
  // frame
  const frM = phys(0xd9dde8, { r: 0.4 });
  const cx = (wx0 + wx1) / 2, cy = (wy0 + wy1) / 2, ww = wx1 - wx0, wh = wy1 - wy0;
  mesh(new THREE.BoxGeometry(ww + 0.08, 0.06, 0.26), frM, cx, wy0, 0.03, bw); mesh(new THREE.BoxGeometry(ww + 0.08, 0.06, 0.24), frM, cx, wy1, 0.0, bw);
  mesh(new THREE.BoxGeometry(0.06, wh, 0.24), frM, wx0, cy, 0, bw); mesh(new THREE.BoxGeometry(0.06, wh, 0.24), frM, wx1, cy, 0, bw);
  mesh(new THREE.BoxGeometry(0.04, wh, 0.1), frM, cx, cy, 0, bw); mesh(new THREE.BoxGeometry(ww, 0.04, 0.1), frM, cx, cy + 0.1, 0, bw);
  mesh(new THREE.BoxGeometry(ww + 0.3, 0.05, 0.3), frM, cx, wy0 - 0.02, 0.12, bw); // sill
  // outside: sky + city
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), new THREE.MeshBasicMaterial({ map: skyTex(o.skyTop ?? '#0a1236', o.skyMid ?? '#2b3f88', o.skyBottom ?? '#ff9a6a', 60), toneMapped: false, fog: false }));
  sky.position.set(0.7, 2.5, -9); root.add(sky); scene.userData.sky = sky;
  const r = rng(11);
  for (let i = 0; i < 14; i++) { const h = 1.5 + r() * 4.5; const b = makeBuilding(0.8 + r() * 1.2, h, 0.8, i + 3, 0.25); b.position.x = -3 + i * 0.62 + r() * 0.2; b.position.z = -6 - r() * 1.5; b.position.y -= 1.0; root.add(b); }
  // curtains
  const curM = phys(0x2c3f7a, { r: 0.9, cc: 0, sheen: 0.8, sheenColor: 0x8aa0ff });
  for (const s of [-1, 1]) { const cg = new THREE.PlaneGeometry(0.45, 2.3, 20, 1); const pp = cg.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 40) * 0.035); cg.computeVertexNormals();
    const cm = mesh(cg, curM, s < 0 ? wx0 - 0.15 : wx1 + 0.15, 1.75, 0.18, bw); cm.material.side = THREE.DoubleSide; }
  // left wall
  const lw = mesh(new THREE.BoxGeometry(0.2, 3.2, 9), wallM, -3.0, 1.6, 1.5, root);
  // poster frames on back wall
  const posterTex = canvasTex(256, 340, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#3d7bff'); g.addColorStop(1, '#8a3dff'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(w / 2, h * 0.42, 60, 0, 7); c.fill(); c.fillStyle = '#0b1022'; c.font = F(900, 34); c.textAlign = 'center'; c.fillText('HUSTLE', w / 2, h * 0.86); });
  const pf = mesh(rbox(0.5, 0.66, 0.04, 0.01), phys(0x11131a, { r: 0.3 }), -1.75, 2.0, 0.12, bw);
  mesh(new THREE.PlaneGeometry(0.43, 0.59), std(0xffffff, { map: posterTex.tex, r: 0.6 }), -1.75, 2.0, 0.145, bw);
  // bed: headboard along back wall, bed extends to +z
  const bed = group(root, -1.0, 0, -1.4); scene.userData.bed = bed;
  const woodM = phys(0x3b2f45, { r: 0.5, cc: 0.3 });
  mesh(rbox(1.8, 0.32, 2.3, 0.05), woodM, 0, 0.22, 0, bed);
  mesh(rbox(1.9, 1.0, 0.12, 0.05), phys(0x28324f, { r: 0.85, cc: 0, sheen: 0.6 }), 0, 0.75, -1.12, bed);
  mesh(rbox(1.7, 0.22, 2.15, 0.08), phys(0xdfe4f2, { r: 0.85, cc: 0, sheen: 0.5 }), 0, 0.47, 0.03, bed);
  const pillow = mesh(new THREE.SphereGeometry(0.4, 32, 16), phys(0xeef1fb, { r: 0.85, cc: 0, sheen: 0.7 }), -0.05, 0.64, -0.78, bed); pillow.scale.set(1.25, 0.26, 0.6);
  const blanketM = phys(o.blanket ?? 0x2c4596, { r: 0.85, cc: 0, sheen: 0.9, sheenColor: 0x9fb4ff }); blanketM.side = THREE.DoubleSide;
  scene.userData.blanketM = blanketM;
  // nightstand
  const ns = group(root, 0.32, 0, -2.15); scene.userData.nightstand = ns;
  mesh(rbox(0.55, 0.56, 0.45, 0.03), woodM, 0, 0.28, 0, ns);
  mesh(rbox(0.47, 0.18, 0.02, 0.01), phys(0x4a3d57, { r: 0.4 }), 0, 0.36, 0.23, ns);
  mesh(new THREE.SphereGeometry(0.018, 10, 8), phys(0xc9b27a, { m: 1, r: 0.3 }), 0, 0.36, 0.25, ns);
  // lamp
  mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.04, 20), phys(0x222633, { m: 0.6, r: 0.3 }), 0.15, 0.58, -0.08, ns);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 8), phys(0xc9b27a, { m: 1, r: 0.3 }), 0.15, 0.72, -0.08, ns);
  const shade = mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.15, 24, 1, true), phys(0xe8dcc8, { r: 0.9, cc: 0 }), 0.15, 0.88, -0.08, ns); shade.material.side = THREE.DoubleSide;
  // alarm clock
  const clk = group(ns, -0.14, 0.62, -0.06); clk.rotation.y = 0.35;
  mesh(rbox(0.16, 0.08, 0.06, 0.02), phys(0x161a24, { r: 0.3 }), 0, 0, 0, clk);
  const clockTex = canvasTex(256, 128); scene.userData.clockTex = clockTex;
  mesh(new THREE.PlaneGeometry(0.135, 0.06), new THREE.MeshBasicMaterial({ map: clockTex.tex, toneMapped: false }), 0, 0, 0.031, clk, false);
  // glass
  // phone (lying)
  const phone = makePhone({ color: 0x1d2433 }); phone.rotation.x = -Math.PI / 2; phone.rotation.z = 0.35; phone.position.set(0.02, 0.566, 0.08); ns.add(phone);
  scene.userData.phone = phone;
  // rug
  const rug = mesh(new THREE.CircleGeometry(1.2, 48), phys(0x4a3c6e, { r: 1, cc: 0, sheen: 1, sheenColor: 0xb6a6ff }), 0.9, 0.006, 0.6, root, false); rug.rotation.x = -Math.PI / 2; rug.receiveShadow = true; rug.scale.set(1.3, 1, 1);
  // plant
  const pl = group(root, 1.95, 0, -2.2);
  mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 24), phys(0xd4cfc6, { r: 0.6 }), 0, 0.18, 0, pl);
  const leafM = phys(0x2f7a5a, { r: 0.6, cc: 0.4 });
  for (let i = 0; i < 9; i++) { const l = mesh(new THREE.SphereGeometry(0.12, 12, 8), leafM, Math.cos(i * 2.4) * 0.12, 0.5 + (i % 3) * 0.17, Math.sin(i * 2.4) * 0.12, pl); l.scale.set(0.45, 1.2, 0.18); l.rotation.set(Math.sin(i) * 0.6, i * 2.4, Math.cos(i * 1.3) * 0.6); }
  // desk + chair at right
  const desk = group(root, 2.4, 0, -0.6); desk.rotation.y = -Math.PI / 2;
  mesh(rbox(1.4, 0.05, 0.6, 0.015), woodM, 0, 0.75, 0, desk);
  for (const [x, z] of [[-0.65, -0.25], [0.65, -0.25], [-0.65, 0.25], [0.65, 0.25]]) mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75), phys(0x222633, { m: 0.8, r: 0.3 }), x, 0.375, z, desk);
  mesh(rbox(0.5, 0.33, 0.03, 0.01), phys(0x222633, { m: 0.5, r: 0.3 }), 0, 1.0, -0.15, desk);
  const boxM = phys(0xb88a55, { r: 0.8, cc: 0 });
  mesh(rbox(0.4, 0.3, 0.3, 0.01), boxM, 0.4, 0.15, 0.6, desk); mesh(rbox(0.3, 0.22, 0.25, 0.01), boxM, 0.38, 0.41, 0.6, desk); mesh(rbox(0.35, 0.2, 0.3, 0.01), boxM, -0.2, 0.1, 0.7, desk);
  // lights
  const hemi = new THREE.HemisphereLight(0x4a64c8, 0x120c1c, 0.55); scene.add(hemi);
  const moon = new THREE.DirectionalLight(o.keyColor ?? 0xffb48a, o.key ?? 2.2); moon.position.set(2.5, 3.2, -7); moon.target.position.set(-0.8, 0.4, -0.8);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -4; moon.shadow.camera.right = 4; moon.shadow.camera.top = 4; moon.shadow.camera.bottom = -4; moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.02;
  scene.add(moon, moon.target); scene.userData.key = moon;
  const fill = new THREE.PointLight(0x5a7cff, 6, 7, 1.6); fill.position.set(1.5, 2.6, 2.2); scene.add(fill); scene.userData.fill = fill;
  const lampL = new THREE.PointLight(0xffb070, 0, 3, 1.5); lampL.position.set(0.47, 0.85, -2.23); scene.add(lampL); scene.userData.lamp = lampL;
  const screenL = new THREE.PointLight(0x7fb4ff, 0, 2.2, 1.6); scene.add(screenL); scene.userData.screenLight = screenL;
  scene.background = new THREE.Color(0x05070f); scene.fog = new THREE.Fog(0x05070f, 9, 22);
  return scene;
}
export function drawClock(c, w, h, txt) { c.fillStyle = '#04060b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ff5468'; c.shadowColor = '#ff5468'; c.shadowBlur = 16; c.font = F(800, 92); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, w / 2, h / 2 + 4); c.shadowBlur = 0; }

// ---------- Russia map ----------
const RU = [[28.0, 69.8], [33, 69.4], [41, 67.6], [44, 68.5], [53, 68.5], [54, 68.9], [60, 69.8], [66, 69.5], [68.5, 72.8], [72.5, 72.9], [80, 72.5], [80.5, 73.6], [87, 74.5], [100, 76.5], [104, 77.7], [113, 73.7], [120, 73], [129, 71.8], [140, 72.5], [150, 71.5], [160, 70.0], [170, 70], [180, 68.9], [180, 65.5], [177, 64.7], [174, 61.8], [170, 60], [163, 59.9], [163, 57.5], [162, 54.8], [160, 53], [156.6, 51], [155.5, 55.5], [156, 57.8], [160, 61.5], [154, 59.2], [150, 59.5], [143, 59.3], [137, 54.0], [141, 53], [140.5, 48.5], [135, 43.5], [131, 42.6], [131, 44.9], [133, 45], [135, 48.4], [131, 47.7], [127.5, 49.7], [121, 53.3], [117.8, 49.5], [116, 49.9], [108, 49.3], [98, 50.3], [97, 49.7], [88, 49.4], [87.3, 49.1], [80, 50.8], [77, 51.5], [73, 54], [70, 55.2], [65, 54.6], [61, 54], [61, 51], [55, 50.6], [50, 51.6], [47, 50.3], [47.5, 48.5], [47, 46.5], [47.5, 45.5], [47, 44.2], [48, 42], [46.5, 41.9], [44, 42.7], [40, 43.4], [37.5, 44.7], [38.5, 46.6], [39.7, 47.2], [40, 48], [39.8, 49.6], [38, 50], [35.5, 50.4], [34, 51.7], [32, 52.3], [31.5, 53], [32.7, 53.4], [31, 55.5], [28.2, 56.2], [27.7, 57.5], [28, 59.5], [30, 60], [29.5, 61.5], [31.5, 63], [29.5, 64.5], [30, 66.5], [29, 69]];
export const CITIES = { 'Москва': [37.6, 55.75], 'Санкт-Петербург': [30.3, 59.94], 'Казань': [49.1, 55.8], 'Екатеринбург': [60.6, 56.84], 'Новосибирск': [82.9, 55.0], 'Краснодар': [38.98, 45.04], 'Самара': [50.1, 53.2], 'Нижний Новгород': [44.0, 56.3], 'Ростов-на-Дону': [39.7, 47.23], 'Уфа': [55.96, 54.73], 'Пермь': [56.25, 58.0], 'Омск': [73.37, 54.98], 'Красноярск': [92.87, 56.0], 'Иркутск': [104.3, 52.3], 'Хабаровск': [135.07, 48.48], 'Владивосток': [131.9, 43.12], 'Тюмень': [65.53, 57.15], 'Воронеж': [39.2, 51.67], 'Волгоград': [44.5, 48.7], 'Мурманск': [33.08, 68.97], 'Якутск': [129.7, 62.03], 'Сочи': [39.73, 43.6], 'Челябинск': [61.4, 55.16], 'Томск': [84.95, 56.48] };
export function proj(lon, lat) {
  const n = 0.62, a = (lon - 100) * Math.PI / 180 * n, r = (90 - lat) * 0.16;
  return [r * Math.sin(a), -(r * Math.cos(a)) + 6.2];
}
export function makeRussiaMap(o = {}) {
  const g = new THREE.Group();
  const shape = new THREE.Shape(RU.map(([lo, la]) => { const [x, y] = proj(lo, la); return new THREE.Vector2(x, y); }));
  const sak = [[142, 46], [143.5, 46.5], [143, 50], [143.3, 54.3], [142.5, 54.2], [142, 50], [141.8, 46.6]];
  const sakS = new THREE.Shape(sak.map(([lo, la]) => { const [x, y] = proj(lo, la); return new THREE.Vector2(x, y); }));
  const nz = [[52, 71.5], [55, 70.6], [57.5, 70.8], [56, 72.5], [60, 75], [68.5, 76.9], [66, 77], [58, 75.5], [53.5, 73]];
  const nzS = new THREE.Shape(nz.map(([lo, la]) => { const [x, y] = proj(lo, la); return new THREE.Vector2(x, y); }));
  const gridT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#16244d'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(90,150,255,0.35)'; c.lineWidth = 2; for (let i = 0; i <= 16; i++) { c.beginPath(); c.moveTo(i * 32, 0); c.lineTo(i * 32, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
    const r = rng(5); for (let i = 0; i < 380; i++) { c.fillStyle = `rgba(120,190,255,${0.2 + r() * 0.5})`; c.beginPath(); c.arc(r() * w, r() * h, 1 + r() * 1.6, 0, 7); c.fill(); } });
  gridT.tex.wrapS = gridT.tex.wrapT = THREE.RepeatWrapping; gridT.tex.repeat.set(0.35, 0.35);
  const topM = new THREE.MeshStandardMaterial({ color: 0x2a3e7a, roughness: 0.35, metalness: 0.3, map: gridT.tex, emissive: 0x1a3a9a, emissiveIntensity: 0.55, emissiveMap: gridT.tex });
  const sideM = phys(0x0e1838, { r: 0.3, m: 0.6 });
  for (const s of [shape, sakS, nzS]) {
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 3, curveSegments: 2 });
    const m = new THREE.Mesh(geo, [topM, sideM]); m.castShadow = true; m.receiveShadow = true; g.add(m);
    const pts = s.getPoints().map((p) => new THREE.Vector3(p.x, p.y, 0.3)); pts.push(pts[0].clone());
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.1), pts.length * 3, 0.022, 6, true), glow(o.edge ?? C.cyan, 2.2));
    g.add(tube);
  }
  // city markers
  g.userData.cities = {};
  const dotG = new THREE.SphereGeometry(0.06, 16, 12);
  const beamG = new THREE.CylinderGeometry(0.025, 0.06, 1, 12, 1, true); beamG.translate(0, 0.5, 0); beamG.rotateX(Math.PI / 2);
  const ringG = new THREE.RingGeometry(0.08, 0.11, 32);
  for (const [name, [lo, la]] of Object.entries(CITIES)) {
    const [x, y] = proj(lo, la); const cg = group(g, x, y, 0.3);
    const dot = mesh(dotG, glow(C.cyan, 3), 0, 0, 0, cg, false);
    const beam = mesh(beamG, glow(C.cyan, 1.6, { add: true, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), 0, 0, 0, cg, false); beam.scale.set(1, 1, 0.001);
    const ring = mesh(ringG, glow(C.cyan, 2.5, { add: true, transparent: true, opacity: 0.8, side: THREE.DoubleSide }), 0, 0, 0.01, cg, false);
    const h = halo(C.cyan, 0.35, 1.2, cg);
    g.userData.cities[name] = { g: cg, dot, beam, ring, halo: h, x, y };
  }
  // center the map around (0,0)
  const bb = new THREE.Box3().setFromObject(g); const cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
  g.children.forEach((ch) => { ch.position.x -= cx; ch.position.y -= cy; });
  for (const c of Object.values(g.userData.cities)) { c.x -= cx; c.y -= cy; }
  g.userData.size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y];
  return g;
}

// ---------- car ----------
export function makeCar(color = 0xe8432f) {
  const car = new THREE.Group();
  const paint = phys(color, { r: 0.25, m: 0.4, cc: 1, ccr: 0.05 });
  const glass = phys(0x0b1224, { r: 0.05, m: 0.2, cc: 1 });
  const dark = phys(0x15171f, { r: 0.6 });
  mesh(rbox(1.85, 0.55, 4.3, 0.22), paint, 0, 0.62, 0, car);
  mesh(rbox(1.62, 0.55, 2.3, 0.3), paint, 0, 1.05, -0.25, car);
  mesh(rbox(1.66, 0.42, 2.0, 0.22), glass, 0, 1.08, -0.25, car);
  mesh(rbox(1.9, 0.18, 4.36, 0.08), dark, 0, 0.4, 0, car);
  for (const s of [1, -1]) {
    mesh(rbox(0.42, 0.13, 0.06, 0.05), glow(0xffffff, 4), 0.62 * s, 0.7, 2.14, car, false);
    mesh(rbox(0.42, 0.1, 0.06, 0.04), glow(0xff2033, 3), 0.62 * s, 0.75, -2.14, car, false);
    mesh(rbox(0.12, 0.06, 0.22, 0.02), dark, 0.94 * s, 1.0, 0.7, car);
  }
  mesh(rbox(0.9, 0.16, 0.05, 0.04), dark, 0, 0.55, 2.16, car);
  car.userData.wheels = [];
  const tireG = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 28); tireG.rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(0.23, 0.23, 0.3, 6); rimG.rotateZ(Math.PI / 2);
  const tireM = phys(0x111217, { r: 0.8, cc: 0 }), rimM = phys(0xc8ccd6, { r: 0.2, m: 1 });
  for (const [x, z] of [[0.86, 1.35], [-0.86, 1.35], [0.86, -1.35], [-0.86, -1.35]]) {
    const w = group(car, x, 0.37, z); mesh(tireG, tireM, 0, 0, 0, w); mesh(rimG, rimM, 0, 0, 0, w); car.userData.wheels.push(w);
  }
  // headlight beams
  const beamM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xbfd8ff).multiplyScalar(0.25), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  for (const s of [1, -1]) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 24, 1, true), beamM); cone.rotation.x = -Math.PI / 2; cone.position.set(0.62 * s, 0.6, 4.6); car.add(cone); }
  return car;
}

// ---------- street ----------
export function makeStreet(o = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(o.bg ?? 0x0a1430); scene.fog = new THREE.Fog(o.bg ?? 0x0a1430, 18, 70);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex(o.skyTop ?? '#071033', o.skyMid ?? '#1e3a8a', o.skyBottom ?? '#f08a6a', 120), side: THREE.BackSide, toneMapped: false, fog: false }));
  scene.add(sky);
  const asphalt = phys(0x1b1f2b, { r: 0.55, cc: 0.5, ccr: 0.3 });
  const road = mesh(new THREE.PlaneGeometry(9, 400), asphalt, 0, 0, 0, scene); road.rotation.x = -Math.PI / 2;
  const lineM = glow(0xd8dde8, 1.0);
  for (let i = -100; i < 100; i++) { const l = mesh(new THREE.PlaneGeometry(0.15, 1.6), lineM, 0, 0.01, i * 4, scene, false); l.rotation.x = -Math.PI / 2; l.receiveShadow = true; }
  const walkM = phys(0x3a3f50, { r: 0.8, cc: 0 });
  for (const s of [1, -1]) { mesh(new THREE.BoxGeometry(4, 0.18, 400), walkM, s * 6.5, 0.09, 0, scene); mesh(new THREE.BoxGeometry(0.2, 0.2, 400), phys(0x6a6f80, { r: 0.6 }), s * 4.5, 0.1, 0, scene); }
  const r = rng(o.seed ?? 21);
  for (let i = -30; i < 30; i++) for (const s of [1, -1]) {
    const h = 6 + r() * 16, w = 5 + r() * 4; const b = makeBuilding(4, h, w, (i + 40) * 3 + (s > 0 ? 1 : 2), o.lit ?? 0.35);
    b.position.set(s * (10.6 + r() * 0.8), b.position.y, i * 9.5 + r() * 2); scene.add(b);
  }
  // street lamps
  scene.userData.lamps = [];
  const poleM = phys(0x2a2f3c, { r: 0.4, m: 0.8 });
  for (let i = -20; i < 20; i++) for (const s of [1, -1]) {
    const lp = group(scene, s * 4.9, 0, i * 12 + (s > 0 ? 6 : 0));
    mesh(new THREE.CylinderGeometry(0.07, 0.09, 5, 10), poleM, 0, 2.5, 0, lp);
    mesh(new THREE.BoxGeometry(1.2, 0.08, 0.12), poleM, -s * 0.55, 4.95, 0, lp);
    mesh(rbox(0.5, 0.1, 0.25, 0.04), glow(0xffd9a0, 5), -s * 1.0, 4.88, 0, lp, false);
    halo(0xffc070, 2.2, 0.6, lp).position.set(-s * 1.0, 4.8, 0);
  }
  scene.add(new THREE.HemisphereLight(o.hemiSky ?? 0x5a78d8, 0x1a1020, o.hemi ?? 0.8));
  const sun = new THREE.DirectionalLight(o.sunColor ?? 0xffb27a, o.sun ?? 2.4); sun.position.set(-12, 10, -20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 80 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target); scene.userData.sun = sun;
  return scene;
}

// ---------- cast ----------
export const HERO = { skin: 0xf1c29d, shirt: 0xff7a45, pants: 0x27324f, shoes: 0xf4f4f4, hair: 0x2a1a12, hairStyle: 'messy', eyes: 0x4a3020 };
export const RIVAL = { skin: 0xe9b48c, shirt: 0xd9a63a, pants: 0x3a3f4f, shoes: 0x2b2b2b, hair: 0x3b2a1a, hairStyle: 'cap', capColor: 0x2d3a66, glasses: true, eyes: 0x2c2c2c };
export const SELLER = { skin: 0xe8b089, shirt: 0xcfd6e6, jacket: 0x4f5d3a, hoodie: false, pants: 0x2f3442, shoes: 0x3a2a20, hair: 0x6b6b6b, hairStyle: 'bald', beard: 0x7a746c, eyes: 0x3a4a5a };
export const BUYER = { skin: 0xf6d0b5, shirt: 0xf0e6ff, jacket: 0x7a4fd6, hoodie: false, pants: 0x1f2433, shoes: 0xffffff, hair: 0x5a2e1c, hairStyle: 'pony', eyes: 0x3a6a4a };
export const NEWBIE = { skin: 0xd9a27a, shirt: 0x2e9c7a, pants: 0x2a3042, shoes: 0xf4f4f4, hair: 0x15100c, hairStyle: 'short', eyes: 0x2a1a10 };

// ---------- studio (dark cyclorama with soft lights) ----------
export function makeStudio(ctx, o = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914); scene.fog = new THREE.Fog(0x050914, 9, 24);
  scene.environment = ctx.env; scene.environmentIntensity = o.env ?? 0.35;
  const bgT = canvasTex(64, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#03050c'); g.addColorStop(0.55, o.mid ?? '#13235a'); g.addColorStop(0.8, '#0a1230'); g.addColorStop(1, '#070b18'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const cyc = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 14, 64, 1, true, Math.PI * 0.5, Math.PI), new THREE.MeshBasicMaterial({ map: bgT.tex, side: THREE.BackSide, fog: false }));
  cyc.position.set(0, 5, 1); scene.add(cyc);
  const floor = mesh(new THREE.CircleGeometry(12, 64), phys(o.floor ?? 0x0b1226, { r: 0.22, m: 0.4, cc: 1, ccr: 0.08 }), 0, 0, 0, scene); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
  // background light pillars
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 1.6; const p = mesh(new THREE.BoxGeometry(0.05, 6, 0.05), glow(i % 2 ? C.blue : C.cyan, 1.2, { transparent: true, opacity: 0.6, add: true }), x, 3, -6 - (i % 3), scene, false); p.userData.k = i; }
  scene.add(new THREE.HemisphereLight(0x3a58b8, 0x080a14, 0.5));
  const key = new THREE.SpotLight(0xfff1e0, o.key ?? 60, 20, 0.45, 0.6, 1.5); key.position.set(-2.5, 6, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.target.position.set(0, 1.2, 0); scene.add(key, key.target);
  const rimL = new THREE.DirectionalLight(0x3d7bff, 2.6); rimL.position.set(-5, 3, -5); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x37d4ff, 2.0); rimR.position.set(5, 2, -4); scene.add(rimR);
  const fill = new THREE.PointLight(0x8a7cff, 6, 10); fill.position.set(2.5, 1.5, 3); scene.add(fill);
  scene.userData = { key, rimL, rimR, fill, floor };
  dust(scene, 220, [9, 5, 6], 0x7fa8ff, 0.03, 12).position.z = -1;
  return scene;
}
export function makeStopwatch() {
  const g = new THREE.Group();
  const chrome = phys(0xd6dbe6, { r: 0.15, m: 1, cc: 1 });
  const body = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 64), phys(0x141a2c, { r: 0.3, m: 0.6, cc: 1 }), 0, 0, 0, g); body.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.34, 0.035, 16, 64), chrome, 0, 0, 0.04, g);
  const crown = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 20), chrome, 0, 0.42, 0, g); mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 16), chrome, 0, 0.36, 0, g);
  mesh(new THREE.TorusGeometry(0.06, 0.016, 10, 24), chrome, 0, 0.5, 0, g);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16), chrome, 0.26, 0.27, 0, g).rotation.z = -0.78;
  const face = canvasTex(512, 512);
  mesh(new THREE.CircleGeometry(0.31, 64), new THREE.MeshStandardMaterial({ map: face.tex, emissive: 0xffffff, emissiveMap: face.tex, emissiveIntensity: 0.35, roughness: 0.3 }), 0, 0, 0.061, g, false);
  mesh(new THREE.SphereGeometry(0.315, 48, 16, 0, Math.PI * 2, 0, 0.45), phys(0xffffff, { r: 0.02, transparent: true, opacity: 0.12, cc: 1 }), 0, 0, -0.22, g, false).rotation.x = Math.PI / 2;
  const hand = group(g, 0, 0, 0.075); mesh(new THREE.BoxGeometry(0.014, 0.26, 0.01), glow(C.orange, 2.5), 0, 0.1, 0, hand, false); mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), chrome, 0, 0, 0, hand).rotation.x = Math.PI / 2;
  g.userData = { face, hand };
  return g;
}
