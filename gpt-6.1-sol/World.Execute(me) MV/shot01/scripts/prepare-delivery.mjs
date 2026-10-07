import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.env.TEMP=process.env.TMP=path.join(root,'tmp');
const selected=[1.8,18,31.5,38.5,47,62,83,108,114,129,145,160,173,183,200,209.5];
const contact=path.join(root,'tmp/contact');fs.mkdirSync(contact,{recursive:true});
for(let i=0;i<selected.length;i++)fs.copyFileSync(path.join(root,`output/qa/frame_${selected[i].toFixed(3).replace('.','_')}.png`),path.join(contact,`frame_${String(i).padStart(2,'0')}.png`));
const r=spawnSync(path.join(root,'tools/ffmpeg/ffmpeg.exe'),['-v','error','-y','-framerate','1','-i','tmp/contact/frame_%02d.png','-vf','scale=480:270,tile=4x4:padding=8:margin=8:color=0x071216','-frames:v','1','-q:v','2','output/contact-sheet.jpg'],{cwd:root,windowsHide:true,encoding:'utf8'});
if(r.status!==0)throw Error(r.stderr);
const entries=[
 {file:'assets/audio/original.osz',source:'https://assets.ppy.sh/artists/331/Miracle%20Milk/Mili%20-%20world.execute(me)%3B.osz',credit:'Mili, original Miracle Milk recording; rights retained by owners'},
 {file:'assets/audio/source/audio.mp3',source:'Extracted from original.osz',credit:'Mili'},
 {file:'assets/textures/cosmic-cliffs.png',source:'https://assets.science.nasa.gov/dynamicimage/assets/science/missions/webb/science/2022/07/STScI-01GA6KKWG229B16K4Q38CH3BXS.png?fit=clip&w=2000',credit:'NASA, ESA, CSA, STScI'},
 {file:'assets/fonts/CormorantGaramond.ttf',source:'https://github.com/google/fonts/tree/main/ofl/cormorantgaramond',licence:'SIL OFL'},
 {file:'assets/fonts/IBMPlexMono.ttf',source:'https://github.com/google/fonts/tree/main/ofl/ibmplexmono',licence:'SIL OFL'},
 {file:'tools/three/package/build/three.module.js',source:'https://registry.npmjs.org/three/-/three-0.180.0.tgz',licence:'MIT',version:'0.180.0'},
 {file:'tools/chrome/chrome-headless-shell-win64/chrome-headless-shell.exe',source:'https://storage.googleapis.com/chrome-for-testing-public/155.0.8059.39/win64/chrome-headless-shell-win64.zip',version:'155.0.8059.39'},
 {file:'tools/node/node.exe',source:'Copied from existing local runtime',version:'26.4.0'},
 {file:'tools/ffmpeg/ffmpeg.exe',source:'Copied from existing local FFmpeg distribution'},
 {file:'src/mv.js',source:'Original project source'},
 {file:'src/index.html',source:'Original project source'},
 {file:'scripts/render.mjs',source:'Original project source'}
];
for(const entry of entries){const file=path.join(root,entry.file);entry.bytes=fs.statSync(file).size;const hash=crypto.createHash('sha256');for await(const block of fs.createReadStream(file))hash.update(block);entry.sha256=hash.digest('hex');}
fs.writeFileSync(path.join(root,'output/provenance.json'),JSON.stringify({project:'GLASS GARDEN',root,generated:new Date().toISOString(),entries},null,2));
console.log('Contact sheet and asset provenance ready.');
