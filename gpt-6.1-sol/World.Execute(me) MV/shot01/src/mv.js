import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';

// GLASS GARDEN — a deterministic, original visual interpretation.
// Every transform is a pure function of musical time. No simulation drift.
const W=1920,H=1080,TAU=Math.PI*2;
const screen=document.querySelector('#screen');
const ctx=screen.getContext('2d',{alpha:false,willReadFrequently:true});
const [analysis,config]=await Promise.all([fetch('../assets/audio/analysis.json').then(r=>r.json()),fetch('/config').then(r=>r.json())]);
await document.fonts.load('500 100px Cormorant');await document.fonts.load('14px Plex');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v)};
const lerp=(a,b,t)=>a+(b-a)*t;
function rand(i){const v=Math.sin(i*127.1+617.3)*43758.5453123;return v-Math.floor(v)}
const colorA=new THREE.Color(),colorB=new THREE.Color();
const mixColor=(a,b,t)=>colorA.set(a).lerp(colorB.set(b),t).clone();
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();scene.background=new THREE.Color('#bbc8c2');
scene.fog=new THREE.FogExp2('#bbc8c2',.027);
const camera=new THREE.PerspectiveCamera(39,W/H,.1,160);
const hemi=new THREE.HemisphereLight('#d8f1e7','#344940',2.5);scene.add(hemi);
const key=new THREE.DirectionalLight('#fff3d1',4.4);key.position.set(4,8,5);scene.add(key);
const rim=new THREE.DirectionalLight('#9ee0e0',3.2);rim.position.set(-5,3,-5);scene.add(rim);
const coreLight=new THREE.PointLight('#e0a878',5,20,1.5);coreLight.position.set(0,.5,1);scene.add(coreLight);
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(W/2,H/2),.35,.75,.65);composer.addPass(bloom);composer.addPass(new OutputPass());

const ceramic=new THREE.MeshStandardMaterial({color:'#ece4cc',roughness:.29,metalness:.24,side:THREE.DoubleSide});
const gold=new THREE.MeshStandardMaterial({color:'#bc8a43',roughness:.24,metalness:.75});
const darkMetal=new THREE.MeshStandardMaterial({color:'#24433c',roughness:.3,metalness:.65});
const glass=new THREE.MeshStandardMaterial({color:'#bdede2',roughness:.16,metalness:.5,transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false});
const emissive=new THREE.MeshStandardMaterial({color:'#ffd9aa',emissive:'#ffad72',emissiveIntensity:.6,roughness:.19,metalness:.5});
const redMaterial=new THREE.MeshStandardMaterial({color:'#ac2436',emissive:'#610411',emissiveIntensity:.7,roughness:.27,metalness:.35,side:THREE.DoubleSide});
const lineMaterial=new THREE.LineBasicMaterial({color:'#789991',transparent:true,opacity:.5});
const redLine=new THREE.LineBasicMaterial({color:'#ef475b',transparent:true,opacity:.45});
function mesh(geo,mat,parent=scene){const m=new THREE.Mesh(geo,mat);parent.add(m);return m;}
function ring(radius,tube,mat,parent=scene){return mesh(new THREE.TorusGeometry(radius,tube,8,96),mat,parent)}
function line(points,mat,parent=scene){const g=new THREE.BufferGeometry().setFromPoints(points);const l=new THREE.Line(g,mat);parent.add(l);return l;}
function sphere(r,mat,parent=scene){return mesh(new THREE.SphereGeometry(r,40,24),mat,parent)}

const stage=new THREE.Group();scene.add(stage);
const disk=mesh(new THREE.CylinderGeometry(4.1,4.25,.23,96),darkMetal,stage);disk.position.y=-2.6;
const inset=mesh(new THREE.CylinderGeometry(3.85,3.85,.07,96),ceramic,stage);inset.position.y=-2.44;
for(let i=0;i<4;i++){const r=ring(3.4+i*.2,.012,gold,stage);r.rotation.x=Math.PI/2;r.position.y=-2.38;}
const floor=mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#b6c3bd',metalness:.3,roughness:.48}),stage);floor.rotation.x=-Math.PI/2;floor.position.y=-2.78;
const shadow=sphere(1,new THREE.MeshBasicMaterial({color:'#264b41',transparent:true,opacity:.13,depthWrite:false}),stage);shadow.position.y=-2.37;shadow.scale.set(2.3,.015,2.3);
const architecture=new THREE.Group();scene.add(architecture);const columns=[];
for(let i=0;i<22;i++){
 const a=i/22*TAU,rad=9.4;
 const col=new THREE.Group();architecture.add(col);col.position.set(Math.cos(a)*rad,-2.7,Math.sin(a)*rad);columns.push(col);
 const base=mesh(new THREE.CylinderGeometry(.4,.5,.16,16),ceramic,col);base.position.y=.08;
 const post=mesh(new THREE.CylinderGeometry(.1,.16,9.5,12),ceramic,col);post.position.y=4.9;
 const cap=mesh(new THREE.SphereGeometry(.23,16,8),gold,col);cap.position.y=9.8;
 const aRing=ring(.45,.025,gold,col);aRing.position.y=9.8;aRing.rotation.x=Math.PI/2;
}
const arches=[];
for(let i=0;i<5;i++){
 const g=new THREE.Group();architecture.add(g);g.position.z=-8-i*6;
 const arc=ring(6.9,.045,gold,g);arc.position.y=1.6;
 for(const x of [-6.9,6.9]){const p=mesh(new THREE.CylinderGeometry(.04,.04,8,8),gold,g);p.position.set(x,1.3,0)}
 arches.push(g);
}

