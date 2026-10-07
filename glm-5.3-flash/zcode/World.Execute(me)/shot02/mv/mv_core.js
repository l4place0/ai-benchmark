'use strict';
/* ============================================================
   world.execute(me); — procedural fan MV, take 02 "paper doll"
   (core) Every frame is a pure function of time t. No wall-clock,
   no unseeded randomness, no cross-frame accumulation.
   White paper / black ink / red thread. Marionette theatre.
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
// most recent burst trigger (exec / count / title cues) within window
function burstAt(t) {
  let best = null;
  for (const c of T.cues) {
    if (c.type !== 'exec' && c.type !== 'count' && c.type !== 'title') continue;
    const age = t - c.t;
    if (age < 0 || age > 1.35) continue;
    if (!best || c.t > best.t) best = c;
  }
  if (!best) return { t: 1e9, a: 0, red: true };
  return { t: best.t, a: Math.exp(-(t - best.t) * 3.0), red: best.type !== 'title' };
}

// ---------------- text / art layer (2D canvas -> texture) ----------------
const tcv = document.createElement('canvas'); tcv.width = W; tcv.height = H;
const t2 = tcv.getContext('2d');
const FM = '"JetBrains Mono", monospace';
const CPS = 30;

function fmtTC(t) { const m = Math.floor(t / 60), s = t - m * 60; return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0'); }

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
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
  const a = {}; const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}

const QUAD_VS = 'attribute vec2 aP;varying vec2 vUV;void main(){vUV=aP*0.5+0.5;gl_Position=vec4(aP,0.0,1.0);}';

/* Scene: white paper + raymarched marionette (capsule skeleton from JS
   pose) + strings + soft floor shadow + scan-invert band + paper fiber. */
const SCENE_FS = `
precision highp float;
varying vec2 vUV;
uniform vec2 uRes;
uniform vec3 uRo; uniform vec3 uTgt; uniform float uFov;
uniform vec3 uPaper; uniform vec3 uInk;
uniform vec3 uCA[22]; uniform vec3 uCB[22];
uniform float uCR[22]; uniform float uSA[22]; uniform float uCM[22];
uniform float uShadow; uniform float uScanY; uniform float uScanH; uniform float uInvert;
uniform float uFib;
float sdCap(vec3 p, vec3 a, vec3 b, float r){
  vec3 pa=p-a, ba=b-a;
  float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-7),0.0,1.0);
  return length(pa-ba*h)-r;
}
float h1(float n){ return fract(sin(n)*43758.5453); }
float vnoise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float a=h1(dot(i,vec2(1.0,57.0)));
  float b=h1(dot(i+vec2(1.0,0.0),vec2(1.0,57.0)));
  float c=h1(dot(i+vec2(0.0,1.0),vec2(1.0,57.0)));
  float d=h1(dot(i+vec2(1.0,1.0),vec2(1.0,57.0)));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
vec2 map(vec3 p){
  float d=1e9; float m=-1.0;
  for(int i=0;i<22;i++){
    float a=uSA[i];
    if(a<0.004) continue;
    float di=sdCap(p,uCA[i],uCB[i],uCR[i]*clamp(a,0.0,1.0));
    if(di<d){ d=di; m=uCM[i]; }
  }
  return vec2(d,m);
}
const vec3 LDIR = vec3(0.42,0.80,0.30);
float softsh(vec3 p){
  float res=1.0; float t=0.08;
  for(int i=0;i<20;i++){
    float d=map(p+LDIR*t).x;
    res=min(res,10.0*d/t);
    t+=clamp(d,0.03,0.6);
    if(res<0.02||t>7.0) break;
  }
  return clamp(res,0.0,1.0);
}
void main(){
  vec2 uv=(vUV*uRes-0.5*uRes)/uRes.y*2.0;
  vec3 ro=uRo;
  vec3 fw=normalize(uTgt-ro);
  vec3 rt=normalize(cross(fw,vec3(0.0,1.0,0.0)));
  vec3 up=cross(rt,fw);
  float ft=1.0/tan(uFov*0.5);
  vec3 rd=normalize(fw*ft+rt*uv.x+up*uv.y);
  float t=0.0; float m=-1.0; vec3 hp=ro;
  for(int i=0;i<80;i++){
    vec3 p=ro+rd*t;
    vec2 dm=map(p);
    if(dm.x<0.0012*t+0.0008){ m=dm.y; hp=p; break; }
    t+=dm.x*0.95;
    if(t>30.0) break;
  }
  vec3 col=uPaper;
  float fib=vnoise(vUV*uRes*0.0055)*0.6+vnoise(vUV*uRes*0.021)*0.4;
  col*=1.0+(fib-0.5)*uFib;
  vec3 bp=(m>-0.5)?hp:(rd.z<-1e-4?ro+rd*(-ro.z/rd.z):ro);
  bool inScan=uInvert>0.001&&abs(bp.y-uScanY)<uScanH;
  if(m>-0.5){
    col=(m<0.5)?uInk:uInk*0.82;
    if(inScan) col=uPaper;
  }else{
    if(rd.y<-0.001&&uShadow>0.003){
      float tf=(-3.0-ro.y)/rd.y;
      if(tf>0.0&&tf<60.0){
        vec3 pf=ro+rd*tf;
        float sh=softsh(pf+vec3(0.0,0.002,0.0));
        float shA=(1.0-sh)*0.30*uShadow;
        vec3 shCol=(inScan&&uInvert>0.5)?uInk*0.85:uPaper*vec3(0.78,0.78,0.84);
        col=mix(col,shCol,shA);
      }
    }
    if(inScan) col=mix(col,uInk*0.94,uInvert*0.92);
  }
  gl_FragColor=vec4(col,1.0);
}`;

