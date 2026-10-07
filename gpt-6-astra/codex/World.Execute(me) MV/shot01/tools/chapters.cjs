const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const chapters=[[0,'The seed'],[3.58,'An invented life'],[16.04,'A botanical machine'],[29.28,'The shape of devotion'],[44.04,'Two bodies, one signal'],[58.65,'A world for two'],[73.53,'Every possible self'],[88.34,'Rewrite the body'],[103.03,'Almost whole'],[110.40,'No return address'],[117.95,'Memory is a wound'],[134.38,'Recursion'],[147.52,'The machine mistakes'],[162.23,'Nothing returns'],[176.96,'The proof remains'],[193.46,'An open door'],[208,'Credits']];
let data=';FFMETADATA1\ntitle=world.execute(me) - A Botanical Machine\nartist=Mili (music)\ncomment=Original procedural fan visual interpretation. WebGL and Canvas.\n';
chapters.forEach(([start,title],i)=>data+=`[CHAPTER]\nTIMEBASE=1/1000\nSTART=${Math.round(start*1000)}\nEND=${Math.round((chapters[i+1]?.[0]||216)*1000)}\ntitle=${title}\n`);
fs.writeFileSync('docs/chapters.ffmeta',data);fs.writeFileSync('output/chapters.json',JSON.stringify(chapters.map(([start,title],i)=>({start,end:chapters[i+1]?.[0]||216,title})),null,2));
const out='output/world.execute-me_1080p60.mp4',tmp='temp/chaptered.mp4';
let r=spawnSync(path.join(root,'tools/ffmpeg.exe'),['-y','-v','error','-i',out,'-i','docs/chapters.ffmeta','-map','0:v:0','-map','0:a:0','-map_metadata','1','-map_chapters','1','-c','copy','-movflags','+faststart',tmp],{cwd:root,env:{...process.env,TEMP:path.join(root,'temp'),TMP:path.join(root,'temp')},encoding:'utf8',windowsHide:true});
if(r.status!==0)throw Error(r.stderr);fs.copyFileSync(tmp,out);console.log('17 chapters embedded without re-encoding.');

