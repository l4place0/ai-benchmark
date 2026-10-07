const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');process.chdir(root);const env={...process.env,TEMP:path.join(root,'temp'),TMP:path.join(root,'temp')};
function run(name,args){const r=spawnSync(path.join(root,'tools',name+'.exe'),args,{cwd:root,env,encoding:'utf8',maxBuffer:32*1024*1024,windowsHide:true});if(r.status!==0)throw Error(r.stderr);return r;}
const file='output/world.execute-me_1080p60.mp4';
const probe=JSON.parse(run('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]).stdout);
const v=probe.streams.find(s=>s.codec_type==='video'),a=probe.streams.find(s=>s.codec_type==='audio');
const checks={resolution:v.width===1920&&v.height===1080,constant60fps:v.r_frame_rate==='60/1'&&v.avg_frame_rate==='60/1',exactFrameCount:+v.nb_read_frames===12960,fullDuration:+probe.format.duration>=216,fullSongCovered:+a.duration>=212.288438,stereo:a.channels===2,compatiblePixelFormat:['yuv420p','yuvj420p'].includes(v.pix_fmt),audioCodec:a.codec_name==='aac',videoCodec:v.codec_name==='h264'};
const dec=run('ffmpeg',['-v','error','-i',file,'-f','null','-']);checks.completeDecodeWithoutErrors=dec.stderr.trim()==='';
const times=[1.5,5.5,9,14,18.5,25,31,34.5,38,42,47,54,61,69,76,84,91,99,107,114,121,130,137,144,150,156,160,166,173,180,188,199,209.5];
fs.mkdirSync('output/frames',{recursive:true});
for(let i=0;i<times.length;i++)run('ffmpeg',['-y','-v','error','-ss',String(times[i]),'-i',file,'-frames:v','1','-q:v','2',`output/frames/frame_${String(i).padStart(2,'0')}.jpg`]);
run('ffmpeg',['-y','-v','error','-framerate','1','-i','output/frames/frame_%02d.jpg','-vf','scale=384:216,tile=5x7:padding=4:margin=4:color=0x101818','-frames:v','1','-q:v','2','output/contact-sheet.jpg']);
fs.copyFileSync('output/frames/frame_04.jpg','output/cover.jpg');
const result={generated:new Date().toISOString(),file,duration:+probe.format.duration,width:v.width,height:v.height,fps:v.avg_frame_rate,frameCount:+v.nb_read_frames,videoCodec:v.codec_name,profile:v.profile,pixelFormat:v.pix_fmt,audioCodec:a.codec_name,audioSampleRate:a.sample_rate,audioChannels:a.channels,audioDuration:+a.duration,fileBytes:fs.statSync(file).size,checks,allPassed:Object.values(checks).every(Boolean),sampledTimes:times,sourceAudioSeconds:212.288438,shots:JSON.parse(fs.readFileSync('renders/shots.json')).length,probe};
fs.writeFileSync('output/verification.json',JSON.stringify(result,null,2));
const files=['src/film.js','src/three.module.js','src/RGBELoader.js','tools/render.cjs','tools/analyze.cjs','tools/verify.cjs','assets/song.wav','assets/envelope.json','assets/studio_small_09_1k.hdr',file];
fs.writeFileSync('output/checksums.sha256',files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')+'  '+f).join('\n')+'\n');
console.log(JSON.stringify({allPassed:result.allPassed,checks,frameCount:result.frameCount,duration:result.duration,fileBytes:result.fileBytes},null,2));if(!result.allPassed)process.exit(1);

