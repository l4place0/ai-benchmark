// scripts/capture_screenshots.js
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createStaticServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const PORT = 3458;

async function run() {
  const server = await createStaticServer(PORT);

  const chromePath = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  console.log(`Using browser: ${chromePath}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    console.log(`Navigating to http://localhost:${PORT}...`);
    await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0', timeout: 30000 });

    // 等待 WebGL 与场景初始化完成
    await page.waitForFunction(() => window.app && window.app.sceneManager, { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2500));

    // 1. 导出 3D 模型 (.obj)
    console.log("Exporting 3D OBJ model...");
    const objString = await page.evaluate(() => {
      return window.app.sceneManager.voxelScene.toOBJString();
    });
    fs.writeFileSync(path.join(rootDir, 'hakka_tulou.obj'), objString, 'utf-8');
    console.log(`Saved hakka_tulou.obj (${(objString.length / 1024).toFixed(1)} KB)`);

    // 辅助切换视角函数
    const setView = async (viewKey) => {
      await page.evaluate((k) => {
        const btn = document.querySelector(`[data-view="${k}"]`);
        if (btn) btn.click();
        else window.app.switchView(k);
      }, viewKey);
      await new Promise(r => setTimeout(r, 1200));
    };

    // 2. 截取 1: 3/4 俯视等距完整场景 (screenshot_full.png)
    console.log("Capturing 1: Isometric 3/4 Overview (screenshot_full.png)...");
    await setView('isometric_overview');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_full.png') });
    console.log("Saved screenshot_full.png");

    // 3. 截取 2: 建筑近距离细节特写 (screenshot_detail.png)
    console.log("Capturing 2: Architecture Detail Close-up (screenshot_detail.png)...");
    await setView('architecture_detail');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_detail.png') });
    console.log("Saved screenshot_detail.png");

    // 4. 截取 3: 中央天井与内部环廊特写 (screenshot_courtyard.png)
    console.log("Capturing 3: Courtyard Interior (screenshot_courtyard.png)...");
    await setView('courtyard_interior');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_courtyard.png') });
    console.log("Saved screenshot_courtyard.png");

    // 5. 截取 4: 正俯视同心圆空间格局 (screenshot_topdown.png)
    console.log("Capturing 4: Topdown View (screenshot_topdown.png)...");
    await setView('topdown');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_topdown.png') });
    console.log("Saved screenshot_topdown.png");

    // 6. 截取 5: 乡村山地远景 (screenshot_landscape.png)
    console.log("Capturing 5: Village Landscape (screenshot_landscape.png)...");
    await setView('village_landscape');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_landscape.png') });
    console.log("Saved screenshot_landscape.png");

    // 7. 纯 3D 无 UI 渲染全景与特写 (用于无遮挡艺术画质展示)
    console.log("Capturing clean 3D renders without UI overlay...");
    await page.evaluate(() => {
      document.getElementById('ui-overlay').style.display = 'none';
    });
    await setView('isometric_overview');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_full_clean.png') });
    console.log("Saved screenshot_full_clean.png");

    await setView('architecture_detail');
    await page.screenshot({ path: path.join(rootDir, 'screenshot_detail_clean.png') });
    console.log("Saved screenshot_detail_clean.png");

    // 恢复 UI 显示
    await page.evaluate(() => {
      document.getElementById('ui-overlay').style.display = 'flex';
    });

    console.log("All screenshots and 3D assets generated successfully!");
  } catch (err) {
    console.error("Capture failed:", err);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

run();
