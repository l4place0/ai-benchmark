// gl.js — small WebGL2 helpers. No dependencies.

export function compile(gl, type, src, label = '') {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = src.split('\n').map((l, i) => String(i + 1).padStart(4) + '| ' + l).join('\n');
    throw new Error(`shader compile failed (${label}):\n${log}\n${numbered}`);
  }
  return sh;
}

export function program(gl, vsSrc, fsSrc, label = '') {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc, label + ':vs'));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc, label + ':fs'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program link failed (${label}): ${gl.getProgramInfoLog(p)}`);
  }
  const u = new Proxy({}, {
    get: (cache, name) => {
      if (!(name in cache)) cache[name] = gl.getUniformLocation(p, name);
      return cache[name];
    },
  });
  p.u = u;
  return p;
}

export function texture(gl, {
  width, height, internalFormat = gl.RGBA8, format = gl.RGBA, type = gl.UNSIGNED_BYTE,
  filter = gl.LINEAR, wrap = gl.CLAMP_TO_EDGE, data = null,
} = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  t.width = width; t.height = height;
  return t;
}

export function fbo(gl, texture) {
  const f = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error('framebuffer incomplete: 0x' + st.toString(16));
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  f.texture = texture;
  f.width = texture.width;
  f.height = texture.height;
  return f;
}

export function target(gl, opts) {
  const tex = texture(gl, opts);
  return fbo(gl, tex);
}

/** Fullscreen triangle (no vertex buffer needed). */
export function screenQuad(gl) {
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  vao.count = 3;
  return vao;
}

/** Instanced quad with per-instance attributes described by `attrs`
 *  (each {name, size, loc}) plus a dynamic Float32Array `data`. */
export function instanceSet(gl, locs, sizes, capacity) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const corner = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corner);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const inst = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, inst);
  const stride = sizes.reduce((a, b) => a + b, 0) * 4;
  let off = 0;
  for (let i = 0; i < locs.length; i++) {
    gl.enableVertexAttribArray(locs[i]);
    gl.vertexAttribPointer(locs[i], sizes[i], gl.FLOAT, false, stride, off);
    gl.vertexAttribDivisor(locs[i], 1);
    off += sizes[i] * 4;
  }
  gl.bindVertexArray(null);
  return {
    vao, buf: inst, strideFloats: sizes.reduce((a, b) => a + b, 0), capacity,
    data: new Float32Array(sizes.reduce((a, b) => a + b, 0) * capacity),
    upload(count) {
      gl.bindBuffer(gl.ARRAY_BUFFER, inst);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, count * this.strideFloats), gl.DYNAMIC_DRAW);
    },
    draw(count) {
      if (count <= 0) return;
      this.upload(count);
      gl.bindVertexArray(vao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      gl.bindVertexArray(null);
    },
  };
}
