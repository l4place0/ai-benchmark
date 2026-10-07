import * as THREE from '../../src/three.module.js';
import {RGBELoader} from '../../src/RGBELoader.js';
const W=1920,H=1080,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=(a,b,t)=>{let x=clamp((t-a)/(b-a));return x*x*(3-2*x)};
const timeline=await(await fetch('./revision02/analysis/timeline.json')).json();const envelope=timeline.envelopes;
const canvas=document.getElementById('film'),ctx=canvas.getContext('2d',{alpha:false});
const glCanvas=document.createElement('canvas');
const renderer=new THREE.WebGLRenderer({canvas:glCanvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,W/H,.1,180);
const hdr=await new RGBELoader().loadAsync('./assets/studio_small_09_1k.hdr');hdr.mapping=THREE.EquirectangularReflectionMapping;
const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;hdr.dispose();pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xe9f5ee,0x352729,2));
const key=new THREE.DirectionalLight(0xffecd6,4.5);key.position.set(3,8,5);scene.add(key);
const rim=new THREE.DirectionalLight(0x7db9bd,3);rim.position.set(-5,2,-6);scene.add(rim);
const point=new THREE.PointLight(0xff3824,35,22);point.position.set(0,1,3);scene.add(point);
const red=new THREE.MeshPhysicalMaterial({color:0x9e1623,metalness:.32,roughness:.39,clearcoat:.5,clearcoatRoughness:.4,side:THREE.DoubleSide});
const pearl=new THREE.MeshPhysicalMaterial({color:0xf2e7d2,metalness:.55,roughness:.21,clearcoat:.7,side:THREE.DoubleSide});
const gold=new THREE.MeshStandardMaterial({color:0xb9a17d,metalness:.85,roughness:.3});
const ink=new THREE.MeshStandardMaterial({color:0x172625,metalness:.8,roughness:.28});
const glow=new THREE.MeshBasicMaterial({color:0xff5a39});
function mesh(g,m,parent=scene){let o=new THREE.Mesh(g,m);parent.add(o);return o;}
function petalGeometry(){const ps=[],uv=[],ids=[],N=26,M=12;for(let i=0;i<=N;i++){let u=i/N;for(let j=0;j<=M;j++){let v=j/M*2-1;let width=Math.pow(Math.sin(Math.PI*u),.72)*.85;ps.push(v*width,u*2.45,.7*Math.sin(u*Math.PI*.85)+.42*v*v*Math.sin(u*Math.PI)+.10*Math.sin(u*17+v*5)*Math.sin(u*Math.PI));uv.push(j/M,u);}}for(let i=0;i<N;i++)for(let j=0;j<M;j++){let a=i*(M+1)+j,b=a+M+1;ids.push(a,b,a+1,b,b+1,a+1);}let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ids);g.computeVertexNormals();return g;}
const petalGeo=petalGeometry();
function makeFlower(mat=red){let group=new THREE.Group();const petals=[];for(let layer=0;layer<4;layer++){let count=7+layer*2;for(let n=0;n<count;n++){let pivot=new THREE.Group();let angle=n/count*TAU+layer*.65;pivot.rotation.y=angle;group.add(pivot);let p=mesh(petalGeo,mat,pivot);p.position.set(0,-.1+layer*.085,.16+layer*.08);p.scale.setScalar(.63+layer*.15);petals.push({pivot,p,angle,layer,n});}}const heart=mesh(new THREE.IcosahedronGeometry(.31,3),gold,group);let stem=mesh(new THREE.CylinderGeometry(.018,.047,4.6,9),ink,group);stem.position.y=-2.4;for(let j=0;j<3;j++){let l=mesh(petalGeo,ink,group);l.scale.set(.2,.45,.5);l.position.y=-1.3-j*.7;l.rotation.set(.3,j*2.5,-.8);}return {group,petals,heart,stem};}
const flower=makeFlower();scene.add(flower.group);
const ghost=makeFlower(pearl);scene.add(ghost.group);
function animateFlower(f,t,open,scatter,seed=0){for(const d of f.petals){const a=d.angle+seed;d.p.rotation.x=(.17+d.layer*.23)*open+.045*Math.sin(t*1.7+d.n);d.p.rotation.z=.06*Math.sin(d.n*7+t*.4);d.p.position.set(Math.sin(a)*scatter*(1+d.layer*.5),-.1+d.layer*.085+Math.sin(a*4+t*.4)*scatter,.16+d.layer*.08+Math.cos(a)*scatter*(1+d.layer*.5));d.p.rotation.y=scatter*.18*Math.sin(a*3+t);d.p.scale.setScalar((.63+d.layer*.15)*(1+Math.sin(t*2+d.n)*.013));}f.heart.rotation.y=t*.3;}
const rings=new THREE.Group();scene.add(rings);for(let i=0;i<9;i++){let r=mesh(new THREE.TorusGeometry(2.65+i*.36,.008+(i%3===0?.01:0),6,160),i%3===0?gold:ink,rings);r.rotation.x=Math.PI/2;r.position.y=-2.7+i*.025;}
const halo=new THREE.Group();scene.add(halo);for(let i=0;i<3;i++){let r=mesh(new THREE.TorusGeometry(3.25+i*.15,.018,8,180),gold,halo);r.rotation.set(i*.75,i*.4,0);}
const cage=new THREE.Group();scene.add(cage);for(let i=0;i<18;i++){let r=mesh(new THREE.TorusGeometry(4,.009,5,120),pearl,cage);r.rotation.y=i/18*Math.PI;}for(let i=1;i<8;i++){let a=i/8*Math.PI;let r=mesh(new THREE.TorusGeometry(4*Math.sin(a),.009,5,120),pearl,cage);r.rotation.x=Math.PI/2;r.position.y=4*Math.cos(a);}
const satellites=new THREE.Group();scene.add(satellites);const redOrb=mesh(new THREE.SphereGeometry(.25,24,16),red,satellites),whiteOrb=mesh(new THREE.SphereGeometry(.23,24,16),pearl,satellites);
let seed=712337;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
const starArr=[];for(let i=0;i<1600;i++)starArr.push((rand()-.5)*90,(rand()-.5)*60,(rand()-.5)*80);
const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starArr,3));const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xaebeb7,size:.027,transparent:true,opacity:.65}));scene.add(stars);
const shardData=Array.from({length:180},()=>({a:rand()*TAU,r:4+rand()*12,y:(rand()-.5)*16,s:.06+rand()*.27,k:rand()*TAU}));
const shards=new THREE.InstancedMesh(new THREE.OctahedronGeometry(1,0),red,shardData.length);scene.add(shards);const dummy=new THREE.Object3D();
const tunnel=new THREE.Group();scene.add(tunnel);for(let i=0;i<28;i++){let r=mesh(new THREE.TorusGeometry(4.2,.025,5,4),i%4===0?red:gold,tunnel);r.position.z=-i*3;r.rotation.z=Math.PI/4+i*.12;}
const grid=new THREE.GridHelper(90,70,0x9c988a,0xbebbae);grid.position.y=-3;grid.material.transparent=true;grid.material.opacity=.20;scene.add(grid);
const garden=new THREE.Group();scene.add(garden);const gardenFlowers=[];for(let i=0;i<12;i++){let f=makeFlower(i%4===0?pearl:red);f.group.position.set((i%4-1.5)*3,-1,-Math.floor(i/4)*4-3);f.group.scale.setScalar(.45);garden.add(f.group);gardenFlowers.push(f);}
const lattice=new THREE.Group();scene.add(lattice);const nodes=[];for(let i=0;i<100;i++){let z=1-2*(i+.5)/100,a=i*2.399963,r=Math.sqrt(1-z*z);let o=mesh(new THREE.IcosahedronGeometry(.035,0),i%7===0?red:gold,lattice);o.position.set(r*Math.cos(a)*3,z*3,r*Math.sin(a)*3);nodes.push(o);}const latticeWire=mesh(new THREE.IcosahedronGeometry(3,2),new THREE.MeshBasicMaterial({color:0xa79274,wireframe:true,transparent:true,opacity:.16}),lattice);
const helix=new THREE.Group();scene.add(helix);for(let k=0;k<2;k++){const pts=[];for(let i=0;i<250;i++){let v=i/249;pts.push(new THREE.Vector3((v-.5)*13,Math.sin(v*TAU*3+k*Math.PI)*1.3,Math.cos(v*TAU*3+k*Math.PI)*1.3));}mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),250,.025,6,false),k?pearl:red,helix);}
const floor=mesh(new THREE.CircleGeometry(45,128),new THREE.MeshStandardMaterial({color:0xd2cfc2,metalness:.25,roughness:.58}));floor.rotation.x=-Math.PI/2;floor.position.y=-3.06;
// All editing and choreography below are evaluated against source-audio sample time.
scene.background=new THREE.Color(0x060a0b);const T=timeline,beats=T.beats,cuts=T.cuts;
const q=t=>Math.round(t*60);function indexAt(list,frame){let lo=0,hi=list.length;while(lo<hi){let m=(lo+hi)>>1;if(list[m].frame<=frame)lo=m+1;else hi=m;}return Math.max(0,lo-1);}
red.color.setHex(0x830d21);red.metalness=.17;red.roughness=.42;red.clearcoat=.25;
floor.material.color.setHex(0xc4c4b6);grid.material.opacity=.10;
for(const r of rings.children){r.material=r.material.clone();r.material.transparent=true;}
const echo=new THREE.Group();scene.add(echo);for(let i=0;i<4;i++){let r=mesh(new THREE.TorusGeometry(1,.013,6,128),new THREE.MeshBasicMaterial({color:0xc9654d,transparent:true,opacity:.5}),echo);r.rotation.x=Math.PI/2;}
const titles={boot:'A LIFE, COMPILED.',overture:'world.execute(me);',geometry:'THE SHAPE OF WANT',polarity:'ALTERNATING HEARTS',chorus:'A WORLD FOR TWO',garden:'ANYTHING FOR YOU',duality:'REWRITE / REPEAT',union:'ALMOST WHOLE',isolation:'NO RESPONSE',erase:'DELETE THE MEMORY',descent:'THE LOOP CLOSES',execution:'RUN',count:'',finalchorus:'NOTHING RETURNS',elegy:'LOVE IS NOT A PROOF',outro:'THE FLOWER STAYS'};
const palettes={boot:0x060a0b,overture:0xe4e1d4,geometry:0xe7e4d6,polarity:0x080e12,chorus:0xe7e3d3,garden:0xdce1d4,duality:0x071015,union:0xe0dfd0,isolation:0x060b0e,erase:0x13090d,descent:0x090d11,execution:0x090b0e,count:0x080c0f,finalchorus:0x11090f,elegy:0xdcdccb,outro:0xe5e2d3,terminal:0x030608,credits:0x030608};
const poseCameras=[[0,11,.2],[1,3,14],[-6,2.8,10],[5,5,7],[-2,8,5],[0,1.4,7],[8,3,10],[-7,5,10]];
function type(str,x,y,size,color='#ebe4d2',align='left',serif=false){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${serif?'italic ':''}${size}px ${serif?'FilmSerif':'FilmMono'}`;ctx.fillText(str,x,y);}
function sceneMode(c){let j=c.pose;if(c.section==='boot')return ['seed','assemble','detail','assemble'][j%4];if(c.section==='geometry')return ['points','circle','wave','infinity'][j%4];if(c.section==='overture')return j<2?'title':'orbit';return c.section;}
function overlay(t,c,local,impact,dark,frame){let sec=c.section,col=dark?'#ede5d3':'#263e3a';let g=ctx.createRadialGradient(960,520,310,960,520,1100);g.addColorStop(0,'#00000000');g.addColorStop(1,dark?'#00000066':'#14252222');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // Editorial type has its own musical entrances; no persistent technical HUD.
 if(sec==='overture'&&c.pose<2){ctx.globalAlpha=smooth(0,.12,local)*(1-smooth(2.9,3.5,t-14.5667));type('world.execute(me);',112,439,91,col,'left',true);type('A BOTANICAL MACHINE',118,506,22,col);type('Mili / an original fan film',119,552,18,'#788278');ctx.globalAlpha=1;}
 if(sec==='boot'){let labels=['awaken','assemble','remember','become'];type(labels[c.pose%4],130,900,68,col,'left',true);}
 if(sec==='geometry'){let words=['POINT','BOUNDARY','FREQUENCY','INFINITY'];type(words[c.pose%4],115,925,27,col);}
 if((sec==='chorus'||sec==='union')&&c.pose===0&&local<1.4){ctx.globalAlpha=1-smooth(.9,1.4,local);type(sec==='chorus'?'for two.':'almost.',125,560,132,col,'left',true);ctx.globalAlpha=1;}
 if(sec==='isolation'){type('NO',138,480,105,'#b45049');type('RESPONSE',138,584,105,'#e7ddca');ctx.strokeStyle='#b45049';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(140,650);ctx.lineTo(140+350*(1-Math.exp(-local*5)),650);ctx.stroke();}
 if(sec==='execution'){let n=c.pose;ctx.globalAlpha=Math.exp(-local*2.2)*.76;type(n%3===0?'RUN':n%3===1?'ERASE':'REPEAT',960,643,203,'#f0dfc3','center');ctx.globalAlpha=1;type(String(n+1).padStart(2,'0'),145,183,48,'#c67562');}
 if(sec==='count'){type(String(c.pose+1).padStart(2,'0'),960,689,330,'#eadbc4','center',true);}
 if(sec==='elegy'&&c.pose===0){ctx.globalAlpha=1-smooth(2.8,3.5,local);type('love is not',115,444,88,col,'left',true);type('a proof.',115,548,88,col,'left',true);ctx.globalAlpha=1;}
 if(sec==='outro'&&t>199){ctx.globalAlpha=smooth(199,200,t);type('the flower stays.',960,920,53,col,'center',true);ctx.globalAlpha=1;}
 if(sec==='terminal'){let a=smooth(205.6333,207.8,t);ctx.fillStyle=`rgba(3,6,8,${a})`;ctx.fillRect(0,0,W,H);}
 if(sec==='credits'){ctx.fillStyle='#030608';ctx.fillRect(0,0,W,H);ctx.globalAlpha=smooth(208,209,t)*(1-smooth(214.5,216,t));type('world.execute(me);',960,447,86,'#e5decd','center',true);type('A BOTANICAL MACHINE / RHYTHM EDIT',960,515,20,'#9cae9d','center');type('Music / Mili',960,609,28,'#d9cdb8','center');type('Original procedural fan visuals',960,657,19,'#8f9d91','center');ctx.globalAlpha=1;}
 // Short graphic accent is confined to the frame edge, never a full-screen flash.
 if(['polarity','chorus','duality','execution','finalchorus'].includes(sec)){ctx.globalAlpha=impact*.5;ctx.strokeStyle=dark?'#b94337':'#a42331';ctx.lineWidth=3;ctx.strokeRect(32,32,1856,1016);ctx.globalAlpha=1;}
 if(new URLSearchParams(location.search).has('audit')){let y=963;ctx.fillStyle='#051211dd';ctx.fillRect(0,y,W,117);let span=6,center=t;for(const b of beats){if(Math.abs(b.time-center)>span/2)continue;let x=960+(b.time-center)/span*W;ctx.strokeStyle=b.barBeat===0?'#ffbb68':'#659889';ctx.beginPath();ctx.moveTo(x,y+25);ctx.lineTo(x,y+75);ctx.stroke();}for(const cut of cuts){if(Math.abs(cut.time-center)>span/2)continue;let x=960+(cut.time-center)/span*W;ctx.fillStyle='#e75760';ctx.fillRect(x-3,y+6,6,18);}ctx.fillStyle='#ffffff';ctx.fillRect(959,y,2,117);type(`${t.toFixed(3)} s   BEAT ${indexAt(beats,frame)}   CUT ${c.id}   ${c.section}`,50,y+98,20,'#d4dfcc');}
}
window.renderFrame=(t)=>{t=clamp(t,0,215.999);let frame=q(t),ci=indexAt(cuts,frame),c=cuts[ci],sec=c.section,mode=sceneMode(c),local=t-c.time,p=clamp(local/(c.end-c.time)),bi=indexAt(beats,frame),b=beats[bi],next=beats[bi+1],age=Math.max(0,t-b.frame/60),phase=clamp(age/((next?.frame-b.frame)/60||T.period));let impact=t>=b.frame/60?Math.exp(-age*15):0,accent=impact*(.6+Math.min(1,b.strength/250)*.4),swell=Math.sin(phase*Math.PI),[amp,bass,high]=T.envelopes[Math.min(12959,frame)];
 let dark=['boot','polarity','duality','isolation','erase','descent','execution','count','finalchorus','terminal','credits'].includes(sec);if(sec==='polarity'&&c.pose%4===3)dark=false;
 const bg=dark?palettes[sec]:palettes[sec]||0xe5e2d3;scene.background.setHex(bg);scene.fog=new THREE.FogExp2(bg,dark?.023:.013);floor.visible=!dark;grid.visible=sec==='geometry';stars.visible=dark;stars.rotation.y=bi*.003+phase*.003;
 flower.group.visible=!['points','wave','count','credits'].includes(mode);flower.group.scale.setScalar(1);flower.group.position.set(0,0,0);flower.group.rotation.set(0,(bi+phase)*.028,0);flower.stem.visible=sec!=='boot';
 ghost.group.visible=['duality','union'].includes(sec)&&t<110.45;ghost.group.position.set(2.3,0,-.4);ghost.group.scale.setScalar(.75);ghost.group.rotation.set(0,-(bi+phase)*.035,-.25);
 let open=.75,scatter=0;if(sec==='boot'){flower.group.scale.setScalar(mode==='seed'?.28:.55);open=.1+c.pose*.22;}
 if(sec==='overture'||sec==='garden')open=1.1+.06*accent;
 if(['chorus','finalchorus','union'].includes(sec))open=1.45+.26*accent;
 if(sec==='geometry')open=1.1;
 if(['polarity','duality'].includes(sec)){open=.8+.35*swell;flower.group.rotation.y=c.pose*Math.PI/2+phase*.2;}
 if(sec==='duality'){flower.group.position.x=-2.2;flower.group.scale.setScalar(.75);ghost.group.rotation.z=c.pose%2?.2:-.2;}
 if(sec==='union'){flower.group.position.x=-1.2+p*.3;ghost.group.position.x=1.5-p*.3;}
 if(sec==='isolation'){open=.45;flower.group.position.x=2.2;flower.group.rotation.y=2.8;}
 if(sec==='erase'){open=.65;scatter=.1+c.pose*.23+accent*.3;}
 if(sec==='execution'){open=1.5;scatter=.25+c.pose*.07+accent*.8;flower.group.rotation.y=c.pose*Math.PI*.45+phase*.12;flower.group.rotation.z=(c.pose%2?1:-1)*.15*swell;}
 if(sec==='finalchorus'){open=1.4;scatter=.8+.45*accent;flower.group.rotation.y=c.pose*.7+phase*.15;}
 if(['elegy','outro'].includes(sec)){open=.6;flower.group.rotation.y=.3+t*.01;if(sec==='outro')flower.group.scale.setScalar(mix(.85,.28,clamp((t-193.63)/12)));}
 if(mode==='title'||sec==='elegy')flower.group.position.x=1.8;
 const choreoTime=sec==='isolation'?110.55:(bi+phase)*.4;
 animateFlower(flower,choreoTime,open,scatter);animateFlower(ghost,choreoTime,1.2+.1*accent,0,1);
 garden.visible=sec==='garden';for(const [i,f]of gardenFlowers.entries()){f.group.visible=i<=c.pose*3+Math.floor(phase*3);if(garden.visible)animateFlower(f,choreoTime+i,1+.2*accent,0);}
 lattice.visible=['points','assemble','infinity'].includes(mode);lattice.rotation.set(phase*.15,(bi+phase)*.1,0);lattice.scale.setScalar(mode==='assemble'?1.1-p*.5:1+.08*accent);
 helix.visible=mode==='wave'||sec==='polarity';helix.rotation.set((bi+phase)*Math.PI*.25,0,0);
 rings.visible=!['seed','wave','count','credits'].includes(mode);rings.rotation.y=sec==='isolation'?0:(bi+phase)*.015;for(let i=0;i<rings.children.length;i++){let r=rings.children[i];r.material.opacity=.4+.4*Math.exp(-Math.max(0,age-i*.025)*8);r.scale.setScalar(1+.025*accent);}
 halo.visible=['circle','infinity','orbit','chorus','union','outro'].includes(mode)||['chorus','union','outro'].includes(sec);halo.rotation.set((bi+phase)*.035,c.pose*.25,((bi%8)+phase)/8*Math.PI);halo.scale.setScalar(1+.06*accent);
 cage.visible=['isolation','erase','descent','execution','finalchorus','elegy','outro'].includes(sec);cage.rotation.set(sec==='isolation'?0:c.pose*.14,sec==='isolation'?0:(bi+phase)*.026,0);cage.scale.setScalar(sec==='outro'?1+(t-193.63)*.12:1);
 tunnel.visible=['polarity','descent','execution','count'].includes(sec);tunnel.rotation.z=c.pose*Math.PI/4+phase*.045;for(let i=0;i<tunnel.children.length;i++)tunnel.children[i].position.z=-((i*3-(bi+phase)*1.5)%84+84)%84;
 satellites.visible=t<110.45&&sec!=='boot';whiteOrb.visible=t<110.45;redOrb.position.set(Math.sin((bi+phase)*.16)*3.2,Math.cos((bi+phase)*.12)*1.2,Math.cos((bi+phase)*.16)*3.2);whiteOrb.position.copy(redOrb.position).multiplyScalar(-1);
 shards.visible=['erase','descent','execution','finalchorus'].includes(sec);if(shards.visible){shardData.forEach((d,i)=>{let a=d.a+(bi+phase)*.055;dummy.position.set(Math.sin(a)*(d.r+accent*.8),d.y+Math.sin(a+d.k)*1.2,Math.cos(a)*(d.r+accent*.8));dummy.rotation.set(a+d.k,a,phase*.7);dummy.scale.set(d.s,d.s*(2+accent*4),d.s*.28);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);});shards.instanceMatrix.needsUpdate=true;}
 echo.visible=['chorus','polarity','union','finalchorus'].includes(sec);echo.children.forEach((r,i)=>{let a=(phase+i*.25)%1;r.scale.setScalar(2.6+a*2.4);r.position.y=-1.7+i*.04;r.material.opacity=(1-a)*.32;});
 let j=c.pose%8;let cp=poseCameras[j];if(sec==='boot')cp=mode==='detail'?[1,3,5]:[0,3,12];if(sec==='overture'&&c.pose<2)cp=[1,5,18];if(sec==='geometry')cp=[0,3.5,14];if(sec==='isolation')cp=[0,2,15];if(sec==='duality'||sec==='union')cp=[j%2?3:-2,4,16];if(sec==='garden')cp=j%2?[5,6,15]:[0,7,20];if(sec==='elegy')cp=j%2?[1,5,17]:[0,3,15];if(sec==='outro')cp=[0,5,17+(t-193.63)*.4];if(sec==='count')cp=[0,.8,14];
 let strength=['chorus','execution','finalchorus','polarity'].includes(sec)?1:.35;let punch=1-.045*accent*strength;camera.position.set(cp[0]+(p-.5)*.65,cp[1]+(sec==='isolation'?0:.08*swell),cp[2]);camera.position.multiplyScalar(punch);let target=new THREE.Vector3(0,.6,0);if(mode==='title')target.x=-.6;if(sec==='isolation')target.x=-.65;if(['polarity','descent','count'].includes(sec))target.z=-3;
 camera.lookAt(target);camera.fov=sec==='garden'?43:40;camera.updateProjectionMatrix();key.intensity=dark?2:2.5;rim.intensity=dark?2.8:1.4;point.intensity=dark?10+accent*16:4+accent*4;renderer.toneMappingExposure=dark?1.05:1.08;
 renderer.render(scene,camera);ctx.drawImage(glCanvas,0,0);overlay(t,c,local,accent,dark,frame);window.lastTiming={frame,cut:c.id,cutFrame:c.frame,section:sec,beat:b.n,beatFrame:b.frame};return window.lastTiming;
};
window.getFrame=t=>{window.renderFrame(t);return canvas.toDataURL('image/jpeg',.94).slice(23)};
window.shots=cuts.map(c=>[c.time,c.end,c.section,c.pose]);window.duration=216;window.rhythmData=T;
await document.fonts.load('italic 90px FilmSerif');await document.fonts.load('24px FilmMono');await document.fonts.ready;window.renderFrame(60);window.ready=true;
const audio=document.getElementById('audio'),play=document.getElementById('play'),seek=document.getElementById('seek'),clock=document.getElementById('clock');let running=false,anchor=0,offset=0;const audioEnd=212.3305;
function tick(now){if(running){let t=!audio.paused&&audio.currentTime<audioEnd-.02?audio.currentTime:offset+(now-anchor)/1000;window.renderFrame(t);seek.value=t;clock.textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')} / 03:36`;if(t>=216){running=false;play.textContent='REPLAY';}}requestAnimationFrame(tick)}requestAnimationFrame(tick);
play.onclick=async()=>{if(running){running=false;offset=+seek.value;audio.pause();play.textContent='PLAY';}else{offset=+seek.value>=215.9?0:+seek.value;anchor=performance.now();audio.currentTime=Math.min(offset,audioEnd-.02);if(offset<audioEnd-.02)await audio.play();running=true;play.textContent='PAUSE';}};
audio.onended=()=>{if(offset<audioEnd-.02){offset=audioEnd;anchor=performance.now()}};seek.oninput=async()=>{offset=+seek.value;anchor=performance.now();audio.currentTime=Math.min(offset,audioEnd-.02);if(running&&offset<audioEnd-.02&&audio.paused)await audio.play();if(offset>=audioEnd-.02)audio.pause();window.renderFrame(offset);};document.getElementById('full').onclick=()=>document.documentElement.requestFullscreen();if(new URLSearchParams(location.search).has('render'))document.getElementById('ui').classList.add('hide');


