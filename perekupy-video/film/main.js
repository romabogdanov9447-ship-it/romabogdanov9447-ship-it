import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadFonts, clamp } from './lib.js';
import { makeOverlay } from './overlay.js';
import * as S1 from './s1_morning.js';
import * as S2 from './s2_ai.js';
import * as S3 from './s3_find.js';
import * as S4 from './s4_rival.js';
import * as S5 from './s5_buy.js';
import * as S6 from './s6_profit.js';
import * as S7 from './s7_brand.js';

const W = 1080, H = 1920;
const params = new URLSearchParams(location.search);
const SCALE = parseFloat(params.get('scale') || '1');

// global timeline (seconds)
export const TL = [
  { mod: S1, start: 0.0, end: 5.8, warp: [[0, 0], [1.5, 1.33], [2.42, 2.84], [3.64, 4.09], [4.6, 4.75], [5.8, 6.6]] },
  { mod: S2, start: 5.8, end: 11.7, warp: [[0, 0], [0.36, 0.3], [1.34, 1.28], [2.62, 2.44], [4.94, 4.1], [5.9, 6.2]] },
  { mod: S3, start: 11.7, end: 21.27, warp: [[0, 0], [0.34, 0.3], [0.9, 0.86], [1.8, 2.15], [3.52, 4.38], [5.44, 6.88], [7.34, 9.13], [8.66, 10.46], [9.57, 12]] },
  { mod: S4, start: 21.27, end: 26.07, warp: [[0, 0], [0.37, 0.3], [2.13, 2.2], [2.45, 2.39], [3.13, 3.63], [3.87, 4.54], [4.8, 6.0]] },
  { mod: S5, start: 26.07, end: 33.97, warp: [[0, 0], [0.37, 0.3], [1.55, 1.28], [2.39, 2.63], [3.21, 4.1], [3.93, 5.52], [4.79, 6.28], [5.71, 7.06], [6.47, 7.72], [7.9, 9.6]] },
  { mod: S6, start: 33.97, end: 40.03, warp: [[0, 0], [0.29, 0.3], [1.57, 1.62], [2.61, 3.11], [2.95, 3.51], [4.63, 5.44], [5.21, 6.03], [6.06, 7.4]] },
  { mod: S7, start: 40.03, end: 60.0, warp: [[0, 0], [0.47, 0.3], [0.77, 0.81], [3.29, 3.35], [5.97, 5.8], [6.85, 7.28], [8.81, 8.7], [9.39, 9.96], [10.31, 10.92], [11.61, 12.73], [12.81, 14.65], [14.61, 16.32], [19.97, 19.2]] },
];
export const DURATION = 60.0;
// transitions at boundaries: type flash | dip
const TR = [[5.8, 'flash'], [11.7, 'flash'], [21.27, 'dip'], [26.07, 'dip'], [33.97, 'dip'], [40.03, 'flash']];
function warpT(w, x) { if (x <= w[0][0]) return x; for (let i = 0; i < w.length - 1; i++) { const [a0, b0] = w[i], [a1, b1] = w[i + 1]; if (x <= a1) return b0 + (b1 - b0) * (x - a0) / (a1 - a0); } const [a, b] = w[w.length - 1]; return b + (x - a); }

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uFade: { value: 0 }, uFlash: { value: 0 }, uTime: { value: 0 }, uAberr: { value: 0.0015 }, uRes: { value: new THREE.Vector2(W, H) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uFade,uFlash,uTime,uAberr; uniform vec2 uRes; varying vec2 vUv;
  float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
  void main(){
    vec2 d=vUv-0.5; float r2=dot(d,d);
    vec2 off=d*uAberr*(1.0+r2*4.0);
    vec3 col=vec3(texture2D(tDiffuse,vUv+off).r, texture2D(tDiffuse,vUv).g, texture2D(tDiffuse,vUv-off).b);
    // grade: cool shadows, slight warm highlights, gentle contrast
    float l=dot(col,vec3(0.299,0.587,0.114));
    col=mix(col, col*vec3(0.92,0.98,1.1), 1.0-smoothstep(0.0,0.6,l));
    col=mix(col, col*vec3(1.04,1.0,0.96), smoothstep(0.55,1.0,l));
    col=(col-0.5)*1.06+0.5+0.005;
    // vignette (9:16)
    vec2 q=d*vec2(1.0,0.75); float v=smoothstep(0.75,0.2,length(q)*1.25);
    col*=mix(0.55,1.0,v);
    // grain
    float g=hash(vUv*uRes+fract(uTime*7.13)*100.0)-0.5; col+=g*0.035;
    col=mix(col, vec3(0.75,0.88,1.0)*1.2, uFlash);
    col*=1.0-uFade;
    gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
  }`,
};

let renderer, composer, renderPass, grade, overlay, built = [];
async function init() {
  await loadFonts();
  renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W * SCALE, H * SCALE);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  document.body.appendChild(renderer.domElement);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const rt = new THREE.WebGLRenderTarget(W * SCALE, H * SCALE, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  composer.addPass(renderPass);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W * SCALE / 2, H * SCALE / 2), 0.42, 0.5, 0.9));
  composer.addPass(new OutputPass());
  grade = new ShaderPass(GradeShader); composer.addPass(grade);
  const ctx = { renderer, env, W, H, aspect: W / H };
  for (const seg of TL) built.push(await seg.mod.build(ctx));
  overlay = makeOverlay(W, H, DURATION);
  window.ready = true;
}
function transition(t) {
  let fade = 0, flash = 0;
  fade = Math.max(fade, 1 - clamp(t / 0.5));
  for (const [b, type] of TR) {
    const d = t - b;
    if (type === 'dip') { if (d > -0.22 && d < 0.25) fade = Math.max(fade, d < 0 ? clamp((d + 0.22) / 0.22) : 1 - clamp(d / 0.25)); }
    else if (d > -0.3 && d < 0.45) flash = Math.max(flash, d < 0 ? Math.pow(clamp((d + 0.3) / 0.3), 2) : 1 - Math.sqrt(clamp(d / 0.45)));
  }
  return { fade, flash };
}
window.renderAt = (t) => {
  let i = TL.findIndex((s) => t >= s.start && t < s.end); if (i < 0) i = TL.length - 1;
  const seg = TL[i];
  const lt = warpT(seg.warp, t - seg.start);
  const out = built[i].update(lt, t);
  out.scene.updateMatrixWorld(true); out.camera.updateMatrixWorld(true);
  const out2 = built[i].update(lt, t); Object.assign(out, out2);
  renderPass.scene = out.scene; renderPass.camera = out.camera;
  const tr = transition(t);
  grade.uniforms.uFade.value = Math.max(tr.fade, out.fade ?? 0);
  grade.uniforms.uFlash.value = Math.max(tr.flash, out.flash ?? 0);
  grade.uniforms.uTime.value = t;
  composer.render();
  overlay(t);
  return i;
};
window.DURATION = DURATION;
init().catch((e) => { console.error('INIT', e.stack || e); window.initError = String(e.stack || e); });
