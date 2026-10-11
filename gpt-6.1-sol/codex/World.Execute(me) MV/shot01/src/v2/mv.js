import {C,clamp,mix,ease,span,fract,rnd,TAU,initialize,pattern,path,cut,poly,ellipse,rect,stroke,curve,label,seam,rivet,pose,puppet,ribbon,plant,bird,gear,house,door,scissor,heart,frameRect} from './art.js';

const W=1920,H=1080,screen=document.querySelector('#screen'),ctx=screen.getContext('2d',{alpha:false,willReadFrequently:false,desynchronized:true});
const [analysis,config]=await Promise.all([fetch('../../assets/audio/analysis.json').then(r=>r.json()),fetch('/config').then(r=>r.json())]);
await Promise.all([document.fonts.load('70px Cormorant'),document.fonts.load('16px Plex')]);
const paper=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Local paper texture missing'));im.src='../../assets/textures/v2/paper-ambientcg.jpg';});
initialize(ctx,paper);
const beat=t=>(t-.213)*130/60;
const beatPulse=t=>Math.exp(-fract(beat(t))*9);
const smoothPulse=(t,a,b)=>span(t,a,a+.3)*(1-span(t,b-.3,b));
const shots=[
 [0,3.873,'assembly','First thread',960,570,1.12],
 [3.873,7.446,'assembly','The joints awaken',1070,560,1.42],
 [7.446,11.095,'assembly','A body becomes a subject',960,550,1.15],
 [11.095,14.6,'assembly','First autonomous gaze',980,530,1.06],
 [14.6,22,'meeting','The invitation',960,535,1.02],
 [22,25.2,'meeting','Answering the invitation',960,590,1.27],
 [25.2,27.4,'meeting','The receiver answers with a look',1180,510,2.05],
 [27.4,29.709,'meeting','A shared step',960,590,1.29],
 [29.709,33.412,'points','A gift of stepping stones',960,540,1.02],
 [33.412,37.067,'circle','A gift of a bridge',1000,555,1.08],
 [37.067,40.706,'sine','A shared elastic seat',1010,560,1.14],
 [40.706,44.452,'limit','A frame becomes a boundary',1060,560,1.05],
 [44.452,51.363,'polarity','A reversible dance',960,540,1.01],
 [51.363,59.223,'time','The room changes with the clock',960,550,1.03],
 [59.223,66.601,'home','A house for two',960,540,1.02],
 [66.601,74.045,'home-thread','The house is attached',1120,620,1.4],
 [74.045,78.058,'eggplant','Becoming a gift',1000,590,1.18],
 [78.058,81.351,'tomato','The gift repeats',1000,590,1.18],
 [81.351,85.078,'cat','A playful new body',960,575,1.18],
 [85.078,88.587,'god','The giver operates the world',960,500,.96],
 [88.587,95.465,'identity','Exchanging appearances',960,550,1.12],
 [95.465,103.489,'roles','Exchanging the lead',960,545,1.04],
 [103.489,108,'completion','An invitation without an answer',960,575,1.13],
 [108,110.9,'completion','The receiver looks beyond the stage',1310,515,1.95],
 [110.9,118.333,'leave','The other makes a choice',1060,570,1.00],
 [118.333,121.8,'erase','Cutting the memory',960,550,1.1],
 [121.8,125.708,'erase','The cutting hand and disappearing silhouettes',1250,730,1.92],
 [125.708,133.5,'argument','Closing the open door',1070,560,1.08],
 [133.5,140.884,'reset','Taking over the crank',960,575,1.05],
 [140.884,147.66,'reset-close','Rebuilding a missing answer',1000,550,1.3],
 [147.66,153.2,'execute','The first failed restoration',960,550,1.00],
 [153.2,158.9,'execute','Restoration consumes its maker',950,570,1.17],
 [158.9,162.632,'count','Six residues',960,540,.97],
 [162.632,169.824,'execute','The invitation becomes compulsion',960,560,1.00],
 [169.824,177.246,'ghost','Mistaking a stencil for a person',1010,575,1.09],
 [177.246,183,'algebra','All the correct positions',960,540,.99],
 [183,188.483,'algebra-close','The empty second position',1015,552,2.08],
 [188.483,195.5,'outside','Two sides of the same doorway',960,540,.98],
 [195.5,205.811,'solo','The old dance continues alone',780,585,1.12],
 [205.811,209.1,'press','The final operation',960,550,1.07],
 [209.1,212.362449,'residue','A trace becomes another beginning',990,560,1.21],
 [212.362449,214.366667,'credits','The theatre closes',960,540,1]
].map(([s,e,id,event,cx,cy,z])=>({s,e,id,event,cx,cy,z}));
window.shots=shots;

