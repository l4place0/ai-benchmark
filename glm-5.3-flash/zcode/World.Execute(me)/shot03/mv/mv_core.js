// mv_core.js — take03 "ORRERY": WebGL2 raymarched celestial machine + particles + post
// Every rendered frame is a pure function of t: all randomness is seeded, no accumulation.

// ---------------- tiny math / hash helpers ----------------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const ease = k => { k = clamp(k, 0, 1); return 1 - Math.pow(1 - k, 3); };
const fract = x => x - Math.floor(x);
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function hash2(a, b) { return hash(a * 157.31 + b * 113.97); }
function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function beatInfo(t) {
  const bi = (t - T.BEAT0) / T.BEAT;
  const phase = bi - Math.floor(bi);
  const pulse = Math.exp(-5 * phase);
  const barI = Math.floor(bi / 4);
  const barPhase = (bi / 4) - barI;
  const barPulse = Math.exp(-4.5 * barPhase);
  return { bi, barI, phase, pulse, barPulse };
}

// ---------------- GLSL ----------------
const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_pos;
out vec2 v_uv;
void main(){ v_uv = a_pos*0.5+0.5; gl_Position = vec4(a_pos,0.,1.); }`;

const SCENE_FRAG = `#version 300 es
precision highp float;
uniform vec2  u_res;
uniform float u_t;
uniform sampler2D u_env;      // 16384x1: r=bass g=high b=flux a=rms (60Hz)
uniform vec3  u_camPos, u_camTgt;
uniform float u_fov;          // focal length (1/tan(fov/2))
uniform vec4  u_ringA, u_ringB, u_ringC;
uniform vec4  u_ringScale;
uniform vec3  u_planetCol;
uniform float u_planetGlow;
uniform vec4  u_fig;          // x vis, y poseA-w(reach), z glitch, w emiv
uniform vec4  u_pose;         // armSpread, kneel, sway, reach
uniform vec4  u_gear;         // angle, presence, y-center, tilt
uniform vec4  u_fx;           // glitch, flash, vignette, exposure
uniform vec3  u_colRing, u_colAccent, u_colSky;
uniform vec4  u_motes;        // size, speed, warm, intensity
out vec4 outCol;

float hash1(float n){ return fract(sin(n)*43758.5453); }
vec3  hash3(float n){ return fract(sin(vec3(n,n+1.33,n+2.66))*vec3(43758.5453,22578.145,19642.349)); }
float vnoise(vec3 p){
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  float n=dot(i,vec3(1.,57.,113.));
  return mix(mix(mix(hash1(n),hash1(n+1.),f.x),mix(hash1(n+57.),hash1(n+58.),f.x),f.y),
             mix(mix(hash1(n+113.),hash1(n+114.),f.x),mix(hash1(n+170.),hash1(n+171.),f.x),f.y),f.z);
}
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
mat3 rotAxis(vec3 axis, float a){
  float c=cos(a),s=sin(a),ic=1.-c;
  return mat3(
    c+axis.x*axis.x*ic, axis.x*axis.y*ic-axis.z*s, axis.x*axis.z*ic+axis.y*s,
    axis.y*axis.x*ic+axis.z*s, c+axis.y*axis.y*ic, axis.y*axis.z*ic-axis.x*s,
    axis.z*axis.x*ic-axis.y*s, axis.z*axis.y*ic+axis.x*s, c+axis.z*axis.z*ic);
}
vec2 polarRep(vec2 p, float n){ float a=atan(p.y,p.x), sec=6.2831853/n; a=mod(a,sec)-sec*.5; return length(p)*vec2(cos(a),sin(a)); }

float sdTorus(vec3 p, vec2 t){ vec2 q=vec2(length(p.xz)-t.x,p.y); return length(q)-t.y; }
float sdCap(vec3 p, vec3 pa, vec3 pb, float r){ vec3 pab=pb-pa, pap=p-pa; float h=clamp(dot(pap,pab)/dot(pab,pab),0.,1.); return length(pab*h-pap)-r; }
float sdBox(vec3 p, vec3 b){ vec3 q=abs(p)-b; return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.); }

