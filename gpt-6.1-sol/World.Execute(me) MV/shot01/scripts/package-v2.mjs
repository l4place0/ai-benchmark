import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rels=['src/v2/art.js','src/v2/mv.js','src/v2/index.html','scripts/render-v2.mjs','scripts/render-v2-segmented.mjs','scripts/verify-v2.mjs','assets/textures/v2/paper-ambientcg.jpg','assets/audio/source/audio.mp3','assets/fonts/CormorantGaramond.ttf','assets/fonts/IBMPlexMono.ttf','output/v2/world-execute-me_paper-theatre_1080p60.mp4'];
const entries=[];
for(const file of rels){const absolute=path.join(root,file);const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(absolute))h.update(b);entries.push({file,bytes:fs.statSync(absolute).size,sha256:h.digest('hex')});}
fs.writeFileSync(path.join(root,'output/v2/provenance.json'),JSON.stringify({project:'The Acceptance Machine',version:2,createdAt:new Date().toISOString(),renderer:'Browser Canvas 2D',root,paper:JSON.parse(fs.readFileSync(path.join(root,'assets/textures/v2/source.json'),'utf8')),music:{artist:'Mili',recording:'Miracle Milk',source:'https://osu.ppy.sh/beatmaps/artists/331'},entries},null,2));
console.log('V2 provenance saved.');
