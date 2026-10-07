/* =============================================================================
   smoke_audio.mjs — the browser substitute for verifying js/audio.js.

   WHY THIS EXISTS
   ---------------
   Chromium cannot start in this sandbox (named pipes are blocked), so there is
   no real browser to run the piece in. This mock stands in for the Web Audio
   API: it keeps a VIRTUAL CLOCK, builds a real node graph, records every
   scheduling call together with the time it was made, and can evaluate the
   automation curve a parameter would actually follow — so a test can see what
   the engine would have done, not just that it did not throw.

   FIDELITY (and where it is deliberately stricter than Chrome)
   -----------------------------------------------------------
   * exponentialRampToValueAtTime(0, t) throws RangeError, exactly like Chrome.
     A negative exponential target is recorded as an error too (Chrome allows
     the call but the curve is meaningless).
   * Every scheduled value must be a finite number or the mock throws.
   * Oscillator/BufferSource start() may be called once, stop() once: calling
     either twice is an error, as in the real API.
   * Automation is NOT audio-rate accurate (no LFO mixing), so a value read
     back is "what the parameter was scheduled to be", not a sample.

   USAGE
     node _dev/smoke_audio.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'js', 'audio.js');

/* --------------------------------------------------------------- test frame */

let failures = 0;
let checks = 0;

function ok(cond, msg) {
  checks++;
  if (!cond) { failures++; console.log('  FAIL  ' + msg); }
  return !!cond;
}
function okEq(a, b, msg) { return ok(a === b, msg + '  (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function okNear(a, b, eps, msg) {
  const good = typeof a === 'number' && isFinite(a) && Math.abs(a - b) <= eps;
  return ok(good, msg + '  (got ' + a + ', want ~' + b + ')');
}
function section(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length))); }

/* ================================================================== the mock */

let NEXT_ID = 1;

class MockParam {
  constructor(ctx, value, kind) {
    this.ctx = ctx;
    this.name = kind || 'param';
    this._initial = value;
    this._value = value;
    this.events = [];
    this.calls = [];
  }
  get value() { return this._value; }
  set value(v) {
    this._finite(v, 'value');
    this._value = v;
    this._rec('value', [v]);
    this.events.push({ type: 'set', value: v, time: this.ctx.currentTime });
  }
  _finite(v, method) {
    if (typeof v !== 'number' || !isFinite(v)) {
      this.ctx._throws.push({ where: 'param.' + method, why: 'non-finite value ' + v, at: this.ctx.currentTime });
      throw new TypeError('AudioParam.' + method + ': value is not a finite number: ' + v);
    }
  }
  _time(t, method) {
    if (typeof t !== 'number' || !isFinite(t) || t < 0) {
      this.ctx._throws.push({ where: 'param.' + method, why: 'bad time ' + t, at: this.ctx.currentTime });
      throw new TypeError('AudioParam.' + method + ': bad time ' + t);
    }
  }
  _rec(method, args) {
    const rec = { param: this, method, args, at: this.ctx.currentTime };
    this.calls.push(rec);
    this.ctx._paramCalls.push(rec);
  }
  setValueAtTime(v, t) { this._finite(v, 'setValueAtTime'); this._time(t, 'setValueAtTime'); this._rec('setValueAtTime', [v, t]); this.events.push({ type: 'set', value: v, time: t }); return this; }
  linearRampToValueAtTime(v, t) { this._finite(v, 'linearRampToValueAtTime'); this._time(t, 'linearRampToValueAtTime'); this._rec('linearRampToValueAtTime', [v, t]); this.events.push({ type: 'linear', value: v, time: t }); return this; }
  exponentialRampToValueAtTime(v, t) {
    this._finite(v, 'exponentialRampToValueAtTime'); this._time(t, 'exponentialRampToValueAtTime');
    if (v === 0) {
      this.ctx._throws.push({ where: 'param.exponentialRampToValueAtTime', why: 'target is exactly 0', at: this.ctx.currentTime });
      throw new RangeError('AudioParam.exponentialRampToValueAtTime: value must not be 0');
    }
    if (v < 0) this.ctx._warn('exponentialRampToValueAtTime with negative target ' + v);
    this._rec('exponentialRampToValueAtTime', [v, t]); this.events.push({ type: 'exp', value: v, time: t }); return this;
  }
  setTargetAtTime(v, t, tc) {
    this._finite(v, 'setTargetAtTime'); this._time(t, 'setTargetAtTime');
    if (!(typeof tc === 'number' && isFinite(tc) && tc > 0)) {
      this.ctx._throws.push({ where: 'param.setTargetAtTime', why: 'bad time constant ' + tc, at: this.ctx.currentTime });
      throw new RangeError('AudioParam.setTargetAtTime: bad time constant ' + tc);
    }
    this._rec('setTargetAtTime', [v, t, tc]); this.events.push({ type: 'target', value: v, time: t, tc }); return this;
  }
  cancelScheduledValues(t) {
    this._time(t, 'cancelScheduledValues'); this._rec('cancelScheduledValues', [t]);
    this.events = this.events.filter((e) => e.time < t); return this;
  }
  setValueCurveAtTime(curve, t, dur) { this._rec('setValueCurveAtTime', [curve, t, dur]); return this; }

