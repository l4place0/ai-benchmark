const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');process.chdir(root);
const buf=fs.readFileSync('temp/audio.f32'); const a=new Float32Array(buf.buffer,buf.byteOffset,buf.length/4);
let low=0,mid=0;const frames=[];let peak=0;
for(let f=0;f<216*60;f++){let sum=0,bass=0,treble=0;let s=Math.floor(f*22050/60),e=Math.floor((f+1)*22050/60);for(let i=s;i<e;i++){let x=a[i]||0;low+=.035*(x-low);mid+=.35*(x-mid);sum+=x*x;bass+=low*low;treble+=(x-mid)**2;}const n=e-s;let v=[Math.sqrt(sum/n),Math.sqrt(bass/n),Math.sqrt(treble/n)];peak=Math.max(peak,v[0]);frames.push(v);}
fs.writeFileSync('assets/envelope.json',JSON.stringify(frames.map(v=>v.map(x=>+Math.min(1,x/(peak*.72)).toFixed(4)))));
fs.writeFileSync('docs/audio-analysis.json',JSON.stringify({sampleRate:22050,samples:a.length,duration:a.length/22050,fps:60,frames:frames.length,peakRMS:peak,beatBPM:130,source:'song.wav; waveform-derived RMS, low-pass bass and high-pass treble'},null,2));
console.log('Audio envelopes: '+frames.length+' frames');
