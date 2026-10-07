import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.TEMP=process.env.TMP=path.join(root,'tmp');
// Application-level caches, including graphics-driver paths, stay in the project.
process.env.LOCALAPPDATA=path.join(root,'tmp/user/AppData/Local');
process.env.APPDATA=path.join(root,'tmp/user/AppData/Roaming');
process.env.USERPROFILE=path.join(root,'tmp/user');
process.env.CUDA_CACHE_PATH=path.join(root,'cache/cuda');
process.env.__GL_SHADER_DISK_CACHE_PATH=path.join(root,'cache/graphics');
for(const p of [process.env.LOCALAPPDATA,process.env.APPDATA,process.env.CUDA_CACHE_PATH,process.env.__GL_SHADER_DISK_CACHE_PATH])fs.mkdirSync(p,{recursive:true});
const args=process.argv.slice(2),qa=args.includes('--qa'),preview=args.includes('--preview'),sample=args.includes('--sample');
const port=Number(process.env.MV_PORT||9461),debugPort=port+1;
const analysis=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/analysis.json')));
const startArg=args.indexOf('--start'),durationArg=args.indexOf('--duration');
const start=startArg>=0?Number(args[startArg+1]):0;
const duration=durationArg>=0?Number(args[durationArg+1]):sample?4:Math.max(214,Math.ceil(analysis.duration*60)/60+2),frames=Math.ceil(duration*60);
const ffpath=path.join(root,'tools/ffmpeg/ffmpeg.exe');
const errors=[],frameTimes=[],targets=[];
let encoder,received=0,doneResolve,doneReject;
const done=new Promise((resolve,reject)=>{doneResolve=resolve;doneReject=reject});
const nameArg=args.indexOf('--name'),clipName=nameArg>=0?args[nameArg+1]:'sample';
if(!/^[a-z0-9-]+$/.test(clipName))throw Error('Clip name must use lowercase letters, numbers and hyphens');
const outFile=path.join(root,sample?`output/v2/qa/${clipName}_1080p60.mp4`:'output/v2/world-execute-me_paper-theatre_1080p60.mp4');
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='POST'&&url.pathname==='/frame'){
   const parts=[];for await(const b of req)parts.push(b);const data=Buffer.concat(parts);
   if(data.length!==1920*1080*4)throw Error(`Bad frame size ${data.length}`);
   if(!encoder.stdin.write(data))await once(encoder.stdin,'drain');
   received++;if(received%120===0){const line=JSON.stringify({received,frames,percent:+(100*received/frames).toFixed(1),at:new Date().toISOString()});fs.writeFileSync(path.join(root,'logs/v2/progress.json'),line);console.log(line);}
   res.writeHead(204);res.end();return;
  }
  if(req.method==='POST'&&url.pathname==='/qa'){
   const parts=[];for await(const b of req)parts.push(b);
   const name=Number(url.searchParams.get('t')).toFixed(3).replace('.','_');
   fs.writeFileSync(path.join(root,`output/v2/qa/frame_${name}.png`),Buffer.concat(parts));res.writeHead(204);res.end();return;
  }
  if(req.method==='POST'&&url.pathname==='/done'){
   res.writeHead(204);res.end();encoder?.stdin.end();doneResolve();return;
  }
  if(req.method==='POST'&&url.pathname==='/error'){
   const parts=[];for await(const b of req)parts.push(b);const msg=Buffer.concat(parts).toString();errors.push(msg);res.writeHead(204);res.end();doneReject(Error(msg));return;
  }
  if(url.pathname==='/config'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({duration,frames,fps:60,start}));return;}
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/src/v2/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  const types={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ttf':'font/ttf','.mp3':'audio/mpeg','.mp4':'video/mp4'};
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  const bytes=fs.statSync(file).size;
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.setHeader('Accept-Ranges','bytes');
  const range=req.headers.range;
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match){res.writeHead(416,{'Content-Range':`bytes */${bytes}`});res.end();return;}
   const first=match[1]?Number(match[1]):Math.max(0,bytes-Number(match[2]));
   const last=match[1]&&match[2]?Math.min(bytes-1,Number(match[2])):bytes-1;
   if(first>last||first>=bytes){res.writeHead(416,{'Content-Range':`bytes */${bytes}`});res.end();return;}
   res.writeHead(206,{'Content-Range':`bytes ${first}-${last}/${bytes}`,'Content-Length':last-first+1});
   if(req.method==='HEAD'){res.end();return;}
   fs.createReadStream(file,{start:first,end:last}).pipe(res);return;
  }
  res.setHeader('Content-Length',bytes);
  if(req.method==='HEAD'){res.end();return;}
  fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e));doneReject(e);}
});
await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
if(preview){console.log(`Preview at http://127.0.0.1:${port}`);await new Promise(()=>{});}
const chrome=spawn(path.join(root,'tools/chrome/chrome-headless-shell-win64/chrome-headless-shell.exe'),[
 '--headless','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-breakpad','--disable-crash-reporter','--disable-gpu-shader-disk-cache',
 '--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-features=Translate,OptimizationHints,MediaRouter','--force-color-profile=srgb',
 `--user-data-dir=${path.join(root,process.env.MV_PROFILE||'tmp/chrome-profile-v2')}`,`--disk-cache-dir=${path.join(root,'cache/chrome-v2')}`,`--crash-dumps-dir=${path.join(root,'tmp/crashes')}`,`--remote-debugging-port=${debugPort}`,
 '--window-size=1920,1080','about:blank'
],{cwd:root,windowsHide:true,env:process.env});
chrome.stderr.pipe(fs.createWriteStream(path.join(root,'logs/v2/chrome.log')));
let ws,seq=0;const pending=new Map();
async function send(method,params={}){const id=++seq;const promise=new Promise((resolve,reject)=>pending.set(id,{resolve,reject}));ws.send(JSON.stringify({id,method,params}));return promise;}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
try{
 let info;
 for(let i=0;i<90;i++){try{info=await(await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();if(info.length)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 if(!info?.length)throw Error('Chromium did not start; see logs/v2/chrome.log');
 ws=new WebSocket(info[0].webSocketDebuggerUrl);await once(ws,'open');
 ws.addEventListener('message',({data})=>{const m=JSON.parse(data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
  if(m.method==='Runtime.exceptionThrown'){errors.push(JSON.stringify(m.params));console.error('Browser exception',JSON.stringify(m.params));}
 });
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:`http://127.0.0.1:${port}/src/v2/index.html?render=1`});
 for(let i=0;i<120;i++){if(await evaluate('Boolean(window.mvReady)'))break;await new Promise(r=>setTimeout(r,500));}
 if(!await evaluate('Boolean(window.mvReady)'))throw Error('Scene initialization failed');
 console.log('Browser ready',await evaluate('window.rendererInfo'));
 fs.writeFileSync(path.join(root,'research/v2/storyboard.json'),JSON.stringify(await evaluate('window.shots'),null,2));
 if(args.includes('--benchmark')){
  const benchmark=await evaluate('window.benchmarkFrames()');console.log('Benchmark',benchmark);fs.writeFileSync(path.join(root,'research/v2/benchmark.json'),JSON.stringify(benchmark,null,2));
 }else if(qa){
  const audit=await evaluate('window.auditFrames()');fs.writeFileSync(path.join(root,'research/v2/scene-audit.json'),JSON.stringify(audit,null,2));if(!audit.passed)throw Error('Frame determinism failed');
  const times=[1.8,6,12,18,26,31.5,35,38.5,42,47,57,62,72,78,83,86.5,92,97,108,114,122,129,138,145,150,155,160,165,173,183,193,200,206.7,209.5,212,214];
  for(const t of times){await evaluate(`window.saveQA(${t})`);console.log('QA',t);}
 }else{
  encoder=spawn(ffpath,['-y','-hide_banner','-loglevel','warning','-f','rawvideo','-pixel_format','rgba','-video_size','1920x1080','-framerate','60','-i','pipe:0','-ss',String(start),'-i',path.join(root,'assets/audio/source/audio.mp3'),'-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-threads','8','-c:a','aac','-b:a','320k','-af','apad','-t',String(duration),'-movflags','+faststart',outFile],{cwd:root,windowsHide:true});
  encoder.stderr.pipe(fs.createWriteStream(path.join(root,'logs/v2/encode.log')));
  const encoded=once(encoder,'close');encoder.on('error',doneReject);encoder.stdin.on('error',doneReject);
  const renderBegan=Date.now();
  await send('Runtime.evaluate',{expression:'window.renderAll()',awaitPromise:false});
  await done;const [exit]=await encoded;if(exit!==0)throw Error(`FFmpeg exited ${exit}`);
  const report={width:1920,height:1080,fps:60,frames:received,duration,songDuration:analysis.duration,elapsedSeconds:(Date.now()-renderBegan)/1000,errors,start,source:'Browser Canvas 2D; original articulated paper theatre; deterministic frame timestamps'};
  fs.writeFileSync(path.join(root,sample?`output/v2/qa/${clipName}-report.json`:'output/v2/render-report.json'),JSON.stringify(report,null,2));console.log('Completed',report);
 }
}finally{ws?.close();chrome.kill();server.close();if(encoder&&!encoder.killed)encoder.kill();}
