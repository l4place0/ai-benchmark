// shaders.js — every GLSL program in the MV.
//
// Visual language: an infinite sheet of graph paper hanging in the dark, on
// which a program draws itself. Everything is line, dot or halftone; there are
// no image textures anywhere, so every frame is computed from t alone.

/* ------------------------------------------------------------------ common */
const COMMON = `
const float PI  = 3.14159265359;
const float TAU = 6.28318530718;

float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2  hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x),
             mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s += a*vnoise(p); p*=2.03; a*=0.5; } return s; }
mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
`;

/* -------------------------------------------------------------- fullscreen */
export const QUAD_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

/* ------------------------------------------------------------- world shader */
export const WORLD_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
${COMMON}

uniform vec2  uRes;
uniform vec3  uCamPos, uCamRight, uCamUp, uCamFwd;
uniform float uTanHalf;
uniform float uTime;

// look
uniform vec3  uBg, uFg, uAccent, uWarn;
uniform float uPaper;        // 0 = glowing ink on black, 1 = ink on cream paper
uniform float uGlow;         // extra HDR energy on lines (bloom source)
uniform float uExposure;

// ground
uniform float uGridFade;     // how far the paper reaches before fog
uniform float uGridWarp;     // sinusoidal warp of the sheet
uniform float uGridWarpFreq;
uniform float uRings;        // concentric ring amplitude
uniform float uRingFreq;
uniform float uCircuit;      // 0..1 circuit-trace texture instead of plain grid
uniform float uScan;         // horizontal raster on the sheet
uniform float uCrack;        // fracture running across the sheet
uniform float uHorizon;      // glow along the horizon line
uniform float uFog;          // fog density
uniform float uStars;
uniform float uMoon, uMoonX, uMoonY;

float gridMask(vec2 w, float cell, float width){
  vec2 q = w / cell;
  vec2 d = abs(fract(q - 0.5) - 0.5) / max(fwidth(q), 1e-6);
  return 1.0 - min(min(d.x, d.y) / width, 1.0);
}

