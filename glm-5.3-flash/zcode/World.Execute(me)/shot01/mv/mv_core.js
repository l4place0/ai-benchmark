'use strict';
/* ============================================================
   world.execute(me); — procedural fan MV (core)
   Every frame is a pure function of time t. No wall-clock,
   no unseeded randomness, no cross-frame accumulation.
   ============================================================ */
(function () {
const T = window.MV_TIMELINE;
const W = 1920, H = 1080;
const TAU = Math.PI * 2;

// ---------------- small math ----------------
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const sm = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const hash1 = n => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u) * 2 - 1; }

// ---------------- beat / timeline ----------------
const BEAT = 60 / T.bpm;
const beatN = t => (t - T.beat0) / BEAT;
const beatPhase = t => { const b = beatN(t); return b - Math.floor(b); };
const kick = t => Math.exp(-9 * beatPhase(t));
const snare = t => (Math.floor(beatN(t)) % 2 === 1) ? Math.exp(-7 * beatPhase(t)) : 0;
const ENERGY = T.energy, ELEN = ENERGY.length;
function energyAt(t) {
  if (t <= 0) return ENERGY[0] || 0;
  if (t >= T.songDuration) return 0;
  const i = t * 2, k = Math.floor(i), f = i - k;
  const a = ENERGY[Math.min(ELEN - 1, k)], b = ENERGY[Math.min(ELEN - 1, k + 1)];
  return a * (1 - f) + b * f;
}
function sectionAt(t) {
  const S = T.sections;
  for (let i = S.length - 1; i >= 0; i--) if (t >= S[i].t0) return S[i];
  return S[0];
}
function cutAmt(t) {
  let a = 0;
  for (const s of T.sections) { const d = t - s.t0; if (d >= 0 && d < 0.09) a = Math.max(a, 1 - d / 0.09); }
  return a;
}
// heartbeat double-thump at 72 bpm
function heartPulse(t) { const p = (t * 72 / 60) % 1; return Math.exp(-7 * p) + 0.55 * Math.exp(-7 * Math.max(0, p - 0.16)); }

// ---------------- text layer (2D canvas -> texture) ----------------
const tcv = document.createElement('canvas'); tcv.width = W; tcv.height = H;
const t2 = tcv.getContext('2d', { willReadFrequently: true });
const FM = '"JetBrains Mono", monospace';
const CPS = 26;
let textKey = '__none__';

function fmtTC(t) { const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); }

