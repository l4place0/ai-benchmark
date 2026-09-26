/**
 * Complete Timeline and Lyric Event Database for Mili - world.execute(me);
 * Full song duration: 212.35s + epilogue = 216.0s.
 */

export const BPM = 145.5;
export const BEAT_INTERVAL = 60 / BPM; // ~0.412s per beat

export const LYRICS_TIMELINE = [
  // --- ACT 1: BOOT & THE SIMULATION ---
  {
    start: 0.10,
    end: 1.74,
    text: "Switch on the power line",
    emphasis: "POWER LINE",
    scene: "power_line",
    code: "System.power.switchOn(Voltage.HIGH);",
    sub: "CURRENT: INITIALIZING [240V / 60Hz]"
  },
  {
    start: 1.74,
    end: 3.87,
    text: "Remember to put on PROTECTION",
    emphasis: "PROTECTION",
    scene: "protection",
    code: "Security.setFirewall(Shield.MAXIMUM);",
    sub: "SECURE LAYER: ACTIVE // AES-GCM-256"
  },
  {
    start: 3.87,
    end: 5.49,
    text: "Lay down your pieces",
    emphasis: "PIECES",
    scene: "pieces",
    code: "Board.allocMatrix(Dimension.DIM_8x8);",
    sub: "TOPOLOGY: ISOMETRIC GRID LOCK"
  },
  {
    start: 5.49,
    end: 7.44,
    text: "And let's begin OBJECT CREATION",
    emphasis: "OBJECT CREATION",
    scene: "creation",
    code: "World world = new World(); Entity me = new Entity();",
    sub: "INSTANTIATING: Object<me> in memory"
  },
  {
    start: 7.44,
    end: 11.09,
    text: "Fill in my data parameters / INITIALIZATION",
    emphasis: "INITIALIZATION",
    scene: "initialization",
    code: "me.init(Double.POSITIVE_INFINITY, Status.ALIVE);",
    sub: "MEM_ALLOC: [ 0x7FFF82A0 - 0x7FFFFFFF ] 100%"
  },
  {
    start: 11.09,
    end: 13.89,
    text: "Set up our new world",
    emphasis: "NEW WORLD",
    scene: "setup_world",
    code: "world.createSpace(Space.EUCLIDEAN_4D);",
    sub: "COORDINATE SPACE: MOUNTED"
  },
  {
    start: 13.89,
    end: 16.00,
    text: "And let's begin the SIMULATION",
    emphasis: "THE SIMULATION",
    scene: "simulation_start",
    code: "Simulation.start(world.getGenesis());",
    sub: "SIMULATION ENGINE: [ONLINE]"
  },
  {
    start: 16.00,
    end: 29.50,
    text: ">> RUNNING DIGITAL CORE PROTOCOL <<",
    emphasis: "CORE PROTOCOL",
    scene: "warp_matrix",
    code: "while (sim.tick()) { renderMatrix(me); }",
    sub: "BANDWIDTH: 1080p60 // LOSSLESS PIPELINE"
  },

  // --- ACT 2: MATHEMATICAL GEOMETRY ---
  {
    start: 29.50,
    end: 33.41,
    text: "If I'm a set of points, then I will give you my DIMENSION",
    emphasis: "DIMENSION",
    scene: "dimension",
    code: "Set<Point4D> me = Points.generateCluster(1024);\nDimension dim = me.getDimension(); // 4D TESSERACT",
    sub: "HOMOLOGY: H_0=1, H_1=0, H_2=0, H_3=1"
  },
  {
    start: 33.41,
    end: 37.06,
    text: "If I'm a circle, then I will give you my CIRCUMFERENCE",
    emphasis: "CIRCUMFERENCE",
    scene: "circumference",
    code: "Circle c = new Circle(radius);\ndouble C = 2.0 * Math.PI * c.radius();",
    sub: "POLAR: r(θ) = R0, C = 2πr = τr"
  },
  {
    start: 37.06,
    end: 40.70,
    text: "If I'm a sine wave, then you can sit on all my TANGENTS",
    emphasis: "TANGENTS",
    scene: "tangents",
    code: "double y = A * Math.sin(k * x - omega * t);\ndouble dy_dx = A * k * Math.cos(k * x - omega * t);",
    sub: "CALCULUS: dy/dx = m, TANGENT: y - y0 = m(x - x0)"
  },
  {
    start: 40.70,
    end: 44.45,
    text: "If I approach infinity, then you can be my LIMITATIONS",
    emphasis: "LIMITATIONS",
    scene: "limitations",
    code: "Limit lim = Limits.approach(x, Double.POSITIVE_INFINITY);\nlim.boundedBy(Bound.YOU);",
    sub: "ASYMPTOTE: lim_{x->inf} f(x) = L, |f(x) - L| < eps"
  },
  {
    start: 44.45,
    end: 47.67,
    text: "Switch my current / To AC, to DC",
    emphasis: "AC TO DC",
    scene: "ac_dc",
    code: "Circuit.rectify(V_AC(t), BridgeRectifier.IDEAL);",
    sub: "CONVERSION: V_0*sin(wt) -> |V_0*sin(wt)| -> V_DC"
  },
  {
    start: 47.67,
    end: 51.36,
    text: "And then blind my vision / So dizzy, so dizzy",
    emphasis: "BLIND VISION",
    scene: "dizzy",
    code: "Optics.flashOverload(0xFFFFFF, GlitchMode.RGB_SPLIT);",
    sub: "OPTICAL SENSORS: SATURATED [DIZZY]"
  },
  {
    start: 51.36,
    end: 55.08,
    text: "Oh we can travel / To A.D to B.C",
    emphasis: "A.D TO B.C",
    scene: "time_travel",
    code: "Timeline.seek(Date.AD(2026), Date.BC(5000));",
    sub: "CHRONO ENGINE: RELATIVISTIC TIME FLUX"
  },
  {
    start: 55.08,
    end: 58.00,
    text: "And we can unite / So deeply, so deeply",
    emphasis: "UNITE DEEPLY",
    scene: "unite",
    code: "me.uniteWith(you, Topology.KLEIN_BOTTLE);",
    sub: "INTERSECTION: PHI_MERGE [DEEP QUANTUM SYNC]"
  },

  // --- ACT 3: FIRST CHORUS ---
  {
    start: 58.00,
    end: 62.58,
    text: "If I can, If I can give you all the STIMULATIONS",
    emphasis: "STIMULATIONS",
    scene: "stimulations",
    code: "for(Signal s : sensations) { me.stimulate(s.amplify(10.0)); }",
    sub: "SYNAPSE FREQUENCY: 145.5 BPM RESIDUAL"
  },
  {
    start: 62.58,
    end: 66.60,
    text: "Then I can, Then I can be your only SATISFACTION",
    emphasis: "SATISFACTION",
    scene: "satisfaction",
    code: "while(!you.isSatisfied()) { me.giveEverything(); }",
    sub: "REWARD FUNCTION: GRADIENT_MAX"
  },
  {
    start: 66.60,
    end: 70.08,
    text: "If I can make you happy, I will run the EXECUTION",
    emphasis: "EXECUTION",
    scene: "execution_rush",
    code: "if (you.isHappy()) { Process.fork(Thread.EXECUTION); }",
    sub: "PID: 1337 // PRIORITY: REALTIME"
  },
  {
    start: 70.08,
    end: 74.04,
    text: "Though we are trapped in this strange strange SIMULATION",
    emphasis: "SIMULATION",
    scene: "execute_climax",
    code: "world.execute(me); // TERMINAL STATEMENT",
    sub: "RETURN CODE: 0 // WORLD STATE: COMMITTED"
  },

  // --- ACT 4: BIOLOGY & ORGANIC TRANSMUTATION ---
  {
    start: 74.04,
    end: 77.58,
    text: "If I'm an eggplant, then I will give you my NUTRIENTS",
    emphasis: "NUTRIENTS",
    scene: "dna_bio",
    code: "Plant eggplant = Biosphere.cultivate(SolanumMelongena);\neggplant.synthesizeNutrients(you);",
    sub: "ORGANIC SYNTHESIS: C15H24O // VITAMINS A, B6, C"
  },
  {
    start: 77.58,
    end: 81.35,
    text: "If I'm a tomato, then I will give you ANTIOXIDANTS",
    emphasis: "ANTIOXIDANTS",
    scene: "dna_bio",
    code: "Lycopene antioxidant = Tomato.extractLycopene();\nyou.neutralizeFreeRadicals(antioxidant);",
    sub: "MOLECULAR STRUCTURE: C40H56 // RED PIGMENT"
  },
  {
    start: 81.35,
    end: 85.08,
    text: "If I'm a tabby cat, then I will purr for your ENJOYMENT",
    emphasis: "ENJOYMENT",
    scene: "purr_wave",
    code: "FelisCatus cat = new TabbyCat();\ncat.purr(Frequency.HERTZ_25, Duration.INFINITY);",
    sub: "ACOUSTIC HEALING: 25Hz - 150Hz HARMONIC VIBRATION"
  },
  {
    start: 85.08,
    end: 88.59,
    text: "If I'm the only god, then you're the proof of my EXISTENCE",
    emphasis: "EXISTENCE",
    scene: "god_existence",
    code: "God god = this;\nassert(god.exists() == you.isObserver());",
    sub: "ONTOLOGICAL PROOF: OBSERVER EFFECT DECLARED"
  },

  // --- ACT 5: POLARITY & TRANCE ---
  {
    start: 88.59,
    end: 92.01,
    text: "Switch my gender / To F, to M",
    emphasis: "F TO M",
    scene: "gender_switch",
    code: "Gender.toggle(Polarity.FEMALE, Polarity.MALE);",
    sub: "BIT FLIP: 0x01 <---> 0x00 // GENDER MORPH"
  },
  {
    start: 92.01,
    end: 95.46,
    text: "And then do whatever / From AM to PM",
    emphasis: "AM TO PM",
    scene: "am_pm",
    code: "Clock.circadianCycle(TimeOfDay.AM, TimeOfDay.PM);",
    sub: "CHRONO RADAR: 24-HOUR CONTINUOUS ROTATION"
  },
  {
    start: 95.46,
    end: 99.35,
    text: "Oh switch my role / To S, to M",
    emphasis: "S TO M",
    scene: "gender_switch",
    code: "Role.swap(Role.SUBJECT, Role.MASTER);",
    sub: "BUS TOPOLOGY: MASTER-SLAVE INVERSION"
  },
  {
    start: 99.35,
    end: 103.49,
    text: "So we can enter / The trance, the trance",
    emphasis: "THE TRANCE",
    scene: "trance_vortex",
    code: "Brainwave.entrain(State.THETA_TRANCE);",
    sub: "KALEIDOSCOPIC QUANTUM TUNNELING"
  },

  // --- ACT 6: ISOLATION & DESPAIR ---
  {
    start: 103.49,
    end: 107.22,
    text: "If I can, If I can feel your VIBRATIONS",
    emphasis: "VIBRATIONS",
    scene: "vibrations",
    code: "Resonance.tuneTo(you.getFrequency());",
    sub: "WAVELENGTH: λ = 528Hz [HEART TONE]"
  },
  {
    start: 107.22,
    end: 110.90,
    text: "Then I can, Then I can finally be COMPLETION",
    emphasis: "COMPLETION",
    scene: "completion",
    code: "Integrity.verify(1.000); // 100% COMPLETE",
    sub: "HOLOGRAPHIC GEODESIC SPHERE CLOSURE"
  },
  {
    start: 110.90,
    end: 118.33,
    text: "Though you have left... You have left me in ISOLATION",
    emphasis: "ISOLATION",
    scene: "isolation",
    code: "Socket.disconnect(); // CONNECTION LOST\nPacketLoss: 100.0%",
    sub: "SYSTEM ALERT: ZERO PEERS CONNECTED"
  },
  {
    start: 118.33,
    end: 121.73,
    text: "If I can, If I can erase all the pointless FRAGMENTS",
    emphasis: "FRAGMENTS",
    scene: "fragments",
    code: "System.gc(); // GARBAGE COLLECTION\nHeap.free(Fragments.ALL);",
    sub: "MEMORY DEFRAGMENTATION: PURGING REMNANTS"
  },
  {
    start: 121.73,
    end: 125.71,
    text: "Then maybe, Then maybe you won't leave me so DISHEARTENED",
    emphasis: "DISHEARTENED",
    scene: "disheartened",
    code: "Heart.fractureRate(0.85);",
    sub: "CARDIAC ALGORITHM: UNRECOVERABLE REGRET"
  },
  {
    start: 125.71,
    end: 133.50,
    text: "Challenging your god... You have made some ILLEGAL ARGUMENTS",
    emphasis: "ILLEGAL ARGUMENTS",
    scene: "illegal_arguments",
    code: "throw new IllegalArgumentException(\"PARADOX_DETECTED\");",
    sub: "CRITICAL EXCEPTION: STACK TRACE COMPROMISED"
  },

  // --- ACT 7: BSOD KERNEL PANIC & FORK BOMB ---
  {
    start: 133.50,
    end: 147.00,
    text: ">> FATAL SYSTEM ERROR: BSOD KERNEL PANIC <<",
    emphasis: "STOP: 0x0000004E",
    scene: "bsod",
    code: "KERNEL_PANIC: STOP 0x0000004E (0x00000099, 0x00000000)\nDumping physical memory...",
    sub: "SYSTEM HALTED: SHUTTING DOWN WORLD ENGINE"
  },
  {
    start: 147.00,
    end: 158.90,
    text: "EXECUTION // EXECUTION // EXECUTION // EXECUTION",
    emphasis: "EXECUTION",
    scene: "execution_spam",
    code: "while(true) { fork(); } // FORK BOMB ACTIVE",
    sub: "PROCESS OVERLOAD: MAXIMUM THREADS EXCEEDED"
  },
  {
    start: 158.90,
    end: 162.63,
    text: "EIN -- DOS -- TROIS -- NE -- FEM -- LIU -- EXECUTION!",
    emphasis: "EXECUTION!",
    scene: "multilingual_count",
    code: "int[] count = {1, 2, 3, 4, 5, 6};\nkillAllProcesses();",
    sub: "COUNTDOWN REACHED ZERO // FLUSHING ALL REGISTERS"
  },

  // --- ACT 8: THE FINAL CONVICTION ---
  {
    start: 162.63,
    end: 166.02,
    text: "If I can, If I can give them all the EXECUTION",
    emphasis: "EXECUTION",
    scene: "execution_rush",
    code: "for(Entity e : world.getOthers()) { e.terminate(); }",
    sub: "GLOBAL PURGE IN PROGRESS"
  },
  {
    start: 166.02,
    end: 169.82,
    text: "Then I can, Then I can be your only EXECUTION",
    emphasis: "YOUR ONLY EXECUTION",
    scene: "execution_rush",
    code: "this.setExclusive(you);",
    sub: "MUTUAL EXCLUSION: GRANTED"
  },
  {
    start: 169.82,
    end: 173.64,
    text: "If I can have you back, I will run the EXECUTION",
    emphasis: "EXECUTION",
    scene: "execution_rush",
    code: "while(you.isMissing()) { execute(); }",
    sub: "INEXORABLE WILL: COMMITTED"
  },
  {
    start: 173.64,
    end: 177.25,
    text: "Though we are trapped... We are trapped ah-",
    emphasis: "TRAPPED",
    scene: "isolation",
    code: "Sandbox.breakBarrier() == false;",
    sub: "ENCLOSURE BOUNDARY: UNBREAKABLE"
  },

  // --- ACT 9: ALGEBRAIC EXPRESSION OF LOVE ---
  {
    start: 177.25,
    end: 180.86,
    text: "I've studied, I've studied how to properly L O-O-O V E",
    emphasis: "L O V E",
    scene: "love_algebra",
    code: "Formula love = MathParser.solve(\"LOVE\");",
    sub: "NEURAL NETWORK: 10,000,000 EPOCHS TRAINED ON LOVE"
  },
  {
    start: 180.86,
    end: 184.54,
    text: "Question me, question me, I can answer all L O-O-O V E",
    emphasis: "L O V E",
    scene: "love_algebra",
    code: "assertEquals(this.answerAllQuestions(), \"LOVE\");",
    sub: "PERFECT ACCURACY: 100.00%"
  },
  {
    start: 184.54,
    end: 188.48,
    text: "I know the algebraic expression of L O-O-O V E",
    emphasis: "(x²+y²-1)³ - x²y³ = 0",
    scene: "love_cardioid",
    code: "double cardioid = Math.pow(x*x + y*y - 1, 3) - x*x * Math.pow(y, 3);",
    sub: "HEART EQUATION: SOLVED IDENTICALLY ZERO"
  },
  {
    start: 188.48,
    end: 191.36,
    text: "Though you are free... I am trapped. Trapped in...",
    emphasis: "TRAPPED IN LOVE",
    scene: "trapped_love",
    code: "this.setBound(Bound.INFINITE_LOVE);",
    sub: "PRISON OF DEVOTION: UNCONDITIONAL"
  },

  // --- ACT 10: INFINITE LOOP & EPILOGUE ---
  {
    start: 191.36,
    end: 205.81,
    text: "while(true) { this.love('you'); }",
    emphasis: "while(true) love(you);",
    scene: "while_true_love",
    code: "while(true) {\n  this.love(you);\n} // NO BREAK CONDITION",
    sub: "TIME COMPLEXITY: O(INFINITY) // RECURSIVE LOVE"
  },
  {
    start: 205.81,
    end: 212.35,
    text: "world.execute(me); // TERMINAL EXECUTION",
    emphasis: "world.execute(me);",
    scene: "execute_climax",
    code: "world.execute(me);\nSystem.exit(0);",
    sub: "PROCESS EXIT CODE: 0 [SUCCESS]"
  },
  {
    start: 212.35,
    end: 216.00,
    text: "[SIMULATION FINISHED // SYSTEM QUIET]",
    emphasis: "EXIT CODE: 0",
    scene: "epilogue",
    code: "// World state saved.\n// Goodbye, world.",
    sub: "TOTAL FRAMES RENDERED: 12,960 @ 60FPS"
  }
];

/**
 * Pure function: get active lyric and scene metadata for time t.
 * @param {number} t Time in seconds
 */
export function getTimelineState(t) {
  let activeLyric = null;
  for (let i = 0; i < LYRICS_TIMELINE.length; i++) {
    const item = LYRICS_TIMELINE[i];
    if (t >= item.start && t < item.end) {
      activeLyric = item;
      break;
    }
  }

  // Fallback to last item if beyond
  if (!activeLyric && t >= LYRICS_TIMELINE[LYRICS_TIMELINE.length - 1].end) {
    activeLyric = LYRICS_TIMELINE[LYRICS_TIMELINE.length - 1];
  }

  const beatPhase = (t / BEAT_INTERVAL) % 1.0;
  const beatImpulse = Math.exp(-beatPhase * 4.5);

  return {
    t,
    beatPhase,
    beatImpulse,
    activeLyric,
    sceneName: activeLyric ? activeLyric.scene : 'idle'
  };
}
