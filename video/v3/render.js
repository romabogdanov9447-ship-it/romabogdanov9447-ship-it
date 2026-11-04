// node render.js <outdir> <fps> <workers>  — deterministic frame render, i/fps, piped to ffmpeg per worker
const {chromium}=require('playwright'); const {spawn}=require('child_process'); const fs=require('fs');
const [dir,fpsS,wS]=process.argv.slice(2); const fps=+fpsS, NW=+wS; fs.mkdirSync(dir,{recursive:true});
(async()=>{
  const b0=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p0=await b0.newPage({viewport:{width:1080,height:1920}}); p0.setDefaultTimeout(900000); await p0.goto('http://localhost:8765/scene.html'); await p0.waitForFunction('window.ready',null,{timeout:900000,polling:500});
  const END=await p0.evaluate(()=>window.END); await b0.close();
  const N=Math.round(END*fps); const F0=process.env.FROM?Math.round(+process.env.FROM*fps):0, F1=process.env.TO?Math.round(+process.env.TO*fps):N; const per=Math.ceil((F1-F0)/NW); console.log('frames',N);
  await Promise.all([...Array(NW).keys()].map(async w=>{
    const a=F0+w*per, z=Math.min(F1,a+per);
    const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const p=await b.newPage({viewport:{width:1080,height:1920}}); p.on('pageerror',e=>console.log('ERR',w,e.message)); p.setDefaultTimeout(900000); await new Promise(r=>setTimeout(r,w*8000));
    await p.goto('http://localhost:8765/scene.html'); await p.waitForFunction('window.ready',null,{timeout:900000,polling:500});
    const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-r',String(fps),`${dir}/part_${w}.mp4`]);
    const t0=Date.now();
    for(let i=a;i<z;i++){ await p.evaluate(([t,f])=>renderAt(t,f),[i/fps,fps]); const d=await p.evaluate(()=>frameJPEG(.94)); if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64'))) await new Promise(r=>ff.stdin.once('drain',r)); if((i-a)%300===0) console.log('w',w,i-a,'/',z-a,((Date.now()-t0)/1000).toFixed(0)+'s'); }
    ff.stdin.end(); await new Promise(r=>ff.on('close',r)); await b.close(); console.log('worker done',w);
  }));
  fs.writeFileSync(`${dir}/parts.txt`,[...Array(NW).keys()].map(w=>`file 'part_${w}.mp4'`).join('\n')+'\n');
})();