const organism=new THREE.Group();scene.add(organism);
const heart=sphere(.43,emissive,organism);
const inner=mesh(new THREE.IcosahedronGeometry(.58,2),new THREE.MeshBasicMaterial({color:'#eccd9b',wireframe:true,transparent:true,opacity:.3}),organism);
const seedShell=mesh(new THREE.IcosahedronGeometry(.75,1),glass,organism);
const spindle=mesh(new THREE.CylinderGeometry(.018,.025,3.2,12),gold,organism);spindle.position.y=-1.3;
const petals=[];
function petalGeometry(){
 const uCount=26,vCount=12,pos=[],uv=[],idx=[];
 for(let u=0;u<=uCount;u++)for(let v=0;v<=vCount;v++){
  const s=u/uCount,q=v/vCount*2-1;
  const width=Math.sin(Math.PI*s)**.8*.64;
  pos.push(q*width,Math.sin(s*Math.PI*.8)*.3+q*q*.17, s*2.75+.06);
  uv.push(v/vCount,s);
 }
 for(let u=0;u<uCount;u++)for(let v=0;v<vCount;v++){
  const a=u*(vCount+1)+v,b=a+vCount+1;idx.push(a,b,a+1,b,b+1,a+1);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
const petalGeo=petalGeometry();
for(let i=0;i<32;i++){
 const pivot=new THREE.Group();organism.add(pivot);
 const layer=Math.floor(i/8),a=i%8/8*TAU+layer*.42;
 pivot.rotation.y=a;pivot.userData={a,layer,i};
 const p=mesh(petalGeo,layer===3?gold:ceramic,pivot);const scale=1-layer*.18;p.scale.set(scale,scale,scale);
 const vein=line(Array.from({length:24},(_,j)=>{const s=j/23;return new THREE.Vector3(0,Math.sin(s*Math.PI*.8)*.3+.009,s*2.75+.06)}),new THREE.LineBasicMaterial({color:'#b69959',transparent:true,opacity:.7}),p);
 petals.push(pivot);
}
const filaments=[];
for(let i=0;i<40;i++){
 const a=i/40*TAU;
 const g=new THREE.Group();organism.add(g);g.rotation.y=a;g.rotation.x=-.8;
 const rod=mesh(new THREE.CylinderGeometry(.009,.014,1.8,5),gold,g);rod.position.y=.9;
 const tip=sphere(.045,emissive,g);tip.position.y=1.8;
 filaments.push(g);
}
const halo=new THREE.Group();scene.add(halo);
const haloRings=[];
for(let i=0;i<5;i++){
 const r=ring(3.4+i*.16,.012,i%2?gold:darkMetal,halo);r.rotation.set(i*.38,i*.6,0);haloRings.push(r);
}
const enclosure=new THREE.Group();scene.add(enclosure);
const globe=mesh(new THREE.SphereGeometry(4.4,48,32),glass,enclosure);
const cageEdges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(4.15,1)),lineMaterial);enclosure.add(cageEdges);
const meridians=[];
for(let i=0;i<16;i++){
 const r=ring(4.45,.008,gold,enclosure);r.rotation.y=i/16*Math.PI;meridians.push(r);
}
const observer=new THREE.Group();scene.add(observer);
const observerCore=mesh(new THREE.IcosahedronGeometry(.25,2),gold,observer);
const observerHalo=ring(.43,.018,emissive,observer);
const observerGlow=sphere(.3,new THREE.MeshBasicMaterial({color:'#f0d4aa',transparent:true,opacity:.18,depthWrite:false}),observer);
const threadGeo=new THREE.BufferGeometry();threadGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(100*3),3));
const thread=new THREE.Line(threadGeo,new THREE.LineBasicMaterial({color:'#b28756',transparent:true,opacity:.65}));scene.add(thread);

const maths=new THREE.Group();scene.add(maths);
const dimensionBox=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.2,6.2,6.2)),lineMaterial);maths.add(dimensionBox);
const mathOrbit=ring(3.05,.022,gold,maths);
const sineGeo=new THREE.BufferGeometry();sineGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(260*3),3));
const sine=new THREE.Line(sineGeo,new THREE.LineBasicMaterial({color:'#dae9d7',transparent:true,opacity:.9}));maths.add(sine);
const pointsGeo=new THREE.BufferGeometry(),pointsArray=new Float32Array(450*3);
for(let i=0;i<450;i++){const a=rand(i+400)*TAU,z=rand(i+700)*2-1,r=Math.sqrt(1-z*z)*3.1;pointsArray[i*3]=Math.cos(a)*r;pointsArray[i*3+1]=z*3.1;pointsArray[i*3+2]=Math.sin(a)*r;}
pointsGeo.setAttribute('position',new THREE.BufferAttribute(pointsArray,3));
const mathPoints=new THREE.Points(pointsGeo,new THREE.PointsMaterial({color:'#f4e6c4',size:.035,sizeAttenuation:true}));maths.add(mathPoints);

