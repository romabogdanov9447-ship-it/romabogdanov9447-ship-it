import { THREE, C, makeCharacter, RIVAL, makePhone, canvasTex, drawFeed, drawListing, text3D, rbox, phys, std, glow, mesh, group, halo, dust, skyTex, makeBuilding, P, clamp, lerp, setCam, seq, eio, eout, eback, blinkAt, F, rng } from './lib.js';

export async function build(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080f); scene.fog = new THREE.Fog(0x06080f, 8, 20);
  scene.environment = ctx.env; scene.environmentIntensity = 0.2;
  const cam = new THREE.PerspectiveCamera(36, ctx.aspect, 0.03, 60); scene.add(cam);
  const wallM = std(0x1d2238, { r: 0.9 });
  const floor = mesh(new THREE.PlaneGeometry(10, 10), phys(0x2a2a33, { r: 0.6, cc: 0.2 }), 0, 0, 0, scene); floor.rotation.x = -Math.PI / 2;
  // back wall with window at left
  const wz = -1.6;
  mesh(new THREE.BoxGeometry(2.6, 3.2, 0.2), wallM, 0.9, 1.6, wz, scene);
  mesh(new THREE.BoxGeometry(3, 3.2, 0.2), wallM, -3.3, 1.6, wz, scene);
  mesh(new THREE.BoxGeometry(1.6, 1.0, 0.2), wallM, -1.2, 0.5, wz, scene);
  mesh(new THREE.BoxGeometry(1.6, 0.7, 0.2), wallM, -1.2, 2.85, wz, scene);
  const frM = phys(0xcfd3dc, { r: 0.5 });
  mesh(new THREE.BoxGeometry(1.64, 0.05, 0.24), frM, -1.2, 1.0, wz, scene); mesh(new THREE.BoxGeometry(1.64, 0.05, 0.24), frM, -1.2, 2.5, wz, scene);
  mesh(new THREE.BoxGeometry(0.05, 1.5, 0.24), frM, -2.0, 1.75, wz, scene); mesh(new THREE.BoxGeometry(0.05, 1.5, 0.24), frM, -0.4, 1.75, wz, scene); mesh(new THREE.BoxGeometry(0.04, 1.5, 0.1), frM, -1.2, 1.75, wz, scene);
  const skyM = new THREE.MeshBasicMaterial({ map: skyTex('#16306e', '#4a78c8', '#ffc59a', 0), toneMapped: false, fog: false });
  const sky = mesh(new THREE.PlaneGeometry(12, 8), skyM, -1.5, 2, -7, scene, false);
  for (let i = 0; i < 8; i++) { const b = makeBuilding(1 + (i % 3) * 0.4, 2 + (i * 1.7 % 3), 1, 50 + i, 0.2); b.position.set(-3.5 + i * 0.7, -0.6, -5.5); scene.add(b); }
  // wall clock above
  const clk = group(scene, 0.75, 2.35, wz + 0.12);
  const rim = mesh(new THREE.TorusGeometry(0.3, 0.035, 12, 48), phys(0x1a1a1f, { r: 0.3, m: 0.6 }), 0, 0, 0, clk);
  const faceT = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#f2efe8'; c.beginPath(); c.arc(128, 128, 128, 0, 7); c.fill(); c.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.save(); c.translate(128 + Math.sin(a) * 105, 128 - Math.cos(a) * 105); c.rotate(a); c.fillRect(-3, -12, 6, 24); c.restore(); } });
  mesh(new THREE.CircleGeometry(0.3, 48), std(0xffffff, { map: faceT.tex, r: 0.5 }), 0, 0, 0.0, clk, false);
  const hourH = group(clk, 0, 0, 0.02), minH = group(clk, 0, 0, 0.03);
  mesh(new THREE.BoxGeometry(0.03, 0.15, 0.01), std(0x1a1a1a), 0, 0.065, 0, hourH, false); mesh(new THREE.BoxGeometry(0.02, 0.24, 0.01), std(0x1a1a1a), 0, 0.1, 0, minH, false);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 12), std(C.red), 0, 0, 0.04, clk, false).rotation.x = Math.PI / 2;
  // shelf with boxes (stock)
  const boxM = phys(0xb88a55, { r: 0.8, cc: 0 });
  mesh(rbox(1.2, 0.04, 0.35, 0.01), phys(0x3a2f2a, { r: 0.5 }), 1.25, 1.55, wz + 0.2, scene);
  mesh(rbox(0.35, 0.25, 0.3, 0.01), boxM, 0.95, 1.7, wz + 0.2, scene); mesh(rbox(0.4, 0.2, 0.3, 0.01), phys(0xdedede, { r: 0.6 }), 1.4, 1.67, wz + 0.2, scene);
  mesh(rbox(0.5, 0.4, 0.4, 0.01), boxM, 1.6, 0.2, wz + 0.4, scene); mesh(rbox(0.4, 0.3, 0.35, 0.01), boxM, 1.55, 0.55, wz + 0.4, scene);
  // desk
  const desk = group(scene, 0, 0, 0.5);
  const woodM = phys(0x4a3a30, { r: 0.45, cc: 0.4 });
  mesh(rbox(1.8, 0.06, 0.8, 0.02), woodM, 0, 0.76, 0, desk);
  mesh(rbox(0.06, 0.74, 0.7, 0.01), woodM, -0.85, 0.37, 0, desk); mesh(rbox(0.06, 0.74, 0.7, 0.01), woodM, 0.85, 0.37, 0, desk);
  // laptop closed, mug, notebook
  mesh(rbox(0.55, 0.03, 0.38, 0.01), phys(0x9aa0ad, { r: 0.3, m: 0.9 }), -0.45, 0.805, -0.05, desk).rotation.y = 0.2;
  const mug = group(desk, 0.55, 0.79, 0.05); mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.13, 24), phys(0xe9e4dc, { r: 0.3, cc: 0.8 }), 0, 0.065, 0, mug); mesh(new THREE.TorusGeometry(0.035, 0.012, 8, 16), phys(0xe9e4dc, { r: 0.3 }), 0.07, 0.07, 0, mug);
  mesh(rbox(0.25, 0.015, 0.33, 0.005), phys(0x2f5fd0, { r: 0.7 }), 0.25, 0.795, 0.15, desk).rotation.y = -0.3;
  // desk lamp
  const lamp = group(desk, 0.72, 0.79, -0.25);
  const lm = phys(0x1d1f26, { r: 0.3, m: 0.7 });
  mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 24), lm, 0, 0.01, 0, lamp);
  const arm = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45), lm, -0.05, 0.22, 0, lamp); arm.rotation.z = 0.35;
  const head = mesh(new THREE.ConeGeometry(0.09, 0.14, 24, 1, true), lm, -0.17, 0.44, 0.05, lamp); head.rotation.z = 0.9; head.material.side = THREE.DoubleSide;
  mesh(new THREE.SphereGeometry(0.03, 12, 8), glow(0xffd7a0, 6), -0.15, 0.41, 0.05, lamp, false);
  const lampL = new THREE.SpotLight(0xffc78a, 18, 4, 0.9, 0.6, 1.4); lampL.position.set(0.55, 1.2, 0.3); lampL.target.position.set(-0.1, 0.8, 0.5); lampL.castShadow = true; lampL.shadow.mapSize.set(1024, 1024); scene.add(lampL, lampL.target);
  // chair
  const chair = group(scene, 0, 0, -0.35);
  mesh(rbox(0.5, 0.07, 0.48, 0.03), phys(0x23262f, { r: 0.6 }), 0, 0.48, 0, chair); mesh(rbox(0.5, 0.6, 0.07, 0.03), phys(0x23262f, { r: 0.6 }), 0, 0.85, -0.24, chair);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45), phys(0x777c88, { m: 1, r: 0.3 }), 0, 0.23, 0, chair);
  // rival character
  const rv = makeCharacter(RIVAL); rv.position.set(0, 0, -0.35); scene.add(rv);
  const phone = makePhone({ color: 0x30323a }); phone.scale.setScalar(1.15);
  phone.position.set(0.04, 0.36, 0.3); phone.rotation.set(-0.6, Math.PI, 0); rv.J.torso.add(phone);
  const scr = canvasTex(600, 1240); phone.setScreen(scr.tex, 0.8);
  const phL = new THREE.PointLight(0x9fc0ff, 0.12, 0.8); phL.position.set(0, 0.42, 0.22); rv.J.torso.add(phL);
  const txt = group(scene, 0.75, 1.82, wz + 0.4); const t1 = text3D('3 ЧАСА', { size: 0.11, depth: 0.04, color: 0xffffff }); t1.position.y = 0.06; const t2 = text3D('СПУСТЯ', { size: 0.07, depth: 0.03, color: 0x9fc0ff, bold: true }); t2.position.y = -0.08; txt.add(t1, t2);
  const hemi = new THREE.HemisphereLight(0x4a64c8, 0x120c1c, 0.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0x9fb8ff, 1.2); sun.position.set(-3, 3, -6); sun.target.position.set(0, 0.8, 0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 }); scene.add(sun, sun.target);
  const fill = new THREE.PointLight(0x6a7cff, 3, 6); fill.position.set(-1, 2, 2.5); scene.add(fill);
  dust(scene, 120, [4, 3, 3], 0xffd9a0, 0.02, 31);
  return {
    update(t) {
      // time lapse 2.0 -> 3.4 : 3 hours
      const tl = P(t, 2.0, 3.4, eio);
      const minutes = 4 + t * 0.4 + tl * 180;
      minH.rotation.z = -minutes / 60 * Math.PI * 2; hourH.rotation.z = -(7 + minutes / 60) / 12 * Math.PI * 2;
      skyM.color.setRGB(lerp(0.75, 1.25, tl), lerp(0.75, 1.25, tl), lerp(0.8, 1.2, tl));
      sun.intensity = lerp(1.0, 2.6, tl); sun.color.setHSL(lerp(0.6, 0.12, tl), 0.6, 0.75);
      txt.scale.setScalar(Math.max(0.0001, P(t, 2.25, 2.7, eback) * (1 - P(t, 3.3, 3.45))));
      // character
      const slump = P(t, 4.3, 4.9, eout);
      const scroll = Math.sin(t * 9) * 0.5 + 0.5;
      rv.pose({ y: -0.32, lLeg: [-1.5, 0, 0.05], rLeg: [-1.5, 0, -0.05], lKnee: 1.45, rKnee: 1.45,
        torso: [lerp(0.12, -0.12, slump), 0, 0], head: [lerp(0.28, 0.05, slump), Math.sin(t * 0.7) * 0.05, lerp(0.05, -0.12, slump)],
        rArm: [lerp(-1.25, -0.95, slump), 0.1, -0.15], rElbow: lerp(-1.25, -1.0, slump), lArm: [lerp(-0.85, -0.6, slump), 0, 0.25], lElbow: lerp(-1.0, -0.8, slump),
        blink: Math.max(t < 3.4 ? 0.45 : 0.15, blinkAt(t, 1.1)), smile: lerp(0.25, 0.0, slump), brow: lerp(-0.2, 0.6, slump), look: [0, -0.6], talk: 0 });
      if (t < 3.45) { phone.position.set(0.04, 0.36 - slump * 0.06, 0.3); phone.rotation.set(-0.6, Math.PI, 0); } else { phone.position.set(0.04, 0.3 - slump * 0.04, 0.34); phone.rotation.set(1.2, Math.PI, 0); }
      // screen
      if (t < 3.45) scr.draw((c, w, h) => drawFeed(c, w, h, t * 420 + scroll * 30));
      else scr.draw((c, w, h) => drawListing(c, w, h, { kind: 'iphone', title: 'iPhone 15 Pro, 256 ГБ', price: '55 000 ₽', meta: 'Москва · 3 часа назад', dark: true, priceColor: '#6b7591', dim: P(t, 4.15, 4.4) * 0.55, stamp: t > 4.15 ? 'ПРОДАНО' : null, stampK: lerp(2.0, 1.0, P(t, 4.15, 4.4, eout)) }));
      // camera
      cam.fov = 36; cam.up.set(0, 1, 0);
      if (t < 2.0) {
        const k = P(t, 0, 2.0, (x) => x);
        setCam(cam, [lerp(-1.1, -0.8, k), lerp(1.75, 1.6, k), lerp(2.4, 2.0, k)], [0.1, lerp(1.35, 1.4, k), -0.3], t, 0.012);
      } else if (t < 3.45) {
        const k = P(t, 2.0, 3.45, eio);
        setCam(cam, [lerp(0.5, 0.7, k), lerp(2.0, 2.1, k), lerp(1.35, 1.0, k)], [0.75, 2.08, wz], t, 0.008);
        cam.rotateZ(lerp(0.12, -0.05, k));
      } else {
        const k = P(t, 3.45, 6.0, eio);
        // over the shoulder to phone screen
        const sp = new THREE.Vector3(); phone.getWorldPosition(sp);
        cam.up.set(0, 1, 0).lerp(new THREE.Vector3(0, 0.3, 1), P(t, 4.2, 5.4)).normalize(); setCam(cam, [sp.x + lerp(0.05, 0, k), sp.y + lerp(0.75, 0.36, k), sp.z + lerp(0.38, 0.1, k)], [sp.x, sp.y, sp.z], t, 0.004);
      }
      cam.updateProjectionMatrix();
      return { scene, camera: cam };
    },
  };
}