  /** The value the automation would hold at time `t` (approximate, no audio-rate mixing). */
  valueAt(t) {
    let v = this._initial, prevT = -Infinity;
    for (const e of this.events) {
      if (e.time > t) {
        const span = e.time - prevT;
        const k = (isFinite(span) && span > 0) ? Math.min(1, Math.max(0, (t - prevT) / span)) : 0;
        if (e.type === 'linear') return v + (e.value - v) * k;
        if (e.type === 'exp') return (v > 0) ? v * Math.pow(e.value / v, k) : e.value * k;
        return v;
      }
      if (e.type === 'target') {
        const dt = t - e.time;
        if (dt >= 0) return e.value + (v - e.value) * Math.exp(-dt / e.tc);
        return v;
      }
      v = e.value; prevT = e.time;
    }
    return v;
  }
}

class MockNode {
  constructor(ctx, type, kind) {
    this.ctx = ctx;
    this.id = NEXT_ID++;
    this.type = type;
    this.kind = kind;
    this.params = {};
    this._outs = [];
    this._ins = [];
    this._everNode = false;      // did this node ever feed another node (audio path)?
    this._everParam = false;     // ... or only feed AudioParams (modulation depth)?
    this._disconnected = false;
    ctx._nodes.push(this);
  }
  connect(dest) {
    if (dest instanceof MockParam) { this._outs.push(dest); this._everParam = true; dest.calls.push({ method: 'connectParam', args: [this.kind], at: this.ctx.currentTime }); return dest; }
    if (!(dest instanceof MockNode)) throw new TypeError('connect() needs an AudioNode or AudioParam');
    this._outs.push(dest); dest._ins.push(this); this._everNode = true;
    return dest;
  }
  disconnect() {
    for (const d of this._outs) if (d._ins) d._ins = d._ins.filter((n) => n !== this);
    this._outs = [];
    this._disconnected = true;
  }
  get live() { return !this._disconnected; }
  sigKind() { return this.kind; }
}

class MockGain extends MockNode {
  constructor(ctx) { super(ctx, 'GainNode', 'gain'); this.gain = new MockParam(ctx, 1, 'gain'); this.params.gain = this.gain; }
}
class MockOsc extends MockNode {
  constructor(ctx) { super(ctx, 'OscillatorNode', 'osc'); this.frequency = new MockParam(ctx, 440, 'frequency'); this.detune = new MockParam(ctx, 0, 'detune'); this.params.frequency = this.frequency; this.params.detune = this.detune; this.type = 'sine'; this._started = null; this._stopped = null; }
  sigKind() { return 'osc:' + this.type; }
  start(t) {
    if (this._started !== null) throw new Error('OscillatorNode.start() called twice');
    this._started = (t === undefined) ? this.ctx.currentTime : t;
    if (!isFinite(this._started)) throw new TypeError('start(): bad time');
  }
  stop(t) {
    if (this._started === null) throw new Error('OscillatorNode.stop() before start()');
    if (this._stopped !== null) throw new Error('OscillatorNode.stop() called twice');
    this._stopped = (t === undefined) ? this.ctx.currentTime : t;
    if (!isFinite(this._stopped)) throw new TypeError('stop(): bad time');
  }
}
class MockBufferSource extends MockNode {
  constructor(ctx) { super(ctx, 'AudioBufferSourceNode', 'src'); this.playbackRate = new MockParam(ctx, 1, 'playbackRate'); this.detune = new MockParam(ctx, 0, 'detune'); this.params.playbackRate = this.playbackRate; this.buffer = null; this.loop = false; this._started = null; this._stopped = null; }
  start(t) {
    if (this._started !== null) throw new Error('AudioBufferSourceNode.start() called twice');
    if (!this.buffer) throw new Error('AudioBufferSourceNode.start() with no buffer');
    this._started = (t === undefined) ? this.ctx.currentTime : t;
  }
  stop(t) {
    if (this._started === null) throw new Error('AudioBufferSourceNode.stop() before start()');
    this._stopped = (t === undefined) ? this.ctx.currentTime : t;
    if (!isFinite(this._stopped)) throw new TypeError('stop(): bad time');
  }
}
class MockBiquad extends MockNode {
  constructor(ctx) { super(ctx, 'BiquadFilterNode', 'biquad'); this.frequency = new MockParam(ctx, 350, 'frequency'); this.Q = new MockParam(ctx, 1, 'Q'); this.gain = new MockParam(ctx, 0, 'gain'); this.detune = new MockParam(ctx, 0, 'detune'); this.params.frequency = this.frequency; this.params.Q = this.Q; this.Q.name = 'Q'; this.type = 'lowpass'; }
  sigKind() { return 'biquad:' + this.type; }
}
class MockComp extends MockNode {
  constructor(ctx) {
    super(ctx, 'DynamicsCompressorNode', 'comp');
    this.threshold = new MockParam(ctx, -24, 'threshold'); this.knee = new MockParam(ctx, 30, 'knee');
    this.ratio = new MockParam(ctx, 12, 'ratio'); this.attack = new MockParam(ctx, 0.003, 'attack');
    this.release = new MockParam(ctx, 0.25, 'release');
  }
}
class MockPanner extends MockNode {
  constructor(ctx) { super(ctx, 'StereoPannerNode', 'pan'); this.pan = new MockParam(ctx, 0, 'pan'); this.params.pan = this.pan; }
}
class MockShaper extends MockNode {
  constructor(ctx) { super(ctx, 'WaveShaperNode', 'shaper'); this.curve = null; this.oversample = 'none'; }
}
class MockDelay extends MockNode {
  constructor(ctx) { super(ctx, 'DelayNode', 'delay'); this.delayTime = new MockParam(ctx, 0, 'delayTime'); this.params.delayTime = this.delayTime; }
}
class MockConvolver extends MockNode {
  constructor(ctx) { super(ctx, 'ConvolverNode', 'convolver'); this.buffer = null; this.normalize = true; }
}
class MockMerger extends MockNode {
  constructor(ctx, n) { super(ctx, 'ChannelMergerNode', 'merger'); this.numberOfInputs = n || 6; }
}
class MockDestination extends MockNode {
  constructor(ctx) { super(ctx, 'AudioDestinationNode', 'destination'); this.maxChannelCount = 2; }
}