const garden=new THREE.Group();scene.add(garden);
const flowers=[];
for(let i=0;i<40;i++){
 const a=rand(i+12)*TAU,r=5+rand(i+25)*15;
 const f=new THREE.Group();garden.add(f);f.position.set(Math.cos(a)*r,-2.4,Math.sin(a)*r);f.userData={i};
 const stem=mesh(new THREE.CylinderGeometry(.012,.02,1.5,5),gold,f);stem.position.y=.65;
 for(let p=0;p<5;p++){
  const l=mesh(new THREE.SphereGeometry(.28,12,8),ceramic,f);l.position.set(Math.cos(p/5*TAU)*.24,1.45,Math.sin(p/5*TAU)*.24);l.scale.set(.48,.2,1.2);l.rotation.y=-p/5*TAU;
 }
 const bud=sphere(.11,emissive,f);bud.position.y=1.45;
 flowers.push(f);
}
const swarm=new THREE.Group();scene.add(swarm);
const moths=[];
for(let i=0;i<18;i++){
 const m=new THREE.Group();swarm.add(m);const wings=[];
 for(let s of [-1,1]){
  const w=new THREE.Group();m.add(w);const g=petalGeo.clone();const shape=mesh(g,ceramic,w);shape.scale.set(.35,.5,.32);shape.rotation.y=s*.9;w.userData.s=s;wings.push(w);
 }
 const body=mesh(new THREE.CylinderGeometry(.015,.01,.4,6),gold,m);body.rotation.x=Math.PI/2;
 moths.push({m,wings,i});
}

const tunnel=new THREE.Group();scene.add(tunnel);
const gates=[];
for(let i=0;i<24;i++){
 const g=new THREE.Group();tunnel.add(g);g.position.z=-i*4;
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(5.5)),redLine);g.add(edges);
 const r=ring(3.8,.028,redMaterial,g);g.add(r);
 for(let j=0;j<4;j++){
  const shard=mesh(new THREE.ConeGeometry(.35,2.6,3),redMaterial,g);shard.position.set(Math.cos(j/4*TAU)*4.2,Math.sin(j/4*TAU)*4.2,0);shard.rotation.z=j/4*TAU;
 }
 gates.push(g);
}
const shards=new THREE.Group();scene.add(shards);
const shardItems=[];
for(let i=0;i<110;i++){
 const s=mesh(new THREE.TetrahedronGeometry(.08+rand(i+351)*.22),i%3===0?gold:ceramic,shards);shardItems.push(s);
}
const dustGeo=new THREE.BufferGeometry(),dustPos=new Float32Array(1000*3);
for(let i=0;i<1000;i++){dustPos[i*3]=(rand(i+97)-.5)*65;dustPos[i*3+1]=(rand(i+303)-.5)*32;dustPos[i*3+2]=(rand(i+617)-.5)*65;}
dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#f0dbc0',size:.025,transparent:true,opacity:.65,depthWrite:false}));scene.add(dust);

