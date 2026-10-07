// shaders.js — every GLSL program used by the MV.
// All animation is a pure function of uTime (plus baked music data), so frame N
// is always identical no matter when or how it is rendered.

/* ------------------------------------------------------------------ *
 *  shared helpers
 * ------------------------------------------------------------------ */
const COMMON = `
#define PI 3.14159265359
#define TAU 6.28318530718
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 hash33(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*(3.0-2.0*f);
  float n000=hash33(i+vec3(0,0,0)).x, n100=hash33(i+vec3(1,0,0)).x;
  float n010=hash33(i+vec3(0,1,0)).x, n110=hash33(i+vec3(1,1,0)).x;
  float n001=hash33(i+vec3(0,0,1)).x, n101=hash33(i+vec3(1,0,1)).x;
  float n011=hash33(i+vec3(0,1,1)).x, n111=hash33(i+vec3(1,1,1)).x;
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p){
  float s=0.0, a=0.5;
  for(int i=0;i<4;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
vec3 rotY(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x+s*p.z, p.y, -s*p.x+c*p.z); }
vec3 rotX(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(p.x, c*p.y-s*p.z, s*p.y+c*p.z); }
vec3 rotZ(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x-s*p.y, s*p.x+c*p.y, p.z); }
`;

/* ------------------------------------------------------------------ *
 *  particle shapes — the morphology of "the world"
 * ------------------------------------------------------------------ */
export const SHAPES = `
// u in [0,1) : index fraction,  h in [0,1) : jitter
vec3 shapeSphere(float u, float h){
  float y = 1.0 - 2.0*fract(u*1.6180339);
  float r = sqrt(max(0.0, 1.0 - y*y));
  float a = u*271.0 + h*6.283;
  return vec3(cos(a)*r, y, sin(a)*r);
}
vec3 shapeCube(float u, float h){
  float f = u*6.0;
  int face = int(floor(f));
  vec2 q = vec2(fract(f), h)*2.0-1.0;
  if(face==0) return vec3( q.x, q.y, 1.0);
  if(face==1) return vec3( q.x, q.y,-1.0);
  if(face==2) return vec3( 1.0, q.x, q.y);
  if(face==3) return vec3(-1.0, q.x, q.y);
  if(face==4) return vec3( q.x, 1.0, q.y);
  return            vec3( q.x,-1.0, q.y);
}
vec3 shapeTorus(float u, float h){
  float a = u*TAU*13.0, b = h*TAU;
  float R = 0.72, r = 0.28;
  return vec3((R+r*cos(b))*cos(a), r*sin(b), (R+r*cos(b))*sin(a));
}
vec3 shapeHelix(float u, float h){
  float t = u*10.0;
  float a = t*TAU;
  float r = 0.55 + 0.16*sin(t*2.0+h);
  return vec3(cos(a)*r, (fract(u*3.0)-0.5)*2.0, sin(a)*r);
}
vec3 shapeGrid(float u, float h){
  // 3-D lattice / crystal: reads as a data structure from any angle
  float g = 9.0;
  float x = floor(fract(u*3.0)*g)/g, y = floor(fract(u*7.0+h)*g)/g, z = floor(fract(u*13.0+h*0.5)*g)/g;
  return (vec3(x,y,z)/(g-1.0)*2.0-1.0) * 1.05;
}
vec3 shapeWave(float u, float h){
  // a sine wave ribbon: y = sin(x), thickness from the jitter term
  float x = (u-0.5)*5.0;
  float y = sin(x*2.4)*0.72;
  return vec3(x, y + (h-0.5)*0.10, (h-0.5)*0.45);
}
vec3 shapeLine(float u, float h){
  // a rod with a little thickness, otherwise a 1-D collapse blows out additively
  float a = h*TAU;
  float r = 0.030 + 0.045*fract(u*11.0);
  return vec3((u-0.5)*2.4, cos(a)*r, sin(a)*r);
}
vec3 shapeHeart(float u, float h){
  // 2-D heart curve, given depth by the jitter term
  float t = u*TAU;
  float x = 16.0*pow(sin(t),3.0);
  float y = 13.0*cos(t)-5.0*cos(2.0*t)-2.0*cos(3.0*t)-cos(4.0*t);
  float s = 0.058;
  float lay = fract(u*11.0+h);
  return vec3(x*s*(0.35+0.65*lay), y*s*(0.35+0.65*lay), (h-0.5)*0.34);
}
vec3 shapeRing(float u, float h){
  float a = u*TAU;
  float r = 1.0 + (h-0.5)*0.05;
  return vec3(cos(a)*r, (h-0.5)*0.05, sin(a)*r);
}
vec3 shapeAt(int kind, float u, float h){
  if(kind==0) return shapeSphere(u,h);
  if(kind==1) return shapeCube(u,h);
  if(kind==2) return shapeTorus(u,h);
  if(kind==3) return shapeHelix(u,h);
  if(kind==4) return shapeGrid(u,h);
  if(kind==5) return shapeLine(u,h);
  if(kind==6) return shapeHeart(u,h);
  if(kind==7) return shapeRing(u,h);
  return shapeWave(u,h);
}
`;

