// Original cut-paper drawing system. Geometry, textures and poses are deterministic.
export const C={ink:'#203b47',blue:'#467b8b',blueLight:'#85adaf',cream:'#efe4c9',white:'#f8efd9',gold:'#e4be61',coral:'#c46755',rust:'#9c4a42',dark:'#162d38',mint:'#b8c5b0',pale:'#d9d9c4'};
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const mix=(a,b,t)=>a+(b-a)*t;
export const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
export const span=(t,a,b)=>ease((t-a)/(b-a));
export const fract=x=>x-Math.floor(x);
export const rnd=i=>fract(Math.sin(i*127.1+73.3)*43758.5453);
export const TAU=Math.PI*2;
let g,texture,patterns=new Map();
export function initialize(ctx,paper){g=ctx;texture=paper;}
export function pattern(color){
 if(patterns.has(color))return patterns.get(color);
 const c=document.createElement('canvas');c.width=c.height=512;const a=c.getContext('2d');a.fillStyle=color;a.fillRect(0,0,512,512);
 if(texture){a.globalCompositeOperation='multiply';a.globalAlpha=.36;a.drawImage(texture,0,0,512,512);a.globalAlpha=1;a.globalCompositeOperation='source-over';}
 for(let i=0;i<9500;i++){a.fillStyle=i%2?'#ffffff16':'#112a3312';a.fillRect(rnd(i+100)*512,rnd(i+30000)*512,.4+rnd(i+17000)*1.6,.3+rnd(i+40000)*1.2);}
 const p=g.createPattern(c,'repeat');patterns.set(color,p);return p;
}
export function path(commands){const p=new Path2D();for(const [k,...v]of commands)p[k](...v);return p;}
export function cut(p,color,{shadow=6,edge=1.5,alpha=1}={}){
 g.save();g.globalAlpha*=alpha;
 if(shadow){g.save();g.translate(shadow*.65,shadow);g.fillStyle='#152b3830';g.fill(p);g.restore();}
 g.fillStyle=pattern(color);g.fill(p);if(edge){g.strokeStyle='#203b4755';g.lineWidth=edge;g.stroke(p);}g.restore();
}
export function poly(points,color,opts){const p=new Path2D();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();cut(p,color,opts);return p;}
export function ellipse(x,y,rx,ry,color,opts){const p=new Path2D();p.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,TAU);cut(p,color,opts);return p;}
export function rect(x,y,w,h,color,opts){const p=new Path2D();p.rect(x,y,w,h);cut(p,color,opts);return p;}
export function stroke(points,color=C.ink,width=2,dash=[]){g.save();g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.lineJoin='round';g.setLineDash(dash);g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.restore();}
export function curve(points,color=C.ink,width=2,dash=[]){g.save();g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.setLineDash(dash);g.beginPath();g.moveTo(...points[0]);g.bezierCurveTo(...points.slice(1).flat());g.stroke();g.restore();}
export function label(txt,x,y,size=16,color=C.ink,font='Plex',align='center'){
 g.save();g.fillStyle=color;g.font=`${size}px ${font}`;g.textAlign=align;g.fillText(txt,x,y);g.restore();
}
export function seam(points,color='#203b4770',width=1.4){stroke(points,color,width,[3,6]);}
export function rivet(x,y,r=5){ellipse(x,y,r,r,C.gold,{shadow:1,edge:.8});ellipse(x,y,r*.36,r*.36,C.ink,{shadow:0,edge:0});}
function limb(a,b,width,color){const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,nx=-dy/d,ny=dx/d;poly([[a.x+nx*width/2,a.y+ny*width/2],[b.x+nx*width*.37,b.y+ny*width*.37],[b.x-nx*width*.37,b.y-ny*width*.37],[a.x-nx*width/2,a.y-ny*width/2]],color,{shadow:3});}
function ik(a,b,l1,l2,side){const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.min(Math.hypot(dx,dy),l1+l2-.01)),ang=Math.atan2(dy,dx),q=Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));return{x:a.x+l1*Math.cos(ang+q*side),y:a.y+l1*Math.sin(ang+q*side)};}
function turn(x,y,ang){return{x:x*Math.cos(ang)-y*Math.sin(ang),y:x*Math.sin(ang)+y*Math.cos(ang)};}
function arm(a,b,side,colors,missing=0){const e=ik(a,b,58,57,side);if(missing>.95)return;e.x+=missing*12;limb(a,e,19,colors.coat);if(missing<.5){limb(e,b,13,colors.skin);rivet(e.x,e.y,4);hand(b.x,b.y,Math.atan2(b.y-e.y,b.x-e.x),side);}rivet(a.x,a.y,5);}
function hand(x,y,angle,side){
 g.save();g.translate(x,y);g.rotate(angle);const p=path([['moveTo',-3,-7],['lineTo',10,-7],['quadraticCurveTo',23,-8,24,-3],['lineTo',15,0],['lineTo',27,1],['quadraticCurveTo',32,4,25,7],['lineTo',10,9],['quadraticCurveTo',4,14,-1,9],['closePath']]);cut(p,C.white,{shadow:2,edge:1});stroke([[11,1],[23,3]],'#203b4766',.8);g.restore();
}
export function pose(t,{reach=0,dance=0,walk=0,gaze=1,sad=0,head=0,lean=0,raise=0,phase=0}={}){
 const b=(t-.213)*130/60+phase,sw=Math.sin(b*Math.PI),step=Math.sin(b*Math.PI*.5);
 return {bob:(dance?Math.abs(sw)*8:0)+walk*Math.abs(sw)*5,lean:lean+dance*step*.065+sad*.11,head:head-sad*.2,gaze,
 lh:{x:mix(-70,-10,reach)+dance*step*26,y:mix(-126,-177,reach)-raise*85+sad*25},
 rh:{x:mix(67,128,reach)+dance*sw*20,y:mix(-115,-169,reach)-raise*80+sad*15},
 lf:{x:-23+walk*sw*29-dance*step*13,y:-walk*Math.max(0,-sw)*23},rf:{x:26-walk*sw*29+dance*step*13,y:-walk*Math.max(0,sw)*23},sad,smile:dance*.5+reach*.3};
}
export function puppet(x,y,s,p={},id='me',opts={}){
 const facing=opts.facing??(id==='me'?1:-1),rot=opts.rotate||0,alpha=opts.alpha??1;
 if(alpha<=0)return {left:{x,y},right:{x,y},chest:{x,y},head:{x,y},foot:{x,y}};
 const col=id==='me'?{coat:C.blue,skin:C.white,hair:C.ink,lining:C.blueLight,accent:C.coral}:{coat:C.gold,skin:C.cream,hair:C.rust,lining:'#f1d99b',accent:C.blue};
 if(opts.swap){[col.coat,col.accent]=[col.accent,col.coat];}
 const bob=p.bob||0,lean=p.lean||0;
 const hip={x:0,y:-108-bob};
 const bodyPoint=(x,y)=>{const r=turn(x,y,lean);return{x:hip.x+r.x,y:hip.y+r.y}};
 const lShoulder=bodyPoint(-31,-78),rShoulder=bodyPoint(31,-78),neck=bodyPoint(0,-106);
 const lh=p.lh||{x:-65,y:-125},rh=p.rh||{x:65,y:-115};
 const lf=p.lf||{x:-24,y:0},rf=p.rf||{x:26,y:0};
 const damage=opts.damage||0;
 g.save();g.translate(x,y);g.rotate(rot);g.scale(s*facing,s);g.globalAlpha*=alpha;
 if(!opts.noShadow&&Math.abs(rot)<.1)ellipse(0,4,59,9,'#b6b69e',{shadow:0,edge:0,alpha:.65});
 for(const [a,b,side]of [[{x:-18,y:hip.y},lf,1],[{x:18,y:hip.y},rf,-1]]){
  const knee=ik(a,b,60,60,side);limb(a,knee,20,col.coat);limb(knee,b,12,col.skin);rivet(knee.x,knee.y,4);
  g.save();g.translate(b.x,b.y);g.rotate(walkAngle(p,side));poly([[-9,-9],[7,-9],[26,-1],[28,5],[-10,6]],col.hair,{shadow:2});g.restore();
 }
 arm(lShoulder,lh,-1,col,damage>.75?1:0);
 g.save();g.translate(hip.x,hip.y);g.rotate(lean);
 const torso=poly([[-31,-82],[32,-82],[42,-8],[29,10],[-27,10],[-41,-8]],col.coat,{shadow:5});
 g.save();g.clip(torso);for(let i=0;i<16;i++)stroke([[-50,-87+i*6],[55,-74+i*6]],'#f8efd92a',1);g.restore();
 poly([[-25,-80],[0,-44],[-6,-85]],col.lining,{shadow:0});poly([[24,-80],[0,-44],[6,-85]],col.lining,{shadow:0});
 stroke([[0,-44],[0,8]],'#203b4760',1.2);for(const yy of [-32,-17,-2])rivet(3,yy,2.8);
 poly([[-15,-78],[0,-71],[14,-80],[8,-90],[-8,-90]],col.accent,{shadow:1,edge:.8});
 seam([[-33,-20],[-15,-17],[-15,-2]]);g.restore();
 rect(neck.x-9,neck.y-22,18,50,col.skin,{shadow:2});
 g.save();g.translate(neck.x,neck.y-34);g.rotate((p.head||0)+lean*.3);
 const hp=path([['moveTo',-34,-47],['quadraticCurveTo',-50,-8,-27,18],['quadraticCurveTo',-4,38,23,12],['quadraticCurveTo',49,-15,28,-51],['quadraticCurveTo',0,-70,-34,-47],['closePath']]);cut(hp,col.skin,{shadow:5,edge:1.3});
 // Original graphic masks: asymmetric bangs, stitched brows, separate eye direction.
 poly([[-39,-29],[-37,-52],[-16,-66],[20,-58],[36,-38],[27,-29],[15,-45],[1,-34],[-14,-47],[-26,-23]],col.hair,{shadow:2,edge:1});
 const gx=(p.gaze??1)*3.4;
 for(const ex of [-15,16]){ellipse(ex,-13,7.5,4.8,C.white,{shadow:0,edge:.65});ellipse(ex+gx,-13,2.5,3.2,col.hair,{shadow:0,edge:0});stroke([[ex-7,-23-(p.sad||0)*2],[ex+5,-24+(p.sad||0)*5]],col.hair,1.8);}
 ellipse(-24,0,8,3.4,col.accent,{shadow:0,edge:0,alpha:.34});ellipse(25,-1,7.5,3,col.accent,{shadow:0,edge:0,alpha:.3});
 stroke([[1,-13],[4,0],[-1,2]],'#203b4780',1.3);
 const sadness=p.sad||0;
 curve([[-7,11+sadness*5],[-1,11+(p.smile||0)*8-sadness*6],[5,12+(p.smile||0)*8-sadness*6],[11,8+sadness*8]],col.hair,1.4);
 if(sadness>.35)for(const ex of [-15,16])stroke([[ex-7,-16],[ex+7,-16+sadness*1.8]],col.hair,1.5);
 rivet(-34,-5,2.5);
 if(opts.cat){poly([[-32,-40],[-47,-76],[-14,-57]],col.coat,{shadow:2});poly([[18,-57],[43,-79],[32,-37]],col.coat,{shadow:2});for(const side of [-1,1])for(let i=0;i<3;i++)stroke([[side*25,4],[side*53,2+i*5]],col.hair,1.2);}
 if(damage>.2){seam([[-27,13],[3,-2],[28,9]],C.rust,1.8);poly([[20,-36],[29,-28],[17,-12],[26,2],[34,-8],[40,-29]],C.cream,{shadow:0,edge:.8});}
 g.restore();
 arm(rShoulder,rh,1,col,damage>.48?Math.min(1,(damage-.48)*3):0);
 if(damage>.08){g.save();g.translate(hip.x,hip.y);g.rotate(lean);for(let i=0;i<Math.floor(damage*12);i++){const xx=-28+rnd(i+30)*53,yy=-70+rnd(i+150)*67;stroke([[xx,yy],[xx+7,yy+4],[xx+2,yy+10]],C.cream,2);}g.restore();}
 if(opts.strings){for(const a of [lShoulder,rShoulder,neck])curve([[a.x,a.y],[a.x-15,a.y-100],[a.x+18,-420],[a.x,-620]],'#203b4780',.8);}
 g.restore();
 const handToWorld=h=>{const q=turn(h.x*facing*s,h.y*s,rot);return{x:x+q.x,y:y+q.y};};
 return{left:handToWorld(lh),right:handToWorld(rh),chest:{x:x,y:y-180*s},head:{x:x,y:y-270*s},foot:{x,y}};
}
function walkAngle(p,side){return p.lf&&p.rf?clamp((side>0?p.lf.y:p.rf.y)*.012,-.35,.35):0;}
export function ribbon(a,b,t,{width=14,sag=80,color=C.coral,loops=0,alpha=1}={}){
 g.save();g.globalAlpha*=alpha;
 const points=[];for(let i=0;i<=48;i++){const q=i/48;points.push([mix(a.x,b.x,q)+Math.sin(q*TAU*(1+loops)+t)*loops*19,mix(a.y,b.y,q)+Math.sin(q*Math.PI)*sag+Math.sin(q*TAU*3+t*1.7)*5]);}
 stroke(points,'#152b382e',width+4);stroke(points,color,width);stroke(points,'#f8efd990',1.5,[3,7]);g.restore();
}
export function plant(x,y,s,t,color=C.blue,{flower=true}={}){
 g.save();g.translate(x,y);g.scale(s,s);const sway=Math.sin(t*.7+x)*5;
 curve([[0,0],[-10,-65],[sway+10,-140],[sway,-212]],color,3);
 for(let i=0;i<6;i++){const side=i%2?1:-1,yy=-35-i*26,xx=sway*i/6;const p=path([['moveTo',xx,yy],['quadraticCurveTo',xx+side*48,yy-40,xx+side*67,yy-24],['quadraticCurveTo',xx+side*35,yy+2,xx,yy],['closePath']]);cut(p,color,{shadow:2,edge:.8});stroke([[xx,yy],[xx+side*57,yy-23]],'#efe4c970',.8);}
 if(flower){g.save();g.translate(sway,-216);g.rotate(t*.07+x);for(let i=0;i<8;i++){g.save();g.rotate(i*TAU/8);ellipse(0,-23,10,26,C.gold,{shadow:2,edge:.8});g.restore();}ellipse(0,0,12,12,C.coral,{shadow:2,edge:1});g.restore();}g.restore();
}
export function bird(x,y,s,t,color=C.cream){g.save();g.translate(x,y);g.scale(s,s);g.rotate(Math.sin(t*.8)*.1);poly([[-44,5],[-13,-4],[0,-17],[24,-7],[30,3],[52,8],[19,12],[0,23],[-10,15]],color,{shadow:4});const flap=Math.sin(t*5.3);poly([[-2,7],[-35,-20-flap*19],[6,-12],[26,8]],C.gold,{shadow:3});ellipse(19,-1,2,2,C.ink,{shadow:0,edge:0});g.restore();}
export function gear(x,y,r,t,color=C.gold){g.save();g.translate(x,y);g.rotate(t);const pts=[];for(let i=0;i<64;i++){const a=i/64*TAU,rr=r*(i%4<2?1:.88);pts.push([Math.cos(a)*rr,Math.sin(a)*rr]);}poly(pts,color,{shadow:5});ellipse(0,0,r*.63,r*.63,C.cream,{shadow:0});for(let i=0;i<6;i++){g.save();g.rotate(i*TAU/6);rect(-r*.08,-r*.76,r*.16,r*.78,color,{shadow:0});g.restore();}rivet(0,0,r*.17);g.restore();}
export function house(x,y,w,h,fold=1){
 g.save();g.translate(x,y);const f=Math.max(.02,fold);g.scale(f,1);
 poly([[-w/2,0],[-w/2,-h*.7],[0,-h],[w/2,-h*.7],[w/2,0]],C.white,{shadow:18});
 poly([[-w/2-25,-h*.7],[0,-h-25],[w/2+25,-h*.7],[w/2,-h*.63],[0,-h*.89],[-w/2,-h*.63]],C.coral,{shadow:7});
 for(const xx of [-w*.27,w*.27]){rect(xx-45,-h*.53,90,100,C.blueLight,{shadow:2});stroke([[xx,-h*.53],[xx,-h*.53+100]],C.white,7);stroke([[xx-45,-h*.53+50],[xx+45,-h*.53+50]],C.white,7);}
 rect(-w*.09,-h*.32,w*.18,h*.32,C.gold,{shadow:3});rivet(w*.046,-h*.13,4);seam([[0,-h*.89],[0,-h*.36]]);g.restore();
}
export function door(x,y,w,h,open=0,{empty=false}={}){
 rect(x-18,y-h-18,w+36,h+36,C.cream,{shadow:10});rect(x,y-h,w,h,C.dark,{shadow:0,edge:2});
 if(empty){g.save();g.globalAlpha=.2;ellipse(x+w*.5,y-h*.68,w*.18,h*.12,C.cream,{shadow:0});g.restore();}
 const wid=w*Math.cos(clamp(open)*Math.PI/2);poly([[x,y-h],[x+wid,y-h+open*23],[x+wid,y+open*17],[x,y]],C.gold,{shadow:6});if(wid>15)rivet(x+wid*.85,y-h*.46,4);
}
export function scissor(x,y,s,a,open=.5){g.save();g.translate(x,y);g.scale(s,s);g.rotate(a);for(const side of [-1,1]){g.save();g.rotate(side*open*.35);ellipse(-42,side*6,21,14,C.blue,{shadow:3});ellipse(-43,side*6,13,7,C.cream,{shadow:0});poly([[-25,-5],[75,-3],[87,0],[75,4],[-25,6]],C.white,{shadow:3});g.restore();}rivet(0,0,5);g.restore();}
export function heart(x,y,s,color=C.coral){g.save();g.translate(x,y);g.scale(s,s);cut(path([['moveTo',0,24],['bezierCurveTo',-75,-17,-31,-70,0,-33],['bezierCurveTo',31,-70,75,-17,0,24],['closePath']]),color,{shadow:8});seam([[0,-31],[0,22]],C.cream);g.restore();}
export function frameRect(x,y,w,h,color=C.ink){rect(x,y,w,h,color,{shadow:8});rect(x+7,y+7,w-14,h-14,C.cream,{shadow:0,edge:0});}
