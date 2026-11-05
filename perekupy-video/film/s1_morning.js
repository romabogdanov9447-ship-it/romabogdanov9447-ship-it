import { THREE, makeBedroom, makeCharacter, makeBlanket, HERO, canvasTex, drawNotification, drawClock, seq, P, clamp, lerp, setCam, eio, eout, smooth, dust } from './lib.js';

export async function build(ctx) {
  const scene = makeBedroom({});
  scene.environment = ctx.env; scene.environmentIntensity = 0.22;
  const u = scene.userData;
  const cam = new THREE.PerspectiveCamera(36, ctx.aspect, 0.02, 60);
  // sleeping hero
  const hero = makeCharacter(HERO);
  hero.rotation.x = -Math.PI / 2; hero.position.set(-0.08, 0.74, 0.86); u.bed.add(hero);
  const J = hero.J; ['lArm', 'rArm', 'lLeg', 'rLeg'].forEach((k) => (J[k].visible = false));
  hero.pose({ blink: 1, smile: 0.25, head: [-0.2, 0.45, 0.1], look: [0, 0] });
  const blanket = makeBlanket(u.blanketM, 1.72, 1.65, (x, z) => {
    const torso = 0.27 * Math.exp(-((x + 0.08) ** 2) / (2 * 0.2 ** 2)) * smooth(clamp((z + 0.82) / 0.12)) * (1 - smooth(clamp((z + 0.05) / 0.3)));
    const legs = 0.15 * Math.exp(-((x + 0.08) ** 2) / (2 * 0.17 ** 2)) * smooth(clamp((z + 0.2) / 0.3)) * (1 - smooth(clamp((z - 0.6) / 0.2)));
    const roll = 0.05 * Math.exp(-((z + 0.78) ** 2) / 0.002);
    return Math.max(torso, legs) + roll;
  });
  blanket.position.set(0, 0.55, 0.26); u.bed.add(blanket);
  // phone screen
  const phone = u.phone;
  const scr = canvasTex(600, 1240); phone.setScreen(scr.tex, 0);
  const dustP = dust(scene, 160, [5, 3, 4], 0xffc9a0, 0.025, 9); dustP.position.set(0.3, 0.2, -1.2);
  scene.add(cam);
  const phoneWorld = new THREE.Vector3(); phone.updateWorldMatrix(true, false); phone.getWorldPosition(phoneWorld);
  const phoneBase = phone.position.clone(), phoneRot = phone.rotation.z;
  const upTop = new THREE.Vector3(-Math.sin(0.35), 0, -Math.cos(0.35));
  let lastNotif = -1;
  return {
    update(t) {
      // alarm clock
      u.clockTex.draw((c, w, h) => drawClock(c, w, h, t < 1.0 ? '06:59' : '07:00'));
      // breathing
      const br = Math.sin(t * 1.6);
      blanket.scale.y = 1 + br * 0.03; J.torso.scale.set(1 + br * 0.012, 1, 1 + br * 0.02);
      hero.pose({ head: [-0.2 + br * 0.01, 0.45, 0.1], brow: t > 4.2 ? 0.25 * P(t, 4.2, 4.6) : 0, smile: 0.25 });
      // sky slowly brightening
      u.key.intensity = lerp(1.4, 2.1, P(t, 0, 6.6));
      // vibration
      const on = t > 3.55;
      let vib = 0;
      if (on) { const k = (t - 3.55) % 1.1; vib = k < 0.55 ? Math.sin(k / 0.55 * Math.PI) : 0; }
      phone.position.x = phoneBase.x + Math.sin(t * 95) * 0.004 * vib; phone.position.z = phoneBase.z + Math.cos(t * 83) * 0.003 * vib;
      phone.rotation.z = phoneRot + Math.sin(t * 71) * 0.05 * vib;
      const sOn = on ? P(t, 3.55, 3.8) : 0;
      phone.setScreen(scr.tex, sOn * 1.15);
      const na = on ? P(t, 3.9, 4.4, eout) : 0;
      if (Math.abs(na - lastNotif) > 0.001 || lastNotif < 0) { scr.draw((c, w, h) => drawNotification(c, w, h, na)); lastNotif = na; }
      u.screenLight.position.set(phoneWorld.x, phoneWorld.y + 0.12, phoneWorld.z); u.screenLight.intensity = sOn * (2.2 + vib * 0.6);
      // camera
      cam.up.set(0, 1, 0); cam.fov = 36;
      if (t < 2.3) {
        const k = P(t, 0, 2.3, (x) => x);
        cam.fov = 44; setCam(cam, [lerp(1.1, 0.75, k), lerp(2.35, 1.95, k), lerp(3.2, 2.5, k)], [lerp(-0.35, -0.3, k), lerp(1.05, 1.0, k), -1.9], t, 0.01);
      } else if (t < 4.0) {
        const k = P(t, 2.3, 4.0, (x) => x);
        setCam(cam, [lerp(0.2, 0.05, k), lerp(1.62, 1.5, k), lerp(-0.85, -1.0, k)], [-0.9, 0.78, -2.15], t, 0.005);
        cam.fov = 38;
      } else {
        const k = P(t, 4.0, 6.6, eio);
        const pos = [lerp(0.05, phoneWorld.x + 0.004, k), lerp(1.5, phoneWorld.y + 0.17, k), lerp(-1.0, phoneWorld.z + 0.012, k)];
        const kt = P(t, 4.0, 5.3); const tgt = [lerp(-0.9, phoneWorld.x, kt), lerp(0.78, phoneWorld.y, kt), lerp(-2.15, phoneWorld.z, kt)];
        cam.up.set(0, 1, 0).lerp(upTop, P(t, 5.0, 6.2)).normalize();
        setCam(cam, pos, tgt, t, 0.003 * (1 - k));
      }
      cam.updateProjectionMatrix();
      return { scene, camera: cam };
    },
  };
}
