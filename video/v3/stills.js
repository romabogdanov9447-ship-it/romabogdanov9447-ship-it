// render selected times to JPEGs for review
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('console',m.type(),m.text())}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://localhost:8765/scene.html'); await p.waitForFunction('window.ready',{timeout:300000});
const times=process.argv.slice(3).map(Number); const dir=process.argv[2]; fs.mkdirSync(dir,{recursive:true});
for(const t of times){await p.evaluate(t=>renderAt(t),t); const d=await p.evaluate(()=>frameJPEG(.85)); fs.writeFileSync(`${dir}/${t.toFixed(2)}.jpg`,Buffer.from(d.split(',')[1],'base64'));}
await b.close();})();