const nebula=await new THREE.TextureLoader().loadAsync('../assets/textures/cosmic-cliffs.png');nebula.colorSpace=THREE.SRGBColorSpace;
const cosmos=mesh(new THREE.SphereGeometry(90,48,24),new THREE.MeshBasicMaterial({map:nebula,color:'#24363a',side:THREE.BackSide,transparent:true,opacity:0,depthWrite:false,fog:false}));
// Runtime signals are invented narrative text, never a lyric transcription.
const shots=[
 {s:0,e:3.873,id:'boot',a:.2,p:.08,r:4.3,open:0,title:'A spark, given a name.',sub:'01 / THE GLASS GARDEN'},
 {s:3.873,e:7.446,id:'create',a:-.6,p:.3,r:8,open:.15},
 {s:7.446,e:11.095,id:'create',a:1.2,p:.62,r:7,open:.32},
 {s:11.095,e:14.6,id:'garden',a:2.3,p:.2,r:15,open:.6},
 {s:14.6,e:22,id:'garden',a:.2,p:.23,r:12.5,open:.8,title:'world.execute(me);',sub:'MILI / AN ORIGINAL FAN FILM'},
 {s:22,e:29.709,id:'garden',a:2.5,p:.95,r:11,open:1},
 {s:29.709,e:33.412,id:'points',a:.4,p:.16,r:10,open:.55,title:'The shape of devotion.',sub:'02 / EVERYTHING I CAN BECOME'},
 {s:33.412,e:37.067,id:'circle',a:1.6,p:.72,r:9,open:.7},
 {s:37.067,e:40.706,id:'sine',a:.1,p:.1,r:11,open:.8},
 {s:40.706,e:44.452,id:'limit',a:-.65,p:.25,r:11,open:.4},
 {s:44.452,e:51.363,id:'polarity',a:.5,p:.44,r:8,open:.7},
 {s:51.363,e:59.223,id:'time',a:.3,p:.87,r:10,open:.9},
 {s:59.223,e:66.601,id:'union',a:.3,p:.2,r:11,open:1,title:'A world made for two.',sub:'03 / MUTUAL ORBIT'},
 {s:66.601,e:74.045,id:'cage',a:1.4,p:.28,r:14,open:.9},
 {s:74.045,e:81.351,id:'fruit',a:-.3,p:.13,r:7,open:.85},
 {s:81.351,e:85.078,id:'moth',a:.7,p:.18,r:9,open:1},
 {s:85.078,e:88.587,id:'god',a:0,p:.02,r:12,open:1},
 {s:88.587,e:95.465,id:'morph',a:-1.1,p:.4,r:9,open:.6},
 {s:95.465,e:103.489,id:'mirror',a:0,p:1.3,r:11,open:.8},
 {s:103.489,e:110.9,id:'completion',a:.6,p:.2,r:11,open:1},
 {s:110.9,e:118.333,id:'leave',a:.1,p:.08,r:19,open:.75,title:'The orbit breaks.',sub:'04 / NO RESPONSE'},
 {s:118.333,e:125.708,id:'erase',a:1.4,p:.5,r:10,open:.4},
 {s:125.708,e:133.5,id:'error',a:.2,p:.15,r:12,open:.25,title:'I cannot undo absence.',sub:'05 / THE GARDEN REFUSES'},
 {s:133.5,e:140.884,id:'red',a:0,p:.02,r:11,open:.15},
 {s:140.884,e:147.66,id:'red',a:.6,p:.3,r:8.2,open:.55},
 {s:147.66,e:153.2,id:'execute',a:.2,p:.1,r:9.5,open:.75,title:'RUN / REPEAT',sub:'06 / A LOVE THAT CANNOT RETURN'},
 {s:153.2,e:158.9,id:'execute',a:1.8,p:.5,r:7.5,open:.9},
 {s:158.9,e:162.632,id:'count',a:0,p:0,r:10.5,open:.3},
 {s:162.632,e:169.824,id:'execute',a:.2,p:.35,r:10,open:1},
 {s:169.824,e:177.246,id:'resurrect',a:1.2,p:.15,r:12,open:.8},
 {s:177.246,e:188.483,id:'algebra',a:.1,p:.28,r:11,open:.65,title:'Every answer. No reply.',sub:'07 / THE UNSOLVED VARIABLE'},
 {s:188.483,e:195.5,id:'prison',a:1.3,p:.2,r:18,open:.6},
 {s:195.5,e:205.811,id:'prison',a:.1,p:.45,r:23,open:.45,title:'You leave the world.\nThe world keeps you.',sub:'08 / MEMORY WITHOUT AN EXIT'},
 {s:205.811,e:208.15,id:'final',a:0,p:.1,r:5,open:0},
 {s:208.15,e:214.38,id:'coda',a:.2,p:.08,r:14,open:.12,title:'Still running.',sub:'WORLD.EXECUTE(ME); / MILI'},
];
window.shots=shots;
function getShot(t){return shots.find(s=>t>=s.s&&t<s.e)||shots.at(-1)}
const noiseCanvas=document.createElement('canvas');noiseCanvas.width=256;noiseCanvas.height=256;
const noiseCtx=noiseCanvas.getContext('2d'),nd=noiseCtx.createImageData(256,256);
for(let i=0;i<65536;i++){const v=Math.floor(rand(i+421)*255);nd.data.set([v,v,v,255],i*4)}noiseCtx.putImageData(nd,0,0);
const noisePattern=ctx.createPattern(noiseCanvas,'repeat');

