import { THREE, C, makeStreet, makeStudio, makeCharacter, makePhone, HERO, BUYER, canvasTex, text3D, rbox, phys, std, glow, mesh, group, halo, P, clamp, lerp, setCam, seq, eio, eout, eback, eelastic, blinkAt, talkAt, F, rr, rng } from './lib.js';
import { label } from './s3_find.js';
import { makeStorefront } from './s5_buy.js';

export function noteTex() {
  return canvasTex(256, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f2a25a'); g.addColorStop(1, '#d4652e'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 4; c.strokeRect(8, 8, w - 16, h - 16);
    c.fillStyle = 'rgba(120,40,10,.5)'; c.beginPath(); c.arc(70, 64, 34, 0, 7); c.fill();
    c.fillStyle = '#fff4e6'; c.font = F(900, 46); c.textAlign = 'right'; c.fillText('5000', w - 20, 60); c.font = F(700, 20); c.fillText('ПЯТЬ ТЫСЯЧ РУБЛЕЙ', w - 20, 98);
  }).tex;
}
export function makeCash(n = 8) {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ map: noteTex(), roughness: 0.7 });
  for (let i = 0; i < n; i++) { const b = mesh(new THREE.BoxGeometry(0.16, 0.003, 0.075), [std(0xd98448), std(0xd98448), m, m, std(0xd98448), std(0xd98448)], 0, i * 0.004, 0, g); b.rotation.y = (i % 3 - 1) * 0.04; }
  return g;
}