/* ------------------------------------------------------------------ *
 *  world — the raymarched / analytic environment behind everything
 * ------------------------------------------------------------------ */
export const WORLD_FS = `#version 300 es
precision highp float;
${COMMON}
uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCamPos, uCamTarget;
uniform float uRoll, uFov;
uniform vec3  uBands;      // bass, mid, high (0..1)
uniform float uPulse;      // decaying beat envelope 0..1
uniform float uCoreR;      // core radius
uniform float uGlow;       // core glow strength
uniform float uDisperse;   // how torn apart the world is
uniform float uBoxShow;    // simulation bounding box
uniform float uGridShow;   // floor grid
uniform float uStars;
uniform float uShock;      // shockwave progress 0..1 (1 = gone)
uniform float uShock2;
uniform float uGlitch;
uniform float uRings;          // orbit rings
uniform vec3  uTintA, uTintB;   // palette
uniform float uVoid;            // 1 = empty void (isolation)
uniform float uInside;          // 1 = camera inside the world
out vec4 outColor;

float sdBox(vec3 p, vec3 b){ vec3 q = abs(p)-b; return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0); }
float sdBoxFrame(vec3 p, vec3 b, float e){
  p = abs(p)-b;
  vec3 q = abs(p+e)-e;
  return min(min(
    length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
    length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
    length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
}

// the living core: a sphere displaced by noise, breathing with the beat
float mapCore(vec3 p){
  float r = uCoreR * (1.0 + 0.10*uPulse + 0.05*uBands.x);
  float d = length(p) - r;
  d -= 0.075*r*fbm(p*(3.4/r) + vec3(0.0, uTime*0.5, 0.0));
  d += 0.02*r*sin(p.y*14.0 - uTime*3.0);
  return d;
}
vec3 coreNormal(vec3 p){
  vec2 e = vec2(0.0025, 0.0);
  return normalize(vec3(mapCore(p+e.xyy)-mapCore(p-e.xyy),
                        mapCore(p+e.yxy)-mapCore(p-e.yxy),
                        mapCore(p+e.yyx)-mapCore(p-e.yyx)));
}

// camera basis
void basis(out vec3 ro, out vec3 rd, out vec3 right, out vec3 up){
  ro = uCamPos;
  vec3 fw = normalize(uCamTarget - ro);
  right = normalize(cross(vec3(sin(uRoll), cos(uRoll), 0.0), fw));
  up = cross(fw, right);
  vec2 uv = (gl_FragCoord.xy*2.0 - uRes) / uRes.y;
  rd = normalize(fw + (uv.x*right + uv.y*up) * uFov);
}

void main(){
  vec3 ro, rd, right, up;
  basis(ro, rd, right, up);
  float t = uTime;
  vec3 col = vec3(0.0);

  // ---------- sky ----------
  float h = rd.y;
  vec3 skyTop = mix(vec3(0.004,0.006,0.016), uTintA*0.055, 0.5);
  vec3 skyBot = mix(vec3(0.011,0.007,0.020), uTintB*0.040, 0.4);
  col += mix(skyBot, skyTop, smoothstep(-0.6, 0.8, h));

  // stars
  if(uStars > 0.001){
    vec3 sd = rd*90.0;
    vec3 cell = floor(sd);
    vec3 f = fract(sd)-0.5;
    float rnd = hash33(cell).x;
    if(rnd > 0.982){
      float d = length(f);
      float tw = 0.55 + 0.45*sin(t*3.0 + rnd*90.0);
      col += vec3(0.75,0.86,1.0) * smoothstep(0.20,0.0,d) * tw * uStars * 0.9;
    }
    col += vec3(0.05,0.07,0.16)*uStars*0.14*fbm(rd*4.0+vec3(t*0.03));
  }

  // ---------- the core ----------
  float glow = uGlow * (0.55 + 0.75*uPulse + 0.5*uBands.x);
  {
    // analytic closest approach to origin for the halo
    float b = dot(ro, rd);
    float ca = max(0.0, -b);
    float dmin = length(ro + rd*ca);
    col += uTintB * glow * 0.20 / (0.25 + dmin*dmin*12.0);
    col += vec3(1.0,0.72,0.45) * glow * 0.15 / (0.06 + dmin*dmin*34.0);
  }
  if(uVoid < 0.999){
    float tt = 0.0;
    float hit = 0.0;
    for(int i=0;i<56;i++){
      vec3 p = ro + rd*tt;
      float d = mapCore(p);
      if(d < 0.0035){ hit = 1.0; break; }
      tt += d*0.92;
      if(tt > 14.0) break;
    }
    if(hit > 0.5){
      vec3 p = ro + rd*tt;
      vec3 n = coreNormal(p);
      float fres = pow(1.0-max(dot(n,-rd),0.0), 2.4);
      vec3 base = mix(vec3(0.05,0.06,0.12), uTintA*0.5, 0.5+0.5*n.y);
      vec3 emis = mix(uTintB, vec3(1.0,0.78,0.5), 0.55) * (0.5+1.5*uPulse);
      col = mix(base, emis, 0.30 + 0.55*fres);
      col += emis * 0.9 * fres;
      // scan bands travelling over the core
      float band = sin(p.y*26.0 - t*5.0);
      col += emis*0.35*smoothstep(0.88,1.0,band);
    }
  }

  // ---------- floor grid ----------
  if(uGridShow > 0.001 && rd.y < -0.0005){
    float gy = -1.85;
    float tt = (gy - ro.y)/rd.y;
    if(tt > 0.0 && tt < 70.0){
      vec3 p = ro + rd*tt;
      vec2 g = abs(fract(p.xz*1.0)-0.5)/max(fwidth(p.xz*1.0), vec2(1e-5));
      float line = 1.0 - min(min(g.x,g.y),1.0);
      float fade = exp(-tt*0.055);
      vec3 gc = mix(uTintA, uTintB, 0.35+0.35*sin(p.x*0.10+p.z*0.13+t*0.5));
      col += gc * line * fade * 0.55 * uGridShow;
      // faint paper-grid
      vec2 g2 = abs(fract(p.xz*0.2)-0.5)/max(fwidth(p.xz*0.2), vec2(1e-5));
      col += gc * (1.0-min(min(g2.x,g2.y),1.0)) * fade * 0.10 * uGridShow;
    }
  }
  // mirror grid above (the world is a box)
  if(uGridShow > 0.001 && uBoxShow > 0.001 && rd.y > 0.0005){
    float gy = 1.85;
    float tt = (gy - ro.y)/rd.y;
    if(tt > 0.0 && tt < 70.0){
      vec3 p = ro + rd*tt;
      vec2 g = abs(fract(p.xz*1.0)-0.5)/max(fwidth(p.xz*1.0), vec2(1e-5));
      float line = 1.0 - min(min(g.x,g.y),1.0);
      col += uTintA * line * exp(-tt*0.06) * 0.35 * uBoxShow * uGridShow;
    }
  }

  // ---------- simulation bounding box ----------
  if(uBoxShow > 0.001){
    vec3 b = vec3(2.15, 1.85, 2.15);
    float k = 0.0;
    vec3 t1 = (-b - ro)/rd, t2 = (b - ro)/rd;
    vec3 tmax = max(t1,t2);
    float tn = max(max(min(t1.x,t2.x), min(t1.y,t2.y)), min(t1.z,t2.z));
    float tf = min(min(tmax.x,tmax.y), tmax.z);
    if(tf > max(tn,0.0)){
      float tt = max(tn,0.0) + (tf-max(tn,0.0))*0.4;
      for(int i=0;i<28;i++){
        vec3 p = ro + rd*tt;
        vec3 q = abs(p) - b;
        float d = sdBoxFrame(p, b, 0.006);
        if(d < 0.004){ k = 1.0; break; }
        tt += max(d*0.9, 0.002);
        if(tt > tf) break;
      }
    }
    float pulse = 0.6+0.4*sin(t*1.7);
    col += mix(uTintA, vec3(1.0), 0.35) * k * uBoxShow * (0.55+0.45*pulse) * 1.1;
  }

  // ---------- orbit rings (the machinery around the world) ----------
  if(uRings > 0.001){
    for(int i=0;i<3;i++){
      float fi = float(i);
      float tilt = 0.55 + fi*0.42;
      float spin = t*(0.22 + fi*0.15) + fi*1.9;
      vec3 n = normalize(vec3(sin(tilt)*cos(spin), cos(tilt), sin(tilt)*sin(spin)));
      float den = dot(rd, n);
      if(abs(den) > 1e-4){
        float tt = -dot(ro, n)/den;
        if(tt > 0.0){
          vec3 p = ro + rd*tt;
          float R = 1.55 + fi*0.62 + 0.06*sin(t*1.3 + fi*2.0);
          float d = length(p) - R;
          float w = 0.012 + 0.010*fi;
          float g = exp(-pow(d/w, 2.0));
          float ang = atan(p.z, p.x);
          float dash = 0.45 + 0.55*step(0.0, sin(ang*(7.0+fi*4.0) - t*(1.4+fi*0.5)));
          col += mix(uTintA, uTintB, fi*0.5) * g * uRings * (0.55+0.75*uPulse) * dash * 1.35;
        }
      }
    }
  }

  // ---------- shockwaves ----------
  for(int s=0;s<2;s++){
    float ph = (s==0)? uShock : uShock2;
    if(ph <= 0.0 || ph >= 1.0) continue;
    float rad = ph * 6.2;
    float b = dot(ro, rd);
    float ca = max(0.0, -b);
    float dmin = length(ro + rd*ca);
    float ring = exp(-pow((dmin-rad)*4.2, 2.0));
    float fade = (1.0-ph)*(1.0-ph);
    col += mix(uTintA, vec3(1.0), 0.5) * ring * fade * 0.95;
    // floor ring
    if(rd.y < -0.0005){
      float gy = -1.84;
      float tt = (gy-ro.y)/rd.y;
      if(tt>0.0 && tt<70.0){
        vec3 p = ro+rd*tt;
        float rr = length(p.xz);
        col += mix(uTintB,vec3(1.0),0.4)*exp(-pow((rr-rad*1.5)*2.6,2.0))*fade*0.6*step(0.001,uGridShow);
      }
    }
  }

  // ---------- noise haze ----------
  float haze = fbm(vec3(rd.xz*2.2, t*0.06)) * 0.012;
  col += mix(uTintA, uTintB, 0.5) * haze * (0.4+0.9*uDisperse);

  // ---------- glitch ----------
  if(uGlitch > 0.001){
    float row = floor(gl_FragCoord.y/6.0);
    float g = hash12(vec2(row, floor(t*24.0)));
    if(g > 1.0-uGlitch*0.28){
      float sh = (hash12(vec2(row*3.1, floor(t*24.0)))-0.5)*0.06*uGlitch;
      vec3 c2 = col;
      c2.r = col.r;
      col = mix(col, c2, 0.5);
      col.r *= 1.0+sh*6.0;
      col.b *= 1.0-sh*6.0;
    }
  }

  // vignette
  vec2 vuv = (gl_FragCoord.xy*2.0-uRes)/uRes.y;
  col *= 1.0 - 0.30*dot(vuv,vuv)*0.35;
  col = max(col, vec3(0.0));
  outColor = vec4(col, 1.0);
}`;

