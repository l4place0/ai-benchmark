// Minimal RFC6455 WebSocket client (no deps) for Chrome DevTools Protocol.
'use strict';
const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class WS extends EventEmitter {
  constructor(url) {
    super();
    const m = /^ws:\/\/([^:/]+):(\d+)(\/.*)$/.exec(url);
    if (!m) throw new Error('bad ws url ' + url);
    this.host = m[1]; this.port = +m[2]; this.path = m[3];
    this.buf = Buffer.alloc(0);
    this.frag = [];
    this.fragOp = 0;
    this.ready = false;
    this.sock = net.connect(this.port, this.host, () => this._handshake());
    this.sock.on('data', d => this._onData(d));
    this.sock.on('error', e => this.emit('error', e));
    this.sock.on('close', () => this.emit('close'));
    this._id = 0;
    this._pending = new Map();
  }

  _handshake() {
    const key = crypto.randomBytes(16).toString('base64');
    const req =
      `GET ${this.path} HTTP/1.1\r\n` +
      `Host: ${this.host}:${this.port}\r\n` +
      `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
      `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`;
    this.sock.write(req);
    this._expect = crypto.createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  }

  _onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (!this.ready) {
      const i = this.buf.indexOf('\r\n\r\n');
      if (i < 0) return;
      const head = this.buf.slice(0, i).toString();
      if (!/101/.test(head.split('\r\n')[0])) { this.emit('error', new Error('handshake failed: ' + head)); return; }
      this.buf = this.buf.slice(i + 4);
      this.ready = true;
      this.emit('open');
    }
    this._drain();
  }

  _drain() {
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      let mask = null;
      if (masked) { if (b.length < off + 4) return; mask = b.slice(off, off + 4); off += 4; }
      if (b.length < off + len) return;
      let payload = b.slice(off, off + len);
      if (mask) { const p = Buffer.from(payload); for (let i = 0; i < p.length; i++) p[i] ^= mask[i & 3]; payload = p; }
      this.buf = b.slice(off + len);

      if (op === 0x0) { this.frag.push(payload); }
      else if (op === 0x1 || op === 0x2) { this.fragOp = op; this.frag = [payload]; }
      else if (op === 0x8) { this.sock.end(); return; }
      else if (op === 0x9) { this._frame(0xa, payload); continue; }
      else continue;

      if (fin) {
        const full = Buffer.concat(this.frag);
        this.frag = [];
        this.emit('message', this.fragOp === 0x1 ? full.toString('utf8') : full);
      }
    }
  }

  _frame(op, payload) {
    const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8');
    const mask = crypto.randomBytes(4);
    const len = data.length;
    let header;
    if (len < 126) header = Buffer.alloc(2), header[1] = 0x80 | len;
    else if (len < 65536) { header = Buffer.alloc(4); header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[1] = 0x80 | 127; header.writeBigUInt64BE(BigInt(len), 2); }
    header[0] = 0x80 | op;
    const masked = Buffer.from(data);
    for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i & 3];
    this.sock.write(Buffer.concat([header, mask, masked]));
  }

  send(str) { this._frame(0x1, str); }

  // CDP convenience
  cmd(method, params = {}, sessionId) {
    const id = ++this._id;
    return new Promise((res, rej) => {
      this._pending.set(id, { res, rej });
      const msg = { id, method, params };
      if (sessionId) msg.sessionId = sessionId;
      this.send(JSON.stringify(msg));
    });
  }
}

// route incoming messages to pending cmds
const _origEmit = WS.prototype.emit;
WS.prototype.emit = function (ev, ...a) {
  if (ev === 'message') {
    let msg; try { msg = JSON.parse(a[0]); } catch { return false; }
    if (msg.id && this._pending.has(msg.id)) {
      const { res, rej } = this._pending.get(msg.id);
      this._pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      return true;
    }
    return _origEmit.call(this, 'cdp', msg);
  }
  return _origEmit.call(this, ev, ...a);
};

module.exports = { WS };
