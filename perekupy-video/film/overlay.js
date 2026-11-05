// Reference-style 2D overlay: bold captions with highlighted keywords, top progress bar, tags & paper notes.
const Y = '#FFC62B', R = '#FF4646';
// [start, end, text, position('low'|'top')]; *word* = yellow, !word! = red
const CAPS = [
  [1.35, 2.36, 'ПРЕДСТАВЬ: *СЕМЬ УТРА*.'],
  [2.36, 3.56, 'ТЫ ЕЩЁ В КРОВАТИ,'],
  [3.56, 5.6, 'А ТЕЛЕФОН УЖЕ *ВИБРИРУЕТ*.'],
  [6.16, 7.12, 'ПОКА ТЫ СПАЛ,'],
  [7.14, 8.08, '*НЕЙРОСЕТЬ* ПЕРЕБРАЛА'],
  [8.1, 9.62, 'БОЛЬШЕ *МИЛЛИОНА* ОБЪЯВЛЕНИЙ'],
  [9.64, 11.4, 'НА АВИТО ПО *ВСЕЙ РОССИИ*.'],
  [12.04, 13.4, 'И НАШЛА *ОДНО*.'],
  [13.5, 15.1, '*IPHONE 15 PRO*.'],
  [21.64, 23.1, 'ОБЫЧНЫЙ ПЕРЕКУП УВИДИТ ЕГО'],
  [24.4, 26.0, 'КОГДА ЕГО !УЖЕ ЗАБЕРУТ!.'],
  [26.44, 28.42, 'А ТЫ *ОТКРЫВАЕШЬ ССЫЛКУ*,'],
  [28.46, 29.26, '*ЗВОНИШЬ*,'],
  [29.28, 29.98, '*ЕДЕШЬ*,'],
  [30.0, 31.56, 'ПРОВЕРЯЕШЬ, *ТОРГУЕШЬСЯ*'],
  [31.58, 33.7, 'И ЗАБИРАЕШЬ ЗА *52 000*.'],
  [34.26, 36.4, 'ВЕЧЕРОМ ПРОДАЁШЬ ЗА *77 000*,'],
  [43.32, 44.6, 'НЕЙРОСЕТЬ *САМА НАХОДИТ*'],
  [44.6, 46.75, 'ВЫГОДНЫЕ ТОВАРЫ В *ТВОИХ ГОРОДАХ*,'],
  [46.8, 48.12, 'А *ОБУЧЕНИЕ* НАУЧИТ'],
  [48.14, 49.3, 'ПЕРЕКУПАТЬ *С НУЛЯ*.'],
  [52.84, 60.0, 'ПОКА ТВОЙ АЙФОН НЕ ЗАБРАЛ !КТО-ТО ДРУГОЙ!.', 'top'],
];
const NOTES = [
  { a: 0.9, b: 5.6, kind: 'paper', title: 'Среда · 07:00', sub: 'новых сделок: 1' },
  { a: 24.9, b: 26.0, kind: 'pill', title: 'ОПОЗДАЛ НА 3 ЧАСА' },
  { a: 30.0, b: 31.5, kind: 'paper', title: 'Правило №1:', sub: 'проверь до оплаты' },
];
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const eback = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