function shotAt(t){return shots.find(s=>t>=s.s&&t<s.e)||shots.at(-1);}
function getWorld(t){
 const after=span(t,109,123),pressure=span(t,132,151)*(1-span(t,177,189));
 return{after,pressure,pulse:beatPulse(t),amp:analysis.features[Math.min(analysis.frames-1,Math.max(0,Math.floor(t*60)))]?.[0]||0};
}
function worldCamera(s,t){
 const q=clamp((t-s.s)/(s.e-s.s)),f=ease(q);
 let cx=s.cx+Math.sin(t*.17)*9,cy=s.cy+Math.cos(t*.13)*5,z=s.z*(1+f*.022),roll=0;
 if(s.id==='polarity')roll=Math.sin((t-44.452)/6.911*Math.PI)*.12;
 if(s.id==='god'){z=mix(1.17,.85,ease(q));cy=mix(600,475,f);}
 if(s.id==='outside')z=mix(1.04,.9,f);
 if(s.id==='solo')cx=mix(950,680,f);
 if(s.id==='press'){cy=mix(560,610,f);z=mix(1.05,1.2,f);}
 ctx.translate(W/2,H/2);ctx.rotate(roll);ctx.scale(z,z);ctx.translate(-cx,-cy);
}
function sky(t,st,{night=false,outside=false}={}){
 ctx.fillStyle=pattern(night?C.blue:C.pale);ctx.fillRect(-800,-700,3500,2400);
 if(outside){ctx.fillStyle=pattern(C.cream);ctx.fillRect(940,-600,1900,2300);}
 ellipse(1260,335,250,250,night?C.cream:C.gold,{shadow:0,edge:0,alpha:night?.55:.65});
 for(let i=0;i<6;i++){
  const x=230+i*290+Math.sin(t*.11+i)*23,y=210+(i%3)*65;
  ctx.save();ctx.translate(x,y);ctx.rotate((i%2?1:-1)*.08);poly([[-85,12],[-100,-6],[-61,-27],[-32,-15],[-12,-46],[24,-48],[60,-13],[96,-7],[100,14]],night?C.blueLight:C.white,{shadow:5,edge:0,alpha:.62});seam([[-77,4],[78,4]],'#203b4735');ctx.restore();
 }
 for(let i=0;i<22;i++){const x=100+rnd(i+1200)*1700,y=75+rnd(i+1800)*580;ctx.save();ctx.globalAlpha=night?.6:.3;stroke([[x-4,y],[x+4,y]],C.cream,1);stroke([[x,y-4],[x,y+4]],C.cream,1);ctx.restore();}
}
function stage(t,st,{open=1,home=false,night=false,outside=false,bare=false}={}){
 sky(t,st,{night,outside});
 poly([[-500,850],[650,714],[1350,714],[2480,850],[2480,1480],[-500,1480]],night?C.dark:C.cream,{shadow:15,edge:1});
 for(let i=-3;i<=10;i++)stroke([[960,712],[-350+i*285,1250]],night?'#b8c5b033':'#203b472a',1.6);
 for(let i=0;i<5;i++)stroke([[-350,800+i*i*38],[2300,800+i*i*38]],night?'#b8c5b025':'#203b4725',1.2);
 if(!bare){
  const curtain=mix(550,130,open);
  for(const side of [-1,1]){const x=side<0?95:1825;ctx.save();ctx.translate(x,0);ctx.scale(side<0?1:-1,1);poly([[-160,-150],[curtain,-150],[curtain*.93,215],[curtain*.74,440],[curtain*.7,845],[-150,1040]],night?C.rust:C.blue,{shadow:16,edge:2});for(let i=0;i<8;i++)curve([[i*curtain/8,-80],[i*curtain/8+18,160],[i*curtain/8-24,500],[i*curtain/8*.7,860]],'#f8efd933',2);ribbon({x:-80,y:440},{x:curtain*.72,y:450},t,{width:18,sag:9,color:C.gold});ctx.restore();}
  poly([[-100,-70],[2020,-70],[2020,60],[1710,90],[1460,73],[1190,100],[960,70],[690,100],[390,75],[150,97],[-100,60]],night?C.rust:C.blue,{shadow:12});
  seam([[20,38],[400,51],[950,46],[1510,45],[1910,32]],C.cream,2);
  for(let i=0;i<15;i++)rivet(90+i*122,64+Math.sin(i)*7,4);
 }
 if(home)house(965,810,640,510,1);
 if(!bare)for(const side of [-1,1])for(let i=0;i<3;i++)plant(side<0?235-i*85:1710+i*86,930+i*38,.8+i*.18,t,night?C.blueLight:i%2?C.mint:C.blue,{flower:i!==1});
}
function pair(t,{x1=705,x2=1210,y=850,s=1.56,r1=1,r2=1,dance=0,walk=0,sad=0,damage=0,ghost=0,cat=false,swap=false}={}){
 const mePose=pose(t,{reach:r1,dance,walk,sad,gaze:1});
 const youPose=pose(t-.21,{reach:r2,dance,walk,gaze:1,phase:.7});
 const a=puppet(x1,y,s,mePose,'me',{damage,cat,swap});
 const b=puppet(x2,y,s,youPose,'you',{alpha:ghost?ghost:1,swap});
 return{a,b,mePose,youPose};
}
function invitation(t,start,{empty=false,damage=0,x1=705,x2=1210,s=1.56,y=850,loop=false}={}){
 const local=loop?((t-start)%7.385+7.385)%7.385:t-start;
 const offer=span(local,.2,1.2),answer=span(local,1.9,3.1),dance=smoothPulse(local,3.2,6.8);
 const a=puppet(x1,y,s,pose(t,{reach:offer,dance:empty?0:dance,sad:empty?.24:0,head:empty?-.12:.1}), 'me',{damage});
 let b;
 if(!empty)b=puppet(x2,y,s,pose(t-.16,{reach:answer,dance,gaze:1}), 'you');
 else{ctx.save();ctx.globalAlpha=.18;stroke([[x2-74,y+8],[x2+74,y+8]],C.coral,3,[5,10]);ctx.restore();}
 if(b)ribbon(a.right,b.right,t,{width:12,sag:mix(170,50,answer),color:C.coral});
 else ribbon(a.right,{x:x2-115*s,y:y-169*s},t,{width:12,sag:170+local*5,color:C.coral});
 return{a,b};
}

