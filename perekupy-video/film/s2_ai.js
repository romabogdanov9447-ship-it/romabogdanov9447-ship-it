import { THREE, C, canvasTex, drawListing, rbox, phys, std, glow, mesh, group, halo, dust, makeRussiaMap, seq, P, clamp, lerp, setCam, eio, eout, eback, rng, F, rr, fmt } from './lib.js';

export const KINDS = [['phone', 'Смартфон', '18 500 ₽'], ['sneaker', 'Кроссовки', '7 900 ₽'], ['laptop', 'MacBook Air', '54 000 ₽'], ['headphones', 'Наушники', '12 300 ₽'], ['console', 'Приставка', '31 000 ₽'], ['watch', 'Смарт-часы', '9 400 ₽'], ['camera', 'Фотоаппарат', '27 500 ₽'], ['tablet', 'Планшет', '22 000 ₽'], ['gamepad', 'Геймпад', '4 800 ₽'], ['iphone', 'iPhone 13', '38 000 ₽'], ['box', 'Робот-пылесос', '14 900 ₽'], ['phone', 'Galaxy S23', '41 000 ₽']];
const CITYLIST = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск', 'Краснодар', 'Самара', 'Нижний Новгород'];
export function cardTextures() {
  return KINDS.map(([k, title, price], i) => canvasTex(360, 480, (c, w, h) => drawListing(c, w, h, { kind: k, title, price, meta: `${CITYLIST[i % CITYLIST.length]} · ${2 + i * 7} мин`, dark: true, hue: (i * 53) % 360, priceColor: '#ffffff' })).tex);
}

