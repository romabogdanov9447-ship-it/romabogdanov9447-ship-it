// node render.js startFrame endFrame outdir
const {chromium}=require('playwright');
(async()=>{
  const [s,e,out]=process.argv.slice(2); const FPS=30;
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:1080,height:1920}});
  p.on('pageerror',e=>console.log('E',e.message));
  await p.goto('http://localhost:8765/film/index.html?scale=1');
  await p.waitForFunction('window.ready||window.initError',null,{timeout:180000});
  const err=await p.evaluate('window.initError'); if(err){console.log(err);process.exit(1);}
  for(let f=+s;f<+e;f++){await p.evaluate(t=>window.renderAt(t),f/FPS);await p.screenshot({path:`${out}/f${String(f).padStart(5,'0')}.jpg`,type:'jpeg',quality:93});if(f%50==0)console.log('frame',f,new Date().toISOString());}
  await b.close();})();
