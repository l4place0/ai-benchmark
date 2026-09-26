import { getTimelineState, LYRICS_TIMELINE } from './timeline.js';
import { Engine3D } from './engine3d.js';
import * as Visuals from './visuals.js';

const WIDTH = 1920;
const HEIGHT = 1080;

const canvas = document.getElementById('renderCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const engine3d = new Engine3D(WIDTH, HEIGHT);

const audio = document.getElementById('bgmAudio');
const btnPlay = document.getElementById('btnPlay');
const timeSlider = document.getElementById('timeSlider');
const timeLabel = document.getElementById('timeLabel');
const btnFullscreen = document.getElementById('btnFullscreen');
const sceneSelector = document.getElementById('sceneSelector');

let isPlaying = false;
let isHeadless = false;

/**
 * MASTER PURE FUNCTION: renderFrame(t, frameIndex)
 * Frame = f(t). Completely deterministic. Zero mutable accumulated state.
 */
export function renderFrame(t, frameIndex = Math.floor(t * 60)) {
  const state = getTimelineState(t);
  const beat = state.beatImpulse;

  // 1. BSOD Scene handles its own full-screen canvas
  if (state.sceneName === 'bsod') {
    Visuals.drawBSODScene(ctx, t, beat, WIDTH, HEIGHT);
    return;
  }

  // 2. Clear Screen to Deep Obsidian Cyberpunk Canvas
  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 3. Render Starry Sky Matrix & Distant Monoliths (only if not epilogue)
  if (state.sceneName !== 'epilogue') {
    Visuals.drawSkyMatrix(ctx, t, beat, WIDTH, HEIGHT);
    // 4. Render 3D Perspective Ground Grid
    engine3d.renderGridFloor(ctx, t, 220, 1500);
  }

  // 5. Render Active Thematic Scene
  switch (state.sceneName) {
    case 'power_line':
      Visuals.drawPowerLineScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'protection':
      Visuals.drawProtectionScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'pieces':
      Visuals.drawPiecesScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'creation':
    case 'setup_world':
    case 'simulation_start':
      Visuals.drawObjectCreationScene(ctx, t, beat, engine3d, WIDTH, HEIGHT);
      break;
    case 'initialization':
      Visuals.drawInitializationScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'warp_matrix':
      Visuals.drawMatrixWarpScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'dimension':
      Visuals.drawDimensionScene(ctx, t, beat, engine3d, WIDTH, HEIGHT);
      break;
    case 'circumference':
      Visuals.drawCircumferenceScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'tangents':
      Visuals.drawSineAndTangentsScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'limitations':
      Visuals.drawLimitationsScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'ac_dc':
      Visuals.drawACToDCScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'dizzy':
      Visuals.drawDizzyScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'time_travel':
    case 'unite':
      Visuals.drawUniteScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'stimulations':
    case 'satisfaction':
    case 'execution_rush':
      Visuals.drawExecutionRushScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'execute_climax':
      Visuals.drawExecuteClimaxScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'dna_bio':
      Visuals.drawDNAHelixScene(ctx, t, beat, engine3d, WIDTH, HEIGHT);
      break;
    case 'purr_wave':
      Visuals.drawPurrWaveScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'god_existence':
      Visuals.drawGodExistenceScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'gender_switch':
      Visuals.drawGenderSwitchScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'am_pm':
      Visuals.drawAMPMScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'trance_vortex':
      Visuals.drawTranceVortexScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'vibrations':
      Visuals.drawCircumferenceScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'completion':
      Visuals.drawObjectCreationScene(ctx, t, beat, engine3d, WIDTH, HEIGHT);
      break;
    case 'isolation':
    case 'fragments':
    case 'disheartened':
    case 'illegal_arguments':
      Visuals.drawLimitationsScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'execution_spam':
      Visuals.drawExecutionSpamScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'multilingual_count':
      Visuals.drawMultilingualCountScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'love_algebra':
    case 'love_cardioid':
      Visuals.drawLoveCardioidScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'trapped_love':
    case 'while_true_love':
      Visuals.drawWhileTrueLoveScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    case 'epilogue':
      Visuals.drawEpilogueScene(ctx, t, beat, WIDTH, HEIGHT);
      break;
    default:
      Visuals.drawObjectCreationScene(ctx, t, beat, engine3d, WIDTH, HEIGHT);
      break;
  }

  // 6. Render Dynamic Central Lyrics & Kinetic Typography
  if (state.sceneName !== 'epilogue') {
    Visuals.drawLyrics(ctx, t, state, WIDTH, HEIGHT);
    // 7. Render HUD, Telemetry, and CRT Scanlines
    Visuals.drawHUD(ctx, t, state, WIDTH, HEIGHT);
  }
}

// Check if launched in headless render mode via URL param ?render=1
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('render') === '1') {
  isHeadless = true;
  document.body.classList.add('headless-mode');
  initHeadlessBridge();
} else {
  initInteractivePlayer();
}

