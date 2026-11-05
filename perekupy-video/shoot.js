// usage: node shoot.js out_prefix t1 t2 ...   (renders specific times at given scale)
const {chromium}=require('playwright');
(async()=>{
  const [prefix,...ts]=process.argv.slice(2); const scale=process.env.SCALE||'0.5';
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const W=Math.round(1080*scale),H=Math.round(1920*scale);
  const p=await b.newPage({viewport:{width:W,height:H}});
  p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('C',m.text().slice(0,300))});p.on('pageerror',e=>console.log('E',e.message));
  await p.goto(`http://localhost:8765/film/index.html?scale=${scale}`);
  await p.waitForFunction('window.ready||window.initError',null,{timeout:120000});
  const err=await p.evaluate('window.initError'); if(err){console.log(err);process.exit(1);}
  for(const t of ts){const t0=Date.now();await p.evaluate(t=>window.renderAt(t),parseFloat(t));await p.screenshot({path:`${prefix}_${t}.jpg`,type:'jpeg',quality:85});console.log(t,Date.now()-t0,'ms');}
  await b.close();})();
