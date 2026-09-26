/**
 * 时光画廊 (Time Gallery) - 应用程序主引导入口
 * Western Art History Immersive Showcase
 */

import { App } from './systems/App.js';

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const app = new App();
    window.__TIME_GALLERY_APP__ = app;
    await app.init();
    console.log('✦ 时光画廊 (Time Gallery) 已成功离线初始化并准备就绪');
  } catch (err) {
    console.error('时光画廊初始化遇到异常:', err);
  }
});