/* ------------------------------------------------------------------ *
 *  particles — instanced points (the mass of the world)
 * ------------------------------------------------------------------ */
const PARTICLE_COMMON = `
${COMMON}
${SHAPES}
uniform float uTime;
uniform float uCount;
uniform int   uShapeA, uShapeB;
uniform float uMorph;
uniform float uSpin;
uniform float uScale;
uniform float uDisperse;
uniform float uPulse;
uniform vec3  uBands;
uniform vec3  uCamPos;
uniform vec3  uTintA, uTintB;
uniform float uVoid;
uniform float uAttract;
uniform float uSeed;
uniform vec3  uOffset;

vec3 particlePos(float i, float n, out float rnd){
  float u = i/n;
  float h = hash11(i*1.37 + uSeed);
  rnd = h;
  vec3 a = shapeAt(uShapeA, u, h);
  vec3 b = shapeAt(uShapeB, u, h);
  vec3 p = mix(a, b, uMorph);
  // breathing
  float br = 1.0 + 0.045*sin(uTime*1.3 + i*0.01) + 0.06*uPulse;
  p *= uScale*br;
  p = rotY(p, uSpin);
  p = rotX(p, sin(uTime*0.23)*0.14);
  // dispersion: blow the world apart, each point along its own direction
  vec3 dir = normalize(p + vec3(0.001));
  vec3 jit = (hash33(vec3(i*0.37, i*0.11, uSeed))-0.5);
  p += dir * uDisperse * (2.2 + 3.0*h) + jit*uDisperse*1.7;
  p = mix(p, p*(1.0-uAttract) + normalize(p+0.001)*(uScale*0.42), uAttract);
  // gentle swirl
  float ang = uTime*0.12*(1.0+h*0.4);
  p.xz = rot2(ang) * p.xz;
  return p + uOffset;
}`;