export async function build(ctx) {
  // ---------- evening sale ----------
  const st = makeStreet({ seed: 77, lit: 0.6, skyTop: '#0b0a2a', skyMid: '#3b2a78', skyBottom: '#ff7a8a', sun: 1.2, sunColor: 0xff8aa0, hemi: 0.6, hemiSky: 0x6a58c8, bg: 0x0d0b26 });
  st.environment = ctx.env; st.environmentIntensity = 0.25;
  const shop = makeStorefront('ЭЛЕКТРОНИКА'); shop.position.set(9.6, 0.18, 0); st.add(shop);
  const hero = makeCharacter(HERO); hero.position.set(5.7, 0.18, 0.5); hero.rotation.y = Math.PI + 0.5; st.add(hero);
  const buyer = makeCharacter(BUYER); buyer.position.set(5.7, 0.18, -0.55); buyer.rotation.y = -0.5; buyer.scale.setScalar(0.94); st.add(buyer);
  const ip = makePhone({ color: 0x8d877c }); ip.scale.setScalar(1.25); st.add(ip);
  const ipT = canvasTex(300, 620, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#ff8a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); ip.setScreen(ipT.tex, 1);
  const cash = makeCash(10); cash.scale.setScalar(1.3); st.add(cash);
  const tagG = group(st, 5.3, 2.0, 0);
  const tag = text3D('77 000 ₽', { size: 0.19, depth: 0.08, color: 0xffffff, emissive: 0x3355aa, ei: 0.4 }); tag.rotation.y = -Math.PI / 2; tagG.add(tag);
  const tagL = label('ПРОДАНО ЗА', { px: 70, size: 0.9, color: '#ffd2e0' }); tagL.position.set(0, 0.27, 0); tagL.rotation.y = -Math.PI / 2; tagG.add(tagL);
  const warm = new THREE.PointLight(0xffb070, 12, 9); warm.position.set(7.6, 2.8, 0); st.add(warm);
  const camE = new THREE.PerspectiveCamera(38, ctx.aspect, 0.05, 200); st.add(camE);
  // ---------- profit showcase ----------
  const sc = makeStudio(ctx, { mid: '#10334a' });
  const camP = new THREE.PerspectiveCamera(30, ctx.aspect, 0.05, 80); sc.add(camP);
  const ped = group(sc, 0, 0, 0.3);
  mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.5, 64), phys(0x101a33, { r: 0.2, m: 0.6, cc: 1 }), 0, 0.25, 0, ped);
  const pring = mesh(new THREE.TorusGeometry(0.56, 0.012, 8, 96), glow(C.green, 3), 0, 0.5, 0, ped, false); pring.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.615, 0.01, 8, 96), glow(C.cyan, 2), 0, 0.03, 0, ped, false).rotation.x = Math.PI / 2;
  const ph = makePhone({ color: 0x8d877c }); ph.scale.setScalar(4.6); const phG = group(ped, 0, 0.95, 0); phG.add(ph);
  const phT = canvasTex(600, 1240, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(0.5, '#6a3dbf'); g.addColorStop(1, '#ff8a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); ph.setScreen(phT.tex, 1);
  halo(C.green, 2.2, 0.35, phG).position.z = -0.5;
  const row = (lbl, val, y, col, lc) => { const g = group(sc, 0, y, 0.5); const l = label(lbl, { px: 74, size: 0.82, color: lc, w: 1024, h: 160 }); l.position.set(-0.45, 0, 0); g.add(l); const v = text3D(val, { size: 0.15, depth: 0.05, color: col, align: 'right' }); v.position.set(0.74, 0, 0); g.add(v); return g; };
  const r1 = row('ПОКУПКА', '52 000 ₽', 2.95, 0xe8ecf8, '#8fa3d6');
  const r2 = row('ПРОДАЖА', '77 000 ₽', 2.62, 0xe8ecf8, '#8fa3d6');
  const line = mesh(rbox(1.7, 0.012, 0.012, 0.005), glow(0x8fa3d6, 1.2), 0, 2.42, 0.5, sc, false);
  const profit = text3D('+25 000 ₽', { size: 0.215, depth: 0.08, color: 0x2ee59d, emissive: 0x18c47e, ei: 0.5, sideColor: 0x0d4a35 }); profit.position.set(0, 2.12, 0.55); sc.add(profit);
  const pl = new THREE.PointLight(C.green, 0, 3); pl.position.set(0, 2.1, 1.3); sc.add(pl);
  const lblDay = label('ЧИСТАЯ ПРИБЫЛЬ ЗА 1 ДЕНЬ', { px: 64, size: 1.3, color: '#bfffe2', w: 1400, h: 140 }); lblDay.position.set(0, 1.8, 0.55); sc.add(lblDay);
  // falling notes
  const nm = new THREE.MeshStandardMaterial({ map: noteTex(), roughness: 0.6, side: THREE.DoubleSide, emissive: 0x552200, emissiveIntensity: 0.3 });
  const ng = new THREE.PlaneGeometry(0.32, 0.15); const r = rng(9); const notes = [];
  for (let i = 0; i < 46; i++) { const m = mesh(ng, nm, 0, 0, 0, sc, false); notes.push({ m, x: (r() - 0.5) * 2.6, z: -1.2 + r() * 2.8, d: r() * 1.6, sp: 0.9 + r() * 0.6, rx: r() * 6, ry: r() * 6 }); }
  const burst = halo(C.green, 0.1, 1.5, sc); burst.position.set(0, 2.12, 0.7);
  const v = new THREE.Vector3(), v2 = new THREE.Vector3();
  return {
    update(t) {
      if (t < 2.6) {
        const give = P(t, 0.7, 1.6, eio);
        const reach = P(t, 0.4, 0.8) * (1 - P(t, 1.8, 2.2));
        hero.pose({ rArm: [lerp(-0.3, -1.15, reach), 0.25, 0], rElbow: lerp(-0.4, -0.45, reach), lArm: [lerp(-0.2, -1.1, reach), -0.2, 0.1], lElbow: lerp(-0.3, -0.5, reach), head: [0.08, 0.05, 0], blink: blinkAt(t, 0.3), smile: 0.9, talk: talkAt(t, t > 1.7 ? 1 : 0), brow: 0.4 });
        buyer.pose({ rArm: [lerp(-0.2, -1.15, reach), -0.25, 0], rElbow: -0.45, lArm: [lerp(-0.2, -1.1, reach), 0.2, -0.1], lElbow: -0.5, head: [0.12, 0, 0.05], blink: blinkAt(t, 2.1), smile: lerp(0.5, 1.0, give), look: [0, -0.3], brow: 0.5 });
        hero.updateMatrixWorld(true); buyer.updateMatrixWorld(true);
        hero.J.rHand.getWorldPosition(v); buyer.J.lHand.getWorldPosition(v2);
        ip.position.lerpVectors(v, v2, give).y += 0.06 + Math.sin(give * Math.PI) * 0.1; ip.rotation.set(-1.2, give * 2.0, 0);
        buyer.J.rHand.getWorldPosition(v2); hero.J.lHand.getWorldPosition(v);
        cash.position.lerpVectors(v2, v, give).y += 0.04 + Math.sin(give * Math.PI) * 0.12; cash.rotation.set(0, 0.5 + give, 0);
        tagG.scale.setScalar(Math.max(0.0001, P(t, 1.0, 1.4, eback))); tagG.position.y = 2.0 + Math.sin(t * 2) * 0.03;
        const k = P(t, 0, 2.6, (x) => x);
        setCam(camE, [lerp(2.4, 2.9, k), lerp(1.2, 1.5, k), lerp(1.8, 0.9, k)], [5.6, 1.3, 0.0], t, 0.012);
        camE.updateProjectionMatrix();
        return { scene: st, camera: camE };
      }
      // showcase
      const lt = t;
      ph.rotation.set(0.05, Math.PI + 0.4 + (t - 2.6) * 0.6, -0.05); phG.position.y = 0.95 + Math.sin(t * 1.5) * 0.03;
      r1.scale.setScalar(Math.max(0.0001, P(t, 2.7, 3.05, eback))); r2.scale.setScalar(Math.max(0.0001, P(t, 2.9, 3.25, eback)));
      line.scale.set(Math.max(0.001, P(t, 3.1, 3.4, eout)), 1, 1);
      const pp = P(t, 3.15, 3.7, eelastic); profit.scale.setScalar(Math.max(0.0001, pp * (1 + Math.max(0, Math.sin((t - 3.7) * 5)) * 0.03 * (t > 3.7 ? 1 : 0))));
      pl.intensity = P(t, 3.2, 3.6) * 6;
      lblDay.scale.setScalar(Math.max(0.0001, P(t, 5.3, 5.7, eback)));
      const bk = P(t, 3.15, 3.9, (x) => x); burst.scale.setScalar(0.1 + bk * 5); burst.material.opacity = (1 - bk) * (t > 3.15 ? 1 : 0);
      for (const n of notes) {
        const ft = (t - 3.25 - n.d) * n.sp; const on = ft > 0;
        n.m.visible = on; if (!on) continue;
        n.m.position.set(n.x + Math.sin(ft * 2 + n.rx) * 0.15, 4.2 - ft * 1.6, n.z); n.m.rotation.set(n.rx + ft * 2.5, n.ry + ft * 1.7, ft);
      }
      pring.material.color.set(C.green).multiplyScalar(2.5 + Math.sin(t * 6) * 0.8);
      const k = P(t, 2.6, 7.4, (x) => x);
      setCam(camP, [Math.sin(lerp(-0.25, 0.15, k)) * lerp(7.0, 6.5, k), lerp(1.9, 1.75, k), 0.5 + Math.cos(lerp(-0.25, 0.15, k)) * lerp(7.0, 6.5, k)], [0, 1.65, 0.4], t, 0.01);
      camP.updateProjectionMatrix();
      return { scene: sc, camera: camP };
    },
  };
}