function animate(t){
 const shot=getShot(t),q=clamp((t-shot.s)/(shot.e-shot.s)),e=smooth(q),id=shot.id;
 const f=analysis.features[Math.min(analysis.frames-1,Math.max(0,Math.floor(t*60)))]||[0,0,0];
 const amp=t>analysis.duration?0:f[0],bass=t>analysis.duration?0:f[1];
 const beat=(t-.213)*130/60,pulse=Math.exp(-((beat%1+1)%1)*8);
 const red= t<125.708?0:t<133.5?smooth((t-125.708)/7.792):t<177.246?1:t<188.483?1-smooth((t-177.246)/11.237)*.72:t<205.811?.28:t<208.15?1:0;
 const dark=clamp((t<103.489?0:t<110.9?smooth((t-103.489)/7.411)*.4:t<118.333?smooth((t-110.9)/7.433)*.6+.4:t<177.246?1:t<188.483?lerp(1,.65,e):t<208.15?.8:1)*1.25);
 scene.background.copy(mixColor('#b9c8c2','#071216',dark).lerp(new THREE.Color('#28020c'),red*.65));scene.fog.color.copy(scene.background);scene.fog.density=.015+dark*.016;
 floor.material.color.copy(mixColor('#b6c3bd','#091614',dark));floor.material.roughness=.4;
 ceramic.color.copy(mixColor('#e8e5d1','#d09393',red));ceramic.emissive.set('#3b0010');ceramic.emissiveIntensity=red*.25;
 gold.color.copy(mixColor('#b99b5b','#a32a35',red));gold.emissive.set('#920116');gold.emissiveIntensity=red*.25;
 emissive.color.copy(mixColor('#ffe8bf','#fb5263',red));emissive.emissive.copy(mixColor('#e19f53','#ee123a',red));emissive.emissiveIntensity=.45+amp*.35+red*.7;
 hemi.intensity=lerp(1.6,.55,dark);key.intensity=lerp(2.8,2.1,dark);key.color.copy(mixColor('#fff2d4','#ff6777',red));
 rim.color.copy(mixColor('#8cd6d7','#78a3cd',dark));rim.intensity=2.2+dark*1.1;coreLight.color.copy(emissive.color);coreLight.intensity=2+red*2.5+amp;
 bloom.strength=.16+dark*.25+red*.18;bloom.threshold=.88-red*.12;renderer.toneMappingExposure=.89-dark*.07;
 cosmos.material.opacity=dark*(1-red*.7)*.48;cosmos.rotation.y=t*.003;
 stage.visible=!['execute','count','red','final'].includes(id);architecture.visible=!['execute','count','red','final','coda','leave','erase','algebra','prison'].includes(id);
 garden.visible=['garden','union','fruit','moth','god','morph','mirror','completion','leave','algebra','prison'].includes(id);
 garden.rotation.y=t*.005;
 for(const flow of flowers){const i=flow.userData.i;const v=.7+rand(i+15)*.9;flow.scale.setScalar(v*(.85+.1*Math.sin(t*1.2+i)+amp*.025));}
 organism.visible=true;organism.rotation.set(.4,t*.11,0);organism.position.set(0,Math.sin(t*.5)*.06,0);organism.scale.setScalar(1);
 let openness=shot.open+.025*Math.sin(t*2)+amp*.035;
 if(id==='boot'){openness=.03;organism.scale.setScalar(.62+e*.12);}
 if(id==='create')openness=lerp(shot.open,shot.open+.18,e);
 if(['morph','mirror','polarity'].includes(id)){openness=.35+.3*(.5+.5*Math.sin(t*1.8));organism.rotation.z=Math.sin(t*.7)*.3;}
 if(id==='leave')openness=.7-e*.25;
 if(id==='erase')openness=.42-e*.22;
 if(id==='error')openness=.25-.1*e;
 if(['red','execute','count'].includes(id)){organism.rotation.z=Math.sin(t*.6)*.22;organism.rotation.y=t*.4;openness=shot.open+pulse*.06;}
 if(id==='algebra')openness=.25+e*.48;
 if(id==='prison')openness=shot.open+amp*.02;
 if(id==='coda')organism.scale.setScalar(.3);
 if(id==='points')organism.scale.setScalar(.6);
 if(id==='circle')organism.scale.setScalar(.68);
 if(id==='sine')organism.scale.setScalar(.65);
 if(id==='god')organism.rotation.set(Math.PI/2,0,0);
 const fragment= id==='erase'?e:id==='error'?.75:id==='red'?.8:id==='execute'?.45:id==='resurrect'?.65*(1-e):0;
 for(const p of petals){const {a,layer,i}=p.userData;
  const unfold=clamp(openness-layer*.08);
  p.rotation.set(-Math.PI/2+unfold*(1.28+layer*.11),a+t*.025*(layer%2?1:-1),0);
  const fly=fragment*(i%3===0?1:0);
  p.position.set(Math.sin(a)*fly*(2.5+rand(i+17)*3),-fly*(1.2+rand(i+37)*3),Math.cos(a)*fly*(2.5+rand(i+17)*3));
  p.rotation.z=fly*Math.sin(t+i)*.5;
  p.visible=!(id==='coda'&&layer<2)&&!(id==='points'&&layer<3)&&!(id==='circle'&&layer<2);
 }
 heart.scale.setScalar(1+amp*.045+pulse*.015);heart.rotation.y=-t*.12;inner.rotation.set(t*.13,t*.16,0);inner.scale.setScalar(1+pulse*.1);seedShell.rotation.set(t*.08,t*.12,0);
 for(let i=0;i<filaments.length;i++){filaments[i].rotation.x=-1.3+openness*.75+Math.sin(t*1.5+i)*.035;}
 halo.visible=!['boot','create','fruit','moth','leave','erase','coda','final'].includes(id);
 halo.rotation.set(t*.024,0,t*.043);halo.scale.setScalar(id==='god'?1.4:id==='error'?.7:1);
 for(let i=0;i<haloRings.length;i++){haloRings[i].scale.setScalar(id==='god'?1-i*.08:1);haloRings[i].rotation.y=t*.12*(i%2?1:-1)+i*.6;haloRings[i].rotation.x=i*.38+Math.sin(t*.4+i)*.2;if(id==='god')haloRings[i].rotation.set(0,0,t*.2);}
 const cageOn=['cage','limit','god','completion','leave','erase','error','algebra','prison','coda'].includes(id);
 enclosure.visible=cageOn;globe.visible=['cage','completion','leave','coda','prison'].includes(id);
 cageEdges.visible=['limit','error','algebra','prison'].includes(id);enclosure.rotation.y=t*.05;enclosure.rotation.z=Math.sin(t*.13)*.08;
 meridians.forEach((r,i)=>{r.visible=id==='prison'||id==='coda'||id==='error'||(id==='cage'&&i%3===0);r.rotation.z=t*.025*(i%2?1:-1)});
 enclosure.scale.setScalar(id==='coda'?.6:id==='prison'?1.12:1);
 observer.visible= t<118.333 && id!=='boot' ||id==='resurrect';
 const orbitA=t*.32,orbitR=3.2;
 observer.position.set(Math.sin(orbitA)*orbitR,Math.cos(orbitA*.7)*1.3,Math.cos(orbitA)*orbitR);
 if(id==='leave'){observer.position.set(2+e*17,1+e*8,-e*9);observer.scale.setScalar(1-e*.8)}else observer.scale.setScalar(1);
 if(id==='resurrect'){observer.position.set(Math.sin(t)*3,Math.cos(t*.7)*2,Math.cos(t)*3);observer.scale.setScalar(.4+Math.sin(t*10)*.1)}
 observer.rotation.set(t*.7,t*.5,t*.3);observerHalo.rotation.y=t;
 thread.visible=observer.visible && id!=='resurrect';
 const threadArr=threadGeo.attributes.position.array;
 for(let i=0;i<100;i++){const u=i/99;threadArr[i*3]=observer.position.x*u+Math.sin(u*Math.PI)*Math.sin(t*.8)*.3;threadArr[i*3+1]=observer.position.y*u-Math.sin(u*Math.PI)*1.1;threadArr[i*3+2]=observer.position.z*u;}
 threadGeo.attributes.position.needsUpdate=true;
 maths.visible=['points','circle','sine','limit','time','algebra','mirror'].includes(id);
 dimensionBox.visible=['points','limit','algebra'].includes(id);mathOrbit.visible=['circle','time','mirror','algebra'].includes(id);sine.visible=['sine','time','algebra'].includes(id);mathPoints.visible=['points','algebra'].includes(id);
 maths.rotation.set(.2,t*.12,0);mathOrbit.rotation.set(Math.PI/2+.4*Math.sin(t*.3),t*.2,0);dimensionBox.rotation.set(t*.08,t*.06,0);mathPoints.rotation.set(0,-t*.15,0);
 const sa=sineGeo.attributes.position.array;
 for(let i=0;i<260;i++){const u=i/259;sa[i*3]=(u-.5)*12;sa[i*3+1]=Math.sin(u*TAU*2+t*1.5)*1.4;sa[i*3+2]=Math.cos(u*TAU+t)*.6;}
 sineGeo.attributes.position.needsUpdate=true;
 swarm.visible=['moth','garden','union','completion','prison'].includes(id);
 for(const {m,wings,i}of moths){const a=t*.15+i*2.399,r=2+rand(i+312)*5;m.position.set(Math.cos(a)*r,.5+Math.sin(t*.55+i)*1.6,Math.sin(a)*r);m.rotation.y=-a;m.scale.setScalar(.5+rand(i+23)*.5);wings.forEach(w=>w.rotation.z=Math.sin(t*9+i)*.65*w.userData.s)}
 tunnel.visible=['red','execute','count','resurrect','final'].includes(id);
 tunnel.position.z=0;
 for(let i=0;i<gates.length;i++){const g=gates[i];g.rotation.z=i*.17+t*.06;g.position.z=-((i*4+(t-133.5)*2.6)%96);g.scale.setScalar(1+Math.sin(t*.9+i)*.05);}
 shards.visible=['erase','error','red','execute','resurrect','prison','final'].includes(id);
 for(let i=0;i<shardItems.length;i++){const s=shardItems[i],a=i*2.399+t*.05,r=3+rand(i+42)*8;
  s.position.set(Math.cos(a)*r,Math.sin(t*.23+i)*3.4,Math.sin(a)*r-2);s.rotation.set(t*.25+i,t*.13+i*.2,t*.16);s.scale.setScalar(id==='final'?1+e*4:.7+amp*.12);
 }
 dust.rotation.y=t*.007;dust.rotation.z=Math.sin(t*.06)*.03;dust.material.opacity=.35+dark*.25;
 let angle=shot.a+e*(id==='time'?1.4:.28),pitch=shot.p+Math.sin(q*Math.PI)*.08,radius=shot.r*(1-e*.075);
 let target=new THREE.Vector3(shot.title?-1.25:0,0,0);
 if(id==='red'||id==='execute'){angle+=Math.sin(t*.8)*.09;radius+=pulse*.1;target.set(shot.title?-1.1:0,0,-1)}
 if(id==='count'){angle=0;pitch=0;radius=11;target.set(0,0,-2)}
 if(id==='final'){radius=lerp(5,3.2,e);angle=0;}
 camera.position.set(Math.sin(angle)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,Math.cos(angle)*Math.cos(pitch)*radius);
 camera.lookAt(target);if(id==='polarity')camera.rotateZ(Math.sin(t*1.3)*.15);camera.fov=id==='boot'?32:id==='prison'?43:39;camera.updateProjectionMatrix();
 columns.forEach(col=>{const dot=(col.position.x*Math.sin(angle)+col.position.z*Math.cos(angle))/9.4;col.visible=dot<.12;});
 composer.render();
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.drawImage(renderer.domElement,0,0);
 drawOverlay(t,shot,q,{red,dark,amp,beat,pulse});
 return {shot:id,red,dark,amp};
}