float sdRing(vec3 p, float R, float tube, float ticks, float teeth, float teeh){
  float d = sdTorus(p, vec2(R,tube));
  if(ticks>0.){
    float ang=atan(p.z,p.x);
    float tick = smoothstep(.55,.4,abs(sin(ang*ticks)))*0.014;
    d -= tick*(1.-smoothstep(tube*.2,tube*.9,abs(length(p.xz)-R)));
  }
  if(teeth>0.){
    vec2 pr = polarRep(p.xz, teeth);
    float tooth = sdBox(vec3(pr.x-R-teeh*.5, p.y, pr.y*8.), vec3(teeh*.5, tube*.6, .085));
    d = min(d, tooth);
  }
  return d;
}

// capsule mannequin: pose = (armSpread, kneel, sway, reach)
float sdFigure(vec3 p, vec4 pose){
  if(u_fig.x<=0.001) return 1e5;
  float armSpread=pose.x, kneel=pose.y, sway=pose.z, reach=pose.w;
  float h=.9, hipY=h*.50, shY=h*.70;
  vec3 hip=vec3(sway*.05, hipY-kneel*(hipY-.36), 0.);
  vec3 kneeL=vec3(-.10, hip.y*.52, kneel*.16);
  vec3 footL=vec3(-.11, .03, kneel*.40);
  vec3 kneeR=vec3( .10, hip.y*.52-kneel*.26, kneel*.36);
  vec3 footR=vec3( .11, kneel*.10, kneel*.55);
  float d = sdCap(p, hip+vec3(-.08,0,0), kneeL, .045);
  d = min(d, sdCap(p, kneeL, footL, .036));
  d = min(d, sdCap(p, hip+vec3(.08,0,0), kneeR, .045));
  d = min(d, sdCap(p, kneeR, footR, .036));
  vec3 sh = vec3(sway*.09, shY - kneel*.08, 0.);
  d = min(d, sdCap(p, hip, sh, .068));
  d = min(d, length(p-hip-vec3(0.,.02,0.))-.062);
  // arms: angle measured from straight-down
  float thL = mix(.15, 1.30, armSpread) + reach*1.45;
  float thR = mix(.15, 1.15, armSpread);
  vec3 shL = sh+vec3(-.075,0,0), shR = sh+vec3(.075,0,0);
  vec3 handL = shL+normalize(vec3(-sin(thL), -cos(thL), .10*sway))*(h*.36);
  vec3 handR = shR+normalize(vec3( sin(thR), -cos(thR), -.10*sway))*(h*.32);
  d = min(d, sdCap(p, shL, handL, .034));
  d = min(d, sdCap(p, shR, handR, .034));
  d = min(d, length(p-sh-vec3(sway*.02,.13,0.))-.082);
  return d;
}