void main(){
  vec2 ndc = vUv*2.0 - 1.0;
  ndc.x *= uRes.x / uRes.y;
  vec3 rd = normalize(uCamFwd + uCamRight*ndc.x*uTanHalf + uCamUp*ndc.y*uTanHalf);
  vec3 ro = uCamPos;

  float horizon = dot(rd, vec3(0.0));
  // sky / void
  float up = rd.y;
  vec3 sky = mix(uBg, uBg*0.35 + uAccent*0.06, smoothstep(-0.25, 0.7, up));
  sky += uAccent*0.05*exp(-abs(up)*6.0);

  // stars, deterministic on direction
  if (uStars > 0.001 && up > -0.05){
    vec3 sd = rd/max(0.001, abs(rd.y)+0.35);
    vec2 sc = sd.xz*38.0 + sd.xy*11.0;
    vec2 cell = floor(sc);
    vec2 f = fract(sc)-0.5;
    float r = hash12(cell);
    if (r > 0.955){
      float tw = 0.6+0.4*sin(uTime*2.0 + r*90.0);
      float d = length(f - (hash22(cell)-0.5)*0.6);
      sky += uFg*exp(-d*90.0)*uStars*tw*smoothstep(0.0,0.25,up);
    }
  }

  vec3 col = sky;
  float alpha = 0.0;

  // ---- the sheet -----------------------------------------------------------
  if (rd.y < -0.0005){
    float t = (0.0 - ro.y) / rd.y;
    if (t > 0.0){
      vec3 p = ro + rd*t;
      vec2 w = p.xz;
      // warp the sheet
      w += uGridWarp * vec2(sin(w.y*uGridWarpFreq + uTime*0.7), cos(w.x*uGridWarpFreq*0.9 - uTime*0.5));
      float dist = length(p.xz);

      float minor = gridMask(w, 1.0, 1.2);
      float major = gridMask(w, 8.0, 1.9);
      float super = gridMask(w, 64.0, 2.6);
      float g = 0.22*minor + 0.55*major + 1.0*super*uCircuit*0.0 + 0.9*super*0.0;

      // circuit traces: orthogonal dashes chosen per cell
      if (uCircuit > 0.001){
        vec2 c2 = floor(w/4.0);
        float r = hash12(c2);
        vec2 lp = fract(w/4.0)-0.5;
        float seg = (r < 0.5)
          ? (1.0 - min(abs(lp.y)/0.035, 1.0))
          : (1.0 - min(abs(lp.x)/0.035, 1.0));
        float pad = 1.0 - min(length(lp)/0.11, 1.0);
        g += uCircuit * (seg*0.6 + pad*0.5);
      }

      // concentric rings — the "limit" motif
      if (uRings > 0.001){
        float rr = length(w) * uRingFreq;
        g += uRings * (1.0 - min(abs(fract(rr)-0.5)/max(fwidth(rr),1e-5)*0.9, 1.0));
      }

      // fracture
      if (uCrack > 0.001){
        float c = w.y - 6.0*sin(w.x*0.05) - 18.0*sin(w.x*0.013+1.7);
        g += uCrack * (1.0 - min(abs(c)/ (0.35 + 0.02*abs(w.x)), 1.0));
      }

      // raster / scanlines lying on the sheet
      if (uScan > 0.001){
        g += uScan * smoothstep(0.86, 1.0, sin(w.y*3.4 + uTime*1.5)*0.5+0.5) * 0.5;
      }

      // fog: the sheet dissolves into the void with distance
      float reach = max(uGridFade, 0.001);
      float fog = exp(-dist*uFog);
      fog *= 1.0 - smoothstep(reach*0.22, reach, dist);
      float a = clamp(g, 0.0, 1.0) * fog;

      // horizon glow where the sheet meets the void
      float hz = exp(-abs(t)*0.02) * uHorizon;

      vec3 lineCol = mix(uFg, uAccent, 0.25);
      col = mix(col, lineCol, a*0.92);
      col += lineCol * a * uGlow * fog;
      col += uAccent * hz * 0.5;
      alpha = a;
    }
  }

  // vignette + grade
  vec2 q = vUv-0.5;
  col *= 1.0 - 0.55*dot(q,q);

  // a soft disc hanging in the void — gives the empty half of the frame a centre
  if (uMoon > 0.001 && up > -0.12){
    vec2 sd = rd.xz/max(0.12, rd.y + 0.30);
    float d = length(sd - vec2(uMoonX, uMoonY));
    col += mix(uAccent, uFg, 0.35) * exp(-d*1.35) * uMoon * 0.85;
    col += uFg * exp(-d*9.0) * uMoon * 0.9;
  }

  col *= uExposure;
  outColor = vec4(max(col,0.0), alpha);
}`;

/* ------------------------------------------------------------------ sprites */
export const SPRITE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aPos;
layout(location=2) in vec2 aSize;
layout(location=3) in vec4 aColor;
layout(location=4) in float aRot;
layout(location=5) in float aShape;
layout(location=6) in float aSeed;
layout(location=7) in vec2 aParam;
uniform mat4 uViewProj;
uniform vec2 uRes;
out vec2 vLocal;
out vec4 vColor;
out float vShape;
out float vSeed;
out vec2 vParam;
void main(){
  vLocal = aCorner; vColor = aColor; vShape = aShape; vSeed = aSeed; vParam = aParam;
  float cr = cos(aRot), sr = sin(aRot);
  vec2 rc = vec2(aCorner.x*cr - aCorner.y*sr, aCorner.x*sr + aCorner.y*cr);
  vec3 up = normalize(vec3(uViewProj[0][1], uViewProj[1][1], uViewProj[2][1]));
  vec3 right = normalize(vec3(uViewProj[0][0], uViewProj[1][0], uViewProj[2][0]));
  vec3 wp = aPos + right*(rc.x*aSize.x) + up*(rc.y*aSize.y);
  gl_Position = uViewProj * vec4(wp, 1.0);
}`;

export const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec4 vColor;
in float vShape;
in float vSeed;
in vec2 vParam;
out vec4 outColor;
${COMMON}

