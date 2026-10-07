const fs=require('fs'),path=require('path');
const D=JSON.parse(fs.readFileSync(path.join(__dirname,'analysis_official.json'),'utf8'));
const L=JSON.parse(fs.readFileSync(path.join(__dirname,'netease_lyric.json'),'utf8'));
const lrc=L.lrc.lyric;
const lines=lrc.split(/\r?\n/).map(s=>{const m=s.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/);return m?[+m[1]*60+ +m[2],m[3].trim()]:null}).filter(a=>a&&a[1]);
const F=D.flux, fps=F.length/D.duration;
const fluxAt=t=>{if(t<0||t>=D.duration)return 0;const i=t*fps,k=Math.floor(i),f=i-k;return F[k]*(1-f)+(F[Math.min(F.length-1,k+1)]||0)*f};
// LRC offset: score = mean flux at line times + offset
let best=[-1,0];
for(let off=-3;off<=6.001;off+=0.05){let s=0,c=0;for(const[t]of lines){s+=fluxAt(t+off);c++}s/=c;if(s>best[0])best=[s,off];}
const top=[];
for(let off=-3;off<=6.001;off+=0.05){let s=0,c=0;for(const[t]of lines){s+=fluxAt(t+off);c++}top.push([s/c,off]);}
top.sort((a,b)=>b[0]-a[0]);
const E=D.energy, eAt=t=>{if(t<0||t>=D.duration)return 0;const i=t*2,k=Math.floor(i),f=i-k;return E[k]*(1-f)+(E[Math.min(E.length-1,k+1)]||0)*f};
const out=[];
out.push('SONG dur='+D.duration.toFixed(2)+' bpm='+D.bpm.toFixed(2)+' beat0='+D.beat0.toFixed(3));
out.push('LRC lines='+lines.length+' first='+lines[0][0].toFixed(2)+' last='+lines[lines.length-1][0].toFixed(2));
out.push('LRC_OFFSET best='+best[1].toFixed(2)+' (score '+best[0].toFixed(1)+') runners: '+top.slice(1,4).map(x=>x[1].toFixed(2)+'/'+x[0].toFixed(0)).join(' '));
const probes=[13,15,15.5,16,16.5,17,18,28,29,29.7,30.5,59,60,73.5,74,75,103,104,125.5,126.5,130.5,131,131.5,133,146,147,147.7,148.5,150,155,160,162,162.6,163.5,165,180,200,205,205.8,206.5,208,210,211.5,212];
out.push('ENERGY probes: '+probes.map(t=>t+':'+eAt(t).toFixed(2)).join(' '));
// tail
let tail='';for(let t=207;t<212.4;t+=0.5)tail+=eAt(t).toFixed(2)+' ';
out.push('TAIL 207-212.4: '+tail);
fs.writeFileSync(path.join(__dirname,'verification.txt'),out.join('\n')+'\n');
console.log('OK verify written');
