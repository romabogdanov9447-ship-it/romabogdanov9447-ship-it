import { THREE, C, makeStudio, makePhone, makeCharacter, makeRussiaMap, NEWBIE, canvasTex, text3D, rbox, phys, std, glow, mesh, group, halo, dust, P, clamp, lerp, setCam, seq, eio, eout, eback, eelastic, blinkAt, F, rr, FONT, drawProductIcon } from './lib.js';
import { label } from './s3_find.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ---- product models ----
function console3D() { const g = new THREE.Group(); mesh(rbox(0.16, 0.5, 0.42, 0.04), phys(0xf4f5f8, { r: 0.3, cc: 1 }), 0, 0, 0, g); mesh(rbox(0.06, 0.48, 0.38, 0.02), phys(0x16181f, { r: 0.2, cc: 1 }), 0, 0, 0, g).scale.x = 1.9; mesh(rbox(0.17, 0.5, 0.43, 0.04), phys(0xf4f5f8, { r: 0.3, cc: 1 }), 0, 0, 0, g).scale.set(1, 1, 1); return g; }
function gamepad3D() { const g = new THREE.Group(); const m = phys(0x2a2f40, { r: 0.35, cc: 1 }); const b = mesh(new THREE.CapsuleGeometry(0.07, 0.16, 8, 16), m, 0, 0, 0, g); b.rotation.z = Math.PI / 2; for (const s of [1, -1]) { const h = mesh(new THREE.CapsuleGeometry(0.055, 0.08, 8, 12), m, 0.1 * s, -0.06, 0, g); h.rotation.z = 0.5 * s; }
  [[0.09, 0.02, C.red], [0.12, -0.01, C.cyan], [0.06, -0.01, C.green], [0.09, -0.04, C.gold]].forEach(([x, y, c]) => mesh(new THREE.SphereGeometry(0.012, 10, 8), glow(c, 1.5), x, y, 0.06, g, false));
  mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 16), phys(0x111111), -0.08, 0.0, 0.065, g).rotation.x = Math.PI / 2; return g; }
function headphones3D() { const g = new THREE.Group(); const m = phys(0xe9e6f2, { r: 0.3, cc: 1 }); mesh(new THREE.TorusGeometry(0.16, 0.022, 10, 32, Math.PI), m, 0, 0, 0, g); for (const s of [1, -1]) { const c = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), m, 0.16 * s, -0.04, 0, g); c.rotation.z = Math.PI / 2; mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), phys(0x2a2a33, { r: 0.8 }), 0.13 * s, -0.04, 0, g).rotation.z = Math.PI / 2; } return g; }
function box3D(w = 0.3, h = 0.22, d = 0.3, kind = 'box') { const g = new THREE.Group(); const t = canvasTex(256, 256, (c) => { c.fillStyle = kind === 'shoe' ? '#ff6a3d' : '#c99a62'; c.fillRect(0, 0, 256, 256); if (kind === 'shoe') { c.fillStyle = '#fff'; c.font = F(900, 52); c.textAlign = 'center'; c.fillText('SNKR', 128, 150); } else { c.fillStyle = '#e8d2a8'; c.fillRect(110, 0, 36, 256); } });
  mesh(rbox(w, h, d, 0.012), std(0xffffff, { map: t.tex, r: 0.7 }), 0, 0, 0, g); return g; }
