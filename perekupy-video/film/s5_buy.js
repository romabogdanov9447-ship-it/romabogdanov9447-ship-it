import { THREE, C, makeBedroom, makeStreet, makeCar, makeCharacter, makeBlanket, makePhone, HERO, SELLER, canvasTex, drawListing, text3D, rbox, phys, std, glow, mesh, group, halo, P, clamp, lerp, setCam, seq, eio, eout, eback, blinkAt, talkAt, F, rr, smooth } from './lib.js';
import { label } from './s3_find.js';

export function bubble(text, color = '#ffffff', fg = '#0b1022') {
  const g = new THREE.Group();
  mesh(rbox(0.56, 0.24, 0.06, 0.1), phys(new THREE.Color(color), { r: 0.3, cc: 1 }), 0, 0, 0, g);
  const tail = mesh(new THREE.ConeGeometry(0.05, 0.1, 12), phys(new THREE.Color(color), { r: 0.3, cc: 1 }), -0.12, -0.14, 0, g); tail.rotation.z = Math.PI + 0.4;
  const l = label(text, { px: 96, size: 0.52, color: fg, weight: 900, w: 512, h: 220 }); l.position.z = 0.035; g.add(l);
  return g;
}

export function makeStorefront(sign = 'КОФЕ') {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.3, 4.2, 6), std(0x232a44, { r: 0.8 }), 0, 2.1, 0, g);
  mesh(new THREE.PlaneGeometry(4.6, 2.2), glow(0xffb36b, 0.9), -0.16, 1.4, 0, g, false).rotation.y = -Math.PI / 2;
  for (let i = -2; i <= 2; i++) mesh(new THREE.BoxGeometry(0.06, 2.3, 0.06), phys(0x1a1d26, { m: 0.8, r: 0.3 }), -0.2, 1.4, i * 1.15, g);
  const st = canvasTex(256, 64, (c, w, h) => { for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#e8e2d6' : '#2c5fd0'; c.fillRect(i * 16, 0, 16, h); } });
  const aw = mesh(new THREE.PlaneGeometry(1.2, 5.6), std(0xffffff, { map: st.tex, side: THREE.DoubleSide }), -0.7, 2.75, 0, g); aw.rotation.set(0, -Math.PI / 2, 0); aw.rotation.order = 'YXZ'; aw.rotation.x = -0.9;
  const sg = label(sign, { px: 120, size: 1.8, color: '#ffffff', glow: '#ffcf8a', weight: 900, w: 1024, h: 256 }); sg.position.set(-0.2, 3.6, 0); sg.rotation.y = -Math.PI / 2; sg.material.color.setScalar(2.2); g.add(sg);
  return g;
}

export async function build(ctx) {
  // ---------- A/B: bedroom ----------
  const room = makeBedroom({ key: 2.6, keyColor: 0xffc29a, skyTop: '#1a2f73', skyMid: '#5070c0', skyBottom: '#ffb37a' });
  room.environment = ctx.env; room.environmentIntensity = 0.3;
  const u = room.userData; u.fill.intensity = 5;
  const hero = makeCharacter(HERO); hero.position.set(-0.08, 0, -0.42); u.bed.add(hero);
  const blanket = makeBlanket(u.blanketM, 1.72, 1.35, (x, z) => 0.13 * Math.exp(-((x + 0.08) ** 2) / (2 * 0.2 ** 2)) * smooth(clamp((z + 0.6) / 0.2)) * (1 - smooth(clamp((z - 0.35) / 0.2))) + 0.07 * Math.exp(-((z + 0.62) ** 2) / 0.004));
  blanket.position.set(0, 0.55, 0.42); u.bed.add(blanket);
  const hp = makePhone({ color: 0x1d2433 }); hp.scale.setScalar(1.15); hero.J.torso.add(hp);
  const hs = canvasTex(600, 1240); hp.setScreen(hs.tex, 1.05);
  const hpL = new THREE.PointLight(0x9fc0ff, 0.4, 1.0); hero.J.torso.add(hpL);
  const ring = mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 40), glow(C.green, 3, { transparent: true, add: true }), 0, 0, 0, hero.J.head, false);
  const camA = new THREE.PerspectiveCamera(38, ctx.aspect, 0.02, 60); room.add(camA);
  // ---------- C/D: street ----------
  const st = makeStreet({ seed: 21, lit: 0.3 });
  st.environment = ctx.env; st.environmentIntensity = 0.3;
  const car = makeCar(0xe8432f); st.add(car);
  const shop = makeStorefront('КОФЕ'); shop.position.set(9.6, 0.18, -0.5); st.add(shop);
  const hero2 = makeCharacter(HERO); hero2.position.set(5.6, 0.18, 0.35); hero2.rotation.y = Math.PI + 0.55; st.add(hero2);
  const seller = makeCharacter(SELLER); seller.position.set(5.6, 0.18, -0.75); seller.rotation.y = -0.55; st.add(seller);
  const ip = makePhone({ color: 0x8d877c }); ip.scale.setScalar(1.2); hero2.J.torso.add(ip);
  const ipT = canvasTex(300, 620, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#1b2a6b'); g.addColorStop(1, '#ff8a5c'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); ip.setScreen(ipT.tex, 1);
  const b1 = bubble('55 000?', '#ffffff'); b1.position.set(5.2, 2.15, -0.9); st.add(b1);
  const b2 = bubble('52 000!', '#2ee59d'); b2.position.set(5.1, 2.2, 0.55); st.add(b2);
  const tagG = group(st, 5.2, 2.2, -0.2);
  const tag = text3D('52 000 ₽', { size: 0.19, depth: 0.08, color: 0x2ee59d, emissive: 0x0d8a55, ei: 0.8, sideColor: 0x0d4a35 }); tag.rotation.y = -Math.PI / 2; tagG.add(tag);
  const tagL = label('КУПЛЕНО ЗА', { px: 70, size: 0.9, color: '#bfffe2' }); tagL.position.set(0, 0.27, 0); tagL.rotation.y = -Math.PI / 2; tagG.add(tagL);
  const meetL = new THREE.PointLight(0xffc28a, 10, 8); meetL.position.set(7.5, 2.6, -0.2); st.add(meetL);
  const carL = new THREE.SpotLight(0xdde8ff, 0, 30, 0.5, 0.5, 1); car.add(carL); carL.position.set(0, 0.8, 2.2); carL.target.position.set(0, 0, 12); car.add(carL.target);
  const camS = new THREE.PerspectiveCamera(40, ctx.aspect, 0.05, 200); st.add(camS);
  const tmp = new THREE.Vector3();
  return {
    update(t) {
      if (t < 3.9) {
        // ---- bedroom: open link, then call ----
        const call = t >= 2.4;
        const br = Math.sin(t * 2) * 0.01;
        if (!call) {
          hero.pose({ y: -0.13, lLeg: [-1.55, 0, 0.05], rLeg: [-1.55, 0, -0.05], lKnee: 0.05, rKnee: 0.05, torso: [-0.05 + br, 0, 0], head: [0.3, 0.05, 0], rArm: [-0.95, 0.2, 0.15], rElbow: -1.45, lArm: [-0.9, -0.2, -0.1], lElbow: -1.3,
            blink: Math.max(0.15, blinkAt(t, 0.5)), smile: lerp(0.4, 0.9, P(t, 0.9, 1.3)), brow: P(t, 0.8, 1.1) * 0.5, look: [0, -0.7], talk: 0 });
          hp.position.set(0, 0.3, 0.34); hp.rotation.set(1.15, Math.PI, 0); hp.setScreen(hs.tex, 1.05);
          const tap = P(t, 0.75, 0.9) * (1 - P(t, 1.0, 1.2));
          hs.draw((c, w, h) => { drawListing(c, w, h, { kind: 'iphone', title: 'iPhone 15 Pro, 256 ГБ', price: '55 000 ₽', meta: 'Москва · 5 минут назад', dark: true, priceColor: '#2ee59d', button: t < 1.1 ? 'Открыть объявление' : 'Позвонить', buttonColor: t < 1.1 ? '#2f7bff' : '#2ee59d' }); if (tap > 0) { c.fillStyle = `rgba(255,255,255,${tap * 0.5})`; c.beginPath(); c.arc(w / 2, h - 90, 70 + tap * 30, 0, 7); c.fill(); } });
          ring.visible = false;
        } else {
          const k = P(t, 2.4, 2.7, eout);
          hero.pose({ y: -0.13, lLeg: [-1.55, 0, 0.05], rLeg: [-1.55, 0, -0.05], torso: [-0.05, 0, 0], head: [0.0, -0.25, -0.12], rArm: [-0.35, 0.3, lerp(-0.2, -0.75, k)], rElbow: -2.5, lArm: [-0.4, 0, 0.12], lElbow: -0.5,
            blink: blinkAt(t, 0.2), smile: 0.85, brow: 0.5, look: [0.4, 0], talk: talkAt(t, t > 2.9 ? 1 : 0) });
          hp.position.set(-0.24, 0.8, 0.03); hp.rotation.set(0, Math.PI / 2, 0.25); hp.setScreen(hs.tex, 0.25);
          hs.draw((c, w, h) => { c.fillStyle = '#0d1a2e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = F(800, 52); c.textAlign = 'center'; c.fillText('Продавец', w / 2, 300); c.fillStyle = '#2ee59d'; c.font = F(700, 40); c.fillText('00:0' + Math.floor(t - 2.4), w / 2, 370); });
          ring.visible = true; const pr = (t * 1.6) % 1; ring.position.set(-0.32, 0.2, 0); ring.rotation.y = Math.PI / 2; ring.scale.setScalar(1 + pr * 2); ring.material.opacity = 1 - pr;
        }
        hpL.position.copy(hp.position).add(new THREE.Vector3(0, 0.05, 0.12)); hpL.intensity = call ? 0 : 0.4;
        blanket.scale.y = 1;
        camA.fov = 38;
        const head = new THREE.Vector3(); hero.J.head.getWorldPosition(head);
        if (t < 1.25) { const sp = new THREE.Vector3(); hp.getWorldPosition(sp); camA.up.set(0, 0.3, 1).normalize(); setCam(camA, [sp.x + 0.01, sp.y + lerp(0.42, 0.34, P(t, 0, 1.25)), sp.z + 0.1], [sp.x, sp.y, sp.z], t, 0.003); }
        else if (t < 2.4) { camA.up.set(0, 1, 0); const k = P(t, 1.25, 2.4, (x) => x); setCam(camA, [lerp(-0.3, -0.45, k), lerp(1.5, 1.45, k), lerp(-0.4, -0.65, k)], [head.x, head.y - 0.1, head.z], t, 0.006); }
        else { camA.up.set(0, 1, 0); const k = P(t, 2.4, 3.9, (x) => x); setCam(camA, [lerp(-1.95, -2.05, k), lerp(1.62, 1.58, k), lerp(-0.25, -0.4, k)], [head.x - 0.08, head.y, head.z], t, 0.006); camA.fov = 36; }
        camA.updateProjectionMatrix();
        return { scene: room, camera: camA };
      }
      // ---- street ----
      for (const w of car.userData.wheels) w.rotation.x = 0;
      if (t < 5.3) {
        const k = (t - 3.9);
        const z = -46 + k * 15;
        car.position.set(2.2, 0, z); car.rotation.y = 0;
        for (const w of car.userData.wheels) w.rotation.x = z / 0.37;
        car.position.y = Math.sin(t * 20) * 0.008;
        carL.intensity = 30;
        setCam(camS, [lerp(-0.6, -0.2, P(t, 3.9, 5.3)), lerp(0.7, 0.9, P(t, 3.9, 5.3)), z + lerp(6.5, 5.0, P(t, 3.9, 5.3))], [2.2, 0.9, z + 0.5], t, 0.03);
        camS.rotateZ(-0.05); camS.fov = 42; camS.updateProjectionMatrix();
        hero2.visible = seller.visible = false; b1.visible = b2.visible = tagG.visible = false;
        return { scene: st, camera: camS };
      }
      hero2.visible = seller.visible = true;
      car.position.set(3.1, 0, 4.7); carL.intensity = 0;
      const lt = t - 5.3;
      // examining phone
      const exam = t < 6.4, shake = P(t, 7.2, 7.5) * (1 - P(t, 8.1, 8.4));
      const handH = Math.sin(t * 14) * 0.08 * shake;
      hero2.pose({ head: exam ? [0.4, 0.1, 0] : [0.05, 0.1, 0], look: exam ? [0, -0.8] : [0, 0], blink: blinkAt(t, 0.7), smile: t > 7.2 ? 0.95 : 0.55, brow: exam ? 0.3 : 0.5, talk: talkAt(t, t > 6.5 && t < 7.1 ? 1 : 0),
        rArm: shake > 0 ? [-1.25 + handH, 0.3, 0.05] : exam ? [-0.9, 0.2, 0.15] : [-0.25, 0, -0.1], rElbow: shake > 0 ? -0.35 : exam ? -1.4 : -0.3,
        lArm: exam ? [-0.9, -0.2, -0.1] : t < 7.1 ? [-1.0, 0, 0.45] : [-0.6, 0, 0.1], lElbow: exam ? -1.3 : t < 7.1 ? -1.5 : -1.2, torso: [0.04, 0, 0] });
      if (exam) { ip.position.set(0, 0.36, 0.33); ip.rotation.set(-0.9 + Math.sin(t * 3) * 0.3, Math.PI + Math.sin(t * 2.2) * 0.8, 0); }
      else { ip.position.set(0.24, 0.12, 0.28); ip.rotation.set(-1.2, Math.PI, 0.4); }
      seller.pose({ head: [0.05, Math.sin(t * 0.8) * 0.1, 0], blink: blinkAt(t, 1.9), smile: t > 7.0 ? 0.9 : 0.45, talk: talkAt(t, (t > 5.9 && t < 6.5) || (t > 7.0 && t < 7.3) ? 1 : 0), brow: 0.2,
        rArm: shake > 0 ? [-1.25 - handH, -0.3, -0.05] : [-0.2, 0, -0.2], rElbow: shake > 0 ? -0.35 : -0.6, lArm: t > 5.9 && t < 6.6 ? [-0.9, 0, 0.5] : [0.05, 0, 0.15], lElbow: t > 5.9 && t < 6.6 ? -1.4 : -0.2 });
      b1.visible = b2.visible = tagG.visible = true;
      b1.scale.setScalar(Math.max(0.0001, P(t, 5.9, 6.2, eback) * (1 - P(t, 7.0, 7.2)))); b1.rotation.y = -Math.PI / 2 + 0.2;
      b2.scale.setScalar(Math.max(0.0001, P(t, 6.4, 6.7, eback) * (1 - P(t, 7.3, 7.5)))); b2.rotation.y = -Math.PI / 2 + 0.2;
      tagG.scale.setScalar(Math.max(0.0001, P(t, 7.55, 8.0, eback))); tagG.position.y = 2.25 + Math.sin(t * 2) * 0.03;
      const k = P(t, 5.3, 9.6, (x) => x);
      setCam(camS, [lerp(1.2, 1.6, k), lerp(1.45, 1.6, k), lerp(-3.0, 1.6, eio(k))], [5.5, lerp(1.25, 1.5, k), -0.15], t, 0.012);
      camS.fov = 38; camS.updateProjectionMatrix();
      return { scene: st, camera: camS };
    },
  };
}
