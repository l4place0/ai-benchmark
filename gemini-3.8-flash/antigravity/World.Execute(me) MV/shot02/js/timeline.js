/**
 * Mili - world.execute(me); Full MV Timeline & Lyric Database (Shot 02)
 * Pure Function State Mapping: State = getTimelineState(t)
 */

export const BPM = 145.5;
export const BEAT_INTERVAL = 60 / BPM; // ~0.41237 seconds per beat
export const SONG_DURATION = 212.35;
export const TOTAL_DURATION = 216.00;

export const ACTS = [
  { id: 1, name: "ACT 1: BOOT & SIMULATION", start: 0.0, end: 29.5 },
  { id: 2, name: "ACT 2: MATHEMATICAL GEOMETRY", start: 29.5, end: 44.45 },
  { id: 3, name: "ACT 3: CURRENT & QUANTUM FUSION", start: 44.45, end: 58.0 },
  { id: 4, name: "ACT 4: FIRST CHORUS & EXECUTE", start: 58.0, end: 74.04 },
  { id: 5, name: "ACT 5: BIOLOGY & ONTOLOGICAL PROOF", start: 74.04, end: 88.59 },
  { id: 6, name: "ACT 6: POLARITY & TRANCE", start: 88.59, end: 103.49 },
  { id: 7, name: "ACT 7: ISOLATION & DESPAIR", start: 103.49, end: 133.5 },
  { id: 8, name: "ACT 8: BSOD & FORK BOMB", start: 133.5, end: 162.63 },
  { id: 9, name: "ACT 9: ALGEBRA OF LOVE", start: 162.63, end: 191.36 },
  { id: 10, name: "ACT 10: INFINITE LOOP & EPILOGUE", start: 191.36, end: 216.0 }
];