/**
 * Headless Rendering Bridge via WebSocket
 */
function initHeadlessBridge() {
  const wsUrl = `ws://${window.location.host}/ws-render`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'ready' }));
  };

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === 'render') {
        const t = data.t;
        const frame = data.frame;

        // Render frame with pure function
        renderFrame(t, frame);

        // Convert canvas frame to JPEG blob (quality 0.90 for ultra fast encoding)
        canvas.toBlob((blob) => {
          blob.arrayBuffer().then((buf) => {
            ws.send(buf);
          });
        }, 'image/jpeg', 0.90);
      }
    } catch (err) {
      console.error('Render error:', err);
    }
  };
}

/**
 * Interactive Web Player Setup
 */
function initInteractivePlayer() {
  LYRICS_TIMELINE.forEach((lyric) => {
    const opt = document.createElement('option');
    opt.value = lyric.start;
    opt.textContent = `[${lyric.start.toFixed(1)}s] ${lyric.emphasis || lyric.text.slice(0, 24)}`;
    sceneSelector.appendChild(opt);
  });

  sceneSelector.addEventListener('change', (e) => {
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    renderFrame(time);
    updateUI(time);
  });

  btnPlay.addEventListener('click', togglePlay);

  timeSlider.addEventListener('input', (e) => {
    const duration = audio.duration || 216.0;
    const time = (parseFloat(e.target.value) / 100) * duration;
    audio.currentTime = time;
    renderFrame(time);
    updateUI(time);
  });

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  function togglePlay() {
    if (isPlaying) {
      audio.pause();
      isPlaying = false;
      btnPlay.innerHTML = `<span>▶ PLAY</span>`;
    } else {
      audio.play().then(() => {
        isPlaying = true;
        btnPlay.innerHTML = `<span>⏸ PAUSE</span>`;
        requestAnimationFrame(renderLoop);
      }).catch(err => {
        console.warn('Audio play restricted:', err);
        isPlaying = true;
        btnPlay.innerHTML = `<span>⏸ PAUSE</span>`;
        requestAnimationFrame(renderLoop);
      });
    }
  }

  function renderLoop() {
    if (!isPlaying) return;
    const t = audio.currentTime;
    renderFrame(t);
    updateUI(t);

    if (t >= (audio.duration || 216.0)) {
      isPlaying = false;
      btnPlay.innerHTML = `<span>▶ PLAY</span>`;
      return;
    }
    requestAnimationFrame(renderLoop);
  }

  function updateUI(t) {
    const duration = audio.duration || 216.0;
    timeSlider.value = (t / duration) * 100;
    const mins = Math.floor(t / 60);
    const secs = (t % 60).toFixed(1).padStart(4, '0');
    const totMins = Math.floor(duration / 60);
    const totSecs = (duration % 60).toFixed(1).padStart(4, '0');
    timeLabel.textContent = `${mins}:${secs} / ${totMins}:${totSecs}`;
  }

  renderFrame(0);
  updateUI(0);
}