function textItems(t) {
  const items = [];
  const S = sectionAt(t);
  // stacked terminal log, bottom-left
  const logs = [];
  for (const c of T.cues) {
    if (c.type !== 'log' && c.type !== 'sys' && c.type !== 'error') continue;
    if (c.t >= 207.5) continue; // outro lines handled separately
    const age = t - c.t;
    if (age < 0 || age > 3.4) continue;
    logs.push({ c, age });
  }
  logs.sort((a, b) => a.c.t - b.c.t);
  const show = logs.slice(-5);
  show.forEach((e, i) => {
    const chars = Math.min(e.c.text.length, Math.floor(e.age * CPS));
    const base = (i === show.length - 1) ? 0.95 : Math.max(0.16, 0.85 - (show.length - 1 - i) * 0.17);
    const a = base * clamp(1 - (e.age - 2.5) / 0.9, 0, 1);
    items.push({
      kind: 'log', text: e.c.text.slice(0, chars), x: 46, y: H - 76 - (show.length - 1 - i) * 34,
      size: 22, col: e.c.type === 'error' ? [255, 70, 70] : [142, 232, 246], alpha: a, w: 400,
      cursor: i === show.length - 1 && chars < e.c.text.length
    });
  });
  // slams + EXECUTION words
  let si = 0;
  for (const c of T.cues) {
    if (c.type !== 'slam' && c.type !== 'exec') continue;
    const age = t - c.t;
    if (age < 0 || age > 1.9) continue;
    const pin = sm(0, 0.09, age), pout = 1 - sm(1.3, 1.9, age);
    const a = pin * pout;
    if (a <= 0.01) continue;
    const isExec = c.type === 'exec';
    const ox = (hash1(si * 7.31) - 0.5) * 560, oy = (hash1(si * 3.17) - 0.5) * 150;
    items.push({ kind: 'slam', text: c.text, x: W / 2 + ox, y: H * 0.42 + oy, size: isExec ? 100 : 82, col: isExec ? [255, 48, 72] : [228, 248, 255], alpha: a, w: 700, scale: 1 + (1 - pin) * 0.14, jx: isExec ? 1 : 0.3 });
    si++;
  }
  // countdown (EIN/DOS/TROIS/NE/FEM/LIU -> 6..1)
  for (const c of T.cues) {
    if (c.type !== 'count') continue;
    const age = t - c.t;
    if (age < 0 || age > 0.5) continue;
    const a = (1 - sm(0.3, 0.5, age)) * sm(0, 0.04, age);
    items.push({ kind: 'count', text: String(c.num), sub: c.text, x: W / 2, y: H / 2 - 30, size: 320, col: [255, 64, 64], alpha: a, w: 700, scale: 1 + age * 0.3 });
  }
  // title
  for (const c of T.cues) {
    if (c.type !== 'title') continue;
    const age = t - c.t;
    if (age < -0.35 || age > 3.5) continue;
    const a = sm(-0.35, -0.08, age) * (1 - sm(2.7, 3.5, age));
    items.push({ kind: 'title', text: c.text, x: W / 2, y: H / 2, size: 104, col: [238, 251, 255], alpha: a, w: 700, glitch: clamp(1 - Math.max(0, age) * 2.4, 0, 1) * 0.9 + 0.06 });
    items.push({ kind: 'sub', text: '> EXECUTING SUBJECT "me" ...', x: W / 2, y: H / 2 + 96, size: 26, col: [122, 222, 240], alpha: a * 0.85, w: 400 });
  }
  // outro epilogue, centered stack
  const epi = [];
  for (const c of T.cues) {
    if (c.type !== 'sys') continue;
    if (c.t < 207.5) continue;
    const age = t - c.t;
    if (age < 0) continue;
    epi.push({ c, age });
  }
  epi.sort((a, b) => a.c.t - b.c.t);
  let ci = 0, ei = 0;
  for (const e of epi) {
    const isHello = e.c.text.indexOf('hello') === 0;
    const isCredit = e.c.t >= 215;
    const chars = Math.min(e.c.text.length, Math.floor(e.age * CPS * 0.75));
    const a = clamp(1 - (e.age - 3.2) / 0.8, 0, 1) * (isHello ? 1 : 0.9);
    if (a <= 0.01) continue;
    if (isCredit) {
      items.push({ kind: 'credit', text: e.c.text.slice(0, chars), x: W / 2, y: 946 + ci * 30, size: 19, col: [130, 200, 215], alpha: a * 0.75, w: 400 });
      ci++;
    } else {
      items.push({ kind: 'epi', text: e.c.text.slice(0, chars), x: W / 2, y: 470 + ei * 62, size: isHello ? 52 : 30, col: isHello ? [255, 214, 170] : [170, 235, 245], alpha: a, w: isHello ? 700 : 400 });
      ei++;
    }
  }
  // HUD
  items.push({ kind: 'hud', text: 'T+' + fmtTC(t) + '  beat ' + String(Math.max(0, Math.floor(beatN(t)))).padStart(3, '0') + '  ' + S.id, x: 46, y: 48, size: 19, col: [108, 208, 228], alpha: 0.5, w: 400 });
  items.push({ kind: 'hud', text: 'world.execute(me); :: procedural fan mv', x: W - 46, y: 48, size: 19, col: [108, 208, 228], alpha: 0.38, w: 400, align: 'right' });
  return items;
}