export const POINTS_VS = `#version 300 es
${PARTICLE_COMMON}
uniform mat4 uViewProj;
uniform float uPix;
out vec3 vCol; out float vAlpha;
void main(){
  float rnd;
  vec3 p = particlePos(float(gl_VertexID), uCount, rnd);
  vec4 clip = uViewProj * vec4(p, 1.0);
  gl_Position = clip;
  float dist = length(p - uCamPos);
  gl_PointSize = clamp(uPix * (1.0+rnd*0.9) / max(dist,0.15), 1.0, 26.0);
  float band = (rnd < 0.34) ? uBands.x : (rnd < 0.72 ? uBands.y : uBands.z);
  float hue = pow(hash11(float(gl_VertexID)*0.71), 1.7);
  vec3 c = mix(uTintA, uTintB, hue);
  c = mix(c, vec3(1.0), 0.22*band);
  float near = smoothstep(0.0, 1.2, dist);
  float far  = 1.0 - smoothstep(9.0, 26.0, dist);
  float spark = 0.5 + 1.5*pow(hash11(float(gl_VertexID)*2.13), 3.0);
  vAlpha = (0.09 + 0.42*band) * near * far * (1.0 - 0.55*uVoid) * spark;
  vCol = c * (0.75 + 1.9*band);
}`;

