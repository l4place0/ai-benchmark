const fs=require('fs'),path=require('path');process.chdir(path.resolve(__dirname,'..'));
const flux=require('../revision02/analysis/flux.json'),onsets=require('../revision02/analysis/onsets.json');
let best={score:-Infinity};for(let d=-30;d<=30;d++){let period=60/130+d*.000002;for(let z=200;z<=280;z++){let phase=z/1000,score=0;for(let n=32;n<444;n++){let i=Math.round((phase+n*period)*100),v=flux[i];score+=Math.log1p(v[2]*4+v[3]+v[4]*.45);}if(score>best.score)best={period,phase,score};}}
const quant=t=>Math.round(t*60)/60,grid=n=>best.phase+n*best.period;
const beats=[];for(let n=0;grid(n)<206;n++){let nominal=grid(n),options=onsets.filter(p=>Math.abs(p.time-nominal)<.038);options.sort((a,b)=>(b.strength*Math.exp(-Math.pow((b.time-nominal)/.023,2)))-(a.strength*Math.exp(-Math.pow((a.time-nominal)/.023,2))));let onset=options[0],time=onset?.time??nominal;beats.push({n,nominal,time,frame:Math.round(time*60),bass:onset?.bass||0,strength:onset?.strength||0,barBeat:((n-3)%4+4)%4});}
const at=n=>beats[n]?.frame/60??quant(grid(n));
// Phrase starts have pickups. Structural cuts land on the instrumental downbeat,
// while explicit pickup/vocal gestures are separate events.
const blocks=[
 [0,31,'boot',8], [31,63,'overture',4], [63,95,'geometry',8],
 [95,127,'polarity',4],[127,159,'chorus',4],[159,191,'garden',8],
 [191,223,'duality',4],[223,239,'union',4],[239,255,'isolation',4],
 [255,291,'erase',4],[291,319,'descent',4],[319,343,'execution',2],
 [343,351,'count',1],[351,383,'finalchorus',2],[383,419,'elegy',8],
 [419,445,'outro',8]
 ];
let cuts=[];let id=0;const framesSet=new Set();
function cut(t,section,pose,reason,beat){let frame=Math.round(t*60);if(framesSet.has(frame))return;framesSet.add(frame);cuts.push({id:id++,frame,time:frame/60,section,pose,reason,beat});}
for(const [a,b,section,stride]of blocks){if(section==="count")continue;if(section==="boot"){[0,7,15,23].forEach((n,j)=>cut(n?at(n):0,section,j,"intro phrase / beat-grid edit",n));continue;}let j=0;for(let n=a;n<b;n+=stride){let t=n===0?0:at(n);cut(t,section,j++,'phrase / beat-grid edit',n);}}
// One brief suspension at the disappearance; execution returns in exact two-beat cells.
const vocals=[{time:58.63,type:'pickup'},{time:103.12,type:'pickup'},{time:110.45,type:'disconnect'},{time:117.94,type:'erase'},{time:162.20,type:'pickup'},{time:177.00,type:'resolve'},{time:205.63,type:'terminal'}];
const countTimes=[158.77,159.24,159.71,160.17,160.63,161.10];
countTimes.forEach((t,i)=>cut(quant(t),'count',i,'counting syllable spectral onset',null));
cut(quant(grid(349.5)),'execution',12,'vocal response after six-count / half-beat cue',null);cut(quant(205.63),'terminal',0,'final accented onset',445);cut(208,'credits',0,'after music final command',null);
cuts.sort((a,b)=>a.frame-b.frame);cuts=cuts.filter((c,i)=>!i||c.frame-cuts[i-1].frame>=6);cuts.forEach((c,i)=>{c.id=i;c.endFrame=cuts[i+1]?.frame??12960;c.end=c.endFrame/60;});
// Production envelope at 60 Hz from official stereo downmix. Percentile normalization.
const b=fs.readFileSync('revision02/analysis/audio44100.f32'),x=new Float32Array(b.buffer,b.byteOffset,b.length/4);let low=0,mid=0;const env=[];for(let f=0;f<12960;f++){let s=Math.floor(f*735),end=s+735,a=0,l=0,h=0;for(let i=s;i<end;i++){let v=x[i]||0;low+=.018*(v-low);mid+=.19*(v-mid);a+=v*v;l+=low*low;h+=(v-mid)**2;}env.push([Math.sqrt(a/735),Math.sqrt(l/735),Math.sqrt(h/735)]);}const norms=[0,1,2].map(k=>env.map(v=>v[k]).sort((a,b)=>a-b)[Math.floor(env.length*.97)]);const envelopes=env.map(v=>v.map((x,k)=>+Math.min(1,x/norms[k]).toFixed(4)));
const old=JSON.parse(fs.readFileSync('renders/shots.json'));const errors=old.filter(v=>v[0]>0&&v[0]<205).map(v=>({time:v[0],nearestBeat:beats.reduce((a,b)=>Math.abs(a.time-v[0])<Math.abs(b.time-v[0])?a:b).time})).map(v=>({...v,errorMs:Math.round((v.time-v.nearestBeat)*1000)}));
const data={version:2,audio:'assets/song-official.m4a',duration:216,bpm:60/best.period,phase:best.phase,period:best.period,beats,cuts,vocals: vocals.map(v=>({...v,frame:Math.round(v.time*60)})),countTimes,envelopes};fs.writeFileSync('revision02/analysis/timeline.json',JSON.stringify(data));
const audit={bpm:60/best.period,phaseSeconds:best.phase,beatCount:beats.length,cutCount:cuts.length,method:'Essentia multifeature beat tracker, global spectral-flux phase fit, local onset refinement ±38ms; cuts quantized to 60fps. Vocal pickup events kept separate.',oldCutOffsets:errors,maxFrameQuantizationErrorMs:Math.max(...beats.map(v=>Math.abs(v.frame/60-v.time)*1000))};fs.writeFileSync('revision02/analysis/timing-audit.json',JSON.stringify(audit,null,2));
console.log(JSON.stringify({bpm:audit.bpm,phase:best.phase,cuts:cuts.length,beats:beats.length,oldCutOffsets:errors,first:beats.slice(0,8),chorus:cuts.filter(c=>c.section==='chorus'),execution:cuts.filter(c=>c.section==='execution')},null,2));