function drawText(t) {
  const items = textItems(t);
  const key = items.map(i => i.kind + ':' + i.text + ':' + Math.round(i.alpha * 48) + ':' + (i.cursor ? (Math.floor(t * 3) % 2) : 0)).join(';');
  if (key === textKey) return false;
  textKey = key;
  t2.clearRect(0, 0, W, H);
  t2.textBaseline = 'alphabetic';
  for (const it of items) {
    const col = 'rgba(' + it.col[0] + ',' + it.col[1] + ',' + it.col[2] + ',' + it.alpha.toFixed(3) + ')';
    t2.font = it.w + ' ' + Math.round(it.size) + 'px ' + FM;
    t2.textAlign = it.align === 'right' ? 'right' : 'center';
    const jx = it.jx ? (hash1(Math.floor(t * 47) + it.x * 0.01) - 0.5) * 10 * it.jx * (0.3 + kick(t)) : 0;
    const x = it.x + jx, y = it.y;
    const sc = it.scale || 1;
    if (sc !== 1) { t2.save(); t2.translate(x, y); t2.scale(sc, sc); t2.translate(-x, -y); }
    if (it.kind === 'title' && it.glitch > 0.02) {
      t2.globalAlpha = it.alpha * 0.5;
      t2.fillStyle = 'rgba(80,220,255,1)'; t2.fillText(it.text, x - 5 * it.glitch, y - 2 * it.glitch);
      t2.fillStyle = 'rgba(255,60,80,1)'; t2.fillText(it.text, x + 5 * it.glitch, y + 2 * it.glitch);
      t2.globalAlpha = 1;
    }
    if (it.kind === 'count' && it.sub) {
      t2.font = '400 ' + Math.round(it.size * 0.1) + 'px ' + FM;
      t2.fillStyle = 'rgba(255,140,140,' + (it.alpha * 0.9).toFixed(3) + ')';
      t2.fillText(it.sub, x, y + it.size * 0.24);
      t2.font = '700 ' + Math.round(it.size) + 'px ' + FM;
    }
    t2.fillStyle = col;
    t2.fillText(it.text, x, y);
    if (it.cursor && Math.floor(t * 3) % 2 === 0) {
      const wpx = t2.measureText(it.text).width;
      const ax = it.align === 'right' ? x - wpx : x - (it.align === 'center' ? wpx / 2 : 0);
      t2.fillRect(ax + wpx + 6, y - it.size * 0.8, 12, it.size * 0.95);
    }
    if (sc !== 1) t2.restore();
  }
  // ECG trace across the final section (history curve revealed left->right)
  const e0 = 205.95;
  if (t >= e0 && t <= 213.0) {
    const x0 = 240, x1 = W - 240, yMid = H * 0.40, amp = 130;
    const rev = clamp((t - e0) / 2.4, 0, 1);
    t2.globalAlpha = 0.9 * clamp(1 - (t - 210.8) / 1.6, 0, 1);
    t2.strokeStyle = 'rgba(120,240,220,1)';
    t2.lineWidth = 2.5;
    t2.shadowColor = 'rgba(80,255,230,0.9)'; t2.shadowBlur = 12;
    t2.beginPath();
    const NPTS = 480;
    for (let i = 0; i <= NPTS; i++) {
      const fr = i / NPTS;
      if (fr > rev) break;
      const tau = e0 + fr * 2.6;
      const alive = clamp((207.35 - tau) / 0.55, 0, 1);
      const bp = (tau - T.beat0) / BEAT;
      const pp = bp - Math.floor(bp);
      let v = 0;
      v += Math.exp(-90 * Math.pow(pp - 0.10, 2)) * 0.18;
      v += -Math.exp(-260 * Math.pow(pp - 0.22, 2)) * 0.22;
      v += Math.exp(-60 * Math.pow(pp - 0.26, 2)) * 1.0;
      v += -Math.exp(-160 * Math.pow(pp - 0.34, 2)) * 0.35;
      v += Math.exp(-26 * Math.pow(pp - 0.55, 2)) * 0.26;
      v *= alive;
      const px = x0 + fr * (x1 - x0), py = yMid - v * amp;
      if (i === 0) t2.moveTo(px, py); else t2.lineTo(px, py);
    }
    t2.stroke();
    t2.shadowBlur = 0; t2.globalAlpha = 1;
  }
  return true;
}

// ---------------- GL ----------------
const cv = document.getElementById('cv');
let gl = cv.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
const ISGL2 = !!gl;
if (!gl) gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
if (!gl) throw new Error('WebGL unavailable');

function sh(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
  return s;
}
function prog(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  const a = {}; const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}