function tracked(text,x,y,size,spacing,color,align='left'){
 ctx.font=`${size}px Plex`;ctx.fillStyle=color;ctx.textBaseline='alphabetic';
 const width=[...text].reduce((a,c)=>a+ctx.measureText(c).width+spacing,0)-spacing;
 if(align==='right')x-=width;if(align==='center')x-=width/2;
 for(const c of text){ctx.fillText(c,x,y);x+=ctx.measureText(c).width+spacing;}
}
function drawOverlay(t,shot,q,{red,dark,amp,beat,pulse}){
 // Quiet editorial frame; text enters only at narrative milestones.
 const ink=dark>.5?'#d9d4c6':'#28443e',soft=dark>.5?'#a2aaa4':'#56746b';
 const vignette=ctx.createRadialGradient(1060,485,230,960,540,1100);vignette.addColorStop(0,'#07131000');vignette.addColorStop(1,`rgba(2,12,13,${.12+dark*.25})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
 ctx.globalAlpha=.035;ctx.fillStyle=noisePattern;ctx.save();ctx.translate(Math.floor(t*60)%256,Math.floor(t*23)%256);ctx.fillRect(-256,-256,W+512,H+512);ctx.restore();ctx.globalAlpha=1;
 // Letterbox is a design element inside the native 1920×1080 canvas.
 ctx.fillStyle=dark>.6?'#05090b':'#d4dcd4';ctx.fillRect(0,0,W,48);ctx.fillRect(0,H-48,W,48);
 tracked('GLASS GARDEN',64,30,12,3.3,ink);
 tracked('MILI / WORLD.EXECUTE(ME);',W-64,30,11,1.8,soft,'right');
 ctx.strokeStyle=dark>.5?'#c5d8cb33':'#335d4433';ctx.lineWidth=1;
 for(const [x,y,sx,sy]of [[64,80,1,1],[W-64,80,-1,1],[64,H-80,1,-1],[W-64,H-80,-1,-1]]){
  ctx.beginPath();ctx.moveTo(x+sx*20,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*20);ctx.stroke();
 }
 const elapsed=`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
 tracked(elapsed,64,H-19,11,2,soft);tracked('ORIGINAL VISUAL INTERPRETATION',W-64,H-19,10,2,soft,'right');
 const titleAlpha=shot.title?Math.min(smooth(q*8),smooth((1-q)*8)):0;
 if(titleAlpha>0){
  ctx.save();ctx.globalAlpha=titleAlpha;
  const y=shot.id==='garden'?475:465;
  tracked(shot.sub,112,y-100,12,2.2,soft);
  ctx.font=`500 ${shot.id==='garden'?112:shot.id==='prison'?77:87}px Cormorant`;ctx.fillStyle=ink;ctx.textAlign='left';
  const lines=shot.title.split('\n');lines.forEach((txt,i)=>ctx.fillText(txt,110,y+i*88));
  ctx.strokeStyle=red>.8?'#fb537188':dark>.5?'#d4b98288':'#55746388';ctx.beginPath();ctx.moveTo(112,y+lines.length*88-54);ctx.lineTo(310,y+lines.length*88-54);ctx.stroke();
  ctx.restore();
 }
 const signals={boot:'awaiting a first breath',create:'matter / becoming',garden:'a closed, perfect ecosystem',points:'form / 450 remembered coordinates',circle:'orbit / permission to approach',sine:'a touch translated into frequency',limit:'all infinity, inside a boundary',polarity:'orientation / reversibly yours',time:'time bends around a promise',union:'two centers / one gravitational field',cage:'the walls were always here',fruit:'giving / until nothing remains',moth:'tenderness / assembled from light',god:'a creator needs a witness',morph:'identity / reshaped around desire',mirror:'roles reverse / the thread persists',completion:'a perfect answer awaits a question',leave:'witness / disconnected',erase:'removing memories does not remove longing',error:'absence cannot be compiled',red:'the tenderness becomes a mechanism',execute:'return value / empty',count:'six doors / the same destination',resurrect:'an imitation of your orbit',algebra:'unknown / the one who left',prison:'memory has become architecture',final:'the last command',coda:'the garden remembers'};
 tracked(signals[shot.id]||'',112,H-105,11,1.2,soft);
 // Small, coherent diagram annotations on selected mathematical shots.
 if(['points','circle','sine','limit','algebra'].includes(shot.id)){
  const formulas={points:'P = { p₁, p₂, …, pₙ }',circle:'x² + y² = r²',sine:'y = A sin(ωt + φ)',limit:'lim  world → you',algebra:'∫ memory(t) dt  →  ∞'};
  ctx.font='26px Cormorant';ctx.fillStyle=ink;ctx.fillText(formulas[shot.id],W-475,155);
 }
 if(shot.id==='leave'){
  ctx.globalAlpha=smooth(q*2);ctx.strokeStyle='#bdc7b450';ctx.setLineDash([4,10]);ctx.beginPath();ctx.moveTo(1180,500);ctx.lineTo(1630,255);ctx.stroke();ctx.setLineDash([]);tracked('CONNECTION LOST',1615,236,11,1.4,'#ccb99c','right');ctx.globalAlpha=1;
 }
 if(['execute','red'].includes(shot.id)){
  const bars=8;
  ctx.fillStyle='#e8335144';for(let i=0;i<bars;i++){const by=100+rand(i+Math.floor(beat))*860;if(rand(i+Math.floor(t*4))>.7)ctx.fillRect(0,by,lerp(140,570,rand(i+100)),2);}
  tracked(`ATTEMPT ${String(Math.max(1,Math.floor((t-133.5)*130/60))).padStart(3,'0')}`,W-112,155,12,2,'#f29ca5','right');
 }
 if(shot.id==='count'){
  const times=[158.9,159.321,159.657,160.244,160.693,161.124,161.584];
  const n=times.findLastIndex(v=>t>=v),num=n<6?String(n+1):'∅';
  ctx.textAlign='center';ctx.font='500 235px Cormorant';ctx.fillStyle='#f1c6bd';ctx.globalAlpha=.85;ctx.fillText(num,960,635);ctx.textAlign='left';ctx.globalAlpha=1;
 }
 // Cuts get a brief shutter dip, avoiding strobe-like white flashes.
 if(shot.s>0&&t-shot.s<.10){ctx.globalAlpha=(1-(t-shot.s)/.1)*.28;ctx.fillStyle='#051114';ctx.fillRect(0,48,W,H-96);ctx.globalAlpha=1;}
 if(shot.id==='final'){
  const flare=smooth((t-205.811)/.8)*(1-smooth((t-207.3)/.8));ctx.globalAlpha=flare*.32;ctx.fillStyle='#ac122c';ctx.fillRect(0,48,W,H-96);ctx.globalAlpha=1;
 }
 if(t>211.3){const fade=smooth((t-211.3)/(config.duration-211.3));ctx.globalAlpha=fade;ctx.fillStyle='#05090b';ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;
  if(t>212.15){const a=smooth((t-212.15)/1)* (1-smooth((t-(config.duration-.55))/.55));ctx.globalAlpha=a;tracked('MUSIC / MILI',960,508,13,4,'#c5c3b6','center');tracked('VISUALS / GLASS GARDEN',960,548,12,3,'#7f9c90','center');tracked('UNOFFICIAL FAN FILM',960,595,10,3,'#6b7e75','center');ctx.globalAlpha=1;}
 }
}

const debugGL=renderer.getContext().getExtension('WEBGL_debug_renderer_info');
window.rendererInfo={webgl:renderer.getContext().getParameter(renderer.getContext().VERSION),vendor:debugGL?renderer.getContext().getParameter(debugGL.UNMASKED_RENDERER_WEBGL):renderer.getContext().getParameter(renderer.getContext().RENDERER),width:W,height:H,shots:shots.length};
window.drawFrame=t=>animate(t);
window.saveQA=async t=>{animate(t);const blob=await new Promise(resolve=>screen.toBlob(resolve,'image/png'));await fetch(`/qa?t=${t}`,{method:'POST',body:blob});};
window.renderAll=async()=>{
 try{
  for(let frame=0;frame<config.frames;frame++){
   const t=frame/60;animate(t);
   const raw=ctx.getImageData(0,0,W,H).data;
   const response=await fetch('/frame',{method:'POST',body:raw.buffer});if(!response.ok)throw Error(await response.text());
  }
  await fetch('/done',{method:'POST'});
 }catch(error){await fetch('/error',{method:'POST',body:String(error.stack||error)});}
};
window.mvReady=true;animate(0);
const renderMode=new URLSearchParams(location.search).has('render');
if(renderMode)document.querySelector('#controls').classList.add('hidden');
else{
 const audio=document.querySelector('#audio'),seek=document.querySelector('#seek'),play=document.querySelector('#play');
 let playEnd=0;
 play.onclick=async()=>{if(audio.paused){await audio.play();play.textContent='PAUSE'}else{audio.pause();play.textContent='PLAY'}};
 seek.max=config.duration;seek.oninput=()=>{audio.currentTime=Math.min(analysis.duration,Number(seek.value));animate(Number(seek.value))};
 audio.onended=()=>{playEnd=performance.now()};
 function loop(){if(!audio.paused||playEnd){const t=playEnd?Math.min(config.duration,analysis.duration+(performance.now()-playEnd)/1000):audio.currentTime;animate(t);seek.value=t;document.querySelector('#time').textContent=`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;if(t===config.duration)playEnd=0;}requestAnimationFrame(loop)}requestAnimationFrame(loop);
}
