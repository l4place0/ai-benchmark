import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.TEMP=process.env.TMP=path.join(root,'tmp');
const ff=path.join(root,'tools/ffmpeg/ffmpeg.exe');
const probe=spawnSync(path.join(root,'tools/ffmpeg/ffprobe.exe'),['-v','quiet','-show_format','-show_streams','-of','json',path.join(root,'assets/audio/source/audio.mp3')],{encoding:'utf8',windowsHide:true});
if(probe.status!==0) throw Error(probe.stderr || 'Audio probing failed');
fs.writeFileSync(path.join(root,'research/audio-probe.json'),probe.stdout);
const duration=Number(JSON.parse(probe.stdout).format.duration);
const decoded=spawnSync(ff,['-v','error','-y','-i',path.join(root,'assets/audio/source/audio.mp3'),'-ac','1','-ar','12000','-f','f32le',path.join(root,'tmp/analysis.f32')],{windowsHide:true});
if(decoded.status!==0) throw Error(decoded.stderr.toString());
const buf=fs.readFileSync(path.join(root,'tmp/analysis.f32'));
const samples=new Float32Array(buf.buffer,buf.byteOffset,buf.length/4);
const fps=60,frames=Math.ceil(duration*fps),features=[];
let low=0,last=0;
for(let f=0;f<frames;f++){
 let rms=0,bass=0,hi=0;const start=Math.floor(f*12000/fps),end=Math.min(samples.length,start+200);
 for(let i=start;i<end;i++){const v=samples[i];low+=.065*(v-low);rms+=v*v;bass+=low*low;hi+=(v-last)**2;last=v;}
 const n=Math.max(1,end-start);features.push([Math.sqrt(rms/n),Math.sqrt(bass/n),Math.sqrt(hi/n)]);
}
const sorted=features.map(x=>x[0]).sort((a,b)=>a-b),scale=sorted[Math.floor(sorted.length*.95)];
const output={duration,fps,frames,bpm:130,beatOffset:.213,features:features.map(v=>v.map((x,i)=>Number(Math.min(1.4,x/(i===0?scale:i===1?scale*.55:scale*.6)).toFixed(4))))};
fs.writeFileSync(path.join(root,'assets/audio/analysis.json'),JSON.stringify(output));
console.log(JSON.stringify({duration,frames,scale,minutes:duration/60}));
