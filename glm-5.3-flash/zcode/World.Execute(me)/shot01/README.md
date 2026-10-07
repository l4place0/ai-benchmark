# world.execute(me); — procedural fan MV

Mili《world.execute(me);》(Miracle Milk, 2016) 的程序生成同人 MV。
画面 100% 由 Canvas/WebGL 程序实时计算，**每一帧都是时间 t 的纯函数**，逐帧离线渲染成 1080p60 视频。

## 成品

- `out/world.execute(me)_fanMV_1080p60.mp4` — 1920×1080 / 60fps / H.264 + AAC，时长 217.5s（歌曲 212.33s + 片尾）
- `mv/index.html` — 交互版：浏览器直接打开，点击画面播放（含声音），Space 暂停，←/→ 快进 5s

## 纯函数架构

- 所有动画 = f(t)：节拍网格（BPM 128.00，beat0 = 0.320s）、烘焙能量包络（425 点 @0.5s）、
  12 个段落状态机、150 条歌词/系统 cue、粒子与相机全部由 t 驱动
- 无 wall-clock、无未播种随机数、无跨帧累积（preserveDrawingBuffer + post pass 显式关闭 BLEND）
- `window.__selftest()` 在页面内连续两次渲染同一 t 并比较 PNG —— `det_consecutive / det_after_other = true`

## 段落（12 幕）

| t | 幕 | 内容 |
|---|-----|------|
| 0:00–0:16 | boot | 终端自检、文本打字机、房间线框组装、人物骨骼逐段生长 |
| 0:16–0:30 | drop1 | 标题 "world.execute(me);" 白闪砸落、数据雨、扫描环 |
| 0:30–0:59 | math | 极坐标地板、正弦缎带、圆与切线（歌词的几何隐喻） |
| 0:59–1:14 | chorus1 | STIMULATIONS / SATISFACTION / EXECUTION 大字连击 |
| 1:14–1:44 | rewrite | 双螺旋包裹、object rewrite（eggplant/tomato/tabby） |
| 1:44–1:57 | vibes | 波场干涉、扩散涟漪、VIBRATIONS |
| 1:57–2:06 | sad | ISOLATION：拉远、调暗、独处 |
| 2:06–2:28 | error | 红色告警、stack trace、ILLEGAL ARGUMENTS、人物跪地 |
| 2:28–2:43 | exec | 处刑：EXECUTION ×10、骨骼逐段删除、粒子涡旋、6→1 倒计时（EIN/DOS/TROIS/NE/FEM/LIU） |
| 2:43–3:26 | love | 粒子心脏（72bpm 双搏）、暖色调、LOVE 方程 |
| 3:26–3:32 | final | 最后一发 EXECUTION 白屏、ECG 平线 |
| 3:32–3:38 | outro | "process terminated / exit code 0 / she has been freed / hello, world." + 字幕 |

## 渲染管线

```
mv/index.html + mv_core.js + mv_main.js + timeline.js
        ↓ puppeteer-core + headless Chrome (GPU: ANGLE/D3D11)
window.__renderFrame(t) → PNG (1920×1080) → stdin 管道
        ↓ tools/ffmpeg.exe (libx264 crf17 + aac 192k, apad 对齐 217.5s)
out/world.execute(me)_fanMV_1080p60.mp4
```

命令：`cd render && node main.js samples`（36 关键帧抽样）| `node main.js full`（全片）| `node probe.js <t>`（单帧诊断）

## 素材与工具（全部位于工作空间内）

- 音频：Mili 官方 B站频道 MV (BV1ds411e7df) 音轨，AAC 164kbps / 48kHz / 212.33s → `mv/audio/song.m4a`
- 歌词时间轴：网易云 API LRC（131 行），与音频互相关对齐偏移 +0.10s
- 工具：`tools/` ffmpeg/ffprobe 6.1.1 静态版（npmmirror 镜像）、yt-dlp；`render/node_modules` puppeteer-core 25.12.0；字体 JetBrains Mono（@fontsource，OFL）
- 分析脚本：`analysis/`（BPM/节拍相位/能量包络/LRC 对齐，全部 node 可复现）

## 版权说明

音乐版权归 Mili 及其厂牌所有；本视频为个人学习用途的同人创作（fan work），非商用。