/* Particles: dust / falling drops(ink,ash) / radial burst / petals. */
const PART_VS = `
attribute vec4 aSeed;
uniform mat4 uMVP; uniform float uT; uniform vec4 uMode; uniform float uFovS;
uniform vec4 uBurst; uniform vec3 uBurstC;
uniform vec4 uC0; uniform vec4 uC1; uniform vec4 uC2; uniform vec4 uC3;
uniform float uDropV; uniform float uHeartP; uniform float uDens;
varying vec3 vC; varying float vA;
void main(){
  float s1=fract(aSeed.x*7.31), s2=fract(aSeed.y*3.17), s3=fract(aSeed.z*9.71), s4=fract(aSeed.w*5.53);
  vec3 pd=vec3((aSeed.x*2.0-1.0)*5.0, -3.0+fract(aSeed.y+uT*0.016*(0.5+s2))*6.6, (aSeed.z*2.0-1.0)*4.0);
  pd.x+=sin(uT*(0.2+s1*0.3)+aSeed.w*9.0)*0.4;
  float sp=0.9+1.6*s2;
  vec3 pr=vec3((aSeed.x*2.0-1.0)*4.6, 4.4-mod(aSeed.y*9.0+uT*sp*uDropV,7.6), (aSeed.z*2.0-1.0)*3.4);
  pr.x+=sin(uT*1.4+aSeed.w*7.0)*0.22;
  float q=clamp((uT-uBurst.x)*0.85,0.0,1.0);
  vec3 dir=normalize(vec3(aSeed.x*2.0-1.0,(aSeed.y*2.0-1.0)*0.7,aSeed.z*2.0-1.0)+vec3(0.0,0.001,0.0));
  vec3 pb=vec3(0.0,-1.2,0.0)+dir*(0.2+q*(3.5+4.5*s3));
  pb.y+=q*q*1.2;
  float fall=mod(aSeed.w*11.0+uT*(0.22+0.18*s1),1.0);
  vec3 pp=vec3((aSeed.x*2.0-1.0)*4.8, 3.4-fall*7.0, (aSeed.z*2.0-1.0)*3.0);
  pp.x+=sin(uT*(0.5+s2*0.4)+aSeed.w*13.0)*(0.7+uHeartP*0.5);
  pp.z+=cos(uT*(0.4+s3*0.5)+aSeed.x*11.0)*0.5;
  float mw=uMode.x+uMode.y+uMode.z+uMode.w;
  vec3 pos=(pd*uMode.x+pr*uMode.y+pb*uMode.z+pp*uMode.w)/max(mw,0.001);
  vec4 cp=uMVP*vec4(pos,1.0);
  gl_Position=cp;
  float sz=(1.2+2.6*s2);
  gl_PointSize=clamp(sz*uFovS/max(cp.w,0.2),1.0,6.5);
  float tw=0.55+0.45*sin(uT*(1.6+s1*4.0)+aSeed.w*40.0);
  vec3 c2=(s3<0.5?uBurstC:vec3(1.0,0.97,0.93));
  vC=(uC0.rgb*uMode.x+uC1.rgb*uMode.y+c2*uMode.z+uC3.rgb*uMode.w)/max(mw,0.001);
  float a0=uC0.a*uMode.x+uC1.a*uMode.y+uBurst.y*uMode.z+uC3.a*uMode.w;
  float bf=1.0-q*0.8;
  vA=a0*tw/max(mw,0.001)*uDens*mix(1.0,bf,uMode.z/max(mw,0.001));
}`;
const PART_FS = 'precision mediump float;varying vec3 vC;varying float vA;void main(){vec2 d=gl_PointCoord-0.5;float r=length(d);float a=smoothstep(0.5,0.12,r)*vA;gl_FragColor=vec4(vC,a);}';