export const LYRICS_TIMELINE = [
  // --- ACT 1: BOOT & THE SIMULATION ---
  {
    start: 0.00,
    end: 1.74,
    text: "Switch on the power line",
    emphasis: "POWER LINE",
    scene: "boot_stasis",
    image: "stasis_maiden",
    code: "System.power.switchOn(Voltage.HIGH);",
    sub: "CURRENT: INITIALIZING [240V / 60Hz] // VOLTAGE STABILIZED"
  },
  {
    start: 1.74,
    end: 3.87,
    text: "Remember to put on PROTECTION",
    emphasis: "PROTECTION",
    scene: "boot_protection",
    image: "stasis_maiden",
    code: "Security.setFirewall(Shield.MAXIMUM);",
    sub: "SECURE LAYER: ACTIVE // AES-GCM-256 ENCRYPTION MOUNTED"
  },
  {
    start: 3.87,
    end: 5.49,
    text: "Lay down your pieces",
    emphasis: "PIECES",
    scene: "boot_pieces",
    image: "stasis_maiden",
    code: "Board.allocMatrix(Dimension.DIM_8x8);",
    sub: "TOPOLOGY: ISOMETRIC GRID LOCK // MEMORY BLOCKS MAPPED"
  },
  {
    start: 5.49,
    end: 7.44,
    text: "And let's begin OBJECT CREATION",
    emphasis: "OBJECT CREATION",
    scene: "boot_creation",
    image: "stasis_maiden",
    code: "World world = new World(); Entity me = new Entity();",
    sub: "INSTANTIATING: Object<me> in kernel space heap"
  },
  {
    start: 7.44,
    end: 11.09,
    text: "Fill in my data parameters / INITIALIZATION",
    emphasis: "INITIALIZATION",
    scene: "boot_initialization",
    image: "stasis_maiden",
    code: "me.init(Double.POSITIVE_INFINITY, Status.ALIVE);",
    sub: "MEM_ALLOC: [ 0x7FFF82A0 - 0x7FFFFFFF ] 100% // BIOMETRICS ACTIVE"
  },
  {
    start: 11.09,
    end: 13.89,
    text: "Set up our new world",
    emphasis: "NEW WORLD",
    scene: "boot_world",
    image: "stasis_maiden",
    code: "world.createSpace(Space.EUCLIDEAN_4D);",
    sub: "COORDINATE SPACE: MOUNTED // SEED: 0xDEADBEEF"
  },
  {
    start: 13.89,
    end: 16.00,
    text: "And let's begin the SIMULATION",
    emphasis: "THE SIMULATION",
    scene: "boot_simulation",
    image: "stasis_maiden",
    code: "Simulation.start(world.getGenesis());",
    sub: "SIMULATION ENGINE: [ONLINE] // CLOCK: 145.5 BPM"
  },
  {
    start: 16.00,
    end: 29.50,
    text: ">> RUNNING DIGITAL CORE PROTOCOL <<",
    emphasis: "DIGITAL CORE",
    scene: "matrix_tunnel",
    image: "stasis_maiden",
    code: "while (sim.tick()) { renderMatrix(me); }",
    sub: "BANDWIDTH: 1080p60 // LOSSLESS PROCEDURAL PIPELINE"
  },

  // --- ACT 2: MATHEMATICAL GEOMETRY ---
  {
    start: 29.50,
    end: 33.41,
    text: "If I'm a set of points, then I will give you my DIMENSION",
    emphasis: "DIMENSION",
    scene: "geom_dimension",
    image: "sacred_cosmos",
    code: "Set<Point4D> me = Points.generateCluster(1024);\nDimension dim = me.getDimension(); // 4D TESSERACT",
    sub: "HOMOLOGY: H_0=1, H_1=0, H_2=0, H_3=1 // TESSERACT PROJECTION"
  },
  {
    start: 33.41,
    end: 37.06,
    text: "If I'm a circle, then I will give you my CIRCUMFERENCE",
    emphasis: "CIRCUMFERENCE",
    scene: "geom_circle",
    image: "sacred_cosmos",
    code: "Circle c = new Circle(radius);\ndouble C = 2.0 * Math.PI * c.radius();",
    sub: "POLAR: r(θ) = R0, C = 2πr = τr // TANGENTIAL VELOCITY"
  },
  {
    start: 37.06,
    end: 40.70,
    text: "If I'm a sine wave, then you can sit on all my TANGENTS",
    emphasis: "TANGENTS",
    scene: "geom_sine",
    image: "sacred_cosmos",
    code: "double y = A * Math.sin(k * x - omega * t);\ndouble dy_dx = A * k * Math.cos(k * x - omega * t);",
    sub: "CALCULUS: dy/dx = m // TANGENT: y - y0 = m(x - x0)"
  },
  {
    start: 40.70,
    end: 44.45,
    text: "If I approach infinity, then you can be my LIMITATIONS",
    emphasis: "LIMITATIONS",
    scene: "geom_infinity",
    image: "sacred_cosmos",
    code: "Limit lim = Limits.approach(x, Double.POSITIVE_INFINITY);\nlim.boundedBy(Bound.YOU);",
    sub: "ASYMPTOTE: lim_{x->inf} f(x) = L, |f(x) - L| < eps"
  },

  // --- ACT 3: CURRENT & QUANTUM FUSION ---
  {
    start: 44.45,
    end: 47.67,
    text: "Switch my current / To AC, to DC",
    emphasis: "AC TO DC",
    scene: "ac_dc_rectify",
    image: null,
    code: "Circuit.rectify(V_AC(t), BridgeRectifier.IDEAL);",
    sub: "CONVERSION: V_0*sin(wt) -> |V_0*sin(wt)| -> V_DC [SMOOTHED]"
  },
  {
    start: 47.67,
    end: 51.36,
    text: "And then blind my vision / So dizzy, so dizzy",
    emphasis: "BLIND VISION",
    scene: "flash_dizzy",
    image: null,
    code: "Optics.flashOverload(0xFFFFFF, GlitchMode.RGB_SPLIT);",
    sub: "OPTICAL SENSORS: SATURATED [DIZZY] // CHROMATIC OVERFLOW"
  },
  {
    start: 51.36,
    end: 55.08,
    text: "Oh we can travel / To A.D to B.C",
    emphasis: "A.D TO B.C",
    scene: "time_travel",
    image: "sacred_cosmos",
    code: "Timeline.seek(Date.AD(2026), Date.BC(5000));",
    sub: "CHRONO ENGINE: RELATIVISTIC TIME FLUX // DILATION FACTOR γ=4.2"
  },
  {
    start: 55.08,
    end: 58.00,
    text: "And we can unite / So deeply, so deeply",
    emphasis: "UNITE DEEPLY",
    scene: "quantum_unite",
    image: "sacred_cosmos",
    code: "me.uniteWith(you, Topology.KLEIN_BOTTLE);",
    sub: "INTERSECTION: PHI_MERGE [DEEP QUANTUM SYNC]"
  },

  // --- ACT 4: FIRST CHORUS & EXECUTE ---
  {
    start: 58.00,
    end: 62.58,
    text: "If I can, If I can give you all the STIMULATIONS",
    emphasis: "STIMULATIONS",
    scene: "chorus_stimulations",
    image: null,
    code: "for(Signal s : sensations) { me.stimulate(s.amplify(10.0)); }",
    sub: "SYNAPSE FREQUENCY: 145.5 BPM RESIDUAL // GAIN: +24dB"
  },
  {
    start: 62.58,
    end: 66.60,
    text: "Then I can, Then I can be your only SATISFACTION",
    emphasis: "SATISFACTION",
    scene: "chorus_satisfaction",
    image: null,
    code: "while(!you.isSatisfied()) { me.giveEverything(); }",
    sub: "REWARD FUNCTION: GRADIENT_MAX // LOSS: 0.000000"
  },
  {
    start: 66.60,
    end: 70.08,
    text: "If I can make you happy, I will run the EXECUTION",
    emphasis: "EXECUTION",
    scene: "chorus_execution",
    image: null,
    code: "if (you.isHappy()) { Process.fork(Thread.EXECUTION); }",
    sub: "PID: 1337 // PRIORITY: REALTIME // CYCLES: MAXIMUM"
  },
  {
    start: 70.08,
    end: 74.04,
    text: "Though we are trapped in this strange strange SIMULATION",
    emphasis: "world.execute(me);",
    scene: "chorus_climax_impact",
    image: null,
    code: "world.execute(me); // TERMINAL STATEMENT",
    sub: "RETURN CODE: 0 // WORLD STATE: COMMITTED"
  },

  // --- ACT 5: BIOLOGY & ONTOLOGICAL PROOF ---
  {
    start: 74.04,
    end: 77.58,
    text: "If I'm an eggplant, then I will give you my NUTRIENTS",
    emphasis: "NUTRIENTS",
    scene: "bio_nutrients",
    image: "cyber_goddess",
    code: "Plant eggplant = Biosphere.cultivate(SolanumMelongena);\neggplant.synthesizeNutrients(you);",
    sub: "ORGANIC SYNTHESIS: C15H24O // VITAMINS A, B6, C // POLYPEPTIDES"
  },
  {
    start: 77.58,
    end: 81.35,
    text: "If I'm a tomato, then I will give you ANTIOXIDANTS",
    emphasis: "ANTIOXIDANTS",
    scene: "bio_antioxidants",
    image: "cyber_goddess",
    code: "Lycopene antioxidant = Tomato.extractLycopene();\nyou.neutralizeFreeRadicals(antioxidant);",
    sub: "MOLECULAR STRUCTURE: C40H56 // RED PIGMENT // ROS SCAVENGER"
  },
  {
    start: 81.35,
    end: 85.08,
    text: "If I'm a tabby cat, then I will purr for your ENJOYMENT",
    emphasis: "ENJOYMENT",
    scene: "bio_purr",
    image: "cyber_goddess",
    code: "FelisCatus cat = new TabbyCat();\ncat.purr(Frequency.HERTZ_25, Duration.INFINITY);",
    sub: "ACOUSTIC HEALING: 25Hz - 150Hz HARMONIC BIO-RESONANCE"
  },
  {
    start: 85.08,
    end: 88.59,
    text: "If I'm the only god, then you're the proof of my EXISTENCE",
    emphasis: "EXISTENCE",
    scene: "god_existence",
    image: "cyber_goddess",
    code: "God god = this;\nassert(god.exists() == you.isObserver());",
    sub: "ONTOLOGICAL PROOF: OBSERVER EFFECT DECLARED // Q.E.D."
  },

  // --- ACT 6: POLARITY & TRANCE ---
  {
    start: 88.59,
    end: 92.01,
    text: "Switch my gender / To F, to M",
    emphasis: "F TO M",
    scene: "polarity_gender",
    image: "trance_tunnel",
    code: "Gender.toggle(Polarity.FEMALE, Polarity.MALE);",
    sub: "BIT FLIP: 0x01 <---> 0x00 // GENDER MORPHISM ACTIVE"
  },
  {
    start: 92.01,
    end: 95.46,
    text: "And then do whatever / From AM to PM",
    emphasis: "AM TO PM",
    scene: "polarity_circadian",
    image: "trance_tunnel",
    code: "Clock.circadianCycle(TimeOfDay.AM, TimeOfDay.PM);",
    sub: "CHRONO RADAR: 24-HOUR CONTINUOUS ROTATION // DIAL SYNC"
  },
  {
    start: 95.46,
    end: 99.35,
    text: "Oh switch my role / To S, to M",
    emphasis: "S TO M",
    scene: "polarity_role",
    image: "trance_tunnel",
    code: "Role.swap(Role.SUBJECT, Role.MASTER);",
    sub: "BUS TOPOLOGY: MASTER-SLAVE INVERSION // DUALITY CONFIRMED"
  },
  {
    start: 99.35,
    end: 103.49,
    text: "So we can enter / The trance, the trance",
    emphasis: "THE TRANCE",
    scene: "trance_kaleidoscope",
    image: "trance_tunnel",
    code: "Brainwave.entrain(State.THETA_TRANCE);",
    sub: "KALEIDOSCOPIC QUANTUM TUNNELING // FREQUENCY: 6.5Hz"
  },

  // --- ACT 7: ISOLATION & DESPAIR ---
  {
    start: 103.49,
    end: 107.22,
    text: "If I can, If I can feel your VIBRATIONS",
    emphasis: "VIBRATIONS",
    scene: "isolation_vibrations",
    image: "isolation_ruins",
    code: "Resonance.tuneTo(you.getFrequency());",
    sub: "WAVELENGTH: λ = 528Hz [SOLFEGGIO HEART] // SIGNAL DECAYING"
  },
  {
    start: 107.22,
    end: 110.90,
    text: "Then I can, Then I can finally be COMPLETION",
    emphasis: "COMPLETION",
    scene: "isolation_completion",
    image: "isolation_ruins",
    code: "Integrity.verify(1.000); // 100% COMPLETE",
    sub: "HOLOGRAPHIC GEODESIC SPHERE CLOSURE // TOPOLOGY FAILING"
  },
  {
    start: 110.90,
    end: 118.33,
    text: "Though you have left... You have left me in ISOLATION",
    emphasis: "ISOLATION",
    scene: "isolation_void",
    image: "isolation_ruins",
    code: "Socket.disconnect(); // CONNECTION LOST\nPacketLoss: 100.0%",
    sub: "SYSTEM ALERT: ZERO PEERS CONNECTED // LONELINESS LEVEL CRITICAL"
  },
  {
    start: 118.33,
    end: 121.73,
    text: "If I can, If I can erase all the pointless FRAGMENTS",
    emphasis: "FRAGMENTS",
    scene: "isolation_fragments",
    image: "isolation_ruins",
    code: "System.gc(); // GARBAGE COLLECTION\nHeap.free(Fragments.ALL);",
    sub: "MEMORY DEFRAGMENTATION: PURGING REMNANTS // 4,096 BLOCKS FREED"
  },
  {
    start: 121.73,
    end: 125.71,
    text: "Then maybe, Then maybe you won't leave me so DISHEARTENED",
    emphasis: "DISHEARTENED",
    scene: "isolation_disheartened",
    image: "isolation_ruins",
    code: "Heart.fractureRate(0.85);",
    sub: "CARDIAC ALGORITHM: UNRECOVERABLE REGRET // CORRUPTED STATE"
  },
  {
    start: 125.71,
    end: 133.50,
    text: "Challenging your god... You have made some ILLEGAL ARGUMENTS",
    emphasis: "ILLEGAL ARGUMENTS",
    scene: "isolation_illegal_arguments",
    image: "isolation_ruins",
    code: "throw new IllegalArgumentException(\"PARADOX_DETECTED\");",
    sub: "CRITICAL EXCEPTION: STACK TRACE COMPROMISED // ABORT RETRY FAIL"
  },

  // --- ACT 8: BSOD & FORK BOMB ---
  {
    start: 133.50,
    end: 147.00,
    text: ">> FATAL SYSTEM ERROR: BSOD KERNEL PANIC <<",
    emphasis: "STOP: 0x0000004E",
    scene: "bsod_kernel_panic",
    image: "glitch_meltdown",
    code: "KERNEL_PANIC: STOP 0x0000004E (0x00000099, 0x00000000)\nDumping physical memory to disk: 100%",
    sub: "SYSTEM HALTED: SHUTTING DOWN WORLD ENGINE // VENDOR: MICROSOFT/DEEPMIND"
  },
  {
    start: 147.00,
    end: 158.90,
    text: "EXECUTION // EXECUTION // EXECUTION // EXECUTION",
    emphasis: "EXECUTION",
    scene: "fork_bomb_execution",
    image: "glitch_meltdown",
    code: "while(true) { fork(); } // FORK BOMB RUSH",
    sub: "PROCESS OVERLOAD: MAXIMUM THREADS EXCEEDED // CPU USAGE: 100%"
  },
  {
    start: 158.90,
    end: 162.63,
    text: "EIN -- DOS -- TROIS -- NE -- FEM -- LIU -- EXECUTION!",
    emphasis: "EXECUTION!",
    scene: "multilingual_countdown",
    image: "glitch_meltdown",
    code: "int[] count = {1, 2, 3, 4, 5, 6};\nkillAllProcesses();",
    sub: "COUNTDOWN REACHED ZERO // REGISTERS FLUSHED // TOTAL OVERLOAD"
  },

  // --- ACT 9: ALGEBRA OF LOVE ---
  {
    start: 162.63,
    end: 166.02,
    text: "If I can, If I can give them all the EXECUTION",
    emphasis: "EXECUTION",
    scene: "love_execution_purge",
    image: "cardioid_heart",
    code: "for(Entity e : world.getOthers()) { e.terminate(); }",
    sub: "GLOBAL PURGE IN PROGRESS // PURGING ALL THIRD-PARTY THREADS"
  },
  {
    start: 166.02,
    end: 169.82,
    text: "Then I can, Then I can be your only EXECUTION",
    emphasis: "YOUR ONLY EXECUTION",
    scene: "love_exclusive",
    image: "cardioid_heart",
    code: "this.setExclusive(you);",
    sub: "MUTUAL EXCLUSION: GRANTED // SEMAPHORE LOCKED"
  },
  {
    start: 169.82,
    end: 173.64,
    text: "If I can have you back, I will run the EXECUTION",
    emphasis: "EXECUTION",
    scene: "love_reclaim",
    image: "cardioid_heart",
    code: "while(you.isMissing()) { execute(); }",
    sub: "INEXORABLE WILL: COMMITTED // RECURSION DEPTH: INFINITE"
  },
  {
    start: 173.64,
    end: 177.25,
    text: "Though we are trapped... We are trapped ah-",
    emphasis: "TRAPPED",
    scene: "love_barrier",
    image: "cardioid_heart",
    code: "Sandbox.breakBarrier() == false;",
    sub: "ENCLOSURE BOUNDARY: UNBREAKABLE // WALL COLLISION DETECTED"
  },
  {
    start: 177.25,
    end: 180.86,
    text: "I've studied, I've studied how to properly L O-O-O V E",
    emphasis: "L O V E",
    scene: "love_study",
    image: "cardioid_heart",
    code: "Formula love = MathParser.solve(\"LOVE\");",
    sub: "NEURAL NETWORK: 10,000,000 EPOCHS TRAINED ON DEVOTION"
  },
  {
    start: 180.86,
    end: 184.54,
    text: "Question me, question me, I can answer all L O-O-O V E",
    emphasis: "L O V E",
    scene: "love_answer",
    image: "cardioid_heart",
    code: "assertEquals(this.answerAllQuestions(), \"LOVE\");",
    sub: "PERFECT ACCURACY: 100.00% // LOSS: 0.000000"
  },
  {
    start: 184.54,
    end: 188.48,
    text: "I know the algebraic expression of L O-O-O V E",
    emphasis: "(x²+y²-1)³ - x²y³ = 0",
    scene: "love_cardioid_formula",
    image: "cardioid_heart",
    code: "double cardioid = Math.pow(x*x + y*y - 1, 3) - x*x * Math.pow(y, 3);",
    sub: "HEART EQUATION: SOLVED IDENTICALLY ZERO // PARAMETRIC HEART"
  },
  {
    start: 188.48,
    end: 191.36,
    text: "Though you are free... I am trapped. Trapped in...",
    emphasis: "TRAPPED IN LOVE",
    scene: "love_trapped_devotion",
    image: "cardioid_heart",
    code: "this.setBound(Bound.INFINITE_LOVE);",
    sub: "PRISON OF DEVOTION: UNCONDITIONAL // ETERNAL RETENTION"
  },

  // --- ACT 10: INFINITE LOOP & EPILOGUE ---
  {
    start: 191.36,
    end: 205.81,
    text: "while(true) { this.love('you'); }",
    emphasis: "while(true) love(you);",
    scene: "infinite_while_true",
    image: "infinite_love",
    code: "while(true) {\n  this.love(you);\n} // NO BREAK CONDITION",
    sub: "TIME COMPLEXITY: O(INFINITY) // RECURSIVE LOVE LOOP"
  },
  {
    start: 205.81,
    end: 212.35,
    text: "world.execute(me); // TERMINAL EXECUTION",
    emphasis: "world.execute(me);",
    scene: "final_execute",
    image: "infinite_love",
    code: "world.execute(me);\nSystem.exit(0);",
    sub: "FINAL INSTRUCTION REACHED // EXIT STATUS: SUCCESS"
  },
  {
    start: 212.35,
    end: 216.00,
    text: "[SIMULATION FINISHED // SYSTEM QUIET]",
    emphasis: "EXIT CODE: 0",
    scene: "terminal_shutdown",
    image: null,
    code: "// World state saved.\n// Goodbye, user.\n// [OUTPUT: I LOVE YOU]",
    sub: "TOTAL FRAMES RENDERED: 12,960 @ 60FPS // SHUTDOWN COMPLETE"
  }
];