export async function build(ctx) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060f); scene.fog = new THREE.FogExp2(0x03060f, 0.045);
  scene.environment = ctx.env; scene.environmentIntensity = 0.35;
  const cam = new THREE.PerspectiveCamera(40, ctx.aspect, 0.05, 120); scene.add(cam);
  const CORE = new THREE.Vector3(0, 4.2, 0);
  // floor grid
  const gridT = canvasTex(512, 512, (c, w, h) => { c.fillStyle = '#050a18'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(60,120,255,0.5)'; c.lineWidth = 2; for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); } });
  gridT.tex.wrapS = gridT.tex.wrapT = THREE.RepeatWrapping; gridT.tex.repeat.set(30, 30);
  const floor = mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.3, metalness: 0.6, emissive: 0xffffff, emissiveMap: gridT.tex, emissiveIntensity: 0.35, map: gridT.tex }), 0, -0.05, 0, scene); floor.rotation.x = -Math.PI / 2;
  // AI core
  const core = group(scene, CORE.x, CORE.y, CORE.z);
  mesh(new THREE.SphereGeometry(0.62, 48, 32), phys(0x0a1430, { r: 0.1, m: 0.5, cc: 1, e: 0x1a5cff, ei: 0.8 }), 0, 0, 0, core);
  mesh(new THREE.SphereGeometry(0.4, 32, 24), glow(0x6fd8ff, 2.2), 0, 0, 0, core, false);
  const ico = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.95, 1)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(2.5), toneMapped: false })); core.add(ico);
  const rings = [];
  for (let i = 0; i < 3; i++) { const r = mesh(new THREE.TorusGeometry(1.25 + i * 0.32, 0.018, 8, 96), glow(i === 1 ? C.green : C.cyan, 2), 0, 0, 0, core, false); rings.push(r); }
  halo(0x4aa8ff, 5, 0.55, core); halo(0x9fe8ff, 2.0, 0.9, core);
  const coreL = new THREE.PointLight(0x5fb8ff, 16, 16, 1.4); core.add(coreL);
  scene.add(new THREE.HemisphereLight(0x3050a0, 0x050810, 0.6));
  const key = new THREE.DirectionalLight(0x9fb8ff, 1.2); key.position.set(-6, 12, 8); scene.add(key);
  // vortex of listing cards
  const texs = cardTextures();
  const bodyG = rbox(0.6, 0.8, 0.03, 0.05, 3), faceG = new THREE.PlaneGeometry(0.58, 0.773);
  const bodyM = phys(0x101a36, { r: 0.25, m: 0.5, cc: 1 });
  const faceMs = texs.map((t) => new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.32, roughness: 0.4 }));
  const goodM = glow(C.green, 3.2, { transparent: true, opacity: 0, add: true }), goodG = rbox(0.7, 0.9, 0.01, 0.07, 3);
  const r = rng(42); const cards = [];
  for (let i = 0; i < 170; i++) {
    const g = group(scene);
    mesh(bodyG, bodyM, 0, 0, 0, g, false);
    mesh(faceG, faceMs[i % faceMs.length], 0, 0, 0.017, g, false);
    const good = r() < 0.14; let gl = null;
    if (good) { gl = mesh(goodG, goodM.clone(), 0, 0, -0.03, g, false); }
    cards.push({ g, gl, a0: r() * Math.PI * 2, r0: 1.7 + r() * 4.2, y0: (r() - 0.5) * 4.2, sp: 0.6 + r() * 0.5, ph: r(), tilt: (r() - 0.5) * 0.6 });
  }
  // HUD counter panel (glass in 3D, follows camera)
  const hud = group(cam, 0, 0.62, -2.2);
  mesh(rbox(1.15, 0.36, 0.04, 0.06), phys(0x060c1e, { r: 0.15, m: 0.3, cc: 1, transparent: true, opacity: 0.95, e: 0x0a1a40, ei: 0.3 }), 0, 0, 0, hud, false);
  const hudT = canvasTex(1024, 320);
  mesh(new THREE.PlaneGeometry(1.12, 0.35), new THREE.MeshBasicMaterial({ map: hudT.tex, transparent: true, toneMapped: false }), 0, 0, 0.025, hud, false);
  const hudL = new THREE.PointLight(0x7fb0ff, 2, 3); hud.add(hudL); hudL.position.set(0, 0, 0.6);
  // map of Russia
  const map = makeRussiaMap(); map.rotation.x = -Math.PI / 2; map.position.set(0, 0, 0); map.scale.setScalar(1.15); scene.add(map);
  map.updateMatrixWorld(true);
  const cities = Object.entries(map.userData.cities).map(([name, c]) => { const wp = new THREE.Vector3(); c.g.getWorldPosition(wp); return { name, ...c, wp }; });
  const west = Math.min(...cities.map((c) => c.wp.x)), east = Math.max(...cities.map((c) => c.wp.x));
  // links from cities to core
  const linkM = glow(C.cyan, 1.4, { add: true, transparent: true, opacity: 0.5 });
  for (const c of cities) {
    const d = new THREE.Vector3().subVectors(CORE, c.wp); const len = d.length();
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6, 1, true), linkM); l.position.copy(c.wp); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    l.userData.len = len; l.userData.dir = d.normalize(); scene.add(l); c.link = l;
  }
  const moscow = cities.find((c) => c.name === 'Москва');
  // hero card rising from Moscow
  const heroTex = canvasTex(600, 800, (c, w, h) => drawListing(c, w, h, { kind: 'iphone', title: 'iPhone 15 Pro, 256 ГБ', price: '55 000 ₽', meta: 'Москва · 4 минуты назад', dark: true, priceColor: '#2ee59d' }));
  const hc = group(scene); hc.rotation.y = -Math.PI / 2 + 0.25;
  mesh(rbox(0.6, 0.8, 0.03, 0.05, 3), bodyM, 0, 0, 0, hc, false);
  mesh(faceG, new THREE.MeshStandardMaterial({ map: heroTex.tex, emissive: 0xffffff, emissiveMap: heroTex.tex, emissiveIntensity: 0.9, roughness: 0.4 }), 0, 0, 0.017, hc, false);
  const hcGlow = mesh(rbox(0.72, 0.92, 0.01, 0.08, 3), glow(C.green, 3, { transparent: true, opacity: 0.9, add: true }), 0, 0, -0.03, hc, false);
  const hcHalo = halo(C.green, 1.8, 1.2, hc); hcHalo.position.z = -0.1;
  const bits = dust(scene, 500, [16, 9, 16], 0x6fa8ff, 0.05, 4); bits.position.y = 0.5;
  const tmp = new THREE.Vector3();
  return {
    update(t) {
      // core animation
      ico.rotation.set(t * 0.3, t * 0.5, 0); rings[0].rotation.set(t * 0.9, 0.4, 0); rings[1].rotation.set(1.2, t * 0.7, 0.3); rings[2].rotation.set(0.3, 1.0, t * 0.6);
      core.scale.setScalar(1 + Math.sin(t * 6) * 0.02);
      // vortex
      const visV = 1 - P(t, 4.6, 5.6);
      for (const cd of cards) {
        const life = (cd.ph + t * 0.12 * cd.sp) % 1;
        const rad = lerp(cd.r0 + 1.5, 0.9, Math.pow(life, 1.4));
        const ang = cd.a0 + t * cd.sp * 1.1 / Math.sqrt(rad) + life * 2.5;
        cd.g.position.set(CORE.x + Math.cos(ang) * rad, CORE.y + cd.y0 * (rad / 6) + Math.sin(ang * 2) * 0.1, CORE.z + Math.sin(ang) * rad);
        cd.g.rotation.set(cd.tilt, -ang + Math.PI / 2 + 0.3, cd.tilt * 0.5);
        const s = clamp((rad - 0.9) / 0.8) * visV; cd.g.scale.setScalar(Math.max(0.001, s));
        if (cd.gl) cd.gl.material.opacity = clamp((3.2 - rad) / 0.8) * 0.9;
      }
      // counter
      const n = Math.floor(1000000 * Math.pow(P(t, 0.6, 3.6, (x) => x), 0.7) + (t > 3.6 ? (t - 3.6) * 23817 : 0));
      hud.visible = t < 3.3; hud.scale.setScalar(P(t, 0.4, 0.9, eback));
      hudT.draw((c, w, h) => { c.fillStyle = '#8fb3ff'; c.font = F(700, 52); c.textAlign = 'center'; c.fillText('ПРОВЕРЕНО ОБЪЯВЛЕНИЙ', w / 2, 100); c.fillStyle = '#ffffff'; c.shadowColor = '#4aa8ff'; c.shadowBlur = 24; c.font = F(900, 150); c.fillText(fmt(n), w / 2, 255); });
      // map cities light up west->east
      for (const c of cities) {
        const k = (c.wp.x - west) / (east - west);
        const on = P(t, 2.9 + k * 1.4, 3.3 + k * 1.4, eback);
        c.dot.scale.setScalar(Math.max(0.001, on)); c.halo.material.opacity = on;
        c.beam.scale.set(1, 1, 0.001 + on * (0.45 + Math.sin(t * 3 + k * 9) * 0.1) * (c === moscow ? 1 - P(t, 4.4, 4.6) : 1)); c.beam.material.opacity = 0.35;
        const pr = ((t * 0.8 + k * 3) % 1); c.ring.scale.setScalar(1 + pr * 3 * on); c.ring.material.opacity = (1 - pr) * 0.8 * on;
        const lk = P(t, 3.1 + k * 1.4, 3.7 + k * 1.4) * (1 - P(t, 5.0, 5.5));
        c.link.scale.set(1, Math.max(0.001, c.link.userData.len * lk), 1); c.link.position.copy(c.wp).addScaledVector(c.link.userData.dir, c.link.userData.len * lk / 2);
      }
      // Moscow flare & rising card
      const mf = P(t, 4.5, 4.9, eback);
      moscow.dot.material.color.set(C.green).multiplyScalar(3 + mf * 3); moscow.halo.scale.setScalar(0.35 + mf * 1.2);
      const rise = P(t, 4.5, 5.4, eout);
      hc.position.set(moscow.wp.x, moscow.wp.y + 0.1 + rise * 0.75, moscow.wp.z); hc.scale.setScalar(Math.max(0.001, rise));
      hcGlow.material.opacity = 0.6 + Math.sin(t * 10) * 0.2;
      // camera
      cam.fov = 40;
      if (t < 2.9) {
        const k = P(t, 0, 2.9, (x) => x);
        const a = lerp(0.2, -0.35, k);
        const R = lerp(5.4, 8.6, eio(k));
        setCam(cam, [Math.sin(a) * R, lerp(4.6, 5.4, k), Math.cos(a) * R], [0, CORE.y - 0.1, 0], t, 0.02);
        cam.rotateZ(Math.sin(t * 0.8) * 0.04);
      } else {
        const k = P(t, 2.9, 4.7, eio);
        const pos = [lerp(-3.0, -7.6, k), lerp(9.5, 3.6, k), lerp(7.0, 4.2, k)];
        const tgt = [lerp(0, 1.0, k), lerp(CORE.y - 1, 0.9, k), lerp(0, -1.2, k)];
        const k2 = P(t, 4.9, 6.2, (x) => x * x * (3 - 2 * x));
        hc.getWorldPosition(tmp);
        const front = [tmp.x - Math.cos(0.25) * 0.75, tmp.y, tmp.z + Math.sin(0.25) * 0.75];
        const close = [tmp.x - Math.cos(0.25) * 0.5, tmp.y, tmp.z + Math.sin(0.25) * 0.5];
        const target = k2 < 0.5 ? front : close;
        const kk = k2 < 0.5 ? k2 * 2 : (k2 - 0.5) * 2;
        const startP = k2 < 0.5 ? pos : front;
        const p2 = startP.map((v, i) => lerp(v, target[i], eio(kk)));
        const t2 = tgt.map((v, i) => lerp(v, [tmp.x, tmp.y, tmp.z][i], eio(clamp(k2 * 1.6))));
        setCam(cam, p2, t2, t, 0.015 * (1 - k2));
      }
      cam.updateProjectionMatrix();
      return { scene, camera: cam };
    },
  };
}