function laptop3D() { const g = new THREE.Group(); const m = phys(0xb9bec9, { r: 0.25, m: 0.9 }); mesh(rbox(0.5, 0.02, 0.34, 0.01), m, 0, 0, 0, g); const lid = group(g, 0, 0.01, -0.17); lid.rotation.x = -1.85; mesh(rbox(0.5, 0.015, 0.34, 0.01), m, 0, 0, 0.17, lid);
  const st = canvasTex(256, 170, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#2a3d8f'); gr.addColorStop(1, '#7a3dbf'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }); mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ map: st.tex, toneMapped: false }), 0, -0.009, 0.17, lid, false).rotation.x = Math.PI / 2; return g; }
function watch3D() { const g = new THREE.Group(); mesh(rbox(0.12, 0.14, 0.035, 0.03), phys(0x1a1d26, { r: 0.2, m: 0.8, cc: 1 }), 0, 0, 0, g); mesh(rbox(0.07, 0.36, 0.015, 0.01), phys(0xff6a3d, { r: 0.6 }), 0, 0, -0.02, g); mesh(new THREE.PlaneGeometry(0.1, 0.12), glow(0x3d7bff, 0.9), 0, 0, 0.019, g, false); return g; }

export async function build(ctx) {
  // ========== LOGO SCENE ==========
  const sc = makeStudio(ctx, { mid: '#162a6a', key: 70 });
  const cam = new THREE.PerspectiveCamera(30, ctx.aspect, 0.05, 80); sc.add(cam);
  const logo = group(sc, -0.05, 2.35, 0.3);
  const front = phys(0xffffff, { r: 0.18, m: 0.2, e: 0x3d7bff, ei: 0.25 }), side = phys(0x2f5fff, { r: 0.25, m: 0.8, e: 0x0a2a8a, ei: 0.4 });
  const word = 'ПЕРЕКУПЫ'; const letters = []; let x = 0; const size = 0.19, gap = 0.01;
  for (const ch of word) { const geo = new TextGeometry(ch, { font: FONT, size, depth: 0.12, curveSegments: 6, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.008, bevelSegments: 3 }); geo.computeBoundingBox(); const bb = geo.boundingBox; const w = bb.max.x - bb.min.x; geo.translate(-bb.min.x - w / 2, -size * 0.36, -0.06);
    const m = new THREE.Mesh(geo, [front, side]); m.castShadow = true; m.position.x = x + w / 2; x += w + gap; logo.add(m); letters.push(m); }
  letters.forEach((m) => (m.position.x -= x / 2));
  const under = mesh(rbox(x * 0.9, 0.025, 0.04, 0.01), glow(C.green, 3), 0, -0.24, 0.05, logo, false);
  const tagline = label('НЕЙРОСЕТЬ + ОБУЧЕНИЕ ДЛЯ ПЕРЕКУПОВ', { px: 58, size: 1.55, color: '#a9c4ff', w: 1600, h: 120 }); tagline.position.set(0, -0.38, 0.05); logo.add(tagline);
  const logoL = new THREE.PointLight(0x5f8cff, 6, 4); logoL.position.set(0, 0.2, 1.2); logo.add(logoL);
  // products orbit
  const prods = [];
  const addP = (o, s = 1) => { o.scale.setScalar(s); o.traverse((m) => { if (m.isMesh) m.castShadow = true; }); sc.add(o); prods.push(o); return o; };
  const p1 = makePhone({ color: 0x8d877c }); const s1 = canvasTex(300, 620, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#ff8a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); p1.setScreen(s1.tex, 1);
  addP(p1, 2.4); const p2 = makePhone({ color: 0x2b3a5a }); p2.setScreen(s1.tex, 0.8); addP(p2, 2.2);
  addP(console3D(), 0.9); addP(gamepad3D(), 1.3); addP(headphones3D(), 1.2); addP(box3D(0.34, 0.2, 0.24, 'shoe'), 1); addP(box3D(0.3, 0.26, 0.3), 1); addP(laptop3D(), 1.0); addP(watch3D(), 1.3); addP(box3D(0.22, 0.18, 0.22), 1);
  // hero iPhone for the finale
  const hp = makePhone({ color: 0x8d877c }); hp.scale.setScalar(5.2); const hpG = group(sc, 0, 1.25, 0.9); hpG.add(hp); hp.setScreen(s1.tex, 1);
  const hpHalo = halo(0x6f8cff, 2.2, 0.5, hpG); hpHalo.position.z = -0.4;
  // offer plaque
  const offer = group(sc, 0, 0.62, 1.15);
  mesh(rbox(1.62, 0.36, 0.08, 0.12), phys(0x0d1630, { r: 0.2, m: 0.5, cc: 1, transparent: true, opacity: 0.92 }), 0, 0, 0, offer);
  const ol = label('ПЕРВЫЙ МЕСЯЦ', { px: 70, size: 0.72, color: '#a9c4ff', w: 1024, h: 140 }); ol.position.set(-0.35, 0, 0.05); offer.add(ol);
  const op = text3D('2 000 ₽', { size: 0.17, depth: 0.05, color: 0x2ee59d, emissive: 0x18c47e, ei: 0.8, sideColor: 0x0d4a35 }); op.position.set(0.4, 0, 0.06); offer.add(op);
  const cta = group(sc, 0, 0.18, 1.25);
  const ctaB = mesh(rbox(1.3, 0.24, 0.1, 0.12), phys(C.green, { r: 0.25, cc: 1, e: 0x14a86a, ei: 0.6 }), 0, 0, 0, cta);
  const ctl = label('ССЫЛКА В ПРОФИЛЕ', { px: 78, size: 1.1, color: '#04261a', weight: 900, w: 1200, h: 140 }); ctl.position.z = 0.055; cta.add(ctl);
  const ctaHalo = halo(C.green, 2.2, 0.0, cta); ctaHalo.position.z = -0.2;
  // ========== MAP SCENE ==========
  const ms = new THREE.Scene(); ms.background = new THREE.Color(0x03060f); ms.fog = new THREE.FogExp2(0x03060f, 0.03); ms.environment = ctx.env; ms.environmentIntensity = 0.35;
  ms.add(new THREE.HemisphereLight(0x4060c0, 0x050810, 0.9)); const mk = new THREE.DirectionalLight(0xbfd0ff, 1.6); mk.position.set(-3, 8, 6); mk.castShadow = true; mk.shadow.mapSize.set(2048, 2048); Object.assign(mk.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); ms.add(mk);
  const map = makeRussiaMap(); map.rotation.x = -Math.PI / 2; ms.add(map); map.updateMatrixWorld(true);
  dust(ms, 300, [16, 6, 12], 0x6fa8ff, 0.05, 17);
  const mcam = new THREE.PerspectiveCamera(36, ctx.aspect, 0.05, 120); ms.add(mcam);
  const deals = [['Санкт-Петербург', 'PS5', '−22%'], ['Казань', 'MacBook Air', '−30%'], ['Краснодар', 'Dyson', '−29%'], ['Екатеринбург', 'AirPods Pro', '−35%'], ['Новосибирск', 'iPad Air', '−25%']];
  const pins = deals.map(([city, item, pct], i) => {
    const c = map.userData.cities[city]; const wp = new THREE.Vector3(); c.g.getWorldPosition(wp);
    const g = group(ms, wp.x, wp.y, wp.z);
    const pin = group(g); mesh(new THREE.SphereGeometry(0.11, 20, 14), phys(C.green, { r: 0.2, cc: 1, e: 0x14a86a, ei: 0.7 }), 0, 0.42, 0, pin); const cone = mesh(new THREE.ConeGeometry(0.07, 0.3, 16), phys(C.green, { r: 0.2, cc: 1, e: 0x14a86a, ei: 0.5 }), 0, 0.25, 0, pin); cone.rotation.x = Math.PI;
    const card = group(g, 0, 1.0, 0); card.userData.s = 1.7;
    mesh(rbox(1.0, 0.42, 0.04, 0.08), phys(0x1a2a5a, { r: 0.2, m: 0.4, cc: 1, e: 0x10307a, ei: 0.6 }), 0, 0, 0, card);
    const t = canvasTex(500, 210, (cx, w, h) => { cx.fillStyle = '#9fb3e6'; cx.font = F(700, 36); cx.textAlign = 'left'; cx.fillText(city, 24, 52); cx.fillStyle = '#ffffff'; cx.font = F(800, 50); cx.fillText(item, 24, 118); cx.fillStyle = '#2ee59d'; cx.font = F(900, 64); cx.textAlign = 'right'; cx.fillText(pct, w - 22, 180); cx.fillStyle = '#8a93a8'; cx.font = F(600, 30); cx.textAlign = 'left'; cx.fillText('ниже рынка', 24, 178); });
    mesh(new THREE.PlaneGeometry(0.98, 0.41), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, toneMapped: false }), 0, 0, 0.022, card, false);
    return { g, pin, card, c, i };
  });
  // ========== TRAINING SCENE ==========
  const tr = makeStudio(ctx, { mid: '#1b2660', key: 45 });
  const tcam = new THREE.PerspectiveCamera(34, ctx.aspect, 0.05, 80); tr.add(tcam);
  const desk = group(tr, 0, 0, 0);
  mesh(rbox(1.6, 0.06, 0.8, 0.02), phys(0x3b3f52, { r: 0.4, cc: 0.5 }), 0, 0.76, 0, desk);
  for (const [dx, dz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74), phys(0x9aa0ad, { m: 1, r: 0.3 }), dx, 0.37, dz, desk);
  const lap = group(desk, 0, 0.79, 0.05); lap.rotation.y = Math.PI;
  const lm = phys(0xb9bec9, { r: 0.25, m: 0.9 }); mesh(rbox(0.7, 0.025, 0.48, 0.012), lm, 0, 0.012, 0, lap);
  const lid = group(lap, 0, 0.025, -0.24); lid.rotation.x = -1.85; mesh(rbox(0.7, 0.02, 0.48, 0.012), lm, 0, 0, 0.24, lid);
  const lsT = canvasTex(700, 460);
  const lsc = mesh(new THREE.PlaneGeometry(0.66, 0.43), new THREE.MeshBasicMaterial({ map: lsT.tex, toneMapped: false }), 0, 0.012, 0.24, lid, false); lsc.rotation.x = Math.PI / 2; lsc.rotation.z = Math.PI;
  const lapL = new THREE.PointLight(0x8fb0ff, 0.9, 2); lapL.position.set(0, 1.1, -0.3); tr.add(lapL);
  const nb = makeCharacter(NEWBIE); nb.position.set(0, 0, -0.55); tr.add(nb);
  const chair = group(tr, 0, 0, -0.6); mesh(rbox(0.5, 0.07, 0.48, 0.03), phys(0x23262f), 0, 0.48, 0, chair); mesh(rbox(0.5, 0.6, 0.07, 0.03), phys(0x23262f), 0, 0.85, -0.24, chair);
  const list = group(tr, 0.05, 2.25, 0.2);
  mesh(rbox(1.35, 0.95, 0.05, 0.08), phys(0x0d1630, { r: 0.2, m: 0.4, cc: 1, transparent: true, opacity: 0.92 }), 0, 0, 0, list);
  const listT = canvasTex(1000, 700); mesh(new THREE.PlaneGeometry(1.32, 0.92), new THREE.MeshBasicMaterial({ map: listT.tex, transparent: true, toneMapped: false }), 0, 0, 0.03, list, false);
  const cap = group(tr, 0.62, 2.9, 0.3); mesh(rbox(0.36, 0.03, 0.36, 0.01), phys(0x111522, { r: 0.4 }), 0, 0, 0, cap).rotation.y = Math.PI / 4; mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.1, 24), phys(0x111522), 0, -0.06, 0, cap); mesh(new THREE.SphereGeometry(0.025), glow(C.gold, 2), 0, 0.02, 0, cap, false); mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18), glow(C.gold, 2), 0.15, -0.07, 0.1, cap, false);
  const items = ['Как искать выгодные товары', 'Проверка техники при встрече', 'Торг и безопасная сделка', 'Быстрая перепродажа'];
  const tmp = new THREE.Vector3();
  return {
    update(t) {
      // ---------- MAP (3.2 - 6.9) ----------
      if (t >= 3.2 && t < 6.9) {
        const k = P(t, 3.2, 6.9, eio);
        for (const p of pins) { const a = P(t, 3.5 + p.i * 0.4, 3.9 + p.i * 0.4, eback); p.pin.scale.setScalar(Math.max(0.0001, a)); p.pin.position.y = (1 - P(t, 3.5 + p.i * 0.4, 3.8 + p.i * 0.4, eout)) * 1.5; p.card.scale.setScalar(Math.max(0.0001, 1.25 * P(t, 3.7 + p.i * 0.4, 4.1 + p.i * 0.4, eback))); p.card.position.y = 1.1 + (p.i % 2) * 0.55 + Math.sin(t * 2 + p.i) * 0.04; }
        for (const c of Object.values(map.userData.cities)) { const pr = ((t * 0.7 + c.x) % 1 + 1) % 1; c.ring.scale.setScalar(1 + pr * 2.5); c.ring.material.opacity = (1 - pr) * 0.8; c.beam.scale.set(1, 1, 0.4); c.beam.material.opacity = 0.3; }
        setCam(mcam, [lerp(-7.0, -4.2, k), lerp(7.0, 4.6, k), lerp(8.4, 5.6, k)], [lerp(-1.5, -2.6, k), 0.4, lerp(-0.2, -0.6, k)], t, 0.02);
        for (const p of pins) p.card.lookAt(mcam.position);
        mcam.updateProjectionMatrix();
        return { scene: ms, camera: mcam, fade: Math.max(1 - P(t, 3.2, 3.42), P(t, 6.68, 6.9)) };
      }
      // ---------- TRAINING (6.9 - 9.6) ----------
      if (t >= 6.9 && t < 9.6) {
        const k = P(t, 6.9, 9.6, (x) => x);
        nb.pose({ y: -0.32, lLeg: [-1.5, 0, 0.05], rLeg: [-1.5, 0, -0.05], lKnee: 1.45, rKnee: 1.45, torso: [0.1, 0, 0], head: [0.15, Math.sin(t) * 0.05, 0], rArm: [-0.75, 0.15, 0.1], rElbow: -0.9 + Math.sin(t * 9) * 0.05, lArm: [-0.75, -0.15, -0.1], lElbow: -0.9 + Math.cos(t * 8) * 0.05, blink: blinkAt(t, 0.4), smile: lerp(0.5, 1.0, P(t, 8.0, 8.6)), brow: P(t, 8.0, 8.4) * 0.6, look: [0, -0.4] });
        const prog = P(t, 7.0, 9.4, (x) => x);
        lsT.draw((c, w, h) => { c.fillStyle = '#0d1430'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, w, 300); g.addColorStop(0, '#24357a'); g.addColorStop(1, '#5a2f9a'); c.fillStyle = g; rr(c, 24, 24, w - 48, 300, 20); c.fill();
          c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.moveTo(w / 2 - 34, 130); c.lineTo(w / 2 + 44, 174); c.lineTo(w / 2 - 34, 218); c.fill();
          c.fillStyle = '#ffffff'; c.font = F(800, 40); c.textAlign = 'left'; c.fillText('Урок 1. Где искать товар', 30, 380); c.fillStyle = '#2b375e'; rr(c, 30, 410, w - 60, 16, 8); c.fill(); c.fillStyle = '#2ee59d'; rr(c, 30, 410, (w - 60) * prog, 16, 8); c.fill(); });
        listT.draw((c, w, h) => { c.fillStyle = '#ffffff'; c.font = F(900, 66); c.textAlign = 'left'; c.fillText('ОБУЧЕНИЕ С НУЛЯ', 50, 100);
          items.forEach((it, i) => { const a = P(t, 7.2 + i * 0.45, 7.45 + i * 0.45); const y = 210 + i * 125; c.globalAlpha = 0.35 + a * 0.65; c.fillStyle = a > 0.5 ? '#2ee59d' : '#2b375e'; rr(c, 50, y - 50, 70, 70, 18); c.fill(); if (a > 0.5) { c.strokeStyle = '#04261a'; c.lineWidth = 10; c.beginPath(); c.moveTo(66, y - 15); c.lineTo(82, y + 2); c.lineTo(106, y - 30); c.stroke(); } c.fillStyle = '#e8ecf8'; c.font = F(700, 44); c.fillText(it, 150, y); c.globalAlpha = 1; }); });
        list.scale.setScalar(Math.max(0.0001, P(t, 7.0, 7.4, eback))); list.rotation.y = -0.15 + Math.sin(t) * 0.03;
        cap.rotation.set(0.2, t * 1.2, 0.1); cap.position.y = 2.9 + Math.sin(t * 2) * 0.05; cap.scale.setScalar(Math.max(0.0001, P(t, 8.6, 9.0, eback)));
        setCam(tcam, [lerp(1.6, 1.2, k), lerp(1.9, 1.85, k), lerp(4.6, 3.9, k)], [0.1, 1.55, 0], t, 0.01);
        tcam.updateProjectionMatrix();
        return { scene: tr, camera: tcam, fade: Math.max(1 - P(t, 6.9, 7.12), P(t, 9.38, 9.6)) };
      }
      // ---------- LOGO (0-3.2, 9.6-19.2) ----------
      const fin = t >= 9.6;
      letters.forEach((m, i) => { const a = P(t, 0.35 + i * 0.07, 0.85 + i * 0.07, eback); m.scale.setScalar(Math.max(0.0001, fin ? 1 : a)); m.rotation.x = fin ? 0 : (1 - a) * 1.2; m.position.y = fin ? 0 : (1 - a) * -0.3; });
      under.scale.set(Math.max(0.001, fin ? 1 : P(t, 1.1, 1.6, eout)), 1, 1); tagline.material.opacity = fin ? 1 : P(t, 1.5, 2.0);
      const glint = (t * 0.4) % 1; front.emissiveIntensity = 0.25 + Math.max(0, Math.sin(glint * Math.PI * 2)) * 0.15;
      // orbit of products
      const R = fin ? 1.45 : lerp(2.8, 1.35, P(t, 0, 1.4, eout));
      prods.forEach((o, i) => {
        const a = i / prods.length * Math.PI * 2 + t * 0.35;
        o.position.set(Math.cos(a) * R, (fin ? 2.35 : 2.0) + Math.sin(a * 2 + i) * 0.25 + Math.sin(a) * 0.35, 0.3 + Math.sin(a) * R * 0.75);
        o.rotation.set(Math.sin(t + i) * 0.4, t * 0.8 + i, Math.cos(t * 0.7 + i) * 0.3);
        o.visible = !(fin && t > 17.0);
      });
      hpG.visible = fin;
      if (fin) {
        const hk = P(t, 9.6, 10.6, eout);
        hpG.position.set(0, lerp(-0.5, 1.28, hk) + Math.sin(t * 1.4) * 0.025, 0.9); hp.rotation.set(0.04, Math.PI + 0.35 + lerp(-6.0, 0, hk) - (t - 10.6) * 0.08 * (t > 10.6 ? 1 : 0), -0.05);
        offer.scale.setScalar(Math.max(0.0001, P(t, 9.8, 10.3, eback)));
        cta.scale.setScalar(Math.max(0.0001, P(t, 12.4, 12.9, eback) * (1 + (t > 12.9 ? Math.max(0, Math.sin((t - 12.9) * 4)) * 0.04 : 0))));
        ctaHalo.material.opacity = t > 12.6 ? 0.4 + Math.sin(t * 4) * 0.25 : 0;
        // final: a warning red pulse on the hero phone (someone else may take it)
        hpHalo.material.color.set(t > 14.4 ? new THREE.Color(0x6f8cff).lerp(new THREE.Color(0xff4d5e), P(t, 14.4, 15.2) * (0.6 + Math.sin(t * 6) * 0.4)) : 0x6f8cff).multiplyScalar(0.6);
      } else { offer.scale.setScalar(0.0001); cta.scale.setScalar(0.0001); }
      // camera
      if (!fin) { const k = P(t, 0, 3.2, (x) => x); setCam(cam, [Math.sin(lerp(-0.2, 0.08, k)) * lerp(8.0, 6.9, eio(k)), lerp(2.9, 2.5, k), 0.3 + Math.cos(lerp(-0.2, 0.08, k)) * lerp(8.0, 6.9, eio(k))], [0, lerp(2.2, 2.0, k), 0.3], t, 0.012); }
      else { const k = P(t, 9.6, 19.2, (x) => x); const a = lerp(0.12, -0.08, k); const d = lerp(7.4, 6.8, eio(k)); setCam(cam, [Math.sin(a) * d, lerp(1.7, 1.6, k), 0.3 + Math.cos(a) * d], [0, 1.52, 0.3], t, 0.01); }
      cam.updateProjectionMatrix();
      return { scene: sc, camera: cam, fade: fin ? 1 - P(t, 9.6, 9.82) : P(t, 3.0, 3.2) };
    },
  };
}
