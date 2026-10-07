import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'research/references');fs.mkdirSync(folder,{recursive:true});
const sources=[
 ['sowiti-config.json','https://player.vimeo.com/video/317440324/config'],
 ['mag-config.json','https://player.vimeo.com/video/226712934/config'],
 ['growing-pains.html','https://directorsnotes.com/2018/07/17/alan-masferrer-growing-pains/'],
 ['wide-open.html','https://shots.net/news/view/89332-how-the-new-chemical-bros-promo-was-made'],
 ['mili-official.html','https://projectmili.com/miracle-milk-en/'],
 ['shelter-interview.html','https://girl.houyhnhnm.jp/en/culture/daoko_interviewed_with_porterrobinson_and_madeon.php']
];
await Promise.allSettled(sources.map(async([name,url])=>{
 const res=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if(!res.ok){console.log(name,res.status);return;}
 const body=await res.text();fs.writeFileSync(path.join(folder,name),body);
 if(name.endsWith('.json')){const j=JSON.parse(body);console.log(JSON.stringify({name,title:j.video?.title,duration:j.video?.duration,progressive:j.request?.files?.progressive?.map(x=>({quality:x.quality,url:x.url})),hls:j.request?.files?.hls?.cdns,thumb:j.video?.thumbs},null,2));}
 else console.log(name,body.length);
})).then(results=>results.forEach((r,i)=>{if(r.status==='rejected')console.log(sources[i][0],r.reason.message);}));
const stills=[
 ['growing-pains-1.jpg','https://directorsnotes.com/wp-content/uploads/2018/07/growing_pains_1.jpg'],
 ['growing-pains-2.jpg','https://directorsnotes.com/wp-content/uploads/2018/07/growing_pains_2.jpg'],
 ['growing-pains-4.jpg','https://directorsnotes.com/wp-content/uploads/2018/07/growing_pains_4.jpg'],
 ['growing-pains-5.jpg','https://directorsnotes.com/wp-content/uploads/2018/07/growing_pains_5.jpg'],
 ['mili-official-thumbnail.jpg','https://i.ytimg.com/vi/ESx_hy1n7HA/maxresdefault.jpg'],
 ['mochimikan-thumbnail.jpg','https://i.ytimg.com/vi/sNZUo2Oy3KQ/maxresdefault.jpg']
];
await Promise.allSettled(stills.map(async([name,url])=>{
 const res=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error(String(res.status));
 fs.writeFileSync(path.join(folder,name),Buffer.from(await res.arrayBuffer()));console.log(name);
}));
