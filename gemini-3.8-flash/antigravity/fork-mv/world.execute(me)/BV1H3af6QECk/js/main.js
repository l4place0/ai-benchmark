/**
 * Main Controller for Mili - world.execute(me);
 * Dual-Mode Engine:
 * Mode A: Interactive High-Precision Audio/Visual Player
 * Mode B: Headless Lock-Step WebSocket Frame Dispatcher for Video Encoding
 */

import { renderFrame } from './renderer.js';
import { SONG_DURATION, LYRICS } from './timeline.js';

const canvas = document.getElementById('mvCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const audio = document.getElementById('mvAudio');

// Check URL query parameters
const urlParams = new URLSearchParams(window.location.search);
const isRenderMode = urlParams.get('render') === '1';

// Internal canvas dimensions: 1920x1080 Full HD
canvas.width = 1920;
canvas.height = 1080;

if (isRenderMode) {
  initRenderMode();
} else {
  initInteractiveMode();
}

/**
 * MODE B: Headless Lock-Step Frame Dispatcher
 */
function initRenderMode() {
  document.body.classList.add('rendering');
  const wsUrl = `ws://${window.location.host}/ws-render`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[RenderBridge] Connected to local encoder server');
    ws.send(JSON.stringify({ type: 'ready' }));
  };

  ws.onmessage = async (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === 'render') {
        const { t, frame } = data;
        
        // Render exact frame for time t
        renderFrame(ctx, t, canvas.width, canvas.height);

        // Convert canvas to JPEG blob and send as binary
        canvas.toBlob((blob) => {
          if (blob) {
            blob.arrayBuffer().then((buf) => {
              if (data.withIndex) {
                const out = new Uint8Array(4 + buf.byteLength);
                const view = new DataView(out.buffer);
                view.setUint32(0, frame, true);
                out.set(new Uint8Array(buf), 4);
                ws.send(out);
              } else {
                ws.send(buf);
              }
            });
          }
        }, 'image/jpeg', 0.95);
      }
    } catch (err) {
      console.error('[RenderBridge] Error processing frame:', err);
    }
  };

  ws.onerror = (err) => {
    console.error('[RenderBridge] WebSocket error:', err);
  };
}

/**
 * MODE A: Interactive High-Precision Player
 */
function initInteractiveMode() {
  const playBtn = document.getElementById('playBtn');
  const timeSlider = document.getElementById('timeSlider');
  const timeDisplay = document.getElementById('timeDisplay');
  const sceneSelect = document.getElementById('sceneSelect');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  // Populate scene selector
  LYRICS.forEach((lyric, idx) => {
    const opt = document.createElement('option');
    opt.value = lyric.start;
    opt.textContent = `[${formatTime(lyric.start)}] Card ${lyric.card}: ${lyric.sub}`;
    sceneSelect.appendChild(opt);
  });

  let isPlaying = false;
  let animId = null;

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }

  function update() {
    const currentTime = audio.currentTime;
    renderFrame(ctx, currentTime, canvas.width, canvas.height);

    if (!timeSlider.matches(':active')) {
      timeSlider.value = (currentTime / SONG_DURATION) * 1000;
    }
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(SONG_DURATION)}`;

    if (isPlaying) {
      animId = requestAnimationFrame(update);
    }
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        isPlaying = true;
        playBtn.textContent = '⏸ Pause';
        update();
      }).catch(err => console.log('Audio play error:', err));
    } else {
      audio.pause();
      isPlaying = false;
      playBtn.textContent = '▶ Play';
      cancelAnimationFrame(animId);
    }
  });

  timeSlider.addEventListener('input', () => {
    const targetTime = (timeSlider.value / 1000) * SONG_DURATION;
    audio.currentTime = targetTime;
    renderFrame(ctx, targetTime, canvas.width, canvas.height);
    timeDisplay.textContent = `${formatTime(targetTime)} / ${formatTime(SONG_DURATION)}`;
  });

  sceneSelect.addEventListener('change', () => {
    const targetTime = parseFloat(sceneSelect.value);
    audio.currentTime = targetTime;
    renderFrame(ctx, targetTime, canvas.width, canvas.height);
    if (!isPlaying) {
      timeSlider.value = (targetTime / SONG_DURATION) * 1000;
      timeDisplay.textContent = `${formatTime(targetTime)} / ${formatTime(SONG_DURATION)}`;
    }
  });

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  });

  // Initial draw
  renderFrame(ctx, 0.0, canvas.width, canvas.height);
}
