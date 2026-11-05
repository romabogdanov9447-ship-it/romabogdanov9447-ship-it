import { THREE, C, makeStudio, makePhone, makeStopwatch, canvasTex, drawListing, text3D, rbox, phys, glow, mesh, group, halo, P, clamp, lerp, setCam, seq, eio, eout, eback, eelastic, F, rr } from './lib.js';

export function label(text, o = {}) {
  const w = o.w ?? 1024, h = o.h ?? 160;
  const t = canvasTex(w, h, (c) => { c.font = F(o.weight ?? 800, o.px ?? 84); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = o.color ?? '#9fb3e6'; if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = 20; } c.fillText(text, w / 2, h / 2 + 4); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(o.size ?? 1, (o.size ?? 1) * h / w), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, toneMapped: false, depthWrite: false }));
  return m;
}

export async function build(ctx) {
  const scene = makeStudio(ctx, {});
  const cam = new THREE.PerspectiveCamera(30, ctx.aspect, 0.05, 80); scene.add(cam);
  // listing panel
  const lt = canvasTex(600, 800, (c, w, h) => drawListing(c, w, h, { kind: 'iphone', title: 'iPhone 15 Pro, 256 ГБ', price: '55 000 ₽', meta: 'Москва · 4 минуты назад', dark: true, priceColor: '#2ee59d', button: 'Открыть объявление', buttonColor: '#2ee59d' }));
  const panel = group(scene, 0, 1.45, -0.2);
  mesh(rbox(1.36, 1.8, 0.05, 0.09, 4), phys(0x0d1630, { r: 0.2, m: 0.5, cc: 1 }), 0, 0, 0, panel);
  const panelFace = mesh(new THREE.PlaneGeometry(1.32, 1.76), new THREE.MeshStandardMaterial({ map: lt.tex, emissive: 0xffffff, emissiveMap: lt.tex, emissiveIntensity: 0.75, roughness: 0.35, transparent: true }), 0, 0, 0.027, panel, false);
  const panelGlow = mesh(rbox(1.46, 1.9, 0.01, 0.12, 3), glow(C.green, 2.4, { transparent: true, opacity: 0.8, add: true }), 0, 0, -0.04, panel, false);
  // iPhone 15 Pro model (natural titanium)
  const ph = makePhone({ color: 0x8d877c }); ph.scale.setScalar(6.4);
  const phT = canvasTex(600, 1240, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(0.5, '#6a3dbf'); g.addColorStop(1, '#ff8a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.9)'; c.font = F(600, 150); c.textAlign = 'center'; c.fillText('9:41', w / 2, 300); });
  ph.setScreen(phT.tex, 1.0);
  const phG = group(scene, 0, 1.45, 0.35); phG.add(ph);
  const phHalo = halo(0x6f8cff, 2.6, 0.5, phG); phHalo.position.z = -0.4;
  const phL = new THREE.PointLight(0xffffff, 3, 3); phL.position.set(0.6, 0.4, 1.2); phG.add(phL);
  // texts
  const name = text3D('iPhone 15 Pro', { size: 0.1, depth: 0.03, bold: true, color: 0xe9edf8 }); name.position.set(0, 0.66, 0.4); scene.add(name);
  const lblMarket = label('РЫНОЧНАЯ ЦЕНА', { px: 70, size: 0.9 }); lblMarket.position.set(0, 2.88, 0.35); scene.add(lblMarket);
  const p80 = text3D('80 000 ₽', { size: 0.22, depth: 0.07, color: 0xf2f5ff, sideColor: 0x3a4a78 }); p80.position.set(0, 2.62, 0.35); scene.add(p80);
  const strike = mesh(rbox(1.0, 0.035, 0.04, 0.015), glow(C.red, 2.5), 0, 2.62, 0.43, scene, false); strike.rotation.z = 0.12;
  const lblSell = label('ЦЕНА ПРОДАВЦА', { px: 70, size: 0.9, color: '#7ff0c0' }); lblSell.position.set(0, 0.42, 0.45); scene.add(lblSell);
  const p55 = text3D('55 000 ₽', { size: 0.25, depth: 0.09, color: 0x2ee59d, emissive: 0x0d8a55, ei: 0.9, sideColor: 0x0d4a35 }); p55.position.set(0, 0.16, 0.45); scene.add(p55);
  const p55L = new THREE.PointLight(C.green, 0, 2); p55L.position.set(0, 0.3, 1.0); scene.add(p55L);
  // badge
  const badge = group(scene, -0.5, 1.15, 0.8);
  mesh(rbox(0.46, 0.2, 0.06, 0.08), phys(C.orange, { r: 0.3, cc: 1, e: 0x7a3a00, ei: 0.5 }), 0, 0, 0, badge);
  const bt = text3D('−31%', { size: 0.1, depth: 0.02, bold: true, color: 0xffffff }); bt.position.z = 0.04; badge.add(bt);
  // stopwatch
  const sw = makeStopwatch(); const swG = group(scene, 0.42, 1.9, 1.25); swG.add(sw);
  const swHalo = halo(C.orange, 1.6, 0.0, swG); swHalo.position.z = -0.2;
  const lblAge = label('ОПУБЛИКОВАНО', { px: 64, size: 0.62, color: '#ffc38a' }); lblAge.position.set(0.42, 1.52, 1.3); scene.add(lblAge);
  const pop = (t, a) => Math.max(0.0001, P(t, a, a + 0.45, eback));
  return {
    update(t) {
      const u = scene.userData;
      // panel: in focus first, then moves back
      const back = P(t, 1.3, 2.3, eio);
      panel.position.set(0, lerp(1.45, 1.6, back), lerp(-0.2, -2.2, back)); panel.rotation.y = lerp(0, 0.18, back);
      panelFace.material.emissiveIntensity = lerp(0.75, 0.25, back);
      panelGlow.material.opacity = lerp(0.6 + Math.sin(t * 8) * 0.2, 0.15, back);
      // phone rises & spins
      const rise = P(t, 1.4, 2.6, eout);
      phG.position.y = lerp(-0.6, 1.45, rise) + Math.sin(t * 1.5) * 0.025; phG.visible = rise > 0;
      ph.rotation.set(lerp(0.5, 0.06, rise), lerp(-Math.PI * 2.2, Math.PI + 0.35, rise) - (t > 2.6 ? (t - 2.6) * 0.07 : 0), lerp(0.4, -0.08, rise));
      phHalo.material.opacity = rise;
      name.scale.setScalar(pop(t, 2.2));
      // market price
      lblMarket.scale.setScalar(pop(t, 4.0)); p80.scale.setScalar(pop(t, 4.05));
      strike.scale.set(Math.max(0.001, P(t, 7.2, 7.6, eout)), 1, 1);
      p80.material[0].color.setScalar(lerp(1, 0.55, P(t, 7.2, 7.8)));
      // seller price
      lblSell.scale.setScalar(pop(t, 6.55)); p55.scale.setScalar(pop(t, 6.6) * (1 + Math.max(0, Math.sin((t - 7.05) * 6)) * 0.04 * (t > 7.05 ? 1 : 0)));
      p55L.intensity = P(t, 6.6, 7.0) * 4;
      badge.scale.setScalar(Math.max(0.0001, P(t, 7.7, 8.4, eelastic))); badge.rotation.set(0, -0.3, 0.12 + Math.sin(t * 3) * 0.05);
      // stopwatch
      const sIn = P(t, 8.8, 9.6, eback);
      swG.scale.setScalar(Math.max(0.0001, sIn * 0.8)); lblAge.scale.setScalar(Math.max(0.0001, P(t, 9.3, 9.8, eback)));
      sw.rotation.set(-0.1, lerp(-1.6, -0.25, sIn) + Math.sin(t * 1.3) * 0.05, 0.05);
      const mins = 4; const sec = Math.floor(clamp((t - 9.0) * 5, 0, 59));
      sw.userData.hand.rotation.z = -((t - 8.8) * 2.2);
      sw.userData.face.draw((c, w, h) => {
        const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); g.addColorStop(0, '#1d2747'); g.addColorStop(1, '#0a0f22'); c.fillStyle = g; c.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; const r1 = i % 5 ? 220 : 200; c.strokeStyle = i < 4 * 5 && t > 9.2 ? '#ff9f43' : 'rgba(180,200,255,.6)'; c.lineWidth = i % 5 ? 3 : 7; c.beginPath(); c.moveTo(w / 2 + Math.sin(a) * r1, h / 2 - Math.cos(a) * r1); c.lineTo(w / 2 + Math.sin(a) * 240, h / 2 - Math.cos(a) * 240); c.stroke(); }
        c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.font = F(900, 150); c.shadowColor = '#ff9f43'; c.shadowBlur = 24; c.fillText(`${mins}`, w / 2, h / 2 + 30); c.shadowBlur = 0;
        c.font = F(800, 58); c.fillStyle = '#ff9f43'; c.fillText('МИН', w / 2, h / 2 + 110); c.font = F(700, 40); c.fillStyle = '#9fb3e6'; c.fillText('назад', w / 2, h / 2 - 120);
      });
      swHalo.material.opacity = sIn * (0.5 + Math.sin(t * 9) * 0.3);
      // lights breathe
      u.rimR.intensity = 2 + Math.sin(t * 2) * 0.3;
      // camera
      const orbit = seq(t, [[0, -0.12], [4, 0.0], [8.8, 0.08], [12, 0.18]]);
      const dist = seq(t, [[0, 6.2], [1.4, 5.0], [2.6, 5.6], [4.0, 5.6], [6.4, 5.8], [8.8, 6.2], [12, 5.5]]);
      const ty = seq(t, [[0, 1.45], [2.6, 1.45], [4.0, 1.75], [6.4, 1.6], [8.8, 1.4], [12, 1.45]]);
      setCam(cam, [Math.sin(orbit) * dist, ty + 0.25, 0.35 + Math.cos(orbit) * dist], [0, ty, 0.35], t, 0.012);
      cam.updateProjectionMatrix();
      return { scene, camera: cam };
    },
  };
}