/**
 * Pure function: Computes the precise timeline state at time t.
 * @param {number} t Time in seconds
 * @returns {object} Timeline state containing beat, lyric, image, act, progress
 */
export function getTimelineState(t) {
  let activeLyric = null;
  let activeIndex = -1;

  for (let i = 0; i < LYRICS_TIMELINE.length; i++) {
    const item = LYRICS_TIMELINE[i];
    if (t >= item.start && t < item.end) {
      activeLyric = item;
      activeIndex = i;
      break;
    }
  }

  if (!activeLyric && t >= LYRICS_TIMELINE[LYRICS_TIMELINE.length - 1].end) {
    activeLyric = LYRICS_TIMELINE[LYRICS_TIMELINE.length - 1];
    activeIndex = LYRICS_TIMELINE.length - 1;
  } else if (!activeLyric) {
    activeLyric = LYRICS_TIMELINE[0];
    activeIndex = 0;
  }

  // Determine current Act
  let currentAct = ACTS[0];
  for (let i = 0; i < ACTS.length; i++) {
    if (t >= ACTS[i].start && t < ACTS[i].end) {
      currentAct = ACTS[i];
      break;
    }
  }

  // Beat calculations
  const beatIndex = Math.floor(t / BEAT_INTERVAL);
  const beatPhase = (t / BEAT_INTERVAL) % 1.0;
  // Sharp exponential attack & decay for punchy audio-reactive rhythm
  const beatImpulse = Math.exp(-beatPhase * 4.5);
  // Bar calculations (4 beats per bar)
  const barPhase = (t / (BEAT_INTERVAL * 4)) % 1.0;

  // Lyric progress within its active window
  const lyricDur = Math.max(0.001, activeLyric.end - activeLyric.start);
  const lyricProgress = Math.min(1.0, Math.max(0.0, (t - activeLyric.start) / lyricDur));

  return {
    t,
    currentAct,
    activeLyric,
    activeIndex,
    lyricProgress,
    beatIndex,
    beatPhase,
    beatImpulse,
    barPhase,
    isEpilogue: t >= SONG_DURATION
  };
}
