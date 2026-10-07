# world.execute(me); — procedural fan MV, take 02 "paper doll"

Mili《world.execute(me);》(Miracle Milk, 2016) 的程序生成同人 MV **第二版**。
画面 100% 由 Canvas/WebGL 程序实时计算，**每一帧都是时间 t 的纯函数**，逐帧离线渲染成 1080p60 视频。
（shot01 为终端/机房风格的第一版；本版为全新视觉：白纸、黑墨、朱红丝线的提线木偶剧场。）

## 成品

- `out/world.execute(me)_fanMV_1080p60_take02.mp4` — 1920×1080 / 60fps / H.264 + AAC，时长 217.5s（歌曲 212.33s + 片尾）
- `mv/index.html` — 交互版：浏览器直接打开，点击画面播放（含声音），Space 暂停，←/→ 快进 5s

## 纯函数架构

- 所有动画 = f(t)：节拍网格（BPM 128.00，beat0 = 0.320s）、425 点能量包络（@0.5s）、12 段落状态机、
  141 条歌词/系统 cue、姿势与相机全部由 t 驱动；无 wall-clock、无未播种随机数、无跨帧累积
- `window.__selftest()` 在页面内连续两次渲染同一 t 并比较 PNG —— `det_consecutive / det_after_other = true`
- 分层渲染：GL 射线步进（SDF 提线木偶 22 胶囊 + 吊线 + 软阴影 + 扫描反转带）→ GL 粒子（尘埃/墨滴/迸发/花瓣）
  → 2D 画布艺术层（丝线螺旋、几何小品、曼陀罗、标本图、墨圈、警告条纹、心形红线、心电）→ 后期（纸纹颗粒、
  色差、故障切片、闪白/闪红、纸边暗角）

## 段落（12 幕）

| t | 幕 | 内容 |
|---|-----|------|
| 0:00–0:16 | wake | 白纸剧场，墨滴坠落，人偶平躺 → 吊索 attaching → 被控制杆吊起 |
| 0:16–0:30 | title | 红日 + 大字标题 world.execute(me); 砸落，踢点冲击环，人偶悬于日前 |
| 0:30–0:59 | thread | 红丝线自线轴放出、螺旋缠绕人偶；维度/圆周/切线/渐近线几何小品随歌词展开 |
| 0:59–1:14 | mandala | 八重墨瓣曼陀罗（双层花瓣+虚线轨道+红扫弧），STIMULATIONS/SATISFACTION/EXECUTION 印章 |
| 1:14–1:43 | specimen | 维特鲁威圆方标本图，扫描反转带扫过（X 光带），标注 callout，eggplant→tomato 涂改 |
| 1:43–1:57 | ripples | 吊索剪断，人偶落地站立，脚下踢点同步墨圈涟漪；"you have left" 涟漪冻结 |
| 1:57–2:06 | isolation | 极远景，小人偶与发丝地平线，FRAGMENTS 碎屑飘散 |
| 2:06–2:28 | error | 反转为黑纸：白垩人偶故障抖动，红色警告条纹+堆栈雨，ILLEGAL ARGUMENTS 大印 |
| 2:28–2:43 | exec | 处刑：EXECUTION ×12 逐段粉碎，吊钟摆刀，EIN/DOS/TROIS/NE/FEM/LIU 6→1 倒计时 |
| 2:43–3:26 | love | 米色暖纸，红线描出心形包裹人偶，72bpm 双搏动环，花瓣飘落，心形方程式 |
| 3:26–3:32 | final | "though you are free / I am trapped" 心形长出铁栏与挂锁 → 最后 EXECUTION 白闪 → 黑场心电平线 |
| 3:32–3:38 | outro | 打字机 epilogue + 制作名单，淡出 |

## 渲染管线

```
mv/index.html + mv_core.js + mv_main.js + timeline.js
        ↓ puppeteer-core + headless Chrome (GPU: ANGLE/D3D11)
window.__renderFrame(t) → PNG (1920×1080) → stdin 管道
        ↓ tools/ffmpeg.exe (libx264 crf17 + aac 192k, apad 对齐 217.5s)
out/world.execute(me)_fanMV_1080p60_take02.mp4
```

命令：`cd render && node main.js samples`（45 关键帧抽样）| `node main.js full`（全片）| `node probe.js <t>`（单帧诊断）

## 素材与工具（全部位于工作空间内）

- 音频：Mili 官方 B站频道 MV (BV1ds411e7df) 音轨，AAC 164kbps / 48kHz / 212.33s → `mv/audio/song.m4a`
  （沿用 shot01 已下载素材）
- 歌词时间轴：网易云 API LRC（141 条 cue），与音频互相关对齐偏移 +0.10s（沿用 shot01 验证值）
- 工具：`tools/` ffmpeg/ffprobe 静态版、yt-dlp；`render/node_modules` puppeteer-core；字体 JetBrains Mono（@fontsource，OFL）
- 分析脚本：`analysis/gen_timeline2.js`（BPM/节拍相位/能量包络/LRC 对齐复用 shot01 的 analysis.json）

## 版权说明

音乐版权归 Mili 及其厂牌所有；本视频为个人学习用途的同人创作（fan work），非商用。