vec2 map(vec3 p){
  vec2 res=vec2(1e5,0.);
  float rs1=u_ringScale.x, rs2=u_ringScale.y, rs3=u_ringScale.z;
  vec3 p1=rotAxis(normalize(vec3(1.,0.,0.2)), u_ringA.w)*rotAxis(vec3(0.,1.,0.), u_ringA.x)*p;
  vec3 p2=rotAxis(normalize(vec3(0.,0.,1.)), u_ringB.x)*rotAxis(normalize(vec3(0.,1.,0.)), u_ringB.y)*p;
  vec3 p3=rotAxis(normalize(vec3(0.2,0.9,0.4)), u_ringC.w)*rotAxis(normalize(vec3(0.,1.,0.)), u_ringC.x)*p;
  float d1=sdRing(p1, 2.15*rs1, .045, 96., 0., 0.);
  float d2=sdRing(p2, 2.75*rs2, .05,  72., 0., 0.);
  float d3=sdRing(p3, 3.45*rs3, .06,  48., 24., .10);
  float dR=min(min(d1,d2),d3);
  if(dR<res.x) res=vec2(dR,1.);
  // pedestal + planet
  float pd=length(p)-.55;
  if(u_planetGlow>.02) pd-=u_planetGlow*.16;
  vec2 cyc=vec2(length(p.xz)-.22, abs(p.y-.545)-.025);
  float ped=min(max(cyc.x,cyc.y),0.)+length(max(cyc,0.));
  pd=min(pd,ped);
  if(pd<res.x) res=vec2(pd,2.);
  // figure
  vec3 fp = p - vec3(0., .57, 0.);
  float fd = sdFigure(fp, u_pose);
  if(fd<res.x) res=vec2(fd,3.);
  // background gear disc
  if(u_gear.y>0.01){
    vec3 gp = p - vec3(0., u_gear.z, -6.5);
    gp = rotAxis(vec3(0.,0.,1.), u_gear.x)*gp;
    gp = rotAxis(vec3(1.,0.,0.), u_gear.w)*gp;
    vec2 pr = polarRep(gp.xy, 24.);
    float gdisc = min(length(gp.xy)-6.2, sdBox(vec3(pr.x-6.2, gp.y, gp.z), vec3(.55,.28,3.)));
    float g = max(gdisc, abs(gp.z)-.22);
    g = max(g, -(length(gp.xy)-1.4));
    g = mix(1e5, g, u_gear.y);
    if(g<res.x) res=vec2(g,4.);
  }
  return res;
}
vec3 nrm(vec3 p){ vec2 e=vec2(.0016,0.); return normalize(vec3(map(p+e.xyy).x-map(p-e.xyy).x, map(p+e.yxy).x-map(p-e.yxy).x, map(p+e.yyx).x-map(p-e.yyx).x)); }

vec3 stars(vec3 rd){
  vec3 col=vec3(0.);
  for(float layer=0.;layer<3.;layer++){
    float sc = 60.+layer*90.;
    vec3 q = rd*sc + layer*17.3;
    vec3 id = floor(q), f = fract(q);
    vec3 r3 = hash3(id.x+id.y*57.3+id.z*113.7);
    float star = smoothstep(.92+r3.z*.07, 1., 1.-length(f-.5)*1.6);
    float tw = .75+.5*sin(u_t*(1.+r3.x*3.)+r3.y*6.28);
    col += star*tw*(0.35+.65*r3.x)*(1.-layer*.25)*mix(vec3(.75,.85,1.), vec3(1.,.9,.75), r3.y);
  }
  float neb = pow(fbm(rd*2.6+vec3(3.1)), 2.2);
  col += neb*.22*u_colSky;
  return col;
}