/* Post: grain, glitch slices, aberration, flashes, paper edge, fade. */
const POST_FS = `
precision highp float;
varying vec2 vUV;
uniform sampler2D uScene; uniform sampler2D uText;
uniform vec2 uRes; uniform float uT;
uniform float uAber; uniform float uGlitch; uniform float uFlashW; uniform float uFlashR;
uniform float uFade; uniform float uWarm; uniform float uRedEnv; uniform float uGrain;
uniform vec3 uFadeCol;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
void main(){
  vec2 uv=vUV;
  float row=floor(uv.y*48.0);
  float g=h21(vec2(row,floor(uT*13.0)));
  if(g>1.0-uGlitch*0.5){ uv.x+=(h21(vec2(row,floor(uT*29.0)))-0.5)*0.12*uGlitch; }
  vec2 d=uv-0.5;
  vec3 col;
  col.r=texture2D(uScene,uv+d*uAber*1.6).r;
  col.g=texture2D(uScene,uv).g;
  col.b=texture2D(uScene,uv-d*uAber*1.6).b;
  vec4 tx=texture2D(uText,uv);
  col=mix(col,tx.rgb,tx.a);
  col=mix(col,vec3(0.86,0.14,0.12),clamp(uFlashR,0.0,1.0)*0.55);
  col+=vec3(1.0,0.98,0.95)*clamp(uFlashW,0.0,1.0);
  float vg=pow(length(d)*1.42,2.4);
  col*=1.0-0.10*vg;
  col=mix(col,col*vec3(1.10,0.86,0.80),uWarm*0.5);
  col=mix(col,mix(col,vec3(0.80,0.10,0.10),0.55*vg),uRedEnv);
  col+=(h21(uv*uRes+vec2(fract(uT*17.3)*89.0,fract(uT*11.7)*63.0))-0.5)*uGrain;
  col=mix(uFadeCol,col,uFade);
  gl_FragColor=vec4(col,1.0);
}`;

const progScene = prog(QUAD_VS, SCENE_FS);
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

// art/text texture
const textTex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// particle seeds
const PN = 30000;
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

window.__MV2 = {
  T, W, H, TAU, clamp, lerp, sm, hash1, vnoise, BEAT,
  beatN, beatPhase, kick, snare, energyAt, sectionAt, cutAmt, heartPulse, burstAt,
  tcv, t2, fmtTC, FM, CPS,
  gl, ISGL2, progScene, progPart, progPost,
  quadBuf, sceneTex, fbo, textTex, uploadText,
  PN, partBuf
};
})();