class MockBuffer {
  constructor(ch, len, sr) { this.numberOfChannels = ch; this.length = len; this.sampleRate = sr; this.duration = len / sr; this._d = []; for (let i = 0; i < ch; i++) this._d.push(new Float32Array(len)); }
  getChannelData(i) { return this._d[i]; }
  copyToChannel(src, i) { this._d[i].set(src); }
}

class MockAudioContext {
  constructor(opts) {
    this.opts = opts || {};
    this.sampleRate = 48000;
    this.state = MockAudioContext.initialState || 'running';
    this._t = 0;
    this._nodes = [];
    this._buffers = [];
    this._throws = [];
    this._warns = [];
    this._paramCalls = [];
    this.destination = new MockDestination(this);
    this.resumeCalls = 0;
  }
  get currentTime() { return this._t; }
  set currentTime(v) { if (!isFinite(v)) throw new TypeError('bad clock'); this._t = v; this._tickTime = v; }
  resume() { this.resumeCalls++; this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { return new MockGain(this); }
  createOscillator() { return new MockOsc(this); }
  createBufferSource() { return new MockBufferSource(this); }
  createBiquadFilter() { return new MockBiquad(this); }
  createDynamicsCompressor() { return new MockComp(this); }
  createStereoPanner() { return new MockPanner(this); }
  createWaveShaper() { return new MockShaper(this); }
  createDelay(max) { const d = new MockDelay(this); d.maxDelayTime = max || 1; return d; }
  createConvolver() { return new MockConvolver(this); }
  createChannelMerger(n) { return new MockMerger(this, n); }
  createBuffer(ch, len, sr) {
    if (!(len > 0) || !isFinite(len)) throw new TypeError('createBuffer: bad length ' + len);
    const b = new MockBuffer(ch, len, sr || this.sampleRate);
    this._buffers.push(b);
    return b;
  }
  _warn(why) { this._warns.push({ why, at: this._t }); }
  /* --- inspection helpers used by the test --- */
  liveNodes() { return this._nodes.filter((n) => n.live); }
  nodesTagged(label) { return this._nodes.filter((n) => n.__plr === label); }
  createdSince(mark) { return this._nodes.slice(mark); }
}

/* ------------------------------------------------------------------- helpers */

function freshGlobal() {
  globalThis.window = globalThis;
  delete globalThis.PLR;
  delete globalThis.webkitAudioContext;
}

function loadEngine() {
  const code = fs.readFileSync(SRC, 'utf8');
  (0, eval)(code);                       // classic script, same as <script src>
  if (!globalThis.PLR || typeof globalThis.PLR.Audio !== 'function') {
    throw new Error('js/audio.js did not define PLR.Audio');
  }
  return globalThis.PLR.Audio;
}

const NAMES = ['click', 'switch', 'latch', 'door', 'drawer', 'cabinet', 'blinds', 'curtain',
  'lamp', 'steam', 'page', 'record', 'recordStop', 'fan', 'fanStop', 'chime', 'tick',
  'globe', 'plant', 'whoosh', 'thud'];

const VARIANTS = {
  switch: [{}, { on: true }, { on: false }],
  door: [{}, { open: true }, { open: false }],
  lamp: [{}, { on: true }, { on: false }],
  steam: [{}, { on: true }, { on: false }],
  fan: [{}, { level: 1 }, { level: 2 }, { level: 3 }],
  fanStop: [{}, { level: 1 }, { level: 3 }],
  chime: [{}, { soft: true }, { hour: true }, { soft: true, hour: true }]
};

const BEDS = ['room', 'outside', 'record', 'fan', 'lamp'];

/** Structural fingerprint of one play() call: which nodes, and which params moved. */
function signature(ctx, mark) {
  const kinds = new Map();
  const roles = new Set();
  for (const n of ctx.createdSince(mark)) {
    const k = n.sigKind();
    kinds.set(k, (kinds.get(k) || 0) + 1);
    for (const pname of Object.keys(n.params)) {
      const calls = n.params[pname].calls;
      if (!calls.length) continue;
      roles.add(k + '.' + pname + (calls.some((c) => c.method.includes('Ramp') || c.method === 'setTargetAtTime') ? '~' : ''));
    }
  }
  const ks = [...kinds.entries()].sort().map(([k, c]) => k + 'x' + c).join(',');
  const rs = [...roles].sort().join(',');
  return ks + (rs ? ' | ' + rs : '');
}

function lastTarget(param) {
  const c = param.calls.filter((x) => x.method === 'setTargetAtTime');
  return c.length ? c[c.length - 1].args[0] : null;
}

/* ==================================================================== tests */

console.log('smoke_audio — js/audio.js under a mock Web Audio API');
console.log('source: ' + path.relative(ROOT, SRC));

/* ---------------------------------------------------------- A. init / API */
section('A. init(), lazily, idempotently, on a real gesture');
freshGlobal();
globalThis.AudioContext = MockAudioContext;
const AudioCtor = loadEngine();
const audio = new AudioCtor();
okEq(audio.available, false, 'available is false before init()');
okEq(audio.ctx, null, 'ctx is null before init()');
okEq(audio.init(), true, 'init() returns true');
ok(audio.available === true, 'available true after init()');
ok(audio.ctx instanceof MockAudioContext, 'ctx is the AudioContext');
okEq(audio.init(), true, 'second init() is a no-op that still returns true');
okEq(audio.ctx.resumeCalls, 0, 'no resume() while running');

{
  const ctx = audio.ctx;
  const master = ctx.nodesTagged('master')[0];
  ok(!!master, 'master gain exists');
  okEq(master.gain.value, 0.55, 'master trim is 0.55');
  const destChain = master._outs[0];
  ok(!!destChain && destChain.kind === 'shaper', 'master -> waveshaper');
  ok(!!destChain._outs[0] && destChain._outs[0].kind === 'comp', 'waveshaper -> compressor');
  ok(destChain._outs[0]._outs[0] === ctx.destination, 'compressor -> destination');
  ok(!!destChain.curve && destChain.curve.length > 64, 'waveshaper has a curve');
  for (let i = 0; i < destChain.curve.length; i++) {
    if (!isFinite(destChain.curve[i]) || Math.abs(destChain.curve[i]) > 1) { ok(false, 'waveshaper curve must stay in [-1,1]'); break; }
  }
  ok(ctx._buffers.length >= 2, 'noise buffers were generated, not loaded (' + ctx._buffers.length + ')');
  let allFinite = true;
  for (const b of ctx._buffers) {
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i += 97) if (!isFinite(d[i])) { allFinite = false; break; }
  }
  ok(allFinite, 'noise buffer samples are all finite');
  ok(ctx._buffers[0].length > 1000, 'noise buffer has real length');
}