const QUAD_VS = 'attribute vec2 aP;varying vec2 vUV;void main(){vUV=aP*0.5+0.5;gl_Position=vec4(aP,0.0,1.0);}';

const SCENE_FS = `
precision highp float;
varying vec2 vUV;
uniform vec2 uRes; uniform vec3 uCam; uniform vec3 uTgt; uniform float uFov;
uniform float uT; uniform vec3 uTint; uniform float uRoomB; uniform float uWave;
uniform float uPolar; uniform float uFig; uniform float uCrouch; uniform float uScan;
uniform float uHeart; uniform float uErr; uniform float uOpen; uniform float uExec;
uniform float uLove; uniform float uFog; uniform vec3 uBg; uniform float uKick;
float sdBox(vec3 p,vec3 b){vec3 d=abs(p)-b;return min(max(d.x,max(d.y,d.z)),0.0)+length(max(d,0.0));}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);return length(pa-ba*h)-r;}
float grid(vec2 p,float scale,float w){
  vec2 g=abs(fract(p*scale)-0.5);
  float d=min(g.x,g.y)/scale;
  return smoothstep(w,0.0,d);
}
vec2 map(vec3 p){
  float hf=4.0-uOpen*2.2;
  float room=-sdBox(p,vec3(hf,3.0,hf));
  float d=room; float m=1.0;
  float fl=p.y+3.0;
  if(fl<d){d=fl;m=2.0;}
  for(int i=0;i<4;i++){
    float fi=float(i);
    vec3 c=vec3(mix(3.1,6.5,uOpen)*(mod(fi,2.0)<1.0?1.0:-1.0),0.0,mix(3.1,6.5,uOpen)*(fi<2.0?1.0:-1.0));
    float pd=sdBox(p-c,vec3(0.16,3.0,0.16));
    if(pd<d){d=pd;m=3.0;}
  }
  vec3 f=p; f.y=mix(f.y,-3.0+(f.y+3.0)*(1.0-uCrouch*0.38),uCrouch);
  float fig=1e9;
  fig=min(fig,sdCap(f,vec3(0.0,-2.42,0.0),vec3(0.0,-1.62,0.0),0.30));
  fig=min(fig,length(f-vec3(0.0,-1.30,0.0))-0.19);
  fig=min(fig,sdCap(f,vec3(0.26,-1.85,0.0),vec3(0.40,-2.42,0.0),0.075));
  fig=min(fig,sdCap(f,vec3(-0.26,-1.85,0.0),vec3(-0.40,-2.42,0.0),0.075));
  fig=min(fig,sdCap(f,vec3(0.12,-2.52,0.0),vec3(0.14,-2.98,0.0),0.10));
  fig=min(fig,sdCap(f,vec3(-0.12,-2.52,0.0),vec3(-0.14,-2.98,0.0),0.10));
  fig=mix(60.0,fig,clamp(uFig,0.0,1.0));
  if(fig<d){d=fig;m=4.0;}
  return vec2(d,m);
}
vec3 nrm(vec3 p){
  vec2 e=vec2(0.0015,0.0);
  return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x,map(p+e.yxy).x-map(p-e.yxy).x,map(p+e.yyx).x-map(p-e.yyx).x));
}
void main(){
  vec2 uv=(vUV*uRes-0.5*uRes)/uRes.y;
  vec3 ro=uCam;
  vec3 fw=normalize(uTgt-ro);
  vec3 rt=normalize(cross(fw,vec3(0.0,1.0,0.0)));
  vec3 up=cross(rt,fw);
  float ft=1.0/tan(uFov*0.5);
  vec3 rd=normalize(fw*ft+rt*uv.x+up*uv.y);
  float tAcc=0.0; float m=-1.0; float glow=0.0; float ringG=0.0;
  for(int i=0;i<90;i++){
    vec3 p=ro+rd*tAcc;
    vec2 dm=map(p);
    glow+=exp(-max(dm.x,0.0)*9.0)*0.0045*exp(-tAcc*0.16);
    if(uScan>-8.5){
      float rr=abs(length(p.xz)-1.55);
      ringG+=exp(-rr*22.0-abs(p.y-uScan)*26.0)*0.035*exp(-tAcc*0.09);
    }
    if(dm.x<0.002*tAcc+0.001){m=dm.y;break;}
    tAcc+=dm.x*0.92;
    if(tAcc>34.0)break;
  }
  vec3 bg=uBg*(1.0+uKick*0.3);
  vec3 col=bg;
  if(m>0.0){
    vec3 p=ro+rd*tAcc;
    vec3 nn=nrm(p);
    float fres=pow(1.0-abs(dot(nn,-rd)),2.0);
    vec3 keyD=normalize(vec3(0.35,0.8,0.45));
    float key=max(dot(nn,keyD),0.0);
    vec3 rim=pow(1.0-max(dot(nn,-rd),0.0),2.5)*vec3(0.35,0.95,1.05);
    vec3 heartP=vec3(0.0,-1.78,0.0);
    float hl=uHeart*max(dot(nn,normalize(heartP-p)),0.0)*2.2/(0.4+dot(p-heartP,p-heartP));
    vec3 base;
    if(m<2.5){
      vec2 gp=(abs(p.x)>abs(p.z))?p.zy:p.xy;
      if(abs(p.y)>2.99) gp=p.xz;
      float g=grid(gp,0.5,0.05);
      base=vec3(0.016,0.03,0.038)*uRoomB+vec3(0.05,0.5,0.6)*g*uRoomB*1.1;
      if(uPolar>0.0){
        float pr=length(p.xz);
        float pa=atan(p.z,p.x);
        float pg=grid(vec2(pr*0.9,pa*4.0),0.5,0.05);
        base=mix(base,vec3(0.02,0.06,0.05)*uRoomB+vec3(0.1,0.55,0.45)*pg*uRoomB,uPolar*0.8);
      }
      base=mix(base,vec3(0.58,0.62,0.66)*(0.35+0.2*g),uExec*0.6);
    } else if(m<3.5){
      float g=grid(p.xz,0.5,0.055);
      float ring=smoothstep(0.02,0.0,abs(length(p.xz)-2.6));
      float wv=sin(p.x*2.2-uT*2.6)*sin(p.z*2.2+uT*1.9);
      base=vec3(0.012,0.028,0.034)*uRoomB;
      base+=vec3(0.06,0.55,0.62)*g*uRoomB*(0.8+0.5*uWave);
      base+=vec3(0.1,0.7,0.8)*ring*uRoomB*0.8;
      base+=vec3(0.15,0.6,0.7)*max(wv,0.0)*uWave*0.35;
      if(uPolar>0.0){
        float pr=length(p.xz);
        float pa=atan(p.z,p.x);
        float pg=grid(vec2(pr*0.9,pa*4.0),0.5,0.05);
        base=mix(base,vec3(0.012,0.03,0.028)*uRoomB+vec3(0.1,0.55,0.45)*pg*uRoomB,uPolar);
      }
      base=mix(base,vec3(0.56,0.59,0.64)*(0.3+0.25*g),uExec*0.6);
      base*=1.0-0.55*smoothstep(2.0,7.0,length(p.xz));
    } else if(m<4.5){
      float eg=smoothstep(0.09,0.03,min(min(abs(abs(p.x)-3.1),abs(p.y+3.0)),abs(3.0-p.y)));
      base=vec3(0.02,0.035,0.045)*uRoomB+vec3(0.1,0.6,0.7)*eg*uRoomB;
      base=mix(base,vec3(0.6,0.63,0.68),uExec*0.55);
    } else {
      base=vec3(0.05,0.09,0.11);
      base+=rim*0.9;
      base+=vec3(1.0,0.12,0.2)*hl;
      base*=0.35+0.65*key;
      base=mix(base,vec3(0.66,0.62,0.58),uExec*0.5);
    }
    vec3 light=base*uTint;
    light+=vec3(0.9,0.25,0.25)*uErr*fres*0.8;
    light=mix(light,light*vec3(1.25,0.9,0.78)+vec3(0.09,0.03,0.0),uLove);
    float fog=1.0-exp(-tAcc*uFog);
    col=mix(light,bg,fog);
  }
  col+=vec3(0.25,0.95,1.1)*ringG*(0.5+uRoomB);
  col+=vec3(0.2,0.75,0.9)*glow*uTint*(0.35+uRoomB*0.5);
  col+=vec3(1.0,0.15,0.22)*glow*uErr*1.5;
  col+=vec3(1.0,0.5,0.45)*uHeart*0.06*(0.6+0.4*sin(uT*7.5));
  gl_FragColor=vec4(col,1.0);
}`;

