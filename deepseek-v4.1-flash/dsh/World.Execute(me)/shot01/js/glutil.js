// glutil.js — small WebGL2 helpers.

export function compile(gl, type, src, label) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => String(i + 1).padStart(4) + '| ' + l).join('\n');
    throw new Error(`[${label}] shader compile failed:\n${log}\n${numbered}`);
  }
  return s;
}

export function program(gl, vsSrc, fsSrc, label = 'program') {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc, label + '.vert'));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc, label + '.frag'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`[${label}] link failed: ${gl.getProgramInfoLog(p)}`);
  }
  // cache uniform locations
  const uniforms = new Proxy({}, {
    has: () => true,
    get(_, name) {
      if (!(name in p._u)) p._u[name] = gl.getUniformLocation(p, name);
      return p._u[name];
    },
  });
  p._u = {};
  p.u = uniforms;
  return p;
}

/** Full-screen triangle. WebGL2 needs *some* VAO bound; we use an empty one. */
export function fullscreenVAO(gl) {
  return gl.createVertexArray();
}

export function drawFullscreen(gl) {
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export const FS_TRIANGLE_VS = `#version 300 es
void main(){
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function createFBO(gl, w, h, { float = true, depth = false, filter = null } = {}) {
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const internal = float ? gl.RGBA16F : gl.RGBA8;
  const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  const f = filter ?? gl.LINEAR;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (depth) {
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    fbo._depth = rb;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  fbo.width = w; fbo.height = h; fbo.texture = tex;
  return fbo;
}

export function bindFBO(gl, fbo) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  if (fbo) gl.viewport(0, 0, fbo.width, fbo.height);
  else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
}

export function canvasTexture(gl, canvas, { mipmap = false, flipY = false } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}