function assembly(t,st){
 ctx.fillStyle=pattern(C.cream);ctx.fillRect(-500,-500,3000,2200);
 const grid=48;for(let x=-100;x<2100;x+=grid)stroke([[x,-200],[x,1300]],'#467b8b18',.8);for(let y=-100;y<1300;y+=grid)stroke([[-300,y],[2300,y]],'#467b8b18',.8);
 frameRect(320,305,1280,570,C.blue);
 for(let i=0;i<18;i++){stroke([[350+i*67,324],[350+i*67,339+(i%3===0?10:0)]],C.blue,1);label(String(i*5),350+i*67,368,10,C.blue);}
 gear(255,820,123,t*.26,C.gold);gear(1690,330,86,-t*.37,C.coral);
 const rise=span(t,11.095,14.5),x=mix(1175,965,rise),y=mix(590,822,rise),rotation=mix(-Math.PI/2,0,rise);
 const body=puppet(x,y,1.58,pose(t,{head:span(t,8.1,10.4)*.2,gaze:mix(-1,1,span(t,8,11))}), 'me',{rotate:rotation,noShadow:true,strings:rise<.85});
 const loaded=span(t,0,3.6);
 ribbon({x:245,y:430},{x:mix(760,body.chest.x,loaded),y:mix(390,body.chest.y,loaded)},t,{width:13,sag:50,color:C.coral});
 for(let i=0;i<6;i++){const q=span(t,i*1.7,i*1.7+.65);rivet(760+i*84,560+(i%2)*42,9*q+.01);seam([[760+i*84,575],[760+i*84,641]],C.blue);}
 // Moving plotter, spool and the first lifted gaze establish a physical workshop.
 rect(280,152,1360,35,C.ink,{shadow:6});const px=mix(455,1470,fract(beat(t)/16));rect(px-25,154,50,92,C.gold,{shadow:7});poly([[px-5,246],[px+5,246],[px,480]],C.ink,{shadow:2});
 for(let i=0;i<3;i++)ellipse(240,405,76-i*14,76-i*14,i%2?C.coral:C.gold,{shadow:3});rivet(240,405,13);
 scissor(1570,800,1.2,-.34,span(t,5,7));
 label('01',374,804,54,C.coral,'Cormorant');label('OBJECT / PAPER',1418,836,13,C.blue);
 if(t<3.8){ctx.save();ctx.globalAlpha=smoothPulse(t,.3,3.6);label('THE ACCEPTANCE MACHINE',960,104,21,C.ink);ctx.restore();}
}
function meeting(t,st){stage(t,st,{open:span(t,14.6,17)});const enter=span(t,14.6,18),x1=mix(300,705,enter),x2=mix(1640,1210,enter);invitation(t,18,{x1,x2,loop:t>=22});bird(mix(1420,1130,span(t,23,28)),350,1,t,C.white);
 if(t>17.7&&t<21.8){ctx.save();ctx.globalAlpha=smoothPulse(t,17.8,21.7);label('world.execute(me);',960,246,85,C.ink,'Cormorant');label('MILI  /  AN ORIGINAL FAN FILM',960,286,15,C.blue);ctx.restore();}
}
function mathematics(t,st,id){
 stage(t,st,{bare:true});const shot=shotAt(t),q=clamp((t-shot.s)/(shot.e-shot.s));
 // The same material becomes different ways of supporting the other.
 if(id==='points'){
  for(let i=0;i<7;i++){const pop=span(q,i*.055,i*.055+.12);rect(560+i*110,815-Math.sin(i*.58)*100,85*pop,25,C.gold,{shadow:8});}
  const a=puppet(465,865,1.45,pose(t,{reach:.75,head:.1}), 'me');const step=beat(t)%4;
  const xx=mix(760,1240,ease(q)),yy=810-Math.sin((xx-560)/110*.58)*100-Math.abs(Math.sin(step*Math.PI))*26;
  const b=puppet(xx,yy,1.35,pose(t,{walk:1,gaze:q>.75?-1:1}), 'you',{facing:q>.75?-1:1});ribbon(a.right,b.left,t,{width:14,sag:75});
  for(let i=0;i<30;i++)ellipse(500+rnd(i+60)*925,350+rnd(i+80)*270,3,3,C.blue,{shadow:0,edge:0,alpha:span(q,.1,.6)});
 }else if(id==='circle'){
  const r=230;ctx.save();ctx.translate(1010,720);ctx.rotate(q*.17);const p=path([['moveTo',-300,0],['bezierCurveTo',-260,-310,260,-310,300,0],['lineTo',275,15],['bezierCurveTo',230,-268,-230,-268,-275,15],['closePath']]);cut(p,C.coral,{shadow:10});seam([[-300,0],[-280,-80],[-210,-180],[-100,-245],[0,-266],[100,-245],[210,-180],[280,-80],[300,0]],C.cream);ctx.restore();
  const xx=mix(825,1240,ease(q)),u=(xx-1010)/300,yy=725-Math.sqrt(Math.max(0,1-u*u))*220;
  puppet(xx,yy,1.21,pose(t,{walk:1}), 'you',{facing:q<.8?1:-1});const a=puppet(515,865,1.49,pose(t,{reach:1}), 'me');ribbon(a.right,{x:750,y:720},t,{width:15,sag:55});
 }else if(id==='sine'){
  const pts=[];for(let i=0;i<=80;i++)pts.push([390+i*14,720+Math.sin(i/80*TAU*1.4+t*1.7)*57]);stroke(pts,'#203b4735',28);stroke(pts,C.coral,20);stroke(pts,C.cream,1.8,[4,9]);
  const yy=720+Math.sin(.57*TAU*1.4+t*1.7)*57;
  const p=pose(t,{dance:.55,reach:.4});p.lf.y=-38;p.rf.y=-38;p.lf.x=-70;p.rf.x=65;
  puppet(1030,yy,1.5,p,'you');puppet(610,840,1.5,pose(t,{reach:1,lean:-.1}), 'me');
  for(let i=0;i<3;i++)bird(500+i*440,285+i*50,.55,t+i);
 }else{
  const a=puppet(685,850,1.56,pose(t,{reach:1}), 'me');const bx=mix(1210,1380,ease(q));const b=puppet(bx,850,1.56,pose(t,{walk:.5,gaze:1}), 'you',{facing:1});
  ribbon(a.right,b.left,t,{width:14,sag:90});const edge=mix(1630,1420,ease(q));rect(edge,250,18,610,C.coral,{shadow:7});rect(edge-240,250,255,18,C.coral,{shadow:4});rect(edge-240,855,255,18,C.coral,{shadow:4});
  // The receiver tests the frame rather than remaining an orbiting symbol.
  if(q>.65){const p=pose(t,{reach:1,lean:.05});p.rh={x:83,y:-200};puppet(bx,850,1.56,p,'you',{facing:1});}
 }
}
function polarity(t,st){
 stage(t,st,{bare:true});const q=clamp((t-44.452)/6.911),turn=span(q,.27,.65);
 for(let i=0;i<4;i++){ctx.save();ctx.translate(330+i*400,395);ctx.rotate((i%2?1:-1)*turn*Math.PI);poly([[-145,-105],[145,-105],[180,105],[-180,105]],i%2?C.gold:C.blueLight,{shadow:12});seam([[0,-105],[0,105]],C.cream);ctx.restore();}
 const p=pair(t,{dance:.9,r1:.55,r2:.7,swap:turn>.5,x1:mix(705,1150,turn),x2:mix(1210,760,turn)});
 ribbon(p.a.right,p.b.right,t,{width:14,sag:120,color:C.coral});
}
function timeRoom(t,st){
 stage(t,st);const q=clamp((t-51.363)/7.86);
 for(let i=0;i<3;i++){const x=500+i*470,y=310+(i%2)*40;ellipse(x,y,113,113,C.white,{shadow:12});for(let k=0;k<12;k++){const a=k/12*TAU;stroke([[x+Math.sin(a)*85,y-Math.cos(a)*85],[x+Math.sin(a)*94,y-Math.cos(a)*94]],C.ink,2);}const a=t*(i===1?-.42:.42);stroke([[x,y],[x+Math.sin(a)*68,y-Math.cos(a)*68]],C.blue,6);stroke([[x,y],[x+Math.sin(a*.23)*45,y-Math.cos(a*.23)*45]],C.coral,8);rivet(x,y,8);}
 const p=pair(t,{dance:.7,x1:730+Math.sin(q*TAU)*110,x2:1190-Math.sin(q*TAU)*100});ribbon(p.a.right,p.b.right,t,{width:14,sag:70});
}
function homeScene(t,st,detail=false){
 stage(t,st,{home:true});const lift=span(t,59.223,61.2),p=pair(t,{x1:detail?760:mix(705,820,lift),x2:detail?1170:mix(1210,1110,lift),s:detail?1.5:1.35,dance:detail?.2:.55,r1:detail?.45:.58,r2:detail?span(t,67.7,70.5):.6,y:850});
 ribbon(p.a.right,p.b.right,t,{width:11,sag:60});
 // Material trail is visible, not revealed only by a written explanation.
 ribbon({x:810,y:690},{x:1455,y:885},t,{width:19,sag:140,color:C.coral});
 for(let i=0;i<4;i++){const xx=1230+i*70,yy=870+Math.sin(i)*20;seam([[xx-13,yy],[xx+13,yy]],C.cream,2);}
 if(detail){const touch=span(t,67.7,70.5);ribbon(p.b.right,{x:1120,y:750},t,{width:17,sag:mix(80,150,touch)});}
}
function fruit(t,st,id){
 stage(t,st,{bare:true});const q=(t-shotAt(t).s)/(shotAt(t).e-shotAt(t).s),gift=span(q,.08,.5);
 puppet(670,850,1.61,pose(t,{reach:1,dance:.35}), 'me',{alpha:1-gift});const yy=655-Math.sin(q*Math.PI)*95;
 ctx.save();ctx.globalAlpha=gift;ctx.translate(mix(670,995,gift),yy);ctx.rotate(Math.sin(t*2)*.1);ctx.scale(mix(.8,1.8,gift),mix(1.3,1.8,gift));
 if(id==='eggplant'){cut(path([['moveTo',0,-62],['bezierCurveTo',70,-45,71,72,5,88],['bezierCurveTo',-45,88,-51,30,0,-62],['closePath']]),'#69788a',{shadow:9});poly([[-31,-50],[-11,-70],[0,-85],[12,-67],[36,-41],[6,-53],[-11,-39]],C.mint,{shadow:3});}
 else{ellipse(0,15,66,62,C.coral,{shadow:9});for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*TAU/5);poly([[0,-15],[-9,-50],[0,-68],[12,-38]],C.mint,{shadow:2});ctx.restore();}}
 for(const ex of [-15,15]){ellipse(ex,4,6,4,C.white,{shadow:0,edge:1});ellipse(ex+2,4,2,2.7,C.ink,{shadow:0,edge:0});}curve([[-9,21],[-3,28],[5,28],[12,20]],C.ink,1.4);
 ctx.restore();
 const p=pose(t-.13,{reach:gift,dance:.4});p.rh={x:mix(60,130,gift),y:mix(-115,-153,gift)};puppet(1250,850,1.6,p,'you');
 for(let i=0;i<7;i++){ctx.save();ctx.translate(475+i*157,350+Math.sin(i*.8+t)*22);ctx.rotate(i*.21);poly([[-18,-18],[18,-18],[18,18],[-18,18]],i%2?C.gold:C.blueLight,{shadow:3});ctx.restore();}
}
function catScene(t,st){stage(t,st);const p=pose(t,{dance:.8,reach:.8,head:.13});p.lf={x:-58,y:-3};p.rf={x:50,y:-5};const a=puppet(785,842,1.62,p,'me',{cat:true});const b=puppet(1200,850,1.54,pose(t,{reach:.8,dance:.3,head:.2}), 'you');ribbon(a.right,b.right,t,{width:10,sag:74});curve([[710,760],[520,810],[520,624],[648,641]],C.blue,18);}
function godScene(t,st){
 stage(t,st,{bare:true});const q=(t-85.078)/3.509;
 const a=puppet(655,885,1.57,pose(t,{reach:.5,raise:.55,head:-.09}), 'me');puppet(1195,865,1.57,pose(t,{dance:.4,head:.12}), 'you',{strings:true});
 const y=mix(220,350,ease(q));rect(400,y,1090,25,C.ink,{shadow:12});for(const xx of [530,745,1195,1380])curve([[xx,y+25],[xx+20,y+120],[xx-12,520],[xx,630]],C.coral,2.2);rivet(960,y+12,9);
 ribbon(a.left,{x:530,y:y+18},t,{width:9,sag:35});gear(400,y+10,74,t*.3,C.gold);
}
function identity(t,st,id){
 stage(t,st,{bare:true});frameRect(740,190,450,640,C.blue);rect(755,204,420,610,C.blueLight,{shadow:0});
 const q=(t-shotAt(t).s)/(shotAt(t).e-shotAt(t).s),sw=span(q,.35,.62);
 if(id==='identity'){
  const x=mix(625,830,ease(q));const a=puppet(x,850,1.62,pose(t,{reach:.62,walk:.25}), 'me',{swap:sw>.5});const b=puppet(1300,850,1.62,pose(t,{reach:.52,dance:.25}), 'you',{swap:sw>.5});
  ctx.save();ctx.globalAlpha=.33;puppet(995,820,1.37,pose(t-.12,{reach:.62}), 'me',{facing:-1,swap:sw>.5,noShadow:true});ctx.restore();ribbon(a.right,b.right,t,{width:14,sag:95});
 }else{
  const turn=span(q,.18,.72),p=pair(t,{x1:mix(715,1180,turn),x2:mix(1210,745,turn),dance:.9,r1:.7,r2:.7,swap:true});ribbon(p.a.right,p.b.right,t,{width:14,sag:60});
 }
}
function leaving(t,st,id){
 stage(t,st,{night:t>113});door(1405,850,195,520,span(t,111.4,114.4));
 if(id==='completion'){
  const q=span(t,104,109.5);const a=puppet(705,850,1.56,pose(t,{reach:1,head:mix(.1,-.06,q)}),'me');
  const b=puppet(mix(1210,1325,q),850,1.56,pose(t,{reach:1-q,walk:q*.4,gaze:mix(1,-1,q)}),'you',{facing:q>.55?1:-1});ribbon(a.right,b.left,t,{width:12,sag:170+q*40});
 }else{
  const leave=span(t,111,117.6),bx=mix(1325,1815,leave),alpha=1-span(t,115.4,117.5);
  const a=puppet(705,850,1.56,pose(t,{reach:1,sad:.25,head:-.12}),'me');
  const pp=pose(t,{walk:.9,gaze:1});pp.rh={x:mix(90,60,leave),y:-150};puppet(bx,850,1.56,pp,'you',{facing:1,alpha});
  ribbon(a.right,{x:mix(1205,1280,leave),y:850-169*1.56+leave*180},t,{width:12,sag:150+leave*110});
  seam([[1125,859],[1255,859]],C.coral,2);bird(1665+leave*130,370-leave*120,.6,t,C.white);
 }
}
function memoryStrip(t,cutting=false){
 const local=t-118.333,q=span(local,.4,6);const pts=[];
 for(let i=0;i<24;i++){const x=360+i*57,yy=780+Math.sin(i*.36+t*.28)*35;pts.push([x,yy]);}
 stroke(pts,C.coral,95);stroke(pts,C.cream,2,[4,10]);
 for(let i=0;i<6;i++){
  const x=445+i*187,y=780+Math.sin(i*.36+t*.28)*24;
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*.3+i)*.035);ctx.globalAlpha=cutting?1-span(q,i*.11,i*.11+.22):1;
  puppet(-30,18,.25,pose(21,{reach:1}),'me',{noShadow:true});puppet(30,18,.25,pose(21,{reach:1}),'you',{noShadow:true});ctx.restore();
 }
 if(cutting)for(let i=0;i<12;i++){const f=span(q,i*.045,i*.045+.4);ctx.save();ctx.translate(400+i*90+Math.sin(i)*f*100,780+f*410);ctx.rotate(f*(i-4)*.4);poly([[-16,-27],[22,-20],[10,18],[-23,10]],i%2?C.blue:C.gold,{shadow:3,alpha:f*(1-f*.5)});ctx.restore();}
}
function eraseScene(t,st){
 stage(t,st,{night:true,bare:true});memoryStrip(t,true);const q=span(t,118.7,125.5);
 const p=pose(t,{sad:.6,head:-.14});p.rh={x:95,y:-71};puppet(800,855,1.65,p,'me');
 scissor(mix(970,1450,q),760,1.5,-.11,.4+.6*Math.sin(beat(t)*Math.PI)**2);
 ctx.save();ctx.translate(1460,860);ctx.rotate(q*.4);door(0,0,170,450,1);ctx.restore();
}
function argument(t,st){
 stage(t,st,{night:true});const q=span(t,126,132.8);door(1310,850,210,530,1-q*.96);
 const p=pose(t,{reach:.5,sad:.4,lean:.11});p.rh={x:115,y:-180};puppet(mix(960,1100,q),850,1.61,p,'me');
 for(let i=0;i<5;i++){const k=span(q,i*.12,i*.12+.2);rect(1290,380+i*90,250*k,27,C.coral,{shadow:5});seam([[1300,393+i*90],[1500*k+1300*(1-k),393+i*90]],C.cream);}
 // One surviving gap remains. The image records a refusal to accept absence.
}
function machine(t,st,{close=false}={}){
 stage(t,st,{night:true,bare:true});const q=span(t,133.5,147.6);
 rect(335,310,1230,38,C.ink,{shadow:8});rect(330,310,50,570,C.blue,{shadow:6});rect(1520,310,50,570,C.blue,{shadow:6});
 gear(1510,720,126,t*.9,C.gold);gear(1345,835,75,-t*1.5,C.coral);gear(355,435,70,-t,C.gold);
 frameRect(420,405,710,407,C.coral);ctx.save();ctx.beginPath();ctx.rect(427,412,696,393);ctx.clip();house(770,795,400,330,span(t,134,137));puppet(705,795,.93,pose(t,{reach:1}),'me');puppet(925,795,.93,pose(24,{reach:1}),'you',{alpha:.16});ctx.restore();
 const p=pose(t,{sad:.3,reach:.65});p.rh={x:80+Math.cos(t*2)*25,y:-120+Math.sin(t*2)*25};const a=puppet(close?1140:1190,865,1.55,p,'me');
 ribbon(a.right,{x:1450+Math.cos(t*2)*56,y:720+Math.sin(t*2)*56},t,{width:9,sag:20});rivet(1510+Math.cos(t*2)*56,720+Math.sin(t*2)*56,12);
 const needle=55*Math.sin(beat(t)*Math.PI);poly([[1280,360],[1320,360],[1300,600+needle]],C.cream,{shadow:4});
 for(let i=0;i<4;i++){const f=fract(q*3+i*.2);rect(410+i*170,947,112,14,C.coral,{shadow:0});rivet(450+i*170+f*30,960,4);}
}
function lostPart(x,y,s,i,t){ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*.2+i)*.13);if(i===0)handPrint();else if(i===1){poly([[-10,-40],[10,-40],[15,30],[-8,30]],C.blue,{shadow:5});rivet(0,-34,6);}else if(i===2){ellipse(0,-16,43,50,C.white,{shadow:4});seam([[-30,-20],[30,-10]],C.rust);}else if(i===3){ribbon({x:-50,y:0},{x:50,y:0},t,{width:23,sag:25});}else if(i===4){poly([[-32,-45],[25,-50],[40,35],[-34,35]],C.blue,{shadow:5});seam([[-20,-25],[30,14]],C.cream);}else heart(0,5,1,C.coral);ctx.restore();}
function handPrint(){poly([[-32,15],[-29,-20],[-20,-39],[-11,-23],[-10,-48],[0,-47],[8,-23],[13,-40],[22,-33],[20,-15],[37,-22],[42,-10],[18,20],[-10,31]],C.white,{shadow:5});}
function executeScene(t,st,id){
 stage(t,st,{night:true,bare:true});const loopTime=3.693,local=t-147.66,iteration=Math.max(0,Math.floor(local/loopTime)),cycle=fract(local/loopTime),damage=Math.min(.95,.15+iteration*.13);
 const stamp=span(cycle,.12,.26)*(1-span(cycle,.43,.65));
 // Crank, invitation, empty target, press: each cycle has a causal action.
 const openness=1-stamp*.76;
 frameRect(425,265,1070,640,C.rust);house(980,830,760*openness,525,1);
 rect(430,270,1060,25,C.cream,{shadow:0});rect(433,875,1054,24,C.cream,{shadow:0});
 const offer=span(cycle,.02,.15),p=pose(t,{reach:offer,sad:.35+iteration*.045,head:-.08});
 const a=puppet(735,852,1.6,p,'me',{damage});
 ribbon(a.right,{x:1175,y:580},t,{width:13,sag:180+iteration*9,loops:Math.min(3,iteration*.3)});
 ctx.save();ctx.globalAlpha=.17;puppet(1200,852,1.6,pose(24,{reach:1}),'you',{noShadow:true});ctx.restore();
 gear(1570,780,112,t*1.4,C.gold);gear(1700,889,69,-t*2.2,C.coral);
 rect(615,mix(160,445,stamp),700,80,C.coral,{shadow:13});seam([[650,mix(198,483,stamp)],[1260,mix(198,483,stamp)]],C.cream,2);
 for(let i=0;i<Math.min(6,iteration+1);i++)lostPart(540+i*150,945,1,i,t);
 if(cycle>.43&&cycle<.8){const fall=(cycle-.43)/.37;ctx.save();ctx.translate(1020+Math.sin(iteration)*fall*100,440+fall*400);ctx.rotate(fall*2);poly([[-23,-12],[28,-7],[10,30],[-15,24]],iteration%2?C.cream:C.blue,{shadow:5});ctx.restore();}
 if(id==='count'){
  const cues=[158.9,159.321,159.657,160.244,160.693,161.124];const n=Math.max(0,cues.findLastIndex(v=>t>=v));
  rect(270,325,1380,610,C.dark,{shadow:16});for(let i=0;i<6;i++){const xx=435+i*210;rect(xx-80,420,160,380,i<=n?C.cream:C.blue,{shadow:7});ctx.save();ctx.globalAlpha=i<=n?1:.16;lostPart(xx,655,1,i,t);label(String(i+1).padStart(2,'0'),xx,785,40,i<=n?C.coral:C.cream,'Cormorant');ctx.restore();}
 }
}
function ghostScene(t,st){
 stage(t,st,{night:true,home:true});const q=span(t,170,176.6),p=pose(t,{reach:1,sad:.58,head:-.13});const a=puppet(720,855,1.62,p,'me',{damage:.8});
 // A stencil, not the returned person, is held mechanically in the second place.
 const b=puppet(1220,855,1.62,pose(24,{reach:1}),'you',{alpha:mix(.6,.12,q),strings:true,noShadow:true});ribbon(a.right,b.right,t,{width:16,sag:140,loops:1.3});
 scissor(1260,990,1.15,q*.6,.2);for(let i=0;i<5;i++)lostPart(420+i*190,975,1,i,t);
}
function algebraScene(t,st,close=false){
 ctx.fillStyle=pattern(C.cream);ctx.fillRect(-400,-500,2900,2200);
 for(let row=0;row<3;row++)for(let col=0;col<5;col++){
  const x=375+col*310,y=175+row*277,index=row*5+col;
  frameRect(x-136,y-40,263,251,C.blue);seam([[x-3,y-28],[x-3,y+201]],C.coral);
  const pp=pose(18+index*.36,{reach:1,dance:.25});puppet(x-65,y+177,.58,pp,'me',{noShadow:true});
  ctx.save();ctx.globalAlpha=.16;puppet(x+62,y+177,.58,pose(18+index*.36,{reach:1,dance:.25}),'you',{noShadow:true});ctx.restore();
  rivet(x-125,y-30,3);label(`${String(index+1).padStart(2,'0')}`,x-107,y+192,10,C.blue);
 }
 const q=span(t,177.5,188);const x=mix(500,1280,q),p=pose(t,{reach:.6,sad:.7,head:-.12});puppet(x,1010,1.5,p,'me',{damage:.79});
 const yy=close?550:485;rect(920,yy,24,197,C.coral,{shadow:7});rivet(932,yy+16,8);stroke([[885,yy+95],[980,yy+95]],C.coral,3);
}
function outsideScene(t,st,id){
 sky(t,st,{night:true,outside:true});
 // A real spatial reversal: the mechanism is enclosed, the other walks beyond it.
 frameRect(115,195,925,755,C.rust);rect(132,212,891,721,C.dark,{shadow:0});
 ctx.save();ctx.beginPath();ctx.rect(132,212,891,721);ctx.clip();
 poly([[132,850],[1035,850],[1035,1100],[132,1100]],C.blue,{shadow:0});
 house(590,850,670,560,mix(1,.44,span(t,194,205.5)));
 const a=puppet(550,866,1.54,pose(t,{reach:1,dance:.7,sad:.75,head:-.1}),'me',{damage:.8,strings:true});
 for(let i=0;i<4;i++)ribbon({x:250,y:350+i*90},{x:910,y:390+i*90},t,{width:10,sag:mix(220,60,span(t,195,205)),loops:1+i*.3,color:i%2?C.gold:C.coral});
 ribbon(a.right,{x:810,y:650},t,{width:14,sag:160,loops:2});gear(935,800,85,t*.6,C.gold);ctx.restore();
 // The window and surviving gap share the same geometry as the previous door.
 door(995,944,107,655,1);
 if(id==='outside'){
  const q=span(t,188.5,195.5),bx=mix(1280,1720,q);poly([[1080,930],[2250,850],[2280,1180],[1100,1180]],C.mint,{shadow:0});
  puppet(bx,935,1.18,pose(t,{walk:.9,gaze:1}),'you',{facing:1});bird(1350+q*370,515-q*155,.75,t,C.white);plant(1840,1020,1.3,t,C.blue);
 }else{
  for(let i=0;i<4;i++)plant(1350+i*190,950+i*26,.8+i*.13,t,C.blue,{flower:i%2===0});bird(1670+Math.sin(t*.15)*80,360,.75,t);
  // The choreography survives. The partner's side does not move.
 }
}
function pressScene(t,st,id){
 ctx.fillStyle=pattern(C.cream);ctx.fillRect(-500,-500,3000,2200);
 for(let i=0;i<7;i++){const x=-150+i*380-fract((t-205.8)/5)*380;rect(x,690,345,245,C.white,{shadow:7});seam([[x+15,708],[x+330,708]],C.blue);}
 rect(260,310,75,560,C.blue,{shadow:9});rect(1590,310,75,560,C.blue,{shadow:9});gear(1590,843,115,t*.4,C.gold);
 const compress=span(t,205.811,207.4),release=span(t,207.6,209.1);
 if(id==='press'){
  ctx.save();ctx.translate(925,855);ctx.scale(1,Math.max(.07,1-compress*.93));puppet(0,0,1.63,pose(24,{reach:1,sad:.7}),'me',{damage:.85,noShadow:true});ctx.restore();
  rect(360,mix(270,775,compress*(1-release)),1170,100,C.coral,{shadow:17});
  if(compress>.65)heart(958,827,mix(.05,1.45,span(t,207,208)),C.coral);
 }else{
  const q=span(t,209.1,212.36);rect(360,270,1170,100,C.coral,{shadow:17});heart(mix(960,660,q),827,1.45,C.coral);
  const p=pose(0);puppet(mix(1530,1190,q),854,1.58,p,'me',{alpha:.16,noShadow:true});
  ribbon({x:1450,y:280},{x:1190,y:740},t,{width:8,sag:30,color:C.coral,alpha:q*.65});
 }
}

