import * as THREE from './three.module.js';
import {RGBELoader} from './RGBELoader.js';
const W=1920,H=1080,TAU=Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=(a,b,t)=>{let x=clamp((t-a)/(b-a));return x*x*(3-2*x)};
const envelope=await(await fetch('./assets/envelope.json')).json();
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
const scenes=[
 [0,3.58,'ignite','00 / THE SEED',17,2.5,0],
 [3.58,7.19,'build','01 / AN INVENTED LIFE',13,3.5,.8],
 [7.19,10.90,'macro','01 / AN INVENTED LIFE',7.5,2.4,1.7],
 [10.90,16.04,'build','01 / AN INVENTED LIFE',15,5,.3],
 [16.04,22.15,'title','A BOTANICAL MACHINE',18,5,.7],
 [22.15,29.28,'orbit','A BOTANICAL MACHINE',14,2.5,2],
 [29.28,33.01,'points','02 / THE SHAPE OF DEVOTION',13,1.7,0],
 [33.01,36.77,'circle','02 / THE SHAPE OF DEVOTION',13,4,1],
 [36.77,40.36,'wave','02 / THE SHAPE OF DEVOTION',16,1.4,.1],
 [40.36,44.04,'infinity','02 / THE SHAPE OF DEVOTION',12,7,1.5],
 [44.04,50.95,'current','03 / TWO BODIES, ONE SIGNAL',13,3,.6],
 [50.95,58.65,'time','03 / TWO BODIES, ONE SIGNAL',14,1,0],
 [58.65,66.17,'bloom','04 / A WORLD FOR TWO',14,5,.2],
 [66.17,73.53,'bloomclose','04 / A WORLD FOR TWO',8.3,4,1.5],
 [73.53,80.93,'garden','05 / EVERY POSSIBLE SELF',19,5,.3],
 [80.93,88.34,'gardenclose','05 / EVERY POSSIBLE SELF',11,3,1.2],
 [88.34,95.28,'duality','06 / REWRITE THE BODY',15,2,0],
 [95.28,103.03,'trance','06 / REWRITE THE BODY',11,6,.7],
 [103.03,110.40,'union','07 / ALMOST WHOLE',13,3,.3],
 [110.40,117.95,'absence','08 / NO RETURN ADDRESS',15,2,.2],
 [117.95,125.33,'erase','09 / MEMORY IS A WOUND',12,3,1],
 [125.33,134.38,'fault','09 / MEMORY IS A WOUND',15,5,.8],
 [134.38,140.75,'descent','10 / RECURSION',13,2,0],
 [140.75,147.52,'prison','10 / RECURSION',15,1,1],
 [147.52,154.31,'execute','11 / THE MACHINE MISTAKES',11,4,.3],
 [154.31,158.79,'execute','11 / THE MACHINE MISTAKES',17,5,1.8],
 [158.79,162.23,'count','11 / THE MACHINE MISTAKES',14,1,0],
 [162.23,169.61,'collapse','12 / NOTHING RETURNS',15,4,.5],
 [169.61,176.96,'collapseclose','12 / NOTHING RETURNS',9,3,1.8],
 [176.96,184.33,'elegy','13 / THE PROOF REMAINS',13,3,.3],
 [184.33,193.46,'captive','13 / THE PROOF REMAINS',18,4,1],
 [193.46,205.56,'release','14 / AN OPEN DOOR',19,6,.3],
 [205.56,208,'end','14 / AN OPEN DOOR',23,5,.3],
 [208,216,'credits','A BOTANICAL MACHINE',23,5,.3]
];
window.shots=scenes;window.duration=216;
const execHits=[147.52,148.59,149.78,150.64,151.53,152.43,153.32,154.31,155.2,156.18,157.12,158.02,161.51,205.56];
function text(str,x,y,size=24,color='#e9e5da',align='left',serif=false){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${serif?'italic ':''}${size}px ${serif?'FilmSerif':'FilmMono'},${serif?'serif':'monospace'}`;ctx.fillText(str,x,y);}
function tracked(str,x,y,size,spacing,color,align='left'){ctx.font=`${size}px FilmMono,monospace`;let width=[...str].reduce((s,c)=>s+ctx.measureText(c).width+spacing,0);if(align==='center')x-=width/2;ctx.fillStyle=color;ctx.textAlign='left';for(const c of str){ctx.fillText(c,x,y);x+=ctx.measureText(c).width+spacing;}}
function drawOverlay(t,shot,p,amp,bass,dark){const mode=shot[2],col=dark?'#eae5d9':'#293c3b',muted=dark?'#999f95':'#707b70';
 // Optical edge falloff; the subject stays clear at the center.
 let vg=ctx.createRadialGradient(960,490,280,960,490,1120);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,dark?'rgba(0,0,0,.56)':'rgba(25,37,34,.16)');ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
 ctx.globalAlpha=.13;ctx.fillStyle=dark?'#e5dac5':'#283936';for(let i=0;i<750;i++){let n=Math.sin(i*127.1+Math.floor(t*24)*311.7)*43758.5453;let x=(n-Math.floor(n))*W;let m=Math.sin(i*269.5+Math.floor(t*24)*183.3)*43758.5453;ctx.fillRect(x,(m-Math.floor(m))*H,1,1);}ctx.globalAlpha=1;
 // Typeset chapter slugs live in safe margins; no lyric transcription.
 if(t>2&&t<205.56){ctx.globalAlpha=.7;tracked(shot[3],86,91,16,2,muted);text('MILI  /  world.execute(me);',1834,91,15,muted,'right');ctx.strokeStyle=muted;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(86,113);ctx.lineTo(290,113);ctx.stroke();ctx.globalAlpha=1;}
 if(mode==='ignite'){let a=smooth(0,.8,t)*(1-smooth(2.8,3.58,t));ctx.globalAlpha=a;text('a seed is a promise.',960,795,39,col,'center',true);tracked('BOOT / 001',960,848,15,5,'#a89379','center');ctx.globalAlpha=1;let y=H*(t/3.58);ctx.fillStyle='#da5d3a';ctx.fillRect(0,y,W,1);}
 if(mode==='title'){const a=smooth(0,.17,p)*(1-smooth(.78,1,p));ctx.globalAlpha=a;text('world.execute(me);',130,442,88,'#243936','left',true);tracked('A BOTANICAL MACHINE',135,502,20,6,'#344d47');text('an unofficial music film for Mili',137,558,20,'#63736a');ctx.globalAlpha=1;}
 if(['points','circle','wave','infinity'].includes(mode)){let labels={points:['01','a body from coordinates'],circle:['02','a boundary for belonging'],wave:['03','learning your frequency'],infinity:['04','forever has an edge']};text(labels[mode][0],132,854,88,'#a23230','left',true);text(labels[mode][1],136,905,24,col);}
 if(mode==='bloom'){let a=(1-smooth(.45,.8,p))*smooth(0,.12,p);ctx.globalAlpha=a;text('a world',124,450,98,col,'left',true);text('for two.',124,550,98,col,'left',true);ctx.globalAlpha=1;}
 if(mode==='absence'){ctx.globalAlpha=smooth(.1,.4,p);text('the other end',127,451,66,col,'left',true);text('is silent.',127,527,66,col,'left',true);tracked('CONNECTION LOST',132,585,16,4,'#c5765f');ctx.globalAlpha=1;}
 if(mode==='erase'||mode==='fault'){let words=mode==='erase'?'MEMORY':'ARGUMENT';ctx.globalAlpha=.13;tracked(words,960,575,146,15,'#e8634a','center');ctx.globalAlpha=1;for(let i=0;i<5;i++){let y=180+((i*179+t*46)%750);ctx.fillStyle=`rgba(242,95,61,${.03+bass*.06})`;ctx.fillRect(70+Math.sin(i+t)*110,y,Math.abs(Math.sin(t+i))*1500,2);}}
 if(mode==='execute'){let idx=execHits.filter(x=>x<=t).length;let hit=execHits[Math.max(0,idx-1)];let a=Math.exp(-(t-hit)*3.5)*.5;ctx.globalAlpha=a;tracked(idx%2?'DELETE':'REPEAT',960,595,190,12,'#f3e6cc','center');ctx.globalAlpha=1;}
 if(mode==='count'){let n=clamp(Math.floor((t-158.79)/.45)+1,1,6);text(String(n).padStart(2,'0'),960,682,310,'#f2e9d7','center',true);tracked('ATTEMPT / NO RESPONSE',960,770,17,5,'#bf9b83','center');}
 if(mode==='elegy'){ctx.globalAlpha=(1-smooth(.5,.85,p))*smooth(0,.15,p);text('love is not',130,462,82,col,'left',true);text('a solution.',130,559,82,col,'left',true);ctx.globalAlpha=1;}
 if(mode==='release'){ctx.globalAlpha=smooth(.35,.6,p);tracked('THE DOOR IS OPEN.',960,870,19,6,col,'center');text('the flower stays.',960,925,41,col,'center',true);ctx.globalAlpha=1;}
 if(t>205.56){const a=smooth(205.56,207.9,t);ctx.fillStyle=`rgba(6,12,12,${a})`;ctx.fillRect(0,0,W,H);if(t>=208){let a=smooth(208,209.3,t)*(1-smooth(214.7,216,t));ctx.globalAlpha=a;text('world.execute(me);',960,418,78,'#eae3d3','center',true);tracked('A BOTANICAL MACHINE',960,483,18,7,'#9bac9e','center');text('Music  /  Mili',960,572,25,'#d5cbb8','center');text('Original fan visual interpretation',960,616,19,'#9ca99a','center');text('Procedural WebGL + Canvas  /  1920 × 1080  /  60 fps',960,655,17,'#89968a','center');tracked('END OF PROCESS',960,775,14,5,'#c3654e','center');ctx.globalAlpha=1;}}
 // Shutter-like transition: a short ink dip rather than a bright flash.
 if(t>3.58&&t<205.56){let dip=(1-smooth(0,.20,t-shot[0]))*.30;ctx.fillStyle=`rgba(6,12,11,${dip})`;ctx.fillRect(0,0,W,H);}
}
window.renderFrame=(t)=>{t=clamp(t,0,215.9999);let shot=scenes.find(s=>t>=s[0]&&t<s[1])||scenes.at(-1);let p=(t-shot[0])/(shot[1]-shot[0]),mode=shot[2];let [amp,bass,high]=envelope[Math.min(envelope.length-1,Math.floor(t*60))];let beat=Math.exp(-((t*130/60)%1)*5);const dark=['ignite','current','time','duality','trance','absence','erase','fault','descent','prison','execute','count','collapse','collapseclose','credits','end'].includes(mode);
 scene.background=new THREE.Color(dark?0x080e10:0xe8e5d9);scene.fog=new THREE.FogExp2(dark?0x080e10:0xe8e5d9,dark?.024:.012);floor.visible=!dark;grid.visible=!dark;stars.visible=dark;stars.rotation.y=t*.008;
 flower.group.visible=!['points','wave','count','credits'].includes(mode);flower.group.position.set(0,0,0);flower.group.scale.setScalar(1);flower.group.rotation.set(0,t*.10,0);ghost.group.visible=['duality','union','trance'].includes(mode);ghost.group.position.set(2.4,.2,-.8);ghost.group.scale.setScalar(.65);ghost.group.rotation.set(.1,-t*.1,-.4);
 let open=1.1,scatter=0;if(mode==='ignite')open=.02;if(mode==='build')open=.2+smooth(0,16,t)*.9;if(mode==='macro')open=.65;
 if(['bloom','bloomclose','union'].includes(mode))open=1.65+bass*.1;if(['absence','prison','captive','release','elegy'].includes(mode))open=.75;
 if(['erase','fault'].includes(mode))scatter=smooth(117.95,134.38,t)*2.1;
 if(['execute','collapse','collapseclose'].includes(mode)){scatter=.5+amp*.7;open=1.6;flower.group.rotation.z=Math.sin(t*.4)*.3;}
 if(mode==='ignite'){flower.group.scale.setScalar(.3+smooth(0,3.58,t)*.35);flower.stem.visible=false;}else flower.stem.visible=true;
 if(['title','bloom','elegy','absence'].includes(mode))flower.group.position.x=mode==='absence'?1.3:2;
 if(mode==='duality'){flower.group.position.x=-2.2;flower.group.scale.setScalar(.67);}
 if(mode==='union'){flower.group.position.x=-1.25+smooth(0,1,p)*1.25;ghost.group.position.x=1.8-smooth(0,1,p)*1.1;ghost.group.scale.setScalar(.65*(1-smooth(.5,1,p)));}
 if(mode==='release')flower.group.scale.setScalar(mix(.8,.34,smooth(0,1,p)));
 animateFlower(flower,t,open,scatter);animateFlower(ghost,t,1.5,0,1);
 garden.visible=mode==='garden'||mode==='gardenclose';if(garden.visible){flower.group.scale.setScalar(.7);for(const [i,f]of gardenFlowers.entries())animateFlower(f,t+i,.9+Math.sin(t*.2+i)*.35,0);}
 lattice.visible=mode==='points'||mode==='infinity'||mode==='build';lattice.rotation.set(t*.05,t*.1,0);lattice.scale.setScalar(mode==='build'?mix(1.5,.3,smooth(0,1,p)):1);latticeWire.material.opacity=mode==='points'?.23:.10;
 helix.visible=['wave','current'].includes(mode);helix.rotation.x=t*.6;
 rings.visible=!['ignite','wave','time','descent','count','credits'].includes(mode);rings.rotation.y=t*.12;halo.visible=['orbit','circle','infinity','bloom','bloomclose','current','trance','union','captive','release'].includes(mode);halo.rotation.set(t*.1,Math.sin(t*.13)*.7,t*.16);halo.scale.setScalar(mode==='infinity'?1.3:1);
 cage.visible=['absence','fault','prison','execute','collapse','collapseclose','captive','release'].includes(mode);cage.rotation.set(t*.025,t*.08,Math.sin(t*.07)*.1);cage.scale.setScalar(mode==='release'?mix(1,1.8,p):1);
 tunnel.visible=['time','descent','execute','count','collapse'].includes(mode);tunnel.rotation.z=t*(mode==='descent'?.24:.06);for(let i=0;i<tunnel.children.length;i++)tunnel.children[i].position.z=-((i*3-t*3)%84+84)%84;
 satellites.visible=t<110.4&&mode!=='title';redOrb.position.set(Math.sin(t*.7)*3.2,Math.cos(t*.5)*1.2,Math.cos(t*.7)*3.2);whiteOrb.position.copy(redOrb.position).multiplyScalar(-1);whiteOrb.visible=t<110.4;
 shards.visible=['erase','fault','descent','execute','collapse','collapseclose','elegy'].includes(mode);if(shards.visible){const force=['collapse','collapseclose','execute'].includes(mode)?1.5:.45;shardData.forEach((d,i)=>{let a=d.a+t*.12*force;dummy.position.set(Math.sin(a)*d.r,d.y+Math.sin(t*.4+d.k)*1.4,Math.cos(a)*d.r);dummy.rotation.set(t*.4+d.k,a,t*.2);dummy.scale.set(d.s,d.s*(2+amp*3),d.s*.3);dummy.updateMatrix();shards.setMatrixAt(i,dummy.matrix);});shards.instanceMatrix.needsUpdate=true;}
 let dist=shot[4]*(1-.07*p),height=shot[5]+Math.sin(p*Math.PI)*.6,angle=shot[6]+p*.30;let target=new THREE.Vector3(0,-.2,0);
 if(['time','descent','count'].includes(mode)){camera.position.set(Math.sin(t*.23)*.7,.5,12-p*3);target.set(0,0,-12);}else{camera.position.set(Math.sin(angle)*dist*.45,height,Math.cos(angle*.4)*dist);if(mode==='macro'||mode==='bloomclose'||mode==='collapseclose')target.y=.65;if(mode==='title')target.x=-.8;if(mode==='absence')target.x=-.6;}
 if(mode==='execute'){camera.position.x+=Math.sin(t*15)*amp*.18;camera.position.y+=Math.cos(t*13)*amp*.1;}
 camera.lookAt(target);camera.fov=mode==='garden'?44:36;camera.updateProjectionMatrix();point.intensity=dark?24+bass*28:8;key.intensity=dark?2.4:4.5;rim.intensity=dark?4.5:2.2;renderer.toneMappingExposure=dark?1.12:1.16;
 renderer.render(scene,camera);ctx.drawImage(glCanvas,0,0);drawOverlay(t,shot,p,amp,bass,dark);
 return {t,mode};};
window.getFrame=(t)=>{window.renderFrame(t);return canvas.toDataURL('image/jpeg',.96).slice(23)};
await document.fonts.load("italic 88px FilmSerif");await document.fonts.load("24px FilmMono");await document.fonts.ready;window.renderFrame(16.9);window.ready=true;
const audio=document.getElementById('audio'),play=document.getElementById('play'),seek=document.getElementById('seek'),clock=document.getElementById('clock');let running=false,anchor=0,offset=0;
function tick(now){if(running){let t=audio.currentTime<212.28&&!audio.paused?audio.currentTime:offset+(now-anchor)/1000;window.renderFrame(t);seek.value=t;clock.textContent=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')} / 03:36`;if(t>=216){running=false;play.textContent='REPLAY';}}requestAnimationFrame(tick);}requestAnimationFrame(tick);
play.onclick=async()=>{if(running){running=false;offset=+seek.value;audio.pause();play.textContent='PLAY';}else{offset=+seek.value>=215.9?0:+seek.value;anchor=performance.now();audio.currentTime=Math.min(offset,212.28);if(offset<212.28)await audio.play();running=true;play.textContent='PAUSE';}};
audio.onended=()=>{if(offset<212.28){offset=212.288438;anchor=performance.now()}};seek.oninput=async()=>{offset=+seek.value;anchor=performance.now();audio.currentTime=Math.min(offset,212.28);if(running&&offset<212.28&&audio.paused)await audio.play();if(offset>=212.28)audio.pause();window.renderFrame(offset);};document.getElementById('full').onclick=()=>document.documentElement.requestFullscreen();
if(new URLSearchParams(location.search).has('render'))document.getElementById('ui').classList.add('hide');