const LINE_VS = `
attribute vec3 aPos; attribute vec3 aCol; attribute float aA;
uniform mat4 uMVP; uniform vec2 uOff; uniform vec2 uRes; uniform float uGain;
varying vec3 vC; varying float vA;
void main(){
  vec4 cp=uMVP*vec4(aPos,1.0);
  cp.xy+=uOff*cp.w*2.0/uRes;
  gl_Position=cp;
  vC=aCol; vA=aA*uGain;
}`;
const LINE_FS = 'precision mediump float;varying vec3 vC;varying float vA;void main(){gl_FragColor=vec4(vC*vA,vA);}';

const PART_VS = `
attribute vec4 aSeed;
uniform mat4 uMVP; uniform float uT; uniform vec4 uMode; uniform float uHeart;
uniform float uHeartP; uniform float uKick; uniform float uFovS;
varying vec3 vC; varying float vA;
void main(){
  float s1=fract(aSeed.x*7.31), s2=fract(aSeed.y*3.17), s3=fract(aSeed.z*9.71), s4=fract(aSeed.w*5.53);
  vec3 pd=vec3((aSeed.x*2.0-1.0)*5.5,(aSeed.y*2.0-1.0)*3.4,(aSeed.z*2.0-1.0)*5.5);
  pd+=vec3(sin(uT*(0.21+s2*0.3)+aSeed.x*9.0),cos(uT*(0.17+s3*0.2)+aSeed.y*7.0),sin(uT*(0.19+s1*0.25)+aSeed.z*8.0))*0.55;
  float ry=mod(aSeed.y*7.0-uT*(1.6+s2*2.6),7.0)-3.5;
  vec3 pr=vec3((aSeed.x*2.0-1.0)*3.6,ry,(aSeed.z*2.0-1.0)*3.6);
  float va=aSeed.x*6.2832+uT*(0.5+s1*0.8);
  float vr=mix(7.5,0.25,fract(aSeed.z+uT*0.09*(0.6+s2)));
  vec3 pv=vec3(cos(va)*vr,-3.0+fract(aSeed.w+uT*0.13*(0.5+s3))*6.4,sin(va)*vr);
  float th=aSeed.x*6.2832;
  float hx=16.0*pow(sin(th),3.0);
  float hy=13.0*cos(th)-5.0*cos(2.0*th)-2.0*cos(3.0*th)-cos(4.0*th);
  float fillp=s3*s3;
  vec3 ph=vec3(hx*0.085*(0.35+0.65*fillp),(hy*0.085-0.85)*(0.35+0.65*fillp),(s4-0.5)*0.7*fillp);
  ph*=1.0+0.16*uHeartP;
  ph=mix(pd,ph,clamp(uHeart*1.3,0.0,1.0));
  float mw=uMode.x+uMode.y+uMode.z+uMode.w;
  vec3 pos=(pr*uMode.x+pv*uMode.y+ph*uMode.z+pd*uMode.w)/max(mw,0.001);
  vec4 cp=uMVP*vec4(pos,1.0);
  gl_Position=cp;
  float sz=(1.3+2.4*s2)*mix(1.0,1.5,uMode.z*uHeart)*mix(1.0,0.6,uMode.y/max(mw,0.001));
  gl_PointSize=clamp(sz*uFovS/max(cp.w,0.2),1.0,7.0);
  float tw=0.55+0.45*sin(uT*(2.0+s1*5.0)+aSeed.w*40.0);
  vec3 cRain=vec3(0.35,0.85,1.0);
  vec3 cVort=vec3(1.0,0.85,0.8);
  vec3 cHeart=mix(vec3(1.0,0.25,0.4),vec3(1.0,0.62,0.45),s3);
  vec3 cDrift=vec3(0.5,0.8,0.9);
  vC=(cRain*uMode.x+cVort*uMode.y+cHeart*uMode.z+cDrift*uMode.w)/max(mw,0.001);
  vA=(0.5+0.5*s4)*tw*((0.5*uMode.z+0.3*uMode.x+0.3*uMode.w)/max(mw,0.001)+0.28*uMode.y/max(mw,0.001));
}`;
const PART_FS = 'precision mediump float;varying vec3 vC;varying float vA;void main(){vec2 d=gl_PointCoord-0.5;float r=length(d);float a=smoothstep(0.5,0.05,r);gl_FragColor=vec4(vC*vA*a,a);}';