export const POINTS_FS = `#version 300 es
precision highp float;
in vec3 vCol; in float vAlpha;
uniform float uTime;
out vec4 outColor;
void main(){
  vec2 d = gl_PointCoord*2.0-1.0;
  float r2 = dot(d,d);
  if(r2 > 1.0) discard;
  float core = exp(-r2*6.5);
  float ring = exp(-pow((sqrt(r2)-0.60)*6.0,2.0));
  float a = (core*0.95 + ring*0.30) * vAlpha;
  outColor = vec4(vCol * a, a);
}`;

export const GLYPH_VS = `#version 300 es
${PARTICLE_COMMON}
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 aCell;   // u0,v0,u1,v1 in atlas
uniform mat4 uViewProj;
uniform float uProjY;        // projection[1][1] : world units -> NDC at distance 1
uniform float uGlyphSize;    // world-space glyph height
out vec2 vUV; out vec3 vCol; out float vAlpha;
void main(){
  float rnd;
  vec3 p = particlePos(float(gl_InstanceID), uCount, rnd);
  vec4 clip = uViewProj * vec4(p, 1.0);
  float dist = max(length(p - uCamPos), 0.05);
  float ndc = uGlyphSize * (1.0 + rnd*1.1) * uProjY / dist;
  vec2 off = (aCorner - 0.5) * vec2(ndc*0.62, ndc);
  gl_Position = vec4(clip.xy/clip.w + off, clip.z/clip.w, 1.0) * clip.w;
  vUV = mix(aCell.xy, aCell.zw, aCorner);
  float band = (rnd < 0.34) ? uBands.x : (rnd < 0.72 ? uBands.y : uBands.z);
  float hue = pow(hash11(float(gl_InstanceID)*0.53), 1.4);
  vec3 c = mix(uTintA, uTintB, hue);
  vCol = mix(c, vec3(1.0), 0.16*band) * (0.9 + 1.5*band);
  float spark = 0.45 + 1.55*pow(hash11(float(gl_InstanceID)*3.71), 4.0);
  vAlpha = (0.06 + 0.26*band) * spark * (1.0-0.45*uVoid)
         * (1.0 - smoothstep(4.0, 14.0, dist));
}`;

