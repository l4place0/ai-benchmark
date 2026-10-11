import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.TEMP=process.env.TMP=path.join(root,'tmp');
const ff=path.join(root,'tools/ffmpeg/ffmpeg.exe'),fp=path.join(root,'tools/ffmpeg/ffprobe.exe');
const file=path.join(root,'output/world-execute-me_1080p60.mp4');
function run(exe,args){const r=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status!==0)throw Error(r.stderr||`Exit ${r.status}`);return r;}
const meta=JSON.parse(run(fp,['-v','error','-show_format','-show_streams','-of','json',file]).stdout);
const video=meta.streams.find(s=>s.codec_type==='video'),audio=meta.streams.find(s=>s.codec_type==='audio');
const report=JSON.parse(fs.readFileSync(path.join(root,'output/render-report.json')));
if(video.width!==1920||video.height!==1080||video.avg_frame_rate!=='60/1'||video.r_frame_rate!=='60/1')throw Error('Unexpected video specification');
if(Number(video.nb_frames)!==report.frames)throw Error('Encoded frame count differs from rendered frame count');
if(Number(video.duration)<report.songDuration)throw Error('Video does not cover the song');
if(!audio||audio.channels!==2)throw Error('Stereo audio missing');
console.log('Media specifications passed. Decoding the complete film.');
const decode=run(ff,['-v','error','-i',file,'-map','0:v:0','-map','0:a:0','-f','null','-']);
run(ff,['-v','error','-y','-i',file,'-map','0:a:0','-ac','1','-ar','12000','-f','f32le','tmp/final-audio.f32']);
function floats(relative){const b=fs.readFileSync(path.join(root,relative));return new Float32Array(b.buffer,b.byteOffset,b.length/4)}
const source=floats('tmp/analysis.f32'),final=floats('tmp/final-audio.f32');
// Find actual audio offset across a +/-50 ms window; skip padding and credits.
let best={lag:0,correlation:-1};
const start=12000*5,end=Math.min(source.length,12000*200),step=17;
for(let lag=-600;lag<=600;lag++){
 let xy=0,xx=0,yy=0;
 for(let i=start;i<end;i+=step){const x=source[i],y=final[i+lag]||0;xy+=x*y;xx+=x*x;yy+=y*y}
 const correlation=xy/Math.sqrt(xx*yy);if(correlation>best.correlation)best={lag,correlation};
}
if(best.correlation<.98||Math.abs(best.lag)>120)throw Error(`Audio synchronization check failed: ${JSON.stringify(best)}`);
console.log('Full decode and audio correlation passed.',best);
// Decode three adjacent frames at four representative musical epochs.
// Raw SHA-256 fingerprints verify that 60 FPS contains changing frames.
const motion=[];
for(const t of [18,62,150,200]){
 const raw=path.join(root,`tmp/motion-${t}.rgb`);
 run(ff,['-v','error','-y','-ss',String(t),'-i',file,'-frames:v','3','-vf','scale=320:180','-pix_fmt','rgb24','-f','rawvideo',raw]);
 const b=fs.readFileSync(raw),stride=320*180*3,hashes=[];
 for(let i=0;i<3;i++)hashes.push(crypto.createHash('sha256').update(b.subarray(i*stride,(i+1)*stride)).digest('hex'));
 if(new Set(hashes).size!==3)throw Error(`Duplicate adjacent frames at ${t}s`);
 motion.push({time:t,uniqueAdjacentFrames:3,hashes});
}
const selected=[1.8,18,31.5,38.5,47,62,83,108,114,129,145,160,173,183,200,209.5];
const contact=path.join(root,'tmp/contact');fs.mkdirSync(contact,{recursive:true});
for(let i=0;i<selected.length;i++)fs.copyFileSync(path.join(root,`output/qa/frame_${selected[i].toFixed(3).replace('.','_')}.png`),path.join(contact,`frame_${String(i).padStart(2,'0')}.png`));
run(ff,['-v','error','-y','-framerate','1','-i','tmp/contact/frame_%02d.png','-vf','scale=480:270,tile=4x4:padding=8:margin=8:color=0x071216','-frames:v','1','-q:v','2','output/contact-sheet.jpg']);
// Extract real encoded frames for visual comparison, rather than source canvases.
for(const t of [18,62,114,150,200,209.5])run(ff,['-v','error','-y','-ss',String(t),'-i',file,'-frames:v','1',`output/qa/encoded_${String(t).replace('.','_')}.png`]);
const versions={node:process.version,ffmpeg:run(ff,['-version']).stdout.split('\n')[0],ffprobe:run(fp,['-version']).stdout.split('\n')[0],chrome:'155.0.8059.39',three:'0.180.0'};
const digest=crypto.createHash('sha256');for await(const block of fs.createReadStream(file))digest.update(block);
const verification={passed:true,width:video.width,height:video.height,fps:video.avg_frame_rate,frameCount:Number(video.nb_frames),videoDuration:Number(video.duration),songDuration:report.songDuration,audioDuration:Number(audio.duration),audioChannels:audio.channels,audioCodec:audio.codec_name,audioSampleRate:audio.sample_rate,videoCodec:video.codec_name,pixelFormat:video.pix_fmt,sizeBytes:fs.statSync(file).size,completeDecode:{passed:decode.status===0,errors:decode.stderr.trim()},audioSynchronization:{offsetSamples:best.lag,offsetMilliseconds:best.lag/12,correlation:best.correlation},motion,versions,sha256:digest.digest('hex')};
fs.writeFileSync(path.join(root,'output/verification.json'),JSON.stringify(verification,null,2));
console.log(JSON.stringify(verification,null,2));