{
  const ctx = audio.ctx;
  ctx.state = 'suspended';
  okEq(audio.init(), true, 'init() on a suspended context returns true');
  okEq(ctx.resumeCalls, 1, 'init() resumed the suspended context');
  okEq(ctx.state, 'running', 'context is running again');
}

{
  // some browsers hand back a suspended context from the constructor
  MockAudioContext.initialState = 'suspended';
  const Ctor2 = loadEngine();
  const a1 = new Ctor2();
  okEq(a1.init(), true, 'init() succeeds when the context starts suspended');
  okEq(a1.ctx.state, 'running', 'the freshly built context was resumed');
  okEq(a1.ctx.resumeCalls, 1, 'resume() was called exactly once');
  MockAudioContext.initialState = 'running';
}

/* ------------------------------------------------------------- B. one-shots */
section('B. every sound in CONTRACT §8: no throw, real nodes, distinct timbre');

/* play() hides internal errors by design, so the builders are also driven
   directly: anything that throws here is a real engine bug, not a guard. */
{
  const ctx = audio.ctx;
  const builders = NAMES.map((n) => '_s' + n.charAt(0).toUpperCase() + n.slice(1))
    .filter((m) => typeof audio[m] === 'function');
  okEq(builders.length, NAMES.length, 'every name has a builder');
  for (const m of builders) {
    ctx.currentTime += 4;
    let err = null;
    try { audio[m](ctx.currentTime + 0.012, {}); } catch (e) { err = e; }
    ok(!err, m + '() does not throw' + (err ? ' — ' + err.message + '\n        ' + String(err.stack).split('\n').slice(1, 3).join('\n        ') : ''));
  }
  ctx.currentTime += 4;
}
const signatures = new Map();
const sigOfVariant = new Map();
let variantCount = 0;