function tokens(text) {
  const out = []; let color = '#ffffff';
  for (const part of text.split(/(\*|!)/)) {
    if (part === '*') { color = color === Y ? '#ffffff' : Y; continue; }
    if (part === '!') { color = color === R ? '#ffffff' : R; continue; }
    for (const w of part.split(/( +)/)) if (w) out.push({ w, color });
  }
  return out;
}
function layout(ctx, toks, maxW) {
  const lines = [[]]; let lw = 0;
  for (const tk of toks) {
    const w = ctx.measureText(tk.w).width;
    if (/^ +$/.test(tk.w)) { if (lines[lines.length - 1].length) { lines[lines.length - 1].push({ ...tk, width: w }); lw += w; } continue; }
    if (lw + w > maxW && lines[lines.length - 1].length) { const L = lines[lines.length - 1]; while (L.length && /^ +$/.test(L[L.length - 1].w)) L.pop(); lines.push([]); lw = 0; }
    lines[lines.length - 1].push({ ...tk, width: w }); lw += w;
  }
  for (const L of lines) while (L.length && /^ +$/.test(L[L.length - 1].w)) L.pop();
  return lines;
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

export function makeOverlay(W, H, duration) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  document.body.appendChild(cv);
  const c = cv.getContext('2d');
  return (t) => {
    c.clearRect(0, 0, W, H);
    const cap = CAPS.find((k) => t >= k[0] && t < k[1]);
    // soft dark floor under captions (like the reference's lower band)
    const capVis = CAPS.reduce((m, k) => Math.max(m, clamp((t - k[0] + 0.25) / 0.25) * clamp((k[1] + 0.25 - t) / 0.25)), 0);
    const low = cap ? cap[3] !== 'top' : true;
    if (capVis > 0) {
      const g = low ? c.createLinearGradient(0, H * 0.52, 0, H) : c.createLinearGradient(0, H * 0.3, 0, 0);
      g.addColorStop(0, 'rgba(4,6,14,0)'); g.addColorStop(0.45, `rgba(4,6,14,${0.55 * capVis})`); g.addColorStop(1, `rgba(4,6,14,${0.78 * capVis})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (cap) {
      const k = clamp((t - cap[0]) / 0.16); const s = 0.86 + 0.14 * eback(k);
      c.save(); c.font = '900 70px Inter'; c.textBaseline = 'alphabetic';
      const lines = layout(c, tokens(cap[2]), W * 0.82);
      const lh = 84, total = lines.length * lh; const cy = cap[3] === 'top' ? H * 0.14 : H * 0.735;
      c.translate(W / 2, cy); c.scale(s, s); c.globalAlpha = clamp(k * 1.5) * clamp((cap[1] - t) / 0.08 + 0.2);
      lines.forEach((L, i) => {
        const lw = L.reduce((a, b) => a + b.width, 0); let x = -lw / 2; const y = -total / 2 + (i + 0.8) * lh;
        for (const tk of L) { c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 18; c.shadowOffsetY = 4; c.fillStyle = tk.color; c.fillText(tk.w, x, y); x += tk.width; }
      });
      c.restore();
    }
    // notes / tags
    for (const n of NOTES) {
      if (t < n.a || t > n.b) continue;
      const k = eback(clamp((t - n.a) / 0.3)), out = clamp((n.b - t) / 0.2);
      c.save(); c.globalAlpha = out;
      if (n.kind === 'paper') {
        c.translate(70, 150); c.rotate(-0.06); c.scale(k, k);
        c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 20; c.shadowOffsetY = 8; c.fillStyle = '#f3ead2'; c.fillRect(0, 0, 360, 150); c.shadowBlur = 0; c.shadowOffsetY = 0;
        c.fillStyle = 'rgba(255,198,43,.55)'; c.fillRect(130, -14, 100, 30);
        c.fillStyle = '#1b1b22'; c.font = 'italic 800 46px Inter'; c.fillText(n.title, 24, 66); c.font = '700 30px Inter'; c.fillStyle = '#4a4a55'; c.fillText(n.sub, 24, 114);
      } else if (n.kind === 'pill') {
        c.font = '900 40px Inter'; const w = c.measureText(n.title).width + 90; c.translate(W / 2, 170); c.scale(k, k);
        c.fillStyle = '#e63a3a'; rr(c, -w / 2, -38, w, 76, 16); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-w / 2 + 34, 0, 8, 0, 7); c.fill();
        c.textAlign = 'center'; c.fillText(n.title, 18, 14);
      } else {
        c.font = '800 30px Inter'; const w = c.measureText(n.title).width + 64; c.translate(W / 2, 110); c.scale(k, k);
        c.fillStyle = 'rgba(10,14,28,.85)'; rr(c, -w / 2, -30, w, 60, 12); c.fill(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.stroke();
        c.fillStyle = '#2ee59d'; c.beginPath(); c.arc(-w / 2 + 26, 0, 7, 0, 7); c.fill(); c.fillStyle = '#e8ecf8'; c.textAlign = 'center'; c.fillText(n.title, 12, 11);
      }
      c.restore();
    }
    // top progress bar (yellow, as in the reference)
    c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(0, 0, W, 8);
    c.fillStyle = Y; c.fillRect(0, 0, W * clamp(t / duration), 8);
  };
}
