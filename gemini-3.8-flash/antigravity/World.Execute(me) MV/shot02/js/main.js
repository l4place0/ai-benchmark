/**
 * Main Controller for Mili - world.execute(me); Full MV (Shot 02)
 * Supports Interactive Player Mode and Headless Lockstep Video Renderer Mode.
 */

import { getTimelineState, TOTAL_DURATION, ACTS, LYRICS_TIMELINE } from './timeline.js';
import { renderFrame } from './visuals.js';

const IMAGE_PATHS = {
  stasis_maiden: './assets/images/stasis_maiden.jpg',
  sacred_cosmos: './assets/images/sacred_cosmos.jpg',
  cyber_goddess: './assets/images/cyber_goddess.jpg',
  trance_tunnel: './assets/images/trance_tunnel.jpg',
  isolation_ruins: './assets/images/isolation_ruins.jpg',
  glitch_meltdown: './assets/images/glitch_meltdown.jpg',
  cardioid_heart: './assets/images/cardioid_heart.jpg',
  infinite_love: './assets/images/infinite_love.jpg'
};

const assets = {
  images: {}
};

/**
 * Preload all images and resolve promise when all loaded
 */
function preloadAssets() {
  const promises = [];
  for (const [key, src] of Object.entries(IMAGE_PATHS)) {
    promises.push(new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        assets.images[key] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Could not load image ${src}, fallback will be used.`);
        resolve();
      };
      img.src = src;
    }));
  }
  return Promise.all(promises);
}

window.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('mv-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const audio = document.getElementById('audio-player');

  // Set internal resolution to 1080p
  canvas.width = 1920;
  canvas.height = 1080;

  console.log('🔄 Preloading assets...');
  await preloadAssets();
  console.log('✅ Assets preloaded successfully:', Object.keys(assets.images));

  const urlParams = new URLSearchParams(window.location.search);
  const isRenderMode = urlParams.get('render') === '1';

  if (isRenderMode) {
    // -------------------------------------------------------------
    // MODE B: Headless Lockstep WebSocket Renderer
    // -------------------------------------------------------------
    document.body.classList.add('render-mode');
    console.log('🚀 Entering Headless Lockstep Video Render Mode...');

    const wsUrl = `ws://${window.location.host}/ws-render`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('🔗 WebSocket connected to render backend server.');
      ws.send(JSON.stringify({ type: 'ready' }));
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'render') {
          const t = msg.t;
          const frameNum = msg.frame;

          const state = getTimelineState(t);
          renderFrame(ctx, state, assets, 1920, 1080);

          canvas.toBlob((blob) => {
            if (blob && ws.readyState === WebSocket.OPEN) {
              blob.arrayBuffer().then(buf => {
                ws.send(buf);
              });
            }
          }, 'image/jpeg', 0.88);
        }
      }
    };

    ws.onerror = (err) => console.error('WebSocket Error:', err);
    ws.onclose = () => console.log('WebSocket closed.');

  } else {
    // -------------------------------------------------------------
    // MODE A: Interactive In-Browser Player
    // -------------------------------------------------------------
    console.log('🎮 Initializing Interactive In-Browser Player...');
    setupInteractivePlayer(canvas, ctx, audio);
  }
});

function setupInteractivePlayer(canvas, ctx, audio) {
  const playBtn = document.getElementById('btn-play');
  const scrubber = document.getElementById('timeline-scrubber');
  const timeDisplay = document.getElementById('time-display');
  const actSelect = document.getElementById('act-select');
  const fullscreenBtn = document.getElementById('btn-fullscreen');

  // Populate Act Select
  ACTS.forEach((act) => {
    const opt = document.createElement('option');
    opt.value = act.start;
    opt.textContent = act.name;
    actSelect.appendChild(opt);
  });

  let isPlaying = false;
  let manualT = 0;

  function update() {
    let t = isPlaying ? audio.currentTime : manualT;
    if (t > TOTAL_DURATION) {
      t = TOTAL_DURATION;
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playBtn.textContent = '▶ PLAY';
      }
    }

    const state = getTimelineState(t);
    renderFrame(ctx, state, assets, 1920, 1080);

    // Update UI controls
    if (!scrubber.matches(':active')) {
      scrubber.value = (t / TOTAL_DURATION) * 1000;
    }
    const min = Math.floor(t / 60);
    const sec = (t % 60).toFixed(1).padStart(4, '0');
    timeDisplay.textContent = `0${min}:${sec} / 03:36.0`;

    requestAnimationFrame(update);
  }

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => {
        isPlaying = true;
        playBtn.textContent = '⏸ PAUSE';
      }).catch(err => {
        console.error('Playback failed:', err);
      });
    } else {
      audio.pause();
      isPlaying = false;
      playBtn.textContent = '▶ PLAY';
    }
  });

  scrubber.addEventListener('input', (e) => {
    const pct = parseFloat(e.target.value) / 1000;
    const seekTime = pct * TOTAL_DURATION;
    manualT = seekTime;
    if (audio.readyState >= 2) {
      audio.currentTime = Math.min(audio.duration || TOTAL_DURATION, seekTime);
    }
  });

  actSelect.addEventListener('change', (e) => {
    const seekTime = parseFloat(e.target.value);
    manualT = seekTime;
    if (audio.readyState >= 2) {
      audio.currentTime = Math.min(audio.duration || TOTAL_DURATION, seekTime);
    }
  });

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  });

  // Start rendering loop
  requestAnimationFrame(update);
}