const POST_FS = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uScene; uniform sampler2D uText;
uniform vec2 uRes; uniform float uT;
uniform float uAber; uniform float uGlitch; uniform float uFlashW; uniform float uFlashR;
uniform float uFade; uniform float uWarm; uniform float uRedEnv;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 uv=vUV;
  float row=floor(uv.y*54.0);
  float gsel=h21(vec2(row,floor(uT*11.0)));
  if(gsel>1.0-uGlitch*0.45){uv.x+=(h21(vec2(row,floor(uT*23.0)))-0.5)*0.14*uGlitch;}
  vec2 d=uv-0.5;
  vec3 col;
  col.r=texture2D(uScene,uv+d*uAber*1.7).r;
  col.g=texture2D(uScene,uv).g;
  col.b=texture2D(uScene,uv-d*uAber*1.7).b;
  vec4 tx=texture2D(uText,uv);
  col=mix(col,tx.rgb,tx.a);
  col=mix(col,vec3(1.0,0.14,0.22),clamp(uFlashR,0.0,1.0)*0.6);
  col+=vec3(1.0,0.98,0.96)*clamp(uFlashW,0.0,1.0);
  col*=1.0-0.085*step(0.5,fract(uv.y*uRes.y*0.5));
  col+=(h21(uv*uRes+vec2(fract(uT*13.7)*91.0))-0.5)*0.05;
  col*=1.0-0.5*pow(length(d)*1.32,2.3);
  col=mix(col,col*vec3(1.12,0.86,0.72),uWarm*0.6);
  col=mix(col,col*vec3(1.3,0.55,0.6),uRedEnv*0.35);
  col*=uFade;
  gl_FragColor=vec4(col,1.0);
}`;

// compile
const progScene = prog(QUAD_VS, SCENE_FS);
const progLine = prog(LINE_VS, LINE_FS);
const progPart = prog(PART_VS, PART_FS);
const progPost = prog(QUAD_VS, POST_FS);

// quad (single oversized triangle)
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

// scene FBO
const sceneTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, sceneTex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
const fbo = gl.createFramebuffer();
gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
gl.bindFramebuffer(gl.FRAMEBUFFER, null);

// text texture
const textTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// line dynamic buffer
const LCAP = 4096; // vertices
const lineArr = new Float32Array(LCAP * 7);
const lineBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
gl.bufferData(gl.ARRAY_BUFFER, lineArr.byteLength, gl.DYNAMIC_DRAW);

// particle seed buffer
const PN = 45000;
const seedArr = new Float32Array(PN * 4);
for (let i = 0; i < PN * 4; i++) seedArr[i] = hash1(i * 0.6180339 + 1.0);
const partBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, partBuf);
gl.bufferData(gl.ARRAY_BUFFER, seedArr, gl.STATIC_DRAW);

gl.disable(gl.DEPTH_TEST);
gl.disable(gl.CULL_FACE);

function uploadText() {
  gl.bindTexture(gl.TEXTURE_2D, textTex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tcv);
}

window.__MV = {
  T, W, H, TAU, clamp, lerp, sm, hash1, vnoise, BEAT,
  beatN, beatPhase, kick, snare, energyAt, sectionAt, cutAmt, heartPulse,
  tcv, t2, textItems, drawText, fmtTC, FM,
  gl, ISGL2, progScene, progLine, progPart, progPost,
  quadBuf, sceneTex, fbo, textTex, uploadText,
  lineArr, lineBuf, LCAP, PN, partBuf
};
})();