// signed distance helpers in the unit quad (-1..1)
float sdCircle(vec2 p, float r){ return length(p)-r; }
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdTri(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r/k;
  if (p.x + k*p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
  p.x -= clamp(p.x, -2.0*r, 0.0);
  return -length(p)*sign(p.y);
}
float sdDiamond(vec2 p, float r){ return (abs(p.x)+abs(p.y)-r)*0.7071; }
float sdHeart(vec2 p){
  p.x = abs(p.x);
  if (p.y + p.x > 1.0) return length(p - vec2(0.25,0.75)) - 0.3535;
  return length(p - vec2(0.0,1.0))*0.9 - 0.9;
}

void main(){
  vec2 p = vLocal;
  float a = 0.0;
  float core = 0.0;
  int s = int(vShape + 0.5);

  if (s == 0){                                   // soft dot
    float r = 0.85;
    float d = length(p)/r;
    a = exp(-d*d*3.0);
    core = exp(-d*d*14.0);
  } else if (s == 1){                            // ring
    float d = abs(length(p) - 0.72) - 0.07;
    a = smoothstep(0.05, -0.02, d);
    core = smoothstep(0.028, -0.01, d);
  } else if (s == 2){                            // vertical bar
    float d = sdBox(p, vec2(0.055, 1.0));
    a = smoothstep(0.03, -0.01, d);
    core = a;
  } else if (s == 3){                            // horizontal bar
    float d = sdBox(p, vec2(1.0, 0.055));
    a = smoothstep(0.03, -0.01, d);
    core = a;
  } else if (s == 4){                            // square outline
    float d = abs(sdBox(p, vec2(0.62))) - 0.055;
    a = smoothstep(0.035, -0.012, d);
    core = a;
  } else if (s == 5){                            // filled square
    float d = sdBox(p, vec2(0.62));
    a = smoothstep(0.03, -0.01, d);
    core = a;
  } else if (s == 6){                            // triangle (warning)
    float d = sdTri(p, 0.85);
    a = smoothstep(0.035, -0.012, d);
    core = smoothstep(0.0, -0.05, d) * (1.0 - smoothstep(-0.30,-0.42,sdTri(p,0.52)));
  } else if (s == 7){                            // crosshair
    float d = min(sdBox(p, vec2(0.05, 0.9)), sdBox(p, vec2(0.9, 0.05)));
    a = smoothstep(0.03, -0.01, d);
    core = a;
  } else if (s == 8){                            // diamond
    float d = abs(sdDiamond(p, 0.9)) - 0.06;
    a = smoothstep(0.035, -0.012, d);
    core = a;
  } else if (s == 9){                            // arc / gauge
    float ang = atan(p.y, p.x);
    float target = mix(-PI, PI, vParam.y);
    float d = abs(length(p)-0.75) - 0.06;
    float w = 1.0 - smoothstep(0.0, 0.16, abs(ang-target));
    a = smoothstep(0.05, -0.02, d)*w;
    core = a;
  } else if (s == 10){                           // heart
    float d = sdHeart(p*0.72);
    a = smoothstep(0.03, -0.015, d);
    core = a;
  } else if (s == 11){                           // X — a rejected argument
    vec2 q1 = rot2(0.7853981)*p;
    vec2 q2 = rot2(-0.7853981)*p;
    float d = min(sdBox(q1, vec2(0.055,0.75)), sdBox(q2, vec2(0.055,0.75)));
    a = smoothstep(0.04, -0.015, d);
    core = a;
  } else if (s == 12){                           // bracket { }
    float d = min(sdBox(p-vec2(0.18,0.0), vec2(0.05,0.72)),
                  sdBox(p-vec2(-0.18,0.0), vec2(0.05,0.72)));
    d = min(d, sdBox(p-vec2(0.0,0.0), vec2(0.16,0.05)));
    a = smoothstep(0.035, -0.012, d);
    core = a;
  } else if (s == 13){                           // asterisk / spark
    float d = 1e9;
    for (int i=0;i<3;i++){
      float an = float(i)*PI/3.0 + vParam.y*PI;
      vec2 q = rot2(an)*p;
      d = min(d, sdBox(q, vec2(0.05, 0.85)));
    }
    a = smoothstep(0.03, -0.01, d);
    core = a;
  } else if (s == 14){                           // filled disc with hard edge
    float d = length(p)-0.85;
    a = smoothstep(0.04, -0.02, d);
    core = a;
  } else {                                       // fallback: soft dot
    a = exp(-dot(p,p)*3.0);
    core = a;
  }

  float alpha = clamp(a,0.0,1.0)*vColor.a;
  if (alpha <= 0.001) discard;
  vec3 rgb = vColor.rgb * alpha + vColor.rgb*core*alpha*vParam.x;
  outColor = vec4(rgb, alpha);
}`;

/* ------------------------------------------------------------------- figure */
export const FIGURE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
uniform vec2 uCenter;   // NDC
uniform vec2 uScale;    // NDC half-size (x,y)
uniform float uRot;
uniform float uAspect;  // res.y/res.x, to keep the drawing square
out vec2 vP;
mat2 rot2f(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
void main(){
  vec2 c = aCorner;
  vP = c;
  vec2 s = c * uScale * vec2(uAspect, 1.0);
  s = rot2f(uRot) * s;
  gl_Position = vec4(uCenter + s, 0.0, 1.0);
}`;

export const FIGURE_FS = `#version 300 es
precision highp float;
in vec2 vP;
out vec4 outColor;
${COMMON}

uniform vec3  uColorA, uColorB;
uniform vec3  uMatte;      // soft dark aura so line art reads against the grid
uniform float uMatteAmt;
uniform float uTime;
uniform float uMorph;      // morph progress between shape A and B
uniform int   uShapeA, uShapeB;
uniform float uHalftone;   // 0 = solid line art, 1 = halftone
uniform float uBands;      // topographic band density
uniform float uGlow;
uniform float uReveal;     // 0..1 draw-on (left to right)
uniform float uDissolve;   // 0..1 points fly away
uniform float uSeed;
uniform float uOpacity;

float sdCapsule(vec2 p, vec2 a, vec2 b, float r){
  vec2 pa = p-a, ba = b-a;
  float h = clamp(dot(pa,ba)/dot(ba,ba), 0.0, 1.0);
  return length(pa - ba*h) - r;
}
float sdBoxF(vec2 p, vec2 b){ vec2 d = abs(p)-b; return length(max(d,0.0)) + min(max(d.x,d.y),0.0); }
float sdTriF(vec2 p, float r){
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r/k;
  if (p.x + k*p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y)/2.0;
  p.x -= clamp(p.x, -2.0*r, 0.0);
  return -length(p)*sign(p.y);
}
float smin(float a, float b, float k){
  float h = clamp(0.5+0.5*(b-a)/k, 0.0, 1.0);
  return mix(b,a,h) - k*h*(1.0-h);
}

/* -- a person, the shape the program keeps coming back to -- */
float sdPerson(vec2 p){
  float d = length(p - vec2(0.0,0.62)) - 0.20;                                // head
  d = smin(d, sdCapsule(p, vec2(0.0,0.34), vec2(0.0,-0.18), 0.24), 0.10);     // torso
  d = smin(d, sdCapsule(p, vec2(-0.10,0.26), vec2(-0.36,0.02), 0.075), 0.07); // arms
  d = smin(d, sdCapsule(p, vec2( 0.10,0.26), vec2( 0.36,0.02), 0.075), 0.07);
  d = smin(d, sdCapsule(p, vec2(-0.10,-0.14), vec2(-0.16,-0.62), 0.095), 0.07);// legs
  d = smin(d, sdCapsule(p, vec2( 0.10,-0.14), vec2( 0.16,-0.62), 0.095), 0.07);
  return d;
}

/* -- the shapes the program tries on -- */
float shape(int id, vec2 p){
  if (id == 0){ return sdPerson(p); }
  else if (id == 1){ return length(p) - 0.02; }
  else if (id == 2){ return length(p) - 0.62; }
  else if (id == 3){ return abs(p.y - 0.45*sin(p.x*3.4)) - 0.02; }
  else if (id == 4){                                   // infinity / the limit
    vec2 q = vec2(abs(p.x), p.y);
    return min(length(q - vec2(0.36,0.0)) - 0.34, length(q + vec2(0.36,0.0)) - 0.34);
  } else if (id == 5){                                 // a cat
    float d = length(p - vec2(0.0,-0.05)) - 0.36;
    d = min(d, sdTriF((p-vec2(-0.24,0.34))*1.5, 0.34));
    d = min(d, sdTriF((p-vec2( 0.24,0.34))*1.5, 0.34));
    return d;
  } else if (id == 6){                                 // an eggplant
    vec2 q = rot2(-0.5)*p;
    float d = (length(q/vec2(0.34,0.58)) - 1.0)*0.55;
    d = min(d, sdCapsule(p, vec2(0.24,0.44), vec2(0.42,0.66), 0.045));
    return d;
  } else if (id == 7){                                 // a tomato
    return length(p) - 0.50 + 0.05*sin(atan(p.y,p.x)*5.0);
  } else if (id == 8){                                 // a heart
    vec2 q = vec2(p.x, -p.y*0.92) * 1.15;
    q.x = abs(q.x);
    if (q.y + q.x > 1.0) return length(q - vec2(0.25,0.75)) - 0.3535;
    return length(q - vec2(0.0,1.0))*0.9 - 0.9;
  } else if (id == 9){                                 // a machine / plug
    float d = sdCapsule(p, vec2(0.0,0.30), vec2(0.0,-0.55), 0.30);
    d = min(d, sdCapsule(p, vec2(-0.14,0.30), vec2(-0.14,0.72), 0.045));
    d = min(d, sdCapsule(p, vec2( 0.14,0.30), vec2( 0.14,0.72), 0.045));
    return d;
  } else if (id == 10){                                // a crowd of copies
    float d = 1e9;
    for (int i=0;i<5;i++){
      float fi = float(i)-2.0;
      d = min(d, sdPerson((p - vec2(fi*0.34, -abs(fi)*0.05)) * 1.35));
    }
    return d;
  } else if (id == 11){ return sdBoxF(p - vec2(0.0,-0.1), vec2(0.42,0.62)); }
  else if (id == 12){ return abs(length(p) - 0.62) - 0.02; }
  else if (id == 13){                                  // a semicolon, drawn large
    float d = length(p - vec2(-0.16, 0.34)) - 0.14;
    d = min(d, length(p - vec2(-0.16,-0.36)) - 0.14);
    return d;
  }
  return length(p)-0.5;
}

void main(){
  vec2 p = vP;
  float d = mix(shape(uShapeA,p), shape(uShapeB,p), smoothstep(0.0,1.0,uMorph));

  // dissolve: push samples outward with a deterministic jitter
  float jitter = hash12(floor(p*70.0) + uSeed);
  p += (hash22(floor(p*70.0)+uSeed)-0.5) * 0.05 * uDissolve * (0.4+jitter);
  d = mix(d, d + 1.2*uDissolve*(0.3+jitter), uDissolve);

  // draw-on reveal from the left
  float rev = smoothstep(-1.05, 1.05, p.x) ;
  d += (1.0 - smoothstep(rev-0.28, rev, uReveal)) * 4.0;

  float aa = fwidth(d)*0.9;
  float inside = smoothstep(aa, -aa, d);

  // halftone: dots grow toward the interior of the shape
  vec2 g = rot2(0.35)*p*26.0;
  vec2 cell = fract(g)-0.5;
  float dd = length(cell);
  float rad = clamp(-d*0.85, 0.02, 0.5);
  float dots = smoothstep(rad, rad-0.10, dd);
  float halftone = mix(inside, inside*dots*1.15, uHalftone);

  // topographic bands + outline
  float bands = 0.5+0.5*sin(d*uBands);
  bands = smoothstep(0.55,0.95,bands);
  float outline = exp(-abs(d)*70.0);

  // the drawn shape: outline, halftone fill, topographic bands
  float shapeMask = clamp(outline*0.95 + halftone + bands*inside*0.55, 0.0, 1.0);
  // a soft aura AROUND the shape, so thin line art reads against the grid
  float halo = (1.0 - smoothstep(-0.02, 0.36, d)) * uMatteAmt;

  float alpha = clamp(max(shapeMask, halo*0.9), 0.0, 1.0);
  float lit = shapeMask / max(alpha, 1e-4);

  vec3 col = mix(uColorA, uColorB, clamp(0.5 - d*0.7, 0.0, 1.0));
  col += uColorB * outline * uGlow;
  col = mix(uMatte, col, clamp(lit, 0.0, 1.0));

  alpha *= uOpacity;
  if (alpha < 0.002) discard;
  outColor = vec4(col*alpha, alpha);
}`;

/* --------------------------------------------------------------------- text */
export const TEXT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aPos;      // pixel position of the glyph quad's top-left
layout(location=2) in vec2 aSize;     // pixel size of the glyph
layout(location=3) in vec4 aUv;       // atlas rect
layout(location=4) in vec4 aColor;
layout(location=5) in vec2 aJitter;
uniform vec2 uRes;
out vec2 vUv;
out vec4 vColor;
void main(){
  vUv = mix(aUv.xy, aUv.zw, aCorner*0.5+0.5);
  vColor = aColor;
  vec2 px = aPos + (aCorner*0.5+0.5)*aSize + aJitter;
  vec2 ndc = (px/uRes)*2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
}`;

export const TEXT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
in vec4 vColor;
uniform sampler2D uAtlas;
out vec4 outColor;
void main(){
  float a = texture(uAtlas, vUv).a;
  a *= vColor.a;
  if (a < 0.004) discard;
  outColor = vec4(vColor.rgb*a, a);
}`;

/* ---- text placed anywhere in 3D: each glyph is a parallelogram ------------
 * Used to write code flat on the sheet and to stand big words up in the world. */
export const TEXT3D_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aOrigin;   // glyph origin in world space
layout(location=2) in vec3 aU;        // glyph x axis (world), full width
layout(location=3) in vec3 aV;        // glyph y axis (world), full height
layout(location=4) in vec4 aUv;
layout(location=5) in vec4 aColor;
uniform mat4 uViewProj;
out vec2 vUv;
out vec4 vColor;
void main(){
  vec2 c = aCorner*0.5+0.5;
  vUv = mix(aUv.xy, aUv.zw, c);
  vColor = aColor;
  gl_Position = uViewProj * vec4(aOrigin + aU*c.x + aV*c.y, 1.0);
}`;

/* -------------------------------------------------------------------- bloom */
export const BRIGHT_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold, uKnee;
out vec4 outColor;
void main(){
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(max(c.r,c.g),c.b);
  float soft = clamp(l - uThreshold + uKnee, 0.0, 2.0*uKnee);
  soft = soft*soft/(4.0*uKnee + 1e-5);
  float w = max(soft, l - uThreshold) / max(l, 1e-5);
  outColor = vec4(c*w, 1.0);
}`;

export const BLUR_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;      // texel step
out vec4 outColor;
void main(){
  // 9-tap gaussian, linear-sampled
  float w[5];
  w[0]=0.227027; w[1]=0.194594; w[2]=0.121621; w[3]=0.054054; w[4]=0.016216;
  vec3 s = texture(uTex, vUv).rgb * w[0];
  for (int i=1;i<5;i++){
    vec2 o = uDir*float(i)*1.35;
    s += texture(uTex, vUv+o).rgb * w[i];
    s += texture(uTex, vUv-o).rgb * w[i];
  }
  outColor = vec4(s, 1.0);
}`;

export const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 outColor;
void main(){
  vec3 s = texture(uTex, vUv + uTexel*vec2(-1,-1)).rgb;
  s += texture(uTex, vUv + uTexel*vec2( 1,-1)).rgb;
  s += texture(uTex, vUv + uTexel*vec2(-1, 1)).rgb;
  s += texture(uTex, vUv + uTexel*vec2( 1, 1)).rgb;
  outColor = vec4(s*0.25, 1.0);
}`;

/* ---------------------------------------------------------------- composite */
export const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
${COMMON}

uniform sampler2D uScene, uBloom0, uBloom1, uBloom2;
uniform vec3  uBloomW;
uniform vec2  uRes;
uniform float uTime;
uniform float uBloomAmt;
uniform float uCA;          // chromatic aberration (pixels)
uniform float uGrain;
uniform float uScanline;
uniform float uVignette;
uniform float uInvert;      // negative flash
uniform float uGlitch;      // horizontal tear
uniform float uExposure;
uniform vec3  uTint;
uniform float uBars;        // letterbox
uniform float uFade;        // global fade to black

void main(){
  vec2 uv = vUv;
  // horizontal tear
  if (uGlitch > 0.001){
    float band = floor(uv.y*38.0);
    float r = hash12(vec2(band, floor(uTime*18.0)));
    if (r > 1.0-uGlitch*0.8){
      uv.x += (hash12(vec2(band*3.1, floor(uTime*22.0)))-0.5)*0.12*uGlitch;
    }
  }
  vec2 d = (uv-0.5);
  float r2 = dot(d,d);
  vec2 ca = d*uCA*0.001*(0.4+r2*2.0);

  vec3 col;
  col.r = texture(uScene, uv + ca).r;
  col.g = texture(uScene, uv).g;
  col.b = texture(uScene, uv - ca).b;

  vec3 bl;
  bl.r = texture(uBloom0, uv + ca*1.8).r*uBloomW.x + texture(uBloom1, uv + ca*2.6).r*uBloomW.y + texture(uBloom2, uv + ca*4.0).r*uBloomW.z;
  bl.g = texture(uBloom0, uv).g*uBloomW.x + texture(uBloom1, uv).g*uBloomW.y + texture(uBloom2, uv).g*uBloomW.z;
  bl.b = texture(uBloom0, uv - ca*1.8).b*uBloomW.x + texture(uBloom1, uv - ca*2.6).b*uBloomW.y + texture(uBloom2, uv - ca*4.0).b*uBloomW.z;
  col += bl*uBloomAmt;

  // scanlines (only in the dark, screen-bound sections)
  col *= 1.0 - uScanline*0.35*(0.5+0.5*sin(vUv.y*uRes.y*PI));

  // grain — a pure function of position and frame
  float g = hash12(vUv*uRes + fract(uTime)*911.0) - 0.5;
  col += g*uGrain;

  col *= uTint;
  col = mix(col, vec3(1.0)-col, uInvert);

  // vignette
  col *= mix(1.0, 1.0 - 0.85*pow(r2*1.35, 1.25), uVignette);

  col *= uExposure;

  // letterbox bars
  if (uBars > 0.0005){
    float b = uBars;
    if (vUv.y < b || vUv.y > 1.0-b) col = vec3(0.0);
  }

  col *= uFade;
  outColor = vec4(max(col,0.0), 1.0);
}`;

/* ----------------------------------------------------------- paper overlay */
// A flat "paper" backdrop used when the world turns into a sheet of stationery:
// subtle fibre, edge darkening, and a printed dot raster.
export const PAPER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
${COMMON}
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uPaperCol, uInkCol;
uniform float uAmount;
uniform float uDot;
void main(){
  vec2 uv = vUv;
  float fib = fbm(uv*vec2(uRes.x/uRes.y,1.0)*7.0)*0.5 + fbm(uv*60.0)*0.5;
  vec3 c = uPaperCol*(0.94 + 0.09*fib);
  if (uDot > 0.001){
    vec2 g = uv*uRes/6.0;
    float d = length(fract(g)-0.5);
    c *= 1.0 - uDot*0.35*smoothstep(0.34,0.16,d);
  }
  float edge = 1.0 - 0.35*pow(dot(uv-0.5,uv-0.5)*1.6,1.2);
  c *= edge;
  outColor = vec4(c*uAmount, uAmount);
}`;