void main(){
  vec2 uv = (gl_FragCoord.xy*2.-u_res)/u_res.y;
  float flux = texelFetch(u_env, ivec2(int(u_t*60.),0),0).b;
  float ca = (0.0012 + 0.003*flux + u_fx.x*0.006);
  vec2 uvc = uv*(1.-ca*3.);
  vec3 ro=u_camPos, ta=u_camTgt;
  vec3 fw=normalize(ta-ro), rt=normalize(cross(fw,vec3(0.,1.,0.))), up=cross(rt,fw);
  vec3 rd=normalize(fw*u_fov + rt*uvc.x + up*uvc.y);
  float t=0.; float glowR=0., glowF=0., glowP=0.; vec2 hit=vec2(-1.);
  for(int i=0;i<110;i++){
    vec3 pos=ro+rd*t;
    vec2 h=map(pos);
    float dd=h.x, id=h.y;
    if(dd<0.0012*t+0.0008 && t>0.02){ hit=vec2(t,id); break; }
    if(id==1.) glowR += exp(-dd*36.)*.02;
    if(id==3.) glowF += exp(-dd*44.)*.03;
    if(id==2.) glowP += exp(-dd*16.)*.022*u_planetGlow;
    t+=dd*.92;
    if(t>44.||(dd>3.&&t>12.)) break;
  }
  vec3 bg = stars(rd);
  bg *= 1.-.35*smoothstep(-2.,-9.,rd.z);
  vec3 col=bg;
  if(hit.x>0.){
    vec3 pos=ro+rd*hit.x;
    vec3 n=nrm(pos);
    vec3 ld=normalize(vec3(.5,.75,.55));
    float dif=max(dot(n,ld),0.);
    float fre=pow(1.-max(dot(n,-rd),0.),3.);
    vec3 base;
    if(hit.y==1.){
      base=u_colRing*(.28+.72*dif);
      base+=vec3(1.,.85,.6)*pow(max(dot(reflect(rd,n),ld),0.),40.)*.9;
      base+=u_colRing*fre*.6;
    } else if(hit.y==2.){
      vec3 sp=normalize(pos);
      float grid = smoothstep(.44,.5,max(abs(fract(atan(sp.z,sp.x)*8./6.2831853)-.5)*2., abs(fract(asin(clamp(sp.y,-1.,1.))*12./3.14159)-.5)*2.));
      vec3 rock=u_planetCol*(.32+.68*dif);
      rock*=.8+.4*fbm(pos*7.);
      rock=mix(rock, u_colAccent*.55, grid*.10);
      base = mix(rock, vec3(1.5,1.02,.5)*(.45+.75*dif), u_planetGlow);
      base += vec3(1.,.6,.28)*u_planetGlow*(1.2+glowP*5.);
      base += u_colAccent*fre*.25;
    } else if(hit.y==3.){
      base=vec3(.93,.95,1.)*(.42+.58*dif);
      base+=vec3(.4,.7,1.)*fre*.9;
      base+=u_colAccent*(.6+u_fig.w)*(glowF*4.5+.18);
      base=mix(base, vec3(1.,.2,.15), u_fig.z*step(.5,hash1(floor(pos.y*40.)+floor(u_t*17.))));
    } else {
      base=vec3(.16,.15,.17)*(.4+.6*dif)+vec3(.9,.7,.4)*fre*.25;
      base*=.8;
    }
    col=mix(bg, base, exp(-hit.x*.028));
  }
  col+=u_colAccent*glowR*2.6 + vec3(.5,.75,1.)*glowF*2.2 + vec3(1.,.6,.3)*glowP*6.*max(u_planetGlow,.25);
  col*=u_fx.w;
  if(u_fx.x>0.003){
    float sl=floor(uv.y*26.+floor(u_t*23.)*.37);
    float g=hash1(sl+floor(u_t*29.));
    if(g<u_fx.x*1.2){ col=col.gbr*1.4; }
  }
  col=mix(col, vec3(1.), clamp(u_fx.y,0.,1.));
  vec2 q=gl_FragCoord.xy/u_res;
  col*=1.-u_fx.z*pow(length(q-.5)*1.42,2.6);
  col+=(hash1(dot(gl_FragCoord.xy,vec2(12.9898,78.233))+fract(u_t)*13.7)-.5)*.045;
  col*=.97+.03*sin(gl_FragCoord.y*3.14159*.5);
  col=col/(1.+col*.15);
  col=pow(max(col,0.), vec3(.4545));
  outCol=vec4(col,1.);
}`;

const PVERT = `#version 300 es
precision highp float;
layout(location=0) in vec4 a_seed;
uniform float u_t, u_mode, u_int, u_size, u_warm, u_speed;
uniform mat4 u_vp;
uniform vec3 u_origin;
out float v_a; out vec3 v_c;
float h1(float n){ return fract(sin(n)*43758.5453); }
void main(){
  float s=a_seed.x, r1=a_seed.y, r2=a_seed.z, r3=a_seed.w;
  vec3 pos; float a=1.; vec3 c=vec3(.7,.85,1.);
  if(u_mode<0.5){
    float sp=(0.12+r1*0.3)*u_speed;
    float th=u_t*sp + r2*6.2831853;
    float rad=mix(2.2,4.3,r1);
    pos=vec3(cos(th)*rad, (r3-.5)*.9, sin(th)*rad);
    c=mix(vec3(.65,.8,1.), vec3(1.,.8,.5), u_warm);
    a=.5+.5*sin(u_t*(1.+r1*2.)+r2*40.);
  } else if(u_mode<1.5){
    float th=r1*6.2831853, ph=acos(2.*r2-1.);
    float v=.6+r3*1.6;
    float tt=u_t*u_speed;
    pos=u_origin + v*tt*vec3(sin(ph)*cos(th), cos(ph)*.85, sin(ph)*sin(th));
    pos.y -= 0.35*tt*tt;
    a=1.-smoothstep(0.5,2.6,tt);
    c=mix(vec3(1.,.9,.7), vec3(1.), r3);
  } else if(u_mode<2.5){
    float th=r1*6.2831853 + u_t*.25*u_speed;
    float fall=fract(r2+u_t*.05*u_speed);
    float rad=mix(1.2,3.6,r3);
    pos=vec3(cos(th)*rad, 2.4-4.8*fall+(r1-.5)*.4, sin(th)*rad);
    a=sin(3.14159*fall);
    c=mix(vec3(1.,.75,.65), vec3(1.,.92,.7), r2);
  } else {
    float th=r1*6.2831853;
    float rad=mix(2.1,3.6,r2);
    pos=vec3(cos(th)*rad,(r3-.5)*.5,sin(th)*rad);
    pos+=vec3(h1(floor(u_t*24.)+r1*91.)-.5, h1(floor(u_t*24.)+r2*77.)-.5, h1(floor(u_t*24.)+r3*63.)-.5)*.5;
    a=1.-fract(u_t*.7+r2);
    c=vec3(1.,.25,.15);
  }
  vec4 clip=u_vp*vec4(pos,1.);
  gl_Position=clip;
  float sz=u_size*(300./max(1.,clip.w));
  gl_PointSize=clamp(sz*(.6+r3*.9),1.,26.);
  v_a=a*u_int; v_c=c;
}`;
const PFRAG = `#version 300 es
precision highp float;
in float v_a; in vec3 v_c; out vec4 o;
void main(){ vec2 q=gl_PointCoord*2.-1.; float d=dot(q,q); float m=exp(-d*3.5); if(m<.02) discard; o=vec4(v_c*m*v_a,1.); }`;

// ---------------- vec helpers ----------------
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// ---------------- engine ----------------
class Engine {
  constructor(glCanvas, pCanvas, envData) {
    this.gl = glCanvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL2 unavailable');
    this.glCanvas = glCanvas; this.pCanvas = pCanvas;
    const gl = this.gl;
    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p)); return p; };
    this.pScene = prog(VERT, SCENE_FRAG);
    this.pPart = gl.createProgram();
    gl.attachShader(this.pPart, mk(gl.VERTEX_SHADER, PVERT));
    gl.attachShader(this.pPart, mk(gl.FRAGMENT_SHADER, PFRAG));
    gl.linkProgram(this.pPart);
    if (!gl.getProgramParameter(this.pPart, gl.LINK_STATUS)) throw new Error('link particles: ' + gl.getProgramInfoLog(this.pPart));

    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = vao;

    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const W = 16384, data = new Uint8Array(W * 4);
    data.set(envData.subarray(0, W * 4));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    this.envTex = tex;

    const NP = 3200, seeds = new Float32Array(NP * 4);
    const rnd = mulberry(0xC0FFEE);
    for (let i = 0; i < NP * 4; i++) seeds[i] = rnd();
    this.NP = NP;
    this.pVao = gl.createVertexArray(); gl.bindVertexArray(this.pVao);
    const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindVertexArray(null);

    this.uScene = {}; for (const n of ['u_res','u_t','u_env','u_camPos','u_camTgt','u_fov','u_ringA','u_ringB','u_ringC','u_ringScale','u_planetCol','u_planetGlow','u_fig','u_pose','u_gear','u_fx','u_colRing','u_colAccent','u_colSky','u_motes']) this.uScene[n] = gl.getUniformLocation(this.pScene, n);
    this.uPart = {}; for (const n of ['u_t','u_mode','u_int','u_size','u_warm','u_speed','u_vp','u_origin']) this.uPart[n] = gl.getUniformLocation(this.pPart, n);
  }

  static vp(camPos, tgt, fovAngle, aspect) {
    const fw = norm3(sub3(tgt, camPos)), rt = norm3(cross3(fw, [0, 1, 0])), up = cross3(rt, fw);
    const f = 1 / Math.tan(fovAngle / 2), near = 0.05, far = 120;
    const v = [rt[0], up[0], -fw[0], 0, rt[1], up[1], -fw[1], 0, rt[2], up[2], -fw[2], 0,
      -dot3(rt, camPos), -dot3(up, camPos), dot3(fw, camPos), 1];
    const p = [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0];
    const m = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += p[k * 4 + r] * v[c * 4 + k]; m[c * 4 + r] = s; }
    return m;
  }

  renderGL(st) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.useProgram(this.pScene);
    gl.uniform2f(this.uScene.u_res, this.glCanvas.width, this.glCanvas.height);
    gl.uniform1f(this.uScene.u_t, st.t);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.envTex); gl.uniform1i(this.uScene.u_env, 0);
    gl.uniform3fv(this.uScene.u_camPos, st.camPos); gl.uniform3fv(this.uScene.u_camTgt, st.camTgt);
    gl.uniform1f(this.uScene.u_fov, 1 / Math.tan(st.fov / 2));
    gl.uniform4fv(this.uScene.u_ringA, st.ringA); gl.uniform4fv(this.uScene.u_ringB, st.ringB); gl.uniform4fv(this.uScene.u_ringC, st.ringC);
    gl.uniform4fv(this.uScene.u_ringScale, st.ringScale);
    gl.uniform3fv(this.uScene.u_planetCol, st.planetCol);
    gl.uniform1f(this.uScene.u_planetGlow, st.planetGlow);
    gl.uniform4fv(this.uScene.u_fig, st.fig);
    gl.uniform4fv(this.uScene.u_pose, st.pose);
    gl.uniform4fv(this.uScene.u_gear, st.gear);
    gl.uniform4fv(this.uScene.u_fx, st.fx);
    gl.uniform3fv(this.uScene.u_colRing, st.colRing); gl.uniform3fv(this.uScene.u_colAccent, st.colAccent); gl.uniform3fv(this.uScene.u_colSky, st.colSky);
    gl.uniform4fv(this.uScene.u_motes, st.motes);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (st.motes.w > 0.001) {
      const vp = Engine.vp(st.camPos, st.camTgt, st.fov, this.glCanvas.width / this.glCanvas.height);
      gl.useProgram(this.pPart);
      gl.bindVertexArray(this.pVao);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.blendEquation(gl.FUNC_ADD);
      gl.uniform1f(this.uPart.u_t, st.pt !== undefined && st.pt !== null ? st.pt : st.t);
      gl.uniform1f(this.uPart.u_mode, st.pmode);
      gl.uniform1f(this.uPart.u_int, st.motes.w);
      gl.uniform1f(this.uPart.u_size, st.motes.x);
      gl.uniform1f(this.uPart.u_warm, st.motes.z);
      gl.uniform1f(this.uPart.u_speed, st.motes.y);
      gl.uniformMatrix4fv(this.uPart.u_vp, false, vp);
      gl.uniform3fv(this.uPart.u_origin, st.porigin || [0, 1.5, 0]);
      gl.drawArrays(gl.POINTS, 0, this.NP);
      gl.disable(gl.BLEND);
    }
  }
}