function filmFinish(t,st,s){
 // Static paper fibres adhere to the artwork; avoid using grain as fake motion.
 ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.085;ctx.drawImage(paper,0,0,W,H);ctx.restore();
 const v=ctx.createRadialGradient(960,510,360,960,510,1200);v.addColorStop(0,'#162d3800');v.addColorStop(1,st.after>.8?'#162d383e':'#162d381a');ctx.fillStyle=v;ctx.fillRect(0,0,W,H);
 // Narrow irregular deckled edges support the physical theatre, with no persistent HUD.
 for(const side of [-1,1]){const pts=[];for(let i=0;i<=48;i++){const x=i/48*W,y=side<0?12+rnd(i+80)*7:H-12-rnd(i+150)*7;pts.push([x,y]);}pts.push([W,side<0?-10:H+10],[0,side<0?-10:H+10]);poly(pts,C.cream,{shadow:0,edge:0});}
 if(t<.35){ctx.save();ctx.globalAlpha=1-span(t,0,.35);ctx.fillStyle=C.dark;ctx.fillRect(0,0,W,H);ctx.restore();}
 if(t>=212.05){const fade=span(t,212.05,212.6);ctx.save();ctx.globalAlpha=fade;ctx.fillStyle=C.dark;ctx.fillRect(0,0,W,H);ctx.restore();}
 if(t>=212.45){ctx.save();ctx.globalAlpha=smoothPulse(t,212.45,214.31);label('THE ACCEPTANCE MACHINE',960,457,42,C.cream,'Cormorant');label('MUSIC  /  MILI',960,520,15,C.gold);label('ORIGINAL PROGRAMMED PAPER THEATRE',960,560,13,C.blueLight);label('UNOFFICIAL FAN FILM',960,607,11,C.pale);ctx.restore();}
}
function drawFrame(t){
 ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.setLineDash([]);ctx.fillStyle=C.cream;ctx.fillRect(0,0,W,H);
 const s=shotAt(t),st=getWorld(t);ctx.save();worldCamera(s,t);
 switch(s.id){
  case 'assembly':assembly(t,st);break;
  case 'meeting':meeting(t,st);break;
  case 'points':case 'circle':case 'sine':case 'limit':mathematics(t,st,s.id);break;
  case 'polarity':polarity(t,st);break;case 'time':timeRoom(t,st);break;
  case 'home':homeScene(t,st);break;case 'home-thread':homeScene(t,st,true);break;
  case 'eggplant':case 'tomato':fruit(t,st,s.id);break;case 'cat':catScene(t,st);break;
  case 'god':godScene(t,st);break;case 'identity':case 'roles':identity(t,st,s.id);break;
  case 'completion':case 'leave':leaving(t,st,s.id);break;
  case 'erase':eraseScene(t,st);break;case 'argument':argument(t,st);break;
  case 'reset':case 'reset-close':machine(t,st,{close:s.id==='reset-close'});break;
  case 'execute':case 'count':executeScene(t,st,s.id);break;case 'ghost':ghostScene(t,st);break;
  case 'algebra':case 'algebra-close':algebraScene(t,st,s.id==='algebra-close');break;
  case 'outside':case 'solo':outsideScene(t,st,s.id);break;
  case 'press':case 'residue':pressScene(t,st,s.id);break;
  default:ctx.fillStyle=C.dark;ctx.fillRect(-1000,-1000,4000,4000);
 }
 ctx.restore();filmFinish(t,st,s);return{s:s.id,event:s.event};
}
window.drawFrame=drawFrame;
window.benchmarkFrames=()=>{drawFrame(24);const n=30,begin=performance.now();for(let i=0;i<n;i++){drawFrame(24+i/60);ctx.getImageData(0,0,W,H);}return{frames:n,elapsedMilliseconds:performance.now()-begin,context:ctx.getContextAttributes()};};
window.rendererInfo={renderer:'Canvas 2D',project:'The Acceptance Machine / Paper Theatre',width:W,height:H,shots:shots.length,texture:'ambientCG Paper002 — CC0',timing:'60 exact samples per second'};
window.saveQA=async t=>{drawFrame(t);const blob=await new Promise(resolve=>screen.toBlob(resolve,'image/png'));const r=await fetch(`/qa?t=${t}`,{method:'POST',body:blob});if(!r.ok)throw Error(await r.text());};
function fingerprint(t){drawFrame(t);const b=ctx.getImageData(0,0,W,H).data;let h=2166136261;for(let i=0;i<b.length;i+=17)h=Math.imul(h^b[i],16777619);return h>>>0;}
window.auditFrames=()=>{const epochs=[1.8,18,38.5,62,86.5,114,129,150,160,183,200,209.5],first=epochs.map(fingerprint);epochs.slice().reverse().forEach(drawFrame);const again=epochs.map(fingerprint);const checks=epochs.map((time,i)=>({time,first:first[i],afterRandomSeek:again[i],passed:first[i]===again[i]}));return{passed:checks.every(x=>x.passed),checks};};
window.renderAll=async()=>{try{for(let frame=0;frame<config.frames;frame++){drawFrame((config.start||0)+frame/60);const raw=ctx.getImageData(0,0,W,H).data;const r=await fetch('/frame',{method:'POST',body:raw.buffer});if(!r.ok)throw Error(await r.text());}await fetch('/done',{method:'POST'});}catch(e){await fetch('/error',{method:'POST',body:String(e.stack||e)});}};
window.mvReady=true;drawFrame(0);
if(new URLSearchParams(location.search).has('render'))document.querySelector('#controls').classList.add('hidden');
else{
 const audio=document.querySelector('#audio'),seek=document.querySelector('#seek'),play=document.querySelector('#play');let ended=0;
 play.onclick=async()=>{if(audio.paused){ended=0;await audio.play();play.textContent='PAUSE';}else{audio.pause();play.textContent='PLAY';}};
 seek.oninput=()=>{ended=0;audio.currentTime=Math.min(analysis.duration,Number(seek.value));drawFrame(Number(seek.value));};audio.onended=()=>{ended=performance.now();};
 function loop(){if(!audio.paused||ended){const t=ended?Math.min(config.duration,analysis.duration+(performance.now()-ended)/1000):audio.currentTime;drawFrame(t);seek.value=t;document.querySelector('#time').textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;if(t>=config.duration)ended=0;}requestAnimationFrame(loop);}requestAnimationFrame(loop);
}
