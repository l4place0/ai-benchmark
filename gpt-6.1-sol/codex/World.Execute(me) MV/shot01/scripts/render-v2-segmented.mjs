import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.TEMP=process.env.TMP=path.join(root,'tmp');
const node=path.join(root,'tools/node/node.exe'),ff=path.join(root,'tools/ffmpeg/ffmpeg.exe'),fp=path.join(root,'tools/ffmpeg/ffprobe.exe');
const analysis=JSON.parse(fs.readFileSync(path.join(root,'assets/audio/analysis.json')));
const duration=Math.max(214,Math.ceil(analysis.duration*60)/60+2),totalFrames=Math.ceil(duration*60),size=1200,parts=Math.ceil(totalFrames/size),began=Date.now(),reports=[];
fs.mkdirSync(path.join(root,'logs/v2/parts'),{recursive:true});
function status(index,received,phase='render'){
 const completed=Math.min(totalFrames,index*size+received),s={phase,part:index+1,parts,completedFrames:completed,totalFrames,percent:+(completed/totalFrames*100).toFixed(1),updatedAt:new Date().toISOString()};
 fs.writeFileSync(path.join(root,'logs/v2/segmented-progress.json'),JSON.stringify(s));return s;
}
function probe(file){const p=spawnSync(fp,['-v','error','-select_streams','v:0','-show_streams','-of','json',file],{cwd:root,windowsHide:true,encoding:'utf8'});if(p.status!==0)throw Error(p.stderr);return JSON.parse(p.stdout).streams[0];}
for(let index=0;index<parts;index++){
 const name=`part-${String(index).padStart(2,'0')}`,start=index*size/60,frames=Math.min(size,totalFrames-index*size),seconds=frames/60;
 const output=path.join(root,`output/v2/qa/${name}_1080p60.mp4`),reportFile=path.join(root,`output/v2/qa/${name}-report.json`);
 let valid=false;
 if(fs.existsSync(output)&&fs.existsSync(reportFile)){try{const p=probe(output),r=JSON.parse(fs.readFileSync(reportFile)),gpuLog=fs.readFileSync(path.join(root,`logs/v2/parts/${name}-chrome.log`),'utf8');valid=Number(p.nb_frames)===frames&&p.avg_frame_rate==='60/1'&&p.width===1920&&p.height===1080&&r.start===start&&r.errors.length===0&&!gpuLog.includes('GPU process exited unexpectedly');}catch{}}
 if(!valid){
  console.log(`Rendering ${name}: ${start.toFixed(3)}–${(start+seconds).toFixed(3)} seconds, ${frames} frames.`);status(index,0);
  const log=fs.createWriteStream(path.join(root,`logs/v2/parts/${name}.log`));
  const child=spawn(node,[path.join(root,'scripts/render-v2.mjs'),'--sample','--start',String(start),'--duration',String(seconds),'--name',name],{cwd:root,windowsHide:true,env:{...process.env,MV_PORT:'9481',MV_PROFILE:`tmp/chrome-v2-${name}`}});
  let pending='';child.stdout.on('data',data=>{log.write(data);pending+=data.toString();let split;while((split=pending.indexOf('\n'))>=0){const line=pending.slice(0,split);pending=pending.slice(split+1);try{const m=JSON.parse(line);if(m.received){const s=status(index,m.received);if(m.received%600===0)console.log(JSON.stringify(s));}}catch{}}});child.stderr.on('data',d=>log.write(d));
  const exit=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});log.end();
  for(const file of ['chrome.log','encode.log'])if(fs.existsSync(path.join(root,`logs/v2/${file}`)))fs.copyFileSync(path.join(root,`logs/v2/${file}`),path.join(root,`logs/v2/parts/${name}-${file}`));
  if(exit!==0)throw Error(`${name} failed; see logs/v2/parts/${name}.log. Run this script again to resume completed parts.`);
  const gpuLog=fs.readFileSync(path.join(root,`logs/v2/parts/${name}-chrome.log`),'utf8');if(gpuLog.includes('GPU process exited unexpectedly'))throw Error(`${name} had a graphics process failure.`);
 }
 const p=probe(output),r=JSON.parse(fs.readFileSync(reportFile));
 if(Number(p.nb_frames)!==frames||p.avg_frame_rate!=='60/1'||r.errors.length)throw Error(`Invalid encoded segment: ${name}`);
 reports.push({...r,file:`qa/${name}_1080p60.mp4`,expectedFrames:frames});status(index,frames);console.log(`${name} verified: ${frames} frames.`);
}
// Strip per-segment AAC before concatenation. Otherwise its encoder pre-roll
// gives the concat input a negative start time and shifts the video by 23 ms.
const videoParts=path.join(root,'tmp/v2/video-parts');fs.mkdirSync(videoParts,{recursive:true});
for(let i=0;i<reports.length;i++){
 const part=path.join(videoParts,`part-${String(i).padStart(2,'0')}.mp4`);
 const clean=spawnSync(ff,['-y','-hide_banner','-loglevel','error','-i',path.join(root,'output/v2',reports[i].file),'-map','0:v:0','-an','-c:v','copy',part],{cwd:root,windowsHide:true,encoding:'utf8'});
 if(clean.status!==0)throw Error(`Video-only segment remux failed: ${clean.stderr}`);
}
const concat=path.join(root,'output/v2/concat.txt');fs.writeFileSync(concat,reports.map((r,i)=>`file '../../tmp/v2/video-parts/part-${String(i).padStart(2,'0')}.mp4'`).join('\n')+'\n');
status(parts-1,reports.at(-1).frames,'mux');
console.log('Joining exact video segments and encoding the original full stereo track once.');
const out=path.join(root,'output/v2/world-execute-me_paper-theatre_1080p60.mp4');
const mux=spawn(ff,['-y','-hide_banner','-loglevel','warning','-f','concat','-safe','0','-i',concat,'-i',path.join(root,'assets/audio/source/audio.mp3'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-af','apad','-t',String(duration),'-movflags','+faststart',out],{cwd:root,windowsHide:true});
const muxLog=fs.createWriteStream(path.join(root,'logs/v2/mux.log'));mux.stderr.pipe(muxLog);const muxExit=await new Promise((resolve,reject)=>{mux.on('error',reject);mux.on('close',resolve);});if(muxExit!==0)throw Error(`Final mux failed: ${muxExit}`);
const final=probe(out);if(Number(final.nb_frames)!==totalFrames||final.avg_frame_rate!=='60/1')throw Error('Final concatenated frame count or rate differs.');
const result={width:1920,height:1080,fps:60,frames:totalFrames,duration,songDuration:analysis.duration,elapsedSeconds:(Date.now()-began)/1000,segmentRenderSeconds:reports.reduce((sum,r)=>sum+r.elapsedSeconds,0),errors:[],source:'Browser Canvas 2D; original articulated paper theatre; deterministic frame timestamps',method:'Independent 1200-frame browser sessions; video-only concatenation without re-encoding; one full-length audio encode',segments:reports};
fs.writeFileSync(path.join(root,'output/v2/render-report.json'),JSON.stringify(result,null,2));status(parts-1,reports.at(-1).frames,'complete');console.log('Full V2 render completed.',{frames:totalFrames,duration,parts,elapsedSeconds:result.elapsedSeconds});