export const GLYPH_FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vCol; in float vAlpha;
uniform sampler2D uAtlas;
out vec4 outColor;
void main(){
  float a = texture(uAtlas, vUV).a;
  a = smoothstep(0.30, 0.60, a) * vAlpha;
  if(a <= 0.002) discard;
  outColor = vec4(vCol*a, a);
}`;

/* ------------------------------------------------------------------ *
 *  post — bloom, grade, CRT
 * ------------------------------------------------------------------ */
export const BRIGHT_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uThreshold;
out vec4 outColor;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec3 c = texture(uTex, uv).rgb;
  float l = dot(c, vec3(0.2126,0.7152,0.0722));
  float k = max(0.0, l - uThreshold) / max(l, 1e-4);
  outColor = vec4(c*k, 1.0);
}`;

export const BLUR_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uDir;
out vec4 outColor;
void main(){
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec3 s = texture(uTex, uv).rgb * 0.2270270270;
  s += texture(uTex, uv + uDir*uTexel*1.3846153846).rgb * 0.3162162162;
  s += texture(uTex, uv - uDir*uTexel*1.3846153846).rgb * 0.3162162162;
  s += texture(uTex, uv + uDir*uTexel*3.2307692308).rgb * 0.0702702703;
  s += texture(uTex, uv - uDir*uTexel*3.2307692308).rgb * 0.0702702703;
  outColor = vec4(s, 1.0);
}`;

export const COMPOSITE_FS = `#version 300 es
precision highp float;
${COMMON}
uniform sampler2D uScene, uBloom1, uBloom2, uBloom3;
uniform vec2  uRes;
uniform float uTime;
uniform float uBloom;
uniform float uFade;       // 0 = black, 1 = full
uniform float uWhite;      // white flash 0..1
uniform float uChroma;
uniform float uScan;
uniform float uGrain;
uniform float uGlitch;
uniform float uExposure;
uniform float uSat;
uniform vec3  uLift, uGain;
uniform float uBarrel;
uniform float uFlashCol;   // 0 normal, 1 warm
out vec4 outColor;

