import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetVideo = path.resolve(rootDir, 'target_video.mp4');
const remakeVideo = path.resolve(rootDir, 'output/world_execute_me_remake.mp4');
const compDir = path.resolve(rootDir, 'output/comparisons');

if (!fs.existsSync(compDir)) {
  fs.mkdirSync(compDir, { recursive: true });
}

// 25 critical audit timestamps covering all 17 cards
const CHECKPOINTS = [
  { id: 'c00_intro', t: 5.0, card: 'Card 0 (Intro Protection)' },
  { id: 'c00_sheet', t: 14.5, card: 'Card 0 (Macro Sheet Pullback)' },
  { id: 'c01_verse1', t: 20.0, card: 'Card 1 (GodDrinksJava Title)' },
  { id: 'c01_bounce', t: 26.5, card: 'Card 1 (Gravity & House Arcs)' },
  { id: 'c02_q1_q2', t: 34.0, card: 'Card 2 (Circle & Tangents)' },
  { id: 'c02_q3_q4', t: 40.5, card: 'Card 2 (Sequence / Limits)' },
  { id: 'c03_osc', t: 45.5, card: 'Card 3 (AC/DC Oscilloscope)' },
  { id: 'c03_vision', t: 49.5, card: 'Card 3 (Vision Reticle Fig 4.2)' },
  { id: 'c03_carts', t: 56.5, card: 'Card 3 (3691 BC United Houses)' },
  { id: 'c04_bars', t: 60.5, card: 'Card 4 (Chorus 1 Stimulations Bar)' },
  { id: 'c04_mesh', t: 65.0, card: 'Card 4 (Satisfaction & Formula)' },
  { id: 'c05_assays', t: 75.5, card: 'Card 5 (Eggplant & Tomato Assays)' },
  { id: 'c05_cat', t: 82.5, card: 'Card 5 (Tabby Cat 25Hz & Theorem)' },
  { id: 'c06_gender', t: 90.0, card: 'Card 6 (Split Flap & 24h Clock)' },
  { id: 'c06_moire', t: 99.5, card: 'Card 6 (Moire Loupe & SM Houses)' },
  { id: 'c07_rings', t: 105.0, card: 'Card 7 (Chorus 2 Vibrations Rings)' },
  { id: 'c07_isolate', t: 114.0, card: 'Card 7 (House Erasure & Isolation)' },
  { id: 'c08_memory', t: 124.0, card: 'Card 8 (Memory Map & You Are Here)' },
  { id: 'c09_copies', t: 138.0, card: 'Card 9 (Replication 40 Houses)' },
  { id: 'c10_stamps', t: 149.0, card: 'Card 10 (EXECUTION 12 Stamps)' },
  { id: 'c11_chalk', t: 157.0, card: 'Card 11 (Multilingual Countdown)' },
  { id: 'c12_panel1', t: 164.5, card: 'Card 12 (House Scan Matrix)' },
  { id: 'c12_panel2', t: 169.5, card: 'Card 12 (Bouncing Arc to White House)' },
  { id: 'c12_panel3', t: 175.0, card: 'Card 12 (UNREACHABLE & Trapped)' },
  { id: 'c13_chap1', t: 180.0, card: 'Card 13 (Academic Chapter 1)' },
  { id: 'c14_exam', t: 182.5, card: 'Card 14 (Examination Paper Score 100)' },
  { id: 'c15_algebra', t: 188.0, card: 'Card 15 (Algebraic Expression LO-O-OVE)' },
  { id: 'c16_type', t: 202.0, card: 'Card 16 (Full Sheet Outro Typewriter)' }
];

console.log(`Generating ${CHECKPOINTS.length} side-by-side comparison frames (Left: Target, Right: Remake)...`);

for (const cp of CHECKPOINTS) {
  const outFile = path.resolve(compDir, `${cp.id}_t${Math.round(cp.t * 10)}.jpg`);
  
  // Complex filter to stack Target (Left) and Remake (Right) with label headers
  const filter = `[0:v]scale=960:540,drawtext=text='TARGET (BV1H3af6QECk)':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.7:x=20:y=20[v0];[1:v]scale=960:540,drawtext=text='REMAKE (Opus 5.5)':fontcolor=yellow:fontsize=24:box=1:boxcolor=black@0.7:x=20:y=20[v1];[v0][v1]hstack=inputs=2[out]`;
  
  const args = [
    '-ss', cp.t.toString(),
    '-i', targetVideo,
    '-ss', cp.t.toString(),
    '-i', remakeVideo,
    '-filter_complex', filter,
    '-map', '[out]',
    '-vframes', '1',
    '-q:v', '2',
    '-y',
    outFile
  ];

  const res = spawnSync('ffmpeg', args, { stdio: 'pipe' });
  if (res.status === 0) {
    console.log(`✅ [${cp.id}] at ${cp.t}s (${cp.card}) -> ${path.basename(outFile)}`);
  } else {
    // If drawtext font is missing, fallback to simple hstack without drawtext
    const simpleFilter = `[0:v]scale=960:540[v0];[1:v]scale=960:540[v1];[v0][v1]hstack=inputs=2[out]`;
    const simpleArgs = [
      '-ss', cp.t.toString(),
      '-i', targetVideo,
      '-ss', cp.t.toString(),
      '-i', remakeVideo,
      '-filter_complex', simpleFilter,
      '-map', '[out]',
      '-vframes', '1',
      '-q:v', '2',
      '-y',
      outFile
    ];
    const simpleRes = spawnSync('ffmpeg', simpleArgs, { stdio: 'pipe' });
    if (simpleRes.status === 0) {
      console.log(`✅ [${cp.id}] at ${cp.t}s (simple hstack) -> ${path.basename(outFile)}`);
    } else {
      console.error(`❌ Failed [${cp.id}]:`, res.stderr.toString());
    }
  }
}

console.log('All comparisons generated in output/comparisons/');