for (const name of NAMES) {
  const variants = VARIANTS[name] || [{}, { pan: -0.4 }];
  for (let vi = 0; vi < variants.length; vi++) {
    const opts = variants[vi];
    const ctx = audio.ctx;
    ctx.currentTime += 4;                                   // let the last voice die
    const mark = ctx._nodes.length;
    const pmark = ctx._paramCalls.length;
    let threw = null, ret = null;
    try { ret = audio.play(name, opts); } catch (e) { threw = e; }
    variantCount++;
    const label = name + (vi ? ' #' + vi : '');
    ok(!threw, 'play(' + label + ') does not throw' + (threw ? ' — ' + threw.message : ''));
    okEq(ret, true, 'play(' + label + ') reports that it played');
    const created = ctx.createdSince(mark);
    ok(created.length >= 3, 'play(' + label + ') created nodes (' + created.length + ')');
    const sched = ctx._paramCalls.slice(pmark).filter((c) => ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime'].includes(c.method));
    ok(sched.length >= 1, 'play(' + label + ') scheduled an envelope (' + sched.length + ' param events)');
    if (vi === 0) signatures.set(name, signature(ctx, mark));
    sigOfVariant.set(label, signature(ctx, mark));
  }
}
console.log('  played ' + variantCount + ' variants across ' + NAMES.length + ' names');

{
  const seen = new Map();
  let collisions = 0;
  for (const [name, sig] of signatures) {
    if (seen.has(sig)) { collisions++; ok(false, name + ' and ' + seen.get(sig) + ' share a node-graph signature: ' + sig); }
    else seen.set(sig, name);
  }
  okEq(collisions, 0, 'all ' + names(signatures) + ' sounds have a distinct node-graph signature');
}

{
  // opts really change the sound: fan 1/3 must differ in the whir's pitch
  const ctx = audio.ctx;
  const fanPitch = (level) => {
    ctx.currentTime += 4;
    const mark = ctx._nodes.length;
    audio.play('fan', { level });
    let top = 0;
    for (const n of ctx.createdSince(mark)) {
      if (n.kind !== 'osc') continue;
      for (const c of n.frequency.calls) if (typeof c.args[0] === 'number' && c.args[0] > top) top = c.args[0];
      if (n.frequency.value > top) top = n.frequency.value;
    }
    return top;
  };
  const f1 = fanPitch(1), f3 = fanPitch(3);
  ok(f3 > f1, 'fan level 3 whirs higher than level 1 (' + f1.toFixed(0) + ' Hz vs ' + f3.toFixed(0) + ' Hz)');
  const swOn = sigOfVariant.get('switch #1'), swOff = sigOfVariant.get('switch #2');
  ok(swOn === swOff, 'switch on/off keep the same structure (only the pitch moves)');
}

/* ---------------------------------------------------------------- C. beds */
section('C. beds: level 0 silences, retuning does not grow the graph');
for (const bed of BEDS) {
  const node = audio.ctx.nodesTagged('bed:' + bed)[0];
  ok(!!node, 'bed ' + bed + ' exists after init()');
  for (const level of [0, 0.5, 1]) {
    const ret = audio.setBed(bed, level);
    okEq(ret, true, 'setBed(' + bed + ', ' + level + ')');
    okNear(lastTarget(node.gain), level, 1e-9, 'setBed(' + bed + ', ' + level + ') ramps the bed gain to ' + level);
    if (level === 0) okEq(lastTarget(node.gain), 0, 'level 0 is a true silence target for ' + bed);
  }
  okEq(audio.setBed(bed, 0.5, { rate: 2 }), true, 'setBed(' + bed + ', level, opts) with opts');
}
okEq(audio.setBed('nope', 1), false, 'unknown bed name is refused');

{
  const ctx = audio.ctx;
  const before = ctx.liveNodes().length, created = ctx._nodes.length;
  for (let i = 0; i < 500; i++) {
    audio.setBed(BEDS[i % BEDS.length], (i % 11) / 10, { rate: 0.5 + (i % 7) });
  }
  const after = ctx.liveNodes().length;
  ok(after <= before + 2, '500 setBed calls did not grow the node graph (' + before + ' -> ' + after + ' live)');
  okEq(ctx._nodes.length, created, '500 setBed calls created zero nodes');
}

{
  // the fan bed's whir really follows opts.rate
  const osc = audio.ctx.nodesTagged('bed:fan.osc')[0];
  audio.setBed('fan', 0.8, { rate: 0.6 });
  const slow = lastTarget(osc.frequency);
  audio.setBed('fan', 0.8, { rate: 4.0 });
  const fast = lastTarget(osc.frequency);
  ok(fast > slow, 'fan bed whir pitch follows opts.rate (' + slow.toFixed(0) + ' -> ' + fast.toFixed(0) + ' Hz)');

  // the record bed's rumble really follows its level
  const rnode = audio.ctx.nodesTagged('bed:record')[0];
  audio.setBed('record', 0.2);
  const quiet = lastTarget(rnode.gain);
  audio.setBed('record', 1);
  const loud = lastTarget(rnode.gain);
  ok(loud > quiet, 'record bed level is monotonic (' + quiet + ' -> ' + loud + ')');
}

/* ------------------------------------------------- D. the watch tick throttle */
section('D. tick(t): one watch tick per second, not one per frame');
{
  const ctx = audio.ctx;
  const before = ctx.nodesTagged('sfx:tick').length;
  const start = 1000;
  ctx.currentTime = start;
  for (let i = 0; i < 600; i++) {                 // 10 virtual seconds at 60 fps
    const t = start + i / 60;
    ctx.currentTime = t;
    audio.tick(t);
  }
  const fired = ctx.nodesTagged('sfx:tick').length - before;
  okEq(fired, 10, '10 s of 60 fps frames fired exactly 10 watch ticks');
  ok(fired !== 600, 'the tick is throttled, not frame-driven');

  audio.setEnv({ lightsOn: false });
  const beforeDark = ctx.nodesTagged('sfx:tick').length;
  for (let i = 0; i < 600; i++) {
    const t = start + 20 + i / 60;
    ctx.currentTime = t;
    audio.tick(t);
  }
  okEq(ctx.nodesTagged('sfx:tick').length - beforeDark, 0, 'no ticking while the room is off');
  audio.setEnv({ lightsOn: true });

  // NaN / junk input must not break the frame loop
  for (const bad of [NaN, undefined, Infinity, null, 'x', -5]) {
    let threw = null;
    try { audio.tick(bad); } catch (e) { threw = e; }
    ok(!threw, 'tick(' + String(bad) + ') is a safe no-op');
  }
}

/* --------------------------------------------------- E. setEnv day vs night */
section('E. setEnv(): the outside bed really changes between day and night');
{
  const ctx = audio.ctx;
  audio.setBed('outside', 0.8);                    // explicit level, so only the texture changes
  const bp = ctx.nodesTagged('bed:outside.bp')[0];
  const dayG = ctx.nodesTagged('bed:outside.day')[0];
  const nightG = ctx.nodesTagged('bed:outside.night')[0];
  ok(!!bp && !!dayG && !!nightG, 'outside bed exposes its band and its two layers');

  audio.setEnv({ day: true, hour: 13, lightsOn: true, lampOn: false });
  const day = { f: lastTarget(bp.frequency), d: lastTarget(dayG.gain), n: lastTarget(nightG.gain) };
  audio.setEnv({ day: false, hour: 1, lightsOn: false, lampOn: true });
  const night = { f: lastTarget(bp.frequency), d: lastTarget(dayG.gain), n: lastTarget(nightG.gain) };

  ok(day.f !== night.f, 'band centre differs: day ' + day.f + ' Hz vs night ' + night.f + ' Hz');
  ok(night.f < day.f, 'night is darker (lower centre frequency)');
  ok(night.n > day.n, 'the night layer is louder at night (' + day.n + ' -> ' + night.n + ')');
  ok(night.d < day.d, 'the day layer is quieter at night (' + day.d + ' -> ' + night.d + ')');

  // crickets only at night, and only sparsely
  const before = ctx.nodesTagged('sfx:cricket').length;
  for (let i = 0; i < 1800; i++) {                 // 30 virtual seconds
    const t = 2000 + i / 60;
    ctx.currentTime = t;
    audio.tick(t);
  }
  const nightChirps = ctx.nodesTagged('sfx:cricket').length - before;
  ok(nightChirps > 0, 'crickets chirp at night (' + nightChirps + ' in 30 s)');
  ok(nightChirps < 40, 'crickets stay sparse (' + nightChirps + ' in 30 s)');

  audio.setEnv({ day: true, hour: 13 });
  const beforeDay = ctx.nodesTagged('sfx:cricket').length;
  for (let i = 0; i < 1800; i++) {
    const t = 2100 + i / 60;
    ctx.currentTime = t;
    audio.tick(t);
  }
  okEq(ctx.nodesTagged('sfx:cricket').length - beforeDay, 0, 'no crickets during the day');

  // record bed: crackle only while the platter spins
  audio.setBed('record', 0.9);
  const beforePop = ctx.nodesTagged('sfx:crackle').length;
  for (let i = 0; i < 600; i++) { const t = 2200 + i / 60; ctx.currentTime = t; audio.tick(t); }
  const pops = ctx.nodesTagged('sfx:crackle').length - beforePop;
  ok(pops > 0, 'the record bed crackles while spinning (' + pops + ' pops in 10 s)');
  ok(pops < 120, 'crackle stays sparse (' + pops + ' pops in 10 s)');
  audio.setBed('record', 0);
  const beforeSilent = ctx.nodesTagged('sfx:crackle').length;
  for (let i = 0; i < 900; i++) { const t = 2300 + i / 60; ctx.currentTime = t; audio.tick(t); }
  okEq(ctx.nodesTagged('sfx:crackle').length - beforeSilent, 0, 'no crackle with the platter stopped');
}

/* ------------------------------------------------- F. mute, volume, no leak */
section('F. master mute/volume, voice cap, node hygiene');
{
  const ctx = audio.ctx;
  const master = ctx.nodesTagged('master')[0];
  audio.setMasterVolume(0.4);
  okNear(lastTarget(master.gain), 0.55 * 0.4, 1e-9, 'setMasterVolume(0.4) scales the master trim');
  audio.setMuted(true);
  okEq(lastTarget(master.gain), 0, 'mute ramps the master to 0');
  const muteCalls = master.gain.calls.length;
  const last = master.gain.calls[muteCalls - 1];
  ok(last.method === 'setTargetAtTime', 'mute uses a ramp, not a hard cut (' + last.method + ')');
  audio.setMuted(false);
  okNear(lastTarget(master.gain), 0.55 * 0.4, 1e-9, 'unmute restores the volume');
  audio.setMasterVolume(1);
  for (const v of [NaN, undefined, -3, 7, 'x']) { audio.setMasterVolume(v); }
  ok(isFinite(lastTarget(master.gain)), 'junk volumes do not produce NaN');

  // a burst of sounds must respect the voice cap and then settle
  const base = ctx.liveNodes().length;
  for (let i = 0; i < 200; i++) audio.play(NAMES[i % NAMES.length]);
  ok(audio._voices.length <= 28, 'voice cap respected under a burst (' + audio._voices.length + ' <= 28)');
  const peakLive = ctx.liveNodes().length - base;
  ok(peakLive < 1400, 'a burst cannot explode the graph (' + peakLive + ' extra live nodes)');

  let t = 3000;
  for (let i = 0; i < 600; i++) { t += 1 / 60; ctx.currentTime = t; audio.tick(t); }
  okEq(audio._voices.length, 0, 'every voice is torn down once it is over');
  ok(ctx.liveNodes().length - base < 120, 'live nodes return to the bed baseline (' + (ctx.liveNodes().length - base) + ' extra)');

  // the beds themselves must still be connected to the master
  for (const bed of BEDS) {
    const n = ctx.nodesTagged('bed:' + bed)[0];
    ok(n.live && n._outs[0] === master, 'bed ' + bed + ' survived the pruning and still reaches the master');
  }
}

/* ------------------------------------------- G. bounds on every scheduled value */
section('G. no NaN, no runaway gain anywhere in the recorded schedule');
{
  const ctx = audio.ctx;
  let bad = 0, over = 0, underv = 0, checked = 0, worst = 0, worstWhere = '', modGains = 0, audioGains = 0;
  const shout = [];
  for (const node of ctx._nodes) {
    for (const pname of Object.keys(node.params)) {
      const p = node.params[pname];
      if (pname !== 'gain') continue;
      // an LFO depth gain feeds a *parameter*, not the audio path: its value is
      // a modulation amount (e.g. 90 Hz of vibrato), not a level.
      const modulation = node._everParam && !node._everNode;
      if (modulation) modGains++; else audioGains++;
      const hi = modulation ? 100000 : 1.5;
      const lo = modulation ? 0 : -0.0001;
      const note = (v, how) => {
        if (Math.abs(v) > worst) { worst = Math.abs(v); worstWhere = node.sigKind() + (node.__plr ? '(' + node.__plr + ')' : '') + '.gain ' + how; }
        if (!isFinite(v)) bad++;
        if (v > hi || v < lo) { if (shout.length < 6) shout.push(node.sigKind() + (node.__plr ? '(' + node.__plr + ')' : '') + '.gain ' + how + ' = ' + v); over += (v > hi) ? 1 : 0; underv += (v < lo) ? 1 : 0; }
      };
      for (const c of p.calls) {
        // only the VALUE argument is a level; the second argument is a time
        if (!(c.method === 'value' || c.method === 'setValueAtTime' || c.method === 'linearRampToValueAtTime' ||
          c.method === 'exponentialRampToValueAtTime' || c.method === 'setTargetAtTime')) continue;
        const a = c.args[0];
        if (typeof a !== 'number') continue;
        checked++;
        note(a, c.method + '(' + c.args.join(',') + ')');
      }
      if (p.events.length) {
        const t0 = p.events[0].time, t1 = p.events[p.events.length - 1].time + 0.5;
        for (let i = 0; i <= 240; i++) {
          const v = p.valueAt(t0 + (t1 - t0) * (i / 240));
          checked++;
          note(v, 'valueAt');
        }
      }
    }
  }
  okEq(bad, 0, 'every scheduled/latent value is finite (' + checked + ' values checked)');
  okEq(over, 0, 'no audio-path gain envelope ever exceeds 1.5 (loudest scheduled gain ' + worst.toFixed(3) + ' at ' + worstWhere + ')');
  okEq(underv, 0, 'no gain goes negative');
  ok(audioGains > 60, 'the strict bound covered ' + audioGains + ' audio-path gain params (' + modGains + ' modulation depths excluded)');
  if (shout.length) console.log('  offenders:\n    ' + shout.join('\n    '));

  let badFreq = 0, expoNonPositive = 0, nanArgs = 0, all = 0, freqWhere = '';
  for (const c of ctx._paramCalls) {
    all++;
    for (const a of c.args) if (typeof a === 'number' && !isFinite(a)) nanArgs++;
    if (c.method === 'exponentialRampToValueAtTime' && !(c.args[0] > 0)) expoNonPositive++;
  }
  okEq(nanArgs, 0, 'no non-finite argument in ' + all + ' AudioParam calls');
  okEq(expoNonPositive, 0, 'no exponential ramp targets 0 or less');
  okEq(ctx._throws.length, 0, 'the mock never had to throw' + (ctx._throws.length ? ' — ' + JSON.stringify(ctx._throws[0]) : ''));
  okEq(ctx._warns.length, 0, 'the mock never had to warn' + (ctx._warns.length ? ' — ' + JSON.stringify(ctx._warns[0]) : ''));
  for (const node of ctx._nodes) {
    const p = node.params.frequency;
    if (!p) continue;
    for (const c of p.calls) {
      if (!(c.method === 'value' || c.method === 'setValueAtTime' || c.method === 'linearRampToValueAtTime' ||
        c.method === 'exponentialRampToValueAtTime' || c.method === 'setTargetAtTime')) continue;
      if (typeof c.args[0] !== 'number') continue;          // e.g. an LFO connecting into the param
      if (!(c.args[0] > 0) || c.args[0] > ctx.sampleRate / 2) { badFreq++; freqWhere = node.sigKind() + '.' + c.method + '=' + c.args[0]; }
    }
    for (const e of p.events) if (!(e.value > 0) || e.value > ctx.sampleRate / 2) { badFreq++; freqWhere = node.sigKind() + '.event=' + e.value; }
  }
  okEq(badFreq, 0, 'every filter/oscillator frequency is inside (0, Nyquist) ' + freqWhere);
}

/* ------------------------------------------- H. total silence when muted + beds off */
section('H. everything runs for a long time without growing');
{
  const ctx = audio.ctx;
  for (const bed of BEDS) audio.setBed(bed, 0);
  const base = ctx.liveNodes().length, nbase = ctx._nodes.length;
  let t = 5000;
  for (let i = 0; i < 3600; i++) {                  // one virtual minute at 60 fps
    t += 1 / 60;
    ctx.currentTime = t;
    audio.tick(t);
    if (i % 30 === 0) audio.play(NAMES[(i / 30) % NAMES.length]);
  }
  ok(audio._voices.length <= 28, 'still capped after a minute of play (' + audio._voices.length + ')');
  ok(ctx.liveNodes().length - base < 200, 'live node count stays bounded over a minute (' + (ctx.liveNodes().length - base) + ' extra)');
  ok(ctx._throws.length === 0, 'no mock throw over a minute of play');
}

/* ------------------------------------------------- I. hostile context: play() still never throws */
section('I. a misbehaving AudioContext cannot take the app down');
{
  const ctx = audio.ctx;
  const saved = ctx.createBiquadFilter;
  ctx.createBiquadFilter = function () { throw new Error('device lost'); };
  let threw = null, ret = null;
  try { ret = audio.play('click'); } catch (e) { threw = e; }
  ok(!threw, 'play() swallows a node-creation failure');
  okEq(ret, false, 'play() reports failure instead of throwing');
  ctx.createBiquadFilter = saved;
  okEq(audio.play('click'), true, 'and it recovers afterwards');
}

/* --------------------------------------------- J. graceful degradation (no AudioContext) */
section('J. degradation: no AudioContext at all');
{
  freshGlobal();
  delete globalThis.AudioContext;
  const Ctor = loadEngine();
  const dead = new Ctor();
  okEq(dead.available, false, 'available is false');
  okEq(dead.ctx, null, 'ctx is null');
  okEq(dead.init(), false, 'init() returns false instead of throwing');
  okEq(dead.available, false, 'still unavailable after init()');
  okEq(dead.init(), false, 'init() stays safe when repeated');

  let threw = null;
  try {
    for (const n of NAMES) { dead.play(n); dead.play(n, { on: true, open: false, level: 2, soft: true, hour: true, rate: 3 }); }
    for (const bed of BEDS) for (const lv of [0, 0.5, 1]) dead.setBed(bed, lv, { rate: 2 });
    dead.setBed('room', 1);
    dead.setMuted(true); dead.setMuted(false);
    dead.setMasterVolume(0.5); dead.setMasterVolume(1);
    dead.setEnv({ day: false, hour: 2, lightsOn: true, lampOn: true });
    dead.setEnv(null);
    for (let i = 0; i < 600; i++) dead.tick(i / 60);
    dead.tick(NaN);
  } catch (e) { threw = e; }
  ok(!threw, 'every method is a safe no-op without an AudioContext' + (threw ? ' — ' + threw.message : ''));
  okEq(dead.available, false, 'available is still false');
  okEq(dead.ctx, null, 'ctx is still null');
  okEq(dead.tick(1), undefined, 'tick() returns nothing');
}

/* --------------------------------------------- K. degradation: constructor throws */
section('K. degradation: AudioContext exists but refuses to build');
{
  freshGlobal();
  globalThis.AudioContext = function () { throw new Error('blocked by policy'); };
  const Ctor = loadEngine();
  const dead = new Ctor();
  let threw = null;
  try { dead.init(); } catch (e) { threw = e; }
  ok(!threw, 'init() survives a throwing constructor');
  okEq(dead.available, false, 'available is false');
  okEq(dead.ctx, null, 'ctx is null');
  try { dead.play('chime', { hour: true }); dead.setBed('room', 1); dead.tick(1); dead.setEnv({ day: false }); } catch (e) { threw = e; }
  ok(!threw, 'the rest of the API is a no-op too');
}

/* --------------------------------------------- L. deferred setBed before init */
section('L. setBed() before init() is remembered, not lost');
{
  freshGlobal();
  globalThis.AudioContext = MockAudioContext;
  const Ctor = loadEngine();
  const a2 = new Ctor();
  okEq(a2.setBed('room', 0.7), false, 'setBed before init reports false');
  a2.init();
  const node = a2.ctx.nodesTagged('bed:room')[0];
  okNear(lastTarget(node.gain), 0.7, 1e-9, 'the remembered level is applied at init');
}

/* --------------------------------------------- M. beds follow the room alone */
section('M. with no setBed() at all, the beds still follow the environment');
{
  freshGlobal();
  globalThis.AudioContext = MockAudioContext;
  const Ctor = loadEngine();
  const a3 = new Ctor();
  a3.init();
  const bedGain = (name) => lastTarget(a3.ctx.nodesTagged('bed:' + name)[0].gain);
  const dayRoom = bedGain('room'), dayOut = bedGain('outside'), dayLamp = bedGain('lamp');
  ok(dayOut > 0, 'the world outside the window is audible as soon as audio unlocks (' + dayOut + ')');
  ok(dayRoom > 0, 'the room has a quiet hum while the light is on (' + dayRoom + ')');
  okEq(dayLamp, 0, 'the lamp hum is silent while the lamp is off');

  a3.setEnv({ day: false, hour: 23, lightsOn: false, lampOn: true });
  const nightRoom = bedGain('room'), nightLamp = bedGain('lamp');
  ok(nightRoom < dayRoom, 'the room bed drops when the light goes off (' + dayRoom + ' -> ' + nightRoom + ')');
  ok(nightLamp > 0, 'the lamp hum comes up when the lamp is on (' + nightLamp + ')');

  a3.setBed('room', 0);                       // an explicit level wins from now on
  a3.setEnv({ lightsOn: true });
  okEq(bedGain('room'), 0, 'an explicit setBed(0) is not overridden by setEnv');

  // and the whole thing still settles: nothing accumulates in a long idle run
  const base = a3.ctx.liveNodes().length;
  let t = 0;
  for (let i = 0; i < 1800; i++) { t += 1 / 60; a3.ctx.currentTime = t; a3.tick(t); }
  ok(a3.ctx.liveNodes().length - base < 200, '30 s of idle night ambience stays bounded (' + (a3.ctx.liveNodes().length - base) + ' extra nodes)');
  okEq(a3.ctx._throws.length, 0, 'no mock throw during ambience');
}

/* ------------------------------------------------------------------ report */
section('N. node-graph signatures (proof that the sounds differ)');
{
  const rows = [...signatures.entries()].sort();
  const w = Math.max(...rows.map(([n]) => n.length));
  for (const [name, sig] of rows) console.log('  ' + name.padEnd(w) + '  ' + sig);
  console.log('\n  distinct signatures: ' + new Set(rows.map(([, s]) => s)).size + ' / ' + rows.length);
}
{
  // switch on/off differ in more than structure: their body pitch differs
  console.log('\n  variants (structure | automated params):');
  for (const [label, sig] of [...sigOfVariant.entries()].filter(([l]) => l.includes('#'))) {
    console.log('  ' + label.padEnd(16) + '  ' + sig);
  }
}

function names(m) { return m.size; }

console.log('\n' + '='.repeat(66));
console.log(failures === 0
  ? 'PASS — ' + checks + ' checks, 0 failures'
  : 'FAIL — ' + checks + ' checks, ' + failures + ' FAILURES');
console.log('='.repeat(66));
process.exit(failures === 0 ? 0 : 1);