vec2 distort(vec2 uv, float k){
  vec2 c = uv*2.0-1.0;
  float r2 = dot(c,c);
  c *= 1.0 + k*r2;
  return c*0.5+0.5;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float t = uTime;

  // ---- glitch tearing (row displacement) ----
  if(uGlitch > 0.001){
    float row = floor(uv.y*90.0);
    float g = hash12(vec2(row, floor(t*30.0)));
    if(g > 1.0 - uGlitch*0.35){
      uv.x += (hash12(vec2(row*7.3, floor(t*30.0)))-0.5)*0.09*uGlitch;
    }
    float blk = hash12(vec2(floor(uv.y*12.0), floor(t*12.0)));
    if(blk > 1.0-uGlitch*0.12) uv.x += (hash12(vec2(floor(uv.y*12.0), 3.0))-0.5)*0.02;
  }

  vec2 duv = distort(uv, uBarrel);
  vec2 d = duv - 0.5;
  float r2 = dot(d,d);

  // ---- chromatic aberration ----
  float ca = uChroma * (0.0016 + 0.010*r2);
  vec3 col;
  col.r = texture(uScene, duv + d*ca).r;
  col.g = texture(uScene, duv).g;
  col.b = texture(uScene, duv - d*ca).b;

  // ---- bloom (three mips) ----
  vec3 b = texture(uBloom1, duv).rgb * 1.0
         + texture(uBloom2, duv).rgb * 0.85
         + texture(uBloom3, duv).rgb * 0.7;
  col += b * uBloom;

  // ---- CRT scanlines + rolling bar ----
  float scan = sin(duv.y*uRes.y*1.6)*0.5+0.5;
  col *= 1.0 - uScan*0.18*scan;
  float roll = fract(duv.y*0.6 - t*0.09);
  col *= 1.0 + uScan*0.06*smoothstep(0.96,1.0,roll);
  // subtle aperture grille
  float grille = 0.5+0.5*sin(duv.x*uRes.x*3.14159/1.5);
  col *= mix(1.0, 0.94+0.06*grille, uScan*0.5);

  // ---- grade ----
  col *= uExposure;
  col = col*uGain + uLift;
  col = max(col - 0.010, vec3(0.0)) * 1.07;   // crush the toe -> real blacks
  float lum = dot(col, vec3(0.2126,0.7152,0.0722));
  col = mix(vec3(lum), col, uSat);
  col = max(col, vec3(0.0));
  col = col / (1.0 + col*0.85);          // filmic-ish rolloff
  col = pow(col, vec3(0.4545*1.02));     // to display

  // ---- white flash ----
  if(uWhite > 0.0001){
    vec3 fc = mix(vec3(1.0), vec3(1.0,0.86,0.62), uFlashCol);
    col = mix(col, fc, clamp(uWhite,0.0,1.0));
  }

  // ---- grain (deterministic in t) ----
  float g1 = hash12(gl_FragCoord.xy + vec2(t*137.0, t*71.0));
  float g2 = hash12(gl_FragCoord.xy*1.7 - vec2(t*53.0, t*97.0));
  col += (g1-0.5)*uGrain + (g2-0.5)*uGrain*0.5;

  // ---- fade ----
  col *= clamp(uFade, 0.0, 1.0);
  outColor = vec4(col, 1.0);
}`;
